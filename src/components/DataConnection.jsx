/**
 * DataConnection — T-S0.4
 * Step 0: File list + scan trigger + DAO monitoring confirmation.
 *
 * Reads from:
 *   - loadDatasetRegistry() → localStorage 'dao-datasets-registry'
 *   - localStorage 'dao-scan-history'
 *
 * Props:
 *   runScan   {Function} — existing scan trigger from App.jsx
 *   scanning  {Boolean}  — scan in-progress flag from App.jsx
 */

import React, { useState, useEffect } from 'react';
import { loadDatasetRegistry } from '../core/data/datasetRegistry.js';

// ── Design tokens (match App.jsx shell conventions) ──────────────────────────
const BG_CARD    = '#111827';
const BG_SURFACE = '#1E293B';
const BORDER     = '#1E3A5F';
const ACCENT     = '#0EA5E9';
const TEXT       = '#E2E8F0';
const TEXT_DIM   = '#94A3B8';
const GREEN      = '#10B981';
const AMBER      = '#F59E0B';

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadScanHistory() {
  try {
    return JSON.parse(localStorage.getItem('dao-scan-history') || '[]');
  } catch {
    return [];
  }
}

/** Return most-recent scan record that included this file, or null. */
function getLastScanForFile(fileName, history) {
  for (const record of history) {
    if (Array.isArray(record.datasetsUsed) && record.datasetsUsed.includes(fileName)) {
      return record;
    }
  }
  return null;
}

/** Short human-readable date. */
function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/** Derive status label + colour from registry record + scan history. */
function resolveStatus(record, lastScan) {
  if (lastScan)                              return { label: 'Scanned',  color: GREEN };
  if (record.domain === 'unclassified')      return { label: 'Pending',  color: AMBER };
  return                                            { label: 'Ready',    color: ACCENT };
}

/** Human-readable type string from registry format + category. */
function formatType(record) {
  const fmt = (record.format || '').toLowerCase();
  const cat = record.category && record.category !== 'other' ? record.category : null;
  const base = fmt === 'excel' ? 'Excel' : fmt === 'csv' ? 'CSV' : fmt === 'text' ? 'Text' : 'File';
  return cat ? `${base} · ${cat}` : base;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DataConnection({ runScan, scanning }) {
  const [registry, setRegistry]       = useState([]);
  const [scanHistory, setScanHistory] = useState([]);

  // Load on mount and after each scan cycle (scanning flips false when done).
  useEffect(() => {
    refresh();
  }, [scanning]);

  function refresh() {
    const reg  = loadDatasetRegistry();
    const hist = loadScanHistory();
    setRegistry(reg.filter(r => r.active !== false));
    setScanHistory(hist);
  }

  const activeFiles     = registry;
  const hasFiles        = activeFiles.length > 0;
  const scanDisabled    = scanning || !hasFiles;

  return (
    <div style={{ padding: '0 0 24px' }}>

      {/* ── DAO Monitoring Confirmation ───────────────────────────────────── */}
      <div style={{
        background: `${GREEN}12`,
        border: `1px solid ${GREEN}40`,
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: GREEN, flexShrink: 0, marginTop: 4,
          boxShadow: `0 0 6px ${GREEN}`,
        }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: GREEN, marginBottom: 2 }}>
            DAO is monitoring your connected data
          </div>
          <div style={{ fontSize: 12, color: TEXT_DIM, lineHeight: 1.5 }}>
            Scan results, patterns, and situation signals update each time a scan completes.
            {activeFiles.length > 0 && (
              <> {activeFiles.length} file{activeFiles.length !== 1 ? 's' : ''} connected.</>
            )}
          </div>
        </div>
      </div>

      {/* ── File List ─────────────────────────────────────────────────────── */}
      {!hasFiles ? (
        <div style={{
          background: BG_CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          padding: '20px 16px',
          textAlign: 'center',
          color: TEXT_DIM,
          fontSize: 13,
          marginBottom: 16,
        }}>
          No files connected. Upload data above to begin.
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>

          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 130px 130px 88px',
            gap: 8,
            padding: '4px 14px 6px',
            fontSize: 11,
            fontWeight: 600,
            color: TEXT_DIM,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            <span>File Name</span>
            <span>Type</span>
            <span>Last Scan</span>
            <span>Status</span>
          </div>

          {/* Rows */}
          {activeFiles.map((rec, i) => {
            const lastScan = getLastScanForFile(rec.name, scanHistory);
            const status   = resolveStatus(rec, lastScan);
            return (
              <div
                key={rec.dataset_id || i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 130px 130px 88px',
                  gap: 8,
                  alignItems: 'center',
                  background: BG_CARD,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                {/* Name */}
                <span style={{
                  color: TEXT, fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  title: rec.name,
                }}>
                  {rec.name}
                </span>

                {/* Type */}
                <span style={{ color: TEXT_DIM, fontSize: 12 }}>
                  {formatType(rec)}
                </span>

                {/* Last Scan */}
                <span style={{ color: TEXT_DIM, fontSize: 12 }}>
                  {lastScan ? formatDate(lastScan.date) : 'Not scanned'}
                </span>

                {/* Status badge */}
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: status.color,
                  background: `${status.color}18`,
                  border: `1px solid ${status.color}45`,
                  borderRadius: 6,
                  padding: '2px 8px',
                  display: 'inline-block',
                  whiteSpace: 'nowrap',
                }}>
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Scan Trigger ──────────────────────────────────────────────────── */}
      <button
        onClick={runScan}
        disabled={scanDisabled}
        style={{
          background:  scanDisabled ? BG_SURFACE : ACCENT,
          color:       scanDisabled ? TEXT_DIM   : '#fff',
          border:      `1px solid ${scanDisabled ? BORDER : ACCENT}`,
          borderRadius: 10,
          padding:     '10px 22px',
          fontSize:    14,
          fontWeight:  600,
          cursor:      scanDisabled ? 'not-allowed' : 'pointer',
          opacity:     !hasFiles ? 0.5 : 1,
          fontFamily:  "'DM Sans', sans-serif",
          transition:  'opacity 0.2s, background 0.2s',
          display:     'flex',
          alignItems:  'center',
          gap:         8,
        }}
      >
        {scanning && (
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            border: `2px solid ${TEXT_DIM}`,
            borderTopColor: 'transparent',
            display: 'inline-block',
            animation: 'dao-spin 0.7s linear infinite',
          }} />
        )}
        {scanning ? 'Scanning…' : 'Run Scan'}
      </button>

      {!hasFiles && (
        <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 6 }}>
          Upload files above to enable scanning.
        </div>
      )}

      {/* Minimal keyframe for the scan spinner */}
      <style>{`
        @keyframes dao-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
