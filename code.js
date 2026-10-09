// ─── CampusCoop Admin Web App ───────────────────────────────────────────────

function doGet(e) {
  var page = 'login';
  if (e && e.parameter && e.parameter.page) {
    page = e.parameter.page;
  }

  // Standalone pages
  if (page === 'login') {
    try {
      var tmpl = HtmlService.createTemplateFromFile('login-web');
      tmpl.scriptUrl = ScriptApp.getService().getUrl();
      return tmpl.evaluate()
        .setTitle('CampusCoop')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:sans-serif;padding:40px;color:#A32D2D;">'
        + '<h2>Error loading login</h2>'
        + '<p>' + err.message + '</p></div>');
    }
  }

  if (page === 'profile-setup') {
    try {
      var tmpl = HtmlService.createTemplateFromFile('setup-web');
      tmpl.scriptUrl = ScriptApp.getService().getUrl();
      tmpl.role = e && e.parameter && e.parameter.role ? e.parameter.role : '';
      return tmpl.evaluate()
        .setTitle('CampusCoop – Setup Account')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:sans-serif;padding:40px;color:#A32D2D;">'
        + '<h2>Error loading setup page</h2>'
        + '<p>' + err.message + '</p></div>');
    }
  }

  if (page === 'officer-setup') {
    try {
      var tmpl = HtmlService.createTemplateFromFile('ochange-web');
      tmpl.scriptUrl = ScriptApp.getService().getUrl();
      return tmpl.evaluate()
        .setTitle('CampusCoop – Secure Officer Account')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:sans-serif;padding:40px;color:#A32D2D;">'
        + '<h2>Error loading officer setup page</h2>'
        + '<p>' + err.message + '</p></div>');
    }
  }

  if (page === 'reset-password') {
    try {
      var tmpl = HtmlService.createTemplateFromFile('reset-web');
      tmpl.scriptUrl = ScriptApp.getService().getUrl();
      tmpl.token = (e && e.parameter && e.parameter.token) || '';
      return tmpl.evaluate()
        .setTitle('CampusCoop – Reset Password')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:sans-serif;padding:40px;color:#A32D2D;">'
        + '<h2>Error loading reset page</h2>'
        + '<p>' + err.message + '</p></div>');
    }
  }

  if (page === 'member-home') {
    try {
      var tmpl = HtmlService.createTemplateFromFile('member-web');
      tmpl.scriptUrl = ScriptApp.getService().getUrl();
      return tmpl.evaluate()
        .setTitle('CampusCoop – My Dashboard')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:sans-serif;padding:40px;color:#A32D2D;">'
        + '<h2>Error loading member dashboard</h2>'
        + '<p>' + err.message + '</p></div>');
    }
  }

  // All other pages — admin SPA shell (dash-web)
  try {
    var tmpl = HtmlService.createTemplateFromFile('dash-web');
    tmpl.scriptUrl = ScriptApp.getService().getUrl();
    tmpl.currentPage = page;
    return tmpl.evaluate()
      .setTitle('CampusCoop Admin')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;padding:40px;color:#A32D2D;">'
      + '<h2>Error loading: ' + page + '</h2>'
      + '<p>' + err.message + '</p>'
      + '<a href="?page=login">Back to login</a></div>');
  }
}

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}

function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

/* ── Generate unique OR number: OR-YYYYMMDD-XXXXX ── */
function generateORNumber_() {
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var dateStr = Utilities.formatDate(now, tz, 'yyyyMMdd');
  var prefix = 'OR-' + dateStr + '-';

  // Count existing ORs with same date prefix
  var ss = openSheet_();
  var max = 0;
  if (ss) {
    var sheet = findSheetCI_(ss, 'Payments');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var or = String(data[i][13] || ''); // col N = OR-NUMBER
        if (or.indexOf(prefix) === 0) {
          var num = parseInt(or.replace(prefix, ''), 10);
          if (num > max) max = num;
        }
      }
    }
  }
  var next = max + 1;
  return prefix + ('00000' + next).slice(-5);
}

function recordPayment(data) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var sheet = findSheetCI_(ss, 'Payments');
    if (!sheet) {
      sheet = ss.insertSheet('Payments');
      sheet.getRange('A1:N1').setValues([[
        'TIMESTAMP', 'MEMBER-ID', 'MEMBER-NAME', 'EMAIL',
        'LOAN-TYPE', 'MONTH-NUM', 'AMOUNT', 'METHOD',
        'REFERENCE', 'DATE-PAID', 'NOTES', 'STATUS', 'PROOF-URL', 'OR-NUMBER'
      ]]);
      sheet.getRange('A1:N1').setFontWeight('bold').setBackground('#F4F2EE');
      sheet.setFrozenRows(1);
    }

    // Handle proof of payment image upload
    var proofUrl = '';
    if (data.proofBase64) {
      try {
        var parts = data.proofBase64.split(',');
        var mimeMatch = parts[0].match(/data:(.*?);/);
        var mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        var ext = mimeType.indexOf('jpeg') > -1 ? '.jpg' : mimeType.indexOf('png') > -1 ? '.png' : '.jpg';
        var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), mimeType, 'proof_' + (data.memberId || 'unknown') + '_' + Date.now() + ext);
        var folders = DriveApp.getFoldersByName('CampusCoop Payment Proofs');
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('CampusCoop Payment Proofs');
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        proofUrl = file.getUrl();
      } catch (imgErr) {
        Logger.log('Proof upload error: ' + imgErr.message);
      }
    }

    var timestamp = new Date().toLocaleString();
    sheet.appendRow([
      timestamp,
      data.memberId || '',
      data.memberName || '',
      data.memberEmail || '',
      data.loanType || '',
      data.monthNum || 1,
      data.amount || 0,
      data.method || 'Cash',
      data.reference || '',
      data.date || '',
      data.notes || '',
      'Pending',
      proofUrl,
      ''  // OR-NUMBER — filled upon confirmation
    ]);

    // Send email to admin
    var paymentObj = {
      timestamp: timestamp,
      memberId: data.memberId,
      memberName: data.memberName,
      loanType: data.loanType,
      monthNum: data.monthNum,
      amount: data.amount,
      method: data.method,
      reference: data.reference,
      datePaid: data.date,
      notes: data.notes,
      proofUrl: proofUrl
    };
    sendPaymentNotifToAdmin_(paymentObj);

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getPayments() {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected. Please go to Settings and connect your Google Sheet.' };
    var sheet = findSheetCI_(ss, 'Payments');
    if (!sheet) {
      // Auto-create Payments sheet if it doesn't exist
      sheet = ss.insertSheet('Payments');
      sheet.getRange('A1:N1').setValues([[
        'Timestamp', 'Member ID', 'Member Name', 'Member Email', 'Loan Type',
        'Month #', 'Amount', 'Method', 'Reference', 'Date Paid',
        'Notes', 'Status', 'Proof URL', 'OR Number'
      ]]);
      sheet.getRange('A1:N1').setFontWeight('bold').setBackground('#F4F2EE');
      sheet.setFrozenRows(1);
      return { success: true, payments: [] };
    }

    var data = sheet.getDataRange().getValues();
    var payments = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[1]) continue;
      payments.push({
        row: i + 1,
        timestamp: String(row[0]),
        memberId: String(row[1]),
        memberName: String(row[2]),
        memberEmail: String(row[3]),
        loanType: String(row[4]),
        monthNum: Number(row[5]) || 1,
        amount: Number(row[6]) || 0,
        method: String(row[7]),
        reference: String(row[8]),
        datePaid: String(row[9]),
        notes: String(row[10]),
        status: String(row[11]) || 'Pending',
        proofUrl: String(row[12] || ''),
        orNumber: String(row[13] || '')
      });
    }
    return { success: true, payments: payments.reverse() }; // newest first
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getMemberPayments(memberId) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var sheet = findSheetCI_(ss, 'Payments');
    if (!sheet) return { success: true, payments: [] };

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
    var payments = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[1]) continue;
      if (!idsMatch(row[1])) continue;
      payments.push({
        row: i + 1,
        timestamp: String(row[0]),
        memberId: String(row[1]),
        memberName: String(row[2]),
        memberEmail: String(row[3]),
        loanType: normLoanType_(row[4]),
        monthNum: normMonthNum_(row[5]),
        amount: Number(row[6]) || 0,
        method: String(row[7]),
        reference: String(row[8]),
        datePaid: String(row[9]),
        notes: String(row[10]),
        status: normPayStatus_(row[11]),
        orNumber: String(row[13] || '')
      });
    }
    return { success: true, payments: payments.reverse() };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ── Payment cell normalizers ────────────────
