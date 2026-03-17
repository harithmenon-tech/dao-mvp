# DAO v1.4 IMPLEMENTATION PLAN

**Document type:** Implementation sequencing and workstream plan  
**Version:** v1.4  
**Status:** APPROVED — READY FOR BRANCH CREATION AND CoWork TASKING  
**Date:** 16 March 2026  
**Baseline:** DAO v1.3 — commit 225d679 — locked  
**Branch:** dao-v1.4-dev (to be created from main at 225d679)  
**Companion documents:** All four DAO v1.4 specification documents  

---

## 1. GOVERNING IMPLEMENTATION RULES

These rules are non-negotiable throughout the v1.4 build. They apply to every workstream, every CoWork session, and every commit.

1. **Do not touch main.** All v1.4 development happens on `dao-v1.4-dev`. Main remains at 225d679 until v1.4 is complete and verified.
2. **No broad redesigns in the first CoWork task.** The first task is scaffolding only — branch, file placement, and identification of affected files. No logic changes.
3. **Additive first.** New capabilities are added to existing files or new files before any existing functionality is modified. Modifications to v1.3 code are surgical.
4. **Verify after every CoWork session.** Run `findstr /n` on all changed files before committing. CoWork verbal confirmation is not sufficient.
5. **Bug fixes before new features.** BUG-01 and BUG-02 must be resolved before any new feature work begins. They are small, known, located precisely.
6. **One workstream per CoWork session.** Do not combine unrelated changes in a single CoWork session.
7. **Test functionally, not by bundle search.** Vite minifies variable names in production. All verification is via functional testing.
8. **API credits.** Keep Anthropic API credits above $5 before any coding session that calls Claude.
9. **No code generation from this document.** This document is a specification. Code generation happens in CoWork sessions using prompts derived from this plan.

---

## 2. PRE-IMPLEMENTATION GATE

Before any code is written, the following must be complete and confirmed:

| Gate item | Status |
|-----------|--------|
| DAO v1.3 baseline locked at commit 225d679 | ✅ Confirmed |
| Three corrected baseline documents at v1.1 | ✅ Confirmed |
| DAO v1.4 TARGET_SPEC.md approved | ✅ This session |
| DAO v1.4 DATA_ARCHITECTURE.md approved | ✅ This session |
| DAO v1.4 CINEMATIC_BEHAVIOUR_ADDENDUM.md approved | ✅ This session |
| DAO v1.4 DECISION_READY_MODEL_FOUNDATION.md approved | ✅ This session |
| DAO v1.4 IMPLEMENTATION_PLAN.md approved | This document |
| Branch `dao-v1.4-dev` created from main at 225d679 | ⬜ CoWork Task 0 |
| All v1.4 spec documents placed on branch | ⬜ CoWork Task 0 |

---

## 3. IMPLEMENTATION WORKSTREAM SEQUENCE

The workstreams are ordered by dependency. Each workstream must be stable before the next begins. The sequence is designed so that every phase produces a working, deployable state — no phase should leave the branch in a broken state.

```
Phase 0: Scaffold
Phase 1: Bug fixes (BUG-01, BUG-02) + technical debt
Phase 2: Data layer — registration, classification, schema
Phase 3: Scan architecture — routing, validation, scheduling
Phase 4: Situation Engine
Phase 5: Command Centre redesign
Phase 6: Decision lifecycle enhancements + Decision Timeline
Phase 7: Pattern Memory foundation + Similar Prior Case
Phase 8: Decision Risk Radar + post-decision monitoring
Phase 9: DAO Chief enhancements
Phase 10: Board-ready output + board narrative routing fix
Phase 11: Domain architecture formalisation
Phase 12: Integration, full loop testing, acceptance verification
```

---

## 4. PHASE-BY-PHASE SPECIFICATION

### PHASE 0 — SCAFFOLD
**Objective:** Create the branch, place the spec documents, identify all files that will change. Zero production logic changes.

**CoWork Task 0 — Safe first task:**

1. Create branch `dao-v1.4-dev` from main at commit 225d679
2. Create folder `docs/v1.4/` on the branch
3. Place all five DAO v1.4 specification documents in `docs/v1.4/`
4. Create `src/core/` folder (empty — placeholder for Phase 2)
5. Create `src/core/patterns/` folder with empty `taxonomy.js` file (placeholder)
6. Identify and list all source files likely to change in v1.4 (no changes yet)
7. Verify the branch builds and deploys identically to main

