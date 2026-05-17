/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { NotificationType } from 'vscode-messenger-common';

/**
 * Sent from the webview to ask VS Code to run its built-in `undo` command on
 * the currently active editor — typically the GLSP diagram that was last
 * focused. We bounce through VS Code's command rather than dispatching a GLSP
 * `UndoAction` directly so the undo goes through the same path as Ctrl+Z and
 * stays in sync with VS Code's custom-document undo stack.
 */
export namespace UndoNotification {
    export const TYPE: NotificationType<void> = { method: 'big.advancedsearch.undo' };
}
