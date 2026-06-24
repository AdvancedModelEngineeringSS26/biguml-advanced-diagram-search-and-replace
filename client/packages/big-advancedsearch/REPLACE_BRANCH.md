# `replace` branch — onboarding notes

This branch adds a **Replace** capability to the existing Advanced Search panel in
`big-advancedsearch`. Find a UML element by query, optionally edit a scalar property
(`name`, `visibility`) across the matched rows, preview the result per row, then commit.

Replace work is contained in `big-advancedsearch`, plus one error-propagation fix in
`uml-glsp-server` (`diagram-model-state.ts`).

## High-level architecture

```
┌──────────────────────────┐    RequestReplaceAction     ┌────────────────────────────┐
│ React webview            │ ──────────────────────────▶ │ GLSP server                │
│ advancedsearch.component │                             │ ReplaceActionHandler       │
│  - search input          │ ◀────────────────────────── │  - validates inputs        │
│  - chevron → replace row │     ReplaceActionResponse   │  - builds JSON-patch ops   │
│  - property dropdown     │     (per-row results[])     │  - ModelPatchCommand via   │
│  - per-row preview/icons │                             │    CommandStack            │
└──────────┬───▲───────────┘                             │  - submitModel('operation')│
           │   │                                         └────────────────────────────┘
 UndoNotification  ModelChangedNotification
           │   │
┌──────────▼───┴───────────┐
│ VS Code extension host   │
│ webview-view-provider    │
│  - undo → UndoAction to  │   (routes through the active GLSP
│    active GLSP client    │    diagram client; Ctrl+Z-equivalent)
│  - model change → notify │
│    webview to refresh    │
└──────────────────────────┘
```

The replace round-trip is a standard GLSP request/response. Two deliberate choices:

- **The patch goes through the GLSP `CommandStack`** (not `cmd.execute()` directly), so
  the server can pop it on `UndoOperation`, and **the model is submitted with reason
  `'operation'`**, so the bigUML connector fires `onDidChangeCustomDocument` — that is
  what feeds VS Code's custom-document undo stack, the dirty indicator, and the save flow.
- **Undo from the panel** sends a plain notification to the extension host, which routes
  a GLSP `UndoAction` to the *active diagram client* (the search panel's own clientId is
  not in the connector's diagram-client map, so it can't dispatch GLSP actions itself).

The host also forwards every model-state change to the webview
(`ModelChangedNotification`); the webview re-runs its current query and retires the
post-replace status/Undo button when the change wasn't caused by its own replace.

## Files to read, in order

1. **Protocol** — `src/env/common/replace.action.ts`, `advancedsearch.action.ts`
   - `RequestReplaceAction` / `ReplaceActionResponse` / `ReplaceResult` (note
     `ReplaceResult.changed` — distinguishes "actually mutated" from "no-op").
   - `AdvancedSearchActionResponse.findPattern` — the query's `name` filter value,
     parsed server-side; the webview never parses the query itself.
   - `AdvancedSearchActionResponse.error` — parse errors, shown in the panel.

2. **Shared semantics** — `src/env/common/replace-semantics.ts`
   - `applyReplacement` is the single implementation used by both the server mutation
     and the client preview. Literal substring matching, case-insensitive by default,
     `$` in the replacement is literal.

3. **Backend** — `src/env/glsp-server/replace.handler.ts`
   - Validates `property` against `SAFE_PROPERTY_RE`, rejects empty `searchPattern`,
     rejects rows whose replacement would clear the value.
   - Builds a single JSON-patch batch → `ModelPatchCommand` → `commandStack.execute` →
     `submitModel('operation')`. Patch failures propagate and answer `ok: false`.

4. **Find pattern** — `src/env/glsp-server/matchers/find-pattern.ts`
   - `extractNameFindPattern` pulls the root criteria's `name` filter out of the parsed
     query AST (results returned by `matchAdvanced` are the root-criteria elements).

5. **Webview UI** — `src/env/browser/advancedsearch.component.tsx`
   - Single search input + chevron toggle for the replace block (`replaceOpen` state).
   - Property selector, match-case toggle, enum-aware replace input (dropdown for
     `visibility`, textbox otherwise).
   - Per-row include checkbox, replace button, `old → new` preview, outcome icons (✓/–/✗).
   - Model-change handling: refresh current query, grace window for the Undo button.