**Files that will NOT be touched in Phase 0:**
- `src/App.jsx`
- `src/BriefView.jsx`
- `server/index.js`
- `src/dal-storage.js`
- Any existing domain files

**Expected output:** Branch exists, spec docs placed, folder structure created, zero functional changes, app still identical to v1.3.

---

### PHASE 1 — BUG FIXES AND TECHNICAL DEBT
**Objective:** Resolve all known v1.3 defects before building new capabilities. These are small, targeted changes.

**1A — BUG-01: Decision Health widget race condition**

**File:** `src/App.jsx`  
**Location:** The `useEffect` that calls `preloadVarianceForDueDecisions()` and `checkDecisionHealth()` on mount  
**Change:** Move `checkDecisionHealth()` from the mount useEffect to the journal useEffect, so it executes only after `journal` state has been loaded from localStorage  

Before:
```
useEffect(() => {
  // loads profile, journal, datasets, scan, chat
  preloadVarianceForDueDecisions();
  checkDecisionHealth();          ← fires before journal is loaded
}, []);
```

After:
```
useEffect(() => {
  // loads profile, journal, datasets, scan, chat
  preloadVarianceForDueDecisions();
}, []);

useEffect(() => {
  if (journal.length > 0) {
    checkDecisionHealth();         ← fires after journal is confirmed loaded
  }
}, [journal]);
```

**Verification:** Seed 2 Confirmed decisions in localStorage. Reload app. Decision Health widget must render on Dashboard with correct at-risk / watch / healthy classification.

---

**1B — BUG-02: Duplicate Copilot variance block**

**File:** `src/App.jsx`  
**Location:** Inside the Review modal, approximately line 5359 — the second variance block with background `#E8F4FD`  
**Change:** Remove the duplicate block entirely. Block 1 (bg `#1a1a2e`, text `#e0e0ff`) is correct and must be kept.

The duplicate block to remove begins with:
```jsx
{copilotVariance && copilotVariance.variance && !copilotVariance.loading && (
  <div style={{background:'#E8F4FD', ...
```

**Verification:** Open the Review modal for a decision in the Review Queue. Trigger variance load. The Copilot suggestion text must be visible against the dark background. No light-background block should appear.

---

**1C — dal-storage.js rename**

**Files:** `src/dal-storage.js` → `src/dao-storage.js`, `src/App.jsx` (import update)  
**Change:** Rename the file. Update the single import line in App.jsx from:
```js
import { upgradedDecision, validateDecision, bumpVersion, logAudit, saveJournal } from './dal-storage.js';
```
to:
```js
import { upgradedDecision, validateDecision, bumpVersion, logAudit, saveJournal } from './dao-storage.js';
```

**Verification:** App builds without errors. All decision logging, validation, and save functions work correctly.

---

**1D — Draft Board Narrative routing fix**

**File:** `src/BriefView.jsx`  
**Location:** NBA button calling `onNavigate("board")`  
**Change:** Add `view==="board"` as a handled case in `src/App.jsx`. In v1.4 this view will eventually show the Board Narrative generator. For now, it should navigate to the Brief view with a board narrative generation prompt pre-loaded in DAO Chief. Temporary implementation: navigate to `chat` view with a board context message injected.

**Verification:** Clicking "Draft Board Narrative" from the Brief navigates to a functional view, not a blank/broken state.

---

**1E — dao-uploaded-summary data path**

**File:** `src/App.jsx`  
**Location:** `handleFiles()` function  
**Change:** After parsing uploaded files, generate and store a data summary in localStorage:
```js
const summary = summarizeData(newDatasets, false);
localStorage.setItem('dao-uploaded-summary', summary.slice(0, 800));
```

**Verification:** Upload a CSV. Check localStorage for `dao-uploaded-summary`. Confirm it contains a truncated data summary. Confirm `checkDecisionHealth()` receives this summary correctly.

---

### PHASE 2 — DATA LAYER
**Objective:** Implement dataset registration, classification, and the multi-file upload basket.

**2A — Dataset registration schema**

Create `src/core/data/datasetRegistry.js` with:
- `createDatasetRecord(file, parsedData)` — creates a dataset registration object per DATA_ARCHITECTURE §3.1
- `classifyDataset(record)` — AI-assisted classification via `/api/claude` (suggested domain and category based on column names and filename)
- `saveDatasetRegistry(records)` — stores to `dao-datasets-meta` with enhanced schema
- `getEligibleDatasets(scanType)` — filters by scan eligibility for a given scan type

