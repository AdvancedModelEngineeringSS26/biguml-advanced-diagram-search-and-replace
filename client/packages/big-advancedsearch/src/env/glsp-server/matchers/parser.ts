import { CstParser } from 'chevrotain';

import {
    tokenize,
    allTokens,
    ClassKeyword,
    Colon,
    StringIdentifier,
    LeftSquareBracket,
    RightSquareBracket,
    NameKeyword,
    Equals
} from './lexer.js';

export class ModelParser extends CstParser {
    constructor(options?: any) {
        super(allTokens, options);
        this.performSelfAnalysis();
    }

    public expression = this.RULE('expression', () => {
        this.SUBRULE(this.classRule);
    });

    public classRule = this.RULE('classRule', () => {
        this.CONSUME(ClassKeyword);
        this.OPTION(() => {
            this.CONSUME(LeftSquareBracket);
            this.CONSUME(NameKeyword);
            this.CONSUME(Equals);
            this.CONSUME(StringIdentifier, { LABEL: 'className' });
            this.CONSUME(RightSquareBracket);
        });
    });
}

export const parser: ModelParser = new ModelParser();
export function parse(text: string) {
    // "input" is a setter which will reset the parser's state.
    parser.input = tokenize(text);
    const cst = parser.expression();

    if (parser.errors.length > 0) {
        const msg = parser.errors.map(error => `[${error.name}] ${error.message}`).join(', ');
        throw new Error(msg);
    }

    return cst;
}
