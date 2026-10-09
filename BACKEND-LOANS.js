// ─── BACKEND-LOANS.js ───────────────────────────────────────────────────────
// Server-side functions for Loan Applications.
// Works with the APPLICATION sheet in your Google Spreadsheet.
// Columns: A: MEMBER-ID  B: FIRST-N  C: LAST-N  D: LOAN-TYPE
//          E: AMOUNT-REQUESTED  F: TERM  G: DATE-SUBMITTED
//          H: DATE-APPROVED  I: APPLICATION-STATUS  J: REASON IF DECLINED
// ─────────────────────────────────────────────────────────────────────────────

/* ── Helper: get or create the Application sheet ── */
function getApplicationSheet_() {
  var ss = openSheet_();
  if (!ss) return null;
  var sheet = findSheetCI_(ss, 'Application');
  if (!sheet) {
    sheet = ss.insertSheet('Application');
    sheet.getRange('A1:M1').setValues([[
      'MEMBER-ID', 'FIRST-N', 'LAST-N',
      'LOAN-TYPE', 'AMOUNT-REQUESTED', 'TERM',
      'DATE-SUBMITTED', 'DATE-APPROVED',
      'APPLICATION-STATUS', 'REASON IF DECLINED', 'Total Past Dues', 'Other Deductions', 'Net Proceeds'
    ]]);
    sheet.getRange('A1:M1')
      .setFontWeight('bold')
      .setBackground('#F4F2EE');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ═══════════════════════════════════════════
// Submit a new loan application (member side)
// ═══════════════════════════════════════════

function submitLoanApplication(data) {
  try {
    Logger.log('submitLoanApplication received data: ' + JSON.stringify(data));
    
    var sheet = getApplicationSheet_();
    if (!sheet) {
      return {
        success: false,
        message: 'No spreadsheet connected. '
          + 'Ask admin to connect in Settings.'
      };
    }
    // Format today's date
    // ── CBU Validation: check loan amount against CBU limit ──
    if (data.memberId && data.amount > 0) {
      try {
        var memSheet = getMembersSheet_();
        if (memSheet) {
          var memData = memSheet.getDataRange().getValues();
          var props   = PropertiesService.getScriptProperties();
          var regPct  = Number(props.getProperty('CBU_REG_PCT'))  || 300;
          var stPct   = Number(props.getProperty('CBU_ST_PCT'))   || 80;
          var comPct  = Number(props.getProperty('CBU_COM_PCT'))  || 80;

          var memberIdTrim  = String(data.memberId).trim();
          var memberPhDigits = memberIdTrim.replace(/\D/g, '');
          if (memberPhDigits.length > 10) memberPhDigits = memberPhDigits.slice(-10);

          for (var ci = 1; ci < memData.length; ci++) {
            var mRow = memData[ci];
            var mId  = String(mRow[0] || '').trim();
            var mIdD = mId.replace(/\D/g, '');
            if (mIdD.length > 10) mIdD = mIdD.slice(-10);
            if (mId !== memberIdTrim && mIdD !== memberPhDigits) continue;

            var capital = Number(mRow[7]) || 0;  // col H = CAPITAL
            if (capital <= 0) break;              // no CBU set, skip

            var loanType   = String(data.loanType || '');
            var memberType = String(mRow[3] || '');
            var applicablePct;
            if (loanType === 'Regular') {
              applicablePct = regPct;
            } else if (loanType === 'Commodity') {
              applicablePct = comPct;
            } else {
              // Short Term: pct depends on member type
              applicablePct = (memberType === 'Teacher') ? regPct : stPct;
            }

            var maxLoanable = Math.round(capital * applicablePct / 100);
            if (Number(data.amount) > maxLoanable) {
              return {
                success: false,
                message: 'Loan amount exceeds your CBU limit. Your Capital (CBU) is \u20B1'
                  + capital.toLocaleString()
                  + '. Maximum loanable: \u20B1' + maxLoanable.toLocaleString()
                  + ' (' + applicablePct + '% of CBU).'
              };
            }
            break;
          }
        }
      } catch (cbuErr) {
        Logger.log('CBU validation error (non-fatal): ' + cbuErr.message);
      }
    }

    var today = new Date();
    var dateStr =
      Utilities.formatDate(today,
        Session.getScriptTimeZone(),
        'yyyy-MM-dd');

    sheet.appendRow([
      data.memberId   || '',   // A: MEMBER-ID
      data.firstName  || '',   // B: FIRST-N
      data.lastName   || '',   // C: LAST-N
      data.loanType   || '',   // D: LOAN-TYPE
      data.amount     || 0,    // E: AMOUNT-REQUESTED
      data.term       || 0,    // F: TERM (months)
      dateStr,                 // G: DATE-SUBMITTED
      '',                      // H: DATE-APPROVED
      'Pending',               // I: APPLICATION-STATUS
      ''                       // J: REASON IF DECLINED
    ]);

    // Send Gmail notification to member about submission
    var memberEmailSub = data.memberEmail || getMemberEmail(data.memberId);
    var memberNameSub = ((data.firstName || '') + ' ' + (data.lastName || '')).trim();
    if (memberEmailSub) {
      try {
        sendSubmittedEmail(memberEmailSub, memberNameSub, data.memberId, data.loanType, data.amount);
      } catch (emailErr) {
        Logger.log('Submission email error (non-fatal): ' + emailErr.message);
      }
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
}

// ═══════════════════════════════════════════
// Get all applications (admin side)
// ═══════════════════════════════════════════

function getApplications() {
  try {
    var ss = openSheet_();
    if (!ss) {
      var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      if (!id) {
        Logger.log('No spreadsheet ID configured');
        return { success: false, message: 'No spreadsheet configured. Please go to Settings and connect your Google Sheet.' };
      }
      Logger.log('Spreadsheet ID exists but cannot open: ' + id);
      return { success: false, message: 'Cannot access spreadsheet. The spreadsheet ID may be invalid or you may not have access. Please check the URL in Settings.' };
    }
    var sheet = getApplicationSheet_();
    if (!sheet) {
      Logger.log('Application sheet not found');
      return { success: false, message: 'Application sheet not found in spreadsheet. Please contact administrator.' };
    }
    var data = sheet.getDataRange().getValues();
    var cache = CacheService.getScriptCache();

    // Fetch active loan balances to help with deductions
    var activeBalances = {};
    try {
      var loansSheet = findSheetCI_(openSheet_(), 'Loans');
      if (loansSheet) {
        var ldata = loansSheet.getDataRange().getValues();
        for (var j = 1; j < ldata.length; j++) {
          if (String(ldata[j][10]).toLowerCase() === 'active') {
            activeBalances[String(ldata[j][1]).toUpperCase()] = Number(ldata[j][9]) || 0;
          }
        }
      }
    } catch (e2) {}

    // Fetch member data (Capital and Type) to show in application review
    var memberMap = {};
    try {
      var memSheet = getMembersSheet_();
      if (memSheet) {
        var mdata = memSheet.getDataRange().getValues();
        for (var k = 1; k < mdata.length; k++) {
          var mId = String(mdata[k][0]).toUpperCase();
          memberMap[mId] = {
            capital: Number(mdata[k][7]) || 0,
            memberType: String(mdata[k][3] || 'JO')
          };
        }
      }
    } catch (e3) {}

    var apps = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[3]) continue;
      var mid = String(row[0]);
      var mInfo = memberMap[mid.toUpperCase()] || { capital: 0, memberType: 'JO' };
      
      apps.push({
        row: i + 1,
        memberId:    mid,
        firstName:   String(row[1]),
        lastName:    String(row[2]),
        loanType:    String(row[3]),
        amount:      Number(row[4]) || 0,
        term:        Number(row[5]) || 0,
        dateSubmitted: row[6]
          ? Utilities.formatDate(new Date(row[6]), Session.getScriptTimeZone(), 'MMM dd, yyyy')
          : '',
        dateApproved: row[7]
          ? Utilities.formatDate(new Date(row[7]), Session.getScriptTimeZone(), 'MMM dd, yyyy')
          : '',
        status:      String(row[8]) || 'Pending',
        reason:      String(row[9]) || '',
        totalPastDues: Number(row[10]) || 0,
        otherDeductions: Number(row[11]) || 0,
        netProceeds:   Number(row[12]) || 0,
        existingBalance: activeBalances[mid.toUpperCase()] || 0,
        memberCapital: mInfo.capital,
        memberType: mInfo.memberType,
        dateReleased: row.length > 13 && row[13]
          ? Utilities.formatDate(new Date(row[13]), Session.getScriptTimeZone(), 'MMM dd, yyyy')
          : '',
        releasedBy: row.length > 14 ? String(row[14]) : '',
        school: row.length > 15 ? String(row[15]) : '',
        purpose: row.length > 16 ? String(row[16]) : '',
        totalB: Number(row[10]) || 0,
        totalC: Number(row[11]) || 0
      });
    }
    var dedDefaults = {};
    try { dedDefaults = getDeductionSettings(); } catch(e4) {}
    var result = { success: true, apps: apps, dedDefaults: dedDefaults };
    // Cache for 120 seconds
    try { cache.put('applications_data', JSON.stringify(result), 120); } catch(e) {}
    return result;
  } catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
}

// ═══════════════════════════════════════════
// LOANS sheet columns (user-defined):
// A: LoanID  B: MemberID  C: Member Name
// D: Amount  E: Monthly Payment  F: Term (Months)
// G: Total Payable  H: Date Released
// I: Maturity Date  J: Balance  K: Status
// L: School Year
// ═══════════════════════════════════════════

function getLoansSheet_() {
  var ss = openSheet_();
  if (!ss) return null;
  var sheet = findSheetCI_(ss, 'Loans');
  if (!sheet) {
    sheet = ss.insertSheet('Loans');
    sheet.getRange('A1:O1').setValues([[
      'LoanID', 'MemberID', 'Member Name',
      'Amount', 'Monthly Payment',
      'Term (Months)', 'Total Payable',
      'Date Released', 'Maturity Date',
      'Balance', 'Status', 'School Year',
      'Total Past Dues', 'Other Deductions', 'Net Proceeds'
    ]]);
    sheet.getRange('A1:O1')
      .setFontWeight('bold')
      .setBackground('#F4F2EE');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* Generate next LoanID like STL-001, REG-001, COM-001 */
function generateLoanId_(sheet, prefix) {
  var data = sheet.getDataRange().getValues();
  var max = 0;
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]);
    if (id.indexOf(prefix) === 0) {
      var num = parseInt(id.split('-')[1], 10);
      if (num > max) max = num;
    }
  }
  var next = max + 1;
  return prefix + '-'
    + ('00' + next).slice(-3);
}

// ═══════════════════════════════════════════
// Approve an application (admin side)
// Writes the loan to the LOANS sheet
// ═══════════════════════════════════════════

function approveApplication(sheetRow, deductionData) {
  // Use LockService to prevent race conditions from double-clicks
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // wait up to 10s
  } catch (e) {
    return { success: false, message: 'Server busy. Please try again.' };
  }

  try {
    var ss = openSheet_();
    var appSheet = findSheetCI_(ss, 'Application');
    if (!appSheet) {
      lock.releaseLock();
      return { success: false, message: 'Application sheet missing.' };
    }

    // ── DUPLICATE CHECK ──
    // Read the specific row range to get both status and row data in one go
    var rowRange = appSheet.getRange(sheetRow, 1, 1, 13);
    var rowValues = rowRange.getValues()[0];
    var currentStatus = String(rowValues[8]).trim();
    
    if (currentStatus === 'Approved') {
      lock.releaseLock();
      return { success: false, message: 'This application has already been approved.' };
    }

    var tz = Session.getScriptTimeZone();
    var now = new Date();
    var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');

    // Update APPLICATION sheet in one go
    // Col H (8): Date Approved, Col I (9): Status, skip Col J (10): Reason, Col K (11): totalB, Col L (12): totalC, Col M (13): netProceeds
    // First update: Date Approved and Status
    appSheet.getRange(sheetRow, 8, 1, 2).setValues([[today, 'Approved (In Settlement)']]);
    // Second update: Deductions columns (K, L, M)
    appSheet.getRange(sheetRow, 11, 1, 3).setValues([[deductionData.totalB, deductionData.totalC, deductionData.netProceeds]]);
    
    Logger.log('Updated application row ' + sheetRow + ' status to: Approved (In Settlement)');

    var memberId  = String(rowValues[0]);
    var firstName = String(rowValues[1]);
    var lastName  = String(rowValues[2]);
    var loanType  = String(rowValues[3]);
    var amount    = Number(rowValues[4]) || 0;
    var term      = Number(rowValues[5]) || 0;
    
    Logger.log('Approving loan for member: ' + memberId + ' (' + firstName + ' ' + lastName + ')');

    // Compute payment
    var monthly, totalToPay;
    if (loanType === 'Regular') {
      var prin = amount / term;
      var int1 = amount * 0.01;
      monthly = Math.round(prin + int1);
      totalToPay = amount;
    } else if (loanType === 'Commodity') {
      totalToPay = Math.round(
        amount * (1 + 0.01 * term));
      monthly = Math.round(totalToPay / term);
    } else {
      totalToPay = Math.round(amount * 1.06);
      monthly = Math.round(totalToPay / term);
    }

    // Maturity date = today + term months
    var maturity = new Date(now);
    maturity.setMonth(
      maturity.getMonth() + term);
    var maturityStr = Utilities.formatDate(
      maturity, tz, 'yyyy-MM-dd');

    // School year (e.g. "2025-2026")
    var yr = now.getFullYear();
    var mo = now.getMonth(); // 0-based
    var sy = mo >= 5
      ? yr + '-' + (yr + 1)
      : (yr - 1) + '-' + yr;

    // LoanID prefix by type
    var prefix = loanType === 'Regular'
      ? 'REG' : loanType === 'Commodity'
      ? 'COM' : 'STL';

    // Write to LOANS sheet
    var loansSheet = getLoansSheet_();
    var loanId = '';
    if (loansSheet) {
      loanId = generateLoanId_(loansSheet, prefix);
      loansSheet.appendRow([
        loanId,                    // A
        memberId,                  // B
        lastName + ', ' + firstName, // C
        amount,                    // D
        monthly,                   // E
        term,                      // F
        totalToPay,                // G
        today,                     // H
        maturityStr,               // I
        totalToPay,                // J (Balance)
        'Active',                  // K
        sy,                        // L
        deductionData ? deductionData.totalB : 0, // M
        deductionData ? deductionData.totalC : 0, // N
        deductionData ? deductionData.netProceeds : amount // O
      ]);
    }

    // ── Also write to the type-specific sheet ──────────────────────────
    var typeSheetName = loanType === 'Regular'
      ? 'REGULAR'
      : loanType === 'Commodity'
      ? 'COMMODITY'
      : 'SHORT-TERM';

    if (ss) {
      var typeSheet = findSheetCI_(ss, typeSheetName);
      if (!typeSheet) {
        typeSheet = ss.insertSheet(typeSheetName);
        typeSheet.getRange('A1:O1').setValues([[
          'LoanID', 'MemberID', 'Member Name',
          'Amount', 'Monthly Payment', 'Term (Months)',
          'Total Payable', 'Date Released', 'Maturity Date',
          'Balance', 'Status', 'School Year',
          'Total Past Dues', 'Other Deductions', 'Net Proceeds'
        ]]);
        typeSheet.getRange('A1:O1')
          .setFontWeight('bold')
          .setBackground('#F4F2EE');
        typeSheet.setFrozenRows(1);
      }
      typeSheet.appendRow([
        loanId,
        memberId,
        lastName + ', ' + firstName,
        amount,
        monthly,
        term,
        totalToPay,
        today,
        maturityStr,
        totalToPay,
        'Active',
        sy,
        deductionData ? deductionData.totalB : 0,
        deductionData ? deductionData.totalC : 0,
        deductionData ? deductionData.netProceeds : amount
      ]);
    }
    // ────────────────────────────────────────────────────────────────────

    // ── Send Gmail approval notification to member ──
    var memberEmail = getMemberEmail(memberId);
    if (memberEmail) {
      try {
        sendApprovedEmail(memberEmail, firstName + ' ' + lastName, memberId, loanType, amount, monthly, term, deductionData);
      } catch(emailErr) {
        Logger.log('Approval email error (non-fatal): ' + emailErr.message);
      }
    }

    // ── Send deduction summary email to Admin ──
    try {
      sendLoanApprovalDeductionEmailToAdmin_(
        firstName + ' ' + lastName, memberId, loanType, amount, deductionData
      );
    } catch(adminEmailErr) {
      Logger.log('Admin deduction email error (non-fatal): ' + adminEmailErr.message);
    }

    // ── Deduct loan amount from member's CBU ──
    try {
      var memSheet = getMembersSheet_();
      if (memSheet) {
        var memData = memSheet.getDataRange().getValues();
        var memberPhDigits = memberId.replace(/\D/g, '');
        if (memberPhDigits.length > 10) memberPhDigits = memberPhDigits.slice(-10);
        
        for (var mi = 1; mi < memData.length; mi++) {
          var mRow = memData[mi];
          var mId = String(mRow[0] || '').trim();
          var mIdD = mId.replace(/\D/g, '');
          if (mIdD.length > 10) mIdD = mIdD.slice(-10);
          
          if (mId === memberId || mIdD === memberPhDigits) {
            var currentCbu = Number(mRow[7]) || 0; // Column H = Capital
            var newCbu = currentCbu - amount;
            if (newCbu < 0) newCbu = 0;
            memSheet.getRange(mi + 1, 8).setValue(newCbu);
            Logger.log('Deducted ' + amount + ' from CBU. Old: ' + currentCbu + ', New: ' + newCbu);
            break;
          }
        }
      }
    } catch(cbuErr) {
      Logger.log('CBU deduction error (non-fatal): ' + cbuErr.message);
    }

    // Invalidate caches after state change
    try {
      var c = CacheService.getScriptCache();
      c.removeAll(['applications_data', 'members_data', 'loans_data', 'analytics_data']);
    } catch(e2) {}

    lock.releaseLock();
    return { success: true };
  } catch (e) {
    lock.releaseLock();
    return {
      success: false,
      message: e.message
    };
  }
}

