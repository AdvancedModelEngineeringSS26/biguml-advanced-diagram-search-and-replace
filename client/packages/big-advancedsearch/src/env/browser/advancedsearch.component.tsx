/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { BBadge, BButton, BOption, BSingleSelect, BTextfield, VSCodeContext } from '@borkdominik-biguml/big-components';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import { HighlightElementActionResponse, RequestHighlightElementAction } from '../common/highlight.action.js';
import { ModelChangedNotification } from '../common/model-change.notification.js';
import { applyReplacement } from '../common/replace-semantics.js';
import { ReplaceActionResponse, RequestReplaceAction, type ReplaceResult } from '../common/replace.action.js';
import { UndoNotification } from '../common/undo.notification.js';

import type { SearchResult } from '../common/searchresult.js';

interface ReplaceStatus {
    ok: boolean;
    message: string;
    detail?: string;
    /** True after a successful replace that actually mutated at least one row. */
    canUndo?: boolean;
}

function computeNewValue(oldValue: string | undefined, find: string, replaceWith: string, caseSensitive: boolean): string | undefined {
    if (typeof oldValue !== 'string' || find === '') {
        return oldValue;
    }
    return applyReplacement(oldValue, find, replaceWith, caseSensitive);
}

// Properties whose AST values are drawn from a fixed set. The UI renders these
// as dropdowns instead of free-text inputs. Values are uppercased to match the
// langium AST literals (see `Visibility` in uml-model-server/.../ast.ts).
type PropertyInputType = 'text' | 'select';

interface PropertyConfig {
    label: string;
    inputType: PropertyInputType;
    values?: readonly string[];
    dynamicValues?: boolean;
}

const PROPERTY_CONFIG: Record<string, PropertyConfig> = {
    name: {
        label: 'Name',
        inputType: 'text'
    },
    value: {
        label: 'Value',
        inputType: 'text'
    },
    visibility: {
        label: 'Visibility',
        inputType: 'select',
        values: ['PUBLIC', 'PRIVATE', 'PROTECTED', 'PACKAGE'],
        dynamicValues: true
    },
    aggregation: {
        label: 'Aggregation',
        inputType: 'select',
        values: ['NONE', 'SHARED', 'COMPOSITE'],
        dynamicValues: true
    },
    concurrency: {
        label: 'Concurrency',
        inputType: 'select',
        values: ['SEQUENTIAL', 'GUARDED', 'CONCURRENT'],
        dynamicValues: true
    },
};

// Model-change notifications arriving within this window after a replace are
// attributed to the replace itself and must not retire its status/Undo button.
const REPLACE_STATUS_GRACE_MS = 2000;

function getPropertyConfig(prop: string): PropertyConfig {
    return PROPERTY_CONFIG[prop] ?? {
        label: prop,
        inputType: 'text'
    };
}

function propertyLabel(prop: string): string {
    return getPropertyConfig(prop).label;
}

function getCurrentValue(r: SearchResult, prop: string): string | undefined {
    if (r.properties && prop in r.properties) return r.properties[prop];
    // Backwards compat for results predating the properties map.
    if (prop === 'name' && typeof r.name === 'string') return r.name;
    return undefined;
}

