# DAO v1.4 TARGET SPECIFICATION

**Document type:** Product target specification  
**Version:** v1.4  
**Status:** APPROVED FOR IMPLEMENTATION PLANNING  
**Date:** 16 March 2026  
**Baseline it builds from:** DAO v1.3 — commit 225d679 — locked  
**Sources:** DAO_1_4_Blueprint_Rev3, DAO_Master_Operating_Binder_Rev3, DAO_Cinematic_Scenarios, DAO_v1_3_FEATURE_BASELINE v1.1, DAO_v1_3_CODE_FEATURE_REVIEW  

---

## NON-DOWNGRADE MANDATE

DAO v1.4 must not be reduced into any of the following:

**A generic dashboard.** DAO is not a collection of charts and count widgets. Passive display panels that do not lead directly to an action, a decision, or an escalation must be removed from the landing experience or redesigned to carry consequence.

**A BI reporting tool.** DAO does not summarise the past for reporting purposes. It surfaces situations, detects patterns, and stages leadership action in the present.

**A conversational copilot.** The AI layer in DAO is not a chatbot. It is a decision intelligence system with a voice. Its role is to surface truth, force decisions, and make change stick — not to answer questions on demand.

**A workflow engine with chat.** DAO is not a task management system with an attached language model. Workflow launch is a consequence of situation recognition, not the primary function.

**A UI redesign of the MVP.** v1.4 is not cosmetic. It is an architectural advance. The visual changes must follow from the intelligence model and the executive experience standard — not precede them.

**DAO is an Executive Decision Operating System.** Its design must make this felt within fifteen seconds of an executive opening the application. Everything that does not serve that standard must be redesigned or removed.

---

## 1. PRODUCT DEFINITION

DAO v1.4 is an action-led executive command centre sitting on top of a classified multi-source scan architecture, with closed-loop decision tracking, escalation intelligence, institutional memory, executive situational clarity, and a decision-ready data model that can later evolve into a full Decision Memory Graph.

It is the system that works overnight so the executive does not wake up to a crisis. It converts raw signals into executive situations. It surfaces what matters, why it matters, what happened before, and what can be done right now. It remembers outcomes and learns from them. It does not wait to be asked.

### 1.1 The Standard DAO v1.4 Must Meet

An executive must be able to open DAO and, within fifteen seconds, understand:
- What matters most right now
- Why it matters — the chain of causation, not just the symptom
- What is drifting or at risk
- Whether this has happened before and what was done
- What action can be taken immediately without leaving the current view

This is the executive situational clarity standard. Every design decision in v1.4 must be evaluated against it.

### 1.2 The Runtime Loop

DAO v1.4 must operate the following continuous loop:

```
Data → Scan → Situation → Action → Decision → Outcome → Learning
```

This loop must run automatically. DAO must support both scheduled overnight scan cycles and on-demand scans triggered by the executive. The Executive Situation Brief must be generated from the latest completed scan cycle and available before the executive opens the application. The system must feel already active when the executive arrives.

---

## 2. WHAT DAO v1.4 PRESERVES FROM v1.3

All capabilities confirmed as `LIVE — FULLY FUNCTIONAL` in DAO_v1_3_FEATURE_BASELINE.md v1.1 must be preserved without regression. The following are called out explicitly because they form the foundation of v1.4:

| v1.3 Capability | v1.4 Disposition |
|-----------------|-----------------|
| Operational Scan | Preserved — enhanced with data classification and scan routing |
| Revenue Intelligence Scan | Preserved — enhanced with scan eligibility logic |
| Executive Brief (60-Second) | Renamed → Executive Situation Brief. Enhanced with situation-first structure |
| Discuss with AI / AI Chat | Renamed → DAO Chief. Enhanced with situation and decision context awareness |
| Decision Ledger | Preserved and enhanced with outcome tracking, drift status, pattern tags |
| Review Queue | Preserved — enhanced with Copilot variance and drift signals |
| Track | Preserved. Split into Programme Track (unchanged) and Decision Timeline (new) |
| Data Upload / Data Sources | Preserved — enhanced with registration, classification, and scan eligibility |
| Copilot Variance Analysis | Preserved and promoted — integrated into decision review and Risk Radar |
| Copilot Options Panel (Brief) | Preserved — integrated with Situation Engine context |
| Board Report PDF Export | Preserved — enhanced to include situation and decision timeline sections |
| Challenge Check Modal | Preserved — extended with situation linkage |
| Decision Profile / Theory of Mind | Preserved — becomes input to Pattern Memory |
| Voice Input | Preserved as lightweight utility |
| Change Tracker | Preserved as Programme Track |

