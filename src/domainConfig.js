export const DOMAINS = {
  general: {
    id: 'general',
    label: 'General',
    sector: 'General',
    focusAreas: ['Operations', 'Finance', 'People', 'Strategy'],
    scanWeights: { revenue: 1, operational: 1, risk: 1 },
    escalationThreshold: 2,
    chiefPersona: 'a strategic business advisor'
  },
  property: {
    id: 'property',
    label: 'Property & Real Estate',
    sector: 'Property',
    focusAreas: ['Development', 'Asset Management', 'Capital', 'Regulatory'],
    scanWeights: { revenue: 1.2, operational: 0.8, risk: 1.5 },
    escalationThreshold: 1,
    chiefPersona: 'a property development and investment advisor'
  },
  franchise: {
    id: 'franchise',
    label: 'Franchise Operations',
    sector: 'Franchise',
    focusAreas: ['Franchisee Performance', 'Brand Compliance', 'Expansion', 'Support'],
    scanWeights: { revenue: 1.3, operational: 1.4, risk: 1.0 },
    escalationThreshold: 2,
    chiefPersona: 'a franchise operations and growth advisor'
  },
  biotech: {
    id: 'biotech',
    label: 'Biotech & Life Sciences',
    sector: 'Biotech',
    focusAreas: ['R&D Pipeline', 'Regulatory', 'Commercialisation', 'IP'],
    scanWeights: { revenue: 0.8, operational: 1.0, risk: 2.0 },
    escalationThreshold: 1,
    chiefPersona: 'a biotech strategy and commercialisation advisor'
  }
};

export function getDomain(id) {
  return DOMAINS[id] || DOMAINS.general;
}

export const DEFAULT_DOMAIN = 'general';
