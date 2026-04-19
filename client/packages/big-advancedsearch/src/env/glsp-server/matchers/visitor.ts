import { parse, parser } from './parser.js';

// 1. Get the base constructor from the existing parser instance
const BaseCstVisitor = parser.getBaseCstVisitorConstructor();

class ModelAstBuilderVisitor extends BaseCstVisitor {
    constructor() {
        super();
        // This connects the visitor methods to the rule names
        this.validateVisitor();
    }

    // The name of the method must match the name of the RULE
    expression(children: any) {
        // Navigate down to the classRule
        return this.visit(children.classRule);
    }

    classRule(children: any) {
        // "className" is the label we used in the parser:
        // this.CONSUME(StringIdentifier, { LABEL: "className" });

        if (children.className) {
            // Tokens are wrapped in an array. We take the first one and get its image (the text).
            return children.className[0].image;
        }

        return 'UnnamedClass';
    }
}

const astBuilder = new ModelAstBuilderVisitor();

export function buildAst(text: string) {
    const cst = parse(text);
    // The visit method starts the traversal
    const classNode = astBuilder.visit(cst);
    return classNode;
}
