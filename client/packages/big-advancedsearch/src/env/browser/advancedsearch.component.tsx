/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { BBadge, BButton, BTextfield, VSCodeContext } from '@borkdominik-biguml/big-components';
import { useContext, useEffect, useRef, useState, type ReactElement } from 'react';

import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import { HighlightElementActionResponse, RequestHighlightElementAction } from '../common/highlight.action.js';
import { ReplaceActionResponse, RequestReplaceAction } from '../common/replace.action.js';

import type { SearchResult } from '../common/searchresult.js';

export function AdvancedSearch(): ReactElement {
    const { clientId, dispatchAction, listenAction } = useContext(VSCodeContext);
    const [query, setQuery] = useState('');
    const queryRef = useRef('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [replaceWith, setReplaceWith] = useState('');
    const [replaceStatus, setReplaceStatus] = useState<string | undefined>(undefined);

    const fireSearch = (value: string) => {
        setQuery(value);
        queryRef.current = value;
        setReplaceStatus(undefined);
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
                    dispatchAction(RequestAdvancedSearchAction.create({ query: queryRef.current }));
                } else {
                    setReplaceStatus(`Error: ${action.error ?? 'Replace failed'}`);
                }
            }
        };
        listenAction(handler);
    }, [listenAction]);

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
                {results.length > 0 ? (
                    <ul className='advanced-search__results'>
                        {results.map((item, idx) => (
                            <li key={idx} className='result-item' onClick={() => highlight((item as any).semanticUri ?? item.id)}>
                                <div className='result-item__header'>
                                    <BBadge className='result-item__tag'>{item.type}</BBadge>
                                    <span className='result-item__name'>{item.name}</span>
                                </div>
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
