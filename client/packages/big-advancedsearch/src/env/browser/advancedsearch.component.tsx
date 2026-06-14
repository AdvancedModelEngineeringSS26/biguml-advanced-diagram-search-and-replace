/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { BBadge, BCheckbox, BTextfield, VSCodeContext } from '@borkdominik-biguml/big-components';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import { RequestHighlightElementAction } from '../common/highlight.action.js';

import type { SearchResult } from '../common/searchresult.js';
import { SearchResultThumbnail } from './search-result-thumbnail.component.js';

interface ExtractedElement {
    svgContent: string;
    bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Parse the full diagram SVG and extract per-element `<g>` subtrees by their ID.
 * Sprotty assigns element IDs to `<g>` groups in the rendered SVG.
 */
function extractElementsFromSvg(fullSvg: string): Map<string, ExtractedElement> {
    const map = new Map<string, ExtractedElement>();

    const parser = new DOMParser();
    const doc = parser.parseFromString(fullSvg, 'image/svg+xml');

    // Collect shared <defs> (markers, gradients, etc.)
    const defs = doc.querySelector('defs');
    const defsMarkup = defs ? new XMLSerializer().serializeToString(defs) : '';

    const serializer = new XMLSerializer();

    // Find all <g> elements with an id attribute
    const groups = doc.querySelectorAll('g[id]');

    for (const group of groups) {
        const elementId = group.getAttribute('id');
        if (!elementId) {
            continue;
        }

        // Parse bounds from the element structure:
        // Sprotty <g> elements use transform="translate(x, y)" for position
        // and child <rect> elements for dimensions.
        const bounds = parseSprottyBounds(group);
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            continue;
        }

        const innerMarkup = serializer.serializeToString(group);

        // Sprotty prefixes element IDs (e.g. "uml-diagram_0_<semanticId>").
        // Extract the semantic ID by finding the last UUID-like segment.
        const lastUnderscoreIdx = elementId.lastIndexOf('_');
        const semanticId = lastUnderscoreIdx >= 0 ? elementId.substring(lastUnderscoreIdx + 1) : elementId;
        map.set(semanticId, {
            svgContent: defsMarkup + innerMarkup,
            bounds
        });
    }

    return map;
}

/**
 * Extract position and size from a Sprotty-rendered `<g>` element.
 * Position comes from `transform="translate(x, y)"`.
 * Size comes from the first child `<rect>` with width/height attributes.
 */
function parseSprottyBounds(group: Element): { x: number; y: number; width: number; height: number } | undefined {
    // Parse translate(x, y) from transform attribute
    const transform = group.getAttribute('transform') ?? '';
    const translateMatch = transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
    const x = translateMatch ? parseFloat(translateMatch[1]) : 0;
    const y = translateMatch ? parseFloat(translateMatch[2]) : 0;

    // Find the first <rect> child for dimensions
    const rect = group.querySelector('rect');
    if (rect) {
        const width = parseFloat(rect.getAttribute('width') ?? '0');
        const height = parseFloat(rect.getAttribute('height') ?? '0');
        if (width > 0 && height > 0) {
            return { x, y, width, height };
        }
    }

    return undefined;
}

export function AdvancedSearch(): ReactElement {
    const { clientId, dispatchAction, listenAction } = useContext(VSCodeContext);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [fullDiagramSvg, setFullDiagramSvg] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);
    const [previewsEnabled, setPreviewsEnabled] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fireSearch = (value: string) => {
        setQuery(value);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            if (clientId) {
                if (!fullDiagramSvg) {
                    setLoading(true);
                }
                dispatchAction(RequestAdvancedSearchAction.create({ query: value }));
            }
        }, 150);
    };

    const highlight = (semanticUri: string | undefined) => {
        if (!clientId || !semanticUri) return;
        dispatchAction(RequestHighlightElementAction.create({ semanticUri }));
    };

    // Parse the full SVG once and build a lookup map of elementId → { svgContent, bounds }
    const svgElementMap = useMemo(() => {
        if (!fullDiagramSvg) {
            return new Map<string, ExtractedElement>();
        }
        return extractElementsFromSvg(fullDiagramSvg);
    }, [fullDiagramSvg]);

    const applyDiagramHighlighting = useCallback((matchedIds: string[]) => {
        const sprottyRoot = document.querySelector('.sprotty');
        if (!sprottyRoot) return;

        if (matchedIds.length > 0) {
            sprottyRoot.classList.add('search-active');
        } else {
            sprottyRoot.classList.remove('search-active');
        }

        sprottyRoot.querySelectorAll('.search-match').forEach(el => {
            el.classList.remove('search-match');
        });

        for (const id of matchedIds) {
            const el = sprottyRoot.querySelector(`[id="${id}"]`);
            if (el) el.classList.add('search-match');
        }
    }, []);

    useEffect(() => {
        const handler = (action: unknown) => {
            if (!AdvancedSearchActionResponse.is(action)) {
                return;
            }

            // Background SVG export status — just toggle the loading indicator, keep current results.
            if (action.exportInFlight !== undefined) {
                setLoading(action.exportInFlight);
                return;
            }

            // Normal results update
            setResults(action.results);
            applyDiagramHighlighting(action.results.map(r => r.id).filter(Boolean));

            const svg = action.fullDiagramSvg;
            if (svg) {
                setFullDiagramSvg(svg);
            } else if (action.results.length === 0) {
                setFullDiagramSvg(undefined);
            }
            // Loading while results exist but their SVG hasn't arrived yet.
            setLoading(action.results.length > 0 && !svg);
        };
        listenAction(handler);

        return () => {
            const sprottyRoot = document.querySelector('.sprotty');
            if (sprottyRoot) {
                sprottyRoot.classList.remove('search-active');
                sprottyRoot.querySelectorAll('.search-match').forEach(el => el.classList.remove('search-match'));
            }
        };
    }, [listenAction, applyDiagramHighlighting]);

    return (
        <div className='advanced-search'>
            <div className='advanced-search__controls'>
                <BTextfield
                    className='advanced-search__text'
                    value={query}
                    placeholder='e.g. Class:User*'
                    onInput={e => fireSearch((e.target as HTMLInputElement).value)}
                >
                    <span slot='end' className='codicon codicon-search' />
                </BTextfield>
                <BCheckbox
                    className='advanced-search__preview-toggle'
                    label='Show previews'
                    checked={previewsEnabled}
                    onChange={((e: Event) => setPreviewsEnabled(!!(e.target as HTMLInputElement).checked)) as any}
                />
            </div>

            {previewsEnabled && loading && <div className='advanced-search__svg-loading-bar' />}

            <div>
                {results.length > 0 ? (
                    <ul className='advanced-search__results'>
                        {results.map((item, idx) => {
                            const extracted = svgElementMap.get(item.id);
                            return (
                                <li key={idx} className='result-item' onClick={() => highlight((item as any).semanticUri ?? item.id)}>
                                    <div className='result-item__header'>
                                        <BBadge className='result-item__tag'>{item.type}</BBadge>
                                        <span className='result-item__name'>{item.name}</span>
                                    </div>
                                    {item.parentName && <div className='result-item__details'>in {item.parentName}</div>}
                                    {item.details && <div className='result-item__details'>{item.details}</div>}
                                    {previewsEnabled && (
                                        <SearchResultThumbnail
                                            svg={extracted?.svgContent}
                                            bounds={extracted?.bounds}
                                            loading={loading}
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                ) : previewsEnabled && loading ? null : (
                    <p>No results found.</p>
                )}
            </div>
        </div>
    );
}
