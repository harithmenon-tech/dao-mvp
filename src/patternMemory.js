// ═══════════════════════════════════════════════════════════════
// PATTERN MEMORY — detects recurring decision patterns
// ═══════════════════════════════════════════════════════════════

/**
 * Detects patterns in a decisions array by grouping on
 * lifecycleStatus × tier × type. Groups with ≥2 entries become patterns.
 * @param {Array} decisions  — array of decision objects from the journal
 * @returns {Array}          — pattern objects sorted by count descending
 */
export function detectPatterns(decisions) {
  if (!decisions || decisions.length === 0) return [];

  // Build groups keyed by "lifecycleStatus__tier__type"
  const groups = {};
  decisions.forEach(d => {
    const key = [
      d.lifecycleStatus || 'Unknown',
      d.tier || 'Unknown',
      d.type || 'Unknown'
    ].join('__');
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  });

  const patterns = [];

  Object.entries(groups).forEach(([key, decs]) => {
    if (decs.length < 2) return;

    const [lifecycleStatus, tier, type] = key.split('__');

    // Most-recent date
    const sorted = [...decs].sort((a, b) => {
      const da = a.date || '';
      const db = b.date || '';
      return db.localeCompare(da);
    });
    const lastSeen = sorted[0].date
      ? (sorted[0].date.includes('T')
          ? sorted[0].date
          : new Date(sorted[0].date).toISOString())
      : new Date().toISOString();

    // Unique tags across the group
    const allTags = [];
    decs.forEach(d => {
      if (Array.isArray(d.tags)) {
        d.tags.forEach(t => {
          if (t && !allTags.includes(t)) allTags.push(t);
        });
      }
    });

    // Average confidence score (rounded to 1 d.p.)
    const scores = decs
      .map(d => Number(d.confidenceScore))
      .filter(s => !isNaN(s) && s > 0);
    const avgConfidence =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : 0;

    const label = `${decs.length}x Tier ${tier} ${type} decisions`;
    const id = key.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    patterns.push({
      id,
      label,
      count: decs.length,
      lastSeen,
      tags: allTags,
      avgConfidence,
      decisions: decs.map(d => d.id)
    });
  });

  return patterns.sort((a, b) => b.count - a.count);
}

/**
 * Saves patterns array to localStorage key "dao-patterns".
 * @param {Array} patterns
 */
export function savePatterns(patterns) {
  try {
    localStorage.setItem('dao-patterns', JSON.stringify(patterns));
  } catch (e) {
    console.error('savePatterns error:', e);
  }
}

/**
 * Loads patterns from localStorage key "dao-patterns".
 * @returns {Array}  — parsed array, or [] if nothing saved
 */
export function loadPatterns() {
  try {
    const raw = localStorage.getItem('dao-patterns');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Returns patterns that match the new decision on tier AND type.
 * @param {Object} newDecision   — decision object (not yet saved)
 * @param {Array}  patterns      — existing patterns array
 * @returns {Array}              — matching patterns (may be empty)
 */
export function findMatchingPatterns(newDecision, patterns) {
  if (!newDecision || !patterns || patterns.length === 0) return [];
  return patterns.filter(p => {
    const tierMatch = p.label.includes(`Tier ${newDecision.tier}`);
    const typeMatch = p.label.toLowerCase().includes(
      (newDecision.type || '').toLowerCase()
    );
    return tierMatch && typeMatch;
  });
}