// ═══════════════════════════════════════════
// Final Release - Change status from Approved (In Settlement) to Released
// ═══════════════════════════════════════════

function finalReleaseLoan(sheetRow, deductionData, claimingSchedule) {
  try {
    var sheet = getApplicationSheet_();
    if (!sheet) {
      return { success: false, message: 'No spreadsheet connected.' };
    }

    // Read row data first to get member details for email
    var rowData = sheet.getRange(sheetRow, 1, 1, 13).getValues()[0];
    var currentStatus = String(rowData[8]).trim();
    
    // Check if status is "Approved (In Settlement)"
    if (currentStatus !== 'Approved (In Settlement)') {
      return { success: false, message: 'This loan is not in settlement status. Current status: ' + currentStatus };
    }

    var memberId  = String(rowData[0]);
    var firstName = String(rowData[1]);
    var lastName  = String(rowData[2]);
    var loanType  = String(rowData[3]);
    var amount    = Number(rowData[4]) || 0;
    
    // Use provided deduction data or existing net proceeds
    var netProceeds = deductionData ? deductionData.netProceeds : (Number(rowData[12]) || 0);
    
    // Update deduction columns if provided
    if (deductionData) {
      sheet.getRange(sheetRow, 11, 1, 3).setValues([[deductionData.totalB, deductionData.totalC, deductionData.netProceeds]]);
    }

    // Update status to "Released"
    sheet.getRange(sheetRow, 9).setValue('Released');

    // Add release columns if they don't exist
    var lastCol = sheet.getLastColumn();
    if (lastCol < 14) {
      sheet.getRange(1, 14).setValue('Date Released');
      sheet.getRange(1, 15).setValue('Released By');
      sheet.getRange(1, 16).setValue('Claiming Date');
      sheet.getRange(1, 17).setValue('Claiming Time');
      sheet.getRange(1, 18).setValue('Claiming Location');
    }
    
    // Record release date and who released it
    var session = Session.getActiveUser();
    var releasedBy = session ? session.getEmail() : 'Treasurer';
    sheet.getRange(sheetRow, 14).setValue(new Date());
    sheet.getRange(sheetRow, 15).setValue(releasedBy);
    
    // Record claiming schedule if provided
    if (claimingSchedule) {
      sheet.getRange(sheetRow, 16).setValue(claimingSchedule.claimingDate || '');
      sheet.getRange(sheetRow, 17).setValue(claimingSchedule.claimingTime || '');
      sheet.getRange(sheetRow, 18).setValue(claimingSchedule.claimingLocation || '');
    }

    // ── Send Gmail release notification to member ──
    try {
      var memberEmail = getMemberEmail(memberId);
      if (memberEmail) {
        sendReleasedEmail(memberEmail, firstName + ' ' + lastName, memberId, loanType, amount, netProceeds, claimingSchedule);
      }
    } catch (emailErr) {
      Logger.log('Release email error (non-fatal): ' + emailErr.message);
    }

    // Invalidate cache after state change
    try {
      var cache = CacheService.getScriptCache();
      cache.removeAll(['applications_data', 'members_data', 'loans_data', 'analytics_data']);
    } catch(e2) {}

    return { success: true };
  } catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
}

// Get Officer Borrower Data for Ledger Page
// ═══════════════════════════════════════════

