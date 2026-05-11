// search-schema.ts

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
        scopes: ['Class', 'Attribute', 'Method', 'Relationship'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'visibility',
        scopes: ['Class', 'Attribute', 'Method'],
        valueType: 'string',
        defaultOperator: 'equals'
    },
    {
        key: 'isAbstract',
        scopes: ['Class'],
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
    }
];

export function findFilterSpec(scope: SearchElementType, key: string): SearchFilterSpec | undefined {
    const normalizedKey = key.toLowerCase();

    return FILTER_SPECS.find(spec => {
        const names = [spec.key, ...(spec.aliases ?? [])].map(value => value.toLowerCase());
        return spec.scopes.includes(scope) && names.includes(normalizedKey);
    });
}
