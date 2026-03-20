// Water Domain Module — DAO v1.2
// Implements the 4-layer domain module contract.
// Phase 3 will populate terminology, kpis, thresholds, and prompts.
// Phase 4 will wire this module into the UI integration points.
const waterModule = {
  // Layer 1: Terminology — domain-specific language substitutions
  terminology: [
    { generic: 'revenue', domain: 'water sales & tariff income' },
    { generic: 'customer', domain: 'ratepayer' },
    { generic: 'customers', domain: 'ratepayers' },
    { generic: 'product', domain: 'water service' },
    { generic: 'products', domain: 'water services' },
    { generic: 'sales pipeline', domain: 'connection pipeline' },
    { generic: 'churn', domain: 'disconnection rate' },
    { generic: 'market share', domain: 'coverage ratio' },
    { generic: 'inventory', domain: 'chemical stock' },
    { generic: 'supplier', domain: 'bulk water provider' },
    { generic: 'suppliers', domain: 'bulk water providers' },
    { generic: 'cost of goods', domain: 'bulk water cost' },
    { generic: 'gross margin', domain: 'operational surplus' },
    { generic: 'headcount', domain: 'field workforce' },
    { generic: 'office', domain: 'operations centre' },
    { generic: 'downtime', domain: 'service interruption' },
    { generic: 'SLA', domain: 'service standard' },
    { generic: 'ticket', domain: 'fault report' },
    { generic: 'tickets', domain: 'fault reports' },
    { generic: 'KPI', domain: 'performance standard' },
  ],
  // Layer 2: KPIs — key performance indicators for this domain
  kpis: [
    { id: 'nrw', label: 'Non-Revenue Water', unit: '%', target: 15, warningAt: 20, criticalAt: 30 },
    { id: 'water_quality', label: 'Water Quality Compliance', unit: '%', target: 99, warningAt: 95, criticalAt: 90 },
    { id: 'service_coverage', label: 'Service Coverage', unit: '%', target: 95, warningAt: 90, criticalAt: 85 },
    { id: 'bill_collection', label: 'Bill Collection Rate', unit: '%', target: 95, warningAt: 85, criticalAt: 75 },
    { id: 'capex_utilisation', label: 'Capex Utilisation', unit: '%', target: 90, warningAt: 75, criticalAt: 60 },
    { id: 'interruption_hours', label: 'Avg Service Interruption', unit: 'hrs/month', target: 2, warningAt: 6, criticalAt: 12 },
    { id: 'opex_ratio', label: 'Opex to Revenue Ratio', unit: '%', target: 60, warningAt: 75, criticalAt: 85 },
  ],
  // Layer 3: Thresholds — rules that trigger findings or alerts
  thresholds: [
    {
      id: 'nrw_critical',
      kpi: 'nrw',
      condition: 'above',
      value: 30,
      severity: 'critical',
      finding: 'Non-revenue water exceeds 30% — immediate leakage audit required',
      title: 'NRW at Critical Threshold — Active Leakage Crisis',
      explanation: 'Non-revenue water has breached 30%, confirming systemic distribution loss beyond normal operational variance. At this level, physical losses — burst mains, joint failures, and illegal connections — are the primary driver, not billing errors.',
      implication: 'Every percentage point above 30% NRW represents treated water produced at full operating cost and sold at zero revenue. At scale, this erodes the operational surplus needed to fund capital renewal, compounding asset deterioration year on year.',
      recommendedAction: 'Commission an emergency district metered area (DMA) audit within 7 days. Isolate the three highest-loss zones by overnight minimum flow analysis and deploy acoustic leak detection before the next billing cycle.',
    },
    {
      id: 'nrw_warning',
      kpi: 'nrw',
      condition: 'above',
      value: 20,
      severity: 'warning',
      finding: 'Non-revenue water above target — schedule pipe condition assessment',
      title: 'NRW Above Performance Target — Pipeline Condition Deteriorating',
      explanation: 'Non-revenue water has exceeded the 20% performance target, indicating losses are outpacing the controlled threshold. The gap between produced and billed volumes is widening, pointing to ageing infrastructure or expanding illegal connection activity.',
      implication: 'Unchecked NRW at this level will breach the 30% critical threshold within one to two asset cycles if pipe condition assessment and targeted replacement are deferred. SPAN audit exposure increases proportionally with each reporting period above target.',
      recommendedAction: 'Schedule a pipe condition assessment of the highest-flow distribution mains within 30 days. Prioritise zones showing year-on-year NRW increase and submit a remediation plan to the operations director before the next SPAN reporting period.',
    },
    {
      id: 'collection_critical',
      kpi: 'bill_collection',
      condition: 'below',
      value: 75,
      severity: 'critical',
      finding: 'Bill collection below 75% — cash flow at risk, escalate recovery programme',
      title: 'Bill Collection in Freefall — Cash Position Unsustainable',
      explanation: 'Fewer than three in four billed ratepayers are paying within cycle. At sub-75% collection, arrears are accumulating faster than the recovery programme can clear them, indicating structural failure in the billing-to-payment process — not a temporary spike.',
      implication: 'Operating expenditure is funded on cash flow, not accruals. A collection rate below 75% creates a shortfall that forces drawdown on capital reserves or delays contractor payments, both of which accelerate asset deterioration and increase default risk.',
      recommendedAction: 'Escalate to the CEO and CFO today. Segment arrears by age-of-debt, geographic zone, and account type. Activate disconnection notices for accounts 60+ days overdue and appoint a dedicated debt recovery lead with a 30-day KPI target of returning collection above 85%.',
    },
    {
      id: 'quality_critical',
      kpi: 'water_quality',
      condition: 'below',
      value: 90,
      severity: 'critical',
      finding: 'Water quality compliance below 90% — regulatory breach risk, immediate action required',
      title: 'Water Quality Compliance Breach — Regulatory Enforcement Risk',
      explanation: 'Compliance against required water quality parameters has fallen below 90%, indicating that one in ten samples or treatment outputs is failing to meet the legal standard. This is a sustained failure of treatment or distribution integrity, not a marginal miss.',
      implication: 'A compliance rate below 90% triggers mandatory notification to SPAN and exposes the utility to formal enforcement action, including operating licence conditions, financial penalties, and in severe cases, public health emergency protocols. Reputational damage from public disclosure is immediate and lasting.',
      recommendedAction: 'Notify SPAN within 24 hours per regulatory obligation. Identify the failing parameters and trace the breach to its source — treatment plant, storage reservoir, or distribution network. Implement corrective treatment dosing or emergency flushing immediately and submit a written remediation schedule to the regulator within 72 hours.',
    },
    {
      id: 'interruption_warning',
      kpi: 'interruption_hours',
      condition: 'above',
      value: 6,
      severity: 'warning',
      finding: 'Service interruptions exceeding 6 hrs/month — ratepayer satisfaction at risk',
      title: 'Service Interruption Hours Above Threshold — Ratepayer Trust Eroding',
      explanation: 'Average monthly service interruption duration has exceeded 6 hours, breaching the operational performance standard. This reflects recurring unplanned outages — burst response, valve failures, or pressure zone instability — rather than planned maintenance windows.',
      implication: 'Sustained interruptions above 6 hours per month erode ratepayer confidence, drive formal complaint volumes, and attract SPAN performance review. Utilities with chronic interruption rates above threshold face tariff revision pressure and capital injection mandates, both of which directly impair financial headroom.',
      recommendedAction: 'Conduct a root cause analysis of all unplanned outages in the last 90 days. Classify by cause — infrastructure failure, operational error, or third-party impact. Present the top three recurring causes and a costed mitigation plan to the operations board within 14 days.',
    },
  ],
  // Layer 4: Prompts — overlay instructions injected into AI context
  prompts: {
    scanOverlay: `You are analysing operational data for a water utility company.
Apply water utility industry expertise to your analysis.
Key focus areas:
- Non-revenue water (NRW): flag anything above 15% as concerning, above 30% as critical
- Water quality compliance: any reading below 99% requires attention, below 90% is critical
- Bill collection rate: below 85% signals cash flow risk
- Service interruptions: more than 6 hours per month average is a warning sign
- Capex utilisation: below 75% suggests delivery capability issues
- Regulatory compliance: SPAN (Suruhanjaya Perkhidmatan Air Negara) standards apply for Malaysian operators
Use ratepayer instead of customer, fault report instead of ticket, service interruption instead of downtime.
Identify patterns that a water utility CEO or operations director would act on immediately.`,
    briefOverlay: `You are briefing the CEO of a water utility company.
Frame all findings in water utility operational context.
Priorities for a water utility executive:
- Regulatory compliance with SPAN and Ministry of Environment standards
- Non-revenue water reduction as the primary efficiency lever
- Ratepayer satisfaction and service continuity
- Capital programme delivery and asset lifecycle management
- Bulk water purchase cost optimisation
Use precise operational language: NRW, CAPEX, OPEX, ratepayer, service coverage ratio.
Lead with what requires a decision today, then what requires monitoring.`,
  },
};
export default waterModule;
