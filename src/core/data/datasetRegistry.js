// datasetRegistry.js
// Dataset registration and classification module for DAO v1.4
// Branch: dao-v1.4-dev

/**
 * Derives the format string from a filename extension.
 * @param {string} filename
 * @returns {"csv"|"excel"|"text"}
 */
function _deriveFormat(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'excel';
  return 'text';
}

/**
 * Derives the structure type from a format string.
 * @param {"csv"|"excel"|"text"} format
 * @returns {"structured"|"unstructured"}
 */
function _deriveStructureType(format) {
  if (format === 'csv' || format === 'excel') return 'structured';
  return 'unstructured';
}

/**
 * Creates a dataset registration object.
 * @param {File} file - The uploaded file object.
 * @param {Object} parsedData - Parsed data containing rowCount/totalRows, headers, rows.
 * @returns {Object} The dataset record.
 */
function createDatasetRecord(file, parsedData) {
  const format = _deriveFormat(file.name);
  const structureType = _deriveStructureType(format);

  const record = {
    dataset_id: 'DS-' + Date.now().toString(36).toUpperCase(),
    name: file.name,
    display_name: file.name,
    format: format,
    uploaded_at: new Date().toISOString(),
    date_range_start: null,
    date_range_end: null,
    owner: null,
    source_system: null,
    domain: 'unclassified',
    category: 'other',
    structure_type: structureType,
    scan_eligibility: {
      operational: true,
      revenue: false,
      domain_specific: false,
      shared: false,
    },
    row_count: parsedData.rowCount || parsedData.totalRows || 0,
    column_count: parsedData.headers ? parsedData.headers.length : 0,
    column_names: parsedData.headers || [],
    sample_rows: parsedData.rows ? parsedData.rows.slice(0, 3) : [],
    validation_warnings: [],
    missing_required_fields: [],
    active: true,
    archived: false,
  };

  return record;
}

/**
 * Suggests a domain classification for a dataset record using rule-based logic.
 * @param {Object} record - A dataset record created by createDatasetRecord.
 * @returns {"revenue"|"operational"|"compliance"|"unclassified"}
 */
function classifySuggestDomain(record) {
  const sharedKeywords   = ['billing', 'tariff'];
  const revenueKeywords = ['revenue', 'sales', 'price', 'invoice', 'payment', 'charges', 'receivable', 'arrears', 'collection'];
  const operationalKeywords = ['maintenance', 'operations', 'incident', 'fault', 'downtime', 'reading', 'turbidity', 'treatment', 'pressure', 'leakage', 'nrw', 'interruption', 'consumption', 'reservoir', 'pump'];
  const complianceKeywords = ['contract', 'compliance', 'audit'];

  const nameLower = (record.name || '').toLowerCase();
  const columnTokens = (record.column_names || []).map(function (col) {
    return col.toLowerCase();
  });
  const allTokens = [nameLower].concat(columnTokens);

  function anyMatch(keywords) {
    return keywords.some(function (kw) {
      return allTokens.some(function (token) {
        return token.includes(kw);
      });
    });
  }

  if (anyMatch(sharedKeywords))  return 'shared';
  if (anyMatch(revenueKeywords)) return 'revenue';
  if (anyMatch(operationalKeywords)) return 'operational';
  if (anyMatch(complianceKeywords)) return 'compliance';
  return 'unclassified';
}

/**
 * Returns datasets from the registry that are eligible for a given scan type.
 * @param {"operational"|"revenue"|"full"} scanType
 * @param {Object[]} registry - Array of dataset records.
 * @returns {Object[]} Filtered array of eligible dataset records.
 */
function getEligibleDatasets(scanType, registry) {
  if (scanType === 'operational') {
    return registry.filter(function (record) {
      return record.active === true &&
        (record.domain === 'operational' || record.domain === 'shared');
    });
  }

  if (scanType === 'revenue') {
    return registry.filter(function (record) {
      return record.active === true &&
        (record.domain === 'revenue' || record.domain === 'shared');
    });
  }

  if (scanType === 'full') {
    return registry.filter(function (record) {
      return record.active === true;
    });
  }

  return [];
}

/**
 * Saves the dataset registry array to localStorage.
 * @param {Object[]} records - Array of dataset records.
 * @returns {void}
 */
function saveDatasetRegistry(records) {
  localStorage.setItem('dao-datasets-registry', JSON.stringify(records));
}

/**
 * Loads the dataset registry array from localStorage.
 * @returns {Object[]} Parsed array of dataset records, or empty array if nothing stored.
 */
function loadDatasetRegistry() {
  var raw = localStorage.getItem('dao-datasets-registry');
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export {
  createDatasetRecord,
  classifySuggestDomain,
  getEligibleDatasets,
  saveDatasetRegistry,
  loadDatasetRegistry,
};