### 2.1 Two Open Bugs That Must Be Fixed in v1.4

| Bug | Fix |
|-----|-----|
| BUG-01: Decision Health widget does not render (race condition on mount) | Move `checkDecisionHealth()` call into the journal useEffect, after journal state is confirmed loaded |
| BUG-02: Duplicate Copilot variance block with light background `#E8F4FD` | Remove the duplicate second block in the Review modal. Keep Block 1 (dark styling, correct). |

### 2.2 Technical Debt to Address in v1.4

- Rename `src/dal-storage.js` → `src/dao-storage.js`. Update import in App.jsx. Non-functional rename only.
- Implement `view==="board"` routing for Draft Board Narrative. Currently a dead navigation target.
- Write to `dao-uploaded-summary` localStorage key from the Data upload flow to complete the decision health data path.

---

## 3. COMMAND CENTRE DOCTRINE

The Command Centre is the default executive landing page. Its job is to stage leadership attention and action in the right sequence, not merely to summarise.

### 3.1 Zone Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ZONE 1: EXECUTIVE SITUATION BRIEF                          │
│  Auto-generated from latest scan. Top situation, urgency,   │
│  business impact, recommended action, prior case.           │
├───────────────────────┬─────────────────────────────────────┤
│  ZONE 2:              │  ZONE 3:                            │
│  CRITICAL ACTION      │  DECISION RISK RADAR                │
│  QUEUE                │  Decisions under stress, drift      │
│  Immediate actions    │  signals, overdue reviews,          │
│  ranked by urgency    │  approaching thresholds             │
├───────────────────────┴─────────────────────────────────────┤
│  ZONE 4: SCAN CONTROL + SCAN STATUS                         │
│  Last scan timestamp. Next scheduled scan. Re-scan trigger. │
│  Domain active indicator. Dataset count.                    │
├─────────────────────────────────────────────────────────────┤
│  ZONE 5: DECISION TIMELINE  |  PROGRAMME TRACK              │
│  Life-of-decision view      |  Implementation workstreams   │
├─────────────────────────────────────────────────────────────┤
│  PERSISTENT: DAO CHIEF — context-aware conversation layer   │
│  Aware of: current scan results, current situations,        │
│  current decisions, active domain, Pattern Memory           │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Command Centre Behaviour Rules

- Every visible element must provoke action or carry consequence. Passive count widgets with no action pathway must be removed or redesigned.
- Zone 1 must render without user interaction. If a scan has been run, the brief is available. If no scan has been run, Zone 1 prompts the executive to run one.
- Zone 2 must rank actions by urgency × impact. The top action must be immediately actionable without leaving Zone 2.
- Zone 3 must show decisions that are overdue, drifting negative, or approaching their review date. It is not a general decision list.
- Zone 4 must show whether DAO ran overnight and what it found, even if the executive has not yet opened the scan view.
- Zone 5 must show the Decision Timeline as a distinct view from Programme Track. These are different objects — decisions and implementations are not the same thing.
- DAO Chief must persist across the entire Command Centre. It must know what the executive is looking at and respond within that context.

---

## 4. SITUATION ENGINE

### 4.1 What a Situation Is

A Situation is the primary executive unit of work in DAO v1.4. It is not a finding. A finding is a raw signal. A Situation is a finding that has been elevated into an executive-grade object with context, urgency, recommended action, and — where available — a similar prior case.

The Situation Engine converts scan findings into first-class Situation objects.

### 4.2 Situation Object — Mandatory Fields