**2B — Upload basket UI**

Extend the Data tab to support basket upload:
- Files are added to a basket state before being committed
- Each file in the basket shows its classification (domain, category) with edit controls
- "Confirm and Add to DAO" button saves all basket items to the registry
- Basket is separate from the committed dataset registry

**2C — Classification UI**

For each uploaded file, show classification fields:
- Domain (dropdown: Operational / Revenue / Financial / Compliance / Shared)
- Category (dropdown: Transactions / Contracts / Maintenance / Staff / Production / Procurement / Customer / Other)
- Scan eligibility (auto-derived with manual override checkboxes)
- Date range (optional — start and end date fields)

**Dependencies:** Phase 1 complete.

---

### PHASE 3 — SCAN ARCHITECTURE
**Objective:** Implement scan routing, pre-scan validation, and scheduled scan configuration.

**3A — Scan routing logic**

Create `src/core/scan/scanRouter.js` with:
- `getIncludedDatasets(scanType, registry)` — returns eligible dataset IDs for a given scan type
- `getExcludedDatasets(scanType, registry)` — returns excluded datasets with exclusion reasons
- `getMissingRequiredTypes(scanType, registry)` — returns dataset types absent from the registry

Update `runScan()` in `App.jsx` to use `scanRouter.js` instead of slicing the raw datasets array.

**3B — Pre-scan validation report**

Before `runScan()` executes, generate and display a validation report:
- Show included files (count + names)
- Show excluded files with reason
- Show missing dataset types (severity: high / medium)
- Show warnings (date staleness, low row counts)
- "Proceed with Scan" confirmation button

Store the validation record per DATA_ARCHITECTURE §4.3.

**3C — Scan record creation**

After each scan run, create and persist a scan record per DATA_ARCHITECTURE §4.1. Store in `dao-scan-history` (last 5 per scan type).

**3D — Scheduled scan configuration**

Add a Schedule tab or subsection to the Data view:
- Enable/disable scheduled scan toggle
- Frequency selector (daily / weekly / manual only)
- Scan type for scheduled run
- Auto-generate brief toggle
- Last run / next run display

Store schedule config in `dao-scan-schedule`.

Note: Actual background scheduling in a browser-based SPA is limited to tab-active state. In v1.4, scheduled scans are triggered when the app is open at the scheduled time, or on the next open if the scheduled time passed while the tab was closed. Full background scheduling is a v1.5 server-side capability.

**Dependencies:** Phase 2 complete.

---

### PHASE 4 — SITUATION ENGINE
**Objective:** Elevate scan findings into first-class Situation objects with causal chains, urgency, impact, and prior case hooks.

**4A — Situation Engine**

Create `src/core/situations/situationEngine.js` with:
- `elevateFindings(findings, scanRecord, patternMemory)` — takes parsed findings array, creates Situation objects
- `buildCausalChain(finding)` — extracts or constructs a causal chain from finding fields
- `classifyUrgency(finding)` — maps tier + impact to urgency level (Critical/High/Medium/Watch)
- `quantifyImpact(finding)` — extracts or estimates financial/operational impact
- `findPriorCase(situation, patternMemory)` — queries Pattern Memory for matching pattern
- `saveSituations(situations)` — stores to `dao-situations`

**4B — Situation panel component**

Create `src/core/situations/SituationPanel.jsx`:
- Displays all Situation fields per TARGET_SPEC §4.2
- Renders causal chain as sequential visual flow (CINEMATIC_BEHAVIOUR §4.3)
- Displays Similar Prior Case section per DECISION_READY_MODEL §4.2
- Renders all 10 action buttons from TARGET_SPEC §4.3
- Urgency-coded header (Critical=red, High=amber, Medium=blue, Watch=grey)

**4C — Situation list view**

Replace the raw finding list in the Scan view with:
- Situations sorted by urgency level (Critical first)
- Each situation card shows: title, urgency badge, impact figure, prior case indicator (if exists)
- Click opens SituationPanel

**Dependencies:** Phases 2 and 3 complete. Phase 1 (BUG fixes) complete.

---

### PHASE 5 — COMMAND CENTRE REDESIGN
**Objective:** Implement the 5-zone Command Centre layout replacing the current dashboard.

