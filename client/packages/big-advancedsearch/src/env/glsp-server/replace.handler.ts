/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { DiagramModelState } from '@borkdominik-biguml/uml-glsp-server/vscode';
import { ModelPatchCommand } from '@borkdominik-biguml/uml-glsp-server/vscode';
import { ModelState, type ActionHandler } from '@eclipse-glsp/server';
import { inject, injectable } from 'inversify';
import { RequestReplaceAction, ReplaceActionResponse } from '../common/replace.action.js';

@injectable()
export class ReplaceActionHandler implements ActionHandler {
    actionKinds = [RequestReplaceAction.KIND];

    @inject(ModelState)
    readonly modelState: DiagramModelState;

    async execute(action: RequestReplaceAction): Promise<any[]> {
        return this.handleReplace(action);
    }

    protected async handleReplace(action: RequestReplaceAction): Promise<any[]> {
        const elementId = action.elementId?.trim();
        const property = action.property?.trim() || 'name';
        const value = action.value?.trim() ?? '';

        if (!elementId) {
            return [ReplaceActionResponse.create({ ok: false, error: 'Missing elementId' })];
        }

        if (!value) {
            return [ReplaceActionResponse.create({ ok: false, error: 'Replacement value is empty' })];
        }

        if (!this.isSafeProperty(property)) {
            return [ReplaceActionResponse.create({ ok: false, error: 'Unsupported property name' })];
        }

        const basePath = this.modelState.index.findPath(elementId);
        if (!basePath) {
            return [ReplaceActionResponse.create({ ok: false, error: 'Unable to resolve element path' })];
        }

        const element = this.modelState.index.findIdElement(elementId);
        if (!element) {
            return [ReplaceActionResponse.create({ ok: false, error: 'Unable to resolve element information' })];
        }

        const op = this.chooseOp(element, property);
        const patch = [{ op, path: `${basePath}/${property}`, value }];
        const command = new ModelPatchCommand(this.modelState, JSON.stringify(patch));

        return [
            command,
            ReplaceActionResponse.create({
                ok: true,
                results: [
                    {
                        id: elementId,
                        property,
                        oldValue: (element as any)[property],
                        newValue: value,
                        success: true
                    }
                ]
            })
        ];
    }

    protected chooseOp(element: any, property: string): 'add' | 'replace' {
        return element && element[property] !== undefined ? 'replace' : 'add';
    }

    protected isSafeProperty(property: string): boolean {
        return /^[A-Za-z0-9_]+$/.test(property);
    }
}