| Field | Type | Description |
|-------|------|-------------|
| `situation_id` | String | Unique identifier |
| `title` | String | One-line executive summary of what is happening |
| `domain` | Enum | Operational / Revenue / Financial / Risk / Compliance / Other |
| `source_datasets` | Array | Dataset(s) that produced this situation |
| `pattern_detected` | String | The underlying pattern (e.g., "Maintenance deferral → efficiency decline") |
| `causal_chain` | Array | Ordered steps from root cause to projected consequence |
| `urgency_level` | Enum | Critical / High / Medium / Watch |
| `business_impact` | String | Quantified financial or operational impact where calculable |
| `likely_cause` | String | Root cause assessment |
| `recommended_action` | String | Single most important next step |
| `escalation_path` | String | Who should act if no decision is taken within SLA |
| `similar_prior_case` | Object | Linked pattern from Pattern Memory (null if no match) |
| `linked_decision` | String | Decision ID if a decision has been logged against this situation |
| `status` | Enum | Active / Actioned / Monitoring / Resolved / Escalated |
| `created_at` | Timestamp | When situation was generated |
| `scan_id` | String | The scan run that produced this situation |

### 4.3 Situation Workflow

From a Situation, the executive must be able to take the following actions without leaving the situation context panel:

1. Log Decision (links the decision to this situation)
2. Assign Owner
3. Set Review Date
4. Launch Investigation (opens DAO Chief with situation context pre-loaded)
5. Escalate (marks escalated, triggers escalation path)
6. Create Tracker Item (creates a Programme Track workstream entry)
7. Draft Board Narrative (opens board narrative generator with situation context)
8. Run Option Comparison (lightweight — presents 2-3 options via DAO Chief)
9. Ask DAO Chief (opens DAO Chief with situation context pre-loaded)
10. Mark Resolved

### 4.4 Similar Prior Case Display

When a situation is created, DAO must check Pattern Memory for any prior situation that matches by pattern type and domain. If a match exists, the Situation panel must surface:

- What happened previously
- What action was taken
- What the outcome was
- Whether the action is reusable now

This is not a buried data lookup. It must be visible in the Situation panel without the executive navigating away.

---

## 5. SCAN AND DATA ARCHITECTURE

*Full specification in DAO_v1_4_DATA_ARCHITECTURE.md. Summary here for Command Centre and Situation Engine integration.*

### 5.1 Data Registration

Every uploaded data source must be registered with metadata at the point of upload. Scan eligibility must be determined at registration, not at scan time.

### 5.2 Scan Types and Routing

| Scan Type | Uses | Excludes |
|-----------|------|----------|
| Operational Scan | Datasets classified as Operational, Shared | Revenue-exclusive datasets |
| Revenue Intelligence Scan | Datasets classified as Revenue, Shared | Operational-exclusive datasets |
| Domain Scan (Water, etc.) | Domain-tagged datasets | Unrelated domain datasets |
| Full Scan | All registered datasets | None |

### 5.3 Pre-Scan Validation

Before any scan runs, DAO must show:
- Files included in this scan
- Files excluded and why
- Required fields missing from included files
- Estimated scan coverage
- Warning if critical dataset types are absent

The executive must be able to see and confirm the scan composition before execution.

### 5.4 Scan Scheduling

DAO must support:
- **Overnight scheduled scan:** Runs automatically on a set schedule (default: overnight). Results available when the executive opens DAO.
- **On-demand scan:** Triggered by the executive at any time.
- **Triggered scan:** Launched from a situation or a DAO Chief recommendation.

The scan timestamp and completion status must be visible in Zone 4 of the Command Centre at all times.

---

## 6. EXECUTIVE SITUATION BRIEF

The Executive Situation Brief replaces the 60-Second Brief. It is generated from the latest completed scan cycle, not assembled on demand from chat context.

### 6.1 Brief Structure

```
EXECUTIVE SITUATION BRIEF
Generated: [timestamp] | Scan: [scan_id] | Domain: [active_domain]

TOP SITUATION
[Title] — [Urgency Level]
[Causal chain summary — pattern → projected consequence]
[Business impact, quantified]

PRIOR CASE: [Similar prior situation title] — [outcome]

TOP RISKS (3)
[Risk] — [Confidence] — [Evidence]

TOP OPPORTUNITIES (3)
[Opportunity] — [Confidence] — [Evidence]

DECISIONS NEEDED
[Decision statement that must be made]

ACTIONS AVAILABLE
[Log Decision] [Escalate] [Assign Owner] [Ask DAO Chief]
```

