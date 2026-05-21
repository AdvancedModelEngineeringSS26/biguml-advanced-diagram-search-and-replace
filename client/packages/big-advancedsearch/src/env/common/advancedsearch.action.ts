/*********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 *********************************************************************************/

import { Action, RequestAction, type ResponseAction } from '@eclipse-glsp/protocol';
import type { SearchResult } from './searchresult.js';

/**
 * Request sent from WebView to backend to initiate an advanced search.
 */
export interface RequestAdvancedSearchAction extends RequestAction<AdvancedSearchActionResponse> {
    kind: typeof RequestAdvancedSearchAction.KIND;
    query: string;
}

export namespace RequestAdvancedSearchAction {
    export const KIND = 'requestAdvancedSearch';

    export function is(object: unknown): object is RequestAdvancedSearchAction {
        return RequestAction.hasKind(object, KIND);
    }

    export function create(options: { query: string }): RequestAdvancedSearchAction {
        return {
            kind: KIND,
            requestId: '',
            query: options.query
        };
    }
}

/**
 * Response sent from backend to WebView with search results.
 */
export interface AdvancedSearchActionResponse extends ResponseAction {
    kind: typeof AdvancedSearchActionResponse.KIND;
    results: SearchResult[];
    fullDiagramSvg?: string;
}

export namespace AdvancedSearchActionResponse {
    export const KIND = 'advancedSearchResponse';

    export function is(object: unknown): object is AdvancedSearchActionResponse {
        return Action.hasKind(object, KIND);
    }

    export function create(
        options?: Partial<Omit<AdvancedSearchActionResponse, 'kind' | 'responseId'>> & { responseId?: string }
    ): AdvancedSearchActionResponse {
        return {
            kind: KIND,
            responseId: options?.responseId ?? '',
            results: options?.results ?? [],
            fullDiagramSvg: options?.fullDiagramSvg
        };
    }
}

/**
 * Sent from the extension to the GLSP client (diagram webview) to request the live SVG.
 */
export interface RequestRawDiagramSvgAction extends RequestAction<RawDiagramSvgAction> {
    kind: typeof RequestRawDiagramSvgAction.KIND;
}

export namespace RequestRawDiagramSvgAction {
    export const KIND = 'requestRawDiagramSvg';

    export function is(object: unknown): object is RequestRawDiagramSvgAction {
        return RequestAction.hasKind(object, KIND);
    }

    export function create(): RequestRawDiagramSvgAction {
        return { kind: KIND, requestId: '' };
    }
}

/**
 * Sent from the GLSP client (diagram webview) back to the extension with the serialized live SVG.
 */
export interface RawDiagramSvgAction extends ResponseAction {
    kind: typeof RawDiagramSvgAction.KIND;
    svg?: string;
}

export namespace RawDiagramSvgAction {
    export const KIND = 'rawDiagramSvg';

    export function is(object: unknown): object is RawDiagramSvgAction {
        return Action.hasKind(object, KIND);
    }

    export function create(options?: { svg?: string; responseId?: string }): RawDiagramSvgAction {
        return { kind: KIND, responseId: options?.responseId ?? '', svg: options?.svg };
    }
}
