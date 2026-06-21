/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { BCheckbox, BTextfield, VSCodeContext } from '@borkdominik-biguml/big-components';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import { HighlightElementActionResponse, RequestHighlightElementAction } from '../common/highlight.action.js';
import { FILTER_SPECS } from '../common/search-filter-spec.js';

import type { SearchFilterSpec } from '../common/search-filter-spec.js';
import type { SearchResult } from '../common/searchresult.js';
import { SearchResultThumbnail } from './search-result-thumbnail.component.js';

type QueryableFilter = SearchFilterSpec;

const QUERYABLE_FILTERS: QueryableFilter[] = FILTER_SPECS;

function getFilterValueHint(filter: QueryableFilter): string {
    switch (filter.valueType) {
        case 'boolean':
            return 'boolean: true or false';
        case 'number':
            return 'number';
        default:
            return `string: ${filter.key}="value"`;
    }
}

const CHEATSHEET = [
    {
        category: 'Basic',
        entries: [
            { syntax: 'Class', description: 'All classes' },
            { syntax: 'Attribute', description: 'All attributes' },
            { syntax: 'Method', description: 'All methods' },
            { syntax: 'Relationship', description: 'All relationships (relation)' }
        ]
    },
    {
        category: 'Filters',
        entries: [
            { syntax: 'Class[name="Foo"]', description: 'Class named Foo (exact)' },
            { syntax: 'Class[name~"Foo"]', description: 'Class whose name contains Foo' },
            { syntax: 'Class[isAbstract=true]', description: 'Abstract classes' },
            { syntax: 'Class[visibility="PUBLIC"]', description: 'Public classes' },
            { syntax: 'Attribute[isDerived=true]', description: 'Derived attributes' },
            { syntax: 'Attribute[propertyType="String"]', description: 'Attributes of type String' },
            { syntax: 'Method[isStatic=true]', description: 'Static methods' },
            { syntax: 'Relationship[relationType="ASSOCIATION"]', description: 'Associations' }
        ]
    },
    {
        category: 'Children ( > )',
        entries: [
            { syntax: 'Class > Attribute', description: 'Classes that have attributes' },
            { syntax: 'Class > Method', description: 'Classes that have methods' },
            { syntax: 'Class > Method > Parameter', description: 'Classes with methods that have parameters. A class that has a method that has a parameter' },
            { syntax: 'Class[name="Foo"] > Attribute[isDerived=true]', description: 'Foo with derived attributes' }
        ]
    },
    {
        category: 'Relationships',
        entries: [
            { syntax: 'Relationship[source=Class[name="Foo"]]', description: 'Edges from class Foo' },
            { syntax: 'Relationship[target=Class[name="Bar"]]', description: 'Edges to class Bar' },
            { syntax: 'Relationship[sourceAggregation="NONE"]', description: 'By aggregation type' }
        ]
    },
    {
        category: 'Operators',
        entries: [
            { syntax: '=', description: 'Equals' },
            { syntax: '~', description: 'Contains (partial match)' }
        ]
    }
];

function getBadgeClass(type: string): string {
    const t = type.toLowerCase();
    if (t === 'class' || t === 'abstractclass') return 'result-item__tag--class';
    if (t === 'property' || t === 'attribute') return 'result-item__tag--attribute';
    if (t === 'operation' || t === 'method') return 'result-item__tag--method';
    if (
        [
            'association',
            'aggregation',
            'composition',
            'generalization',
            'dependency',
            'abstraction',
            'usage',
            'realization',
            'interfacerealization',
            'substitution',
            'packageimport',
            'packagemerge'
        ].includes(t)
    )
        return 'result-item__tag--relationship';
    return 'result-item__tag--default';
}

// SVG preview extraction (diagram thumbnails for results)

interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ExtractedElement {
    markup: string;
    bounds?: Bounds;
    ancestorId?: string;
}

interface DiagramSvgData {
    defs: string;
    byId: Map<string, ExtractedElement>;
}

const EMPTY_SVG_DATA: DiagramSvgData = { defs: '', byId: new Map() };

/** Sprotty prefixes element IDs (e.g. "uml-diagram_0_<semanticId>"); take the last segment. */
function semanticIdOf(elementId: string): string {
    const lastUnderscoreIdx = elementId.lastIndexOf('_');
    return lastUnderscoreIdx >= 0 ? elementId.substring(lastUnderscoreIdx + 1) : elementId;
}

/** Walk up the SVG to the nearest ancestor `<g>` that is bounds-aware (has a sizing rect). */
function findBoundedAncestorId(group: Element): string | undefined {
    let el = group.parentElement;
    while (el) {
        if (el.tagName.toLowerCase() === 'g' && el.hasAttribute('id')) {
            const bounds = parseSprottyBounds(el);
            if (bounds && bounds.width > 0 && bounds.height > 0) {
                return semanticIdOf(el.getAttribute('id')!);
            }
        }
        el = el.parentElement;
    }
    return undefined;
}

