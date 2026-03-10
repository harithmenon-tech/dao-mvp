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
    { id: 'nrw_critical', kpi: 'nrw', condition: 'above', value: 30, severity: 'critical', finding: 'Non-revenue water exceeds 30% — immediate leakage audit required' },
    { id: 'nrw_warning', kpi: 'nrw', condition: 'above', value: 20, severity: 'warning', finding: 'Non-revenue water above target — schedule pipe condition assessment' },
    { id: 'collection_critical', kpi: 'bill_collection', condition: 'below', value: 75, severity: 'critical', finding: 'Bill collection below 75% — cash flow at risk, escalate recovery programme' },
    { id: 'quality_critical', kpi: 'water_quality', condition: 'below', value: 90, severity: 'critical', finding: 'Water quality compliance below 90% — regulatory breach risk, immediate action required' },
    { id: 'interruption_warning', kpi: 'interruption_hours', condition: 'above', value: 6, severity: 'warning', finding: 'Service interruptions exceeding 6 hrs/month — ratepayer satisfaction at risk' },
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
