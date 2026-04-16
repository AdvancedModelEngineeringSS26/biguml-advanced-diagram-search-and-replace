/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { BBadge, BButton, BTextfield, VSCodeContext } from '@borkdominik-biguml/big-components';
import { useCallback, useContext, useEffect, useRef, useState, type ReactElement } from 'react';

import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import { HighlightElementActionResponse, RequestHighlightElementAction } from '../common/highlight.action.js';
import { ReplaceActionResponse, RequestReplaceAction } from '../common/replace.action.js';

import type { SearchResult } from '../common/searchresult.js';

export function AdvancedSearch(): ReactElement {
    const { clientId, dispatchAction, listenAction } = useContext(VSCodeContext);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [replaceWith, setReplaceWith] = useState('');
    const [replaceStatus, setReplaceStatus] = useState<string | undefined>(undefined);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fireSearch = (value: string) => {
        setQuery(value);
        setReplaceStatus(undefined);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            if (clientId) {
                dispatchAction(RequestAdvancedSearchAction.create({ query: value }));
            }
        }, 150);
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

    const fireReplaceAll = () => {
        if (!clientId || results.length === 0) {
            return;
        }
        setReplaceStatus(undefined);
        const elementIds = results.map(r => r.id);
        dispatchAction(
            RequestReplaceAction.create({
                elementIds,
                searchPattern: query.includes(':') ? query.split(':', 2)[1]?.trim() ?? '' : query,
                replaceWith
            })
        );
    };

    useEffect(() => {
        const handler = (action: unknown) => {
            if (AdvancedSearchActionResponse.is(action)) {
                setResults(action.results);
                const ids = action.results.map(r => r.id).filter(Boolean);
                applyDiagramHighlighting(ids);
            }
            if (HighlightElementActionResponse.is(action)) {
                if (action.ok) {
                    return;
                }
            }
            if (ReplaceActionResponse.is(action)) {
                if (action.ok) {
                    const changed = action.results?.filter(r => r.success && r.oldValue !== r.newValue).length ?? 0;
                    setReplaceStatus(`Replaced ${changed} element${changed !== 1 ? 's' : ''}.`);
                } else {
                    setReplaceStatus(`Error: ${action.error ?? 'Replace failed'}`);
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

                <div className='advanced-search__replace-row'>
                    <BTextfield
                        className='advanced-search__text'
                        value={replaceWith}
                        placeholder='Replace with…'
                        onInput={e => setReplaceWith((e.target as HTMLInputElement).value)}
                    >
                        <span slot='end' className='codicon codicon-replace' />
                    </BTextfield>
                    <BButton className='advanced-search__replace-btn' onClick={fireReplaceAll} disabled={results.length === 0}>
                        Replace All
                    </BButton>
                </div>

                {replaceStatus && <p className='advanced-search__replace-status'>{replaceStatus}</p>}
            </div>

            <div>
                {hasResults ? (
                    <ul className='advanced-search__results'>
                        {results.map((item, idx) => (
                            <li key={idx} className='result-item' onClick={() => highlight((item as any).semanticUri ?? item.id)}>
                                <div className='result-item__header'>
                                    <BBadge className='result-item__tag'>{item.type}</BBadge>
                                    <span className='result-item__name'>{item.name}</span>
                                </div>
                                {item.parentName && <div className='result-item__details'>in {item.parentName}</div>}
                                {item.details && <div className='result-item__details'>{item.details}</div>}
                            </li>
                        ))}
                    </ul>
                ) : isSearching ? (
                    <p className='advanced-search__empty'>No results for &ldquo;{query}&rdquo;</p>
                ) : null}
            </div>
        </div>
    );
}
