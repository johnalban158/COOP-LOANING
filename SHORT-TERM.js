// ─── SHORT-TERM.js ─────────────────────────
// Backend helpers for Short Term Loan admin page
// ─────────────────────────────────────────────

function getShortTermLoans() {
  return getLoansByType('STL');
}

function getShortTermPendingApplications() {
  return getPendingApplicationsByType('Short Term');
}