function getOfficerBorrowerData() {
  try {
    var loansSheet = getLoansSheet_();
    if (!loansSheet) {
      return [];
    }
    var data = loansSheet.getDataRange().getValues();
    
    var borrowers = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[1]) continue; // Skip if no member ID
      
      var loanId = String(row[0]);
      var memberId = String(row[1]);
      var memberName = String(row[2]);
      var principal = Number(row[3]) || 0;
      var monthly = Number(row[4]) || 0;
      var term = Number(row[5]) || 0;
      var totalPayable = Number(row[6]) || 0;
      var dateReleased = row[7] ? Utilities.formatDate(new Date(row[7]), Session.getScriptTimeZone(), 'MMM dd, yyyy') : '';
      var maturityDate = row[8] ? Utilities.formatDate(new Date(row[8]), Session.getScriptTimeZone(), 'MMM dd, yyyy') : '';
      var balance = Number(row[9]) || 0;
      var status = String(row[10]) || 'Active';
      
      // Parse member name
      var nameParts = memberName.split(', ');
      var lastName = nameParts[0] || memberName;
      var firstName = nameParts[1] || '';
      
      // Get school from member sheet
      var school = '';
      try {
        var memSheet = getMembersSheet_();
        if (memSheet) {
          var memData = memSheet.getDataRange().getValues();
          for (var j = 1; j < memData.length; j++) {
            if (String(memData[j][0]) === memberId) {
              school = String(memData[j][6]) || '';
              break;
            }
          }
        }
      } catch (e) {}
      
      // Get payment history
      var payments = [];
      try {
        var paymentsSheet = findSheetCI_(openSheet_(), 'Payments');
        if (paymentsSheet) {
          var payData = paymentsSheet.getDataRange().getValues();
          for (var k = 1; k < payData.length; k++) {
            if (String(payData[k][1]) === loanId) {
              payments.push({
                date: payData[k][2] ? Utilities.formatDate(new Date(payData[k][2]), Session.getScriptTimeZone(), 'MMM dd, yyyy') : '',
                amount: Number(payData[k][3]) || 0
              });
            }
          }
        }
      } catch (e) {}
      
      // Sort payments by date
      payments.sort(function(a, b) {
        return new Date(a.date) - new Date(b.date);
      });
      
      // Calculate total paid
      var totalPaid = payments.reduce(function(sum, p) { return sum + p.amount; }, 0);
      
      // Get remarks
      var remarks = '';
      try {
        var remarksSheet = findSheetCI_(openSheet_(), 'Remarks');
        if (remarksSheet) {
          var remData = remarksSheet.getDataRange().getValues();
          for (var m = 1; m < remData.length; m++) {
            if (String(remData[m][0]) === memberId) {
              remarks = String(remData[m][1]) || '';
              break;
            }
          }
        }
      } catch (e) {}
      
      borrowers.push({
        loanId: loanId,
        memberId: memberId,
        firstName: firstName,
        lastName: lastName,
        school: school,
        principal: principal,
        paid: totalPaid,
        balance: balance,
        status: status,
        dateReleased: dateReleased,
        maturityDate: maturityDate,
        payments: payments,
        remarks: remarks,
        totalDeductions: 0 // Will be calculated from deductions
      });
    }
    
    return borrowers;
  } catch (e) {
    return [];
  }
}

// Get Deductions for a specific member
// ═══════════════════════════════════════════

function getDeductionsForMember(memberId) {
  try {
    var deductionsSheet = findSheetCI_(openSheet_(), 'Deductions');
    if (!deductionsSheet) {
      return [];
    }
    var data = deductionsSheet.getDataRange().getValues();
    
    var deductions = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[0]) === memberId) {
        deductions.push({
          id: i + 1,
          memberId: String(row[0]),
          name: String(row[1]),
          type: String(row[2]),
          value: Number(row[3]) || 0,
          appliesTo: String(row[4]),
          amount: Number(row[5]) || 0,
          createdBy: String(row[6]),
          createdAt: row[7] ? Utilities.formatDate(new Date(row[7]), Session.getScriptTimeZone(), 'MMM dd, yyyy') : ''
        });
      }
    }
    
    return deductions;
  } catch (e) {
    return [];
  }
}

// Add a new deduction
// ═══════════════════════════════════════════

