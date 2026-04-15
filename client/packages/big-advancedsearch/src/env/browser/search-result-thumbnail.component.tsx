/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { type ReactElement } from 'react';

export interface SearchResultThumbnailProps {
    svg?: string;
    bounds?: { x: number; y: number; width: number; height: number };
}

export function SearchResultThumbnail({ svg, bounds }: SearchResultThumbnailProps): ReactElement {
    if (svg) {
        const viewBox = bounds ? `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}` : undefined;

        return (
            <div className='result-item__thumbnail-container'>
                <svg 
                    className='result-item__thumbnail result-item__thumbnail--dynamic' 
                    viewBox={viewBox} 
                    dangerouslySetInnerHTML={{ __html: svg }} 
                />
            </div>
        );
    }

    // Fallback static placeholder
    return (
        <div className='result-item__thumbnail-container'>
            <svg className='result-item__thumbnail' viewBox='0 0 56 40' role='img' aria-label='Static UML thumbnail'>
                <rect x='2' y='2' width='52' height='36' rx='6' className='result-item__thumb-surface' />
                <rect x='8' y='9' width='18' height='8' rx='2' className='result-item__thumb-accent' />
                <rect x='30' y='9' width='18' height='4' rx='2' className='result-item__thumb-line' />
                <rect x='30' y='15' width='14' height='4' rx='2' className='result-item__thumb-line' />
                <rect x='8' y='23' width='40' height='4' rx='2' className='result-item__thumb-line' />
                <rect x='8' y='29' width='24' height='4' rx='2' className='result-item__thumb-line' />
            </svg>
        </div>
    );
}