### 6.2 Brief Generation Rules

- The brief must be generated automatically after each scan completes.
- If no scan has run in the last 24 hours, the brief must show a staleness warning.
- The brief must include the Similar Prior Case where Pattern Memory has a match.
- The brief must surface domain-specific context where a domain is active.
- The Copilot Options Panel (currently live in BriefView.jsx) must remain and be promoted — it surfaces 3 strategic options from `/api/copilot` based on the brief situation.

---

## 7. CRITICAL ACTION QUEUE

The Critical Action Queue replaces the Priorities panel. It is not a list of findings. It is a ranked list of things that require an executive decision or action now.

### 7.1 Action Queue Entry Fields

| Field | Description |
|-------|-------------|
| `action_title` | One-line description of what must be done |
| `linked_situation` | The situation that generated this action |
| `urgency` | Critical / High / Medium |
| `impact` | Quantified consequence of inaction |
| `sla_deadline` | When this must be acted on |
| `owner` | Assigned or unassigned |
| `escalation_trigger` | What happens if SLA passes without action |

### 7.2 Queue Behaviour

- The queue is ordered by urgency × time remaining, not by recency.
- Each entry must allow immediate action: log decision, assign owner, escalate, or ask DAO Chief — all without navigating away.
- Entries are generated by the Situation Engine, not manually added.
- An entry remains in the queue until a decision is logged, it is escalated, or it is marked actioned.

---

## 8. DECISION RISK RADAR

The Decision Risk Radar replaces Decision Health. It is not a general decision list. It shows specifically which decisions are under stress.

### 8.1 Radar Entry — When a Decision Appears

A decision enters the Risk Radar when any of the following are true:
- Its review date has passed without a review being completed
- Post-decision monitoring detects a negative drift signal in the linked dataset
- The outcome is trending Worse than expected
- A pattern tag matches a historically problematic decision type
- No owner has been assigned within SLA
- The situation that prompted the decision has re-emerged

### 8.2 Radar Display

For each entry the Radar must show:
- Decision title and date
- Stress signal (which trigger fired)
- Urgency of the stress signal
- Reasoning (one-sentence AI assessment)
- Review Now action

### 8.3 Post-Decision Monitoring

After a decision is logged and actioned, DAO must continue monitoring the datasets associated with the originating situation. If signal drift is detected — defined as measurable negative movement in the KPIs that produced the original situation — DAO must:
1. Reopen the situation or create a new linked situation
2. Elevate the decision to the Risk Radar
3. Notify through the Executive Situation Brief in the next cycle

---

## 9. DECISION TIMELINE

The Decision Timeline is a new, distinct view from Programme Track. It shows the life of every decision from logging through outcome and lesson.

### 9.1 Decision Lifecycle States

```
Logged → Approved → In Execution → Under Review → Outcome Emerging
  → Outcome Confirmed → Lesson Captured → [Closed | Reopened]
```

### 9.2 Decision Timeline Entry — What Is Shown

For each decision on the timeline:
- Date logged
- Decision statement
- Linked situation (if any)
- Owner
- Action taken
- Review date
- Early signals from post-decision monitoring
- Drift status (Better / Same / Worse / Not Yet Assessed)
- Review outcome (if reviewed)
- Lesson captured (if any)
- Pattern tag (if any)
- Reopened status

### 9.3 Decision Timeline vs Programme Track

| Decision Timeline | Programme Track |
|-------------------|-----------------|
| Tracks individual decisions | Tracks implementation projects |
| Shows decision lifecycle | Shows workstream RAG status |
| Links to situations and outcomes | Links to tasks and milestones |
| Feeds Pattern Memory | Feeds project completion metrics |
| Managed by DAO governance layer | Managed by the executive team |

These are separate views. They may link to each other (a decision may trigger a Programme Track project) but they must not be merged.

