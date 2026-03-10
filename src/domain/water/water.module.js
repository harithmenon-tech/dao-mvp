// Water Domain Module — DAO v1.2
// Implements the 4-layer domain module contract.
// Phase 3 will populate terminology, kpis, thresholds, and prompts.
// Phase 4 will wire this module into the UI integration points.
const waterModule = {
  // Layer 1: Terminology — domain-specific language substitutions
  terminology: [],
  // Layer 2: KPIs — key performance indicators for this domain
  kpis: [],
  // Layer 3: Thresholds — rules that trigger findings or alerts
  thresholds: [],
  // Layer 4: Prompts — overlay instructions injected into AI context
  prompts: {
    scanOverlay: '',
    briefOverlay: '',
  },
};
export default waterModule;
