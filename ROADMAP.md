
***

# bigUML Advanced Search & Replace: Team Organization & Task Breakdown

## Overview
Taking on a 6-person group project on a highly decoupled architecture (React, VSCode Extension Host, Node.js GLSP Server, Langium) requires strict organization. To prevent merge conflicts and knowledge silos, we are utilizing a **"Three Pairs" Strategy**. Each pair will take shared ownership of a specific technical domain.

---

## 1. Work Distribution: The "Three Pairs" Strategy

Based on the feature requirements, the work maps cleanly into three distinct areas. 

### Pair 1: Visuals & UI (Focus: Feature 1)
This pair will primarily work in the frontend `browser` environment and manage the visual representation of results.
* **Primary Task:** Implement the SVG Preview of Search Results.
* **Approach:** Implement Option A, which involves a full-diagram export and client-side cropping.
* **Technical focus:** Work in the React webview using `DOMParser` to extract SVG `<g>` elements by their `id` attribute.
* **Secondary Task:** Build out the React UI components for the search and replace inputs to ensure a user-friendly interface.

### Pair 2: Query Engine & Highlighting (Focus: Feature 2)
This pair tackles the theoretical and backend-heavy task of building the new search syntax.
* **Primary Task:** Develop Text-Based Queries for Graphical Elements.
* **Approach:** Define a grammar and build a parser running on the GLSP server in Node.js.
* **Technical focus:** The parser will produce a query AST that must be evaluated against the serialized Langium model. 
* **Secondary Task:** Implement the visual highlighting of query matches in the diagram using CSS classes like `.search-match` and dispatching a `FitToScreenAction`.

### Pair 3: Model Mutation & Refactoring (Focus: Features 3 & 4)
This pair handles the core logic of altering the underlying UML model safely.
* **Primary Task:** Implement the Replace Functionality.
* **Approach:** Build batch JSON patches via the GLSP Server to ensure all replacements happen in a single atomic operation.
* **Technical focus:** Resolve JSON paths using `DiagramModelIndex.findPath(id)` and execute commands via `ModelPatchCommand`. 
* **Secondary Task:** Lead the research on extending search capabilities beyond names (e.g., visibility, types, multiplicity) to prepare concrete ideas for the first interim presentation.

---

## 2. Project Timeline & Phase Breakdown

### Phase 1: Foundation & Interim 1 (March 26 – April 17)
**Goal:** Deliver a working proof-of-concept for the basic features and finalize the research for advanced capabilities before the first presentation.

* **Pair 1 (Visuals & UI):**
  * Extend the `SearchResult` interface in `advancedsearch.action.ts` to include optional `svg?: string` and `bounds?: Bounds`.
  * Update `AdvancedSearchWebviewViewProvider` to listen for search responses, request an SVG export via `RequestMinimapExportSvgAction`, and forward the SVG data to the webview.
  * Modify the React component (`advancedsearch.component.tsx`) to parse the SVG string using a `DOMParser`, extract the `<g>` subtrees by element ID, and render them inline.
* **Pair 2 (Query Engine & Highlighting):**
  * Survey existing model querying languages (like OCL, EMF Query, or GraphQL-inspired approaches) and text-based visual search tools.
  * Draft a proposed grammar/syntax for the text-based queries (e.g., `Class[isAbstract=true]`) to present at Interim 1.
* **Pair 3 (Model Mutation & Refactoring):**
  * Define the new interfaces `RequestReplaceAction`, `ReplaceActionResponse`, and `ReplaceResult` in `src/env/common/replace.action.ts`.
  * Implement the `ReplaceActionHandler` to resolve JSON paths using `DiagramModelIndex.findPath(id)` and construct a single batch JSON patch array for updating the `name` property.
  * Execute the constructed patch array using `ModelPatchCommand` to ensure the operation is atomic and supports a single undo.
* **All Pairs:**
  * Brainstorm and prepare concrete ideas for Feature 4 (researching what other UML properties can be searched and replaced, like visibility, types, and multiplicity) to present to the professor.

### Phase 2: Core Engine & Interim 2 (April 18 – May 22)
**Goal:** Integrate the complex query parser and expand the replace functionality to handle arbitrary model properties.

* **Pair 1 (Visuals & UI):**
  * Build the UI in `advancedsearch.component.tsx` for the replace input, a per-result diff preview, and the "Replace All" button.
  * Implement UI logic to show a dropdown instead of a free-text input when replacing enum-valued properties (like `visibility`).
* **Pair 2 (Query Engine & Highlighting):**
  * Implement the grammar parser in `AdvancedSearchActionHandler.handleSearch()` to produce a query AST, replacing the simple string split logic.
  * Extend the `IMatcher` interface and its implementations (e.g., `classmatcher.ts`) to evaluate the query AST against property and relationship queries.
  * Add visual feedback for matches by dispatching `SelectAction` with matching element IDs, dimming non-matching elements, and dispatching a `FitToScreenAction`.
* **Pair 3 (Model Mutation & Refactoring):**
  * Extend `RequestReplaceAction` with a `property` field to specify which property (e.g., "visibility" or "type") to search and replace.
  * Extend the matchers to return a `properties` map alongside element IDs in the `SearchResult` interface, so the UI can show what will change.
  * Update the `ReplaceActionHandler` JSON patch construction to append the targeted property name to the JSON path dynamically.

### Phase 3: Edge Cases & Final Polish (May 23 – June 22)
**Goal:** Handle high-complexity edge cases, harden the tool against bad inputs, and prepare a flawless final demo.

* **Pair 1 & 2 (UI & Highlighting Refinement):**
  * Add a new CSS class (e.g., `.search-match`) with distinctive styling (colored border, background tint) in `styles/index.css` or `uml-glsp-client/css/` to highlight results clearly.
  * Implement query builder UI and syntax hints to guide the user in using the new structured query language.
* **Pair 3 (Advanced Mutation):**
  * Study `PatchManager` reference-rebuilding logic in the Langium connector.
  * Implement cross-reference replacing to support modifying type references (e.g., changing property type `String` to `Text` via the `$refText` field).
* **All Pairs (Security, QA & Demo):**
  * Implement regex input validation to prevent injection and limit complexity (e.g., reject patterns with excessive backtracking via a timeout).
  * Ensure the JSON path exists before applying patches, as the `findPath()` call might return `undefined` for stale search results.
  * Sanitize the replacement string to prevent the injection of JSON patch structures that could corrupt the AST.
  * Rehearse the final demo scenarios, such as bulk renaming `Usr` to `User` across multiple elements and refactoring property types.

---

## 3. How to Cooperate Effectively

* **Establish API Contracts First:** Before writing logic, agree on the TypeScript interfaces. For example, Pairs 1 and 3 need to agree on what the extended `SearchResult` interface will look like. Once the interfaces in `src/env/common/` are defined, frontend and backend can work in parallel.
* **Use Git Feature Branches:** Prefix your branches by pair/feature (e.g., `feature/ui-svg-preview`, `feature/query-parser`). Require at least one person from a *different* pair to approve pull requests to prevent knowledge silos.
* **Leverage the Recommended "Cheat Code":** The project prompt explicitly states that pasting sections into AI assistants to generate starting generic code is an acceptable way to move fast. Use this to get boilerplate out of the way, provided you review and adapt it to project conventions.

***