---

## 10. PATTERN MEMORY AND SIMILAR PRIOR CASE

### 10.1 What Pattern Memory Is

Pattern Memory is DAO's institutional memory layer. It stores the accumulated learning from past situations, decisions, and outcomes. It is not a search index. It is a recognition engine. When a new situation is detected, Pattern Memory checks whether this pattern has been seen before and what happened.

### 10.2 Pattern Record Structure

*Full specification in DAO_v1_4_DECISION_READY_MODEL_FOUNDATION.md.*

Each pattern record holds:
- Pattern type and domain
- Typical trigger conditions
- Actions taken historically
- Outcomes and their quality
- Lessons extracted
- Reuse recommendation

### 10.3 Where Pattern Memory Surfaces

Pattern Memory must be visible — not buried in storage. It must surface in:
- The Executive Situation Brief (prior case in the top situation)
- The Situation panel (Similar Prior Case section)
- The Review Queue (when reviewing a decision)
- DAO Chief responses (when asked about a situation or decision)

### 10.4 Pattern Memory — Build Scope in v1.4

In v1.4, Pattern Memory is built as a foundation, not a full intelligence engine:

**Mandatory in v1.4:**
- Pattern record schema defined and populated at decision review time
- Similar Prior Case lookup against pattern type and domain
- Pattern tags on decision records
- Pattern Memory visible in situation panels and brief

**Foundation only in v1.4:**
- Linkable pattern objects with graph-ready schema
- Pattern frequency and recurrence tracking

**Deferred to v1.5/2.x:**
- Automated pattern clustering
- Cross-organisation pattern benchmarking
- Predictive pattern matching at scan time

---

## 11. DAO CHIEF

DAO Chief replaces "Discuss with AI / AI Chat." The name change is not cosmetic. DAO Chief is an intelligence layer aware of the current operating state of the system.

### 11.1 Context Awareness

DAO Chief must be aware of and responsive to:
- The current scan results and top situations
- The current decision ledger (recent decisions, overdue reviews)
- The active domain
- Pattern Memory (recent and relevant patterns)
- The current Executive Situation Brief
- What the executive is currently viewing

### 11.2 DAO Chief Capabilities

All v1.3 conversational capabilities are preserved. The following are added or enhanced:

- **Situation-grounded responses:** When a situation is active, DAO Chief answers in the context of that situation, not generically.
- **Decision support:** DAO Chief can explain why a situation arose, surface the prior case, and propose options — integrating `/api/copilot` logic.
- **Pattern surfacing:** DAO Chief must be able to answer "Has this happened before?" with reference to Pattern Memory.
- **Post-decision monitoring narration:** DAO Chief must be able to explain why a decision has appeared in the Risk Radar.

### 11.3 DAO Chief Persistence

DAO Chief must persist as a layer across the entire Command Centre. It must not be confined to the Chat view. It should be accessible as a side panel or persistent input anywhere in the application.

---

## 12. ESCALATION INTELLIGENCE

### 12.1 Escalation Triggers

DAO must automatically flag for escalation when any of the following conditions are met:

| Trigger | Condition |
|---------|-----------|
| SLA breach | Action or decision required within SLA window but not actioned |
| Review overdue | Decision review date passed with no review submitted |
| Negative drift | Post-decision monitoring detects measurable worsening of KPIs |
| Repeat pattern | Same pattern type detected for the third time in a rolling period |
| No owner | Critical or High urgency situation with no owner assigned within 24 hours |
| Situation re-emergence | A resolved situation's underlying pattern re-triggers within the monitoring window |

### 12.2 Escalation Behaviour

When a trigger fires:
1. The situation or decision is elevated to Critical in the Critical Action Queue
2. The Decision Risk Radar entry is updated with the escalation signal
3. The next Executive Situation Brief includes the escalated item
4. DAO Chief is updated with the escalation context
5. The audit trail records the escalation event

---

## 13. OPTION COMPARISON — SIMULATION-READY FOUNDATION

In v1.4 DAO provides lightweight option comparison, not deep simulation. This is the foundation for later scenario modelling.

