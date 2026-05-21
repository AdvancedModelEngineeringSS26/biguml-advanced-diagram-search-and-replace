/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/
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
import { AdvancedSearchActionResponse, RawDiagramSvgAction, RequestAdvancedSearchAction, RequestRawDiagramSvgAction } from '../common/advancedsearch.action.js';
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
    protected svgExportInFlight = false;

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

        this.toDispose.push(
            this.connector.onClientActionMessage(message => {
                if (RawDiagramSvgAction.is(message.action)) {
                    const { svg } = message.action as RawDiagramSvgAction;
                    this.currentDiagramSvg = svg;
                    this.svgExportInFlight = false;

                    if (this.pendingSearchResults) {
                        this.actionMessenger.dispatch(
                            AdvancedSearchActionResponse.create({
                                results: this.pendingSearchResults,
                                fullDiagramSvg: svg
                            })
                        );
                        this.pendingSearchResults = undefined;
                    }
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
                        this.actionMessenger.dispatch(
                            AdvancedSearchActionResponse.create({
                                results,
                                fullDiagramSvg: this.currentDiagramSvg
                            })
                        );
                    } else {
                        this.actionMessenger.dispatch(message);
                        this.pendingSearchResults = results.map(r => ({ ...r }));
                        this.prefetchSvg();
                    }
                } else {
                    this.actionMessenger.dispatch(message);
                }
            }),
            this.connectionManager.onDidActiveClientChange(() => {
                this.currentDiagramSvg = undefined;
                this.svgExportInFlight = false;
                this.pendingSearchResults = undefined;
                this.actionMessenger.dispatch(AdvancedSearchActionResponse.create());
                this.prefetchSvg();
                this.requestModel();
            }),
            this.connectionManager.onNoActiveClient(() => {
                this.currentDiagramSvg = undefined;
                this.svgExportInFlight = false;
                this.pendingSearchResults = undefined;
                this.actionMessenger.dispatch(AdvancedSearchActionResponse.create());
            }),
            this.connectionManager.onNoConnection(() => {
                this.currentDiagramSvg = undefined;
                this.svgExportInFlight = false;
                this.pendingSearchResults = undefined;
                this.actionMessenger.dispatch(AdvancedSearchActionResponse.create());
            }),
            this.modelState.onDidChangeModelState(() => {
                this.currentDiagramSvg = undefined;
                this.svgExportInFlight = false;
                this.pendingSearchResults = undefined;
                this.prefetchSvg();
                this.requestModel();
            })
        );
        return disposables;
    }

    protected override handleOnReady(): void {
        this.prefetchSvg();
        this.requestModel();
        this.actionMessenger.dispatch(this.actionCache.getActions());
    }

    protected requestModel(): void {
        this.actionDispatcher.dispatch(RequestAdvancedSearchAction.create({ query: '' }));
    }

    protected override handleOnVisible(): void {
        this.actionMessenger.dispatch(this.actionCache.getActions());
    }

    protected prefetchSvg(): void {
        if (!this.currentDiagramSvg && !this.svgExportInFlight && this.connectionManager.hasActiveClient()) {
            this.svgExportInFlight = true;
            this.connector.sendActionToActiveClient(RequestRawDiagramSvgAction.create());
        }
    }
}
