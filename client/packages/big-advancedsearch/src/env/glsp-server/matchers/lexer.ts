import { createToken, Lexer } from 'chevrotain';

export const StringIdentifier = createToken({ name: 'Identifier', pattern: /[a-zA-Z]\w*/ });

export const IntegerLiteral = createToken({
    name: 'IntegerLiteral',
    pattern: /\d+/
});

export const Colon = createToken({
    name: 'Colon',
    pattern: /:/
});

export const WhiteSpace = createToken({
    name: 'WhiteSpace',
    pattern: /\s+/,
    line_breaks: true,
    group: Lexer.SKIPPED
});

export const ClassKeyword = createToken({
    name: 'ClassKeyword',
    pattern: /Class/i,
    longer_alt: StringIdentifier
});

export const LeftSquareBracket = createToken({
    name: 'LeftSquareBracket',
    pattern: /\[/
});

export const RightSquareBracket = createToken({
    name: 'RightSquareBracket',
    pattern: /\]/
});

export const Equals = createToken({
    name: 'Equals',
    pattern: /=/
});

export const NameKeyword = createToken({
    name: 'NameKeyword',
    pattern: /Name/i,
    longer_alt: StringIdentifier
});

// note we are placing WhiteSpace first as it is very common thus it will speed up the lexer.
export const allTokens = [
    WhiteSpace,

    // "keywords" appear before the Identifier
    ClassKeyword,
    NameKeyword,
    Equals,
    Colon,
    LeftSquareBracket,
    RightSquareBracket,

    // The Identifier must appear after the keywords because all keywords are valid identifiers.
    StringIdentifier,
    IntegerLiteral
];

export const ModelLexer = new Lexer(allTokens);

export function tokenize(text: string) {
    const result = ModelLexer.tokenize(text);

    if (result.errors.length > 0) {
        const msg = result.errors.map(error => `[${error.line}:${error.column}] ${error.message}`).join(', ');
        throw new Error(`Error tokenizing the text. ${msg}`);
    }

    return result.tokens;
}
