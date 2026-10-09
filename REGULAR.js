// ─── REGULAR.js ────────────────────────────
// Backend helpers for Regular Loan admin page
// ─────────────────────────────────────────────

// ─── Renewal computation (prompt rules) ───
// PMT at 1%/mo, diminishing balance schedule,
// deductions, net proceeds, 50% principal rule.

function regularPMT_(principal, months, monthlyRate) {
  var P = Number(principal) || 0;
  var n = Number(months) || 0;
  var r = (monthlyRate === undefined) ? 0.01 : Number(monthlyRate);
  if (P <= 0 || n <= 0) return 0;
  if (!r) return P / n;
  return P * r / (1 - Math.pow(1 + r, -n));
}

function regularAmortSchedule_(principal, months, monthlyRate) {
  var r = (monthlyRate === undefined) ? 0.01 : Number(monthlyRate);
  var pay = regularPMT_(principal, months, r);
  var bal = Number(principal) || 0;
  var rows = [];
  for (var i = 1; i <= months; i++) {
    var interest = bal * r;
    var princ = pay - interest;
    bal -= princ;
    if (bal < 0.005) bal = 0;
    rows.push({ month: i, payment: pay, interest: interest, principal: princ, balance: bal });
  }
  return rows;
}

function computeRegularRenewal(d) {
  d = d || {};
  var prev = Number(d.prevLoan) || 0;
  var outstanding = Number(d.outstanding) || 0;
  var newLoan = Number(d.newLoan) || 0;
  var term = Number(d.termMonths) || 0;
  var insTerm = Number(d.insTermMonths) || 12;
  var age = (d.age === undefined) ? 0 : Number(d.age);
  var notarial = (d.notarialApplicable === false) ? 0 : 100;
  var service = Number(d.serviceFee) || 0; // editable
  var pastDue = Number(d.pastDueInterest) || 0;
  var surcharge = (d.surcharge === undefined)
    ? Math.round(pastDue * 0.02)
    : (Number(d.surcharge) || 0);

  var monthly = regularPMT_(newLoan, term, 0.01);
  var totalPayable = monthly * term;
  var totalInterest = totalPayable - newLoan;

  var cbu = Math.round(newLoan * 0.02);
  // Insurance: ~1.62% for 12mo all-in (<=65 incl. 0.1/1000 AD&D).
  // Over 65: rider excluded -> 1.61%. Scaled by insTerm/12.
  var insRate = (age > 65) ? 0.0161 : 0.0162;
  var insurance = Math.round(newLoan * insRate * (insTerm / 12));
  var standing = Math.round(prev / 2);

  var totalDed = notarial + cbu + service + insurance + standing;
  var net = newLoan - totalDed;

  var princ50 = Math.max(0, outstanding - (prev / 2)) + pastDue + surcharge;
  var toRelease = net - princ50;

  var warnings = [];
  if (toRelease < 0) warnings.push('Negative release: deductions + 50% payment exceed new loan.');
  if (term <= 0) warnings.push('Invalid term.');
  if (newLoan <= 0) warnings.push('Invalid new loan amount.');

  return {
    monthly: monthly,
    totalPayable: totalPayable,
    totalInterest: totalInterest,
    deductions: {
      notarial: notarial, cbu: cbu, service: service,
      insurance: insurance, insuranceRate: insRate,
      standing: standing, total: totalDed
    },
    net: net, princ50: princ50,
    pastDue: pastDue, surcharge: surcharge,
    toRelease: toRelease,
    negative: toRelease < 0,
    warnings: warnings
  };
}

function getRegularLoans() {
  return getLoansByType('REG');
}

function getRegularPendingApplications() {
  return getPendingApplicationsByType('Regular');
}
