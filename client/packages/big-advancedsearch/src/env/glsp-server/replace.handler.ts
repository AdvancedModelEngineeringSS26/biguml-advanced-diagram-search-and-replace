/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { ModelPatchCommand } from '@borkdominik-biguml/uml-glsp-server/vscode';
import type { DiagramModelState } from '@borkdominik-biguml/uml-glsp-server/vscode';
import { ModelState, ModelSubmissionHandler, type ActionHandler, type MaybePromise } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { ReplaceActionResponse, RequestReplaceAction, type ReplaceResult } from '../common/replace.action.js';

const SAFE_PROPERTY_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

@injectable()
export class ReplaceActionHandler implements ActionHandler {
    actionKinds = [RequestReplaceAction.KIND];

    @inject(ModelState)
    readonly modelState: DiagramModelState;

    @inject(ModelSubmissionHandler)
    protected readonly modelSubmissionHandler: ModelSubmissionHandler;

    execute(action: RequestReplaceAction): MaybePromise<any[]> {
        if (RequestReplaceAction.is(action)) {
            return this.handleReplace(action);
        }
        return [];
    }

    protected async handleReplace(action: RequestReplaceAction): Promise<any[]> {
        const property = action.property ?? 'name';

        if (!SAFE_PROPERTY_RE.test(property)) {
            return [ReplaceActionResponse.create({ ok: false, error: `Invalid property name: "${property}"` })];
        }

        if (action.isRegex) {
            try {
                new RegExp(action.searchPattern);
            } catch (e) {
                return [ReplaceActionResponse.create({ ok: false, error: `Invalid regex: "${action.searchPattern}"` })];
            }
        }

        const patchOps: { op: 'replace'; path: string; value: string }[] = [];
        const results: ReplaceResult[] = [];

        for (const id of action.elementIds) {
            const node = this.modelState.index.findIdElement(id);
            if (!node) {
                results.push({ id, property, success: false, error: 'Element not found' });
                continue;
            }

            const path = this.modelState.index.findPath(id);
            if (!path) {
                results.push({ id, property, success: false, error: 'JSON path not found' });
                continue;
            }

            const oldValue = (node as any)[property];
            if (typeof oldValue !== 'string') {
                results.push({ id, property, oldValue: String(oldValue ?? ''), success: false, error: `Property "${property}" is not a string` });
                continue;
            }

            const newValue = this.applyReplacement(oldValue, action.searchPattern, action.replaceWith, action.isRegex ?? false);
            if (newValue === oldValue) {
                results.push({ id, property, oldValue, newValue, success: true });
                continue;
            }

            patchOps.push({ op: 'replace', path: path + '/' + property, value: newValue });
            results.push({ id, property, oldValue, newValue, success: true });
        }

        if (patchOps.length > 0) {
            const cmd = new ModelPatchCommand(this.modelState, JSON.stringify(patchOps));
            await cmd.execute();
            const submissionActions = await this.modelSubmissionHandler.submitModel();
            return [...submissionActions, ReplaceActionResponse.create({ ok: true, results })];
        }

        return [ReplaceActionResponse.create({ ok: true, results })];
    }

    protected applyReplacement(value: string, searchPattern: string, replaceWith: string, isRegex: boolean): string {
        if (isRegex) {
            return value.replace(new RegExp(searchPattern, 'g'), replaceWith);
        }
        if (searchPattern === '') {
            return replaceWith;
        }
        return value.split(searchPattern).join(replaceWith);
    }
}
