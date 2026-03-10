// Domain Registry — DAO v1.2
// Add new domains here as they are built.
// Each domain must implement the module contract defined in water.module.js
const domainRegistry = {
  water: {
    id: 'water',
    label: 'Water Utilities',
    description: 'Municipal and industrial water utility operations',
    modulePath: './water/water.module.js',
    active: true,
  },
  generic: {
    id: 'generic',
    label: 'General',
    description: 'Generic cross-industry mode — no domain overlays applied',
    modulePath: null,
    active: true,
  },
};
export default domainRegistry;
