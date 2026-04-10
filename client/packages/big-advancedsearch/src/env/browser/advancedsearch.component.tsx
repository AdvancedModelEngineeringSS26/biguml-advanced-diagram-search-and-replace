/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { BBadge, BTextfield, VSCodeContext } from '@borkdominik-biguml/big-components';
import { useContext, useEffect, useMemo, useState, type ReactElement } from 'react';

import { AdvancedSearchActionResponse, AdvancedSearchSvgUpdateAction, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import { HighlightElementActionResponse, RequestHighlightElementAction } from '../common/highlight.action.js';

import type { SearchResult } from '../common/searchresult.js';

interface ElementSvgData {
    svgContent: string;
    bounds: { x: number; y: number; width: number; height: number };
}

function extractElementSvgs(
    fullSvg: string,
    elementIds: string[]
): Map<string, ElementSvgData> {
    const result = new Map<string, ElementSvgData>();
    if (!fullSvg || elementIds.length === 0) {
        return result;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(fullSvg, 'image/svg+xml');
    const svgRoot = doc.querySelector('svg');
    if (!svgRoot) {
        return result;
    }

    // Extract the <defs> section to include with each cropped element
    const defsEl = svgRoot.querySelector('defs');
    const defsHtml = defsEl ? defsEl.outerHTML : '';

    for (const id of elementIds) {
        // Sprotty assigns element IDs to <g> groups
        const gElement = doc.getElementById(id);
        if (!gElement) {
            continue;
        }

        // Compute bounds from the element's bounding box via SVG geometry
        const bbox = computeBBoxFromElement(gElement);
        if (!bbox || bbox.width === 0 || bbox.height === 0) {
            continue;
        }

        // Serialize the element's HTML including its children
        const serializer = new XMLSerializer();
        const elementHtml = serializer.serializeToString(gElement);

        // Build a standalone SVG snippet: defs + the element
        const svgContent = defsHtml + elementHtml;

        result.set(id, {
            svgContent,
            bounds: bbox
        });
    }

    return result;
}

function computeBBoxFromElement(element: Element): { x: number; y: number; width: number; height: number } | null {
    // Try to get bounds from transform + child positions
    // Parse all numeric coordinate attributes from descendants
    const allX: number[] = [];
    const allY: number[] = [];

    const walk = (el: Element) => {
        // Check for common SVG positional attributes
        for (const attr of ['x', 'cx', 'x1', 'x2']) {
            const val = el.getAttribute(attr);
            if (val) {
                allX.push(parseFloat(val));
            }
        }
        for (const attr of ['y', 'cy', 'y1', 'y2']) {
            const val = el.getAttribute(attr);
            if (val) {
                allY.push(parseFloat(val));
            }
        }
        // Check width/height for rect-like elements
        const w = el.getAttribute('width');
        const h = el.getAttribute('height');
        const x = el.getAttribute('x');
        const y = el.getAttribute('y');
        if (x && y && w && h) {
            allX.push(parseFloat(x) + parseFloat(w));
            allY.push(parseFloat(y) + parseFloat(h));
        }

        for (let i = 0; i < el.children.length; i++) {
            walk(el.children[i]);
        }
    };

    walk(element);

    if (allX.length === 0 || allY.length === 0) {
        return null;
    }

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    // Add padding
    const padding = 10;
    return {
        x: minX - padding,
        y: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2
    };
}

export function AdvancedSearch(): ReactElement {
    const { clientId, dispatchAction, listenAction } = useContext(VSCodeContext);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [fullSvg, setFullSvg] = useState<string | undefined>(undefined);

    const fireSearch = (value: string) => {
        setQuery(value);
        if (clientId) {
            dispatchAction(RequestAdvancedSearchAction.create({ query: value }));
        }
    };

    const highlight = (semanticUri: string | undefined) => {
        if (!clientId || !semanticUri) {
            return;
        }
        dispatchAction(RequestHighlightElementAction.create({ semanticUri }));
    };

    useEffect(() => {
        const handler = (action: unknown) => {
            if (AdvancedSearchActionResponse.is(action)) {
                setResults(action.results);
            }
            if (AdvancedSearchSvgUpdateAction.is(action)) {
                setFullSvg(action.svg);
            }
            if (HighlightElementActionResponse.is(action)) {
                if (action.ok) {
                    return;
                }
            }
        };
        listenAction(handler);
    }, [listenAction]);

    // Extract per-element SVG data from the full diagram SVG
    const elementSvgs = useMemo(() => {
        if (!fullSvg || results.length === 0) {
            return new Map<string, ElementSvgData>();
        }
        const ids = results.map(r => r.id);
        return extractElementSvgs(fullSvg, ids);
    }, [fullSvg, results]);

    // Merge SVG data into results
    const enrichedResults = useMemo(() => {
        return results.map(item => {
            const svgData = elementSvgs.get(item.id);
            if (svgData) {
                return { ...item, svg: svgData.svgContent, bounds: svgData.bounds };
            }
            return item;
        });
    }, [results, elementSvgs]);

    return (
        <div className='advanced-search'>
            <div className='advanced-search__controls'>
                <BTextfield
                    className='advanced-search__text'
                    value={query}
                    placeholder='e.g. Class:Lecture'
                    onInput={e => fireSearch((e.target as HTMLInputElement).value)}
                >
                    <span slot='end' className='codicon codicon-search' />
                </BTextfield>
            </div>

            <div>
                {enrichedResults.length > 0 ? (
                    <ul className='advanced-search__results'>
                        {enrichedResults.map((item, idx) => (
                            <li key={idx} className='result-item' onClick={() => highlight((item as any).semanticUri ?? item.id)}>
                                <div className='result-item__header'>
                                    <BBadge className='result-item__tag'>{item.type}</BBadge>
                                    <span className='result-item__name'>{item.name}</span>
                                </div>
                                {item.svg && item.bounds && (
                                    <div className='result-item__preview'>
                                        <svg
                                            viewBox={`${item.bounds.x} ${item.bounds.y} ${item.bounds.width} ${item.bounds.height}`}
                                        >
                                            <g dangerouslySetInnerHTML={{ __html: item.svg }} />
                                        </svg>
                                    </div>
                                )}
                                {item.details && <div className='result-item__details'>{item.details}</div>}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No results found.</p>
                )}
            </div>
        </div>
    );
}
