# DAO v1.4 CINEMATIC BEHAVIOUR ADDENDUM

**Document type:** Runtime behaviour and experience specification  
**Version:** v1.4  
**Status:** APPROVED FOR IMPLEMENTATION PLANNING  
**Date:** 16 March 2026  
**Source:** DAO_Cinematic_Scenarios.docx (7 scenarios + opening narrative), DAO_1_4_Blueprint_Rev3, DAO_Master_Operating_Binder_Rev3  

---

## 1. PURPOSE

This document translates the DAO Cinematic Scenarios into concrete system behaviour, UI runtime logic, and experience requirements. Every behaviour described here derives from one or more scenarios. Where a scenario implies a behaviour without fully describing it, this document makes it explicit and binding.

This is not a UI style guide. It is a specification of how DAO behaves as a system — what it does, when it does it, how it presents itself to the executive, and what the executive can do from every state.

---

## 2. THE GOVERNING EXPERIENCE PRINCIPLE

The opening narrative of the Cinematic Scenarios establishes the governing principle for all DAO v1.4 behaviour:

> *"It begins quietly while the world sleeps. Across organisations DAO works overnight. Scanning operations. Reconstructing decisions. Detecting patterns. Learning from outcomes. When executives wake up, something extraordinary has happened. For the first time, the organisations they run are already thinking."*

This is the experience DAO v1.4 must deliver. It is not a metaphor. It is a specification.

**DAO must feel already active when the executive opens it.** Not loading. Not waiting. Not asking what to do next. Already thinking.

Every behaviour in this document serves that standard.

---

## 3. SCENARIO-TO-BEHAVIOUR TRANSLATION TABLE

| Scenario | Core behaviour implied | Translated into |
|----------|----------------------|-----------------|
| S1: Operations CEO (Arjun) | Overnight scan completes before executive arrives. Chain of causation shown, not just a symptom. Two prior cases surfaced. Decision recommended and recorded. | Scheduled scan, Executive Situation Brief pre-generated, Situation with causal chain, Similar Prior Case, Decision logging from situation |
| S2: CFO (Mei Lin) | Financial variance detected. Decision chain reconstructed across three departments. Three options presented. Correction tracked over two weeks. | Situation with cross-dataset reconstruction, Option Comparison via DAO Chief, post-decision monitoring |
| S3: Founder (David) | 20-year pattern detected. Preventative Decision Brief generated. Pricing and risk adjustments recommended. | Pattern Memory, pattern-triggered brief section, Preventative Situation type |
| S4: Water CEO (Azlan) | Night flow anomaly. Multi-source correlation (pressure + pipe age + maintenance + rainfall). Impact simulation. Repair vs projected loss comparison. | Multi-dataset scan, domain-specific overlay, quantified impact in Situation, cost/benefit in option comparison |
| S5: Property Developer (Sofia) | Cascading delay detected. Alternate supplier proposed with cost increase vs delay cost comparison. | Cascading impact in causal chain, option comparison with quantified trade-off |
| S6: Hospital Director (Anika) | Root cause chain traced across departments. Two options simulated. Option B restores flow within 48 hours. | Cross-domain situation, option comparison with timeline estimate |
| S7: Boardroom | Live scan on demand. System-level insight surfaced. Company seen as a system. | On-demand full scan, Situation objects with strategic framing, board-ready summary |
| S9: Madhya (Hartini) | Case urgency classified immediately. Recommended action generated. Funding forecast updated. | Urgency classification in Situation Engine, immediate action recommendation, financial impact quantification |

---

## 4. RUNTIME BEHAVIOUR SPECIFICATION

### 4.1 The Overnight Cycle — Before the Executive Arrives

**Trigger:** Scheduled scan time passes (default: overnight).

**Behaviour sequence:**
1. DAO initiates a scan against all registered and eligible datasets.
2. Raw findings are generated per scan type (Operational, Revenue, or Full).
3. The Situation Engine elevates findings into Situation objects, each with causal chain, urgency, impact, similar prior case (if Pattern Memory has a match), and recommended action.
4. An Executive Situation Brief is generated from the scan results and stored.
5. The Critical Action Queue is populated from the situations.
6. Post-decision monitoring runs against all active decisions' linked datasets.
7. The Decision Risk Radar is updated with any new stress signals.
8. DAO Chief is updated with the new scan context.

**State when executive opens DAO:**
- Zone 1 of the Command Centre shows the pre-generated brief, not a loading spinner.
- Zone 2 shows the Critical Action Queue already populated.
- Zone 3 shows the Risk Radar with any current stress signals.
- Zone 4 shows: "Last scan: [time] — [n] situations found."
- DAO Chief, if addressed immediately, has the brief context pre-loaded and responds in seconds.

