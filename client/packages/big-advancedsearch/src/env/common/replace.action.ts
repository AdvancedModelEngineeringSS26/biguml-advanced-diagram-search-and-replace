/*********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 *********************************************************************************/

import { Action, RequestAction, type ResponseAction } from '@eclipse-glsp/protocol';

export interface RequestReplaceAction extends RequestAction<ReplaceActionResponse> {
    kind: typeof RequestReplaceAction.KIND;
    elementId: string;
    value: string;
    property?: string;
}

export namespace RequestReplaceAction {
    export const KIND = 'requestReplace';

    export function is(object: unknown): object is RequestReplaceAction {
        return RequestAction.hasKind(object, KIND);
    }

    export function create(options: { elementId: string; value: string; property?: string }): RequestReplaceAction {
        return {
            kind: KIND,
            requestId: '',
            elementId: options.elementId,
            value: options.value,
            property: options.property
        };
    }
}

export interface ReplaceResult {
    id: string;
    property: string;
    oldValue?: string;
    newValue?: string;
    success: boolean;
    error?: string;
}

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

    export function create(options?: Partial<Omit<ReplaceActionResponse, 'kind' | 'responseId'>> & { responseId?: string }): ReplaceActionResponse {
        return {
            kind: KIND,
            responseId: options?.responseId ?? '',
            ok: options?.ok ?? true,
            results: options?.results,
            error: options?.error
        };
    }
}
