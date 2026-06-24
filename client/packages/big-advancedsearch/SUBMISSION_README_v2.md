# Advanced Search with Improved Search Grammar and Replace Functionality

- Course: Advanced Model Engineering (SS 2027)
- Team Members: Crnkoci Lukas,Gahleitner Michael, Arslan Smajevic, Marko Vranjes, Abdyrakhmanova Aiana, Sultonmurodova Zebiniso
- University: TU Wien
- Submission Date: June 26, 2026

## 1. Introduction

This report presents the implementation of the Advanced Search with Pattern Matching feature developed for the bigUML project in Visual Studio Code. The purpose of this document is to explain the motivation behind the feature, outline the design decisions and implementation strategy, highlight key challenges, and discuss ideas for future improvements.

# ADD NEW DEMO HERE

<!-- DEMO -->
<p align="center">
  <img src="./media/advanced-search.gif" width="1080px" alt="Demo" />
</p>

## 2. Motivation and Purpose

The motivation and main objective of this project was to work on the search and replace feature inside the BigUML extension. We were to expand the existing search capabilites as well as add some better UI elements that should guide the user towards easier searching. On top of that, a new way of replacing speciffic parameters was also introduced.

## 3. Functionality Overview

Feature 1: SVG preview of searched elements

Feature 2: New search grammar for all elements in diagram

Feature 3: Replace mechanism combined with search

## 4. Features details

### Feature 2

Feature 2 introduces a typed search grammar that is parsed and evaluated on the backend. The implementation spans the browser webview, VS Code bridge, GLSP server action handler, a Chevrotain-based parser pipeline, and matcher-based evaluation on the UML model AST.

#### End-to-end workflow (query to evaluated results)

1. User enters a query in the Advanced Search webview (for example `Class[name~"User"]>Method[isQuery=true]`).
2. The browser component dispatches `RequestAdvancedSearchAction` with the raw query string:
    - `packages/big-advancedsearch/src/env/browser/advancedsearch.component.tsx`
    - `packages/big-advancedsearch/src/env/common/advancedsearch.action.ts`
3. The VS Code webview provider forwards and caches actions, then sends responses back to the webview:
    - `packages/big-advancedsearch/src/env/vscode/advancedsearch.webview-view-provider.ts`
4. The GLSP server receives the action in `AdvancedSearchActionHandler.handleSearch(...)`:
    - `packages/big-advancedsearch/src/env/glsp-server/advancedsearch.handler.ts`
5. For non-empty queries, the handler calls `buildAst(rawQuery)` to parse and validate the query.
6. The parsed criteria tree is passed to `ClassDiagramMatcher.matchAdvanced(...)`.
7. The matcher evaluates criteria recursively against the diagram model and returns matching `SearchResult[]`.
8. The handler returns `AdvancedSearchActionResponse` with the result list to the UI.

#### Where Chevrotain is used

The parser stack is implemented with Chevrotain in three layers:

- Lexer (`createToken`, `Lexer`):
    - `packages/big-advancedsearch/src/env/glsp-server/matchers/lexer.ts`
    - Defines tokens for element keywords (`Class`, `Method`, `Relationship`, ...), operators (`=`, `~`), brackets, comma, `>`, booleans, numbers, and strings.
- CST Parser (`CstParser`):
    - `packages/big-advancedsearch/src/env/glsp-server/matchers/parser.ts`
    - Grammar rules: `expression -> searchElement`, optional filter list, and child chaining via `>`.
- CST Visitor to AST:
    - `packages/big-advancedsearch/src/env/glsp-server/matchers/visitor.ts`
    - Converts parser CST into a typed `SearchCriteria` AST and validates filter semantics.

If tokenization or parsing fails, an exception is thrown and the action handler returns an empty result set.

When adding a new element, like for example say you were to add an element to be recognized as "SassyClass" - then you would have to add it here as an element. But beware of overlapping keywords, as his can be sometimes bad for chevrotain. https://chevrotain.io/docs/
#### Where the scope definitions live

Search filter scope and type definitions are centralized in:

- `packages/big-advancedsearch/src/env/common/search-filter-spec.ts`

`FILTER_SPECS` defines, for each filter key:

- `scopes`: which element types may use the filter (for example `name` on many scopes, `isQuery` only on `Method`, `source/target` on `Relationship`)
- `valueType`: expected value type (`string`, `boolean`, `number`)
- optional aliases/default operator

Resolution and validation helper:

- `packages/big-advancedsearch/src/env/glsp-server/matchers/search-schema.ts`
    - `findFilterSpec(scope, key)` maps a filter key to a valid spec for the current scope.

The AST visitor enforces these constraints in `validateFilters(...)`.

If you would like to add for example, `isAbstract` should searchable in `Relationship` as well - then add the `Relationship` to the `isAbstract` scope.

#### How the query AST looks

The typed AST model is defined in:

- `packages/big-advancedsearch/src/env/glsp-server/matchers/search-ast.ts`

Core shape:

- `SearchCriteria`
    - `type: SearchElementType`
    - `filters: SearchFilter[]`
    - `children: SearchCriteria[]`
- `SearchFilter`
    - `key`, `operator`, `value`
- `SearchValue`
    - one of `string | boolean | number | criteria`

Example AST for `Class[name~User]>Method[isQuery=true]`:

```json
{
    "type": "Class",
    "filters": [
        {
            "key": "name",
            "operator": "contains",
            "value": { "type": "string", "value": "User" }
        }
    ],
    "children": [
        {
            "type": "Method",
            "filters": [
                {
                    "key": "isQuery",
                    "operator": "equals",
                    "value": { "type": "boolean", "value": true }
                }
            ],
            "children": []
        }
    ]
}
```

#### How evaluation works on the model AST

The backend evaluates the search AST against the UML diagram AST (semantic model) in these stages:

1. Build candidate results and element index:
    - `ClassDiagramMatcher.match(...)` and `buildDiagramIndex(...)` in
      `packages/big-advancedsearch/src/env/glsp-server/matchers/classmatcher.ts`
2. Traverse semantic diagram nodes recursively using:
    - `packages/big-advancedsearch/src/env/glsp-server/matchers/sharedcollector.ts`
    - This walks nested Langium AST arrays (`entities`, `relations`, `properties`, `operations`, `parameters`, `values`, `slots`).
3. Evaluate each candidate with recursive predicate matching:
    - `matchesCriteriaOnElement(...)` in
      `packages/big-advancedsearch/src/env/glsp-server/matchers/matcher-utils.ts`
4. Evaluation checks:
    - element type compatibility (`Class` also matches `AbstractClass`, `Method` maps to `Operation`, `Attribute` maps to `Property`, `Relationship` covers all relation subtypes)
    - all filters on current node (`equals` and `contains` are actively produced by parser)
    - child criteria (`>` operator) by descending into structural children (`properties`, `operations`, `parameters`, etc.)
    - nested criteria values on relation endpoints (`source` / `target`) using the diagram index

In short: Feature 2 compiles user query text into a validated criteria AST (Chevrotain lexer + parser + visitor), then recursively evaluates that AST against the semantic UML model tree.

## 8. Open Issues

## 9. Future Improvements

## 10. Feedback about the course