### 13.1 Option Comparison in v1.4

When an executive opens a situation or launches "Generate Options" from the brief, DAO presents:
- 3 options derived from the situation context (via `/api/copilot`)
- For each option: title, description, tradeoff, estimated impact direction
- A recommendation with confidence level
- The option taken is logged against the decision record

### 13.2 What Is Not in v1.4

Full scenario simulation, confidence-weighted outcome modelling, and cross-decision comparison are deferred to v1.5/2.x. The option comparison hooks in v1.4 are schema-ready for these additions.

---

## 14. DOMAIN OVERLAY ARCHITECTURE

DAO Core capabilities remain universal and domain-agnostic. Domain overlays plug into Core without replacing it.

### 14.1 Domain Architecture in v1.4

The current logical separation (DAO Core + Water domain) is formalised into an explicit folder and module structure in v1.4:

```
src/
  core/           ← Universal DAO capabilities
  domain/
    registry.js   ← Domain registry (renamed from domainRegistry.js)
    injector.js   ← Context injection (renamed from domainContextInjector.js)
    water/        ← Water Utilities domain module
    [future]/     ← New domain modules plug in here
```

### 14.2 Domain Capabilities per Domain Module

Each domain module provides:
- Scan overlay prompt (sector-specific pattern recognition)
- Brief overlay prompt (sector-specific brief framing)
- Situation classification hints (domain-specific urgency signals)
- Upload guidance (sector-specific recommended dataset types)

### 14.3 Domain Scope in v1.4

**In v1.4:** Water domain is the primary built domain. Generic domain covers all other sectors. The structure is formalised so new domains can be added without touching Core.

**Deferred:** Additional domain modules (Property, Healthcare, Finance, etc.) are not built in v1.4. The architecture supports them.

---

## 15. TERMINOLOGY — v1.3 TO v1.4 MAPPING

| v1.3 Name | v1.4 Name | Nature of change |
|-----------|-----------|-----------------|
| 60-Second Brief | Executive Situation Brief | Rename + architectural restructure |
| Priorities | Critical Action Queue | Rename + redesign |
| Decision Health | Decision Risk Radar | Rename + new monitoring logic |
| AI Chat / Discuss with AI | DAO Chief | Rename + context awareness expansion |
| Track | Programme Track | Renamed explicitly. Now coexists with Decision Timeline. |
| Decision Timeline | Decision Timeline | New in v1.4. Distinct from Programme Track. |
| Findings | Situations (elevated) | Findings still exist as raw scan output. Elevated findings become Situations. |
| `dal-storage.js` | `dao-storage.js` | Rename only. No logic change. |

---

## 16. SCOPE CONTROL — MANDATORY / FOUNDATION / DEFERRED

### Mandatory in v1.4

Command Centre redesign (5 zones); Executive Situation Brief; Situation Engine with first-class Situation objects; Critical Action Queue; Decision Risk Radar; Decision Timeline (distinct from Programme Track); data registration and classification; multi-file upload basket; scan routing and eligibility logic; pre-scan validation; post-decision monitoring and negative-drift detection; escalation triggers; Pattern Memory foundation with Similar Prior Case display; DAO Chief with full context awareness; option comparison hooks; BUG-01 and BUG-02 fixes; `dal-storage.js` rename; Draft Board Narrative routing fix; domain folder formalisation.

### Foundation Only in v1.4

Graph-ready linkable object schema across situations, evidence, decisions, actions, owners, outcomes, lessons, and patterns; option comparison hooks with schema placeholders for future simulation; pattern frequency and recurrence tracking.

### Deferred to v1.5 / v2.x

Full Decision Object Model analytics; graph visualisation layer; cross-decision comparison engine; confidence-weighted scenario recommendation; deep predictive simulation; cross-domain decision DNA; automated pattern clustering; predictive pattern matching at scan time; additional domain modules beyond Water.

---

## 17. ACCEPTANCE CRITERIA

DAO v1.4 passes when:

