# DAO v1.4 DATA ARCHITECTURE

**Document type:** Data architecture specification  
**Version:** v1.4  
**Status:** APPROVED FOR IMPLEMENTATION PLANNING  
**Date:** 16 March 2026  
**Companion documents:** DAO_v1_4_TARGET_SPEC.md, DAO_v1_4_DECISION_READY_MODEL_FOUNDATION.md  

---

## 1. PURPOSE

This document defines the complete data architecture for DAO v1.4, including:
- The dataset registration and classification model
- Scan routing and eligibility logic
- Pre-scan validation behaviour
- The Situation object schema
- The Decision object schema (enhanced from v1.3)
- The Pattern Memory schema
- The Decision Timeline data model
- Storage and persistence architecture
- The graph-ready relationship model (foundation only)

This document specifies the data model. It does not specify UI implementation or code structure. Those are in DAO_v1_4_IMPLEMENTATION_PLAN.md.

---

## 2. DATA LAYER PRINCIPLES

**Classification before computation.** Every dataset must be understood before it is used. Scan routing depends on classification. Classification happens at upload, not at scan time.

**Minimum required metadata.** Registration must be lightweight enough that uploading a file takes seconds, not minutes. The metadata captured must be the minimum needed to make classification and routing correct.

**Shared data is a first-class concept.** Some datasets are relevant to both operational and revenue scans (e.g., a contract database, a supplier register). Shared classification must be explicit, not assumed.

**Decision objects must be linkable.** Every major object in DAO v1.4 — datasets, situations, decisions, actions, outcomes, lessons, patterns — must carry a stable ID and foreign key references that allow future graph traversal. This is the graph-ready foundation.

**Local storage in v1.4, graph-ready schema from day one.** v1.4 continues to use localStorage as the persistence layer (consistent with v1.3). The schema, however, must be designed as if it will migrate to a graph database in v1.5, because it will. No structural changes should be required at migration time — only the storage backend changes.

---

## 3. DATASET REGISTRATION MODEL

### 3.1 Dataset Record Schema

When a file is uploaded to DAO, a dataset record must be created with the following fields:

```json
{
  "dataset_id": "DS-<timestamp-slug>",
  "name": "<original filename>",
  "display_name": "<user-editable label>",
  "format": "csv | excel | text | pdf",
  "uploaded_at": "<ISO timestamp>",
  "date_range_start": "<ISO date | null>",
  "date_range_end": "<ISO date | null>",
  "owner": "<string | null>",
  "source_system": "<string | null>",

  "domain": "operational | revenue | financial | compliance | shared | unclassified",
  "category": "transactions | contracts | maintenance | staff | production | procurement | customer | other",
  "structure_type": "structured | semi-structured | unstructured",

  "scan_eligibility": {
    "operational": true,
    "revenue": false,
    "domain_specific": true,
    "shared": false
  },

  "row_count": 0,
  "column_count": 0,
  "column_names": [],
  "sample_rows": [],

  "validation_warnings": [],
  "missing_required_fields": [],

  "active": true,
  "archived": false
}
```

### 3.2 Classification Dimensions

| Dimension | Options | How determined |
|-----------|---------|----------------|
| `domain` | operational, revenue, financial, compliance, shared, unclassified | User-selected at upload with AI suggestion |
| `category` | transactions, contracts, maintenance, staff, production, procurement, customer, other | User-selected with AI suggestion based on column names |
| `structure_type` | structured, semi-structured, unstructured | Auto-detected from file format and column analysis |
| `scan_eligibility` | Per scan type: true/false | Derived from domain + user override |

### 3.3 AI Classification Suggestion

When a file is uploaded, DAO must analyse the file's column names, sample rows, and filename and suggest a `domain` and `category` classification. The user can accept or override. The suggestion is not mandatory — the user always has final control.

### 3.4 Multi-File Upload Basket

The upload basket allows multiple files to be uploaded and classified in a single session before any scan is run. The basket state is:

```json
{
  "basket_id": "<session-slug>",
  "datasets": ["DS-001", "DS-002", "DS-003"],
  "basket_status": "building | ready | scanning | complete",
  "created_at": "<ISO timestamp>",
  "scan_triggered": false
}
```

The executive reviews the basket composition before triggering a scan. The pre-scan validation report is generated from the basket state.

