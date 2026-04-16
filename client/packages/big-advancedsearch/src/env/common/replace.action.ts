/*********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 *********************************************************************************/

import { Action, RequestAction, type ResponseAction } from '@eclipse-glsp/protocol';

export interface ReplaceResult {
    id: string;
    property: string;
    oldValue?: string;
    newValue?: string;
    success: boolean;
    error?: string;
}

/**
 * Request sent from WebView to backend to replace a property value across multiple elements.
 */
export interface RequestReplaceAction extends RequestAction<ReplaceActionResponse> {
    kind: typeof RequestReplaceAction.KIND;
    /** Semantic element IDs to update. */
    elementIds: string[];
    /** Substring to find (empty string = replace whole value). */
    searchPattern: string;
    /** Replacement text. */
    replaceWith: string;
    /** Property to update. Defaults to 'name'. */
    property?: string;
    /** Whether searchPattern should be treated as a regular expression. */
    isRegex?: boolean;
}

export namespace RequestReplaceAction {
    export const KIND = 'requestReplace';

    export function is(object: unknown): object is RequestReplaceAction {
        return RequestAction.hasKind(object, KIND);
    }

    export function create(options: {
        elementIds: string[];
        searchPattern: string;
        replaceWith: string;
        property?: string;
        isRegex?: boolean;
        requestId?: string;
    }): RequestReplaceAction {
        return {
            kind: KIND,
            requestId: options.requestId ?? '',
            elementIds: options.elementIds,
            searchPattern: options.searchPattern,
            replaceWith: options.replaceWith,
            property: options.property,
            isRegex: options.isRegex
        };
    }
}

/**
 * Response sent from backend after a replace operation.
 */
export interface ReplaceActionResponse extends ResponseAction {
    kind: typeof ReplaceActionResponse.KIND;
    ok: boolean;
    results?: ReplaceResult[];
    error?: string;
}

export namespace ReplaceActionResponse {
    export const KIND = 'replaceActionResponse';

    export function is(object: unknown): object is ReplaceActionResponse {
        return Action.hasKind(object, KIND);
    }

    export function create(options?: Partial<Omit<ReplaceActionResponse, 'kind'>> & { responseId?: string }): ReplaceActionResponse {
        return {
            kind: KIND,
            responseId: options?.responseId ?? '',
            ok: options?.ok ?? false,
            results: options?.results,
            error: options?.error
        };
    }
}
