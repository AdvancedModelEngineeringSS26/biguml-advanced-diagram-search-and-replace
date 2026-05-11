// matcher-utils.ts

import type { SearchCriteria, SearchFilter, SearchValue } from './search-ast.js';

export function matchesCriteriaOnElement(element: any, criteria: SearchCriteria): boolean {
    if (!element) {
        return false;
    }

    if (!matchesElementType(element, criteria.type)) {
        return false;
    }

    if (!criteria.filters.every(filter => matchesFilter(element, filter))) {
        return false;
    }

    return criteria.children.every(childCriteria => {
        const children = getChildrenForCriteria(element, childCriteria);

        return children.some(child => matchesCriteriaOnElement(child, childCriteria));
    });
}

function matchesElementType(element: any, expectedType: string): boolean {
    const actual = String(element.$type ?? '').toLowerCase();
    const expected = expectedType.toLowerCase();

    if (expected === 'class') {
        return actual === 'class' || actual === 'abstractclass';
    }

    if (expected === 'relationship' || expected === 'relation') {
        return isRelationshipType(actual);
    }

    if (expected === 'attribute') {
        return actual === 'property';
    }

    if (expected === 'method') {
        return actual === 'operation';
    }

    return actual === expected;
}

function getChildrenForCriteria(element: any, childCriteria: SearchCriteria): any[] {
    switch (childCriteria.type) {
        case 'Attribute':
            return Array.isArray(element.properties) ? element.properties : [];

        case 'Method':
            return Array.isArray(element.operations) ? element.operations : [];

        default:
            return [];
    }
}

function matchesFilter(element: any, filter: SearchFilter): boolean {
    const actual = element[filter.key];
    const expected = filter.value.value;

    switch (filter.operator) {
        case 'equals':
            return normalize(actual) === normalize(expected);

        case 'contains':
            return actual !== undefined && actual !== null && String(actual).toLowerCase().includes(String(expected).toLowerCase());

        case 'startsWith':
            return actual !== undefined && actual !== null && String(actual).toLowerCase().startsWith(String(expected).toLowerCase());

        case 'endsWith':
            return actual !== undefined && actual !== null && String(actual).toLowerCase().endsWith(String(expected).toLowerCase());

        case 'greaterThan':
            return Number(actual) > Number(expected);

        case 'lessThan':
            return Number(actual) < Number(expected);

        default:
            return false;
    }
}

function normalize(value: unknown): string {
    return String(value).toLowerCase();
}

function isRelationshipType(type: string): boolean {
    return [
        'association',
        'aggregation',
        'composition',
        'generalization',
        'dependency',
        'abstraction',
        'usage',
        'realization',
        'interfacerealization',
        'substitution',
        'packageimport',
        'packagemerge'
    ].includes(type);
}
