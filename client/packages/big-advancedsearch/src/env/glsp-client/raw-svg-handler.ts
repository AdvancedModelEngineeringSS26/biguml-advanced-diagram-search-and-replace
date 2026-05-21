/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/
import type { IActionHandler } from '@eclipse-glsp/client';
import { injectable } from 'inversify';
import { RawDiagramSvgAction, type RequestRawDiagramSvgAction } from '../common/advancedsearch.action.js';

// Only the SVG presentation properties that affect visual appearance.
// Querying 12 targeted properties per element is orders of magnitude faster
// than the minimap's copyStyles() which walks all ~300 computed properties.
const SVG_STYLE_PROPS = [
    'fill', 'fill-opacity',
    'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray',
    'font-family', 'font-size', 'font-weight',
    'text-anchor', 'dominant-baseline',
    'opacity', 'visibility', 'display',
    'marker-end', 'marker-start'
];

/**
 * Handles RequestRawDiagramSvgAction in the GLSP client (diagram webview).
 * Clones the live visible diagram SVG, inlines only the SVG-relevant computed
 * styles from the live elements into the clone, then serializes it.
 * No hidden render, no iframe — the diagram thread stays unblocked.
 */
@injectable()
export class RawDiagramSvgHandler implements IActionHandler {
    handle(action: RequestRawDiagramSvgAction): RawDiagramSvgAction | void {
        if (typeof document === 'undefined') return;

        const svgEl = document.querySelector<SVGSVGElement>('svg');
        if (!svgEl || svgEl.closest('.sprotty-hidden')) return;

        const clone = svgEl.cloneNode(true) as SVGSVGElement;
        this.inlineStyles(svgEl, clone);

        const svg = new XMLSerializer().serializeToString(clone);
        return RawDiagramSvgAction.create({ svg, responseId: action.requestId });
    }

    private inlineStyles(source: Element, target: Element): void {
        const computed = window.getComputedStyle(source);
        const style = SVG_STYLE_PROPS
            .map(p => `${p}:${computed.getPropertyValue(p)}`)
            .join(';');
        target.setAttribute('style', style);

        const kids = source.children;
        const cloneKids = target.children;
        for (let i = 0; i < kids.length; i++) {
            this.inlineStyles(kids[i], cloneKids[i]);
        }
    }
}
