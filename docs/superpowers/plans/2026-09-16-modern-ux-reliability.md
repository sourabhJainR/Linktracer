# Modern UX and Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh Linktracer into a faster, cleaner research workspace while removing duplicate controllers, making async actions resilient, and adding regression coverage for every user-facing control.

**Architecture:** Keep the existing offline-first IndexedDB model and research/evidence modules, but make `app.js` the single library/render coordinator and `io.js` the single owner of backup/import/sync/WhatsApp actions. Use event delegation for dynamic link and collection controls, coalesce sync/enrichment work, and let specialized research/category modules refresh only when their data changes. Preserve existing data shapes and APIs; do not introduce paid dependencies or mix code from other repositories.

**Tech Stack:** Browser ES modules, vanilla HTML/CSS/JS, IndexedDB, Express, Node test runner, GitHub Actions.

**Spec:** This plan implements the approved 2026-09-16 Linktracer UX/reliability refresh discussed in chat.

## Global Constraints

- Preserve offline-first behavior and existing IndexedDB stores/API contracts.
- No paid or external runtime dependencies.
- Do not mix implementations from `Hello_world_With_Structure`, `TradingAlgo`, or other repositories.
- Every existing user-facing action must remain reachable and receive regression coverage.
- Avoid full-library rerenders for single-card actions and avoid overlapping sync loops.
- Keep service-worker asset versions consistent with `index.html`.
- Verify the complete test suite and GitHub Actions before declaring completion.

---

### Task 1: Establish regression coverage for the current failure modes

**Files:**
- Modify: `test/ui-actions.test.js`
- Create: `test/ux-reliability.test.js`

**Interfaces:**
- Consumes: current HTML/controller source files.
- Produces: executable assertions for controller ownership, cache-version consistency, action guards, and required UI affordances.

- [ ] **Step 1: Write failing tests** for duplicate controller wiring, research-sync loading, event delegation markers, accessible loading/disabled states, and service-worker version consistency.
- [ ] **Step 2: Run `npm test` and confirm the new assertions fail for the current implementation.**
- [ ] **Step 3: Keep tests focused on observable source-level contracts rather than implementation trivia.**

---

### Task 2: Unify application action ownership and make mutations concurrency-safe

**Files:**
- Modify: `public/app.js`
- Modify: `public/io.js`

**Interfaces:**
- Consumes: existing IndexedDB records and current `/api/enrich`, `/api/link-health`, `/api/sync`, `/api/links` contracts.
- Produces: one authoritative controller per top-level action, `sync()` coalescing, event delegation for link actions, guarded async buttons, and batched local refreshes.

- [ ] **Step 1: Write failing tests** covering one owner for Sync/Export/Import/WhatsApp and protection against concurrent sync calls.
- [ ] **Step 2: Verify the tests fail against the current duplicate wiring.**
- [ ] **Step 3: Remove top-level I/O action wiring from `app.js`; keep it in `io.js`.**
- [ ] **Step 4: Add a sync-in-flight guard and avoid repeated `getAll()` calls inside per-record loops.**
- [ ] **Step 5: Replace per-button `querySelectorAll(...).onclick` attachment with one delegated listener on `#links`.**
- [ ] **Step 6: Add consistent busy/disabled state and status feedback around Save, Check, Sync, Export, Import, and WhatsApp import.**
- [ ] **Step 7: Run the targeted tests and then `npm test`.**

---

### Task 3: Refresh the primary workspace UX

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`

**Interfaces:**
- Consumes: existing DOM IDs used by all feature modules.
- Produces: cleaner visual hierarchy, compact command header, improved capture/search/library states, accessible focus/hover/disabled states, and responsive behavior without changing feature semantics.

- [ ] **Step 1: Write failing source-level UX tests** for stable landmarks, accessible labels, and cache-busted assets.
- [ ] **Step 2: Verify they fail where current markup lacks the new affordances.**
- [ ] **Step 3: Refine markup while preserving IDs/classes consumed by JavaScript modules.**
- [ ] **Step 4: Replace accumulated inline styling with reusable CSS primitives where practical.**
- [ ] **Step 5: Add compact status/toast styling, skeleton/empty/error states, stronger button hierarchy, focus-visible treatment, and mobile-safe controls.**
- [ ] **Step 6: Keep the WhatsApp action prominent in the top bar and preserve its dedicated workspace.**
- [ ] **Step 7: Run UI source tests and the full Node test suite.**

---

### Task 4: Make research and category modules participate cleanly without polling churn

**Files:**
- Modify: `public/index.html`
- Modify: `public/research.js`
- Modify: `public/research-sync.js`
- Modify: `public/category-tabs.js`

**Interfaces:**
- Consumes: existing `collections` records and research/category custom events.
- Produces: loaded research synchronization, event-driven refreshes, fewer periodic scans, and safe refresh hooks after library changes.

- [ ] **Step 1: Write failing tests** that assert `research-sync.js` is loaded and that research/category modules expose/consume explicit refresh events.
- [ ] **Step 2: Verify current markup fails the research-sync assertion.**
- [ ] **Step 3: Load `research-sync.js` once and connect it to the existing sync lifecycle.**
- [ ] **Step 4: Remove or lengthen redundant polling where event-driven refresh is sufficient, retaining a conservative fallback for cross-tab/server changes.**
- [ ] **Step 5: Ensure research checklist mutations queue for sync and remain backward-compatible with existing collection records.**
- [ ] **Step 6: Ensure category mutations do not trigger repeated DOM mutation loops.**
- [ ] **Step 7: Run research/category regression tests and the full suite.**

---

### Task 5: Harden import, restore, enrichment, health, and reader flows

**Files:**
- Modify: `public/app.js`
- Modify: `public/io.js`
- Modify: `public/whatsapp.js`
- Modify: `test/whatsapp-import.test.js`
- Modify: `test/sync.test.js`

**Interfaces:**
- Consumes: existing backup JSON, plain-text/WhatsApp extraction, enrichment, health-check, and reader behavior.
- Produces: duplicate-safe imports, bounded background enrichment, robust malformed-input handling, and deterministic user feedback.

- [ ] **Step 1: Write failing tests** for duplicate import counts, malformed backup handling, offline import, health failure recovery, and enrichment not spawning overlapping work.
- [ ] **Step 2: Verify failures.**
- [ ] **Step 3: Batch restore writes and refresh once rather than rendering after every imported link.**
- [ ] **Step 4: Add an enrichment-in-flight guard and bounded concurrency.**
- [ ] **Step 5: Make health-check buttons self-guarding and prevent stale async results from overwriting newer data.**
- [ ] **Step 6: Ensure reader/highlight/annotation flows preserve selection and close/reopen behavior without duplicate listeners.**
- [ ] **Step 7: Run all tests.**

---

### Task 6: Final verification, CI loop, and review

**Files:**
- Modify only if required by verification: relevant source/test files.

**Interfaces:**
- Consumes: all implementation tasks.
- Produces: verified branch and pull request with green CI.

- [ ] **Step 1: Run `npm test` from a clean checkout/environment.**
- [ ] **Step 2: Inspect the complete diff for accidental feature removal or cross-repository code.**
- [ ] **Step 3: Create the pull request against `main`.**
- [ ] **Step 4: Wait for every GitHub Actions check on the PR head commit to finish.**
- [ ] **Step 5: If any check fails, inspect its job logs, write a regression test when appropriate, fix the branch, and repeat CI verification.**
- [ ] **Step 6: Only report completion after all required checks are green and the final diff matches this plan.**
