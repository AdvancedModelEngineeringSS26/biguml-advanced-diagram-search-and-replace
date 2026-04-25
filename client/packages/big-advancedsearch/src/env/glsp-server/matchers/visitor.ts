import { parse, parser } from './parser.js';

const BaseCstVisitor = parser.getBaseCstVisitorConstructor();

// Define a structure for our search criteria
export interface SearchCriteria {
    type: 'Class';
    name?: string;
    isAbstract?: boolean;
}

class ModelAstBuilderVisitor extends BaseCstVisitor {
    constructor() {
        super();
        this.validateVisitor();
    }

    expression(children: any): SearchCriteria {
        return this.visit(children.classSearch);
    }

    classSearch(children: any): SearchCriteria {
        const criteria: SearchCriteria = { type: 'Class' };

        if (children.classSearchAttribute) {
            children.classSearchAttribute.forEach((attrCst: any) => {
                const attr = this.visit(attrCst);
                Object.assign(criteria, attr);
            });
        }

        return criteria;
    }

    classSearchAttribute(children: any) {
        if (children.classSearchName) return this.visit(children.classSearchName);
        if (children.classSearchIsAbstract) return this.visit(children.classSearchIsAbstract);
    }

    classSearchName(children: any) {
        return { name: children.className[0].image };
    }

    classSearchIsAbstract(children: any) {
        const val = children.abstractValue[0].image.toLowerCase();
        return { isAbstract: val === 'true' };
    }
}

const astBuilder = new ModelAstBuilderVisitor();

export function buildAst(text: string): SearchCriteria {
    const cst = parse(text);
    return astBuilder.visit(cst);
}