**If no scan has run in the last 24 hours:**
- Zone 1 shows a staleness prompt: "No scan in the last 24 hours. Last brief: [timestamp]. [Run Scan Now]."
- All other zones show their last-populated state with a staleness indicator.

### 4.2 First Fifteen Seconds — The Clarity Threshold

This is the standard every layout and interaction decision must be measured against. It is derived from Scenario 1 (Arjun opens DAO at 06:30, sees three critical findings and the full picture within moments) and Scenario 7 (the CSO opens DAO in the boardroom and within seconds sees two hidden insights).

**What the executive must be able to identify within 15 seconds of opening DAO, without any interaction:**
1. The top situation — what is happening right now and why it matters.
2. The urgency level and quantified business impact.
3. The causal chain — not just a symptom headline, but the sequence of events that led here.
4. Whether this has happened before (prior case visible without clicking).
5. At least one immediately available action.

**Design test:** If any of these five things requires the executive to navigate to a different view, the Command Centre has failed the 15-second standard.

### 4.3 Causal Chain Display

Scenario 1 specifies: *"DAO shows a visual chain: Maintenance cycle delayed → Pump vibration increase → Energy consumption spike → Production decline forecast within 5 days."*

**Behaviour:**
- The Situation panel must render the causal chain as a sequential visual flow, not as a block of text.
- Each step in the chain must show: event description, and where available, the data evidence (e.g., "vibration reading: +12% above baseline").
- The chain must be visible within the Situation panel — not behind an expand/collapse toggle.
- The chain length should be 3–6 steps. Longer chains should be summarised with an expand option.

**Data source:** `situation.causal_chain[]` array (see DATA_ARCHITECTURE §5).

### 4.4 Similar Prior Case — Surfacing Behaviour

Scenario 1 specifies: *"DAO overlays historical plant incidents. Two similar events occurred in the past. One decision prevented production loss. One decision came too late."*

Scenario 3 specifies: *"DAO has been analysing twenty years of company decisions. DAO reveals a pattern across four previous expansions."*

**Behaviour:**
- When a Situation is displayed, the Similar Prior Case section must be visible within the Situation panel, not behind navigation.
- The prior case must show: what the pattern was, what action was taken, what the outcome was, and whether that action is recommended now.
- If more than one prior case exists, show the most recent by default. Provide an expand option to see all matches.
- If no prior case exists, show: "No prior case found for this pattern."
- The absence of a prior case is itself information — it means this is new territory for the organisation.

**Data source:** `situation.similar_prior_case` object (see DATA_ARCHITECTURE §5, Pattern Memory §PAT-).

### 4.5 Option Comparison — Presentation Behaviour

Scenario 2 specifies: *"DAO suggests three options. Option 1 — Return to previous supplier. Option 2 — Adjust dosing protocols. Option 3 — Renegotiate supplier formula."*

Scenario 4 specifies: *"DAO simulates the impact. Repair cost today: $12,000. Projected water loss in 12 months: $1.1M."*

Scenario 5 specifies: *"DAO proposes switching to alternate supplier B. Cost increase: $80k. Delay avoided: $4.2M."*

**Behaviour:**
- Option comparison must be triggered from a Situation panel or from the Executive Situation Brief.
- Each option must show: title (max 8 words), description (2 sentences), tradeoff (1 sentence on constraint or cost).
- Where quantified impact is available, it must appear in the option card — not just in the description text.
- A recommendation with confidence level must appear below the options.
- The executive selects an option. That selection is logged as the basis for the decision record.
- Option comparison is powered by `/api/copilot` with situation context injected.

### 4.6 Decision Chain Reconstruction — Behaviour

Scenario 2 specifies: *"DAO reconstructs the decision chain. Three months earlier: Procurement approved a new supplier. Quality approved the chemical formula. Operations adjusted dosing procedures."*

**Behaviour:**
- When a decision is reviewed in the Decision Risk Radar or Review Queue, DAO must surface the linked situation and its causal chain.
- If the decision has a `linked_situation_id`, the situation's causal chain is shown alongside the review form.
- The review question is: given what we now know happened, was the decision right, mixed, or wrong — and what was the actual outcome vs expected?
- The Copilot Variance block shows the AI assessment of the outcome before the human submits their verdict.

### 4.7 Pattern-Triggered Preventative Brief — Behaviour

Scenario 3 specifies: *"DAO generates a Preventative Decision Brief. Recommended adjustments: Minimum pricing threshold. Supplier risk buffers. Contract review checkpoints."*

