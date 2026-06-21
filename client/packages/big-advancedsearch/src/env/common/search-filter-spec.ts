/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

export type SearchFilterOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
export type SearchFilterValueType = 'string' | 'boolean' | 'number';

export interface SearchFilterSpec {
    key: string;
    scopes: string[];
    valueType: SearchFilterValueType;
    defaultOperator?: SearchFilterOperator;
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
            'Slot',
            'Parameter'
        ],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'visibility',
        scopes: [
            'Class',
            'Attribute',
            'Method',
            'DataType',
            'EnumerationLiteral',
            'Package',
            'InstanceSpecification',
            'Relationship',
            'Parameter'
        ],
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
        scopes: ['Attribute', 'Parameter'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'isException',
        scopes: ['Parameter'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'isStream',
        scopes: ['Parameter'],
        valueType: 'boolean',
        defaultOperator: 'equals'
    },
    {
        key: 'parameterDirection',
        scopes: ['Parameter'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'definingFeature',
        scopes: ['Slot'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'parameterType',
        scopes: ['Parameter'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'effectType',
        scopes: ['Parameter'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'isUnique',
        scopes: ['Attribute', 'Parameter'],
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
        key: 'propertyType',
        scopes: ['Attribute'],
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
        scopes: ['Attribute', 'Parameter'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'source',
        scopes: ['Relationship'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'target',
        scopes: ['Relationship'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'relationType',
        scopes: ['Relationship'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'sourceAggregation',
        scopes: ['Relationship'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'targetAggregation',
        scopes: ['Relationship'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'sourceMultiplicity',
        scopes: ['Relationship'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'targetMultiplicity',
        scopes: ['Relationship'],
        valueType: 'string',
        defaultOperator: 'equals'
    }
];
