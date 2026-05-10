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
    AbstractKeyword,
    ActiveKeyword,
    Similar,
    GreaterThan,
    AttributeKeyword,
    MethodKeyword,
    DerivedKeyword,
    StaticKeyword
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

        this.OPTION2(() => {
            this.CONSUME(GreaterThan);
            this.CONSUME(AttributeKeyword);

            this.CONSUME2(LeftSquareBracket);

            this.MANY_SEP2({
                SEP: Comma,
                DEF: () => {
                    this.SUBRULE(this.attributeSearchAttribute);
                }
            });

            this.CONSUME2(RightSquareBracket);
        });

        this.OPTION3(() => {
            this.CONSUME2(GreaterThan);
            this.CONSUME(MethodKeyword);

            this.CONSUME3(LeftSquareBracket);

            this.MANY_SEP3({
                SEP: Comma,
                DEF: () => {
                    this.SUBRULE(this.methodSearchAttribute);
                }
            });

            this.CONSUME3(RightSquareBracket);
        });
    });

    // New rule to handle the different types of key-value pairs
    public classSearchAttribute = this.RULE('classSearchAttribute', () => {
        this.OR([
            { ALT: () => this.SUBRULE(this.classSearchName) },
            { ALT: () => this.SUBRULE(this.classSearchNameSimilar) },
            { ALT: () => this.SUBRULE(this.classSearchIsAbstract) },
            { ALT: () => this.SUBRULE(this.classSearchIsActive) }
        ]);
    });

    public methodSearchAttribute = this.RULE('methodSearchAttribute', () => {
        this.OR([{ ALT: () => this.SUBRULE(this.methodSearchIsStatic) }]);
    });

    public attributeSearchAttribute = this.RULE('attributeSearchAttribute', () => {
        this.OR([{ ALT: () => this.SUBRULE(this.attributeSearchIsDerived) }]);
    });

    public attributeSearchIsDerived = this.RULE('attributeSearchIsDerived', () => {
        this.CONSUME(DerivedKeyword);
        this.CONSUME(Equals);
        this.CONSUME(StringIdentifier, { LABEL: 'derivedValue' });
    });

    public classSearchName = this.RULE('classSearchName', () => {
        this.CONSUME(NameKeyword);
        this.CONSUME(Equals);
        this.CONSUME(StringIdentifier, { LABEL: 'className' });
    });

    public classSearchNameSimilar = this.RULE('classSearchNameSimilar', () => {
        this.CONSUME(NameKeyword);
        this.CONSUME(Similar);
        this.CONSUME(StringIdentifier, { LABEL: 'className' });
    });

    public classSearchIsAbstract = this.RULE('classSearchIsAbstract', () => {
        this.CONSUME(AbstractKeyword);
        this.CONSUME(Equals);
        this.CONSUME(StringIdentifier, { LABEL: 'abstractValue' });
    });

    public classSearchIsActive = this.RULE('classSearchIsActive', () => {
        this.CONSUME(ActiveKeyword);
        this.CONSUME(Equals);
        this.CONSUME(StringIdentifier, { LABEL: 'activeValue' });
    });

    public methodSearchIsStatic = this.RULE('methodSearchIsStatic', () => {
        this.CONSUME(StaticKeyword);
        this.CONSUME(Equals);
        this.CONSUME(StringIdentifier, { LABEL: 'staticValue' });
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