---

## 4. SCAN ARCHITECTURE

### 4.1 Scan Record Schema

Each scan run creates a persistent scan record:

```json
{
  "scan_id": "SCN-<timestamp-slug>",
  "scan_type": "operational | revenue | domain | full",
  "triggered_by": "scheduled | on-demand | triggered",
  "triggered_at": "<ISO timestamp>",
  "completed_at": "<ISO timestamp | null>",
  "status": "pending | running | complete | failed",

  "datasets_included": ["DS-001", "DS-002"],
  "datasets_excluded": ["DS-003"],
  "exclusion_reasons": {
    "DS-003": "domain mismatch — revenue dataset excluded from operational scan"
  },
  "missing_dataset_types": ["maintenance records", "procurement log"],
  "validation_warnings": [],

  "active_domain": "water | generic | <other>",
  "domain_overlay_applied": true,

  "findings_raw": [],
  "situations_generated": ["SIT-001", "SIT-002"],
  "brief_generated": true,
  "brief_id": "BRF-001"
}
```

### 4.2 Scan Routing Logic

Scan routing is determined at scan initiation from dataset classification:

```
For Operational Scan:
  INCLUDE datasets where domain IN [operational, shared]
  EXCLUDE datasets where domain = revenue (unless also shared)
  EXCLUDE datasets where active = false OR archived = true

For Revenue Intelligence Scan:
  INCLUDE datasets where domain IN [revenue, shared]
  EXCLUDE datasets where domain = operational (unless also shared)
  EXCLUDE datasets where active = false OR archived = true

For Domain Scan (e.g., Water):
  INCLUDE datasets where scan_eligibility.domain_specific = true
  AND domain matches active domain
  AND active = true

For Full Scan:
  INCLUDE all datasets where active = true AND archived = false
```

### 4.3 Pre-Scan Validation Report

Before any scan executes, DAO must generate and display a validation report:

```json
{
  "validation_id": "VAL-<timestamp-slug>",
  "scan_type": "operational",
  "generated_at": "<ISO timestamp>",

  "included_files": [
    { "dataset_id": "DS-001", "name": "operations_log.csv", "reason": "classified as operational" }
  ],
  "excluded_files": [
    { "dataset_id": "DS-003", "name": "revenue_pipeline.xlsx", "reason": "domain mismatch" }
  ],
  "missing_required_types": [
    { "type": "maintenance records", "importance": "high", "impact": "maintenance pattern detection will be limited" }
  ],
  "warnings": [
    { "dataset_id": "DS-002", "warning": "date range is 18 months old — findings may not reflect current state" }
  ],
  "coverage_score": "partial | good | comprehensive",
  "ready_to_scan": true
}
```

The executive sees this report and must confirm before the scan runs. The confirmation is a single button press. The report is stored with the scan record.

### 4.4 Scheduled Scan Configuration

```json
{
  "schedule_id": "SCHED-001",
  "enabled": true,
  "frequency": "daily | weekly | manual-only",
  "time": "02:00",
  "timezone": "Asia/Kuala_Lumpur",
  "scan_type": "full",
  "last_run": "<ISO timestamp | null>",
  "next_run": "<ISO timestamp | null>",
  "auto_generate_brief": true
}
```

---

## 5. SITUATION OBJECT SCHEMA

Full field descriptions are in DAO_v1_4_TARGET_SPEC.md §4.2. The storage schema below adds the fields required for persistence, linking, and Pattern Memory integration.

```json
{
  "situation_id": "SIT-<timestamp-slug>",
  "title": "Plant B pump efficiency declining — production at risk within 5 days",
  "domain": "operational",
  "source_datasets": ["DS-001", "DS-002"],
  "scan_id": "SCN-001",

  "pattern_detected": "Maintenance deferral → efficiency decline → production impact",
  "causal_chain": [
    { "step": 1, "event": "Maintenance cycle delayed by 12 days" },
    { "step": 2, "event": "Pump vibration increase detected in sensor data" },
    { "step": 3, "event": "Energy consumption spike 8%" },
    { "step": 4, "event": "Production decline forecast within 5 days" }
  ],

  "urgency_level": "Critical",
  "business_impact": "Estimated production loss: RM 840,000 over 5 days if unaddressed",
  "likely_cause": "Deferred scheduled maintenance — pump seal wear",
  "recommended_action": "Schedule preventive maintenance for Plant B pump system today",
  "escalation_path": "Plant Director → Operations VP if not actioned within 4 hours",

  "similar_prior_case": {
    "pattern_id": "PAT-007",
    "title": "Plant A pump failure — Q2 2023",
    "action_taken": "Emergency maintenance scheduled within 24 hours",
    "outcome": "Production maintained — no loss recorded",
    "reusable": true
  },

  "linked_decision": null,
  "status": "Active",
  "created_at": "<ISO timestamp>",
  "updated_at": "<ISO timestamp>",
  "resolved_at": null,

  "actions_taken": [],
  "monitoring_active": false,
  "monitoring_datasets": [],
  "monitoring_kpis": []
}
```

