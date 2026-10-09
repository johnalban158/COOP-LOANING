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

// ─── Bulk ledger import (Import page) ───
// rows: [{memberId, memberName, amount, term, dateReleased, maturityDate, balance, status}]
// Writes to Loans + REGULAR sheets (A-O). Skips duplicates when skipExisting.
// Keeps Regular convention: Total Payable = principal (Amount), Balance = remaining principal.

function bulkImportLedgerLoans(rows, options) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) {
    return { success: false, message: 'Server busy. Try again.' };
  }
  try {
    options = options || {};
    var ss = openSheet_();
    if (!ss) { lock.releaseLock(); return { success: false, message: 'No spreadsheet connected.' }; }
    var loansSheet = getLoansSheet_();
    if (!loansSheet) { lock.releaseLock(); return { success: false, message: 'Loans sheet missing.' }; }

    var typeSheet = findSheetCI_(ss, 'REGULAR');
    if (!typeSheet) {
      typeSheet = ss.insertSheet('REGULAR');
      typeSheet.getRange('A1:O1').setValues([[
        'LoanID', 'MemberID', 'Member Name', 'Amount', 'Monthly Payment',
        'Term (Months)', 'Total Payable', 'Date Released', 'Maturity Date',
        'Balance', 'Status', 'School Year', 'Total Past Dues', 'Other Deductions', 'Net Proceeds'
      ]]);
      typeSheet.setFrozenRows(1);
    }

    // Existing keys for duplicate skip: MEMBERID|AMOUNT|DATERELEASED
    var existing = {};
    try {
      var ed = loansSheet.getDataRange().getValues();
      for (var ei = 1; ei < ed.length; ei++) {
        var k = String(ed[ei][1]).toUpperCase() + '|' + Number(ed[ei][3]) + '|' + String(ed[ei][7]);
        existing[k] = true;
      }
    } catch (e2) {}

    var imported = 0, skipped = 0;
    var errors = [];
    var tz = Session.getScriptTimeZone();

    for (var i = 0; i < (rows || []).length; i++) {
      try {
        var r = rows[i] || {};
        var memberId = String(r.memberId || '').trim();
        var memberName = String(r.memberName || '').trim() || memberId;
        var amount = Number(r.amount) || 0;
        var term = parseInt(r.term, 10) || 0;
        if (!memberId || !(amount > 0) || !(term >= 1 && term <= 60)) {
          skipped++; errors.push('Row ' + (i + 1) + ': bad ID/amount/term');
          continue;
        }
        var relStr = normImportDate_(r.dateReleased, tz);
        if (!relStr) { skipped++; errors.push('Row ' + (i + 1) + ': bad date'); continue; }
        var matStr = normImportDate_(r.maturityDate, tz);
        if (!matStr) {
          var rd = new Date(relStr + 'T00:00:00');
          rd.setMonth(rd.getMonth() + term);
          matStr = Utilities.formatDate(rd, tz, 'yyyy-MM-dd');
        }
        var key = memberId.toUpperCase() + '|' + amount + '|' + relStr;
        if (options.skipExisting !== false && existing[key]) { skipped++; continue; }

        var monthly = Math.round(regularPMT_(amount, term, 0.01));
        var balance = (r.balance === undefined) ? amount : (Number(r.balance) || 0);
        if (balance < 0) balance = 0;
        if (balance > amount) balance = amount;
        var status = String(r.status || '').trim() || (balance <= 0 ? 'Paid' : 'Active');
        if (balance <= 0) status = 'Paid';

        var ryd = new Date(relStr + 'T00:00:00');
        var sy = (ryd.getMonth() >= 5)
          ? ryd.getFullYear() + '-' + (ryd.getFullYear() + 1)
          : (ryd.getFullYear() - 1) + '-' + ryd.getFullYear();

        var prefix = 'REG';
        var loanId = generateLoanId_(loansSheet, prefix);
        var rowData = [loanId, memberId, memberName, amount, monthly, term,
          amount, relStr, matStr, balance, status, sy, 0, 0, amount];
        loansSheet.appendRow(rowData);
        try { typeSheet.appendRow(rowData); } catch (e3) {}
        // Keep prefix counter in sync for next row in same batch
        existing[key] = true;
        imported++;
      } catch (re) {
        skipped++; errors.push('Row ' + (i + 1) + ': ' + re.message);
      }
    }

    try {
      CacheService.getScriptCache().removeAll(['applications_data', 'members_data', 'loans_data', 'analytics_data']);
    } catch (e4) {}

    lock.releaseLock();
    return { success: true, imported: imported, skipped: skipped, errors: errors };
  } catch (e) {
    try { lock.releaseLock(); } catch (e2) {}
    return { success: false, message: e.message };
  }
}

function normImportDate_(v, tz) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, tz || Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    var mon = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }[m[2].toLowerCase()];
    if (mon === undefined) return '';
    var y = parseInt(m[3], 10);
    if (m[3].length === 2) y += 2000;
    var d = new Date(y, mon, parseInt(m[1], 10));
    return Utilities.formatDate(d, tz || Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var t = new Date(s);
  if (!isNaN(t)) return Utilities.formatDate(t, tz || Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return '';
}
