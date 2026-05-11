/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/
import type { DiagramModelState } from '@borkdominik-biguml/uml-glsp-server/vscode';
import { FitToScreenAction, SelectAction, SelectAllAction } from '@eclipse-glsp/protocol';
import { ModelState, type ActionHandler, type MaybePromise } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import { HighlightElementActionResponse, RequestHighlightElementAction } from '../common/highlight.action.js';
import type { SearchResult } from '../common/searchresult.js';
import type { IMatcher } from './matchers/IMatcher.js';
import { ClassDiagramMatcher } from './matchers/classmatcher.js';
import { buildAst } from './matchers/visitor.js';

@injectable()
export class AdvancedSearchActionHandler implements ActionHandler {
    actionKinds = [RequestAdvancedSearchAction.KIND, RequestHighlightElementAction.KIND];

    @inject(ModelState)
    readonly modelState: DiagramModelState;

    private readonly matchers: IMatcher[] = [new ClassDiagramMatcher()];

    execute(action: RequestAdvancedSearchAction | RequestHighlightElementAction): MaybePromise<any[]> {
        if (RequestAdvancedSearchAction.is(action)) {
            return this.handleSearch(action);
        }
        if (RequestHighlightElementAction.is(action)) {
            return this.handleHighlight(action);
        }
        return [];
    }

    protected handleSearch(action: RequestAdvancedSearchAction): any[] {
        const diagram = this.modelState.semanticRoot.diagram;
        const rawQuery = action.query.trim();

        try {
            const results: SearchResult[] = [];

            if (rawQuery.includes('[') || rawQuery.length === 0) {
                for (const matcher of this.matchers) {
                    const diagramCopy = diagram;
                    if (rawQuery.length === 0) {
                        results.push(...matcher.match(diagramCopy));
                        continue;
                    }
                    const criteria = buildAst(rawQuery);
                    if (matcher instanceof ClassDiagramMatcher) {
                        results.push(...matcher.matchAdvanced(diagramCopy, criteria));
                    }
                }
            } else {
                let type: string | undefined;
                let pattern: string | undefined;

                if (rawQuery.includes(':')) {
                    const [rawType, rawPattern] = rawQuery.split(':', 2);
                    type = rawType?.trim().toLowerCase() || undefined;
                    pattern = rawPattern?.trim().toLowerCase() || undefined;
                } else {
                    type = undefined;
                    pattern = rawQuery.toLowerCase() || undefined;
                }

                const applicableMatchers = !type ? this.matchers : this.matchers.filter(m => m.supportsPartial?.(type!));

                for (const matcher of applicableMatchers) {
                    results.push(...matcher.match(diagram));
                }

                const filtered = results.filter(item => {
                    const itemType = item.type.toLowerCase();
                    const name = item.name?.toLowerCase() ?? '';
                    const details = item.details?.toLowerCase() ?? '';
                    const parentName = item.parentName?.toLowerCase() ?? '';

                    const matchesType = !type || itemType.includes(type);
                    const matchesPattern =
                        !pattern ||
                        this.matchesGlob(name, pattern) ||
                        this.matchesGlob(details, pattern) ||
                        this.matchesGlob(parentName, pattern);

                    return matchesType && matchesPattern;
                });

                results.length = 0;
                results.push(...filtered);
            }

            const unique = new Map<string, SearchResult>();
            for (const item of results) {
                const key = `${item.id}-${item.type}`;
                const existing = unique.get(key);
                if (!existing) {
                    unique.set(key, item);
                    continue;
                }
                const existingIsUnknown = (existing.name ?? '').includes('(unknown)');
                const candidateIsUnknown = (item.name ?? '').includes('(unknown)');
                if (existingIsUnknown && !candidateIsUnknown) {
                    unique.set(key, item);
                }
            }

            const finalResults = Array.from(unique.values());
            const matchedIds = finalResults.map(r => r.id).filter(Boolean);

            const diagramActions: any[] = [];
            if (matchedIds.length > 0) {
                diagramActions.push(
                    SelectAllAction.create(false),
                    SelectAction.create({ selectedElementsIDs: matchedIds }),
                    FitToScreenAction.create(matchedIds, { padding: 20, animate: true })
                );
            } else if (rawQuery.length === 0) {
                diagramActions.push(SelectAllAction.create(false));
            }

            return [...diagramActions, AdvancedSearchActionResponse.create({ results: finalResults })];
        } catch (e) {
            console.error('Could not parse query', e);
            return [AdvancedSearchActionResponse.create({ results: [] })];
        }
    }

    protected handleHighlight(action: RequestHighlightElementAction): any[] {
        const uri = action.semanticUri;
        return [
            SelectAllAction.create(false),
            SelectAction.create({ selectedElementsIDs: [uri] }),
            FitToScreenAction.create([uri], { padding: 40, animate: true }),
            HighlightElementActionResponse.create({ ok: true })
        ];
    }

    /**
     * Glob matching: * matches any sequence of characters.
     * Falls back to substring match when no * is present.
     */
    private matchesGlob(text: string, pattern: string): boolean {
        if (!pattern.includes('*')) {
            return text.includes(pattern);
        }
        const regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return new RegExp(regexStr).test(text);
    }
}