6. **Wiring** — `src/env/common/index.ts`, `src/env/glsp-client/advancedsearch.module.ts`,
   `src/env/glsp-server/advancedsearch.module.ts`

7. **Undo + model-change bounce** — `src/env/common/undo.notification.ts`,
   `src/env/common/model-change.notification.ts`,
   `src/env/vscode/advancedsearch.webview-view-provider.ts`

8. **Styles** — `styles/index.css`

## Query syntax (relevant to replace)

The search DSL is structured: `Class[name~"User"]` (contains), `Class[name="User"]`
(exact), hierarchical `Class[name~"Base"] > Attribute[name~"id"]`. There is **no**
`Class:User` shorthand — the lexer has no `:` token. For the `name` property the
replace find pattern is exactly the query's name filter value, computed server-side.

## Build, run, test

```powershell
# From repo root
npm --workspace=packages/big-advancedsearch run compile   # tsc
npm --workspace=packages/big-advancedsearch run bundle    # webview bundle
npm --workspace=packages/big-advancedsearch run test      # vitest (26 tests)
```

Then F5 the VS Code extension host, open a `.uml` workspace (samples in `workspace/`),
open the Advanced Search view, type a query (e.g. `Class[name~"User"]`), expand the
chevron, type a replacement, hit Replace All — or replace individual rows.

### Manual verification matrix for the undo/dirty work

- replace → document shows dirty dot, Ctrl+S persists
- Ctrl+Z in the diagram reverts the replace
- panel Undo button reverts the replace; status clears once the model change lands
- panel Undo button after an unrelated diagram edit: button should already be gone
  (retired by the model-change notification)
- known bookkeeping caveat: the panel button pops the GLSP stack without consuming
  VS Code's matching stack entry, so the final Ctrl+Z of a session can no-op

## What's still open

- **Cross-reference rename** (larger, strategic) — when renaming `Class.name`, also
  rewrite `$refText` occurrences pointing to the old name. Walk
  `modelState.semanticRoot.diagram`, append patch ops to the same batch so undo stays
  atomic, and switch `path + '/' + property` to per-segment JSON-Pointer escaping once
  property paths can contain dots. Study the Langium connector's `PatchManager` first.
- **Dry-run protocol** — `dryRun: true` on `RequestReplaceAction` returning results
  without applying the patch. Becomes important once cross-reference rename lands,
  because the client-side preview can't predict reference rewrites.
- **Regex mode** — removed for now (commit `refactor(replace): remove regex mode…`).
  If it comes back, it must come back together with ReDoS hardening (pattern length
  cap, bounded execution).

## Gotchas a new contributor should know

- **Empty `searchPattern` is rejected by design**, and so are replacements that would
  clear a value. If "clear value" is ever needed, add an explicit `clearValue: true`
  field — don't reintroduce empty-string semantics.
- **Matching is case-insensitive by default.** The `caseSensitive` flag on the action
  overrides this; the UI always sends it explicitly.
- **`ReplaceResult.changed` is optional in the type but the handler always sets it.**
  Make it required when you next bump the protocol.
- **`path + '/' + property`** in `replace.handler.ts` is safe only because
  `SAFE_PROPERTY_RE` blocks `~` and `/`. Switch to per-segment JSON-Pointer escaping
  before allowing dotted property paths.
- **Find pattern is server-derived for `name`** (`AdvancedSearchActionResponse.findPattern`);
  for other properties it's the `findOverride` state. Don't add a client-side query parser.
- **Replace semantics live in one place** (`common/replace-semantics.ts`). Change it
  there or not at all — the tests pin the behavior.
- **`ENUM_PROPERTY_VALUES` is hardcoded client-side.** A new enum property in the AST
  silently falls back to a textbox until added there.
- **There are uncommitted package.json version bumps** across the workspace (plus a
  lockfile that now partially reflects them, see the test commit message). Sort out
  with whoever owns versioning before raising a PR.