---

## 6. DECISION OBJECT SCHEMA — v1.4 ENHANCED

The v1.3 decision record is extended with new fields for situation linkage, outcome tracking, drift monitoring, and Pattern Memory integration. All v1.3 fields are preserved.

```json
{
  "id": "DEC-<timestamp-slug>",
  "date": "<ISO date>",
  "statement": "Schedule preventive maintenance for Plant B pump system",
  "tier": "2",
  "type": "operational",
  "evidence": "<string>",
  "assumptions": "<string>",
  "confidence": "high | moderate | low",
  "expected": "<expected outcome description>",
  "owner": "<string>",
  "review_date": "<ISO date>",
  "decidedBy": "<profile name>",
  "status": "Logged | Approved | In Execution | Under Review | Outcome Emerging | Outcome Confirmed | Lesson Captured | Reopened | Archived",

  "linked_situation_id": "SIT-001",
  "linked_datasets": ["DS-001", "DS-002"],
  "linked_pattern_id": null,

  "rationale": "<AI-generated rationale>",
  "context": "<AI-generated context>",
  "challenge_flags": [],

  "actual_outcome": null,
  "outcome_deviation": null,
  "outcome_drift": "Better | Same | Worse | Not Yet Assessed",
  "reopened": false,
  "reopened_reason": null,
  "pattern_tag": null,
  "lesson": null,

  "monitoring_active": false,
  "monitoring_last_checked": null,
  "monitoring_signal": null,

  "reviews": [
    {
      "id": "REV-<timestamp-slug>",
      "reviewed_at": "<ISO timestamp>",
      "verdict": "Right | Mixed | Wrong",
      "actual_outcome": "<string>",
      "lesson": "<string>",
      "variance": "Better | Same | Worse",
      "copilotProposal": "Better",
      "copilotConfidence": "High",
      "humanFinalChoice": "Same",
      "overrideOccurred": true,
      "version": 1
    }
  ],

  "version": 1,
  "audit_trail": [
    { "event": "CREATE", "by": "<name>", "at": "<ISO timestamp>", "version": 1 }
  ]
}
```

### 6.1 New Fields in v1.4 vs v1.3

| Field | Purpose |
|-------|---------|
| `linked_situation_id` | Links decision to originating Situation object |
| `linked_datasets` | Records which datasets informed the decision |
| `linked_pattern_id` | Links to the Pattern Memory record when lesson is captured |
| `outcome_drift` | Post-decision monitoring result |
| `monitoring_active` | Whether DAO is actively monitoring this decision's linked datasets |
| `monitoring_signal` | Latest signal from post-decision monitoring |
| `reopened` | Whether this decision has been reopened after closing |
| `pattern_tag` | A reusable label for pattern classification |
| `lesson` | The institutional lesson captured at review |

---

## 7. DECISION TIMELINE RECORD

The Decision Timeline is not a separate data store — it is a rendered view of the Decision object's lifecycle fields. However, it requires a computed projection record for efficient display:

```json
{
  "timeline_entry_id": "TL-<decision_id>",
  "decision_id": "DEC-001",
  "date_logged": "<ISO date>",
  "statement": "<summary>",
  "linked_situation_id": "SIT-001",
  "owner": "<string>",
  "action_taken": "<string>",
  "review_date": "<ISO date>",
  "status": "<lifecycle stage>",
  "early_signals": "<monitoring signal text | null>",
  "drift_status": "Better | Same | Worse | Not Yet Assessed",
  "review_outcome": "<verdict | null>",
  "lesson": "<string | null>",
  "pattern_tag": "<string | null>",
  "reopened": false
}
```

