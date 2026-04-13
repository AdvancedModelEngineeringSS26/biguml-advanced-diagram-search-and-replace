/**********************************************************************************
 * Copyright (c) 2025 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import type { ClassDiagram } from '@borkdominik-biguml/uml-model-server/grammar';
import type { SearchResult } from '../../common/searchresult.js';
import type { IMatcher } from './IMatcher.js';
import { SharedElementCollector } from './sharedcollector.js';

type SearchResultWithProperties = SearchResult & { properties?: Record<string, string> };

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

    private collectProperties(element: any): Record<string, string> {
        const properties: Record<string, string> = {};

        if (element.name !== undefined && element.name !== null) {
            properties.name = String(element.name);
        }
        if (element.visibility !== undefined && element.visibility !== null) {
            properties.visibility = String(element.visibility);
        }
        if (element.multiplicity !== undefined && element.multiplicity !== null) {
            properties.multiplicity = String(element.multiplicity);
        }
        if (element.lowerValue !== undefined || element.upperValue !== undefined) {
            const lower = element.lowerValue !== undefined ? String(element.lowerValue) : '*';
            const upper = element.upperValue !== undefined ? String(element.upperValue) : '*';
            properties.multiplicity = `${lower}..${upper}`;
        }

        const referenceType = element.propertyType?.$refText ?? element.parameterType?.$refText ?? element.$refText;
        if (referenceType) {
            properties.type = String(referenceType);
        } else if (element.type !== undefined && element.type !== null) {
            properties.type = String(element.type);
        }

        if (element.defaultValue !== undefined && element.defaultValue !== null) {
            properties.defaultValue = String(element.defaultValue);
        }

        return properties;
    }

    match(diagram: ClassDiagram): SearchResult[] {
        const results: SearchResultWithProperties[] = [];
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

            const properties = this.collectProperties(element);
            switch (type) {
                case 'Class':
                case 'AbstractClass':
                case 'Interface':
                case 'DataType':
                    results.push({ id, type, name, parentName, properties });
                    break;
                case 'Property': {
                    const typeName = element.propertyType?.$refText;
                    results.push({
                        id,
                        type,
                        name: name ?? 'Unnamed',
                        parentName,
                        details: typeName ? `${typeName} in ${parentName ?? ''}` : parentName ? `In ${parentName}` : undefined,
                        properties
                    });
                    break;
                }
                case 'Operation':
                    results.push({
                        id,
                        type,
                        name: name ?? 'Unnamed',
                        parentName,
                        details: parentName ? `In ${parentName}` : undefined,
                        properties
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
                    results.push({ id, type, name, parentName, properties });
                    break;
                case 'EnumerationLiteral':
                    results.push({
                        id,
                        type,
                        name: name ?? 'Unnamed',
                        parentName,
                        details: parentName ? `In Enumeration ${parentName}` : undefined,
                        properties
                    });
                    break;
                case 'PrimitiveType':
                case 'Package':
                    results.push({ id, type, name, parentName, properties });
                    break;
                case 'InstanceSpecification':
                    results.push({ id, type, name, parentName, properties });
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
                    results.push({ id, type, name: name ?? 'Unnamed', parentName, properties });
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
                details: `${type} from ${sourceName} to ${targetName}`,
                properties: {
                    source: sourceName,
                    target: targetName
                }
            });
        }

        return results;
    }
}
