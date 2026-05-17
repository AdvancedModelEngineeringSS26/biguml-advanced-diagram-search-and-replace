/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { BBadge, BButton, BTextfield, VSCodeContext } from '@borkdominik-biguml/big-components';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import { HighlightElementActionResponse, RequestHighlightElementAction } from '../common/highlight.action.js';
import { ReplaceActionResponse, RequestReplaceAction, type ReplaceResult } from '../common/replace.action.js';

import type { SearchResult } from '../common/searchresult.js';

interface ReplaceStatus {
    ok: boolean;
    message: string;
    detail?: string;
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function computeNewValue(oldValue: string | undefined, find: string, replaceWith: string): string | undefined {
    if (typeof oldValue !== 'string' || find === '') {
        return oldValue;
    }
    try {
        return oldValue.replace(new RegExp(escapeRegex(find), 'gi'), replaceWith);
    } catch {
        return oldValue;
    }
}

function derivePatternFromQuery(query: string): string {
    if (query.includes(':')) {
        return query.split(':', 2)[1]?.trim() ?? '';
    }
    return query.trim();
}

export function AdvancedSearch(): ReactElement {
    const { clientId, dispatchAction, listenAction } = useContext(VSCodeContext);
    const [query, setQuery] = useState('');
    const queryRef = useRef('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [find, setFind] = useState('');
    const [findDirty, setFindDirty] = useState(false);
    const [replaceWith, setReplaceWith] = useState('');
    const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
    const [outcomes, setOutcomes] = useState<Map<string, ReplaceResult>>(new Map());
    const [replaceStatus, setReplaceStatus] = useState<ReplaceStatus | undefined>(undefined);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fireSearch = (value: string) => {
        setQuery(value);
        queryRef.current = value;
        setOutcomes(new Map());
        setReplaceStatus(undefined);
        if (!findDirty) {
            setFind(derivePatternFromQuery(value));
        }
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            if (clientId) {
                dispatchAction(RequestAdvancedSearchAction.create({ query: value }));
            }
        }, 150);
    };

