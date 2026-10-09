// ─── SMS-NOTIF.js ───────────────────────────────────────────────────────────
// Renamed to Gmail-only Reminders module (TextBee SMS removed).
// All notifications go via Gmail / MailApp only.
// ─────────────────────────────────────────────────────────────────────────────

/* ── Settings ── */
function saveReminderSettings(settings) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (settings.autoEnabled !== undefined)
      props.setProperty('REMINDER_AUTO_ENABLED', settings.autoEnabled ? 'true' : 'false');
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getReminderSettings_() {
  var props = PropertiesService.getScriptProperties();
  return {
    autoEnabled: props.getProperty('REMINDER_AUTO_ENABLED') === 'true'
  };
}

/* ── Get full page data in one call ── */
function getSmsPageData() {
  var result = {
    settings: getReminderSettings_(),
    reminders: { success: false, reminders: [], stats: {} },
    logs: { success: false, logs: [] }
  };
  try { result.reminders = getDueReminders(); } catch (e) {}
  try { result.logs = getReminderLog(); } catch (e) {}
  return result;
}

/* ── Get upcoming dues ── */
function getDueReminders() {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var tz = Session.getScriptTimeZone();
    var today = new Date(); today.setHours(0,0,0,0);
    var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    var loanSheet = findSheetCI_(ss, 'Loans');
    if (!loanSheet) return { success: true, reminders: [], stats: { upcoming:0, withEmail:0 } };
    var loanData = loanSheet.getDataRange().getValues();

    // Count confirmed payments per loan type + member
    var paySheet = findSheetCI_(ss, 'Payments');
    var paidMonths = {};
    if (paySheet) {
      var pData = paySheet.getDataRange().getValues();
      for (var p = 1; p < pData.length; p++) {
        var pr = pData[p];
        if (String(pr[11]) === 'Confirmed') {
          var pKey = String(pr[4]).trim() + '|' + String(pr[1]).trim().toUpperCase();
          paidMonths[pKey] = (paidMonths[pKey] || 0) + 1;
        }
      }
    }

    var reminders = [];
    var withEmail = 0;

    for (var i = 1; i < loanData.length; i++) {
      var row = loanData[i];
      if (String(row[10]).toLowerCase() !== 'active') continue;
      if ((Number(row[9]) || 0) <= 0) continue;

      var loanId = String(row[0]);
      var memberId = String(row[1]);
      var memberName = String(row[2]);
      var monthly = Number(row[4]) || 0;
      var term = Number(row[5]) || 0;
      var dateReleased = row[7] ? new Date(row[7]) : null;
      if (!dateReleased) continue;

      var loanType = loanId.indexOf('STL') === 0 ? 'Short Term'
        : loanId.indexOf('REG') === 0 ? 'Regular'
        : loanId.indexOf('COM') === 0 ? 'Commodity' : 'Loan';

      var pk = loanType + '|' + memberId.toUpperCase();
      var nextMonth = (paidMonths[pk] || 0) + 1;
      if (nextMonth > term) continue;

      var nextDue = new Date(dateReleased);
      nextDue.setMonth(nextDue.getMonth() + nextMonth);
      nextDue.setHours(0,0,0,0);

      var isDueTom = (nextDue.getTime() === tomorrow.getTime());
      var isDueToday = (nextDue.getTime() === today.getTime());
      var isOverdue = (nextDue.getTime() < today.getTime());
      if (!isDueTom && !isDueToday && !isOverdue) continue;

      var email = getMemberEmail(memberId);
      if (email) withEmail++;

      var dueLabel = isDueTom ? 'Tomorrow'
        : isDueToday ? 'Today'
        : Utilities.formatDate(nextDue, tz, 'MMM dd, yyyy') + ' (Overdue)';

      reminders.push({
        loanId: loanId, memberId: memberId, memberName: memberName,
        loanType: loanType, monthly: monthly, balance: Number(row[9]) || 0,
        nextDue: Utilities.formatDate(nextDue, tz, 'MMM dd, yyyy'),
        dueLabel: dueLabel, monthNum: nextMonth,
        email: email || '', hasEmail: !!email
      });
    }

    return {
      success: true, reminders: reminders,
      stats: { upcoming: reminders.length, withEmail: withEmail }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/* ── Build reminder email HTML (stored in GMAIL-NOTIF.js) ── */
/* ── Send single reminder (Email only) ── */
function sendSingleReminder(memberId, loanId, memberName, loanType, monthly, dueDate, monthNum) {
  try {
    var email = getMemberEmail(memberId);
    if (!email) {
      return { success: false, message: 'No email on file for ' + memberId };
    }

    var firstName = memberName.indexOf(',') > -1
      ? memberName.split(',')[1].trim() : memberName.split(' ')[0];

    try {
      var subject = '\u23F0 Payment Reminder \u2014 ' + loanType + ' Loan Month ' + monthNum + ' \u2014 CampusCoop';
      var htmlBody = buildReminderEmail_(firstName, memberId, loanType, monthNum, monthly, dueDate);
      MailApp.sendEmail({ to: email, subject: subject, htmlBody: htmlBody });
    } catch (mailErr) {
      logReminder_(memberId, memberName, email, loanId, 'Failed: ' + mailErr.message);
      return { success: false, message: mailErr.message };
    }

    logReminder_(memberId, memberName, email, loanId, 'Sent (Email)');
    return { success: true, channels: ['Email'] };
  } catch (e) {
    logReminder_(memberId, memberName, '', loanId, 'Failed: ' + e.message);
    return { success: false, message: e.message };
  }
}

/* ── Send manual reminder ── */
function sendManualDueReminder(memberId, memberName, loanType, monthly, balance) {
  try {
    var email = getMemberEmail(memberId);
    if (!email) return { success: false, message: 'No email found for this member.' };

    var now = new Date();
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var dueDate = months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();
    var firstName = memberName.indexOf(',') > -1
      ? memberName.split(',')[1].trim() : memberName.split(' ')[0];

    var subject = '\u23F0 Payment Reminder \u2014 ' + loanType + ' Loan \u2014 CampusCoop';
    var htmlBody = buildReminderEmail_(firstName, memberId, loanType, '—', monthly, dueDate);
    MailApp.sendEmail({ to: email, subject: subject, htmlBody: htmlBody });

    logReminder_(memberId, memberName, email, loanType + '-MANUAL', 'Sent (Email, Manual)');
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

/* ── Send all due reminders (bulk) ── */
function sendAllDueReminders() {
  try {
    var autoEnabled = PropertiesService.getScriptProperties().getProperty('REMINDER_AUTO_ENABLED');
    if (autoEnabled === 'false') {
      return { success: true, sent: 0, failed: 0, skipped: 0, total: 0, message: 'Auto-reminders disabled.' };
    }
    var data = getDueReminders();
    if (!data.success) return data;
    var sent = 0, failed = 0, skipped = 0;
    var reminders = data.reminders || [];
    for (var i = 0; i < reminders.length; i++) {
      var r = reminders[i];
      if (!r.hasEmail) { skipped++; continue; }
      var result = sendSingleReminder(r.memberId, r.loanId, r.memberName, r.loanType, r.monthly, r.nextDue, r.monthNum);
      if (result.success) sent++; else failed++;
      if (i < reminders.length - 1) Utilities.sleep(300);
    }
    return { success: true, sent: sent, failed: failed, skipped: skipped, total: reminders.length };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/* ── Log to REMINDER-LOG sheet ── */
function logReminder_(memberId, memberName, email, loanId, status) {
  try {
    var ss = openSheet_();
    if (!ss) return;
    var sheet = findSheetCI_(ss, 'REMINDER-LOG');
    if (!sheet) {
      sheet = ss.insertSheet('REMINDER-LOG');
      sheet.getRange('A1:F1').setValues([[
        'TIMESTAMP', 'MEMBER-ID', 'MEMBER-NAME', 'EMAIL', 'LOAN-ID', 'STATUS'
      ]]);
      sheet.getRange('A1:F1').setFontWeight('bold').setBackground('#F4F2EE');
      sheet.setFrozenRows(1);
    }
    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([ts, memberId, memberName, email, loanId, status]);
  } catch (e) { Logger.log('logReminder_ error: ' + e.message); }
}

/* ── Get reminder log ── */
function getReminderLog() {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Not connected.' };
    var sheet = findSheetCI_(ss, 'REMINDER-LOG');
    if (!sheet) return { success: true, logs: [] };
    var data = sheet.getDataRange().getValues();
    var logs = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      logs.push({
        timestamp: String(row[0]), memberId: String(row[1]),
        memberName: String(row[2]), email: String(row[3]),
        loanId: String(row[4]), status: String(row[5])
      });
    }
    logs.reverse();
    return { success: true, logs: logs };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/* ── Daily trigger setup ── */
function setupDailyReminderTrigger() {
  try {
    PropertiesService.getScriptProperties().setProperty('REMINDER_AUTO_ENABLED', 'true');
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
}

function removeDailyReminderTrigger() {
  try {
    PropertiesService.getScriptProperties().setProperty('REMINDER_AUTO_ENABLED', 'false');
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
}

/* ── Claiming schedule: now sends email only ── */
function sendClaimingScheduleSms(memberId, memberName, loanType, amount, scheduleDate, scheduleTime, location) {
  try {
    var email = getMemberEmail(memberId);
    if (!email) {
      return { success: false, message: 'No email found for this member.' };
    }
    var fname = memberName ? memberName.split(' ')[0] : 'Member';
    var dateStr = scheduleDate || 'TBD';
    var timeStr = scheduleTime || '8:00 AM - 5:00 PM';
    var loc = location || 'CampusCoop Office, SKSU';

    var subject = '\ud83c\udf89 Loan Approved! Claiming Schedule \u2014 CampusCoop';
    var body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F2EE;font-family:Montserrat,Arial,sans-serif;">'
      + '<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">'
      + '<div style="background:#1C2B3A;padding:24px 28px;"><div style="font-size:18px;font-weight:700;color:#fff;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.07em;margin-top:2px;">Loan Approval Notice</div></div>'
      + '<div style="padding:28px;">'
      + '<div style="display:inline-block;background:#EAF3DE;border:0.5px solid #C0DD97;border-radius:20px;padding:6px 16px;font-size:12px;font-weight:600;color:#3B6D11;margin-bottom:18px;">\u2705 Loan Approved!</div>'
      + '<div style="font-size:16px;font-weight:700;color:#1C2B3A;margin-bottom:8px;">Hi ' + fname + ',</div>'
      + '<div style="font-size:13px;color:#555;line-height:1.7;margin-bottom:24px;">Your <strong>' + (loanType || 'loan') + '</strong> of <strong>\u20B1' + Number(amount || 0).toLocaleString() + '</strong> has been approved! Please visit the Cooperative Office to claim your proceeds.</div>'
      + '<div style="background:#F8F9FA;border:0.5px solid #E0DDD6;border-radius:12px;padding:18px;margin-bottom:24px;">'
      + '<div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Schedule Details</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
      + '<tr><td style="padding:6px 0;color:#888;width:120px;">Date</td><td style="padding:6px 0;font-weight:600;color:#1C2B3A;">' + dateStr + '</td></tr>'
      + '<tr><td style="padding:6px 0;color:#888;">Time</td><td style="padding:6px 0;font-weight:600;color:#1C2B3A;">' + timeStr + '</td></tr>'
      + '<tr><td style="padding:6px 0;color:#888;">Location</td><td style="padding:6px 0;font-weight:600;color:#1C2B3A;">' + loc + '</td></tr>'
      + '</table></div>'
      + '<div style="background:#FAEEDA;border-radius:10px;padding:14px 18px;margin-bottom:24px;border:0.5px solid #F5C87A;">'
      + '<div style="font-size:12px;color:#854F0B;font-weight:600;">\u26a0\ufe0f Please bring a valid ID</div>'
      + '</div>'
      + '<div style="font-size:12px;color:#bbb;">This is an automated notification from CampusCoop.</div>'
      + '</div></div></body></html>';

    MailApp.sendEmail({ to: email, subject: subject, htmlBody: body });
    logReminder_('CLAIMING', loanType || 'Loan', email, memberId, 'Sent (Claiming Email)');
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
