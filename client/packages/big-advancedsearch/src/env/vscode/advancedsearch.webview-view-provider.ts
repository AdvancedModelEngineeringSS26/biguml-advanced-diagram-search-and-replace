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
import { UndoAction } from '@eclipse-glsp/protocol';
import { DisposableCollection } from '@eclipse-glsp/vscode-integration';
import { inject, injectable, postConstruct } from 'inversify';
import { type Disposable } from 'vscode';
import { AdvancedSearchActionResponse, RequestAdvancedSearchAction } from '../common/advancedsearch.action.js';
import { ReplaceActionResponse } from '../common/replace.action.js';
import { UndoNotification } from '../common/undo.notification.js';

@injectable()
export class AdvancedSearchWebviewViewProvider extends WebviewViewProvider {
    @inject(TYPES.ConnectionManager)
    protected readonly connectionManager: ConnectionManager;

    @inject(TYPES.GlspModelState)
    protected readonly modelState: GlspModelState;

    @inject(TYPES.ActionDispatcher)
    protected readonly actionDispatcher: ActionDispatcher;

    protected actionCache: CacheActionListener;

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
        this.actionCache = this.actionListener.createCache([AdvancedSearchActionResponse.KIND, ReplaceActionResponse.KIND]);
        this.toDispose.push(this.actionCache);
    }

    protected override resolveWebviewProtocol(messenger: WebviewMessenger): Disposable {
        const disposables = new DisposableCollection();
        disposables.push(
            super.resolveWebviewProtocol(messenger),
            this.actionCache.onDidChange(message => this.actionMessenger.dispatch(message)),
            this.connectionManager.onDidActiveClientChange(() => this.requestModel()),
            this.connectionManager.onNoActiveClient(() => this.actionMessenger.dispatch(AdvancedSearchActionResponse.create())),
            this.connectionManager.onNoConnection(() => this.actionMessenger.dispatch(AdvancedSearchActionResponse.create())),
            this.modelState.onDidChangeModelState(() => this.requestModel()),
            // UndoAction is a client-side GLSP action — must be routed to the
            // active GLSP client (the diagram webview), which then sends an
            // UndoOperation to the server. Dispatching it via the server-side
            // actionDispatcher would silently no-op.
            messenger.onNotification(UndoNotification.TYPE, () => {
                this.connector.sendActionToActiveClient(UndoAction.create());
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
