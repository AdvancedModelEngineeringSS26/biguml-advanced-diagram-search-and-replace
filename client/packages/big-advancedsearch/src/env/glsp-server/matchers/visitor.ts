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
            type: type,
            filters: []
        };

        if (children.classSearchAttribute) {
            children.classSearchAttribute.forEach((attrCst: any) => {
                const attr = this.visit(attrCst);
                if (attr) {
                    betterCriteria.filters.push(attr);
                }
            });
        }

        return betterCriteria;
    }

    classSearchAttribute(children: any): BetterSearchFilter {
        if (children.classSearchName) return this.visit(children.classSearchName);
        if (children.classSearchIsAbstract) return this.visit(children.classSearchIsAbstract);
        if (children.classSearchIsActive) return this.visit(children.classSearchIsActive);
        return undefined as any;
    }

    classSearchName(children: any): BetterSearchFilter {
        return {
            type: 'ClassNameFilter',
            key: 'name',
            operator: 'contains',
            value: {
                type: 'string',
                value: children.className[0].image
            }
        };
        // return { name: children.className[0].image };
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
}

const astBuilder = new ModelAstBuilderVisitor();

export function buildAst(text: string): BetterSearchCriteria {
    const cst = parse(text);
    const criteria = astBuilder.visit(cst) as BetterSearchCriteria;

    return criteria;
}
