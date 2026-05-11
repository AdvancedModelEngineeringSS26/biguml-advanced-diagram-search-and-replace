/**********************************************************************************
 * Copyright (c) 2026 borkdominik and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { parse, parser } from './parser.js';

const BaseCstVisitor = parser.getBaseCstVisitorConstructor();

export interface BetterSearchCriteria {
    type: string; // will be Class or Relationship
    combinator?: 'AND' | 'OR';
    left?: BetterSearchCriteria;
    right?: BetterSearchCriteria;
    filters: BetterSearchFilter[];

    propertyFilters?: BetterSearchFilter[];
    operationFilters?: BetterSearchFilter[];
}

export interface BetterSearchFilter {
    type: string; 
    key: string;
    operator: string;
    value: {
        type: string;
        value: string;
    }
}

class ModelAstBuilderVisitor extends BaseCstVisitor {
    constructor() {
        super();
        this.validateVisitor();
    }

    expression(children: any): BetterSearchCriteria {
        return this.visit(children.classSearch);
    }

    classSearch(children: any): BetterSearchCriteria {
        const type = children.ClassKeyword?.[0]?.image ?? 'Class';

        const betterCriteria: BetterSearchCriteria = {
            type,
            filters: [],
            propertyFilters: [],
            operationFilters: []
        };

        if (children.classSearchAttribute) {
            children.classSearchAttribute.forEach((attrCst: any) => {
                const attr = this.visit(attrCst);
                if (attr) {
                    betterCriteria.filters.push(attr);
                }
            });
        }

        if (children.attributeSearchAttribute) {
            children.attributeSearchAttribute.forEach((attrCst: any) => {
                const attr = this.visit(attrCst);
                if (attr) {
                    betterCriteria.propertyFilters!.push(attr);
                }
            });
        }

        if (children.methodSearchAttribute) {
            children.methodSearchAttribute.forEach((attrCst: any) => {
                const attr = this.visit(attrCst);
                if (attr) {
                    betterCriteria.operationFilters!.push(attr);
                }
            });
        }

        return betterCriteria;
    }

    attributeSearchAttribute(children: any): BetterSearchFilter {
        if (children.attributeSearchIsDerived) return this.visit(children.attributeSearchIsDerived);
        if (children.attributeSearchAggregation) return this.visit(children.attributeSearchAggregation);
        if (children.attributeSearchVisibility) return this.visit(children.attributeSearchVisibility);
        if (children.attributeSearchIsDerivedUnion) return this.visit(children.attributeSearchIsDerivedUnion);
        if (children.attributeSearchIsReadOnly) return this.visit(children.attributeSearchIsReadOnly);
        if (children.attributeSearchIsOrdered) return this.visit(children.attributeSearchIsOrdered);
        if (children.attributeSearchIsUnique) return this.visit(children.attributeSearchIsUnique);
        if (children.attributeSearchIsStatic) return this.visit(children.attributeSearchIsStatic);
        return undefined as any;
    }

    attributeSearchIsDerived(children: any): BetterSearchFilter {
        const val = children.derivedValue[0].image.toLowerCase();

        return {
            type: 'IsDerivedFilter',
            key: 'isDerived',
            operator: 'equals',
            value: {
                type: 'boolean',
                value: val
            }
        };
    }

    attributeSearchIsDerivedUnion(children: any): BetterSearchFilter {
        const val = children.derivedUnionValue[0].image.toLowerCase();

        return {
            type: 'IsDerivedUnionFilter',
            key: 'isDerivedUnion',
            operator: 'equals',
            value: {
                type: 'boolean',
                value: val
            }
        };
    }

    attributeSearchAggregation(children: any): BetterSearchFilter {
        return {
            type: 'AggregationFilter',
            key: 'aggregation',
            operator: 'equals',
            value: {
                type: 'string',
                value: children.aggregationValue[0].image.toLowerCase()
            }
        };
    }

    attributeSearchVisibility(children: any): BetterSearchFilter {
        return {
            type: 'VisibilityFilter',
            key: 'visibility',
            operator: 'equals',
            value: {
                type: 'string',
                value: children.visibilityValue[0].image.toLowerCase()
            }
        };
    }

    attributeSearchIsReadOnly(children: any): BetterSearchFilter {
        const val = children.readOnlyValue[0].image.toLowerCase();
        return {
            type: 'IsReadOnlyFilter',
            key: 'isReadOnly',
            operator: 'equals',
            value: {
                type: 'boolean',
                value: val
            }
        };
    }

    attributeSearchIsOrdered(children: any): BetterSearchFilter {
        const val = children.orderedValue[0].image.toLowerCase();
        return {
            type: 'IsOrderedFilter',
            key: 'isOrdered',
            operator: 'equals',
            value: {
                type: 'boolean',
                value: val
            }
        };
    }

    attributeSearchIsUnique(children: any): BetterSearchFilter {
        const val = children.uniqueValue[0].image.toLowerCase();
        return {
            type: 'IsUniqueFilter',
            key: 'isUnique',
            operator: 'equals',
            value: {
                type: 'boolean',
                value: val
            }
        };
    }

    attributeSearchIsStatic(children: any): BetterSearchFilter {
        const val = children.isStaticValue[0].image.toLowerCase();
        return {
            type: 'IsStaticFilter',
            key: 'isStatic',
            operator: 'equals',
            value: {
                type: 'boolean',
                value: val
            }
        };
    }

    methodSearchAttribute(children: any): BetterSearchFilter {
        if (children.methodSearchIsStatic) return this.visit(children.methodSearchIsStatic);
        return undefined as any;
    }

    methodSearchIsStatic(children: any): BetterSearchFilter {
        const val = children.staticValue[0].image.toLowerCase();

        return {
            type: 'IsStaticFilter',
            key: 'isStatic',
            operator: 'equals',
            value: {
                type: 'boolean',
                value: val
            }
        };
    }

    classSearchAttribute(children: any): BetterSearchFilter {
        if (children.classSearchNameSimilar) return this.visit(children.classSearchNameSimilar);
        if (children.classSearchName) return this.visit(children.classSearchName);
        if (children.classSearchIsAbstract) return this.visit(children.classSearchIsAbstract);
        if (children.classSearchIsActive) return this.visit(children.classSearchIsActive);
        if (children.classSearchVisibility) return this.visit(children.classSearchVisibility);
        return undefined as any;
    }

    classSearchName(children: any): BetterSearchFilter {
        return {
            type: 'ClassNameFilter',
            key: 'name',
            operator: 'equals',
            value: {
                type: 'string',
                value: children.className[0].image
            }
        };
    }

    classSearchNameSimilar(children: any): BetterSearchFilter {
        return {
            type: 'ClassNameSimilarFilter',
            key: 'name',
            operator: 'contains',
            value: {
                type: 'string',
                value: children.className[0].image
            }
        };
    }

    classSearchIsAbstract(children: any): BetterSearchFilter {
        const val = children.abstractValue[0].image.toLowerCase();
        return {
            type: 'IsAbstractFilter',
            key: 'isAbstract',
            operator: 'equals',
            value: {
                type: 'boolean',
                value: val
            }
        };
    }

    classSearchIsActive(children: any): BetterSearchFilter {
        const val = children.activeValue[0].image.toLowerCase();
        return {
            type: 'IsActiveFilter',
            key: 'isActive',
            operator: 'equals',
            value: {
                type: 'boolean',
                value: val
            }
        };
    }

    classSearchVisibility(children: any): BetterSearchFilter {
        const val = children.visibilityValue[0].image.toLowerCase();
        return {
            type: 'VisibilityFilter',
            key: 'visibility',
            operator: 'equals',
            value: {
                type: 'string',
                value: val
            }
        };
    }
}

const astBuilder = new ModelAstBuilderVisitor();

export function buildAst(text: string): BetterSearchCriteria {
    const cst = parse(text);
    const criteria = astBuilder.visit(cst) as BetterSearchCriteria;

    return criteria;
}
