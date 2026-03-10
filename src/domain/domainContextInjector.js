// Domain Context Injector — DAO v1.2
// Injects domain-specific prompt overlays into AI calls.
// Used by scan engine and brief generator.
import waterModule from './water/water.module.js';
const moduleMap = {
  water: waterModule,
};
export function getScanOverlay(domainId) {
  const mod = moduleMap[domainId];
  if (!mod || !mod.prompts || !mod.prompts.scanOverlay) return '';
  return mod.prompts.scanOverlay;
}
export function getBriefOverlay(domainId) {
  const mod = moduleMap[domainId];
  if (!mod || !mod.prompts || !mod.prompts.briefOverlay) return '';
  return mod.prompts.briefOverlay;
}
export function getTerminology(domainId) {
  const mod = moduleMap[domainId];
  if (!mod || !mod.terminology) return [];
  return mod.terminology;
}
export function getKPIs(domainId) {
  const mod = moduleMap[domainId];
  if (!mod || !mod.kpis) return [];
  return mod.kpis;
}
