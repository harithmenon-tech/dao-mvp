/**
 * scanRouter.js
 * DAO v1.4 — Scan Routing & Pre-Scan Validation Module
 *
 * Handles scan routing logic and pre-scan validation for all scan types:
 * "operational" | "revenue" | "full" | "domain"
 *
 * All functions are self-contained — no imports required.
 */

// ---------------------------------------------------------------------------
// 1. getIncludedDatasets
// ---------------------------------------------------------------------------

/**
 * Returns the subset of registry records that should be included in a scan
 * of the given scanType.
 *
 * @param {string} scanType - "operational" | "revenue" | "full" | "domain"
 * @param {Array}  registry - Array of dataset records from datasetRegistry.js
 * @returns {Array} Matching dataset records
 */
function getIncludedDatasets(scanType, registry) {
  switch (scanType) {
    case "operational":
      return registry.filter(
        (r) => r.active === true && (r.domain === "operational" || r.domain === "shared")
      );

    case "revenue":
      return registry.filter(
        (r) => r.active === true && (r.domain === "revenue" || r.domain === "shared")
      );

    case "full":
      return registry.filter((r) => r.active === true);

    case "domain":
      return registry.filter(
        (r) =>
          r.active === true &&
          r.scan_eligibility &&
          r.scan_eligibility.domain_specific === true
      );

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 2. getExcludedDatasets
// ---------------------------------------------------------------------------

/**
 * Returns active records that are NOT included for the given scanType, each
 * augmented with an "exclusion_reason" string explaining why.
 *
 * @param {string} scanType - "operational" | "revenue" | "full" | "domain"
 * @param {Array}  registry - Array of dataset records from datasetRegistry.js
 * @returns {Array} Excluded dataset records (with exclusion_reason field)
 */
function getExcludedDatasets(scanType, registry) {
  const included = getIncludedDatasets(scanType, registry);
  const includedIds = new Set(included.map((r) => r.dataset_id));

  // Only consider active records
  const activeRecords = registry.filter((r) => r.active === true);

  return activeRecords
    .filter((r) => !includedIds.has(r.dataset_id))
    .map((r) => {
      const record = Object.assign({}, r);
      record.exclusion_reason = resolveExclusionReason(scanType, r);
      return record;
    });
}

/**
 * Derives a human-readable exclusion reason for a given record / scanType pair.
 *
 * @param {string} scanType
 * @param {Object} record
 * @returns {string}
 */
function resolveExclusionReason(scanType, record) {
  switch (scanType) {
    case "operational":
      if (record.domain === "revenue") {
        return "domain mismatch — revenue dataset excluded from operational scan";
      }
      break;

    case "revenue":
      if (record.domain === "operational") {
        return "domain mismatch — operational dataset excluded from revenue scan";
      }
      break;

    case "domain":
      // Active but domain_specific flag is falsy
      if (!record.scan_eligibility || !record.scan_eligibility.domain_specific) {
        return "unclassified — classify this dataset to include it in scans";
      }
      break;

    case "full":
      // "full" includes every active record — nothing should land here, but
      // handle defensively just in case.
      break;

    default:
      break;
  }

  // Fallback — domain is present but doesn't match a known type, or the scan
  // type couldn't determine a more specific reason.
  if (record.domain && record.domain !== "operational" && record.domain !== "revenue" && record.domain !== "shared") {
    return "unclassified — classify this dataset to include it in scans";
  }

  return "unclassified — classify this dataset to include it in scans";
}

// ---------------------------------------------------------------------------
// 3. getMissingRequiredTypes
// ---------------------------------------------------------------------------

/**
 * Returns an array of dataset type descriptors that are recommended for the
 * given scanType but absent from the registry.
 *
 * @param {string} scanType - "operational" | "revenue" | "full" | "domain"
 * @param {Array}  registry - Array of dataset records from datasetRegistry.js
 * @returns {Array<{ type: string, importance: "high"|"medium", impact: string }>}
 */
function getMissingRequiredTypes(scanType, registry) {
  const missing = [];

  // Helper: true when at least one active record has the given category
  function hasActiveCategory(category) {
    return registry.some((r) => r.active === true && r.category === category);
  }

  switch (scanType) {
    case "operational":
      if (!hasActiveCategory("maintenance")) {
        missing.push({
          type: "maintenance",
          importance: "high",
          impact: "maintenance pattern detection will be limited",
        });
      }
      if (!hasActiveCategory("production")) {
        missing.push({
          type: "production",
          importance: "medium",
          impact: "production trend analysis will be limited",
        });
      }
      break;

    case "revenue":
      if (!hasActiveCategory("transactions")) {
        missing.push({
          type: "transactions",
          importance: "high",
          impact: "revenue pattern detection will be limited",
        });
      }
      if (!hasActiveCategory("customer")) {
        missing.push({
          type: "customer",
          importance: "medium",
          impact: "customer trend analysis will be limited",
        });
      }
      break;

    // "full" and "domain" have no defined required-type rules — return empty.
    case "full":
    case "domain":
    default:
      break;
  }

  return missing;
}

// ---------------------------------------------------------------------------
// 4. buildValidationReport
// ---------------------------------------------------------------------------

/**
 * Builds a complete pre-scan validation report for the given scanType and
 * registry, combining the results of all three routing functions above.
 *
 * @param {string} scanType - "operational" | "revenue" | "full" | "domain"
 * @param {Array}  registry - Array of dataset records from datasetRegistry.js
 * @returns {Object} Validation report
 */
function buildValidationReport(scanType, registry) {
  const included = getIncludedDatasets(scanType, registry);
  const excluded = getExcludedDatasets(scanType, registry);
  const missingRequiredTypes = getMissingRequiredTypes(scanType, registry);

  return {
    scan_type: scanType,
    generated_at: new Date().toISOString(),
    included_files: included.map((r) => ({
      dataset_id: r.dataset_id,
      name: r.name,
      reason: r.domain + " dataset",
    })),
    excluded_files: excluded.map((r) => ({
      dataset_id: r.dataset_id,
      name: r.name,
      reason: r.exclusion_reason,
    })),
    missing_required_types: missingRequiredTypes,
    warnings: [],
    ready_to_scan: included.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Named exports
// ---------------------------------------------------------------------------

export {
  getIncludedDatasets,
  getExcludedDatasets,
  getMissingRequiredTypes,
  buildValidationReport,
};
