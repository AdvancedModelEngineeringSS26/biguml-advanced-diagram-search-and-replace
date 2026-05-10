/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { ClassDiagram, ClassDiagramEdges, ClassDiagramNodes } from '@borkdominik-biguml/uml-model-server/grammar';
import type { SearchResult } from '../../common/searchresult.js';
import type { IMatcher } from './IMatcher.js';
import { SharedElementCollector } from './sharedcollector.js';
import type { BetterSearchCriteria, BetterSearchFilter } from './visitor.js';

export class ClassDiagramMatcher implements IMatcher {
    private readonly supportedTypes = [
        'class',
        'abstractclass',
        'interface',
        'enumeration',
        'enumerationliteral',
        'primitivetype',
        'datatype',
        'package',
        'instancespecification',
        'slot',
        'literalspecification',
        'property',
        'operation',
        'parameter',
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
    ];

    supports(type: string): boolean {
        return this.supportedTypes.includes(type.toLowerCase());
    }

    supportsPartial(partialType: string): boolean {
        return this.supportedTypes.some(t => t.startsWith(partialType.toLowerCase()));
    }

    supportsList(): string[] {
        return this.supportedTypes;
    }

    match(diagram: ClassDiagram): SearchResult[] {
        const results: SearchResult[] = [];
        const idToName = new Map<string, string>();

        // First pass: collect all names for cross-reference resolution
        SharedElementCollector.collectRecursively(diagram as any, element => {
            if (element.__id && element.$type) {
                idToName.set(element.__id, element.name ?? `<<${element.$type}>>`);
            }
        });

        // Second pass: build search results from entities
        SharedElementCollector.collectRecursively(diagram as any, (element, parentName) => {
            const type = element.$type;
            if (!type || !element.__id) return;

            const name = element.name ?? `<<${type}>>`;
            const id = element.__id;

            switch (type) {
                case 'Class':
                case 'AbstractClass':
                case 'Interface':
                case 'DataType':
                    results.push({ id, type, name, parentName });
                    break;
                case 'Property': {
                    const typeName = element.propertyType?.$refText;
                    results.push({
                        id,
                        type,
                        name: name ?? 'Unnamed',
                        parentName,
                        details: typeName ? `${typeName} in ${parentName ?? ''}` : parentName ? `In ${parentName}` : undefined
                    });
                    break;
                }
                case 'Operation':
                    results.push({
                        id,
                        type,
                        name: name ?? 'Unnamed',
                        parentName,
                        details: parentName ? `In ${parentName}` : undefined
                    });
                    break;
                case 'Parameter': {
                    const paramTypeName = element.parameterType?.$refText;
                    results.push({
                        id,
                        type,
                        name: name ?? 'Unnamed',
                        parentName,
                        details: paramTypeName ? `${paramTypeName} in ${parentName ?? ''}` : parentName ? `In ${parentName}` : undefined
                    });
                    break;
                }
                case 'Enumeration':
                    results.push({ id, type, name, parentName });
                    break;
                case 'EnumerationLiteral':
                    results.push({
                        id,
                        type,
                        name: name ?? 'Unnamed',
                        parentName,
                        details: parentName ? `In Enumeration ${parentName}` : undefined
                    });
                    break;
                case 'PrimitiveType':
                case 'Package':
                    results.push({ id, type, name, parentName });
                    break;
                case 'InstanceSpecification':
                    results.push({ id, type, name, parentName });
                    break;
                case 'Slot': {
                    const featureName = element.definingFeature?.$refText;
                    results.push({
                        id,
                        type,
                        name: name ?? 'Unnamed',
                        parentName,
                        details: featureName ? `Feature: ${featureName}` : undefined
                    });
                    break;
                }
                case 'LiteralSpecification':
                    results.push({ id, type, name: name ?? 'Unnamed', parentName });
                    break;
            }
        });

        // Collect relations
        for (const relation of diagram.relations ?? []) {
            const type = relation.$type;
            if (!type) continue;

            const sourceId = relation.source?.ref?.__id;
            const targetId = relation.target?.ref?.__id;
            const sourceName = relation.source?.$refText ?? idToName.get(sourceId!) ?? '(unknown)';
            const targetName = relation.target?.$refText ?? idToName.get(targetId!) ?? '(unknown)';

            let name: string | undefined = undefined;
            if ('name' in relation) {
                name = `${relation.name}: ${sourceName} → ${targetName}`;
            }

            const relationName = name ?? `${sourceName} → ${targetName}`;

            results.push({
                id: relation.__id,
                type,
                name: relationName,
                details: `${type} from ${sourceName} to ${targetName}`
            });
        }

        return results;
    }

    matchAdvanced(diagram: ClassDiagram, criteria: BetterSearchCriteria): SearchResult[] {
        const candidates = this.match(diagram);
        const diagramIndex = this.buildDiagramIndex(diagram);

        return candidates.filter(candidate => this.matchesCriteria(candidate, criteria, diagramIndex));
    }