export function AdvancedSearch(): ReactElement {
    const { clientId, dispatchAction, dispatchNotification, listenAction, listenNotification } = useContext(VSCodeContext);
    const [query, setQuery] = useState('');
    const queryRef = useRef('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searchError, setSearchError] = useState<string | undefined>(undefined);
    // Value of the query's name filter, parsed server-side (single source of
    // truth: the same parser that produced the results).
    const [serverFindPattern, setServerFindPattern] = useState('');
    const [replaceOpen, setReplaceOpen] = useState(false);
    const [selectedProperty, setSelectedProperty] = useState('name');
    // Used as the find pattern when `selectedProperty !== 'name'`. For the name
    // property the find pattern is derived from the search query instead, so we
    // never need an override field for that case.
    const [findOverride, setFindOverride] = useState('');
    const [replaceWith, setReplaceWith] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
    const [outcomes, setOutcomes] = useState<Map<string, ReplaceResult>>(new Map());
    const [replaceStatus, setReplaceStatus] = useState<ReplaceStatus | undefined>(undefined);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Refs mirroring context values so the once-registered model-change
    // listener never works with stale closures.
    const clientIdRef = useRef(clientId);
    const dispatchActionRef = useRef(dispatchAction);
    const lastReplaceAtRef = useRef(0);

    useEffect(() => {
        clientIdRef.current = clientId;
        dispatchActionRef.current = dispatchAction;
    }, [clientId, dispatchAction]);

    const fireSearch = (value: string) => {
        setQuery(value);
        queryRef.current = value;
        setOutcomes(new Map());
        setReplaceStatus(undefined);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            if (clientId) {
                dispatchAction(RequestAdvancedSearchAction.create({ query: value }));
            }
        }, 150);
    };

    // Find pattern source depends on the selected property: for `name` it's
    // the query's name filter as parsed by the server, for any other property
    // the user supplies a value via `findOverride`.
    const findPattern = useMemo(() => {
        if (selectedProperty === 'name') return serverFindPattern;
        return findOverride.trim();
    }, [serverFindPattern, selectedProperty, findOverride]);

    // Properties offered in the property selector. Always includes `name` and
    // the currently selected property (so the dropdown stays valid even when no
    // row publishes it); other entries come from whatever results expose.
    const availableProperties = useMemo(() => {
        const set = new Set<string>(['name']);

        for (const r of results) {
            if (r.properties) {
                for (const k of Object.keys(r.properties)) set.add(k);
            }
        }

        return Array.from(set);
    }, [results]);

    const availablePropertyValues = useMemo(() => {
        const map = new Map<string, string[]>();

        for (const r of results) {
            if (!r.properties) continue;

            for (const [key, value] of Object.entries(r.properties)) {
                if (!map.has(key)) {
                    map.set(key, []);
                }

                const values = map.get(key)!;

                if (!values.includes(value)) {
                    values.push(value);
                }
            }
        }

        return map;
    }, [results]);

    useEffect(() => {
        if (!availableProperties.includes(selectedProperty)) {
            setSelectedProperty('name');
            setFindOverride('');
            setReplaceWith('');
            setOutcomes(new Map());
            setReplaceStatus(undefined);
        }
    }, [availableProperties, selectedProperty]);

    const onPropertyChange = (next: string) => {
        setSelectedProperty(next);
        // Reset transient input so switching property doesn't leak a stale
        // pattern or replacement.
        setFindOverride('');
        setReplaceWith('');
        setOutcomes(new Map());
        setReplaceStatus(undefined);
    };

    const highlight = (semanticUri: string | undefined) => {
        if (!clientId || !semanticUri) return;
        dispatchAction(RequestHighlightElementAction.create({ semanticUri }));
    };

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
            // GLSP renders elements with id attribute matching the semantic id
            const el = sprottyRoot.querySelector(`[id="${id}"]`);
            if (el) el.classList.add('search-match');
        }
    }, []);

    // Registered once; reacts to any diagram model change (replace, manual
    // edit, undo/redo) reported by the extension host.
    useEffect(() => {
        listenNotification(ModelChangedNotification.TYPE, () => {
            // Refresh the current result list so names reflect the new model.
            if (clientIdRef.current) {
                dispatchActionRef.current(RequestAdvancedSearchAction.create({ query: queryRef.current }));
            }
            // Retire the replace status (and its Undo button) unless this
            // change is the replace we just performed — after an unrelated
            // edit, the button would undo that edit instead of the replace.
            if (Date.now() - lastReplaceAtRef.current > REPLACE_STATUS_GRACE_MS) {
                setReplaceStatus(undefined);
            }
        });
        // listenNotification has no disposal handle; register exactly once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const dispatchReplace = (elementIds: string[]) => {
        if (!clientId || elementIds.length === 0 || findPattern === '') {
            return;
        }
        setReplaceStatus(undefined);
        lastReplaceAtRef.current = Date.now();
        dispatchAction(
            RequestReplaceAction.create({
                elementIds,
                searchPattern: findPattern,
                replaceWith,
                property: selectedProperty,
                caseSensitive
            })
        );
    };

    const toggleExcluded = (id: string) => {
        setExcludedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Per-row preview of the new value for the selected property (client-side;
    // mirrors backend semantics). `current` is undefined when the row doesn't
    // expose the selected property — those rows render as a missing-value
    // placeholder and stay disabled for replace.
    const previews = useMemo(() => {
        const map = new Map<string, { current: string | undefined; newValue: string; changes: boolean; invalid: boolean }>();
        if (!replaceOpen) return map;
        for (const r of results) {
            const current = getCurrentValue(r, selectedProperty);
            const computed = computeNewValue(current, findPattern, replaceWith, caseSensitive);
            const newValue = typeof computed === 'string' ? computed : (current ?? '');
            const changes = typeof current === 'string' && newValue !== current;
            // Mirrors the backend guard: a replace must not wipe the value.
            const invalid = changes && newValue.trim() === '';
            map.set(r.id, { current, newValue, changes, invalid });
        }
        return map;
    }, [results, findPattern, replaceWith, caseSensitive, replaceOpen, selectedProperty]);

    const includedIds = useMemo(() => results.filter(r => !excludedIds.has(r.id)).map(r => r.id), [results, excludedIds]);

    // "Will modify N of M" counts only rows that are included AND whose preview
    // actually changes into a valid (non-empty) value.
    const willChangeCount = useMemo(
        () =>
            results.filter(r => {
                if (excludedIds.has(r.id)) return false;
                const p = previews.get(r.id);
                return !!p?.changes && !p.invalid;
            }).length,
        [results, excludedIds, previews]
    );

    const replaceAllDisabled = includedIds.length === 0 || findPattern === '' || willChangeCount === 0;

    useEffect(() => {
        const handler = (action: unknown) => {
            if (AdvancedSearchActionResponse.is(action)) {
                setResults(action.results);
                setSearchError(action.error);
                setServerFindPattern(action.findPattern ?? '');
                const ids = action.results.map(r => r.id).filter(Boolean);
                applyDiagramHighlighting(ids);
                const idSet = new Set(action.results.map(r => r.id));
                // Keep outcomes for rows that survived the refresh (the panel
                // re-searches right after a replace — wiping the map here made
                // the outcome icons flash and disappear). User-initiated query
                // changes still clear outcomes in fireSearch.
                setOutcomes(prev => {
                    if (prev.size === 0) return prev;
                    const next = new Map<string, ReplaceResult>();
                    for (const [id, outcome] of prev) {
                        if (idSet.has(id)) next.set(id, outcome);
                    }
                    return next.size === prev.size ? prev : next;
                });
                // Drop excluded IDs that no longer exist in the new result set.
                setExcludedIds(prev => {
                    if (prev.size === 0) return prev;
                    let mutated = false;
                    const next = new Set<string>();
                    for (const id of prev) {
                        if (idSet.has(id)) {
                            next.add(id);
                        } else {
                            mutated = true;
                        }
                    }
                    return mutated ? next : prev;
                });
            }
            if (HighlightElementActionResponse.is(action)) {
                if (action.ok) {
                    return;
                }
            }
            if (ReplaceActionResponse.is(action)) {
                if (action.ok) {
                    const list = action.results ?? [];
                    const changedRows = list.filter(r => r.changed);
                    const erroredRows = list.filter(r => !r.success);
                    // Merge so a single-row replace doesn't wipe the outcome
                    // icons of rows replaced earlier.
                    setOutcomes(prev => {
                        const next = new Map(prev);
                        for (const r of list) {
                            next.set(r.id, r);
                        }
                        return next;
                    });
                    const detail =
                        erroredRows.length > 0
                            ? `${erroredRows.length} error${erroredRows.length !== 1 ? 's' : ''}: ${erroredRows
                                .slice(0, 3)
                                .map(r => r.error ?? 'unknown')
                                .join('; ')}`
                            : undefined;
                    setReplaceStatus({
                        ok: true,
                        message: `Replaced ${changedRows.length} element${changedRows.length !== 1 ? 's' : ''}.`,
                        detail,
                        canUndo: changedRows.length > 0
                    });
                    // Refresh the result list so names reflect the new model state.
                    if (clientId) {
                        dispatchAction(RequestAdvancedSearchAction.create({ query: queryRef.current }));
                    }
                } else {
                    setReplaceStatus({ ok: false, message: `Error: ${action.error ?? 'Replace failed'}` });
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
    }, [listenAction, applyDiagramHighlighting, clientId, dispatchAction]);

    const hasResults = results.length > 0;
    const isSearching = query.trim().length > 0;
    const selectedPropertyConfig = getPropertyConfig(selectedProperty);
    const selectedFindValues =
        selectedPropertyConfig.dynamicValues
            ? availablePropertyValues.get(selectedProperty) ?? []
            : selectedPropertyConfig.values ?? [];

    const selectedReplaceValues =
        selectedPropertyConfig.values ??
        availablePropertyValues.get(selectedProperty) ??
        [];

    return (
        <div className='advanced-search'>
            <div className='advanced-search__controls'>
                <div className='advanced-search__search-row'>
                    <button
                        type='button'
                        className={`advanced-search__toggle ${replaceOpen ? 'advanced-search__toggle--open' : ''}`}
                        title={replaceOpen ? 'Hide replace' : 'Show replace'}
                        aria-expanded={replaceOpen}
                        aria-label='Toggle replace'
                        onClick={() => setReplaceOpen(o => !o)}
                    >
                        <span className={`codicon codicon-chevron-${replaceOpen ? 'down' : 'right'}`} />
                    </button>
                    <BTextfield
                        className='advanced-search__text'
                        value={query}
                        placeholder='e.g. Class[name~"User"]'
                        onInput={e => fireSearch((e.target as HTMLInputElement).value)}
                    >
                        <span slot='end' className='codicon codicon-search' />
                    </BTextfield>
                </div>

                {replaceOpen && (
                    <div className='advanced-search__replace-block'>
                        <div className='advanced-search__property-row'>
                            <label className='advanced-search__property-field'>
                                <span className='advanced-search__property-label'>Property</span>
                                <BSingleSelect
                                    className='advanced-search__property-select'
                                    value={selectedProperty}
                                    onChange={(e: any) => onPropertyChange((e.target as HTMLSelectElement).value)}
                                >
                                    {availableProperties.map(p => (
                                        <BOption key={p} value={p}>
                                            {propertyLabel(p)}
                                        </BOption>
                                    ))}
                                </BSingleSelect>
                            </label>
                            {selectedProperty !== 'name' && (
                                <label className='advanced-search__property-field advanced-search__property-field--grow'>
                                    <span className='advanced-search__property-label'>Find</span>

                                    {selectedPropertyConfig.inputType === 'select' ? (
                                        <BSingleSelect
                                            value={findOverride}
                                            onChange={(e: any) => setFindOverride((e.target as HTMLSelectElement).value)}
                                        >
                                            <BOption value=''>—</BOption>
                                            {selectedFindValues.map(v => (
                                                <BOption key={v} value={v}>
                                                    {v}
                                                </BOption>
                                            ))}
                                        </BSingleSelect>
                                    ) : (
                                        <BTextfield
                                            value={findOverride}
                                            placeholder={`${propertyLabel(selectedProperty)} value to find…`}
                                            onInput={e => setFindOverride((e.target as HTMLInputElement).value)}
                                        />
                                    )}
                                </label>
                            )}
                        </div>
                        <div className='advanced-search__replace-row'>
                            <button
                                type='button'
                                className={`advanced-search__option ${caseSensitive ? 'advanced-search__option--active' : ''}`}
                                title={`Match case (${caseSensitive ? 'on' : 'off'})`}
                                aria-pressed={caseSensitive}
                                aria-label='Match case'
                                onClick={() => setCaseSensitive(v => !v)}
                            >
                                <span className='codicon codicon-case-sensitive' />
                            </button>
                            {selectedPropertyConfig.inputType === 'select' ? (
                                <BSingleSelect
                                    className='advanced-search__text'
                                    value={replaceWith}
                                    onChange={(e: any) => setReplaceWith((e.target as HTMLSelectElement).value)}
                                >
                                    <BOption value=''>Replace with…</BOption>
                                    {selectedReplaceValues.map(v => (
                                        <BOption key={v} value={v}>
                                            {v}
                                        </BOption>
                                    ))}
                                </BSingleSelect>
                            ) : (
                                <BTextfield
                                    className='advanced-search__text'
                                    value={replaceWith}
                                    placeholder='Replace with…'
                                    onInput={e => setReplaceWith((e.target as HTMLInputElement).value)}
                                >
                                    <span slot='end' className='codicon codicon-replace' />
                                </BTextfield>
                            )}
                            <BButton
                                className='advanced-search__replace-btn'
                                onClick={() => dispatchReplace(includedIds)}
                                disabled={replaceAllDisabled}
                                title={
                                    findPattern === ''
                                        ? selectedProperty === 'name'
                                            ? 'Add a name filter (e.g. Class[name~"User"]) to enable replace'
                                            : `Pick a ${propertyLabel(selectedProperty).toLowerCase()} value to find`
                                        : willChangeCount === 0
                                            ? 'No included row would change'
                                            : `Replace ${willChangeCount} element${willChangeCount !== 1 ? 's' : ''}`
                                }
                            >
                                Replace All
                            </BButton>
                        </div>
                        {hasResults && (
                            <p className='advanced-search__replace-hint'>
                                {findPattern === ''
                                    ? selectedProperty === 'name'
                                        ? 'Add a name filter (e.g. Class[name~"User"]) to preview changes.'
                                        : `Pick a ${propertyLabel(selectedProperty).toLowerCase()} value to find.`
                                    : `Replacing matches of "${findPattern}" in ${propertyLabel(selectedProperty).toLowerCase()} — will modify ${willChangeCount} of ${includedIds.length} included element${includedIds.length !== 1 ? 's' : ''}.`}
                            </p>
                        )}
                    </div>
                )}

                {replaceOpen && replaceStatus && (
                    <div
                        className={`advanced-search__replace-status advanced-search__replace-status--${replaceStatus.ok ? 'ok' : 'error'}`}
                    >
                        <span className={`codicon codicon-${replaceStatus.ok ? 'check' : 'error'}`} />
                        <span className='advanced-search__replace-status-message'>{replaceStatus.message}</span>
                        {replaceStatus.canUndo && (
                            <button
                                type='button'
                                className='advanced-search__undo-btn'
                                title='Undo this replace (Ctrl+Z)'
                                onClick={() => {
                                    // No optimistic clear: the undo round-trips
                                    // through the diagram client, and the model-
                                    // change notification it causes retires the
                                    // status. If nothing happens (no active
                                    // client), the button honestly stays.
                                    lastReplaceAtRef.current = 0;
                                    dispatchNotification(UndoNotification.TYPE);
                                }}
                            >
                                <span className='codicon codicon-discard' />
                                <span>Undo</span>
                            </button>
                        )}
                        {replaceStatus.detail && <small>{replaceStatus.detail}</small>}
                    </div>
                )}
            </div>

            <div>
                {hasResults ? (
                    <ul className='advanced-search__results'>
                        {results.map((item, idx) => {
                            const excluded = excludedIds.has(item.id);
                            const preview = previews.get(item.id);
                            const outcome = outcomes.get(item.id);
                            const willChange = !!preview?.changes && !preview.invalid;
                            return (
                                <li
                                    key={`${item.id}-${idx}`}
                                    className={`result-item ${replaceOpen && excluded ? 'result-item--excluded' : ''} ${willChange ? 'result-item--will-change' : ''}`}
                                    onClick={() => highlight((item as any).semanticUri ?? item.id)}
                                >
                                    <div className='result-item__header'>
                                        {replaceOpen && (
                                            <input
                                                type='checkbox'
                                                className='result-item__include'
                                                checked={!excluded}
                                                title={excluded ? 'Include in Replace All' : 'Exclude from Replace All'}
                                                onChange={() => toggleExcluded(item.id)}
                                                onClick={e => e.stopPropagation()}
                                            />
                                        )}
                                        <BBadge className='result-item__tag'>{item.type}</BBadge>
                                        <span className='result-item__name'>
                                            {selectedProperty === 'name' ? (
                                                willChange && preview ? (
                                                    <>
                                                        <span className='result-item__old'>{item.name}</span>
                                                        <span className='result-item__arrow'> → </span>
                                                        <span className='result-item__new'>{preview.newValue}</span>
                                                    </>
                                                ) : (
                                                    item.name
                                                )
                                            ) : (
                                                <>
                                                    <span>{item.name}</span>
                                                    <span className='result-item__prop-preview'>
                                                        {' · '}
                                                        <span className='result-item__prop-label'>{propertyLabel(selectedProperty)}:</span>{' '}
                                                        {preview?.current === undefined ? (
                                                            <span className='result-item__prop-missing'>—</span>
                                                        ) : willChange ? (
                                                            <>
                                                                <span className='result-item__old'>{preview.current}</span>
                                                                <span className='result-item__arrow'> → </span>
                                                                <span className='result-item__new'>{preview.newValue}</span>
                                                            </>
                                                        ) : (
                                                            <span>{preview.current}</span>
                                                        )}
                                                    </span>
                                                </>
                                            )}
                                        </span>
                                        {replaceOpen && outcome && (
                                            <span
                                                className={`result-item__outcome result-item__outcome--${!outcome.success ? 'error' : outcome.changed ? 'changed' : 'noop'
                                                    }`}
                                                title={
                                                    !outcome.success
                                                        ? outcome.error ?? 'Replace failed'
                                                        : outcome.changed
                                                            ? `Replaced: ${outcome.oldValue} → ${outcome.newValue}`
                                                            : 'No change'
                                                }
                                            >
                                                <span
                                                    className={`codicon codicon-${!outcome.success ? 'error' : outcome.changed ? 'check' : 'dash'
                                                        }`}
                                                />
                                            </span>
                                        )}
                                        {replaceOpen && (
                                            <button
                                                type='button'
                                                className='result-item__action'
                                                title={
                                                    findPattern === ''
                                                        ? selectedProperty === 'name'
                                                            ? 'Add a name filter (e.g. Class[name~"User"]) to enable replace'
                                                            : `Pick a ${propertyLabel(selectedProperty).toLowerCase()} value to find`
                                                        : willChange
                                                            ? `Replace this element: ${preview?.current ?? item.name} → ${preview?.newValue}`
                                                            : preview?.invalid
                                                                ? 'Replacement would clear the value'
                                                                : preview?.current === undefined
                                                                    ? `This element has no ${propertyLabel(selectedProperty).toLowerCase()} property`
                                                                    : 'No change in this element'
                                                }
                                                disabled={findPattern === '' || !willChange}
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    dispatchReplace([item.id]);
                                                }}
                                            >
                                                <span className='codicon codicon-replace' />
                                            </button>
                                        )}
                                    </div>
                                    {item.parentName && <div className='result-item__details'>in {item.parentName}</div>}
                                    {item.details && <div className='result-item__details'>{item.details}</div>}
                                </li>
                            );
                        })}
                    </ul>
                ) : isSearching ? (
                    searchError ? (
                        <p className='advanced-search__empty advanced-search__empty--error'>
                            <span className='codicon codicon-warning' /> Could not parse query: {searchError}
                        </p>
                    ) : (
                        <p className='advanced-search__empty'>No results for &ldquo;{query}&rdquo;</p>
                    )
                ) : null}
            </div>
        </div>
    );
}
