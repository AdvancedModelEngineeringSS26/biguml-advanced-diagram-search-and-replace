/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { DiagramModelState } from '@borkdominik-biguml/uml-glsp-server/vscode';
import { SelectAction, SelectAllAction } from '@eclipse-glsp/protocol';
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

            if (rawQuery.length === 0) {
                for (const matcher of this.matchers) {
                    results.push(...matcher.match(diagram));
                }

                return [AdvancedSearchActionResponse.create({ results })];
            }

            const criteria = buildAst(rawQuery);

            for (const matcher of this.matchers) {
                if ('matchAdvanced' in matcher && typeof matcher.matchAdvanced === 'function') {
                    results.push(...matcher.matchAdvanced(diagram, criteria));
                }
            }

            return [AdvancedSearchActionResponse.create({ results })];
        } catch (error) {
            console.error('Could not parse query', error);
            return [AdvancedSearchActionResponse.create({ results: [] })];
        }
    }

    protected handleHighlight(action: RequestHighlightElementAction): any[] {
        const uri = action.semanticUri;
        return [
            SelectAllAction.create(false),
            SelectAction.create({ selectedElementsIDs: [uri] }),
            HighlightElementActionResponse.create({ ok: true })
        ];
    }
}
