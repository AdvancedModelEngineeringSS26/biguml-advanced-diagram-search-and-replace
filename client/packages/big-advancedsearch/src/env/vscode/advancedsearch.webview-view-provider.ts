/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/
import { MinimapExportSvgAction, RequestMinimapExportSvgAction } from '@borkdominik-biguml/big-minimap';
import type { WebviewMessenger, WebviewViewProviderOptions } from '@borkdominik-biguml/big-vscode/vscode';
import {
    type ActionDispatcher,
    type CacheActionListener,
    type ConnectionManager,
    type GlspModelState,
    TYPES,
    WebviewViewProvider
} from '@borkdominik-biguml/big-vscode/vscode';
import { DisposableCollection } from '@eclipse-glsp/vscode-integration';
import { inject, injectable, postConstruct } from 'inversify';
import type { Disposable } from 'vscode';
import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import type { SearchResult } from '../common/searchresult.js';

@injectable()
export class AdvancedSearchWebviewViewProvider extends WebviewViewProvider {
    @inject(TYPES.ConnectionManager)
    protected readonly connectionManager: ConnectionManager;

    @inject(TYPES.GlspModelState)
    protected readonly modelState: GlspModelState;

    @inject(TYPES.ActionDispatcher)
    protected readonly actionDispatcher: ActionDispatcher;

    protected actionCache: CacheActionListener;
    protected currentDiagramSvg: string | undefined;
    protected pendingSearchResults: SearchResult[] | undefined;

    constructor(@inject(TYPES.WebviewViewOptions) options: WebviewViewProviderOptions) {
        super({
            viewId: options.viewType,
            viewType: options.viewType,
            htmlOptions: {
                files: {
                    js: [['advancedsearch', 'bundle.js']],
                    css: [['advancedsearch', 'bundle.css']]
                }
            }
        });
    }

    @postConstruct()
    protected init(): void {
        this.actionCache = this.actionListener.createCache([AdvancedSearchActionResponse.KIND]);
        this.toDispose.push(this.actionCache);

        // Listen for SVG export responses from the GLSP client (diagram webview)
        this.toDispose.push(
            this.connector.onClientActionMessage(message => {
                if (MinimapExportSvgAction.is(message.action) && this.pendingSearchResults) {
                    const { svg } = message.action as MinimapExportSvgAction;
                    this.currentDiagramSvg = svg;

                    // Re-dispatch results with the full diagram SVG for client-side cropping
                    this.actionMessenger.dispatch(
                        AdvancedSearchActionResponse.create({
                            results: this.pendingSearchResults,
                            fullDiagramSvg: svg
                        })
                    );
                    this.pendingSearchResults = undefined;
                }
            })
        );
    }

    protected override resolveWebviewProtocol(messenger: WebviewMessenger): Disposable {
        const disposables = new DisposableCollection();
        disposables.push(
            super.resolveWebviewProtocol(messenger),
            this.actionCache.onDidChange(message => {
                if (AdvancedSearchActionResponse.is(message.action) && message.action.results.length > 0) {
                    const results = message.action.results;

                    if (this.currentDiagramSvg) {
                        // Reuse cached SVG — no round-trip needed
                        this.actionMessenger.dispatch(
                            AdvancedSearchActionResponse.create({
                                results,
                                fullDiagramSvg: this.currentDiagramSvg
                            })
                        );
                    } else {
                        // Forward results immediately, then request SVG export
                        this.actionMessenger.dispatch(message);
                        this.pendingSearchResults = results.map(r => ({ ...r }));
                        this.connector.sendActionToActiveClient(RequestMinimapExportSvgAction.create());
                    }
                } else {
                    this.actionMessenger.dispatch(message);
                }
            }),
            this.connectionManager.onDidActiveClientChange(() => {
                this.currentDiagramSvg = undefined;
                this.requestModel();
            }),
            this.connectionManager.onNoActiveClient(() => {
                this.currentDiagramSvg = undefined;
                this.actionMessenger.dispatch(AdvancedSearchActionResponse.create());
            }),
            this.connectionManager.onNoConnection(() => {
                this.currentDiagramSvg = undefined;
                this.actionMessenger.dispatch(AdvancedSearchActionResponse.create());
            }),
            this.modelState.onDidChangeModelState(() => {
                this.currentDiagramSvg = undefined;
                this.requestModel();
            })
        );
        return disposables;
    }

    protected override handleOnReady(): void {
        this.requestModel();
        this.actionMessenger.dispatch(this.actionCache.getActions());
    }

    protected override handleOnVisible(): void {
        this.actionMessenger.dispatch(this.actionCache.getActions());
    }

    protected requestModel(): void {
        this.actionDispatcher.dispatch(
            RequestAdvancedSearchAction.create({
                query: ''
            })
        );
    }
}
