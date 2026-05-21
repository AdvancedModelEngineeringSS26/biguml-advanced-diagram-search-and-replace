/*********************************************************************************
 * Copyright (c) 2023 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 *********************************************************************************/
import '../css/colors.css';

import { VSCodeSettings } from '@borkdominik-biguml/big-vscode';
import { TYPES, type GlspServer, type OnActivate } from '@borkdominik-biguml/big-vscode/vscode';
import { type Container } from 'inversify';
import * as net from 'node:net';
import * as vscode from 'vscode';
import { createContainer } from './extension.config.js';

let diContainer: Container | undefined;
const GLSP_START_MAX_ATTEMPTS = 20;
const GLSP_START_RETRY_DELAY_MS = 500;
const GLSP_SERVER_HOST = '127.0.0.1';
const GLSP_SERVER_PORT = 5007;

export async function activateClient(context: vscode.ExtensionContext): Promise<void> {
    try {
        diContainer = createContainer(context, {
            glspServerConfig: {
                port: 5007
            },
            diagram: {
                diagramType: VSCodeSettings.diagramType,
                name: VSCodeSettings.name
            }
        });

        diContainer.getAll<OnActivate>(TYPES.OnActivate).forEach(service => service.onActivate?.());

        void startGlspServerWithRetry(diContainer).catch(error => {
            console.error('Failed to connect to GLSP server:', error);
            vscode.window.showErrorMessage('Could not connect to the diagram server. Please restart the extension and check server logs.');
        });

        vscode.commands.executeCommand('setContext', `${VSCodeSettings.name}.isRunning`, true);
    } catch (error) {
        console.error('Failed to activate the extension:', error);
        vscode.window.showErrorMessage('Failed to activate the extension. Please check the console for details.');
    }
}

export async function deactivateClient(_context: vscode.ExtensionContext): Promise<any> {
    if (diContainer) {
        return Promise.all([]);
    }
}

async function startGlspServerWithRetry(container: Container): Promise<void> {
    const glspServer = container.get<GlspServer>(TYPES.GlspServer);

    for (let attempt = 1; attempt <= GLSP_START_MAX_ATTEMPTS; attempt++) {
        try {
            await waitForOpenPort(GLSP_SERVER_HOST, GLSP_SERVER_PORT);
            await glspServer.start();
            return;
        } catch (error) {
            const hasAttemptsLeft = attempt < GLSP_START_MAX_ATTEMPTS;
            if (!isRetriableGlspConnectionError(error) || !hasAttemptsLeft) {
                throw error;
            }

            console.warn(
                `GLSP server connection attempt ${attempt}/${GLSP_START_MAX_ATTEMPTS} failed. Retrying in ${GLSP_START_RETRY_DELAY_MS}ms...`,
                error
            );
            await wait(GLSP_START_RETRY_DELAY_MS);
        }
    }
}

function isRetriableGlspConnectionError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
        return false;
    }

    const errorWithCode = error as { code?: string; message?: string };
    return errorWithCode.code === 'ECONNREFUSED' || errorWithCode.code === 'ERR_SOCKET_CLOSED_BEFORE_CONNECTION';
}

function wait(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function waitForOpenPort(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();

        const onError = (error: Error): void => {
            socket.destroy();
            reject(error);
        };

        socket.once('error', onError);
        socket.setTimeout(GLSP_START_RETRY_DELAY_MS, () => {
            onError(new Error('Socket probe timed out.'));
        });
        socket.connect(port, host, () => {
            socket.destroy();
            resolve();
        });
    });
}
