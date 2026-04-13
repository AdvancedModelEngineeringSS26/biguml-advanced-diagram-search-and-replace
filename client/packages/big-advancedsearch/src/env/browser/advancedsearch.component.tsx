/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { BBadge, BTextfield, VSCodeContext } from '@borkdominik-biguml/big-components';
import { useContext, useEffect, useState, type ReactElement } from 'react';

import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import { HighlightElementActionResponse, RequestHighlightElementAction } from '../common/highlight.action.js';
import { RequestReplaceAction, ReplaceActionResponse } from '../common/replace.action.js';

import type { SearchResult } from '../common/searchresult.js';

export function AdvancedSearch(): ReactElement {
    const { clientId, dispatchAction, listenAction } = useContext(VSCodeContext);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [replaceProperty, setReplaceProperty] = useState('name');
    const [replaceValue, setReplaceValue] = useState('');
    const [replaceMessage, setReplaceMessage] = useState('');

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

    const selectedResult = results.find(item => item.id === selectedId);

    const fireReplace = () => {
        if (!clientId || !selectedResult) {
            return;
        }
        if (!replaceValue.trim()) {
            setReplaceMessage('Replacement value cannot be empty.');
            return;
        }
        setReplaceMessage('');
        dispatchAction(RequestReplaceAction.create({
            elementId: selectedResult.id,
            property: replaceProperty,
            value: replaceValue
        }));
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
                    setReplaceMessage('Replace succeeded.');
                    setReplaceValue('');
                } else {
                    setReplaceMessage(`Replace failed: ${action.error ?? 'Unknown error'}`);
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
            </div>

            {selectedResult && (
                <div className='advanced-search__replace-panel'>
                    <div className='advanced-search__replace-header'>
                        <strong>Replace for:</strong> {selectedResult.name} <em>({selectedResult.type})</em>
                    </div>
                    <div className='advanced-search__replace-fields'>
                        <label>
                            Property
                            <select
                                value={replaceProperty}
                                onChange={e => setReplaceProperty(e.target.value)}
                            >
                                {Object.keys(selectedResult.properties ?? { name: selectedResult.name }).map(prop => (
                                    <option key={prop} value={prop}>
                                        {prop}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            New value
                            <BTextfield
                                value={replaceValue}
                                onInput={e => setReplaceValue((e.target as HTMLInputElement).value)}
                                placeholder='Enter replacement text'
                            />
                        </label>
                        <button type='button' onClick={fireReplace}>
                            Replace
                        </button>
                    </div>
                    {replaceMessage && <div className='advanced-search__replace-message'>{replaceMessage}</div>}
                </div>
            )}

            <div>
                {results.length > 0 ? (
                    <ul className='advanced-search__results'>
                        {results.map((item, idx) => (
                            <li
                                key={idx}
                                className={`result-item ${item.id === selectedId ? 'selected' : ''}`}
                                onClick={() => {
                                    setSelectedId(item.id);
                                    highlight((item as any).semanticUri ?? item.id);
                                }}
                            >
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