// Sheet cells often hold loose formats (loan
// type "STL"/"Short-Term", month "Month 3"/"3",
// status "paid"/"approved"). These canonicalize
// values so payment records always key-match the
// schedule (loanType-monthNum).
// ────────────────────────────────────────────
function normLoanType_(raw) {
  var s = String(raw || '').toUpperCase();
  if (s.indexOf('REG') === 0) return 'Regular';
  if (s.indexOf('COM') === 0) return 'Commodity';
  if (s.indexOf('STL') === 0 || s.indexOf('SHORT') === 0 || s.indexOf('ST ') === 0 || s === 'ST') return 'Short Term';
  return String(raw || '');
}

function normMonthNum_(raw) {
  var digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return 1;
  return Math.max(1, parseInt(digits, 10));
}

function normPayStatus_(raw) {
  var s = String(raw || '').trim().toLowerCase();
  if (s === 'confirmed' || s === 'paid' || s === 'approved' || s === 'completed') return 'Confirmed';
  if (s === 'pending' || s === 'under review' || s === 'for confirmation') return 'Pending';
  return String(raw || '').trim() || 'Pending';
}

function confirmPayment(rowObj) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var sheet = findSheetCI_(ss, 'Payments');
    if (!sheet) return { success: false, message: 'Payments sheet missing.' };

    // 1. Generate OR number and mark the payment as Confirmed
    var orNumber = generateORNumber_();
    sheet.getRange(rowObj.row, 12).setValue('Confirmed');
    sheet.getRange(rowObj.row, 14).setValue(orNumber); // col N = OR-NUMBER

    // Build confirmation timestamp in Philippine Standard Time
    var tz = Session.getScriptTimeZone();
    var now = new Date();
    var confirmDateTime = Utilities.formatDate(now, tz, 'MMM dd, yyyy hh:mm a');

    // 2. Deduct from Loans sheet balance
    var paidAmount = Number(rowObj.amount) || 0;
    var memberId   = String(rowObj.memberId  || '');
    var loanType   = String(rowObj.loanType  || '');
    var loansSheet = null;
    var typePrefix = loanType === 'Regular' ? 'REG'
                   : loanType === 'Commodity' ? 'COM' : 'STL';

    if (paidAmount > 0 && memberId) {
      loansSheet = getLoansSheet_();
      if (loansSheet) {
        var loansData = loansSheet.getDataRange().getValues();

        for (var i = 1; i < loansData.length; i++) {
          var lrow = loansData[i];
          var loanId     = String(lrow[0]);
          var lMemberId  = String(lrow[1]);
          var lStatus    = String(lrow[10]);
          if (lMemberId.toUpperCase() === memberId.toUpperCase()
              && loanId.indexOf(typePrefix) === 0
              && lStatus !== 'Paid') {
            var currentBalance = Number(lrow[9]) || 0;
            var principalApplied = paidAmount;
            if (loanType === 'Regular') {
              var fp = (Number(lrow[5]) || 0) > 0 ? Math.round((Number(lrow[3]) || 0) / Number(lrow[5])) : 0;
              principalApplied = fp > 0 ? Math.min(paidAmount, fp) : paidAmount;
            }
            var newBalance = Math.max(0, currentBalance - principalApplied);
            loansSheet.getRange(i + 1, 10).setValue(newBalance);
            if (newBalance === 0) {
              loansSheet.getRange(i + 1, 11).setValue('Paid');
            }
            break;
          }
        }

        var typeSheetName = loanType === 'Regular' ? 'REGULAR'
                          : loanType === 'Commodity' ? 'COMMODITY' : 'SHORT-TERM';
        var typeSheet = findSheetCI_(ss, typeSheetName);
        if (typeSheet) {
          var typeData = typeSheet.getDataRange().getValues();
          for (var j = 1; j < typeData.length; j++) {
            var tr = typeData[j];
            if (String(tr[1]).toUpperCase() === memberId.toUpperCase()
                && String(tr[10]) !== 'Paid') {
              var curBal = Number(tr[9]) || 0;
              var principalPart = paidAmount;
              if (loanType === 'Regular') {
                var tfp = (Number(tr[5]) || 0) > 0 ? Math.round((Number(tr[3]) || 0) / Number(tr[5])) : 0;
                principalPart = tfp > 0 ? Math.min(paidAmount, tfp) : paidAmount;
              }
              var newBal = Math.max(0, curBal - principalPart);
              typeSheet.getRange(j + 1, 10).setValue(newBal);
              if (newBal === 0) typeSheet.getRange(j + 1, 11).setValue('Paid');
              break;
            }
          }
        }
      }
    }

    // 3. Send confirmation email to member (with OR details)
    rowObj.orNumber = orNumber;
    rowObj.confirmDateTime = confirmDateTime;
    sendPaymentStatusToMember_(
      rowObj.memberEmail,
      rowObj.memberName,
      rowObj,
      'Confirmed'
    );

    // 3b. Send SMS confirmation to member via TextBee
    try {
      var memberPhone = getMemberPhone_(memberId);
      Logger.log('Payment SMS — memberId: "' + memberId + '" phone from lookup: "' + memberPhone + '"');

      // Fallback: if getMemberPhone_ returned empty, use memberId directly
      // since member IDs in this system ARE phone numbers
      if (!memberPhone && memberId) {
        var digits = memberId.replace(/\D/g, '');
        if (digits.length >= 10) {
          memberPhone = memberId;
          Logger.log('Payment SMS — using memberId as phone fallback: "' + memberPhone + '"');
        }
      }

      if (memberPhone) {
        var fname = (rowObj.memberName || '').indexOf(',') > -1
          ? (rowObj.memberName || '').split(',')[1].trim()
          : (rowObj.memberName || '').split(' ')[0];
        var remainBal = '';
        // Try to get remaining balance from the loans sheet
        if (loansSheet) {
          var ld = loansSheet.getDataRange().getValues();
          for (var b = 1; b < ld.length; b++) {
            if (String(ld[b][1]).toUpperCase() === memberId.toUpperCase()
                && String(ld[b][0]).indexOf(typePrefix) === 0
                && String(ld[b][10]) !== 'Paid') {
              remainBal = ' Remaining balance: P' + Number(ld[b][9]).toLocaleString() + '.';
              break;
            }
          }
          // If loan is now fully paid
          if (!remainBal) remainBal = ' Your loan is now FULLY PAID!';
        }
        var smsText = 'CampusCoop: Hi ' + fname
          + ', your ' + loanType + ' loan payment of P'
          + Number(paidAmount).toLocaleString()
          + ' has been CONFIRMED. OR#: ' + orNumber + '.'
          + remainBal
          + ' Thank you!';
        var smsResult = sendTextBeeSms_(memberPhone, smsText);
        Logger.log('Payment SMS result: ' + JSON.stringify(smsResult));
      } else {
        Logger.log('Payment SMS SKIPPED — no phone number found for memberId: "' + memberId + '"');
      }
    } catch (smsErr) {
      Logger.log('Payment SMS error: ' + smsErr.message);
    }

    // 4. Return OR data to frontend for receipt display
    return {
      success: true,
      orNumber: orNumber,
      confirmDateTime: confirmDateTime
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/* ── Search payment by OR number (admin side) ── */
function searchPaymentByOR(refNum) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var sheet = findSheetCI_(ss, 'Payments');
    if (!sheet) return { success: false, message: 'Payments sheet not found.' };

    var data = sheet.getDataRange().getValues();
    var searchUpper = String(refNum).trim().toUpperCase();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var orVal = String(row[13] || '').toUpperCase();
      if (orVal === searchUpper) {
        var tz = Session.getScriptTimeZone();
        return {
          success: true,
          found: true,
          payment: {
            row: i + 1,
            timestamp: String(row[0]),
            memberId: String(row[1]),
            memberName: String(row[2]),
            memberEmail: String(row[3]),
            loanType: String(row[4]),
            monthNum: Number(row[5]) || 1,
            amount: Number(row[6]) || 0,
            method: String(row[7]),
            reference: String(row[8]),
            datePaid: String(row[9]),
            notes: String(row[10]),
            status: String(row[11]) || 'Pending',
            proofUrl: String(row[12] || ''),
            orNumber: String(row[13] || '')
          }
        };
      }
    }
    return { success: true, found: false };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function reviewPayment(rowObj) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var sheet = findSheetCI_(ss, 'Payments');
    if (!sheet) return { success: false, message: 'Payments sheet missing.' };

    sheet.getRange(rowObj.row, 12).setValue('Under Review');

    // Send email to member
    sendPaymentStatusToMember_(
      rowObj.memberEmail,
      rowObj.memberName,
      rowObj,
      'Under Review'
    );

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function rejectPaymentRecord(rowObj) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var sheet = findSheetCI_(ss, 'Payments');
    if (!sheet) return { success: false, message: 'Payments sheet missing.' };

    sheet.getRange(rowObj.row, 12).setValue('Rejected');

    // Store reject reason in Notes column if provided
    if (rowObj.rejectReason) {
      var currentNotes = sheet.getRange(rowObj.row, 11).getValue();
      var updatedNotes = currentNotes
        ? currentNotes + ' | Rejection reason: ' + rowObj.rejectReason
        : 'Rejection reason: ' + rowObj.rejectReason;
      sheet.getRange(rowObj.row, 11).setValue(updatedNotes);
    }

    // Send email to member
    sendPaymentStatusToMember_(
      rowObj.memberEmail,
      rowObj.memberName,
      rowObj,
      'Rejected'
    );

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ===================================================
// EMAIL FUNCTIONS REQUESTED BY USER
// ===================================================