---

## 8. PATTERN MEMORY SCHEMA

*Full specification in DAO_v1_4_DECISION_READY_MODEL_FOUNDATION.md. Storage schema here.*

```json
{
  "pattern_id": "PAT-<timestamp-slug>",
  "pattern_type": "maintenance-deferral | procurement-substitution | expansion-pricing | capacity-constraint | process-leak | <other>",
  "domain": "operational | revenue | financial | compliance | cross-domain",
  "first_seen": "<ISO date>",
  "last_seen": "<ISO date>",
  "occurrence_count": 3,

  "typical_trigger": "Maintenance schedule slippage beyond 10 days",
  "typical_causal_chain": ["delayed maintenance", "efficiency decline", "energy spike", "production risk"],
  "typical_business_impact_range": "RM 400,000 – RM 1,200,000",

  "historical_actions": [
    {
      "action": "Scheduled preventive maintenance within 24 hours",
      "outcome": "Better",
      "lesson": "Early intervention at vibration detection stage prevents production loss",
      "decision_id": "DEC-007"
    }
  ],

  "reuse_recommendation": "Apply preventive maintenance protocol at vibration detection stage, before energy spike",
  "reuse_confidence": "High",

  "linked_situations": ["SIT-001", "SIT-014"],
  "linked_decisions": ["DEC-007", "DEC-023"],

  "created_at": "<ISO timestamp>",
  "updated_at": "<ISO timestamp>"
}
```

---

## 9. EXECUTIVE SITUATION BRIEF RECORD

```json
{
  "brief_id": "BRF-<timestamp-slug>",
  "scan_id": "SCN-001",
  "generated_at": "<ISO timestamp>",
  "generated_by": "scheduled | on-demand",
  "active_domain": "water | generic",
  "staleness_hours": 0,

  "top_situation": {
    "situation_id": "SIT-001",
    "title": "<string>",
    "urgency_level": "Critical",
    "causal_chain_summary": "<one-line summary>",
    "business_impact": "<quantified string>",
    "prior_case_title": "<string | null>"
  },

  "risks": [
    { "text": "<risk>", "confidence": "High | Medium | Low", "evidence": "<string>" }
  ],
  "opportunities": [
    { "text": "<opportunity>", "confidence": "High | Medium | Low", "evidence": "<string>" }
  ],
  "decisions_needed": [
    { "text": "<decision statement>" }
  ],

  "situation_ids": ["SIT-001", "SIT-002", "SIT-003"],
  "all_situations_count": 3,
  "critical_count": 1,
  "high_count": 1,
  "medium_count": 1
}
```

---

## 10. GRAPH-READY RELATIONSHIP MODEL

In v1.4 all major objects carry IDs and foreign key references that form the nodes and edges of a future Decision Memory Graph. No graph database is used in v1.4 — the relationships are encoded in the object schemas above.

### 10.1 Object Nodes

| Node type | Object | Primary key |
|-----------|--------|-------------|
| Dataset | Dataset registration record | `dataset_id` |
| Scan | Scan record | `scan_id` |
| Situation | Situation object | `situation_id` |
| Decision | Decision object | `id` (DEC-) |
| Action | Action record (within situation) | `action_id` |
| Review | Review record (within decision) | `id` (REV-) |
| Pattern | Pattern Memory record | `pattern_id` |
| Brief | Brief record | `brief_id` |

### 10.2 Relationships (Graph Edges)

| From | To | Relationship | Cardinality |
|------|----|--------------|-------------|
| Scan | Dataset | `used` | Many-to-many |
| Scan | Situation | `produced` | One-to-many |
| Scan | Brief | `generated` | One-to-one |
| Situation | Decision | `prompted` | One-to-many |
| Situation | Pattern | `matches` | Many-to-many |
| Decision | Situation | `linked_to` | Many-to-one |
| Decision | Pattern | `tagged_with` | Many-to-one |
| Decision | Review | `has` | One-to-many |
| Pattern | Decision | `learned_from` | One-to-many |
| Pattern | Situation | `recurred_in` | One-to-many |

### 10.3 What This Enables Later