    private matchesCriteria(
        candidate: SearchResult,
        criteria: BetterSearchCriteria,
        diagramIndex: Map<string, ClassDiagramNodes | ClassDiagramEdges>
    ): boolean {
        const element = diagramIndex.get(candidate.id);

        const ownMatch = this.matchesType(candidate, criteria.type) && this.matchesFiltersOnElement(element, criteria.filters ?? []);

        const propertyMatch = this.matchesNestedFilters(element, 'properties', criteria.propertyFilters ?? []);

        const operationMatch = this.matchesNestedFilters(element, 'operations', criteria.operationFilters ?? []);

        const selfMatch = ownMatch && propertyMatch && operationMatch;

        if (!criteria.left && !criteria.right) {
            return selfMatch;
        }

        const leftMatch = criteria.left ? this.matchesCriteria(candidate, criteria.left, diagramIndex) : true;

        const rightMatch = criteria.right ? this.matchesCriteria(candidate, criteria.right, diagramIndex) : true;

        const combinator = criteria.combinator ?? 'AND';
        const childrenMatch = combinator === 'OR' ? leftMatch || rightMatch : leftMatch && rightMatch;

        return selfMatch && childrenMatch;
    }

    private matchesFiltersOnElement(element: unknown, filters: BetterSearchFilter[]): boolean {
        if (!element) return false;

        return filters.every(filter => this.matchesFilterOnElement(element, filter));
    }

    private matchesNestedFilters(element: unknown, collectionKey: 'properties' | 'operations', filters: BetterSearchFilter[]): boolean {
        if (filters.length === 0) {
            return true;
        }

        if (!element) {
            return false;
        }

        const collection = (element as any)[collectionKey];

        if (!Array.isArray(collection)) {
            return false;
        }

        // Important: all filters must match the SAME nested element.
        return collection.some(child => filters.every(filter => this.matchesFilterOnElement(child, filter)));
    }

    private matchesFilterOnElement(element: unknown, filter: BetterSearchFilter): boolean {
        const actual = (element as any)?.[filter.key];
        const expected = this.normalizeExpectedValue(filter);

        switch (filter.operator) {
            case 'contains':
                if (actual === undefined || actual === null) return false;
                return String(actual).toLowerCase().includes(String(expected).toLowerCase());

            case 'equals':
                return String(actual).toLowerCase() === String(expected).toLowerCase();

            case 'startsWith':
                if (actual === undefined || actual === null) return false;
                return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());

            case 'endsWith':
                if (actual === undefined || actual === null) return false;
                return String(actual).toLowerCase().endsWith(String(expected).toLowerCase());

            default:
                return false;
        }
    }

    private normalizeExpectedValue(filter: BetterSearchFilter): string | boolean {
        if (filter.value.type === 'boolean') {
            return filter.value.value.toLowerCase() === 'true';
        }

        return filter.value.value;
    }

    private matchesFilters(
        candidate: SearchResult,
        filters: BetterSearchFilter[],
        diagramIndex: Map<string, ClassDiagramNodes | ClassDiagramEdges>
    ): boolean {
        return filters.every(filter => this.matchesFilter(candidate, filter, diagramIndex));
    }

    private matchesFilter(
        candidate: SearchResult,
        filter: BetterSearchFilter,
        diagramIndex: Map<string, ClassDiagramNodes | ClassDiagramEdges>
    ): boolean {
        const actual = this.getSearchResultValue(candidate, filter.key, diagramIndex);
        const expected = filter.value.value;

        switch (filter.operator) {
            case 'contains':
                if (actual === undefined || actual === null) return false;

                return String(actual).toLowerCase().includes(String(expected).toLowerCase());
            // filter.key = 'name' and this is on purpose
            // actual has a property 'name' which is the name of the element, but the filter value is directly on the filter.value.value property, so we need to compare actual.name with expected

            case 'equals':
                if (typeof expected === 'boolean') {
                    return actual === expected;
                }

                return String(actual).toLowerCase() === String(expected).toLowerCase();

            case 'startsWith':
                if (actual === undefined || actual === null) return false;

                return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());

            case 'endsWith':
                if (actual === undefined || actual === null) return false;

                return String(actual).toLowerCase().endsWith(String(expected).toLowerCase());

            default:
                return false;
        }
    }

    private getSearchResultValue(
        candidate: SearchResult,
        key: string,
        diagramIndex: Map<string, ClassDiagramNodes | ClassDiagramEdges>
    ): any {
        const element = diagramIndex.get(candidate.id);
        return element ? (element as any)[key] : undefined;
    }

    private buildDiagramIndex(diagram: ClassDiagram): Map<string, ClassDiagramNodes | ClassDiagramEdges> {
        const diagramIndex = new Map<string, ClassDiagramNodes | ClassDiagramEdges>();
        SharedElementCollector.collectRecursively(diagram as any, element => {
            if (element?.__id) {
                diagramIndex.set(element.__id, element);
            }
        });

        return diagramIndex;
    }

    private matchesType(candidate: SearchResult, criteriaType: string): boolean {
        const actual = candidate.type.toLowerCase();
        const expected = criteriaType.toLowerCase();

        if (expected === 'class') {
            return actual === 'class' || actual === 'abstractclass';
        }

        if (expected === 'relationship' || expected === 'relation') {
            return this.isRelationshipType(actual);
        }

        return actual === expected;
    }

    private isRelationshipType(type: string): boolean {
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
}