**5A — Zone 1: Executive Situation Brief**

Replace the Hero CTA panel with Zone 1:
- Shows the pre-generated brief from the latest scan
- Top situation title, urgency level, causal chain summary, impact, prior case (if any)
- Action buttons: Log Decision, Ask DAO Chief, View Full Brief
- If no scan: prompt to run scan

**5B — Zone 2: Critical Action Queue**

Replace the Top Priorities panel with Zone 2:
- Actions generated from situations (urgency × impact ranked)
- Each entry: action title, linked situation, urgency, impact, SLA indicator if applicable
- Immediate action buttons: Log Decision, Assign Owner, Escalate, Ask DAO Chief
- "All clear" state when no active actions

**5C — Zone 3: Decision Risk Radar**

Replace the Decision Health widget (v1.3, currently broken) with Zone 3:
- Shows decisions with active stress signals (per TARGET_SPEC §8.1)
- Each entry: decision title, stress signal type, urgency, reasoning, Review Now button
- "No decisions at risk" state
- This supersedes BUG-01's Decision Health widget — the Radar is its replacement

**5D — Zone 4: Scan Control + Status**

Replace the existing scan button in header with Zone 4:
- Last scan timestamp and type
- Next scheduled scan time (if scheduled)
- Dataset count and active domain indicator
- Re-scan button (triggers pre-scan validation flow)

**5E — Zone 5: Decision Timeline + Programme Track tabs**

Below Zones 2-4, add a tabbed panel:
- Tab 1: Decision Timeline (new — Phase 6)
- Tab 2: Programme Track (existing Change Tracker, preserved)
- Both tabs accessible from the Command Centre without navigating away

**Dependencies:** Phases 3 and 4 complete.

---

### PHASE 6 — DECISION LIFECYCLE ENHANCEMENTS
**Objective:** Extend the Decision object schema, add Decision Timeline view, implement full lifecycle state machine.

**6A — Decision schema extension**

Update `src/dao-storage.js` (renamed from Phase 1) to support all new Decision fields per DATA_ARCHITECTURE §6.

Ensure backward compatibility: all existing v1.3 decision records in localStorage must continue to load and display correctly. New fields default to `null` on existing records.

**6B — Decision Timeline view**

Implement `src/core/decisions/DecisionTimeline.jsx`:
- Shows all decisions in lifecycle order
- Per entry: date, statement, linked situation (if any), owner, action taken, review date, drift status, review outcome, lesson, pattern tag, reopened status
- Distinct visual separation from Programme Track
- "No decisions logged" empty state

**6C — Lifecycle status transitions**

Extend `dao-storage.js` with `advanceDecisionStatus(decision, newStatus)` — enforces valid state transitions and logs each transition in the audit trail.

**6D — Situation linkage in Log Decision form**

When "Log Decision" is triggered from a Situation panel:
- Pre-populate `linked_situation_id` on the decision form
- Show the linked situation title in the form header
- After save, update the Situation's `linked_decision` field

**Dependencies:** Phase 4 complete.

---

### PHASE 7 — PATTERN MEMORY FOUNDATION
**Objective:** Implement Pattern Memory storage, the pattern taxonomy, and Similar Prior Case population at Situation creation.

**7A — Pattern taxonomy**

Create `src/core/patterns/taxonomy.js` with all 14 pattern types from DECISION_READY_MODEL §3.3 as a keyed object.

**7B — Pattern Memory storage module**

Create `src/core/patterns/patternMemory.js` with:
- `findMatchingPattern(situation)` — queries `dao-patterns` for pattern_type + domain match
- `updatePattern(decision, review)` — creates or updates a Pattern Record after lesson capture
- `getPatternById(pattern_id)` — returns a specific pattern record
- `getAllPatterns()` — returns all pattern records for the Pattern Memory view

**7C — Similar Prior Case integration**

Update `situationEngine.js` to call `findMatchingPattern()` during Situation creation. Populate `situation.similar_prior_case` from the result.

**7D — Pattern tag in Review flow**

Add a Pattern Tag field to the Decision Review modal:
- Dropdown of taxonomy pattern types
- Optional — can be left blank
- On submit: stored on decision record + triggers `updatePattern()` if lesson is also captured

**7E — Pattern Memory visible display**

