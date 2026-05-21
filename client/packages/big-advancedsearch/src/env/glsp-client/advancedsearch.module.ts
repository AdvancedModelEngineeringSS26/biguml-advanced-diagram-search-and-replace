/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/
import { configureActionHandler, FeatureModule, FitToScreenAction, SelectAction, SelectAllAction } from '@eclipse-glsp/client';
import { ExtensionActionKind } from '@eclipse-glsp/vscode-integration-webview/lib/features/default/extension-action-handler.js';
import { AdvancedSearchActionResponse, RawDiagramSvgAction, RequestRawDiagramSvgAction } from '../common/advancedsearch.action.js';
import { HighlightElementActionResponse } from '../common/highlight.action.js';
import { RawDiagramSvgHandler } from './raw-svg-handler.js';

export const advancedSearchModule = new FeatureModule((bind, unbind, isBound, rebind) => {
    const context = { bind, unbind, isBound, rebind };

    // Allow responses to propagate from server back to extension
    bind(ExtensionActionKind).toConstantValue(AdvancedSearchActionResponse.KIND);
    bind(ExtensionActionKind).toConstantValue(HighlightElementActionResponse.KIND);

    // Allow diagram actions dispatched by the server to reach the GLSP client/diagram
    bind(ExtensionActionKind).toConstantValue(SelectAction.KIND);
    bind(ExtensionActionKind).toConstantValue(SelectAllAction.KIND);
    bind(ExtensionActionKind).toConstantValue(FitToScreenAction.KIND);

    // Handle live SVG export directly from the DOM — no hidden render, no iframe, no style copying
    configureActionHandler(context, RequestRawDiagramSvgAction.KIND, RawDiagramSvgHandler);
    bind(ExtensionActionKind).toConstantValue(RawDiagramSvgAction.KIND);
});
