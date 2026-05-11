// search-ast.ts

export type SearchElementType = 'Class' | 'Attribute' | 'Method' | 'Relationship';

export type SearchOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';

export type SearchValue = { type: 'string'; value: string } | { type: 'boolean'; value: boolean } | { type: 'number'; value: number };

export interface SearchFilter {
    key: string;
    operator: SearchOperator;
    value: SearchValue;
}

export interface SearchCriteria {
    type: SearchElementType;
    filters: SearchFilter[];
    children: SearchCriteria[];
}