When v1.5 introduces a graph database backend, the migration path is:
1. Extract all localStorage records matching the schemas above
2. Create nodes from each object type using their primary keys
3. Create edges from the foreign key references already stored
4. No schema changes required — the relationships are already there

---

## 11. STORAGE ARCHITECTURE IN v1.4

### 11.1 localStorage Keys — v1.4 Extended

| Key | Contents | v1.3 / New |
|-----|----------|-----------|
| `dao-profile` | User profile | v1.3 preserved |
| `dao-journal` | Decision records (enhanced schema) | v1.3 preserved, schema extended |
| `dao-datasets-meta` | Dataset registration records | v1.3 preserved, schema extended |
| `dao-scan` | Latest operational scan record | v1.3 preserved, schema extended |
| `dao-revenue-scan` | Latest revenue scan record | v1.3 preserved, schema extended |
| `dao-situations` | All Situation objects | **New in v1.4** |
| `dao-patterns` | Pattern Memory records | **New in v1.4** |
| `dao-briefs` | Executive Situation Brief records | **New in v1.4** |
| `dao-scan-schedule` | Scheduled scan configuration | **New in v1.4** |
| `dao-validation-reports` | Pre-scan validation records | **New in v1.4** |
| `dao-timeline` | Decision Timeline projection records | **New in v1.4** |
| `dao-uploaded-summary` | Summary of uploaded data for decision health | v1.3 incomplete data path — **must be wired in v1.4** |
| `dao-chat` | Chat message history | v1.3 preserved |
| `dao-change-projects` | Programme Track projects | v1.3 preserved |
| `dao-resolved-findings` | Resolved finding IDs | v1.3 preserved |
| `dao-decision-profile` | Theory of Mind profile | v1.3 preserved |
| `dao-active-domain` | Active domain identifier | v1.3 preserved |

### 11.2 Storage Size Management

localStorage is limited to approximately 5-10MB per origin depending on browser. With the extended schema, DAO must implement:

- **Pattern Memory cap:** Store the 50 most recently updated pattern records. Archive older records to a compressed format.
- **Situation archive:** Situations older than 90 days and with status Resolved are moved to an archived state and excluded from active queries.
- **Brief retention:** Retain the last 10 brief records. Older briefs are discarded.
- **Scan retention:** Retain the last 5 scan records per scan type. Older records are discarded.

These caps are conservative. They may be relaxed in future versions when a server-side persistence layer is introduced.

---

## 12. POST-DECISION MONITORING DATA FLOW

Post-decision monitoring requires DAO to re-evaluate a dataset subset after a decision is logged and actioned.

### 12.1 Monitoring Activation

When a decision is logged and linked to a situation, and the situation has `source_datasets`, monitoring is activated:

```
decision.monitoring_active = true
decision.monitoring_datasets = situation.source_datasets
decision.monitoring_kpis = [inferred from situation.causal_chain]
```

### 12.2 Monitoring Check

On each scan cycle, for every decision where `monitoring_active = true`:

1. Re-scan the `monitoring_datasets` subset
2. Compare current KPI signals against the baseline captured at decision time
3. Classify drift: Better / Same / Worse
4. Update `decision.outcome_drift` and `decision.monitoring_signal`
5. If drift = Worse: trigger Risk Radar elevation and escalation check

### 12.3 Monitoring Termination

Monitoring terminates when:
- A review is submitted and status moves to Outcome Confirmed
- The decision is manually closed
- The linked datasets are removed from the data layer

---

## 13. DATA ARCHITECTURE CONSTRAINTS

| Constraint | Rule |
|-----------|------|
| Schema backward compatibility | All v1.3 localStorage keys and field names are preserved. v1.4 only adds fields — it never removes or renames existing fields. |
| Field naming convention | All field names use `snake_case`. No camelCase field names in new schema additions. Existing v1.3 camelCase fields are preserved as-is for compatibility. |
| ID format | All new IDs follow the `PREFIX-<timestamp-slug>` format. Prefix: DS (dataset), SCN (scan), SIT (situation), DEC (decision), REV (review), PAT (pattern), BRF (brief), TL (timeline), VAL (validation). |
| Null handling | Fields that have not yet been populated must carry explicit `null` values, not empty strings or missing keys. This enables reliable null checks in the frontend. |
| AI-generated content fields | All AI-generated text fields must be stored alongside a `generated_at` timestamp and a `model` identifier. |