function sendApprovedEmail(toEmail, memberName, memberID, loanType, amount, monthly, term, deductionData) {
  try {
    var d = deductionData || {};
    var totalB = Number(d.totalB) || 0;
    var totalC = Number(d.totalC) || 0;
    var netProceeds = Number(d.netProceeds) || (amount - totalB - totalC);

    function peso(n) { return '\u20B1' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function dedRow(label, val) {
      if (!val) return '';
      return '<tr style="border-bottom:1px solid #E8EAED;">'
        + '<td style="padding:6px 0;font-size:13px;color:#5F6368;">' + label + '</td>'
        + '<td style="padding:6px 0;font-size:13px;font-weight:600;text-align:right;">' + peso(val) + '</td></tr>';
    }

    // Build past dues rows
    var pastRows = ''
      + dedRow('Short Term Loan', d.pastSt)
      + dedRow('Regular Loan (balance)', d.pastReg)
      + dedRow('Commodity', d.pastCom)
      + dedRow('Canteen Credit', d.pastCanteen)
      + dedRow('Ticket/Load', d.pastTicket)
      + dedRow('Others', d.pastOthers);

    // Build deduction rows
    var dedRows = ''
      + dedRow('Regular Loan (balance)', d.dedReg)
      + dedRow('Capital Build-Up', d.dedCbu)
      + dedRow('Service Fee', d.dedService)
      + dedRow('Insurance', d.dedInsurance)
      + dedRow('Notarial Fee', d.dedNotarial);

    // Build deduction section HTML
    var deductionSection = '';
    if (totalB > 0 || totalC > 0) {
      deductionSection = '<div style="background:#F8F9FA;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #E8EAED;">'
        + '<p style="font-size:11px;font-weight:600;color:#9AA0A6;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">Certification / Deductions</p>'
        + '<table style="width:100%;border-collapse:collapse;">'
        + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:6px 0;font-size:13px;color:#5F6368;">Amount Applied (A)</td><td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right;color:#202124;">' + peso(amount) + '</td></tr>'
        + (pastRows ? ('<tr><td colspan="2" style="padding:8px 0 2px;font-size:11px;font-weight:700;color:#9AA0A6;text-transform:uppercase;letter-spacing:0.06em;">Past Dues (B)</td></tr>' + pastRows + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:6px 0;font-size:13px;font-weight:700;color:#854F0B;">Total Past Dues (B)</td><td style="padding:6px 0;font-size:13px;font-weight:700;color:#854F0B;text-align:right;">' + peso(totalB) + '</td></tr>') : '')
        + (dedRows ? ('<tr><td colspan="2" style="padding:8px 0 2px;font-size:11px;font-weight:700;color:#9AA0A6;text-transform:uppercase;letter-spacing:0.06em;">Deductions (C)</td></tr>' + dedRows + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:6px 0;font-size:13px;font-weight:700;color:#1A3A7A;">Total Deductions (C)</td><td style="padding:6px 0;font-size:13px;font-weight:700;color:#1A3A7A;text-align:right;">' + peso(totalC) + '</td></tr>') : '')
        + '<tr><td style="padding:10px 0 6px;font-size:14px;font-weight:700;color:#202124;">Net Proceeds (A\u2212(B+C))</td><td style="padding:10px 0 6px;font-size:17px;font-weight:700;color:#0D47A1;text-align:right;">' + peso(netProceeds) + '</td></tr>'
        + '</table></div>';
    }

    var subject = '\u2705 Your loan application has been approved \u2014 CampusCoop';
    var body =
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
      + '<div style="background:#1C2B3A;padding:28px 40px;text-align:center;">'
      + '<h1 style="color:#fff;font-size:22px;margin:0;letter-spacing:-0.01em;">CAMPUS<span style="color:#7BBFFF;">COOP</span></h1>'
      + '<p style="color:rgba(255,255,255,0.5);font-size:12px;margin:4px 0 0;">Cooperative Loan System \u00B7 SKSU</p></div>'
      + '<div style="padding:36px 40px;background:#fff;">'
      + '<div style="display:inline-block;background:#EAF3DE;color:#3B6D11;border:1px solid #C0DD97;padding:10px 20px;border-radius:30px;font-size:13px;font-weight:600;margin-bottom:24px;">\u2705 Loan Application Approved</div>'
      + '<p style="font-size:16px;font-weight:600;color:#202124;margin:0 0 8px;">Good day, ' + memberName + '!</p>'
      + '<p style="font-size:14px;color:#5F6368;line-height:1.7;margin:0 0 24px;">We are pleased to inform you that your loan application has been <strong>reviewed and approved</strong>. Your loan is currently in <strong>settlement</strong> and pending final release by the cooperative administration.</p>'
      + '<div style="background:#F8F9FA;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #E8EAED;">'
      + '<p style="font-size:11px;font-weight:600;color:#9AA0A6;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">Loan application details</p>'
      + '<table style="width:100%;border-collapse:collapse;">'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Member ID</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + memberID + '</td></tr>'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Loan type</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + loanType + '</td></tr>'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Loan amount</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + peso(amount) + '</td></tr>'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Monthly payment</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + peso(monthly) + '</td></tr>'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Term</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + term + ' months</td></tr>'
      + '<tr><td style="padding:8px 0;font-size:13px;color:#5F6368;">Status</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#3B6D11;text-align:right;">\u2705 Approved (In Settlement)</td></tr>'
      + '</table></div>'
      + deductionSection
      + '<div style="background:#E8F0FE;border-radius:10px;padding:18px 20px;margin-bottom:24px;border:1px solid #C5D8FD;">'
      + '<p style="font-size:12px;font-weight:600;color:#1967D2;text-transform:uppercase;letter-spacing:0.07em;margin:0 0 10px;">What happens next</p>'
      + '<p style="font-size:13px;color:#1967D2;margin:0 0 6px;">\u2022 Your loan is currently in settlement for final processing.</p>'
      + '<p style="font-size:13px;color:#1967D2;margin:0 0 6px;">\u2022 You will receive another notification once your loan is released.</p>'
      + '<p style="font-size:13px;color:#1967D2;margin:0 0 6px;">\u2022 Log in to CampusCoop to view your loan status and payment schedule.</p>'
      + '<p style="font-size:13px;color:#1967D2;margin:0;">\u2022 Please wait for the initial release notification before proceeding.</p>'
      + '</div>'
      + '<hr style="border:none;border-top:1px solid #E8EAED;margin:0 0 20px;"/>'
      + '<p style="font-size:12px;color:#9AA0A6;text-align:center;line-height:1.6;margin:0;">This is an automated message from <strong>CampusCoop \u00B7 SKSU</strong>.<br/>Please do not reply to this email.<br/><br/>\u00A9 2026 CampusCoop \u00B7 Sultan Kudarat State University</p>'
      + '</div></div>';

    GmailApp.sendEmail(toEmail, subject, '', {
      htmlBody: body,
      name: 'CampusCoop \u00B7 SKSU'
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function sendRejectedEmail(toEmail, memberName, memberID, loanType, amount) {
  try {
    var subject = '\u274C Your loan application was not approved \u2014 CampusCoop';
    var body =
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
      + '<div style="background:#1C2B3A;padding:28px 40px;text-align:center;">'
      + '<h1 style="color:#fff;font-size:22px;margin:0;">CAMPUS<span style="color:#7BBFFF;">COOP</span></h1>'
      + '<p style="color:rgba(255,255,255,0.5);font-size:12px;margin:4px 0 0;">Cooperative Loan System \u00B7 SKSU</p></div>'
      + '<div style="padding:36px 40px;background:#fff;">'
      + '<div style="display:inline-block;background:#FCEBEB;color:#A32D2D;border:1px solid #F7C1C1;padding:10px 20px;border-radius:30px;font-size:13px;font-weight:600;margin-bottom:24px;">\u274C Application Not Approved</div>'
      + '<p style="font-size:16px;font-weight:600;color:#202124;margin:0 0 8px;">Good day, ' + memberName + '!</p>'
      + '<p style="font-size:14px;color:#5F6368;line-height:1.7;margin:0 0 24px;">We regret to inform you that your loan application has been <strong>reviewed and was not approved</strong> at this time. Please contact your loan officer for more information.</p>'
      + '<div style="background:#F8F9FA;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #E8EAED;">'
      + '<p style="font-size:11px;font-weight:600;color:#9AA0A6;text-transform:uppercase;margin:0 0 12px;">Application details</p>'
      + '<table style="width:100%;border-collapse:collapse;">'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Member ID</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + memberID + '</td></tr>'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Loan type</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + loanType + '</td></tr>'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Amount requested</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">\u20B1' + Number(amount).toLocaleString() + '</td></tr>'
      + '<tr><td style="padding:8px 0;font-size:13px;color:#5F6368;">Status</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#A32D2D;text-align:right;">\u274C Not Approved</td></tr>'
      + '</table></div>'
      + '<div style="background:#FEE8E8;border-radius:10px;padding:18px 20px;margin-bottom:24px;border:1px solid #F7C1C1;">'
      + '<p style="font-size:12px;font-weight:600;color:#A32D2D;text-transform:uppercase;margin:0 0 10px;">What you can do</p>'
      + '<p style="font-size:13px;color:#A32D2D;margin:0 0 6px;">\u2022 Contact your loan officer to understand the reason.</p>'
      + '<p style="font-size:13px;color:#A32D2D;margin:0 0 6px;">\u2022 You may reapply after resolving any outstanding issues.</p>'
      + '<p style="font-size:13px;color:#A32D2D;margin:0;">\u2022 Log in to CampusCoop to view your application history.</p>'
      + '</div>'
      + '<hr style="border:none;border-top:1px solid #E8EAED;margin:0 0 20px;"/>'
      + '<p style="font-size:12px;color:#9AA0A6;text-align:center;line-height:1.6;margin:0;">This is an automated message from <strong>CampusCoop \u00B7 SKSU</strong>.<br/>Please do not reply to this email.<br/><br/>\u00A9 2026 CampusCoop \u00B7 Sultan Kudarat State University</p>'
      + '</div></div>';

    GmailApp.sendEmail(toEmail, subject, '', {
      htmlBody: body,
      name: 'CampusCoop \u00B7 SKSU'
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function sendReleasedEmail(toEmail, memberName, memberID, loanType, amount, netProceeds) {
  try {
    function peso(n) { return '\u20B1' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    
    var subject = '\u2705 Your loan has been released \u2014 CampusCoop';
    var body =
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
      + '<div style="background:#1C2B3A;padding:28px 40px;text-align:center;">'
      + '<h1 style="color:#fff;font-size:22px;margin:0;letter-spacing:-0.01em;">CAMPUS<span style="color:#7BBFFF;">COOP</span></h1>'
      + '<p style="color:rgba(255,255,255,0.5);font-size:12px;margin:4px 0 0;">Cooperative Loan System \u00B7 SKSU</p></div>'
      + '<div style="padding:36px 40px;background:#fff;">'
      + '<div style="display:inline-block;background:#EAF3DE;color:#3B6D11;border:1px solid #C0DD97;padding:10px 20px;border-radius:30px;font-size:13px;font-weight:600;margin-bottom:24px;">\u2705 Loan Released</div>'
      + '<p style="font-size:16px;font-weight:600;color:#202124;margin:0 0 8px;">Good day, ' + memberName + '!</p>'
      + '<p style="font-size:14px;color:#5F6368;line-height:1.7;margin:0 0 24px;">We are pleased to inform you that your loan has been <strong>released</strong> and is now available for claiming. Please visit the cooperative office to receive your loan proceeds.</p>'
      + '<div style="background:#F8F9FA;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #E8EAED;">'
      + '<p style="font-size:11px;font-weight:600;color:#9AA0A6;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">Loan details</p>'
      + '<table style="width:100%;border-collapse:collapse;">'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Member ID</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + memberID + '</td></tr>'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Loan type</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + loanType + '</td></tr>'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Loan amount</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + peso(amount) + '</td></tr>'
      + '<tr><td style="padding:8px 0;font-size:13px;color:#5F6368;">Net proceeds released</td><td style="padding:8px 0;font-size:16px;font-weight:700;color:#0D47A1;text-align:right;">' + peso(netProceeds) + '</td></tr>'
      + '</table></div>'
      + '<div style="background:#E8F0FE;border-radius:10px;padding:18px 20px;margin-bottom:24px;border:1px solid #C5D8FD;">'
      + '<p style="font-size:12px;font-weight:600;color:#1967D2;text-transform:uppercase;letter-spacing:0.07em;margin:0 0 10px;">Next steps</p>'
      + '<p style="font-size:13px;color:#1967D2;margin:0 0 6px;">\u2022 Visit the CampusCoop office to claim your loan.</p>'
      + '<p style="font-size:13px;color:#1967D2;margin:0 0 6px;">\u2022 Bring a valid ID for verification.</p>'
      + '<p style="font-size:13px;color:#1967D2;margin:0;">\u2022 Log in to CampusCoop to view your payment schedule.</p>'
      + '</div>'
      + '<hr style="border:none;border-top:1px solid #E8EAED;margin:0 0 20px;"/>'
      + '<p style="font-size:12px;color:#9AA0A6;text-align:center;line-height:1.6;margin:0;">This is an automated message from <strong>CampusCoop \u00B7 SKSU</strong>.<br/>Please do not reply to this email.<br/><br/>\u00A9 2026 CampusCoop \u00B7 Sultan Kudarat State University</p>'
      + '</div></div>';

    GmailApp.sendEmail(toEmail, subject, '', {
      htmlBody: body,
      name: 'CampusCoop \u00B7 SKSU'
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function sendSubmittedEmail(toEmail, memberName, memberID, loanType, amount) {
  try {
    var subject = '\u23F3 Your loan application is under review \u2014 CampusCoop';
    var body =
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
      + '<div style="background:#1C2B3A;padding:28px 40px;text-align:center;">'
      + '<h1 style="color:#fff;font-size:22px;margin:0;">CAMPUS<span style="color:#7BBFFF;">COOP</span></h1>'
      + '<p style="color:rgba(255,255,255,0.5);font-size:12px;margin:4px 0 0;">Cooperative Loan System \u00B7 SKSU</p></div>'
      + '<div style="padding:36px 40px;background:#fff;">'
      + '<div style="display:inline-block;background:#FAEEDA;color:#854F0B;border:1px solid #FAC775;padding:10px 20px;border-radius:30px;font-size:13px;font-weight:600;margin-bottom:24px;">\u23F3 Application Under Review</div>'
      + '<p style="font-size:16px;font-weight:600;color:#202124;margin:0 0 8px;">Good day, ' + memberName + '!</p>'
      + '<p style="font-size:14px;color:#5F6368;line-height:1.7;margin:0 0 24px;">Thank you for submitting your loan application. We have received your request and it is currently being <strong>reviewed by the loan officer</strong>. You will receive another email once a decision has been made.</p>'
      + '<div style="background:#F8F9FA;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #E8EAED;">'
      + '<p style="font-size:11px;font-weight:600;color:#9AA0A6;text-transform:uppercase;margin:0 0 12px;">Application submitted</p>'
      + '<table style="width:100%;border-collapse:collapse;">'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Member ID</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + memberID + '</td></tr>'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Loan type</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">' + loanType + '</td></tr>'
      + '<tr style="border-bottom:1px solid #E8EAED;"><td style="padding:8px 0;font-size:13px;color:#5F6368;">Amount requested</td><td style="padding:8px 0;font-size:13px;font-weight:600;text-align:right;">\u20B1' + Number(amount).toLocaleString() + '</td></tr>'
      + '<tr><td style="padding:8px 0;font-size:13px;color:#5F6368;">Status</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#854F0B;text-align:right;">\u23F3 Under Review</td></tr>'
      + '</table></div>'
      + '<div style="background:#E8F0FE;border-radius:10px;padding:18px 20px;margin-bottom:24px;border:1px solid #C5D8FD;">'
      + '<p style="font-size:12px;font-weight:600;color:#1967D2;text-transform:uppercase;margin:0 0 10px;">What to expect</p>'
      + '<p style="font-size:13px;color:#1967D2;margin:0 0 6px;">\u2022 The loan officer will review your application within 1-2 business days.</p>'
      + '<p style="font-size:13px;color:#1967D2;margin:0 0 6px;">\u2022 You will receive an email once approved or rejected.</p>'
      + '<p style="font-size:13px;color:#1967D2;margin:0;">\u2022 Log in to CampusCoop to check your status anytime.</p>'
      + '</div>'
      + '<hr style="border:none;border-top:1px solid #E8EAED;margin:0 0 20px;"/>'
      + '<p style="font-size:12px;color:#9AA0A6;text-align:center;line-height:1.6;margin:0;">This is an automated message from <strong>CampusCoop \u00B7 SKSU</strong>.<br/>Please do not reply to this email.<br/><br/>\u00A9 2026 CampusCoop \u00B7 Sultan Kudarat State University</p>'
      + '</div></div>';

    GmailApp.sendEmail(toEmail, subject, '', {
      htmlBody: body,
      name: 'CampusCoop \u00B7 SKSU'
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getMemberEmail(memberID) {
  try {
    var ss = openSheet_();
    if (!ss) return '';
    var sheet = ss.getSheetByName('MEMBER ACCOUNTS') || findSheetCI_(ss, 'members');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === memberID.trim()) {
        return String(data[i][2]).trim();
      }
    }
    return '';
  } catch (e) {
    return '';
  }
}

function getMemberName(memberID) {
  try {
    var ss = openSheet_();
    if (!ss) return memberID;
    var sheet = ss.getSheetByName('MEMBER ACCOUNTS') || findSheetCI_(ss, 'members');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === memberID.trim()) {
        return String(data[i][4]).trim();
      }
    }
    return memberID;
  } catch (e) {
    return memberID;
  }
}

function getMemberDashboardData(memberId) {
  var data = { success: true, loans: [], apps: [], payments: [] };

  var loansRes = getMemberLoans(memberId);
  if (loansRes && loansRes.success) data.loans = loansRes.loans;

  var appsRes = getMemberApplications(memberId);
  if (appsRes && appsRes.success) data.apps = appsRes.apps;

  var payRes = getMemberPayments(memberId);
  if (payRes && payRes.success) data.payments = payRes.payments;

  return data;
}

// ═══════════════════════════════════════════
// Clear analytics cache (called by Refresh)
// ═══════════════════════════════════════════
function clearAnalyticsCache() {
  try {
    var cache = CacheService.getScriptCache();
    cache.removeAll(['analytics_data', 'members_data', 'applications_data']);
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Admin: Record a monthly payment
// The admin records payments on behalf of the
// member (counter or online). Directly confirmed.
// ═══════════════════════════════════════════
function recordPaymentByAdmin(data) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    var ss = openSheet_();
    if (!ss) { lock.releaseLock(); return { success: false, message: 'Spreadsheet not connected.' }; }

    var isSalaryDeduction = (data.method === 'Salary Deduction');
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    // Only generate OR for non-salary-deduction (immediate confirmation)
    var orNumber = '';
    var status = 'Confirmed';
    if (isSalaryDeduction) {
      status = 'Pending';
    } else {
      orNumber = 'OR-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd')
        + '-' + Math.floor(Math.random() * 9000 + 1000);
    }

    // Write to Payments sheet
    var paySheet = findSheetCI_(ss, 'Payments');
    var memberEmail = data.memberEmail || '';
    if (!memberEmail && data.memberId) {
      try { memberEmail = getMemberEmail(data.memberId) || ''; } catch(e4) {}
    }
    if (!paySheet) {
      paySheet = ss.insertSheet('Payments');
      paySheet.getRange('A1:N1').setValues([[
        'TIMESTAMP','MEMBER-ID','MEMBER-NAME','EMAIL',
        'LOAN-TYPE','MONTH-NUM','AMOUNT','METHOD',
        'REFERENCE','DATE-PAID','NOTES','STATUS','PROOF-URL','OR-NUMBER'
      ]]);
      paySheet.getRange('A1:N1').setFontWeight('bold');
      paySheet.setFrozenRows(1);
    }

    paySheet.appendRow([
      now,
      data.memberId || '',
      data.memberName || '',
      memberEmail,
      data.loanType || '',
      data.monthNum || 1,
      Number(data.amount) || 0,
      data.method || 'Counter',
      data.reference || '',
      data.datePaid || now,
      data.notes || (isSalaryDeduction ? 'Salary deduction — awaiting approval' : 'Recorded by admin'),
      status,
      '',           // No proof URL needed for admin
      orNumber
    ]);

    // Only update loan balance if NOT salary deduction (pending approval)
    if (!isSalaryDeduction) {
      var loansSheet = findSheetCI_(ss, 'Loans');
      if (loansSheet && data.loanId) {
        var ldata = loansSheet.getDataRange().getValues();
        for (var i = 1; i < ldata.length; i++) {
          if (String(ldata[i][0]) === data.loanId) {
            var oldBal = Number(ldata[i][9]) || 0;
            var newBal = Math.max(0, oldBal - (Number(data.amount) || 0));
            loansSheet.getRange(i + 1, 10).setValue(newBal);
            if (newBal <= 0) {
              loansSheet.getRange(i + 1, 11).setValue('Paid');
            }
            break;
          }
        }
      }
    }

    // Clear caches
    try {
      CacheService.getScriptCache().removeAll([
        'analytics_data', 'members_data', 'applications_data'
      ]);
    } catch(e2) {}

    // Send notification email
    if (memberEmail) {
      try {
        if (isSalaryDeduction) {
          // Send pending notification for salary deduction
          var subject = '\u23F3 Salary Deduction Pending \u2014 CampusCoop';
          var body = 'Hi ' + (data.memberName || data.memberId) + ',\n\n'
            + 'A salary deduction of \u20B1' + Math.round(Number(data.amount)).toLocaleString()
            + ' for your ' + (data.loanType || '') + ' loan has been submitted and is pending approval.\n\n'
            + 'You will receive a confirmation once the deduction is processed.\n\n'
            + 'Thank you!\n\u2014 CampusCoop Admin';
          GmailApp.sendEmail(memberEmail, subject, body);
        } else {
          sendPaymentConfirmationEmail_(
            memberEmail,
            data.memberName || data.memberId,
            data.memberId,
            data.loanType,
            Number(data.amount),
            orNumber,
            now,
            data.method || 'Counter'
          );
        }
      } catch(e3) { /* email is optional */ }
    }

    lock.releaseLock();
    return { success: true, orNumber: orNumber };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// Helper: send payment confirmation email
function sendPaymentConfirmationEmail_(email, name, memberId, loanType, amount, orNumber, dateTime, method) {
  var subject = 'CampusCoop Payment Confirmed — ' + orNumber;
  var body = 'Hi ' + name + ',\n\n'
    + 'Your payment has been recorded and confirmed by the admin.\n\n'
    + 'OR Number: ' + orNumber + '\n'
    + 'Loan Type: ' + loanType + '\n'
    + 'Amount: ₱' + Math.round(amount).toLocaleString() + '\n'
    + 'Method: ' + method + '\n'
    + 'Date: ' + dateTime + '\n\n'
    + 'Thank you for your payment!\n'
    + '— CampusCoop Admin';
  GmailApp.sendEmail(email, subject, body);
}

// ═══════════════════════════════════════════
// Member → Admin: Send a question/message
// Called from the member dashboard "Ask Admin"
// ═══════════════════════════════════════════
function sendMemberQuestion(data) {
  try {
    var adminEmail = getAdminEmail_();
    if (!adminEmail) return { success: false, message: 'Admin email not configured.' };

    var memberName = data.memberName || data.memberId || 'A member';
    var subject = '\ud83d\udcac Member Question \u2014 ' + memberName + ' (' + (data.subject || 'General') + ')';

    var body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F2EE;font-family:Montserrat,Arial,sans-serif;">'
      + '<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">'
      + '<div style="background:#1C2B3A;padding:24px 28px;">'
      + '<div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#fff;text-transform:uppercase;">CampusCoop</div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;text-transform:uppercase;letter-spacing:0.05em;">Member Inquiry</div>'
      + '</div>'
      + '<div style="padding:28px 28px 8px;">'
      + '<div style="font-size:18px;font-weight:700;color:#1C2B3A;margin-bottom:6px;">\ud83d\udcac New Member Question</div>'
      + '<div style="font-size:13px;color:#888;margin-bottom:24px;">A member has sent you a question. Please respond at your earliest convenience.</div>'
      + '<div style="background:#FAFAF8;border:0.5px solid #E0DDD6;border-radius:12px;padding:18px;margin-bottom:20px;">'
      + '<div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Message Details</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
      + '<tr><td style="padding:6px 0;color:#888;width:120px;">From</td><td style="padding:6px 0;font-weight:600;color:#1C2B3A;">' + memberName + '</td></tr>'
      + '<tr><td style="padding:6px 0;color:#888;">Member ID</td><td style="padding:6px 0;font-weight:600;">' + (data.memberId || '\u2014') + '</td></tr>'
      + '<tr><td style="padding:6px 0;color:#888;">Email</td><td style="padding:6px 0;">' + (data.memberEmail || '\u2014') + '</td></tr>'
      + '<tr><td style="padding:6px 0;color:#888;">Topic</td><td style="padding:6px 0;font-weight:600;">' + (data.subject || 'General') + '</td></tr>'
      + '</table>'
      + '</div>'
      + '<div style="background:#E6F1FB;border:0.5px solid #B5D4F4;border-radius:12px;padding:18px;margin-bottom:20px;">'
      + '<div style="font-size:10px;font-weight:700;color:#185FA5;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Message</div>'
      + '<div style="font-size:13px;color:#1C2B3A;line-height:1.7;white-space:pre-wrap;">' + (data.message || '(No message)') + '</div>'
      + '</div>'
      + '</div>'
      + '<div style="padding:0 28px 28px;">'
      + '<div style="font-size:11px;color:#bbb;line-height:1.7;">Reply to: <strong>' + (data.memberEmail || '\u2014') + '</strong></div>'
      + '</div>'
      + '</div></body></html>';

    MailApp.sendEmail({
      to: adminEmail,
      subject: subject,
      htmlBody: body,
      replyTo: data.memberEmail || ''
    });

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function bulkMarkMonthsPaid(data) {
  try {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);

    var ss = openSheet_();
    if (!ss) { lock.releaseLock(); return { success: false, message: 'Spreadsheet not connected.' }; }

    var paySheet = findSheetCI_(ss, 'Payments');
    if (!paySheet) {
      paySheet = ss.insertSheet('Payments');
      paySheet.getRange('A1:N1').setValues([[
        'TIMESTAMP','MEMBER-ID','MEMBER-NAME','EMAIL',
        'LOAN-TYPE','MONTH-NUM','AMOUNT','METHOD',
        'REFERENCE','DATE-PAID','NOTES','STATUS','PROOF-URL','OR-NUMBER'
      ]]);
      paySheet.getRange('A1:N1').setFontWeight('bold').setBackground('#F4F2EE');
      paySheet.setFrozenRows(1);
    }

    var loansSheet = findSheetCI_(ss, 'Loans');
    var loanId = data.loanId || '';
    var memberId = data.memberId || '';
    var memberName = data.memberName || '';
    var memberEmail = data.memberEmail || '';
    if (!memberEmail && memberId) {
      try { memberEmail = getMemberEmail(memberId) || ''; } catch(e) {}
    }
    var loanType = data.loanType || '';
    var numMonths = Number(data.numMonths) || 1;
    var monthStart = Number(data.monthStart) || 1;
    var monthlyAmount = Number(data.monthlyAmount) || 0;
    var totalAmount = monthlyAmount * numMonths;
    var datePaid = data.datePaid || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    var loanRow = -1;
    var currentBalance = 0;
    var loanAmount = 0;
    var loanTerm = 0;
    var loanMonthly = 0;
    if (loansSheet && loanId) {
      var ldata = loansSheet.getDataRange().getValues();
      for (var i = 1; i < ldata.length; i++) {
        if (String(ldata[i][0]) === loanId) {
          loanRow = i + 1;
          currentBalance = Number(ldata[i][9]) || 0;
          loanAmount = Number(ldata[i][3]) || 0;
          loanTerm = Number(ldata[i][5]) || 1;
          loanMonthly = Number(ldata[i][4]) || 0;
          break;
        }
      }
    }

    // For Regular loans, recalculate each month's amount with diminishing interest
    var fixedPrincipal = loanType === 'Regular' && loanTerm > 0 ? Math.round(loanAmount / loanTerm) : 0;
    var runningBalance = currentBalance;
    var paymentsCreated = 0;
    var cumulativeAmount = 0;
    var orNumbers = [];

    if (totalAmount > currentBalance) {
      totalAmount = currentBalance;
      numMonths = loanType === 'Regular' && fixedPrincipal > 0
        ? Math.floor(currentBalance / fixedPrincipal)
        : Math.floor(currentBalance / monthlyAmount);
      if (numMonths < 1) { lock.releaseLock(); return { success: false, message: 'Insufficient balance for even 1 month.' }; }
    }

    for (var m = 0; m < numMonths; m++) {
      var mn = monthStart + m;
      var orNumber = 'OR-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd')
        + '-' + Math.floor(Math.random() * 9000 + 1000);

      // For Regular: interest = 1% of remaining balance, each month diminishes.
      // Balance reduces by the principal portion only (interest is collected separately).
      var monthPayment = monthlyAmount;
      var principalPaid = monthlyAmount;
      if (loanType === 'Regular' && fixedPrincipal > 0) {
        var interest = Math.round(runningBalance * 0.01);
        var principalPart = Math.min(fixedPrincipal, runningBalance);
        monthPayment = principalPart + interest;
        principalPaid = principalPart;
      }

      paySheet.appendRow([
        now,
        memberId,
        memberName,
        memberEmail,
        loanType,
        mn,
        monthPayment,
        'Counter',
        '',
        datePaid,
        'Bulk mark \u2014 ' + numMonths + ' months by admin',
        'Confirmed',
        '',
        orNumber
      ]);

      paymentsCreated++;
      cumulativeAmount += principalPaid;
      runningBalance -= principalPaid;
      if (runningBalance < 0) runningBalance = 0;
      orNumbers.push(orNumber);
    }

    if (loanRow > 0) {
      var newBal = Math.max(0, currentBalance - cumulativeAmount);
      loansSheet.getRange(loanRow, 10).setValue(newBal);
      if (newBal <= 0) {
        loansSheet.getRange(loanRow, 11).setValue('Paid');
      }
    }

    try {
      var typeSheetName = '';
      if (loanType === 'Regular') typeSheetName = 'Regular Savings';
      else if (loanType === 'Short Term') typeSheetName = 'Short Term Savings';
      else if (loanType === 'Commodity') typeSheetName = 'Commodity Savings';
      else if (loanType === 'Student') typeSheetName = 'Student Savings';

      if (typeSheetName) {
        var typeSheet = findSheetCI_(ss, typeSheetName);
        if (typeSheet && loanId) {
          var tdata = typeSheet.getDataRange().getValues();
          for (var ti = 1; ti < tdata.length; ti++) {
            if (String(tdata[ti][0]) === loanId || String(tdata[ti][1]) === loanId || String(tdata[ti][2]) === loanId) {
              var balCol = -1;
              for (var bc = 0; bc < tdata[0].length; bc++) {
                var h = String(tdata[0][bc]).toUpperCase().trim();
                if (h === 'BALANCE' || h === 'BAL' || h === 'OUTSTANDING BALANCE') { balCol = bc; break; }
              }
              if (balCol >= 0) {
                var oldBal = Number(tdata[ti][balCol]) || 0;
                var newTypeBal = Math.max(0, oldBal - cumulativeAmount);
                typeSheet.getRange(ti + 1, balCol + 1).setValue(newTypeBal);
              }
              break;
            }
          }
        }
      }
    } catch(te) {}

    try {
      CacheService.getScriptCache().removeAll([
        'analytics_data', 'members_data', 'applications_data'
      ]);
    } catch(e2) {}

    lock.releaseLock();

    return {
      success: true,
      paymentsCreated: paymentsCreated,
      totalAmount: cumulativeAmount,
      orNumbers: orNumbers,
      monthStart: monthStart,
      monthEnd: monthStart + numMonths - 1,
      newBalance: Math.max(0, currentBalance - cumulativeAmount),
      message: 'Marked ' + numMonths + ' month' + (numMonths > 1 ? 's' : '') + ' as paid for ' + memberName
    };
  } catch (e) {
    try { lock.releaseLock(); } catch(le) {}
    return { success: false, message: e.message };
  }
}

function submitMultiMonthPayment(data) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };

    var paySheet = findSheetCI_(ss, 'Payments');
    if (!paySheet) {
      paySheet = ss.insertSheet('Payments');
      paySheet.getRange('A1:N1').setValues([[
        'TIMESTAMP','MEMBER-ID','MEMBER-NAME','EMAIL',
        'LOAN-TYPE','MONTH-NUM','AMOUNT','METHOD',
        'REFERENCE','DATE-PAID','NOTES','STATUS','PROOF-URL','OR-NUMBER'
      ]]);
      paySheet.getRange('A1:N1').setFontWeight('bold').setBackground('#F4F2EE');
      paySheet.setFrozenRows(1);
    }

    var proofUrl = '';
    if (data.proofBase64) {
      try {
        var parts = data.proofBase64.split(',');
        var mimeMatch = parts[0].match(/data:(.*?);/);
        var mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        var ext = mimeType.indexOf('jpeg') > -1 ? '.jpg' : mimeType.indexOf('png') > -1 ? '.png' : '.jpg';
        var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), mimeType, 'proof_' + (data.memberId || 'unknown') + '_' + Date.now() + ext);
        var folders = DriveApp.getFoldersByName('CampusCoop Payment Proofs');
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('CampusCoop Payment Proofs');
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        proofUrl = file.getUrl();
      } catch (imgErr) {
        Logger.log('Proof upload error: ' + imgErr.message);
      }
    }

    var timestamp = new Date().toLocaleString();
    var monthStart = Number(data.monthStart) || 1;
    var numMonths = Number(data.numMonths) || 1;
    var monthlyAmount = Number(data.monthlyAmount) || Number(data.totalAmount) / numMonths || 0;
    var totalAmount = Number(data.totalAmount) || monthlyAmount * numMonths;
    var loanType = data.loanType || '';

    // Deduct one-time notes suffix if present
    var notesBase = data.notes || '';
    if (notesBase.indexOf('[Salary Deduction]') !== -1) {
      notesBase = notesBase.replace(' [Salary Deduction]', '');
    }

    for (var m = 0; m < numMonths; m++) {
      var mn = monthStart + m;
      var rowNotes = notesBase;
      if (numMonths > 1) rowNotes += ' [Month ' + mn + ' of ' + (monthStart + numMonths - 1) + ']';
      if (data.method === 'Salary Deduction') rowNotes += ' [Salary Deduction]';

      paySheet.appendRow([
        timestamp,
        data.memberId || '',
        data.memberName || '',
        data.memberEmail || '',
        loanType,
        mn,
        monthlyAmount,
        data.method || 'Counter',
        data.reference || '',
        data.date || '',
        rowNotes,
        'Pending',
        proofUrl,
        ''
      ]);
    }

    // Send admin notification
    if (numMonths > 1) {
      try {
        var adminEmail = getAdminEmail_();
        if (adminEmail) {
          var subject = numMonths + '-Month Payment Submitted \u2014 ' + (data.memberName || data.memberId);
          var body = (data.memberName || data.memberId) + ' has submitted a ' + data.method + ' payment of \u20B1'
            + Math.round(totalAmount).toLocaleString() + ' for ' + loanType + ' loan.\n\n'
            + 'Covers months ' + monthStart + '\u2013' + (monthStart + numMonths - 1) + ' (\u20B1' + Math.round(monthlyAmount).toLocaleString() + '/mo)\n\n'
            + 'Date: ' + (data.date || timestamp) + '\n'
            + 'Status: Pending approval\n\n'
            + 'Please log in to the dashboard to approve.';
          MailApp.sendEmail(adminEmail, subject, body);
        }
      } catch(e3) {}
    } else {
      // Use existing single-month notification
      var paymentObj = {
        timestamp: timestamp,
        memberId: data.memberId,
        memberName: data.memberName,
        loanType: loanType,
        monthNum: monthStart,
        amount: monthlyAmount,
        method: data.method,
        reference: data.reference || '',
        datePaid: data.date,
        notes: data.notes || '',
        proofUrl: proofUrl
      };
      sendPaymentNotifToAdmin_(paymentObj);
    }

    return { success: true, numMonths: numMonths, monthStart: monthStart, monthEnd: monthStart + numMonths - 1, totalAmount: totalAmount };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getPaymentsByLoanId(loanId) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };

    var paySheet = findSheetCI_(ss, 'Payments');
    if (!paySheet) return { success: true, payments: [] };

    var data = paySheet.getDataRange().getValues();
    var payments = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // Column 0 = loanId stored in NOTES or we match by member+loanType month-by-month
      // Actually, Payments sheet doesn't have a loanId column, so match by member + loanType
      // We'll return ALL payments and let the frontend filter
      payments.push({
        row: i + 1,
        timestamp: String(row[0] || ''),
        memberId: String(row[1] || ''),
        memberName: String(row[2] || ''),
        loanType: String(row[4] || ''),
        monthNum: Number(row[5]) || 0,
        amount: Number(row[6]) || 0,
        method: String(row[7] || ''),
        reference: String(row[8] || ''),
        datePaid: String(row[9] || ''),
        status: String(row[11] || ''),
        orNumber: String(row[13] || '')
      });
    }

    return { success: true, payments: payments };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getLoanByMember(memberId, loanType) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var loansSheet = findSheetCI_(ss, 'Loans');
    if (!loansSheet) return { success: false, message: 'Loans sheet not found.' };
    var data = loansSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === memberId) {
        var lt = String(data[i][0]).indexOf('REG') === 0 ? 'Regular'
          : String(data[i][0]).indexOf('COM') === 0 ? 'Commodity' : 'Short Term';
        if (lt === loanType) {
          return {
            success: true,
            loanId: String(data[i][0]),
            memberId: String(data[i][1] || ''),
            memberName: String(data[i][2] || ''),
            amount: Number(data[i][3]) || 0,
            monthly: Number(data[i][4]) || 0,
            term: Number(data[i][5]) || 0,
            totalPayable: Number(data[i][6]) || 0,
            dateReleased: String(data[i][7] || ''),
            maturityDate: String(data[i][8] || ''),
            balance: Number(data[i][9]) || 0,
            status: String(data[i][10] || ''),
            loanType: lt
          };
        }
      }
    }
    return { success: false, message: 'Loan not found for this member.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getAllLoansByMember(memberId) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var loansSheet = findSheetCI_(ss, 'Loans');
    if (!loansSheet) return { success: false, message: 'Loans sheet not found.' };
    var data = loansSheet.getDataRange().getValues();
    var loans = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]) === memberId) {
        var lid = String(data[i][0]);
        loans.push({
          loanId: lid,
          memberId: memberId,
          memberName: String(data[i][2] || ''),
          amount: Number(data[i][3]) || 0,
          monthly: Number(data[i][4]) || 0,
          term: Number(data[i][5]) || 0,
          totalPayable: Number(data[i][6]) || 0,
          dateReleased: String(data[i][7] || ''),
          maturityDate: String(data[i][8] || ''),
          balance: Number(data[i][9]) || 0,
          status: String(data[i][10] || ''),
          loanType: lid.indexOf('REG') === 0 ? 'Regular' : lid.indexOf('COM') === 0 ? 'Commodity' : 'Short Term'
        });
      }
    }
    return { success: true, loans: loans };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getLoanTerms(loanId) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var loansSheet = findSheetCI_(ss, 'Loans');
    if (!loansSheet) return { success: false, message: 'Loans sheet not found.' };
    var data = loansSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === loanId) {
        return {
          success: true,
          loanId: loanId,
          memberId: String(data[i][1] || ''),
          memberName: String(data[i][2] || ''),
          amount: Number(data[i][3]) || 0,
          monthly: Number(data[i][4]) || 0,
          term: Number(data[i][5]) || 0,
          totalPayable: Number(data[i][6]) || 0,
          dateReleased: String(data[i][7] || ''),
          maturityDate: String(data[i][8] || ''),
          balance: Number(data[i][9]) || 0,
          status: String(data[i][10] || ''),
          loanType: loanId.indexOf('REG') === 0 ? 'Regular' : loanId.indexOf('COM') === 0 ? 'Commodity' : 'Short Term'
        };
      }
    }
    return { success: false, message: 'Loan not found.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getMemberLedgerData(memberId) {
  try {
    if (!memberId) return { success: false, message: 'Member ID required.' };

    var loansRes = getMemberLoans(memberId);
    if (!loansRes || !loansRes.success) return { success: false, message: 'Could not load loans.' };

    var activeLoans = loansRes.loans.filter(function(l) { return l.status === 'Active'; });

    var payRes = getMemberPayments(memberId);
    var payments = (payRes && payRes.success) ? payRes.payments : [];

    return {
      success: true,
      loans: activeLoans,
      payments: payments
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getCbuHistory(memberId) {
  try {
    if (!memberId) return { success: false, message: 'Member ID required.' };

    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };

    var memSheet = findSheetCI_(ss, 'Members');
    if (!memSheet) return { success: false, message: 'Members sheet not found.' };

    var data = memSheet.getDataRange().getValues();
    var currentCbu = 0;
    var dateJoined = '';
    var found = false;

    for (var i = 1; i < data.length; i++) {
      var storedId = String(data[i][0] || '');
      var inputDigits = String(memberId).trim().replace(/\D/g, '');
      if (inputDigits.length > 10) inputDigits = inputDigits.slice(-10);
      var stored = storedId.replace(/\D/g, '');
      if (stored.length > 10) stored = stored.slice(-10);
      var match = (stored.length > 0 && stored === inputDigits) || storedId.toUpperCase() === String(memberId).trim().toUpperCase();

      if (match) {
        currentCbu = Number(data[i][7]) || 0;
        dateJoined = String(data[i][8] || '');
        found = true;
        break;
      }
    }

    if (!found) return { success: false, message: 'Member not found.' };

    var loansRes = getMemberLoans(memberId);
    var loans = (loansRes && loansRes.success) ? loansRes.loans : [];

    var deductions = loans.map(function(l) {
      return {
        loanId: l.loanId,
        loanType: l.loanType,
        amount: l.amount,
        date: l.startDate || '',
        status: l.status
      };
    });

    var totalDeducted = deductions.reduce(function(s, d) { return s + d.amount; }, 0);

    return {
      success: true,
      currentCbu: currentCbu,
      dateJoined: dateJoined,
      totalDeducted: totalDeducted,
      deductions: deductions
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
