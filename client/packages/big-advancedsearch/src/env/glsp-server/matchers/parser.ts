import { CstParser } from 'chevrotain';

import {
    tokenize,
    allTokens,
    ClassKeyword,
    StringIdentifier,
    LeftSquareBracket,
    RightSquareBracket,
    NameKeyword,
    Equals,
    Comma,
    AbstractKeyword
} from './lexer.js';

export class ModelParser extends CstParser {
    constructor(options?: any) {
        super(allTokens, options);
        this.performSelfAnalysis();
    }

    public expression = this.RULE('expression', () => {
        this.SUBRULE(this.classSearch);
    });

    public classSearch = this.RULE('classSearch', () => {
        this.CONSUME(ClassKeyword);
        this.OPTION(() => {
            this.CONSUME(LeftSquareBracket);
            this.MANY_SEP({
                SEP: Comma,
                DEF: () => {
                    this.SUBRULE(this.classSearchAttribute);
                }
            });
            this.CONSUME(RightSquareBracket);
        });
    });

    // New rule to handle the different types of key-value pairs
    public classSearchAttribute = this.RULE('classSearchAttribute', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.classSearchName) }, 
            { ALT: () => this.SUBRULE(this.classSearchIsAbstract) }]
        );
    });

    public classSearchName = this.RULE('classSearchName', () => {
        this.CONSUME(NameKeyword);
        this.CONSUME(Equals);
        this.CONSUME(StringIdentifier, { LABEL: 'className' });
    });

    public classSearchIsAbstract = this.RULE('classSearchIsAbstract', () => {
        this.CONSUME(AbstractKeyword);
        this.CONSUME(Equals);
        this.CONSUME(StringIdentifier, { LABEL: 'abstractValue' });
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