**Behaviour:**
- When Pattern Memory detects a pattern that has historically produced negative outcomes, it must surface a Preventative Situation in the next scan cycle.
- A Preventative Situation has urgency level Watch or High and a recommended action framed as preventative ("Before beginning X, consider Y based on the pattern seen in previous expansions").
- The Executive Situation Brief must include a "Pattern Warning" section when a Preventative Situation is active.
- DAO Chief must be able to generate an expanded Preventative Brief on request, incorporating the specific pattern history and recommended adjustments.

### 4.8 Post-Decision Monitoring — Observable Behaviour

Scenarios 2 and 5 show decisions being tracked after the fact, with outcomes confirmed or rejected.

**Behaviour:**
- After a decision is logged and actioned, the Decision Timeline entry shows status: "Monitoring."
- The Risk Radar entry for a monitored decision shows: "Under monitoring — checking [dataset name]."
- When monitoring detects drift (Worse), the Risk Radar entry changes to: "Signal detected — [one-line description of the drift] — [Review Now]."
- The executive sees this in Zone 3 on their next session without having to look for it.

### 4.9 Board-Ready State — Behaviour

Scenario 7 specifies: *"The Chief Strategy Officer opens DAO. DAO performs a live organisational scan. Within seconds it reveals two insights. Hidden supplier dependency. Regional pricing inconsistency costing $14M."*

**Behaviour:**
- The Executive Situation Brief must be readable as a board-ready summary without modification.
- The Board Report PDF export must include the top situations, their causal chains, the options considered, the decisions logged, and the outcomes tracked.
- From any Situation panel, the executive must be able to trigger "Draft Board Narrative" to generate board-language framing of the situation.
- DAO Chief must be able to produce a board-ready summary of any situation on request.

### 4.10 Urgency Classification — Observable Behaviour

Scenario 9 specifies: *"DAO processes the case instantly. Eligibility verified. Urgency assessed. Treatment cost estimated. Priority: RED."*

**Behaviour:**
- Every Situation object must display its urgency level prominently and in a colour-coded format: Critical (red), High (amber), Medium (blue), Watch (grey).
- Urgency must be visible in the Situation title in the Critical Action Queue and the Executive Situation Brief — not just inside the Situation panel.
- The business impact (quantified cost) must appear adjacent to the urgency level wherever the situation is displayed.

---

## 5. DAO CHIEF — CINEMATIC INTERACTION BEHAVIOUR

### 5.1 DAO Chief is Not a Chatbot

The scenarios show DAO as an intelligence partner, not a query-answering assistant. Arjun does not ask DAO what happened — DAO tells him before he asks. Mei Lin does not request a variance analysis — DAO surfaces the pattern and the chain before she questions it.

**DAO Chief must lead, not wait.**

In practice, this means:
- When an executive opens a Situation panel, DAO Chief must offer a context-aware opening statement, not wait for a question.
- When the executive enters the Decision Review flow, DAO Chief must surface the prior case and the variance assessment before being asked.
- When the executive opens the Command Centre after a completed scan, DAO Chief must be ready with the brief context already loaded.

### 5.2 DAO Chief Opening Statements by Context

| Executive is viewing | DAO Chief opening statement type |
|---------------------|----------------------------------|
| Command Centre — first load after scan | "Here is what happened overnight. [Top situation summary]. [Prior case reference if applicable]. What would you like to do first?" |
| Command Centre — no recent scan | "No scan has run in the last 24 hours. The last brief is from [timestamp]. Would you like to run a scan now?" |
| Situation panel | "This [urgency] situation has been developing since [earliest signal]. [Prior case if applicable]. The recommended action is [action]. Shall I generate options?" |
| Decision Review modal | "This decision was made on [date] in response to [situation]. Based on current data, the outcome appears [variance]. Copilot assessed: [variance + confidence]. Your verdict?" |
| Risk Radar | "This decision entered the Risk Radar because [stress signal]. The original situation was [title]. [Prior case comparison if relevant]." |
| Decision Timeline | "Here is the full history of this decision. [Logged → current state]. The pattern tag is [tag if applied]. Would you like to capture a lesson?" |

### 5.3 DAO Chief Persona Preservation

The IDENTITY_PROMPT from v1.3 is preserved in full. DAO Chief remains:
- A seasoned operator with P&L experience
- Direct, not neutral
- Evidence-based, not speculative
- Willing to say when the problem is leadership
- Willing to say when governance is performative

The persona must not be softened to accommodate the expanded context awareness. Context awareness makes DAO Chief more targeted. The directness is what makes it valuable.

---

## 6. SCAN EXPERIENCE — CINEMATIC BEHAVIOUR

### 6.1 Scan in Progress — What the Executive Sees

When a scan is triggered (on-demand):

```
[Scan status indicator in Zone 4]
"Scanning [n] sources..."
[Progress: Datasets read → Findings generated → Situations elevated → Brief compiled]
[Estimated time: ~30s]
```