function addDeduction(deduction) {
  try {
    var deductionsSheet = findSheetCI_(openSheet_(), 'Deductions');
    if (!deductionsSheet) {
      // Create sheet if it doesn't exist
      var ss = openSheet_();
      deductionsSheet = ss.insertSheet('Deductions');
      deductionsSheet.getRange('A1:H1').setValues([[
        'Member ID', 'Fee Name', 'Type', 'Value', 'Applies To', 'Amount', 'Created By', 'Created At'
      ]]);
      deductionsSheet.getRange('A1:H1')
        .setFontWeight('bold')
        .setBackground('#F4F2EE');
      deductionsSheet.setFrozenRows(1);
    }
    
    var session = Session.getActiveUser();
    var createdBy = session ? session.getEmail() : 'Officer';
    
    deductionsSheet.appendRow([
      deduction.memberId,
      deduction.name,
      deduction.type,
      deduction.value,
      deduction.appliesTo,
      deduction.amount,
      createdBy,
      new Date()
    ]);
    
    // Invalidate cache
    try {
      var cache = CacheService.getScriptCache();
      cache.removeAll(['deductions_data']);
    } catch (e) {}
    
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Remove a deduction
// ═══════════════════════════════════════════

function removeDeduction(row) {
  try {
    var deductionsSheet = findSheetCI_(openSheet_(), 'Deductions');
    if (!deductionsSheet) {
      return { success: false, message: 'Deductions sheet not found' };
    }
    
    deductionsSheet.deleteRow(row);
    
    // Invalidate cache
    try {
      var cache = CacheService.getScriptCache();
      cache.removeAll(['deductions_data']);
    } catch (e) {}
    
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Save borrower remarks
// ═══════════════════════════════════════════

function saveBorrowerRemarks(memberId, remarks) {
  try {
    var remarksSheet = findSheetCI_(openSheet_(), 'Remarks');
    if (!remarksSheet) {
      // Create sheet if it doesn't exist
      var ss = openSheet_();
      remarksSheet = ss.insertSheet('Remarks');
      remarksSheet.getRange('A1:B1').setValues([['Member ID', 'Remarks']]);
      remarksSheet.getRange('A1:B1')
        .setFontWeight('bold')
        .setBackground('#F4F2EE');
      remarksSheet.setFrozenRows(1);
    }
    
    // Check if member already has remarks
    var data = remarksSheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === memberId) {
        remarksSheet.getRange(i + 1, 2).setValue(remarks);
        found = true;
        break;
      }
    }
    
    if (!found) {
      remarksSheet.appendRow([memberId, remarks]);
    }
    
    // Invalidate cache
    try {
      var cache = CacheService.getScriptCache();
      cache.removeAll(['remarks_data']);
    } catch (e) {}
    
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Get Treasurer Loan Release Data (optimized for treasurer page)
// ═══════════════════════════════════════════

function getTreasurerReleaseData() {
  try {
    var ss = openSheet_();
    if (!ss) {
      var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
      if (!id) {
        Logger.log('No spreadsheet ID configured');
        return { success: false, message: 'No spreadsheet configured. Please go to Settings and connect your Google Sheet.' };
      }
      Logger.log('Spreadsheet ID exists but cannot open: ' + id);
      return { success: false, message: 'Cannot access spreadsheet. The spreadsheet ID may be invalid or you may not have access. Please check the URL in Settings.' };
    }
    var sheet = getApplicationSheet_();
    if (!sheet) {
      Logger.log('Application sheet not found');
      return { success: false, message: 'Application sheet not found in spreadsheet. Please contact administrator.' };
    }
    var data = sheet.getDataRange().getValues();

    var loans = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[3]) continue;
      
      var status = String(row[8]).toLowerCase();
      
      // Only include loans that are "Approved (In Settlement)" or "Released"
      if (status.indexOf('approved') === -1 && status.indexOf('settlement') === -1 && status !== 'released') {
        continue;
      }
      
      loans.push({
        row: i + 1,
        memberId:    String(row[0]),
        firstName:   String(row[1]),
        lastName:    String(row[2]),
        loanType:    String(row[3]),
        amount:      Number(row[4]) || 0,
        term:        Number(row[5]) || 0,
        dateSubmitted: row[6]
          ? Utilities.formatDate(new Date(row[6]), Session.getScriptTimeZone(), 'MMM dd, yyyy')
          : '',
        dateApproved: row[7]
          ? Utilities.formatDate(new Date(row[7]), Session.getScriptTimeZone(), 'MMM dd, yyyy')
          : '',
        status:      String(row[8]) || 'Pending',
        totalPastDues: Number(row[10]) || 0,
        otherDeductions: Number(row[11]) || 0,
        netProceeds:   Number(row[12]) || 0,
        dateReleased: row.length > 13 && row[13]
          ? Utilities.formatDate(new Date(row[13]), Session.getScriptTimeZone(), 'MMM dd, yyyy')
          : '',
        releasedBy: row.length > 14 ? String(row[14]) : '',
        school: row.length > 15 ? String(row[15]) : '',
        purpose: row.length > 16 ? String(row[16]) : '',
        totalB: Number(row[10]) || 0,
        totalC: Number(row[11]) || 0
      });
    }
    
    return { success: true, loans: loans };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Batch Release - Release multiple loans at once
// ═══════════════════════════════════════════

function batchReleaseLoans(sheetRows) {
  try {
    var sheet = getApplicationSheet_();
    if (!sheet) {
      return { success: false, message: 'No spreadsheet connected.' };
    }

    var session = Session.getActiveUser();
    var releasedBy = session ? session.getEmail() : 'Treasurer';
    var releasedCount = 0;
    var errors = [];

    // Ensure release date and released by columns exist
    var lastCol = sheet.getLastColumn();
    if (lastCol < 14) {
      sheet.getRange(1, 14).setValue('Date Released');
      sheet.getRange(1, 15).setValue('Released By');
    }

    sheetRows.forEach(function(row) {
      try {
        var rowData = sheet.getRange(row, 1, 1, 13).getValues()[0];
        var currentStatus = String(rowData[8]).trim();
        
        if (currentStatus !== 'Approved (In Settlement)') {
          errors.push('Row ' + row + ': Not in settlement status');
          return;
        }

        var memberId  = String(rowData[0]);
        var firstName = String(rowData[1]);
        var lastName  = String(rowData[2]);
        var loanType  = String(rowData[3]);
        var amount    = Number(rowData[4]) || 0;
        var netProceeds = Number(rowData[12]) || 0;

        // Update status to "Released"
        sheet.getRange(row, 9).setValue('Released');
        
        // Record release date and who released it
        sheet.getRange(row, 14).setValue(new Date());
        sheet.getRange(row, 15).setValue(releasedBy);

        // ── Send Gmail release notification to member ──
        try {
          var memberEmail = getMemberEmail(memberId);
          if (memberEmail) {
            sendReleasedEmail(memberEmail, firstName + ' ' + lastName, memberId, loanType, amount, netProceeds);
          }
        } catch (emailErr) {
          Logger.log('Release email error (non-fatal): ' + emailErr.message);
        }

        releasedCount++;
      } catch (rowErr) {
        errors.push('Row ' + row + ': ' + rowErr.message);
      }
    });

    // Invalidate cache after state change
    try {
      var cache = CacheService.getScriptCache();
      cache.removeAll(['applications_data', 'members_data', 'loans_data', 'analytics_data']);
    } catch(e2) {}

    return {
      success: true,
      releasedCount: releasedCount,
      errors: errors
    };
  } catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
}

// ═══════════════════════════════════════════
// Reject an application (admin side)
// ═══════════════════════════════════════════

function rejectApplication(sheetRow, reason) {
  try {
    var sheet = getApplicationSheet_();
    if (!sheet) {
      return { success: false,
        message: 'No spreadsheet connected.' };
    }

    // Read row data first to get member details for email
    var rowData = sheet.getRange(sheetRow, 1, 1, 10).getValues()[0];
    var memberId  = String(rowData[0]);
    var firstName = String(rowData[1]);
    var lastName  = String(rowData[2]);
    var loanType  = String(rowData[3]);
    var amount    = Number(rowData[4]) || 0;

    sheet.getRange(sheetRow, 9)
      .setValue('Rejected');
    sheet.getRange(sheetRow, 10)
      .setValue(reason || '');

    // ── Send Gmail rejection notification to member ──
    try {
      var memberEmail = getMemberEmail(memberId);
      if (memberEmail) {
        sendRejectedEmail(memberEmail, firstName + ' ' + lastName, memberId, loanType, amount, reason);
      }
    } catch (emailErr) {
      Logger.log('Rejection email error (non-fatal): ' + emailErr.message);
    }

    // Invalidate cache after state change
    try {
      var cache = CacheService.getScriptCache();
      cache.removeAll(['applications_data', 'members_data']);
    } catch(e2) {}

    return { success: true };
  } catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
}

// ═══════════════════════════════════════════
// Direct Loan Entry (Officer Data Entry)
// Allows officers to add existing loans directly to type-specific sheets
// ═══════════════════════════════════════════

function addLoanDirect(loanData) {
  try {
    Logger.log('addLoanDirect called with: ' + JSON.stringify(loanData));
    var ss = openSheet_();
    if (!ss) {
      Logger.log('addLoanDirect: No spreadsheet connected');
      return { success: false, message: 'No spreadsheet connected.' };
    }

    var loanType = loanData.loanType;
    Logger.log('addLoanDirect: loanType = ' + loanType);
    var typeSheetName = loanType === 'Regular'
      ? 'REGULAR'
      : loanType === 'Commodity'
      ? 'COMMODITY'
      : 'SHORT-TERM';

    Logger.log('addLoanDirect: typeSheetName = ' + typeSheetName);
    var typeSheet = findSheetCI_(ss, typeSheetName);
    if (!typeSheet) {
      Logger.log('addLoanDirect: Creating new sheet ' + typeSheetName);
      typeSheet = ss.insertSheet(typeSheetName);
      typeSheet.getRange('A1:O1').setValues([[
        'LoanID', 'MemberID', 'Member Name',
        'Amount', 'Monthly Payment', 'Term (Months)',
        'Total Payable', 'Date Released', 'Maturity Date',
        'Balance', 'Status', 'School Year',
        'Total Past Dues', 'Other Deductions', 'Net Proceeds'
      ]]);
      typeSheet.getRange('A1:O1')
        .setFontWeight('bold')
        .setBackground('#F4F2EE');
      typeSheet.setFrozenRows(1);
    } else {
      Logger.log('addLoanDirect: Found existing sheet ' + typeSheetName);
    }

    // Generate LoanID
    var prefix = loanType === 'Regular' ? 'REG' : loanType === 'Commodity' ? 'COM' : 'STL';
    var loanId = generateLoanId_(typeSheet, prefix);

    // Calculate maturity date
    var term = Number(loanData.term) || 0;
    var dateReleased = loanData.dateReleased || new Date();
    var maturity = new Date(dateReleased);
    maturity.setMonth(maturity.getMonth() + term);
    var tz = Session.getScriptTimeZone();
    var maturityStr = Utilities.formatDate(maturity, tz, 'yyyy-MM-dd');
    var dateReleasedStr = Utilities.formatDate(dateReleased, tz, 'yyyy-MM-dd');

    // Determine school year
    var yr = dateReleased.getFullYear();
    var mo = dateReleased.getMonth();
    var sy = mo >= 5 ? yr + '-' + (yr + 1) : (yr - 1) + '-' + yr;

    // Calculate monthly payment if not provided
    var amount = Number(loanData.amount) || 0;
    var monthly = Number(loanData.monthly) || 0;
    if (monthly === 0 && term > 0) {
      if (loanType === 'Regular') {
        var prin = amount / term;
        var int1 = amount * 0.01;
        monthly = Math.round(prin + int1);
      } else if (loanType === 'Commodity') {
        var totalToPay = Math.round(amount * (1 + 0.01 * term));
        monthly = Math.round(totalToPay / term);
      } else {
        var totalToPay = Math.round(amount * 1.06);
        monthly = Math.round(totalToPay / term);
      }
    }

    // Calculate total payable if not provided
    var totalToPay = Number(loanData.totalToPay) || 0;
    if (totalToPay === 0) {
      totalToPay = monthly * term;
    }

    // Balance defaults to total payable if not provided
    var balance = Number(loanData.balance) || totalToPay;

    // Handle field name variations from frontend
    var pastDues = Number(loanData.pastDues) || Number(loanData.totalPastDues) || 0;
    var deductions = Number(loanData.deductions) || Number(loanData.otherDeductions) || 0;
    var netProceeds = Number(loanData.netProceeds) || (amount - pastDues - deductions);

    // Append to type-specific sheet
    Logger.log('addLoanDirect: Appending to ' + typeSheetName + ' sheet');
    typeSheet.appendRow([
      loanId,
      loanData.memberId,
      loanData.memberName,
      amount,
      monthly,
      term,
      totalToPay,
      dateReleasedStr,
      maturityStr,
      balance,
      loanData.status || 'Active',
      loanData.schoolYear || sy,
      pastDues,
      deductions,
      netProceeds
    ]);
    Logger.log('addLoanDirect: Successfully appended to ' + typeSheetName);

    // Also add to main LOANS sheet
    var loansSheet = getLoansSheet_();
    if (loansSheet) {
      Logger.log('addLoanDirect: Appending to main LOANS sheet');
      loansSheet.appendRow([
        loanId,
        loanData.memberId,
        loanData.memberName,
        amount,
        monthly,
        term,
        totalToPay,
        dateReleasedStr,
        maturityStr,
        balance,
        loanData.status || 'Active',
        sy,
        Number(loanData.totalPastDues) || 0,
        Number(loanData.otherDeductions) || 0,
        Number(loanData.netProceeds) || amount
      ]);
      Logger.log('addLoanDirect: Successfully appended to LOANS sheet');
    } else {
      Logger.log('addLoanDirect: Failed to get LOANS sheet');
    }

    // Invalidate cache
    try {
      var cache = CacheService.getScriptCache();
      cache.removeAll(['applications_data', 'members_data', 'loans_data', 'analytics_data']);
    } catch(e) {}

    Logger.log('addLoanDirect: Returning success with loanId ' + loanId);
    return { success: true, loanId: loanId };
  } catch (e) {
    Logger.log('addLoanDirect error: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Smart Loan Migration (officer data entry with months-paid calc)
// Input: loanType, memberId, memberName, amount, term,
//        dateReleased, monthsPaid, status (optional)
// Auto-calculates: monthly payment, total payable, balance
// ═══════════════════════════════════════════

function addMigrationLoan(data) {
  try {
    Logger.log('addMigrationLoan: ' + JSON.stringify(data));
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'No spreadsheet connected.' };

    var loanType = data.loanType;
    var amount = Number(data.amount) || 0;
    var term = Number(data.term) || 0;
    var monthsPaid = Number(data.monthsPaid) || 0;

    var monthly, totalToPay;
    if (loanType === 'Regular') {
      var prin = amount / term;
      var int1 = amount * 0.01;
      monthly = Math.round(prin + int1);
      totalToPay = amount;
    } else if (loanType === 'Commodity') {
      totalToPay = Math.round(amount * (1 + 0.01 * term));
      monthly = Math.round(totalToPay / term);
    } else {
      totalToPay = Math.round(amount * 1.06);
      monthly = Math.round(totalToPay / term);
    }

    var amountPaid = monthly * monthsPaid;
    var balance = Math.max(0, totalToPay - amountPaid);
    var status = data.status || (balance <= 0 ? 'Paid' : 'Active');

    var dateReleased = data.dateReleased ? new Date(data.dateReleased) : new Date();
    var maturity = new Date(dateReleased);
    maturity.setMonth(maturity.getMonth() + term);
    var tz = Session.getScriptTimeZone();
    var dateReleasedStr = Utilities.formatDate(dateReleased, tz, 'yyyy-MM-dd');
    var maturityStr = Utilities.formatDate(maturity, tz, 'yyyy-MM-dd');

    var yr = dateReleased.getFullYear();
    var mo = dateReleased.getMonth();
    var sy = mo >= 5 ? yr + '-' + (yr + 1) : (yr - 1) + '-' + yr;

    // Generate loan ID
    var prefix = loanType === 'Regular' ? 'REG' : loanType === 'Commodity' ? 'COM' : 'STL';
    var typeSheetName = loanType === 'Regular' ? 'REGULAR'
      : loanType === 'Commodity' ? 'COMMODITY' : 'SHORT-TERM';
    var typeSheet = findSheetCI_(ss, typeSheetName);
    if (!typeSheet) {
      typeSheet = ss.insertSheet(typeSheetName);
      typeSheet.getRange('A1:O1').setValues([[
        'LoanID', 'MemberID', 'Member Name', 'Amount', 'Monthly Payment',
        'Term (Months)', 'Total Payable', 'Date Released', 'Maturity Date',
        'Balance', 'Status', 'School Year', 'Total Past Dues', 'Other Deductions', 'Net Proceeds'
      ]]);
      typeSheet.getRange('A1:O1').setFontWeight('bold').setBackground('#F4F2EE');
      typeSheet.setFrozenRows(1);
    }
    var loanId = generateLoanId_(typeSheet, prefix);

    var rowData = [
      loanId, data.memberId, data.memberName, amount, monthly, term,
      totalToPay, dateReleasedStr, maturityStr, balance, status, sy, 0, 0, amount
    ];

    typeSheet.appendRow(rowData);

    var loansSheet = getLoansSheet_();
    if (loansSheet) loansSheet.appendRow(rowData);

    try {
      var cache = CacheService.getScriptCache();
      cache.removeAll(['applications_data', 'members_data', 'loans_data', 'analytics_data']);
    } catch(e) {}

    return { success: true, loanId: loanId };
  } catch (e) {
    Logger.log('addMigrationLoan error: ' + e.message);
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Get a member's loans (member dashboard)
// Merges LOANS sheet + approved APPLICATION rows
// so old approvals still show up
// ═══════════════════════════════════════════

function getMemberLoans(memberId) {
  try {
    var loans = [];
    var seen = {}; // track to avoid duplicates

    // Normalize the memberId (phone) to last 10 digits for matching
    var inputDigits = String(memberId).trim().replace(/\D/g, '');
    if (inputDigits.length > 10) inputDigits = inputDigits.slice(-10);

    // Helper: check if a stored ID matches the input (same normalization as loginMember)
    function idsMatch(storedId) {
      var stored = String(storedId).trim().replace(/\D/g, '');
      if (stored.length > 10) stored = stored.slice(-10);
      // Match on normalized digits OR exact string
      return (stored.length > 0 && stored === inputDigits)
          || String(storedId).trim().toUpperCase() === String(memberId).trim().toUpperCase();
    }

    // 1. Read from LOANS sheet (primary source)
    // Columns: A=LoanID(0) B=MemberID(1) C=Name(2) D=Amount(3) E=Monthly(4)
    //          F=Term(5) G=TotalPayable(6) H=DateReleased(7) I=MaturityDate(8)
    //          J=Balance(9) K=Status(10) L=SchoolYear(11)
    var loansSheet = getLoansSheet_();
    if (loansSheet) {
      var data = loansSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[0] && !row[1]) continue;
        // MemberID is column B (index 1)
        if (!idsMatch(row[1])) continue;
        // Derive loanType from LoanID prefix
        var loanId = String(row[0]);
        var lt = loanId.indexOf('REG') === 0 ? 'Regular'
               : loanId.indexOf('COM') === 0 ? 'Commodity' : 'Short Term';
        var key = loanId; // unique per loan record
        seen[key] = true;
        loans.push({
          loanId:     loanId,
          loanType:   lt,
          amount:     Number(row[3]) || 0,   // D = Amount
          monthly:    Number(row[4]) || 0,   // E = Monthly Payment
          term:       Number(row[5]) || 0,   // F = Term
          totalToPay: Number(row[6]) || 0,   // G = Total Payable
          startDate:  row[7]
            ? Utilities.formatDate(
                new Date(row[7]),
                Session.getScriptTimeZone(),
                'MMM dd, yyyy')
            : '',
          maturityDate: row[8]
            ? Utilities.formatDate(
                new Date(row[8]),
                Session.getScriptTimeZone(),
                'MMM dd, yyyy')
            : '',
          balance:    Number(row[9]) || 0,   // J = live Balance (decreases on payment)
          status:     String(row[10]) || 'Active'  // K = Status
        });
      }
    }

    // 2. Also check APPLICATION sheet for Approved
    // entries not already in LOANS (handles old approvals)
    var appSheet = getApplicationSheet_();
    if (appSheet) {
      var appData = appSheet
        .getDataRange().getValues();
      for (var j = 1; j < appData.length; j++) {
        var ar = appData[j];
        if (!ar[0]) continue;
        if (!idsMatch(ar[0])) continue;
        if (String(ar[8]).toLowerCase()
          !== 'approved') continue;
        var aLoanType = String(ar[3]);
        // Skip if this member+loanType combo already came from LOANS sheet
        var alreadySeen = loans.some(function(l) {
          return l.loanType === aLoanType;
        });
        if (alreadySeen) continue; // already in LOANS
        // Compute payment
        var amt  = Number(ar[4]) || 0;
        var term = Number(ar[5]) || 0;
        var monthly, totalToPay;
        var lt = String(ar[3]);
        if (lt === 'Regular') {
          monthly = Math.round(
            amt / term + amt * 0.01);
          totalToPay = amt;
        } else if (lt === 'Commodity') {
          totalToPay = Math.round(
            amt * (1 + 0.01 * term));
          monthly = Math.round(
            totalToPay / term);
        } else {
          totalToPay = Math.round(amt * 1.06);
          monthly = Math.round(
            totalToPay / term);
        }
        var startDate = ar[7]
          ? Utilities.formatDate(
              new Date(ar[7]),
              Session.getScriptTimeZone(),
              'MMM dd, yyyy')
          : Utilities.formatDate(
              new Date(ar[6]),
              Session.getScriptTimeZone(),
              'MMM dd, yyyy');
        var startD = new Date(startDate);
        if (!isNaN(startD.getTime())) {
          startD.setMonth(startD.getMonth() + term);
        }
        var maturityDate = !isNaN(startD.getTime())
          ? Utilities.formatDate(startD, Session.getScriptTimeZone(), 'MMM dd, yyyy')
          : '';
        loans.push({
          loanType:   lt,
          amount:     amt,
          term:       term,
          monthly:    monthly,
          totalToPay: totalToPay,
          balance:    totalToPay,
          startDate:  startDate,
          maturityDate: maturityDate,
          status:     'Active'
        });
      }
    }

    return { success: true, loans: loans };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Get a member's applications (member side)
// ═══════════════════════════════════════════

function getMemberApplications(memberId) {
  try {
    var sheet = getApplicationSheet_();
    if (!sheet) {
      return { success: false,
        message: 'No spreadsheet connected.' };
    }

    // Normalize the memberId (phone) to last 10 digits for matching
    var inputDigits = String(memberId).trim().replace(/\D/g, '');
    if (inputDigits.length > 10) inputDigits = inputDigits.slice(-10);

    function idsMatch(storedId) {
      var stored = String(storedId).trim().replace(/\D/g, '');
      if (stored.length > 10) stored = stored.slice(-10);
      return (stored.length > 0 && stored === inputDigits)
          || String(storedId).trim().toUpperCase() === String(memberId).trim().toUpperCase();
    }

    var data = sheet.getDataRange().getValues();
    var apps = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!idsMatch(row[0])) continue;
      apps.push({
        loanType:    String(row[3]),
        amount:      Number(row[4]) || 0,
        term:        Number(row[5]) || 0,
        dateSubmitted: row[6]
          ? Utilities.formatDate(
              new Date(row[6]),
              Session.getScriptTimeZone(),
              'MMM dd, yyyy')
          : '',
        status:      String(row[8]) || 'Pending'
      });
    }
    return { success: true, apps: apps };
  } catch (e) {
    return {
      success: false,
      message: e.message
    };
  }
}

// ═══════════════════════════════════════════
// Get loans by type for admin pages
// typePrefix: 'STL', 'REG', or 'COM'
// ═══════════════════════════════════════════

function getLoansByType(typePrefix) {
  try {
    var sheet = getLoansSheet_();
    if (!sheet) {
      return { success: false,
        message: 'No spreadsheet connected.' };
    }
    var tz = Session.getScriptTimeZone();
    var data = sheet.getDataRange().getValues();
    var loans = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var lid = String(row[0]);
      if (lid.indexOf(typePrefix) !== 0) continue;
      loans.push({
        loanId:      lid,
        memberId:    String(row[1]),
        memberName:  String(row[2]),
        amount:      Number(row[3]) || 0,
        monthly:     Number(row[4]) || 0,
        term:        Number(row[5]) || 0,
        totalPayable: Number(row[6]) || 0,
        dateReleased: row[7]
          ? Utilities.formatDate(
              new Date(row[7]), tz,
              'MMM dd, yyyy')
          : '',
        maturityDate: row[8]
          ? Utilities.formatDate(
              new Date(row[8]), tz,
              'MMM dd, yyyy')
          : '',
        balance:     Number(row[9]) || 0,
        status:      String(row[10]) || 'Active',
        schoolYear:  String(row[11]) || '',
        totalPastDues: Number(row[12]) || 0,
        otherDeductions: Number(row[13]) || 0,
        netProceeds:   Number(row[14]) || 0
      });
    }
    return { success: true, loans: loans };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Get pending applications by loan type for officer pages
// loanType: 'Regular', 'Short Term', or 'Commodity'
// ═══════════════════════════════════════════

function getPendingApplicationsByType(loanType) {
  try {
    var sheet = getApplicationSheet_();
    if (!sheet) {
      return { success: false, message: 'No spreadsheet connected.' };
    }
    var tz = Session.getScriptTimeZone();
    var data = sheet.getDataRange().getValues();
    var apps = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var appLoanType = String(row[3] || '').trim();
      var status = String(row[8] || '').trim() || 'Pending';
      
      // Filter by loan type and pending status (or in settlement for final release)
      // Use case-insensitive comparison for loan type
      if (appLoanType.toLowerCase() !== loanType.toLowerCase()) continue;
      if (status !== 'Pending' && status !== 'Approved (In Settlement)') continue;
      
      apps.push({
        row: i + 1,
        memberId:    String(row[0]),
        firstName:   String(row[1]),
        lastName:    String(row[2]),
        loanType:    appLoanType,
        amount:      Number(row[4]) || 0,
        term:        Number(row[5]) || 0,
        dateSubmitted: row[6]
          ? Utilities.formatDate(new Date(row[6]), tz, 'MMM dd, yyyy')
          : '',
        dateApproved: row[7]
          ? Utilities.formatDate(new Date(row[7]), tz, 'MMM dd, yyyy')
          : '',
        status:      status,
        reason:      String(row[9]) || '',
        totalPastDues: Number(row[10]) || 0,
        otherDeductions: Number(row[11]) || 0,
        netProceeds:   Number(row[12]) || 0
      });
    }
    var dedDefaults = {};
    try { dedDefaults = getDeductionSettings(); } catch(e) {}
    return { success: true, apps: apps, dedDefaults: dedDefaults };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Collections data (admin side)
// Reads Payments and Loans sheets
// ═══════════════════════════════════════════
function getCollectionsData() {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var tz = Session.getScriptTimeZone();

    var today = new Date();
    var thisMonth = today.getMonth();
    var thisYear = today.getFullYear();

    // Read payments
    var paySheet = findSheetCI_(ss, 'Payments');
    var payments = [];
    if (paySheet) {
      var pData = paySheet.getDataRange().getValues();
      for (var i = 1; i < pData.length; i++) {
        var r = pData[i];
        if (!r[0] && !r[1]) continue;
        payments.push({
          memberId:   String(r[1]),
          memberName: String(r[2]),
          loanType:   String(r[4]),
          amount:     Number(r[6]) || 0,
          datePaid:   r[9] ? String(r[9]) : '',
          status:     String(r[11]) || 'Pending'
        });
      }
    }

    // Read loans for outstanding balance
    var loanSheet = findSheetCI_(ss, 'Loans');
    var totalOutstanding = 0;
    var totalMonthlyDue = 0;
    if (loanSheet) {
      var lData = loanSheet.getDataRange().getValues();
      for (var j = 1; j < lData.length; j++) {
        var lr = lData[j];
        if (String(lr[10]).toLowerCase() === 'active') {
          totalOutstanding += Number(lr[9]) || 0;
          totalMonthlyDue += Number(lr[4]) || 0;
        }
      }
    }

    // Aggregate confirmed payments
    var confirmed = payments.filter(function(p) { return p.status === 'Confirmed'; });
    var totalCollected = confirmed.reduce(function(s, p) { return s + p.amount; }, 0);
    var collectedThisMonth = 0;
    confirmed.forEach(function(p) {
      if (p.datePaid) {
        var d = new Date(p.datePaid);
        if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
          collectedThisMonth += p.amount;
        }
      }
    });

    // By type
    var byType = { 'Short Term': 0, 'Regular': 0, 'Commodity': 0 };
    confirmed.forEach(function(p) {
      var t = p.loanType || '';
      if (t.toLowerCase().indexOf('short') !== -1) byType['Short Term'] += p.amount;
      else if (t.toLowerCase().indexOf('regular') !== -1) byType['Regular'] += p.amount;
      else if (t.toLowerCase().indexOf('commod') !== -1) byType['Commodity'] += p.amount;
    });

    // Collection list (each confirmed payment as a row)
    var collList = confirmed.map(function(p) {
      return {
        memberId:   p.memberId,
        memberName: p.memberName,
        loanType:   p.loanType,
        amount:     p.amount,
        datePaid:   p.datePaid
      };
    });

    var rate = totalMonthlyDue > 0
      ? Math.round((collectedThisMonth / totalMonthlyDue) * 100)
      : 0;

    return {
      success: true,
      collectedThisMonth: collectedThisMonth,
      totalCollected: totalCollected,
      totalOutstanding: totalOutstanding,
      totalMonthlyDue: totalMonthlyDue,
      collectionRate: rate,
      byType: byType,
      collections: collList
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Overdue loans (admin side)
// Active loans past maturity date
// ═══════════════════════════════════════════
function getOverdueLoans() {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var tz = Session.getScriptTimeZone();

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var loanSheet = findSheetCI_(ss, 'Loans');
    if (!loanSheet) return { success: true, overdue: [] };

    var data = loanSheet.getDataRange().getValues();

    // Also read payments to find last payment date per member
    var paySheet = findSheetCI_(ss, 'Payments');
    var lastPayment = {};
    if (paySheet) {
      var pData = paySheet.getDataRange().getValues();
      for (var p = 1; p < pData.length; p++) {
        var pr = pData[p];
        if (String(pr[11]) === 'Confirmed' && pr[9]) {
          var key = String(pr[1]).toUpperCase();
          var pd = new Date(pr[9]);
          if (!lastPayment[key] || pd > lastPayment[key]) {
            lastPayment[key] = pd;
          }
        }
      }
    }

    var overdue = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var status = String(row[10]).toLowerCase();
      if (status !== 'active') continue;
      var balance = Number(row[9]) || 0;
      if (balance <= 0) continue;
      var maturity = row[8] ? new Date(row[8]) : null;
      if (!maturity) continue;
      maturity.setHours(0, 0, 0, 0);
      if (maturity >= today) continue; // not overdue yet

      var daysOver = Math.floor((today - maturity) / (1000 * 60 * 60 * 24));
      var mid = String(row[1]).toUpperCase();
      var lp = lastPayment[mid];

      overdue.push({
        loanId:      String(row[0]),
        memberId:    String(row[1]),
        memberName:  String(row[2]),
        loanType:    String(row[0]).indexOf('STL') === 0 ? 'Short Term'
                   : String(row[0]).indexOf('REG') === 0 ? 'Regular'
                   : String(row[0]).indexOf('COM') === 0 ? 'Commodity' : 'Loan',
        amount:      Number(row[3]) || 0,
        monthly:     Number(row[4]) || 0,
        balance:     balance,
        maturityDate: Utilities.formatDate(maturity, tz, 'MMM dd, yyyy'),
        daysOverdue: daysOver,
        lastPayment: lp ? Utilities.formatDate(lp, tz, 'MMM dd, yyyy') : 'None'
      });
    }

    var totalAmt = overdue.reduce(function(s, o) { return s + o.balance; }, 0);
    var avgDays = overdue.length > 0
      ? Math.round(overdue.reduce(function(s, o) { return s + o.daysOverdue; }, 0) / overdue.length)
      : 0;

    return {
      success: true,
      overdue: overdue,
      totalOverdue: overdue.length,
      totalOverdueAmt: totalAmt,
      avgDaysOverdue: avgDays
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Analytics Dashboard Data
// Aggregates loans + payments for charting
// ═══════════════════════════════════════════

function getAnalyticsData() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('analytics_data');
    if (cached) {
      try { return JSON.parse(cached); } catch(e) {}
    }

    var ss = openSheet_();
    if (!ss) return { success: false, message: 'No spreadsheet connected.' };
    var tz = Session.getScriptTimeZone();
    var now = new Date();

    // ── Read LOANS sheet ──
    var loansSheet = findSheetCI_(ss, 'Loans');
    var loans = [];
    if (loansSheet) {
      var ld = loansSheet.getDataRange().getValues();
      Logger.log('Analytics: LOANS sheet has ' + ld.length + ' rows');
      for (var i = 1; i < ld.length; i++) {
        var r = ld[i];
        if (!r[0]) continue;
        var loanId = String(r[0]);
        var lt = loanId.indexOf('REG') === 0 ? 'Regular'
               : loanId.indexOf('COM') === 0 ? 'Commodity' : 'Short Term';
        loans.push({
          loanId: loanId,
          type: lt,
          amount: Number(r[3]) || 0,
          monthly: Number(r[4]) || 0,
          term: Number(r[5]) || 0,
          totalPayable: Number(r[6]) || 0,
          dateReleased: r[7] ? new Date(r[7]) : null,
          maturityDate: r[8] ? new Date(r[8]) : null,
          balance: Number(r[9]) || 0,
          status: String(r[10]) || 'Active',
          schoolYear: String(r[11]) || ''
        });
      }
      Logger.log('Analytics: Found ' + loans.length + ' loans in LOANS sheet');
    } else {
      Logger.log('Analytics: LOANS sheet not found');
    }

    // ── Read PAYMENTS sheet ──
    var paySheet = findSheetCI_(ss, 'Payments');
    var payments = [];
    if (paySheet) {
      var pd = paySheet.getDataRange().getValues();
      for (var j = 1; j < pd.length; j++) {
        var pr = pd[j];
        if (!pr[0] && !pr[1]) continue;
        if (String(pr[11]) !== 'Confirmed') continue;
        var dpStr = String(pr[9]);
        var dp = dpStr ? new Date(dpStr) : (pr[0] ? new Date(pr[0]) : null);
        payments.push({
          loanType: String(pr[4]),
          amount: Number(pr[6]) || 0,
          datePaid: dp,
          month: dp ? dp.getMonth() : -1,
          year: dp ? dp.getFullYear() : 0
        });
      }
    }

    // ── Read APPLICATIONS sheet ──
    var appSheet = findSheetCI_(ss, 'Application');
    var pendingApps = 0;
    if (appSheet) {
      var ad = appSheet.getDataRange().getValues();
      for (var k = 1; k < ad.length; k++) {
        if (String(ad[k][8]).toLowerCase() === 'pending') pendingApps++;
      }
    }

    // ── Aggregate by type ──
    var types = ['Short Term', 'Regular', 'Commodity'];
    var typeData = {};
    types.forEach(function(t) {
      typeData[t] = {
        loans: 0, active: 0, paid: 0, overdue: 0, pending: 0,
        totalReleased: 0, totalCollected: 0, outstanding: 0,
        maxAmount: 0, maxTerm: 0, totalAmount: 0,
        interestRate: t === 'Short Term' ? '6% flat'
                    : t === 'Regular' ? '1% diminishing'
                    : '1%/month'
      };
    });

    loans.forEach(function(l) {
      var td = typeData[l.type];
      if (!td) return;
      td.loans++;
      td.totalReleased += l.amount;
      td.totalAmount += l.amount;
      td.outstanding += l.balance;
      if (l.amount > td.maxAmount) td.maxAmount = l.amount;
      if (l.term > td.maxTerm) td.maxTerm = l.term;

      var s = l.status.toLowerCase();
      if (s === 'active') td.active++;
      else if (s === 'paid' || s === 'fully paid') td.paid++;
      else if (s === 'overdue') td.overdue++;
      else if (s === 'pending') td.pending++;
    });

    // Assign confirmed payments to type
    payments.forEach(function(p) {
      var td = typeData[p.loanType];
      if (td) td.totalCollected += p.amount;
    });

    // Compute derived fields
    var totalActive = 0, totalReleased = 0, totalCollected = 0, totalOverdue = 0;
    types.forEach(function(t) {
      var td = typeData[t];
      td.avgLoanSize = td.loans > 0 ? Math.round(td.totalReleased / td.loans) : 0;
      td.collectionRate = td.totalReleased > 0
        ? Math.round((td.totalCollected / td.totalReleased) * 100) : 0;
      td.paidOff = td.paid + '/' + td.loans;
      totalActive += td.active;
      totalReleased += td.totalReleased;
      totalCollected += td.totalCollected;
      totalOverdue += td.overdue;
    });

    // ── Monthly collection series (last 6 months) ──
    var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var monthlySeries = [];
    for (var m = 5; m >= 0; m--) {
      var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      var mo = d.getMonth();
      var yr = d.getFullYear();
      var entry = { label: monthNames[mo], st: 0, reg: 0, com: 0 };
      payments.forEach(function(p) {
        if (p.month === mo && p.year === yr) {
          if (p.loanType === 'Short Term') entry.st += p.amount;
          else if (p.loanType === 'Regular') entry.reg += p.amount;
          else if (p.loanType === 'Commodity') entry.com += p.amount;
        }
      });
      monthlySeries.push(entry);
    }

    var result = {
      success: true,
      kpi: {
        totalActive: totalActive,
        totalReleased: totalReleased,
        totalCollected: totalCollected,
        collectionRate: totalReleased > 0
          ? Math.round((totalCollected / totalReleased) * 1000) / 10 : 0,
        totalOverdue: totalOverdue,
        pendingApps: pendingApps
      },
      types: typeData,
      monthlySeries: monthlySeries
    };

    try { cache.put('analytics_data', JSON.stringify(result), 120); } catch(e) {}
    return result;
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// REPORTS — Aggregated data for admin reports
// Supports weekly, monthly, and yearly periods
// ═══════════════════════════════════════════

function getReportData(params) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'No spreadsheet connected.' };
    var tz = Session.getScriptTimeZone();
    var year = Number(params.year) || new Date().getFullYear();
    var period = params.period || 'monthly';

    // ── Build date ranges ──
    var mNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var ranges = [];
    if (period === 'weekly') {
      var mo = Number(params.month);
      var week = Number(params.week) || 1;
      var startDay = (week - 1) * 7 + 1;
      var endDay = Math.min(week * 7, new Date(year, mo + 1, 0).getDate());
      ranges.push({
        label: 'Week ' + week + ' — ' + mNames[mo].slice(0,3) + ' ' + year,
        start: new Date(year, mo, startDay, 0, 0, 0),
        end:   new Date(year, mo, endDay, 23, 59, 59)
      });
    } else if (period === 'monthly') {
      var months = params.months || [];
      for (var m = 0; m < months.length; m++) {
        var mi = Number(months[m]);
        var lastD = new Date(year, mi + 1, 0).getDate();
        ranges.push({ label: mNames[mi] + ' ' + year, start: new Date(year, mi, 1, 0, 0, 0), end: new Date(year, mi, lastD, 23, 59, 59) });
      }
    } else {
      for (var y = 0; y < 12; y++) {
        var ld = new Date(year, y + 1, 0).getDate();
        ranges.push({ label: mNames[y] + ' ' + year, start: new Date(year, y, 1, 0, 0, 0), end: new Date(year, y, ld, 23, 59, 59) });
      }
    }

    var overallStart = ranges.length > 0 ? ranges[0].start : new Date(year, 0, 1);
    var overallEnd   = ranges.length > 0 ? ranges[ranges.length - 1].end : new Date(year, 11, 31, 23, 59, 59);

    // ── Read sheets ──
    var loansSheet = findSheetCI_(ss, 'Loans');
    var paySheet   = findSheetCI_(ss, 'Payments');
    var memSheet   = findSheetCI_(ss, 'Members');
    var appSheet   = findSheetCI_(ss, 'Application');

    var allLoans = [];
    if (loansSheet) {
      var ldd = loansSheet.getDataRange().getValues();
      for (var i = 1; i < ldd.length; i++) {
        var r = ldd[i]; if (!r[0]) continue;
        var lid = String(r[0]);
        allLoans.push({ loanId: lid, memberId: String(r[1]), memberName: String(r[2]),
          type: lid.indexOf('REG') === 0 ? 'Regular' : lid.indexOf('COM') === 0 ? 'Commodity' : 'Short Term',
          amount: Number(r[3]) || 0, monthly: Number(r[4]) || 0, term: Number(r[5]) || 0,
          totalPayable: Number(r[6]) || 0, dateReleased: r[7] ? new Date(r[7]) : null,
          maturityDate: r[8] ? new Date(r[8]) : null, balance: Number(r[9]) || 0, status: String(r[10]) || 'Active' });
      }
    }

    var allPayments = [];
    if (paySheet) {
      var pdd = paySheet.getDataRange().getValues();
      for (var j = 1; j < pdd.length; j++) {
        var pr = pdd[j]; if (!pr[0] && !pr[1]) continue;
        var dpStr = String(pr[9]);
        var dp = dpStr ? new Date(dpStr) : (pr[0] ? new Date(pr[0]) : null);
        allPayments.push({ memberId: String(pr[1]), memberName: String(pr[2]), loanType: String(pr[4]),
          amount: Number(pr[6]) || 0, datePaid: dp, status: String(pr[11]) || 'Pending', orNumber: String(pr[13] || '') });
      }
    }

    var allMembers = [];
    if (memSheet) {
      var mdd = memSheet.getDataRange().getValues();
      for (var k = 1; k < mdd.length; k++) {
        if (!mdd[k][0]) continue;
        allMembers.push({ username: String(mdd[k][0]), memberType: String(mdd[k][3]), dateJoined: mdd[k][8] ? new Date(mdd[k][8]) : null });
      }
    }

    var allApps = [];
    if (appSheet) {
      var add = appSheet.getDataRange().getValues();
      for (var a = 1; a < add.length; a++) {
        if (!add[a][0]) continue;
        allApps.push({ memberId: String(add[a][0]), loanType: String(add[a][3]), amount: Number(add[a][4]) || 0,
          dateSubmitted: add[a][6] ? new Date(add[a][6]) : null, status: String(add[a][8]) || 'Pending' });
      }
    }

    function inRange(d, s, e) { return d && d >= s && d <= e; }

    // ── Aggregate per range ──
    var periodData = [];
    for (var p = 0; p < ranges.length; p++) {
      var rng = ranges[p];
      var entry = { label: rng.label, loansReleased: 0, amtReleased: 0,
        releasedSTL: 0, releasedREG: 0, releasedCOM: 0, amtSTL: 0, amtREG: 0, amtCOM: 0,
        paymentsReceived: 0, amtCollected: 0, collSTL: 0, collREG: 0, collCOM: 0,
        appsSubmitted: 0, appsApproved: 0, appsRejected: 0, appsPending: 0, newMembers: 0 };

      allLoans.forEach(function(l) {
        if (inRange(l.dateReleased, rng.start, rng.end)) {
          entry.loansReleased++; entry.amtReleased += l.amount;
          if (l.type === 'Short Term') { entry.releasedSTL++; entry.amtSTL += l.amount; }
          else if (l.type === 'Regular') { entry.releasedREG++; entry.amtREG += l.amount; }
          else { entry.releasedCOM++; entry.amtCOM += l.amount; }
        }
      });

      allPayments.forEach(function(pay) {
        if (pay.status === 'Confirmed' && inRange(pay.datePaid, rng.start, rng.end)) {
          entry.paymentsReceived++; entry.amtCollected += pay.amount;
          var t = (pay.loanType || '').toLowerCase();
          if (t.indexOf('short') !== -1) entry.collSTL += pay.amount;
          else if (t.indexOf('regular') !== -1) entry.collREG += pay.amount;
          else if (t.indexOf('commod') !== -1) entry.collCOM += pay.amount;
        }
      });

      allApps.forEach(function(app) {
        if (inRange(app.dateSubmitted, rng.start, rng.end)) {
          entry.appsSubmitted++;
          var st = app.status.toLowerCase();
          if (st === 'approved' || st.indexOf('approved') !== -1) entry.appsApproved++;
          else if (st === 'rejected') entry.appsRejected++;
          else entry.appsPending++;
        }
      });

      allMembers.forEach(function(mem) { if (inRange(mem.dateJoined, rng.start, rng.end)) entry.newMembers++; });

      periodData.push(entry);
    }

    // ── Portfolio snapshot ──
    var activeLoans = 0, totalOutstanding = 0, overdueCount = 0, overdueAmt = 0;
    var nowD = new Date(); nowD.setHours(0,0,0,0);
    allLoans.forEach(function(l) {
      if (l.status.toLowerCase() === 'active') {
        activeLoans++; totalOutstanding += l.balance;
        if (l.maturityDate && l.maturityDate < nowD && l.balance > 0) { overdueCount++; overdueAmt += l.balance; }
      }
    });

    // ── Totals ──
    var totals = { loansReleased: 0, amtReleased: 0, paymentsReceived: 0, amtCollected: 0,
      appsSubmitted: 0, appsApproved: 0, appsRejected: 0, newMembers: 0,
      releasedSTL: 0, releasedREG: 0, releasedCOM: 0, amtSTL: 0, amtREG: 0, amtCOM: 0,
      collSTL: 0, collREG: 0, collCOM: 0 };
    periodData.forEach(function(e) {
      totals.loansReleased += e.loansReleased; totals.amtReleased += e.amtReleased;
      totals.paymentsReceived += e.paymentsReceived; totals.amtCollected += e.amtCollected;
      totals.appsSubmitted += e.appsSubmitted; totals.appsApproved += e.appsApproved;
      totals.appsRejected += e.appsRejected; totals.newMembers += e.newMembers;
      totals.releasedSTL += e.releasedSTL; totals.releasedREG += e.releasedREG; totals.releasedCOM += e.releasedCOM;
      totals.amtSTL += e.amtSTL; totals.amtREG += e.amtREG; totals.amtCOM += e.amtCOM;
      totals.collSTL += e.collSTL; totals.collREG += e.collREG; totals.collCOM += e.collCOM;
    });
    totals.netCashFlow = totals.amtCollected - totals.amtReleased;
    totals.collectionRate = totals.amtReleased > 0 ? Math.round((totals.amtCollected / totals.amtReleased) * 1000) / 10 : 0;

    return { success: true, period: period, year: year, periodData: periodData, totals: totals,
      portfolio: { totalMembers: allMembers.length, activeLoans: activeLoans, totalOutstanding: totalOutstanding, overdueCount: overdueCount, overdueAmt: overdueAmt },
      generatedAt: Utilities.formatDate(new Date(), tz, 'MMM dd, yyyy hh:mm a') };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// GENERATE DEMO DATA (for presentations / final defense)
// Creates loan records for members without loans, then
// generates random months of confirmed payment history.
// ═══════════════════════════════════════════

function randomBetween_(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getSchoolYear_(date) {
  var yr = date.getFullYear();
  var mo = date.getMonth();
  return mo >= 5 ? yr + '-' + (yr + 1) : (yr - 1) + '-' + yr;
}

function generateDemoData() {
  var ss = openSheet_();
  if (!ss) return { success: false, message: 'Spreadsheet not connected.' };

  var log = [];
  var tz = Session.getScriptTimeZone();

  // 1. Read all members
  var memSheet = findSheetCI_(ss, 'Members');
  if (!memSheet) return { success: false, message: 'Members sheet not found.' };
  var memData = memSheet.getDataRange().getValues();

  // 2. Read existing loans
  var loansSheet = getLoansSheet_();
  var existingLoanMembers = {};
  var allLoans = [];
  if (loansSheet) {
    var ld = loansSheet.getDataRange().getValues();
    for (var i = 1; i < ld.length; i++) {
      var r = ld[i];
      if (!r[1]) continue;
      existingLoanMembers[String(r[1]).toUpperCase()] = true;
      var lid = String(r[0]);
      allLoans.push({
        loanId: lid,
        memberId: String(r[1]),
        memberName: String(r[2]),
        amount: Number(r[3]) || 0,
        monthly: Number(r[4]) || 0,
        term: Number(r[5]) || 0,
        totalPayable: Number(r[6]) || 0,
        balance: Number(r[9]) || 0,
        status: String(r[10]) || 'Active',
        loanType: lid.indexOf('REG') === 0 ? 'Regular' : lid.indexOf('COM') === 0 ? 'Commodity' : 'Short Term'
      });
    }
  }

  var loansCreated = 0;
  var paymentsCreated = 0;
  var totalAmountPaid = 0;

  // 3. Create loans for members without any
  for (var m = 1; m < memData.length; m++) {
    var mr = memData[m];
    var memberId = String(mr[0] || '').trim();
    if (!memberId) continue;
    if (existingLoanMembers[memberId.toUpperCase()]) continue;

    var firstName = String(mr[4] || '');
    var lastName = String(mr[5] || '');
    var memberType = String(mr[3] || 'Job Order');
    var memberName = lastName + ', ' + firstName;

    var loanType, amount, term;
    if (memberType === 'Teacher') {
      loanType = Math.random() < 0.6 ? 'Regular' : 'Short Term';
    } else {
      loanType = 'Short Term';
    }
    if (loanType === 'Regular') {
      amount = randomBetween_(20000, 100000);
      term = randomBetween_(6, 24);
    } else if (loanType === 'Commodity') {
      amount = randomBetween_(1000, 5000);
      term = randomBetween_(1, 2);
    } else {
      amount = randomBetween_(3000, 15000);
      term = randomBetween_(2, 6);
    }

    var monthly, totalToPay;
    if (loanType === 'Regular') {
      monthly = Math.round(amount / term + amount * 0.01);
      totalToPay = amount;
    } else if (loanType === 'Commodity') {
      totalToPay = Math.round(amount * (1 + 0.01 * term));
      monthly = Math.round(totalToPay / term);
    } else {
      totalToPay = Math.round(amount * 1.06);
      monthly = Math.round(totalToPay / term);
    }

    var releasedDate = new Date();
    releasedDate.setMonth(releasedDate.getMonth() - randomBetween_(2, 6));
    releasedDate.setDate(randomBetween_(1, 28));

    var maturityDate = new Date(releasedDate);
    maturityDate.setMonth(maturityDate.getMonth() + term);

    var sy = getSchoolYear_(releasedDate);
    var prefix = loanType === 'Regular' ? 'REG' : loanType === 'Commodity' ? 'COM' : 'STL';
    var typeSheetName = loanType === 'Regular' ? 'REGULAR' : loanType === 'Commodity' ? 'COMMODITY' : 'SHORT-TERM';

    var typeSheet = findSheetCI_(ss, typeSheetName);
    if (!typeSheet) {
      typeSheet = ss.insertSheet(typeSheetName);
      typeSheet.getRange('A1:O1').setValues([[
        'LoanID', 'MemberID', 'Member Name', 'Amount', 'Monthly Payment',
        'Term (Months)', 'Total Payable', 'Date Released', 'Maturity Date',
        'Balance', 'Status', 'School Year', 'Total Past Dues', 'Other Deductions', 'Net Proceeds'
      ]]);
      typeSheet.getRange('A1:O1').setFontWeight('bold').setBackground('#F4F2EE');
      typeSheet.setFrozenRows(1);
    }

    // Generate loan ID from type sheet
    var td = typeSheet.getDataRange().getValues();
    var maxNum = 0;
    for (var ti = 1; ti < td.length; ti++) {
      var id = String(td[ti][0]);
      if (id.indexOf(prefix) === 0) {
        var num = parseInt(id.split('-')[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    var loanId = prefix + '-' + ('00' + (maxNum + 1)).slice(-3);
    var dateReleasedStr = Utilities.formatDate(releasedDate, tz, 'yyyy-MM-dd');
    var maturityStr = Utilities.formatDate(maturityDate, tz, 'yyyy-MM-dd');

    var rowData = [loanId, memberId, memberName, amount, monthly, term, totalToPay, dateReleasedStr, maturityStr, totalToPay, 'Active', sy, 0, 0, amount];
    typeSheet.appendRow(rowData);
    if (loansSheet) loansSheet.appendRow(rowData);

    allLoans.push({
      loanId: loanId,
      memberId: memberId,
      memberName: memberName,
      amount: amount,
      monthly: monthly,
      term: term,
      totalPayable: totalToPay,
      balance: totalToPay,
      status: 'Active',
      loanType: loanType
    });

    loansCreated++;
    log.push('Created ' + loanType + ' loan ' + loanId + ' for ' + memberName);
  }

  // 4. Generate payments for all active loans
  var paySheet = findSheetCI_(ss, 'Payments');
  if (!paySheet) {
    paySheet = ss.insertSheet('Payments');
    paySheet.getRange('A1:N1').setValues([[
      'TIMESTAMP', 'MEMBER-ID', 'MEMBER-NAME', 'EMAIL',
      'LOAN-TYPE', 'MONTH-NUM', 'AMOUNT', 'METHOD',
      'REFERENCE', 'DATE-PAID', 'NOTES', 'STATUS', 'PROOF-URL', 'OR-NUMBER'
    ]]);
    paySheet.getRange('A1:N1').setFontWeight('bold').setBackground('#F4F2EE');
    paySheet.setFrozenRows(1);
  }

  var methods = ['Cash', 'Cash', 'Cash', 'GCash', 'GCash', 'Counter'];

  for (var li = 0; li < allLoans.length; li++) {
    var loan = allLoans[li];
    if (loan.status !== 'Active' || loan.balance <= 0) continue;

    var maxMonths = Math.min(loan.term || 3, 5);
    var monthsToPay = randomBetween_(1, Math.max(1, maxMonths));
    var perMonth = Math.min(loan.monthly, Math.round(loan.balance / monthsToPay));

    for (var p = 0; p < monthsToPay; p++) {
      if (loan.balance <= 0) break;

      var payDate = new Date();
      payDate.setMonth(payDate.getMonth() - (monthsToPay - 1 - p));
      payDate.setDate(randomBetween_(1, 28));

      var amount = Math.min(perMonth, loan.balance);
      if (amount <= 0) break;

      var method = methods[Math.floor(Math.random() * methods.length)];
      var ref = method === 'GCash' ? 'REF' + Math.floor(Math.random() * 900000 + 100000) : '';
      var orNum = 'OR-' + Utilities.formatDate(payDate, tz, 'yyyyMMdd') + '-' + ('0000' + (Math.floor(Math.random() * 9000) + 1000)).slice(-4);
      var ts = Utilities.formatDate(payDate, tz, 'yyyy-MM-dd HH:mm:ss');
      var dp = Utilities.formatDate(payDate, tz, 'yyyy-MM-dd');

      paySheet.appendRow([ts, loan.memberId, loan.memberName, '', loan.loanType, p + 1, amount, method, ref, dp, 'Demo data for presentation', 'Confirmed', '', orNum]);

      loan.balance -= amount;
      totalAmountPaid += amount;
      paymentsCreated++;
    }

    // Update balances in Loans sheet and type-specific sheet
    try {
      if (loansSheet) {
        var ld2 = loansSheet.getDataRange().getValues();
        for (var fi = 1; fi < ld2.length; fi++) {
          if (String(ld2[fi][0]) === loan.loanId) {
            loansSheet.getRange(fi + 1, 10).setValue(Math.max(0, loan.balance));
            if (loan.balance <= 0) loansSheet.getRange(fi + 1, 11).setValue('Paid');
            break;
          }
        }
      }
      var tsn = loan.loanType === 'Regular' ? 'REGULAR' : loan.loanType === 'Commodity' ? 'COMMODITY' : 'SHORT-TERM';
      var ts2 = findSheetCI_(ss, tsn);
      if (ts2) {
        var td2 = ts2.getDataRange().getValues();
        for (var tj = 1; tj < td2.length; tj++) {
          if (String(td2[tj][0]) === loan.loanId) {
            ts2.getRange(tj + 1, 10).setValue(Math.max(0, loan.balance));
            if (loan.balance <= 0) ts2.getRange(tj + 1, 11).setValue('Paid');
            break;
          }
        }
      }
    } catch (balErr) {
      log.push('Warning updating balance for ' + loan.loanId + ': ' + balErr.message);
    }
  }

  try { CacheService.getScriptCache().removeAll(['analytics_data', 'members_data', 'applications_data', 'loans_data']); } catch(e) {}

  var fullyPaid = 0, stillActive = 0;
  for (var ci = 0; ci < allLoans.length; ci++) {
    if (allLoans[ci].balance <= 0) fullyPaid++; else stillActive++;
  }

  return {
    success: true,
    loansCreated: loansCreated,
    paymentsCreated: paymentsCreated,
    totalAmountPaid: totalAmountPaid,
    totalLoansProcessed: allLoans.length,
    fullyPaid: fullyPaid,
    stillActive: stillActive,
    log: log
  };
}

// ═══════════════════════════════════════════
// One-time maintenance: recompute Regular loan
// balances so they reduce by PRINCIPAL only
// (interest is collected separately). Safe to
// re-run — idempotent.
// Run from the Apps Script editor: select
// recomputeRegularLoanBalances → Run.
// ═══════════════════════════════════════════

function recomputeRegularLoanBalances() {
  var ss = openSheet_();
  if (!ss) return { success: false, message: 'Spreadsheet not connected.' };

  var paySheet = findSheetCI_(ss, 'Payments');
  var paymentsByMember = {};
  if (paySheet) {
    var pdata = paySheet.getDataRange().getValues();
    for (var p = 1; p < pdata.length; p++) {
      var prow = pdata[p];
      if (String(prow[4] || '').toUpperCase() !== 'REGULAR') continue;
      var pStatus = String(prow[11] || '').trim();
      if (pStatus !== 'Confirmed' && pStatus !== 'Paid') continue;
      var mid = String(prow[1] || '').trim();
      if (!mid) continue;
      if (!paymentsByMember[mid]) paymentsByMember[mid] = [];
      paymentsByMember[mid].push({
        monthNum: parseInt(String(prow[5]).replace(/\D/g, ''), 10) || 1,
        amount: Number(prow[6]) || 0,
        datePaid: String(prow[9] || '')
      });
    }
  }
  Object.keys(paymentsByMember).forEach(function (k) {
    paymentsByMember[k].sort(function (a, b) {
      return (a.datePaid || '').localeCompare(b.datePaid || '') || a.monthNum - b.monthNum;
    });
  });

  function readLoans(sheet, prefixCol) {
    var out = [];
    if (!sheet) return out;
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      var loanId = String(r[0] || '').trim();
      if (loanId.toUpperCase().indexOf('REG') !== 0) continue;
      var status = String(r[10] || '').trim();
      if (status === 'Paid') continue;
      out.push({
        row: i + 1,
        loanId: loanId,
        memberId: String(r[1] || '').trim(),
        amount: Number(r[3]) || 0,
        term: Number(r[5]) || 0,
        release: String(r[7] || '')
      });
    }
    return out;
  }

  var loansSheet = findSheetCI_(ss, 'Loans');
  var regSheet = findSheetCI_(ss, 'REGULAR');
  var savingsSheet = findSheetCI_(ss, 'Regular Savings');

  var loansByMember = {};
  var allLoanRows = readLoans(loansSheet).concat(readLoans(regSheet));
  allLoanRows.forEach(function (loan) {
    if (!loan.memberId || loan.amount <= 0) return;
    if (!loansByMember[loan.memberId]) loansByMember[loan.memberId] = [];
    loansByMember[loan.memberId].push(loan);
  });
  Object.keys(loansByMember).forEach(function (k) {
    loansByMember[k].sort(function (a, b) {
      return (a.release || '').localeCompare(b.release || '') || a.loanId.localeCompare(b.loanId);
    });
  });

  var updatedLoans = {};
  Object.keys(loansByMember).forEach(function (mid) {
    var loans = loansByMember[mid];
    var pays = paymentsByMember[mid] || [];
    if (pays.length === 0) return;
    var li = 0;
    var running = loans.length > 0 ? loans[0].amount : 0;
    pays.forEach(function (pay) {
      while (li < loans.length && running <= 0) {
        li++;
        running = li < loans.length ? loans[li].amount : 0;
      }
      if (li >= loans.length) return;
      var loan = loans[li];
      var fp = loan.term > 0 ? Math.round(loan.amount / loan.term) : 0;
      var principalPart = fp > 0 ? Math.min(pay.amount, fp) : pay.amount;
      running = Math.max(0, running - principalPart);
      loans[li].newBalance = running;
    });
  });

  var scanned = 0, updated = 0, markedPaid = 0;
  var savingsUpdates = [];

  Object.keys(loansByMember).forEach(function (mid) {
    loansByMember[mid].forEach(function (loan) {
      if (loan.newBalance === undefined) return;
      scanned++;
      var oldBal = null;
      if (loan.row && loan.row > 0) {
        var sheetRef = loan.loanId.toUpperCase().indexOf('REG') === 0
          && loansSheet && loansSheet.getRange(loan.row, 1).getValue() === loan.loanId ? loansSheet : null;
        if (!sheetRef && regSheet && regSheet.getRange(loan.row, 1).getValue() === loan.loanId) sheetRef = regSheet;
        if (sheetRef) oldBal = Number(sheetRef.getRange(loan.row, 10).getValue()) || 0;
      }
      if (oldBal === null || Math.round(oldBal) === Math.round(loan.newBalance)) return;
      updated++;
      var target = loan.loanId.toUpperCase().indexOf('REG') === 0
        && loansSheet && loansSheet.getRange(loan.row, 1).getValue() === loan.loanId ? loansSheet : regSheet;
      if (target) {
        target.getRange(loan.row, 10).setValue(loan.newBalance);
        if (loan.newBalance <= 0) {
          target.getRange(loan.row, 11).setValue('Paid');
          markedPaid++;
        }
      }
      savingsUpdates.push(loan.loanId);
    });
  });

  if (savingsSheet && savingsUpdates.length > 0) {
    var sdata = savingsSheet.getDataRange().getValues();
    var balCol = -1;
    for (var bc = 0; bc < sdata[0].length; bc++) {
      var h = String(sdata[0][bc]).toUpperCase().trim();
      if (h === 'BALANCE' || h === 'BAL' || h === 'OUTSTANDING BALANCE') { balCol = bc; break; }
    }
    if (balCol >= 0) {
      var loansById = {};
      allLoanRows.forEach(function (l) { loansById[l.loanId] = l; });
      for (var si = 1; si < sdata.length; si++) {
        var sLoanId = String(sdata[si][0] || sdata[si][1] || sdata[si][2] || '').trim();
        var sLoan = loansById[sLoanId];
        if (sLoan && sLoan.newBalance !== undefined) {
          savingsSheet.getRange(si + 1, balCol + 1).setValue(sLoan.newBalance);
        }
      }
    }
  }

  try { CacheService.getScriptCache().removeAll(['analytics_data', 'members_data', 'applications_data', 'loans_data']); } catch(e) {}

  var result = {
    success: true,
    scanned: scanned,
    updated: updated,
    markedPaid: markedPaid,
    message: 'Recomputed ' + scanned + ' active Regular loan(s); updated ' + updated + ' balance(s); marked ' + markedPaid + ' as Paid.'
  };
  Logger.log(JSON.stringify(result));
  return result;
}

