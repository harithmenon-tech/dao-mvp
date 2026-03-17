const LS_JOURNAL = "dao-journal";
const LS_AUDIT = "dao-audit-log";

function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function upgradedDecision(entry) {
  return {
    ...entry,
    tier: entry.tier ?? 1,
    owner: entry.owner ?? "",
    review_date: entry.review_date ?? "",
    expected_outcome: entry.expected_outcome ?? entry.expected ?? "",
    status: entry.status ?? "Draft",
    version: entry.version ?? 1,
    reviews: entry.reviews ?? [],
  };
}

export function validateDecision(entry) {
  const errors = [];
  if (entry.tier >= 2) {
    if (!entry.owner?.trim()) errors.push("Owner required for Tier 2+");
    if (!entry.review_date?.trim()) errors.push("Review date required for Tier 2+");
    if (!entry.expected_outcome?.trim()) errors.push("Expected outcome required for Tier 2+");
  }
  return { valid: errors.length === 0, errors };
}

export function bumpVersion(entry) {
  return { ...entry, version: (entry.version ?? 1) + 1 };
}

export function logAudit(actor, entityId, action, version) {
  const existing = lsGet(LS_AUDIT) ?? [];
  existing.push({ ts: new Date().toISOString(), actor, entityId, action, version });
  lsSet(LS_AUDIT, existing);
}

export function saveJournal(array) {
  lsSet(LS_JOURNAL, array);
}