/**
 * Parse the full diagram SVG and extract per-element `<g>` subtrees by their ID.
 * Sprotty assigns element IDs to `<g>` groups in the rendered SVG. Nodes carry bounds
 * (from a child <rect>); edges are kept too (without bounds) so relations can be composed.
 */
function extractElementsFromSvg(fullSvg: string): DiagramSvgData {
    const byId = new Map<string, ExtractedElement>();
    const parser = new DOMParser();
    const doc = parser.parseFromString(fullSvg, 'image/svg+xml');

    const defsEl = doc.querySelector('defs');
    const defs = defsEl ? new XMLSerializer().serializeToString(defsEl) : '';

    const serializer = new XMLSerializer();
    const groups = doc.querySelectorAll('g[id]');

    for (const group of groups) {
        const elementId = group.getAttribute('id');
        if (!elementId) {
            continue;
        }
        const rawBounds = parseSprottyBounds(group);
        const bounds = rawBounds && rawBounds.width > 0 && rawBounds.height > 0 ? rawBounds : undefined;
        const markup = serializer.serializeToString(group);
        const semanticId = semanticIdOf(elementId);

        // For bounds-less children, remember the enclosing node so we can show it as a fallback preview.
        const ancestorId = bounds ? undefined : findBoundedAncestorId(group);

        // Don't let a bounds-less group (e.g. an edge) clobber a node already mapped to the same id.
        const existing = byId.get(semanticId);
        if (existing?.bounds && !bounds) {
            continue;
        }
        byId.set(semanticId, { markup, bounds, ancestorId });
    }

    return { defs, byId };
}

function unionBounds(a: Bounds, b: Bounds): Bounds {
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x + a.width, b.x + b.width);
    const maxY = Math.max(a.y + a.height, b.y + b.height);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Re-render the ancestor markup with the matched descendant emphasized (accent fill + bold),
 * so a child result (e.g. a property) is recognizable within its parent's preview.
 */