    const onFindChange = (value: string) => {
        setFind(value);
        setFindDirty(true);
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

    const dispatchReplace = (elementIds: string[]) => {
        if (!clientId || elementIds.length === 0 || find === '') {
            return;
        }
        setReplaceStatus(undefined);
        dispatchAction(
            RequestReplaceAction.create({
                elementIds,
                searchPattern: find,
                replaceWith
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

    // Per-row preview of new value (client-side; mirrors backend semantics).
    const previews = useMemo(() => {
        const map = new Map<string, { newName: string; changes: boolean }>();
        for (const r of results) {
            const newName = computeNewValue(r.name, find, replaceWith) ?? r.name;
            map.set(r.id, { newName, changes: newName !== r.name });
        }
        return map;
    }, [results, find, replaceWith]);

    const includedIds = useMemo(() => results.filter(r => !excludedIds.has(r.id)).map(r => r.id), [results, excludedIds]);

    // "Will modify N of M" counts only rows that are included AND whose preview actually changes.
    const willChangeCount = useMemo(
        () => results.filter(r => !excludedIds.has(r.id) && previews.get(r.id)?.changes).length,
        [results, excludedIds, previews]
    );

    const replaceAllDisabled = includedIds.length === 0 || find === '' || willChangeCount === 0;

    useEffect(() => {
        const handler = (action: unknown) => {
            if (AdvancedSearchActionResponse.is(action)) {
                setResults(action.results);
                const ids = action.results.map(r => r.id).filter(Boolean);
                applyDiagramHighlighting(ids);
                // New search results invalidate prior per-row outcomes.
                setOutcomes(new Map());
                // Drop excluded IDs that no longer exist in the new result set.
                setExcludedIds(prev => {
                    if (prev.size === 0) return prev;
                    const idSet = new Set(action.results.map(r => r.id));
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
                    const nextOutcomes = new Map<string, ReplaceResult>();
                    for (const r of list) {
                        nextOutcomes.set(r.id, r);
                    }
                    setOutcomes(nextOutcomes);
                    const detail =
                        erroredRows.length > 0
                            ? `${erroredRows.length} error${erroredRows.length !== 1 ? 's' : ''}: ${erroredRows
                                  .slice(0, 3)
                                  .map(r => r.error ?? 'unknown')
                                  .join('; ')}`
                            : undefined;
                    setReplaceStatus({
                        ok: true,
                        message: `Replaced ${changedRows.length} element${changedRows.length !== 1 ? 's' : ''}. Use Editor > Undo (Ctrl+Z) to revert.`,
                        detail
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
    }, [listenAction, applyDiagramHighlighting]);

    const hasResults = results.length > 0;
    const isSearching = query.trim().length > 0;

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

                <div className='advanced-search__replace-block'>
                    <BTextfield
                        className='advanced-search__text'
                        value={find}
                        placeholder='Find (case-insensitive)…'
                        onInput={e => onFindChange((e.target as HTMLInputElement).value)}
                    >
                        <span slot='end' className='codicon codicon-search' />
                    </BTextfield>
                    <div className='advanced-search__replace-row'>
                        <BTextfield
                            className='advanced-search__text'
                            value={replaceWith}
                            placeholder='Replace with…'
                            onInput={e => setReplaceWith((e.target as HTMLInputElement).value)}
                        >
                            <span slot='end' className='codicon codicon-replace' />
                        </BTextfield>
                        <BButton
                            className='advanced-search__replace-btn'
                            onClick={() => dispatchReplace(includedIds)}
                            disabled={replaceAllDisabled}
                            title={
                                find === ''
                                    ? 'Enter a Find pattern first'
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
                            {find === ''
                                ? 'Enter a Find pattern to preview changes.'
                                : `Will modify ${willChangeCount} of ${includedIds.length} included element${includedIds.length !== 1 ? 's' : ''}.`}
                        </p>
                    )}
                </div>

                {replaceStatus && (
                    <div
                        className={`advanced-search__replace-status advanced-search__replace-status--${replaceStatus.ok ? 'ok' : 'error'}`}
                    >
                        <span className={`codicon codicon-${replaceStatus.ok ? 'check' : 'error'}`} />
                        <span>{replaceStatus.message}</span>
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
                            const willChange = !!preview?.changes;
                            return (
                                <li
                                    key={`${item.id}-${idx}`}
                                    className={`result-item ${excluded ? 'result-item--excluded' : ''} ${willChange ? 'result-item--will-change' : ''}`}
                                    onClick={() => highlight((item as any).semanticUri ?? item.id)}
                                >
                                    <div className='result-item__header'>
                                        <input
                                            type='checkbox'
                                            className='result-item__include'
                                            checked={!excluded}
                                            title={excluded ? 'Include in Replace All' : 'Exclude from Replace All'}
                                            onChange={() => toggleExcluded(item.id)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                        <BBadge className='result-item__tag'>{item.type}</BBadge>
                                        <span className='result-item__name'>
                                            {willChange && preview ? (
                                                <>
                                                    <span className='result-item__old'>{item.name}</span>
                                                    <span className='result-item__arrow'> → </span>
                                                    <span className='result-item__new'>{preview.newName}</span>
                                                </>
                                            ) : (
                                                item.name
                                            )}
                                        </span>
                                        {outcome && (
                                            <span
                                                className={`result-item__outcome result-item__outcome--${
                                                    !outcome.success ? 'error' : outcome.changed ? 'changed' : 'noop'
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
                                                    className={`codicon codicon-${
                                                        !outcome.success ? 'error' : outcome.changed ? 'check' : 'dash'
                                                    }`}
                                                />
                                            </span>
                                        )}
                                        <button
                                            type='button'
                                            className='result-item__action'
                                            title={
                                                find === ''
                                                    ? 'Enter a Find pattern first'
                                                    : willChange
                                                      ? `Replace this element: ${item.name} → ${preview?.newName}`
                                                      : 'No change in this element'
                                            }
                                            disabled={find === '' || !willChange}
                                            onClick={e => {
                                                e.stopPropagation();
                                                dispatchReplace([item.id]);
                                            }}
                                        >
                                            <span className='codicon codicon-replace' />
                                        </button>
                                    </div>
                                    {item.parentName && <div className='result-item__details'>in {item.parentName}</div>}
                                    {item.details && <div className='result-item__details'>{item.details}</div>}
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