1. An executive can open the application and within 15 seconds identify the top situation, its urgency, its causal chain, the relevant prior case, and an available immediate action — without navigating away from the Command Centre.
2. Multiple datasets can be uploaded, each is classified and assigned scan eligibility, and operational and revenue scans demonstrably use different dataset sets.
3. Pre-scan validation shows exactly which files are included, excluded, and missing before the scan runs.
4. Scan results produce Situation objects, not just raw finding text.
5. The Decision Risk Radar shows only decisions under active stress, with a traceable stress signal for each entry.
6. The Decision Timeline is a distinct view from Programme Track.
7. When a situation is opened, the Similar Prior Case is visible in the panel without additional navigation.
8. Post-decision monitoring detects a negative drift signal and elevates the decision to the Risk Radar.
9. BUG-01 is resolved — Decision Health widget renders on the Dashboard.
10. BUG-02 is resolved — Copilot suggestion text is visible in the Review modal.
11. `dal-storage.js` has been renamed to `dao-storage.js`.
12. The system behaves as if it is already working when the executive arrives — the brief is available, the queue is populated, and DAO Chief is context-ready.

---

## 18. SELF-REVIEW — DOWNGRADE CHECK

The following were reviewed explicitly before finalising this specification to ensure no unintentional simplification occurred.

| Risk | Assessment |
|------|------------|
| Situation Engine reduced to a renamed finding list | **Not reduced.** Situation objects have distinct schema with causal chains, similar prior case, and immediate workflow launch. They are explicitly not raw findings. |
| Pattern Memory buried as a storage concept | **Not buried.** Pattern Memory surfaces in Brief, Situation panels, Review Queue, and DAO Chief. Visibility is a design requirement, not an afterthought. |
| Post-decision monitoring omitted | **Not omitted.** Risk Radar entry triggers and drift monitoring are specified in §8.3. The monitoring loop is explicit in the runtime loop definition. |
| DAO Chief reduced to a chat window | **Not reduced.** Context awareness across scan results, situations, decisions, domain, and brief is specified. Persistence across the full Command Centre is required. |
| Decision Timeline merged with Programme Track | **Not merged.** Both are specified as distinct objects in §9 with an explicit comparison table. |
| Cinematic overnight behaviour omitted | **Not omitted.** Scheduled scan cycle, pre-generated brief, and "system feels already working" standard are all specified in §1.2 and §5.4. |
| Option comparison over-promised as simulation | **Not overstated.** Option comparison is lightweight (3 options from `/api/copilot`). Full simulation is explicitly deferred in §16. |
| Similar Prior Case reduced to a data field | **Not reduced.** Surface rules are specified in §10.3. It must appear in four distinct locations. |

### Capabilities from Cinematic Scenarios Not Yet Fully Translated

| Scenario signal | Translation status |
|----------------|-------------------|
| Causal chain visualisation (Scenario 1: "DAO shows a visual chain") | Specified as `causal_chain` array in Situation object (§4.2). Visual rendering is part of the Situation panel design — full specification in CINEMATIC_BEHAVIOUR_ADDENDUM. |
| Decision chain reconstruction (Scenario 2: "DAO reconstructs the decision chain") | Addressed through linked situations, decision history, and Pattern Memory. Full data model in DATA_ARCHITECTURE. |
| 20-year pattern analysis (Scenario 3) | Pattern Memory foundation specified. Deep historical cross-decision analysis is deferred (v1.5). The foundation schema supports it without re-architecture. |
| Multi-source correlation (Scenario 4: pressure + pipe age + maintenance + rainfall) | Specified through multi-dataset scan architecture and the Situation Engine's `source_datasets` field. Full logic in DATA_ARCHITECTURE. |
| Cascading impact simulation (Scenario 5: 53-day delay forecast) | Option comparison hooks provide lightweight version. Full simulation is deferred. The schema is designed to support it. |
| Preventative Decision Brief (Scenario 3) | Addressed through Pattern Memory surfacing in the Executive Situation Brief. A pattern-triggered brief section is part of the Brief Generation Rules (§6). |
| Funding forecast / urgency classification (Scenario 9: Madhya) | Urgency level classification and business impact quantification are mandatory Situation fields (§4.2). Financial forecasting is not in scope for v1.4 Core. |