Add Similar Prior Case rendering to:
1. SituationPanel component
2. Executive Situation Brief (top situation section)
3. Decision Review modal (when prior case exists for linked situation)
4. DAO Chief context (passed in system prompt when situation has prior case)

**Dependencies:** Phase 6 complete.

---

### PHASE 8 — DECISION RISK RADAR AND POST-DECISION MONITORING
**Objective:** Complete the Risk Radar (started in Phase 5C) with full monitoring logic.

**8A — Post-decision monitoring activation**

In `dao-storage.js`, when a decision status advances to "In Execution":
- Set `monitoring_active = true`
- Set `monitoring_datasets` from the linked situation's `source_datasets`
- Set `monitoring_kpis` inferred from the situation's `causal_chain` last step

**8B — Monitoring check on scan cycle**

In `situationEngine.js`, after each scan completes:
- For each decision where `monitoring_active = true`:
  - Re-scan `monitoring_datasets` subset
  - Compare against baseline KPIs from the original situation
  - Classify drift: Better / Same / Worse (per DECISION_READY_MODEL §5.2)
  - Update `decision.outcome_drift` and `decision.monitoring_signal`

**8C — Drift response — Risk Radar elevation**

When drift = Worse:
- Elevate decision to Risk Radar with stress signal "Negative drift detected"
- Add escalation check: if no review scheduled within 7 days, create escalation entry

**8D — Risk Radar UI completion**

Complete Zone 3 with full monitoring data:
- Each entry now shows real monitoring signal, not just static rules
- Drift indicator: Better (green arrow), Same (grey dash), Worse (red arrow)
- "Under monitoring" indicator for active decisions
- Review Now button triggers review flow with monitoring context pre-loaded

**Dependencies:** Phases 5, 6, and 7 complete.

---

### PHASE 9 — DAO CHIEF ENHANCEMENTS
**Objective:** Expand DAO Chief context awareness to cover situations, decisions, patterns, and the current scan cycle.

**9A — Context injection**

Update `buildSystemPrompt()` in `App.jsx` to inject:
- Current top situation (title, urgency, impact, prior case if any)
- Critical Action Queue summary (count and top item)
- Decision Risk Radar summary (count and top stress signal)
- Active domain
- Last scan timestamp and situation count

**9B — Situation-grounded opening statements**

When DAO Chief is opened from a Situation panel context:
- Inject the full Situation object into the system prompt
- DAO Chief's first response must reference the situation directly
- Prior case (if any) must be mentioned without the executive asking

**9C — Pattern Memory context**

When DAO Chief is asked "Has this happened before?" or similar:
- Query Pattern Memory for matching patterns
- Surface prior case, action taken, and outcome in the response

**9D — DAO Chief persistence**

DAO Chief must be accessible from all primary views without navigating to the Chat view:
- Add a persistent DAO Chief button/panel trigger in the header
- Opening DAO Chief from a situation injects situation context
- Opening DAO Chief from the Risk Radar injects the at-risk decision context

**Dependencies:** Phases 5, 7, and 8 complete.

---

### PHASE 10 — BOARD-READY OUTPUT
**Objective:** Complete the Draft Board Narrative flow and enhance Board Report PDF.

**10A — Board Narrative view**

Implement `view==="board"` in App.jsx:
- Shows a Board Narrative generation panel
- Pre-populates from current situation context or brief context
- Generates board-language framing via DAO Chief
- Output is editable before copy or export

**10B — Board Report PDF enhancement**

Update `generateBoardReport()` to include:
- Executive Situation Brief section (top situations with causal chains)
- Decision Timeline section (status and drift for recent decisions)
- Pattern insights section (if patterns have been captured)
- Existing sections preserved: Command Centre summary, findings, revenue, decisions, tracker

**Dependencies:** Phases 5 and 9 complete.

---

### PHASE 11 — DOMAIN ARCHITECTURE FORMALISATION
**Objective:** Formalise the Core vs Domain folder structure and rename files per governance rules.

**11A — Folder restructure**

Move to the structure defined in TARGET_SPEC §14.1:
```
src/
  core/          ← new (created in Phase 0)
  domain/
    registry.js  ← renamed from domainRegistry.js
    injector.js  ← renamed from domainContextInjector.js
    water/
      water.module.js  ← preserved
```

Update all imports accordingly.

**11B — Domain module interface**

