/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

/**
 * Canonical replace semantics, shared by the GLSP server handler (the actual
 * mutation) and the webview (the per-row preview). Keeping a single
 * implementation guarantees the preview always shows exactly what the server
 * will do.
 *
 * Matching is literal substring matching, case-insensitive unless
 * `caseSensitive` is true. When the flag is omitted it falls back to
 * case-insensitive to preserve the historical default for callers that don't
 * pass it.
 */
export function applyReplacement(value: string, searchPattern: string, replaceWith: string, caseSensitive?: boolean): string {
    if (searchPattern === '') {
        return value;
    }
    const flags = caseSensitive ? 'g' : 'gi';
    return value.replace(new RegExp(escapeRegexPattern(searchPattern), flags), replaceWith);
}

/** Escapes a string so it matches itself literally inside a RegExp. */
export function escapeRegexPattern(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