function highlightDescendant(markup: string, childId: string): string {
    const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`, 'image/svg+xml');
    const root = doc.documentElement;
    const target = root.querySelector(`[id="${childId}"], [id$="_${childId}"]`);
    if (target) {
        target.querySelectorAll('text, tspan').forEach(textEl => {
            const style = (textEl as unknown as ElementCSSInlineStyle).style;
            style.setProperty('fill', 'var(--vscode-textLink-foreground, #4ea1ff)', 'important');
            style.setProperty('font-weight', 'bold', 'important');
        });
    }
    return root.firstElementChild ? new XMLSerializer().serializeToString(root.firstElementChild) : markup;
}

/**
 * Build the SVG + bounds for a result's preview.
 * - Relations (have source/target ids): compose the two endpoint nodes plus the connector
 *   into one crop spanning both, so the preview is meaningful rather than a lone line.
 * - Nodes: the element's own `<g>` cropped to its bounds.
 * - Bounds-less children (e.g. a property): the nearest bounds-aware ancestor (the class),
 *   with the matched child highlighted within it.
 */
function buildPreview(item: SearchResult, data: DiagramSvgData): { svg: string; bounds: Bounds } | undefined {
    if (item.sourceId && item.targetId) {
        const src = data.byId.get(item.sourceId);
        const tgt = data.byId.get(item.targetId);
        if (src?.bounds && tgt?.bounds) {
            const edgeMarkup = data.byId.get(item.id)?.markup ?? '';
            return {
                svg: data.defs + edgeMarkup + src.markup + tgt.markup,
                bounds: unionBounds(src.bounds, tgt.bounds)
            };
        }
        return undefined;
    }

    const own = data.byId.get(item.id);
    if (own?.bounds) {
        return { svg: data.defs + own.markup, bounds: own.bounds };
    }
    if (own?.ancestorId) {
        const ancestor = data.byId.get(own.ancestorId);
        if (ancestor?.bounds) {
            return { svg: data.defs + highlightDescendant(ancestor.markup, item.id), bounds: ancestor.bounds };
        }
    }
    return undefined;
}

/**
 * Extract position and size from a Sprotty-rendered `<g>` element.
 * Position comes from `transform="translate(x, y)"`.
 * Size comes from the first child `<rect>` with width/height attributes.
 */
function parseSprottyBounds(group: Element): { x: number; y: number; width: number; height: number } | undefined {
    const transform = group.getAttribute('transform') ?? '';
    const translateMatch = transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
    const x = translateMatch ? parseFloat(translateMatch[1]) : 0;
    const y = translateMatch ? parseFloat(translateMatch[2]) : 0;

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdvancedSearch(): ReactElement {
    const { clientId, dispatchAction, listenAction } = useContext(VSCodeContext);

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showCheatsheet, setShowCheatsheet] = useState(false);

    const [fullDiagramSvg, setFullDiagramSvg] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);
    const [showAllPreviews, setShowAllPreviews] = useState(false);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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

    const highlight = (item: SearchResult) => {
        const semanticUri = (item as any).semanticUri ?? item.id;
        if (!clientId || !semanticUri) return;
        // Relations: fit to the connected nodes since the edge itself has no fittable bounds.
        const fitElementIds = item.sourceId && item.targetId ? [item.sourceId, item.targetId] : undefined;
        dispatchAction(RequestHighlightElementAction.create({ semanticUri, fitElementIds }));
    };

    // Parse the full SVG once into shared <defs> + a per-element lookup of markup/bounds.
    const svgData = useMemo(() => {
        if (!fullDiagramSvg) {
            return EMPTY_SVG_DATA;
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
            if (AdvancedSearchActionResponse.is(action)) {
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
                return;
            }

            if (HighlightElementActionResponse.is(action)) {
                if (action.ok) {
                    return;
                }
            }
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

    const hasResults = results.length > 0;
    const isSearching = query.trim().length > 0;

    return (
        <div className='advanced-search'>
            <div className='advanced-search__controls'>
                <BTextfield
                    className='advanced-search__text'
                    value={query}
                    placeholder='e.g. Class[name="Foo"] or Class > Attribute'
                    onInput={e => fireSearch((e.target as HTMLInputElement).value)}
                >
                    <span slot='end' className='codicon codicon-search' />
                </BTextfield>

                <button
                    className='advanced-search__cheatsheet-toggle'
                    onClick={() => setShowCheatsheet(prev => !prev)}
                    title='Query syntax reference'
                >
                    <span className={`codicon codicon-${showCheatsheet ? 'chevron-up' : 'question'}`} />
                    {showCheatsheet ? ' Hide syntax' : ' Syntax help'}
                </button>

                <BCheckbox
                    className='advanced-search__preview-toggle'
                    label='Show all previews'
                    checked={showAllPreviews}
                    onChange={((e: Event) => setShowAllPreviews(!!(e.target as HTMLInputElement).checked)) as any}
                />
            </div>

            {showCheatsheet && (
                <div className='advanced-search__cheatsheet'>
                    <p className='cheatsheet__intro'>Use structured queries to find elements by type, properties, and relationships. The search is case-insensitive.</p>
                    {CHEATSHEET.map(section => (
                        <div key={section.category} className='cheatsheet__section'>
                            <div className='cheatsheet__category'>{section.category}</div>
                            {section.entries.map((entry, idx) => (
                                <div
                                    key={idx}
                                    className='cheatsheet__entry'
                                    onClick={() => fireSearch(entry.syntax)}
                                    title='Click to use this query'
                                >
                                    <code className='cheatsheet__syntax'>{entry.syntax}</code>
                                    <span className='cheatsheet__desc'>{entry.description}</span>
                                </div>
                            ))}
                        </div>
                    ))}

                    <div className='cheatsheet__section cheatsheet__filter-reference'>
                        <div className='cheatsheet__category'>Queryable parameters</div>
                        <p className='cheatsheet__intro'>
                            A parameter can only be used with the element types listed below. All current filters use equality by default;
                            quote string values and use <code>true</code> or <code>false</code> for booleans.
                        </p>
                        {QUERYABLE_FILTERS.map(filter => (
                            <div key={filter.key} className='cheatsheet__entry cheatsheet__filter-entry'>
                                <code className='cheatsheet__syntax'>{filter.key}</code>
                                <span className='cheatsheet__desc'>
                                    {getFilterValueHint(filter)} · {filter.scopes.join(', ')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showAllPreviews && loading && <div className='advanced-search__svg-loading-bar' />}

            <div>
                {hasResults ? (
                    <ul className='advanced-search__results'>
                        {results.map((item, idx) => {
                            const preview = buildPreview(item, svgData);
                            return (
                                <li
                                    key={idx}
                                    className='result-item'
                                    onClick={() => highlight(item)}
                                    onMouseEnter={() => setHoveredIdx(idx)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                >
                                    <div className='result-item__header'>
                                        <span className={`result-item__tag ${getBadgeClass(item.type)}`}>{item.type}</span>
                                        <span className='result-item__name'>{item.name}</span>
                                    </div>
                                    {item.parentName && <div className='result-item__details'>in {item.parentName}</div>}
                                    {item.details && <div className='result-item__details'>{item.details}</div>}
                                    {(showAllPreviews || hoveredIdx === idx) && (
                                        <SearchResultThumbnail svg={preview?.svg} bounds={preview?.bounds} loading={loading} />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                ) : isSearching ? (
                    <p className='advanced-search__empty'>No results for &ldquo;{query}&rdquo;</p>
                ) : null}
            </div>
        </div>
    );
}