Define a standard domain module interface that all future domain modules must implement:
```js
export default {
  id: 'water',
  label: 'Water Utilities',
  getScanOverlay: () => '<prompt string>',
  getBriefOverlay: () => '<prompt string>',
  getSituationHints: () => [],
  getUploadGuidance: () => []
}
```

Refactor `water.module.js` to this interface without changing its content.

**Dependencies:** Phases 1–10 stable.

---

### PHASE 12 — INTEGRATION AND ACCEPTANCE VERIFICATION
**Objective:** Full loop test against all acceptance criteria in TARGET_SPEC §17.

**12A — Full loop test**

Run a complete test cycle:
1. Upload multiple datasets with different classifications
2. Run pre-scan validation — verify included/excluded/missing display
3. Run operational scan — verify situations generated with causal chains
4. Open top situation — verify similar prior case shown (if patterns seeded)
5. Log a decision from the situation
6. Run a second scan cycle — verify monitoring is active, drift classification works
7. Open Risk Radar — verify decision appears if drift = Worse
8. Submit a review — verify lesson captured and Pattern Memory updated
9. Run a third scan with same pattern — verify prior case now surfaces
10. Verify 15-second clarity test on Command Centre

**12B — Bug regression check**

Verify BUG-01 and BUG-02 remain fixed after all other changes.

**12C — Acceptance criteria sign-off**

Work through all 12 acceptance criteria in TARGET_SPEC §17. Each must be demonstrably passed before v1.4 is declared complete.

---

## 5. FILES EXPECTED TO CHANGE

### New files (created in v1.4)

| File | Phase | Purpose |
|------|-------|---------|
| `docs/v1.4/` (5 spec docs) | 0 | Governance documentation |
| `src/core/data/datasetRegistry.js` | 2 | Dataset registration and classification |
| `src/core/scan/scanRouter.js` | 3 | Scan routing and validation |
| `src/core/situations/situationEngine.js` | 4 | Situation Engine |
| `src/core/situations/SituationPanel.jsx` | 4 | Situation display component |
| `src/core/decisions/DecisionTimeline.jsx` | 6 | Decision Timeline view |
| `src/core/patterns/taxonomy.js` | 7 | Pattern type taxonomy |
| `src/core/patterns/patternMemory.js` | 7 | Pattern Memory module |

### Existing files modified in v1.4

| File | Phases | Nature of change |
|------|--------|-----------------|
| `src/App.jsx` | 1, 2, 4, 5, 6, 8, 9 | Bug fixes, new views, context injection, lifecycle enhancements |
| `src/BriefView.jsx` | 1, 10 | Board narrative routing, brief enhancements |
| `src/dal-storage.js` → `src/dao-storage.js` | 1 | Rename + schema extension |
| `src/domain/domainRegistry.js` → `src/domain/registry.js` | 11 | Rename |
| `src/domain/domainContextInjector.js` → `src/domain/injector.js` | 11 | Rename |
| `src/domain/water/water.module.js` | 11 | Interface standardisation |
| `server/index.js` | None expected | Backend is complete for v1.4 scope |

### Files that must NOT be changed

| File | Reason |
|------|--------|
| `server/index.js` | Backend is fully capable for v1.4. All five endpoints are functional. No backend changes needed. |
| `src/main.jsx` | Entry point — stable |
| `vite.config.js` | Build configuration — stable |
| `package.json` | No new dependencies required for v1.4 scope |
| `index.html` | HTML shell — stable |

---

## 6. COWORK TASK TEMPLATES

### Task 0 — Branch scaffold (safe first task)

```
You are working on the DAO v1.4 development branch setup.

TASK: Create the dao-v1.4-dev branch scaffold.

DO:
1. Confirm you are on branch dao-v1.4-dev (create from main at 225d679 if it does not exist)
2. Create folder: docs/v1.4/
3. Create folder: src/core/
4. Create folder: src/core/patterns/
5. Create empty file: src/core/patterns/taxonomy.js with a single comment: // DAO v1.4 Pattern Taxonomy — populated in Phase 7
6. List all files in src/ and server/ and report them back without changing any of them

DO NOT:
- Change any existing files
- Modify App.jsx, BriefView.jsx, server/index.js, or dal-storage.js
- Install any packages
- Write any implementation code

VERIFY:
- Run: npm run dev (local) and confirm app loads identically to v1.3
- Report: which files were created, which were untouched
```

### Task 1A — BUG-01 fix

