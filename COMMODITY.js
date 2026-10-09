// ─── COMMODITY.js ──────────────────────────
// Backend helpers for Commodity Loan admin page
// ─────────────────────────────────────────────

function getCommodityLoans() {
  return getLoansByType('COM');
}

function getCommodityPendingApplications() {
  return getPendingApplicationsByType('Commodity');
}