- The executive does not need to wait on the scan view. They can continue working.
- When the scan completes, Zone 1 updates with the new brief and Zone 2 updates with any new actions.
- A non-intrusive notification appears: "Scan complete — [n] situations found. [View Brief]."

### 6.2 Scan Complete — What Changes

After scan completion:
- Zone 1: Updated Executive Situation Brief
- Zone 2: Critical Action Queue refreshed
- Zone 3: Risk Radar refreshed (new drift signals if any)
- Zone 4: "Last scan: [just now] — [n] situations — [scan type] — [domain active]"
- DAO Chief: Updated context, ready to brief

### 6.3 No Data State — Behaviour

If the executive opens DAO and no data has been uploaded:
- Zone 1: "No data connected. Upload operational data to begin your first scan." [Upload Data →]
- Zone 2: Empty, with prompt: "Your action queue will populate after your first scan."
- Zone 3: Empty, with prompt: "Decisions at risk will appear here once decisions are logged."
- DAO Chief: "Welcome. To get started, upload your organisation's operational data. I can analyse it and surface what matters."

The empty state must not feel broken or passive. It must feel like a system waiting for data, not a system that has failed to load.

---

## 7. BEHAVIOUR CONSISTENCY RULES

### 7.1 Every Panel Must Lead Somewhere

Every information panel in DAO must lead to at least one immediate action. If a panel shows a number, a status, or a summary, it must also show what the executive should do about it. Panels that only display data without consequence must be redesigned or removed.

### 7.2 Urgency Must Be Visible Without Clicking

Urgency levels (Critical, High, Medium, Watch) must be visible in every list view, queue, and radar without the executive opening an individual item. Colour-coding and explicit labels are both required — colour alone is insufficient.

### 7.3 Quantification Must Be Attempted

Wherever DAO generates a situation, an option, or a recommendation, it must attempt to quantify the impact in currency, time, or units. "Significant cost increase" is not acceptable where data allows a specific figure. "Estimated RM 800,000" is the expected output standard.

### 7.4 DAO Must Not Ask the Executive to Repeat Context

If the executive has just reviewed a situation and then opens DAO Chief, DAO Chief must already know the situation context. The executive must not re-explain what they just read. Context handoff between views is a system responsibility, not a user responsibility.

### 7.5 Actions Must Be Reachable in One Step

From any primary view (Command Centre, Situation panel, Review modal, Risk Radar), the executive must be able to take the next meaningful action in one step — one button press or one message to DAO Chief. Actions that require two or more navigation steps to reach are out of the cinematic standard.

---

## 8. BEHAVIOUR GAPS FROM CINEMATIC SCENARIOS — EXPLICITLY ADDRESSED

These are behaviours implied by the scenarios that could be missed in a surface-level implementation pass. They are called out here to prevent under-delivery.

| Risk | Scenario source | How it must be addressed |
|------|----------------|--------------------------|
| Causal chain shown as a text block instead of a visual sequence | S1: "DAO shows a visual chain" | The `causal_chain[]` array must be rendered as a sequential visual flow, not a paragraph. Step arrows or a timeline format. Not collapsible by default. |
| Similar Prior Case shown only in the detail view | S1: "DAO overlays historical plant incidents" | Prior case summary must be visible in the Situation panel header — not only in an expanded detail section. |
| Option comparison buried in DAO Chief chat | S2, S4, S5: DAO presents options proactively | Option comparison must be a first-class UI surface triggered from the Situation panel, not only from a chat conversation. |
| Post-decision monitoring invisible until queried | S2: "Within two weeks chemical usage returns to normal. DAO tracks the correction." | The Decision Timeline and Risk Radar must both reflect monitoring state. The executive must not need to query DAO Chief to know that monitoring is active and what it found. |
| Pattern Memory only accessible via search | S3: "DAO has been analysing twenty years of decisions. DAO reveals a pattern." | Pattern recognition must fire proactively during scan. The executive must not initiate a pattern lookup — DAO surfaces the pattern when it detects one. |
| Board narrative is a manual export step | S7: "Within seconds it reveals two insights" | The Executive Situation Brief must be board-ready by default. Board Narrative generation must be available from the Situation panel in one step — not only as a post-scan export. |
| Urgency classification feels like a status badge | S9: "Priority: RED. Recommended action: Immediate referral." | Urgency must drive the queue order and the brief position. A Critical situation must appear at the top of Zone 2 regardless of recency. The recommended action must be shown alongside the urgency level. |
| DAO Chief responds generically to first question | Opening narrative: "DAO is already thinking" | DAO Chief's first response after a scan must be proactive — it opens with the brief, not with "How can I help?" |