```
You are fixing a specific, known bug in DAO v1.3 on branch dao-v1.4-dev.

BUG: Decision Health widget does not render on Dashboard.
ROOT CAUSE: checkDecisionHealth() is called in the mount useEffect before the journal useEffect has loaded data.
FILE: src/App.jsx

CHANGE REQUIRED:
Find the mount useEffect that calls preloadVarianceForDueDecisions() and checkDecisionHealth().
Remove checkDecisionHealth() from that useEffect.
Find the useEffect that depends on [journal].
Add: if (journal.length > 0) { checkDecisionHealth(); } inside that useEffect.

DO NOT change any other code.

VERIFY:
1. Using findstr /n confirm the change was made correctly in App.jsx
2. Confirm app still builds without errors
3. With decisions seeded in localStorage, confirm Decision Health widget renders on Dashboard
```

### Task 1B — BUG-02 fix

```
You are fixing a specific, known bug in DAO v1.3 on branch dao-v1.4-dev.

BUG: Copilot suggestion text is invisible in the Review modal.
ROOT CAUSE: Two duplicate variance display blocks render simultaneously. Block 2 has background #E8F4FD with no text colour.
FILE: src/App.jsx

CHANGE REQUIRED:
In the Review modal section, find the SECOND copilotVariance display block — the one with background #E8F4FD.
The block begins with:
  {copilotVariance && copilotVariance.variance && !copilotVariance.loading && (
    <div style={{background:'#E8F4FD',...
Remove this entire second block. Keep the first block (background #1a1a2e).

DO NOT change any other code.

VERIFY:
1. Using findstr /n confirm the duplicate block is gone and only one variance block remains
2. Confirm the remaining block has background #1a1a2e
3. Open the Review modal, trigger a variance load — text must be visible
```

---

## 7. DEPENDENCY MAP

```
Phase 0 ──────────────────────────────────────────────────────┐
  └── Phase 1 (bug fixes + tech debt) ────────────────────────┤
        └── Phase 2 (data layer)                              │
              └── Phase 3 (scan architecture)                 │
                    └── Phase 4 (situation engine)            │
                          └── Phase 5 (command centre)        │
                                └── Phase 6 (decision lifecycle)
                                      └── Phase 7 (pattern memory)
                                            └── Phase 8 (risk radar + monitoring)
                                                  └── Phase 9 (DAO Chief)
                                                        └── Phase 10 (board output)
                                                              └── Phase 11 (domain formalisation)
                                                                    └── Phase 12 (integration + acceptance)
```

Phases 5 and 6 may partially overlap (the Decision Timeline tab in Phase 5E references the Decision Timeline component from Phase 6). The safe approach is to implement Phase 5E as a stub tab in Phase 5 and connect it to the Phase 6 component when complete.

---

## 8. ACCEPTANCE GATE

DAO v1.4 is released to main when all 12 acceptance criteria in TARGET_SPEC §17 are passed. No partial release. No "good enough for now." The criteria are:

1. 15-second executive clarity standard met on Command Centre
2. Multiple datasets classifiable and scan-eligible with different routing
3. Pre-scan validation shows included/excluded/missing before scan runs
4. Scan results produce Situation objects, not just raw finding text
5. Decision Risk Radar shows only decisions under active stress
6. Decision Timeline is distinct from Programme Track
7. Similar Prior Case visible in Situation panel without additional navigation
8. Post-decision monitoring detects negative drift and elevates to Risk Radar
9. BUG-01 resolved — Decision Health widget (now Risk Radar) renders correctly
10. BUG-02 resolved — Copilot suggestion text visible in Review modal
11. `dal-storage.js` renamed to `dao-storage.js`
12. System behaves as already active when executive opens it after a completed scan

---

## 9. WHAT IS NOT IN SCOPE FOR v1.4

The following capabilities are explicitly out of scope. They must not be added to any CoWork task, any branch commit, or any planning document for v1.4:

- Graph visualisation layer
- Graph database backend
- Simulation engine
- Cross-decision comparison analytics
- Confidence-weighted scenario modelling
- Deep predictive simulation
- Cross-organisation pattern benchmarking
- Automated pattern learning (without human review loop)
- Additional domain modules beyond Water and Generic
- Multi-tenant deployment
- Server-side scheduled scanning (browser-based scheduling only in v1.4)
- Historical data import for Pattern Memory seeding from pre-deployment decisions
