/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { SearchElementType, SearchOperator } from './search-ast.js';

export type SearchValueType = 'string' | 'boolean' | 'number';

export interface SearchFilterSpec {
    key: string;
    scopes: SearchElementType[];
    valueType: SearchValueType;
    defaultOperator?: SearchOperator;
    aliases?: string[];
}

export const FILTER_SPECS: SearchFilterSpec[] = [
    {
        key: 'name',
        scopes: [
            'Class',
            'Attribute',
            'Method',
            'Relationship',
            'DataType',
            'Enumeration',
            'EnumerationLiteral',
            'Interface',
            'PrimitiveType',
            'Package',
            'InstanceSpecification',
            'Slot'
        ],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'visibility',
        scopes: ['Class', 'Attribute', 'Method', 'DataType', 'EnumerationLiteral', 'Package', 'InstanceSpecification'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'isAbstract',
        scopes: ['Class', 'Method', 'DataType'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'isActive',
        scopes: ['Class'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'isStatic',
        scopes: ['Attribute', 'Method'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'isDerived',
        scopes: ['Attribute'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'isDerivedUnion',
        scopes: ['Attribute'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'isReadOnly',
        scopes: ['Attribute'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'isOrdered',
        scopes: ['Attribute'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'isUnique',
        scopes: ['Attribute'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'aggregation',
        scopes: ['Attribute', 'Relationship'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'isQuery',
        scopes: ['Method'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'concurrency',
        scopes: ['Method'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'value',
        scopes: ['EnumerationLiteral'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'uri',
        scopes: ['Package'],
        valueType: 'string',
        defaultOperator: 'equals'
    },

    {
        key: 'multiplicity',
        scopes: ['Attribute', 'Method'],
        valueType: 'string',
        defaultOperator: 'equals'
        // TODO: multiplicity is not yet settable via the property palette UI
        // does not support standard UML multiplicity notation (e.g. "0..*")
    }
];

export function findFilterSpec(scope: SearchElementType, key: string): SearchFilterSpec | undefined {
    const normalizedKey = key.toLowerCase();

    return FILTER_SPECS.find(spec => {
        const names = [spec.key, ...(spec.aliases ?? [])].map(value => value.toLowerCase());
        return spec.scopes.includes(scope) && names.includes(normalizedKey);
    });
}
