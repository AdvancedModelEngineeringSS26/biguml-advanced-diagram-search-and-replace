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
import { MinimapExportSvgAction, RequestMinimapExportSvgAction } from '@borkdominik-biguml/big-minimap';
import { DisposableCollection } from '@eclipse-glsp/vscode-integration';
import { inject, injectable, postConstruct } from 'inversify';
import type { Disposable } from 'vscode';
import { AdvancedSearchActionResponse, AdvancedSearchSvgUpdateAction, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';

@injectable()
export class AdvancedSearchWebviewViewProvider extends WebviewViewProvider {
    @inject(TYPES.ConnectionManager)
    protected readonly connectionManager: ConnectionManager;

    @inject(TYPES.GlspModelState)
    protected readonly modelState: GlspModelState;

    @inject(TYPES.ActionDispatcher)
    protected readonly actionDispatcher: ActionDispatcher;

    protected actionCache: CacheActionListener;
    protected svgCache: CacheActionListener;
    protected pendingSvgRequest = false;

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
        this.svgCache = this.actionListener.createCache([MinimapExportSvgAction.KIND]);
        this.toDispose.push(this.actionCache, this.svgCache);
    }

    protected override resolveWebviewProtocol(messenger: WebviewMessenger): Disposable {
        const disposables = new DisposableCollection();
        disposables.push(
            super.resolveWebviewProtocol(messenger),
            this.actionCache.onDidChange(message => {
                this.actionMessenger.dispatch(message);
                this.requestSvgExport();
            }),
            this.svgCache.onDidChange(message => {
                if (MinimapExportSvgAction.is(message)) {
                    this.handleSvgExport(message);
                }
            }),
            this.connectionManager.onDidActiveClientChange(() => this.requestModel()),
            this.connectionManager.onNoActiveClient(() => this.actionMessenger.dispatch(AdvancedSearchActionResponse.create())),
            this.connectionManager.onNoConnection(() => this.actionMessenger.dispatch(AdvancedSearchActionResponse.create())),
            this.modelState.onDidChangeModelState(() => this.requestModel())
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

    protected requestSvgExport(): void {
        if (this.pendingSvgRequest) {
            return;
        }
        this.pendingSvgRequest = true;
        setTimeout(() => {
            this.actionDispatcher.dispatch(RequestMinimapExportSvgAction.create());
            this.pendingSvgRequest = false;
        }, 200);
    }

    protected handleSvgExport(action: MinimapExportSvgAction): void {
        if (action.svg && action.bounds) {
            this.actionMessenger.dispatch(
                AdvancedSearchSvgUpdateAction.create({
                    svg: action.svg,
                    bounds: action.bounds
                })
            );
        }
    }
}
