// ─── BACKEND-SPREADSHEET.js ──────────────────────────────────────────────────
// Server-side functions for Google Spreadsheet integration.
// ─────────────────────────────────────────────────────────────────────────────

/* ── Helper: extract ID from URL or raw ID ── */
function extractSheetId_(input) {
  if (!input) return '';
  input = input.trim();
  var match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return input.replace(/\/.*$/, '').replace(/\?.*$/, '');
}

function getSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
}

function openSheet_() {
  var id = getSpreadsheetId_();
  if (!id) return null;
  try { return SpreadsheetApp.openById(id); } catch (e) { return null; }
}

function checkSpreadsheetConnected() {
  var id = getSpreadsheetId_();
  if (!id) return { connected: false, message: 'No spreadsheet configured. Go to Settings → Paste your Google Sheet URL → Save.' };
  try {
    var ss = SpreadsheetApp.openById(id);
    return { connected: true, name: ss.getName() };
  } catch(e) {
    return { connected: false, message: 'Cannot open spreadsheet: ' + e.message + '. Check the URL in Settings.' };
  }
}

function findSheetCI_(ss, name) {
  var target = name.toLowerCase();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase() === target) return sheets[i];
  }
  return null;
}

function getMembersSheet_() {
  var ss = openSheet_();
  // Auto-create a spreadsheet if none is configured
  if (!ss) {
    try {
      ss = SpreadsheetApp.create('SKSU Coop Database');
      PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
      Logger.log('Auto-created spreadsheet: ' + ss.getUrl());
    } catch(e) {
      Logger.log('Failed to auto-create spreadsheet: ' + e);
      return null;
    }
  }
  var sheet = findSheetCI_(ss, 'Members');
  if (!sheet) {
    sheet = ss.insertSheet('Members');
    sheet.getRange('A1:N1').setValues([[
      'USERNAME', 'PASSWORD', 'EMAIL', 'MEMBER-TYPE', 'FIRST NAME',
      'LAST NAME', 'DEPARTMENT', 'CAPITAL', 'DATE-JOINED',
      'PHONE', 'STATUS', 'ACTIVATED_AT', 'MUST_CHANGE_PW', 'ROLE'
    ]]);
    sheet.getRange('A1:N1').setFontWeight('bold').setBackground('#F4F2EE');
    sheet.setFrozenRows(1);
  }
  // Ensure the ROLE column exists on pre-existing sheets (index 13, col N)
  ensureMemberRoleColumn_(sheet);
  return sheet;
}

function ensureMemberRoleColumn_(sheet) {
  try {
    var lastCol = sheet.getLastColumn();
    if (lastCol < 14) {
      sheet.getRange(1, 14).setValue('ROLE');
      sheet.getRange(1, 14).setFontWeight('bold').setBackground('#F4F2EE');
    } else {
      var header = String(sheet.getRange(1, 14).getValue() || '').trim().toUpperCase();
      if (header !== 'ROLE') {
        sheet.getRange(1, 14).setValue('ROLE');
        sheet.getRange(1, 14).setFontWeight('bold').setBackground('#F4F2EE');
      }
    }
  } catch (e) {
    Logger.log('ensureMemberRoleColumn_ error: ' + e.message);
  }
}

function getMemberRole_(rowArr) {
  var role = String(rowArr[13] || '').trim();
  return role || 'Member';
}


// ═══════════════════════════════════════════
// Settings page: Save & Test Spreadsheet
// ═══════════════════════════════════════════

function saveSpreadsheetID(input) {
  try {
    var id = extractSheetId_(input);
    var ss = SpreadsheetApp.openById(id);
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
    var nameSet = {};
    ss.getSheets().forEach(function(s) {
      var n = s.getName().toLowerCase();
      nameSet[n] = true;
      if (n.charAt(n.length - 1) !== 's') nameSet[n + 's'] = true;
      if (n.charAt(n.length - 1) === 's') nameSet[n.slice(0, -1)] = true;
    });
    return { success: true, name: ss.getName(), sheets: Object.keys(nameSet) };
  } catch (e) {
    return { success: false, message: 'Cannot open spreadsheet: ' + e.message };
  }
}

function testDatabaseConnection(input) {
  try {
    var id = extractSheetId_(input);
    var ss = SpreadsheetApp.openById(id);
    return { success: true, name: ss.getName() };
  } catch (e) { return { success: false, message: e.message }; }
}

function getSettings() {
  var props = PropertiesService.getScriptProperties();
  return {
    ssID: props.getProperty('SPREADSHEET_ID') || '',
    schoolYear: props.getProperty('SCHOOL_YEAR') || 'AY 2025-2026',
    adminPassword: props.getProperty('ADMIN_PASSWORD') || '1234'
  };
}

function saveSettings(obj) {
  try {
    var props = PropertiesService.getScriptProperties();
    if (obj.schoolYear) props.setProperty('SCHOOL_YEAR', obj.schoolYear);
    if (obj.adminPassword) props.setProperty('ADMIN_PASSWORD', obj.adminPassword);
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
}

// ═══════════════════════════════════════════
// Member Logic
// ═══════════════════════════════════════════

function generateUsername_(memberType) {
  var sheet = getMembersSheet_();
  if (!sheet) return String(Math.floor(Math.random() * 9000 + 1000));
  var data = sheet.getDataRange().getValues();
  var maxNum = 1000;
  for (var i = 1; i < data.length; i++) {
    var num = parseInt(String(data[i][0]).trim(), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }
  return String(maxNum + 1);
}

function createMember(data) {
  Logger.log('createMember called with: ' + JSON.stringify(data));
  try {
    var sheet = getMembersSheet_();
    if (!sheet) {
      Logger.log('createMember: No spreadsheet found.');
      return { success: false, message: 'No spreadsheet connected. Please check Settings.' };
    }
    var phone = String(data.phone || '').trim();
    var phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length > 10) phoneDigits = phoneDigits.slice(-10);

    Logger.log('Checking for existing member: ' + phoneDigits);
    var existing = sheet.getDataRange().getValues();
    for (var i = 1; i < existing.length; i++) {
      var colA = String(existing[i][0] || '').trim().replace(/\D/g, '');
      if (colA.length > 10) colA = colA.slice(-10);
      var colJ = String(existing[i][9] || '').trim().replace(/\D/g, '');
      if (colJ.length > 10) colJ = colJ.slice(-10);
      if ((colA.length > 0 && colA === phoneDigits) || (colJ.length > 0 && colJ === phoneDigits)) {
        return { success: false, message: 'This mobile number is already registered.' };
      }
    }
    // Auto-generate password if none provided (Requested default: sksu1234)
    var tempPw = data.password && data.password.toString().trim()
      ? data.password.toString().trim()
      : 'sksu1234';
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // col indices (1-indexed for getRange, but 0-indexed for the array)
    // 0:User, 1:Pass, 2:Email, 3:Type, 4:First, 5:Last, 6:Dept, 7:Capital, 8:Date, 9:Phone, 10:Status, 11:ActAt, 12:MustChange
    var newRow = [phone, tempPw, data.email || '', data.memberType, data.firstName, data.lastName,
                  data.department || '', Number(data.capital) || 0, today, phone, 'Active', today, 1];
    
    Logger.log('Appending new row for: ' + phone);
    sheet.appendRow(newRow);
    var lastRow = sheet.getLastRow();
    
    // Hard-set format as Text for the phone/IDs to avoid scientific notation
    sheet.getRange(lastRow, 1).setNumberFormat('@').setValue(phone);
    sheet.getRange(lastRow, 2).setNumberFormat('@').setValue(String(tempPw));
    sheet.getRange(lastRow, 10).setNumberFormat('@').setValue(phone);
    
    Logger.log('Member row added. Sending notifications...');
    var smsStatus = 'Not Sent', emailStatus = 'Not Sent';

    // ── Pre-check: Normalize phone and validate email ──
    var memberEmail = String(data.email || '').trim();
    var hasValidEmail = memberEmail && memberEmail.indexOf('@') > -1;

    // ── 1. Send SMS Notification ──
    var smsMsg = 'SKSU-Coop: Welcome! Your account is ready. '
               + 'Login ID: ' + phone + ' | Pass: ' + tempPw
               + '. IMPORTANT: Please log in and CHANGE YOUR PASSWORD immediately under Settings.';
    try {
      if (phone) {
        var smsRes = sendTextBeeSms_(phone, smsMsg);
        smsStatus = (smsRes && smsRes.success) ? 'Sent' : ('Failed: ' + (smsRes ? smsRes.message : 'Unknown error'));
      } else {
        smsStatus = 'No phone provided';
      }
    } catch(e2) {
      smsStatus = 'Error: ' + e2.message;
      Logger.log('SMS error: ' + e2);
    }

    // ── 2. Send Email Notification ──
    if (hasValidEmail) {
      try {
        var firstName = String(data.firstName || '').trim();
        var lastName  = String(data.lastName  || '').trim();
        var subject = '🔑 Your SKSU Cooperative Account Has Been Created';
        var htmlBody = '<div style="font-family:Arial,sans-serif;max-width:520px;background:#F4F2EE;padding:24px;">'
            + '<div style="background:#1C2B3A;padding:20px 24px;border-radius:10px 10px 0 0;text-align:center;">'
            + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
            + '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;">Cooperative Loan System — SKSU</div>'
            + '</div>'
            + '<div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">'
            + '<div style="background:#EAF3DE;border:0.5px solid #C0DD97;border-radius:8px;padding:10px 14px;font-size:13px;font-weight:700;color:#3B6D11;margin-bottom:18px;">✅ Account Successfully Created</div>'
            + '<p style="font-size:15px;color:#1C2B3A;">Dear <strong>' + firstName + ' ' + lastName + '</strong>,</p>'
            + '<p style="font-size:13px;color:#555;line-height:1.7;">Welcome to the SKSU Cooperative! Your member account has been created. You can now log in using the credentials below:</p>'
            + '<table style="border-collapse:collapse;width:100%;margin:14px 0;font-size:13px;">'
            + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;width:150px;">Login ID (Mobile)</td>'
            + '<td style="padding:10px 12px;font-family:monospace;font-weight:700;font-size:15px;border:0.5px solid #E0DDD6;">' + phone + '</td></tr>'
            + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;">Temporary Password</td>'
            + '<td style="padding:10px 12px;font-family:monospace;font-weight:700;font-size:15px;color:#A32D2D;border:0.5px solid #E0DDD6;">' + tempPw + '</td></tr>'
            + '</table>'
            + '<div style="background:#FFF9EE;border:1px solid #FFD580;border-radius:10px;padding:18px;margin-top:20px;text-align:center;">'
            + '<div style="font-size:14px;font-weight:800;color:#854F0B;margin-bottom:8px;">⚠️ SECURITY ACTION REQUIRED</div>'
            + '<div style="font-size:13px;color:#854F0B;line-height:1.6;">'
            + 'For your security, you <strong>MUST change your temporary password</strong> immediately after your first login.<br><br>'
            + 'Once logged in, go to <strong>Settings &rarr; Account &rarr; Change Password</strong> to set a permanent one.'
            + '</div>'
            + '</div>'
            + '<div style="margin-top:20px;font-size:11px;color:#bbb;line-height:1.7;">This is an automated message from SKSU Cooperative. If you did not expect this, contact the cooperative office.</div>'
            + '</div></div>';
        
        MailApp.sendEmail({
          to: memberEmail,
          subject: subject,
          htmlBody: htmlBody
        });
        emailStatus = 'Sent';
      } catch(e3) { 
        emailStatus = 'Error: ' + e3.message;
        Logger.log('Email error: ' + e3); 
      }
    } else {
      emailStatus = 'No valid email provided';
    }

    try { CacheService.getScriptCache().removeAll(['login_members_data', 'members_data']); } catch(e) {}
    
    return { 
      success: true, 
      username: phone, 
      tempPassword: tempPw,
      smsStatus: smsStatus,
      emailStatus: emailStatus
    };
  } catch (e) { 
    Logger.log('createMember critical error: ' + e);
    return { success: false, message: 'Critical Error: ' + e.message }; 
  }
}

function getMembers() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('members_data');
    if (cached) { try { return JSON.parse(cached); } catch(e) {} }
    var sheet = getMembersSheet_();
    if (!sheet) return { success: false, message: 'No spreadsheet connected.' };
    var data = sheet.getDataRange().getValues();
    var activeSet = {};
    try {
      var ss2 = openSheet_();
      var loansSheet = ss2 ? findSheetCI_(ss2, 'Loans') : null;
      if (loansSheet) {
        var ldata = loansSheet.getDataRange().getValues();
        for (var j = 1; j < ldata.length; j++) {
          if (String(ldata[j][10]).toLowerCase() === 'active') activeSet[String(ldata[j][1]).toUpperCase()] = true;
        }
      }
    } catch (e2) {}
    var members = [];
    for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (!row[0]) continue;
        var dj = row[8] ? Utilities.formatDate(new Date(row[8]), Session.getScriptTimeZone(), 'MMM dd, yyyy') : '';
        members.push({
            username: String(row[0]), fullName: String(row[4]) + ' ' + String(row[5]),
            firstName: String(row[4]), lastName: String(row[5]), email: String(row[2]),
            memberType: String(row[3]), department: String(row[6]), capital: Number(row[7]) || 0,
            phone: String(row[9] || ''), status: String(row[10] || 'Active'),
            role: getMemberRole_(row),
            dateJoined: dj,
            hasActiveLoan: !!activeSet[String(row[0]).toUpperCase()]
        });
    }
    var result = { success: true, data: members, members: members };
  try { cache.put('members_data', JSON.stringify(result), 120); } catch(e) {}
  return result;
  } catch (e) { return { success: false, message: e.message }; }
}

function getMemberProfile(memberId) {
  try {
    var sheet = getMembersSheet_();
    if (!sheet) return { success: false, message: 'No spreadsheet connected.' };
    var data = sheet.getDataRange().getValues();
    var tz = Session.getScriptTimeZone();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[0]).toUpperCase() !== memberId.toUpperCase()) continue;
      return {
        success: true,
        profile: {
          username: String(row[0]), email: String(row[2]), memberType: String(row[3]),
          firstName: String(row[4]), lastName: String(row[5]), department: String(row[6]),
          capital: Number(row[7]) || 0, phone: String(row[9] || ''),
          dateJoined: row[8] ? Utilities.formatDate(new Date(row[8]), tz, 'MMM dd, yyyy') : 'N/A'
        }
      };
    }
    return { success: false, message: 'Member not found.' };
  } catch (e) { return { success: false, message: e.message }; }
}

// ═══════════════════════════════════════════
// Auth & Account Logic
// ═══════════════════════════════════════════

function loginMember(username, password) {
  try {
    // Try cache first
    var cache = CacheService.getScriptCache();
    var cached = cache.get('login_members_data');
    var members = cached ? JSON.parse(cached) : null;

    if (!members) {
      var sheet = getMembersSheet_();
      if (!sheet) return { success: false, message: 'No spreadsheet.' };
      var displayData = sheet.getDataRange().getDisplayValues();
      members = [];
      for (var i = 1; i < displayData.length; i++) {
        var rawA = String(displayData[i][0] || '').trim();
        var storedDisplay = String(displayData[i][1] || '').trim();
        var status = String(displayData[i][10] || '').trim();
        var mustChange = String(displayData[i][12] || '').trim();
        var isProfileComplete = !(mustChange === '1' || mustChange === 'TRUE' || mustChange === 'true');
        members.push({
          username: rawA,
          password: storedDisplay,
          email: String(displayData[i][2] || ''),
          memberType: String(displayData[i][3] || ''),
          firstName: String(displayData[i][4] || ''),
          lastName: String(displayData[i][5] || ''),
          department: String(displayData[i][6] || ''),
          capital: Number(String(displayData[i][7]).replace(/,/g,'')) || 0,
          dateJoined: String(displayData[i][8] || 'N/A'),
          phone: String(displayData[i][9] || '') || rawA,
          status: status,
          isProfileComplete: isProfileComplete,
          defaultPassword: isProfileComplete ? undefined : storedDisplay
        });
      }
      cache.put('login_members_data', JSON.stringify(members), 300); // 5 min cache
    }

    var inputRaw = String(username || '').trim();
    var pwTrimmed = String(password || '').trim();

    for (var i = 0; i < members.length; i++) {
      var m = members[i];
      if (m.username.toUpperCase() !== inputRaw.toUpperCase()) continue;

      // Password check — handle spreadsheet numeric formatting quirks
      var candidates = {};
      candidates[m.password] = true;
      candidates[m.password.replace(/\.0+$/, '')] = true;
      candidates[m.password.replace(/,/g, '')] = true;
      var numVal = Number(m.password.replace(/,/g, ''));
      if (!isNaN(numVal) && m.password.length > 0) {
        candidates[String(Math.round(numVal))] = true;
        candidates[numVal.toFixed(0)] = true;
      }
      if (candidates[pwTrimmed]) {
        if (m.status === 'Pending') return { success: false, message: 'Account pending approval.' };
        return {
          success: true,
          member: {
            username: m.username,
            email: m.email,
            memberType: m.memberType,
            firstName: m.firstName,
            lastName: m.lastName,
            department: m.department,
            capital: m.capital,
            dateJoined: m.dateJoined,
            phone: m.phone,
            isProfileComplete: m.isProfileComplete,
            defaultPassword: m.defaultPassword
          }
        };
      }
    }
    return { success: false, message: 'Invalid credentials.' };
  } catch (e) { return { success: false, message: e.message }; }
}

// ═══════════════════════════════════════════
// Forced Profile Setup (first-login onboarding)
// ═══════════════════════════════════════════

function completeProfileSetup(memberId, data) {
  try {
    var sheet = getMembersSheet_();
    if (!sheet) return { success: false, message: 'No spreadsheet connected.' };

    var phone = String(data.phone || '').trim();
    var email = String(data.email || '').trim().toLowerCase();
    var newPassword = String(data.newPassword || '');
    var confirmPassword = String(data.confirmPassword || '');

    // ── Validations ──
    if (!phone || !email || !newPassword || !confirmPassword) {
      return { success: false, message: 'All fields are required.' };
    }

    // Phone format — PH mobile: starts with 09, 11 digits
    var phoneDigits = phone.replace(/\D/g, '');
    if (!/^09\d{9}$/.test(phoneDigits)) {
      return { success: false, message: 'Phone must be a valid PH mobile number (e.g. 09171234567).' };
    }

    // Email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    // Password minimum length
    if (newPassword.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters.' };
    }

    // Passwords must match
    if (newPassword !== confirmPassword) {
      return { success: false, message: 'Passwords do not match.' };
    }

    var allData = sheet.getDataRange().getDisplayValues();
    var targetRow = -1;

    for (var i = 1; i < allData.length; i++) {
      var rowUser = String(allData[i][0] || '').trim();

      // Find the target member
      if (rowUser.toUpperCase() === String(memberId).trim().toUpperCase()) {
        targetRow = i;

        // Password must not equal the old/default password
        var oldPw = String(allData[i][1] || '').trim();
        if (newPassword === oldPw) {
          return { success: false, message: 'New password must be different from your default password.' };
        }

        // Check profile isn't already complete
        var alreadyDone = String(allData[i][12] || '').trim();
        if (alreadyDone === '0' || alreadyDone === 'FALSE' || alreadyDone === 'false') {
          return { success: false, message: 'Profile setup already completed.' };
        }
      }

      // Email uniqueness check (skip the target row)
      if (i !== targetRow) {
        var existingEmail = String(allData[i][2] || '').trim().toLowerCase();
        if (existingEmail && existingEmail === email) {
          return { success: false, message: 'This email address is already in use by another member.' };
        }
      }
    }

    if (targetRow === -1) {
      return { success: false, message: 'Member not found.' };
    }

    // ── Write updates ──
    var row = targetRow + 1; // 1-indexed for getRange
    sheet.getRange(row, 2).setNumberFormat('@').setValue(newPassword);       // PASSWORD (B)
    sheet.getRange(row, 3).setValue(email);                                  // EMAIL (C)
    sheet.getRange(row, 10).setNumberFormat('@').setValue(phoneDigits);      // PHONE (J)
    sheet.getRange(row, 13).setValue(0);                                     // MUST_CHANGE_PW (M) → 0 = complete

    // Audit timestamp
    var tz = Session.getScriptTimeZone();
    var now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    sheet.getRange(row, 12).setValue(now);                                   // ACTIVATED_AT (L)

    // Clear caches
    try { CacheService.getScriptCache().removeAll(['login_members_data', 'members_data']); } catch(e) {}

    return {
      success: true,
      member: {
        username: String(allData[targetRow][0] || '').trim(),
        email: email,
        phone: phoneDigits,
        firstName: String(allData[targetRow][4] || ''),
        lastName: String(allData[targetRow][5] || ''),
        memberType: String(allData[targetRow][3] || ''),
        department: String(allData[targetRow][6] || ''),
        capital: Number(String(allData[targetRow][7]).replace(/,/g,'')) || 0,
        dateJoined: String(allData[targetRow][8] || 'N/A'),
        isProfileComplete: true
      }
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Email-based Password Reset (token flow)
// ═══════════════════════════════════════════

function requestPasswordReset(email) {
  try {
    var emailInput = String(email || '').trim().toLowerCase();
    if (!emailInput || emailInput.indexOf('@') === -1) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    var sheet = getMembersSheet_();
    if (!sheet) return { success: false, message: 'System error.' };
    var data = sheet.getDataRange().getDisplayValues();

    var foundRow = -1, memberFirst = '', memberUser = '';
    for (var i = 1; i < data.length; i++) {
      var storedEmail = String(data[i][2] || '').trim().toLowerCase();
      if (storedEmail === emailInput) {
        // Only allow reset if profile is complete
        var mustChange = String(data[i][12] || '').trim();
        if (mustChange === '1' || mustChange === 'TRUE' || mustChange === 'true') {
          return { success: false, message: 'Profile setup not completed yet. Please log in with your username and default password first.' };
        }
        foundRow = i;
        memberFirst = String(data[i][4] || '');
        memberUser = String(data[i][0] || '');
        break;
      }
    }

    if (foundRow === -1) {
      return { success: false, message: 'No account found with that email address.' };
    }

    // Generate token + expiry (30 minutes)
    var token = Utilities.getUuid().replace(/-/g, '');
    var expiry = new Date().getTime() + (30 * 60 * 1000); // 30 min from now
    var props = PropertiesService.getScriptProperties();
    props.setProperty('RESET_TOKEN_' + token, JSON.stringify({
      memberId: memberUser,
      email: emailInput,
      expiry: expiry
    }));

    // Build reset link
    var baseUrl = ScriptApp.getService().getUrl();
    var resetLink = baseUrl + '?page=reset-password&token=' + token;

    // Send email
    var subject = '🔑 Password Reset — CampusCoop';
    var htmlBody = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">'
      + '<div style="background:#1C2B3A;padding:24px 28px;border-radius:10px 10px 0 0;text-align:center;">'
      + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;">Cooperative Loan System — SKSU</div>'
      + '</div>'
      + '<div style="background:#fff;padding:28px;border-radius:0 0 10px 10px;">'
      + '<p style="font-size:15px;color:#1C2B3A;">Hi <strong>' + memberFirst + '</strong>,</p>'
      + '<p style="font-size:13px;color:#555;line-height:1.7;">We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>30 minutes</strong>.</p>'
      + '<div style="text-align:center;margin:24px 0;">'
      + '<a href="' + resetLink + '" style="display:inline-block;background:#1C2B3A;color:#fff;padding:14px 36px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Reset My Password</a>'
      + '</div>'
      + '<p style="font-size:12px;color:#aaa;line-height:1.6;">If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>'
      + '<hr style="border:none;border-top:1px solid #E8EAED;margin:20px 0;">'
      + '<p style="font-size:11px;color:#bbb;text-align:center;">CampusCoop · Sultan Kudarat State University</p>'
      + '</div></div>';

    MailApp.sendEmail({
      to: emailInput,
      subject: subject,
      htmlBody: htmlBody,
      name: 'CampusCoop · SKSU'
    });

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function resetPasswordWithToken(token, newPassword) {
  try {
    if (!token || !newPassword) return { success: false, message: 'Missing token or password.' };
    if (newPassword.length < 8) return { success: false, message: 'Password must be at least 8 characters.' };

    var props = PropertiesService.getScriptProperties();
    var tokenData = props.getProperty('RESET_TOKEN_' + token);
    if (!tokenData) return { success: false, message: 'Invalid or expired reset link. Please request a new one.' };

    var parsed = JSON.parse(tokenData);
    if (new Date().getTime() > parsed.expiry) {
      props.deleteProperty('RESET_TOKEN_' + token);
      return { success: false, message: 'This reset link has expired. Please request a new one.' };
    }

    // Update password in sheet
    var sheet = getMembersSheet_();
    if (!sheet) return { success: false, message: 'System error.' };
    var data = sheet.getDataRange().getValues();
    var updated = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === String(parsed.memberId).trim().toUpperCase()) {
        sheet.getRange(i + 1, 2).setNumberFormat('@').setValue(String(newPassword));
        updated = true;
        break;
      }
    }

    // Clean up token
    props.deleteProperty('RESET_TOKEN_' + token);
    try { CacheService.getScriptCache().removeAll(['login_members_data', 'members_data']); } catch(e) {}

    if (!updated) return { success: false, message: 'Member not found.' };
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// Legacy — kept for backward compatibility but no longer used
function resetMemberPassword(input) {
  return { success: false, message: 'Please use the Forgot Password link to reset via email.' };
}

function loginAdmin(username, password, role) {
  // 1. Hardcoded super-admin (ICMADMIN) — always works
  if (username === 'ICMADMIN' && password === 'ICM12345') return { success: true, role: 'admin' };

  var props = PropertiesService.getScriptProperties();

  // 1b. TEMPORARY demo bypass (requested: no passwords for now).
  // Username 1 + password 1 logs in as the selected role pill.
  // Remove this block to restore strict passwords.
  if (String(username).trim() === '1' && String(password) === '1') {
    var demoRoles = ['regular', 'shortterm', 'commodity', 'treasurer', 'chairperson'];
    var demoRole = demoRoles.indexOf(String(role).toLowerCase()) !== -1 ? String(role).toLowerCase() : 'regular';
    return {
      success: true, role: demoRole,
      officer: { name: 'Demo ' + demoRole, email: 'demo', mobile: '', isProfileComplete: true, mustChangePassword: false }
    };
  }

  // 2. Master Admin via Script Properties (backward compat)
  if (role === 'masteradmin') {
    var maUser = props.getProperty('MASTER_ADMIN_USER') || 'MASTERADMIN';
    var maPass = props.getProperty('MASTER_ADMIN_PASS') || 'MA12345';
    if (username === maUser && password === maPass) {
      return { success: true, role: 'masteradmin' };
    }
  }

  // 3. Check individual officer accounts in Officers sheet (email-based login)
  // Try cache first
  var cache = CacheService.getScriptCache();
  var cached = cache.get('login_officers_data');
  var officers = cached ? JSON.parse(cached) : null;

  if (!officers) {
    var sheet = getOfficersSheet_();
    if (sheet) {
      try {
        var data = sheet.getDataRange().getValues();
        officers = [];
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          officers.push({
            email: String(row[0] || '').trim().toLowerCase(),
            password: String(row[1] || '').trim(),
            role: String(row[2] || '').trim().toLowerCase(),
            status: String(row[5] || 'Active').trim().toLowerCase(),
            fullname: String(row[3] || ''),
            mobile: String(row[4] || ''),
            schoolYear: String(row[8] || ''),
            mustChange: String(row[10] || '').trim().toUpperCase() === 'YES'
          });
        }
        cache.put('login_officers_data', JSON.stringify(officers), 300);
      } catch(e) { officers = []; }
    } else {
      officers = [];
    }
  }

  var inputEmail = String(username).trim().toLowerCase();
  var demoNoPw = false;
  try { demoNoPw = PropertiesService.getScriptProperties().getProperty('DEMO_NO_PASSWORD') === 'TRUE'; } catch (e) {}
  for (var i = 0; i < officers.length; i++) {
    var o = officers[i];
    var pwOk = demoNoPw ? true : (o.password === password);
    if (o.email === inputEmail && pwOk) {
      if (o.status !== 'active') {
        return { success: false, message: 'This account has been deactivated. Contact the Master Admin.' };
      }
      // Update last login (async, don't wait)
      try {
        var tz = Session.getScriptTimeZone();
        sheet.getRange(i + 2, 10).setValue(Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss'));
      } catch(e) {}

      return {
        success: true,
        role: o.role,
        officer: {
          name: o.fullname,
          email: o.email,
          mobile: o.mobile,
          schoolYear: o.schoolYear,
          isProfileComplete: !!(o.fullname),
          mustChangePassword: o.mustChange
        }
      };
    }
  }

  // 4. Legacy — Script Properties role-based credentials (backward compat)
  var legacyOfficers = {
    'regular':   { user: props.getProperty('OFFICER_REGULAR_USER') || 'REGULAR',      pass: props.getProperty('OFFICER_REGULAR_PASS')   || 'REG12345' },
    'shortterm': { user: props.getProperty('OFFICER_SHORTTERM_USER') || 'SHORTTERM',  pass: props.getProperty('OFFICER_SHORTTERM_PASS') || 'ST12345' },
    'commodity': { user: props.getProperty('OFFICER_COMMODITY_USER') || 'COMMODITY',  pass: props.getProperty('OFFICER_COMMODITY_PASS') || 'COM12345' },
    'treasurer': { user: props.getProperty('OFFICER_TREASURER_USER') || 'TREASURER',  pass: props.getProperty('OFFICER_TREASURER_PASS') || 'TS12345' },
    'chairperson': { user: props.getProperty('OFFICER_CHAIRPERSON_USER') || 'CHAIRPERSON', pass: props.getProperty('OFFICER_CHAIRPERSON_PASS') || 'CHA12345' }
  };
  var officer = legacyOfficers[role];
  if (officer && username === officer.user && password === officer.pass) {
    var name = props.getProperty('OFFICER_' + role.toUpperCase() + '_NAME') || '';
    var email = props.getProperty('OFFICER_' + role.toUpperCase() + '_EMAIL') || '';
    var mobile = props.getProperty('OFFICER_' + role.toUpperCase() + '_MOBILE') || '';
    var isProfileComplete = name && email && mobile;
    return { success: true, role: role, officer: { name: name, email: email, mobile: mobile, isProfileComplete: isProfileComplete } };
  }
  return { success: false, message: 'Invalid credentials.' };
}

function saveOfficerCredentials(data) {
  try {
    var props = PropertiesService.getScriptProperties();
    var roleKey = 'OFFICER_' + data.role.toUpperCase();
    if (data.username) props.setProperty(roleKey + '_USER', data.username);
    if (data.password) props.setProperty(roleKey + '_PASS', data.password);
    if (data.name) props.setProperty(roleKey + '_NAME', data.name);
    if (data.email) props.setProperty(roleKey + '_EMAIL', data.email);
    if (data.mobile) props.setProperty(roleKey + '_MOBILE', data.mobile);
    if (data.permissions) props.setProperty(roleKey + '_PERMS', JSON.stringify(data.permissions));
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
}

function getOfficerCredentials() {
  try {
    var props = PropertiesService.getScriptProperties();
    var roles = ['REGULAR', 'SHORTTERM', 'COMMODITY', 'TREASURER', 'CHAIRPERSON'];
    var result = { success: true };
    
    var officerSheet = getOfficersSheet_();
    var officerData = {};
    if (officerSheet) {
      var data = officerSheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var role = String(row[2] || '').trim().toLowerCase();
        if (role) {
          officerData[role] = {
            mustChangePassword: String(row[10] || '').trim().toUpperCase() === 'YES',
            fullname: String(row[3] || '').trim()
          };
        }
      }
    }
    
    roles.forEach(function(r) {
      var roleLower = r.toLowerCase();
      var sheetData = officerData[roleLower] || {};
      result[roleLower] = {
        username: props.getProperty('OFFICER_' + r + '_USER') || r,
        password: props.getProperty('OFFICER_' + r + '_PASS') || (r.substring(0,3) + '12345'),
        name: props.getProperty('OFFICER_' + r + '_NAME') || sheetData.fullname || '',
        email: props.getProperty('OFFICER_' + r + '_EMAIL') || '',
        mobile: props.getProperty('OFFICER_' + r + '_MOBILE') || '',
        permissions: JSON.parse(props.getProperty('OFFICER_' + r + '_PERMS') || '[]'),
        mustChangePassword: sheetData.mustChangePassword || false
      };
    });
    return result;
  } catch (e) { return { success: false }; }
}

function completeOfficerProfileSetup(data) {
  try {
    var props = PropertiesService.getScriptProperties();
    var roleKey = 'OFFICER_' + data.role.toUpperCase();
    
    // Save profile data
    if (data.name) props.setProperty(roleKey + '_NAME', data.name);
    if (data.email) props.setProperty(roleKey + '_EMAIL', data.email);
    if (data.mobile) props.setProperty(roleKey + '_MOBILE', data.mobile);
    if (data.newPassword) props.setProperty(roleKey + '_PASS', data.newPassword);
    
    // Clear cache
    try { CacheService.getScriptCache().removeAll(['officer_credentials']); } catch(e) {}
    
    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
}

// ── Officer login helpers: cache clear + temporary no-password demo mode ──
// Run setDemoNoPassword(true) in Apps Script editor to skip password check.
// Run setDemoNoPassword(false) to restore. Does NOT delete stored passwords.
function clearOfficerLoginCache() {
  try {
    CacheService.getScriptCache().removeAll(['officer_accounts', 'login_officers_data', 'officer_credentials']);
    return { success: true, message: 'Officer login cache cleared. New sheet passwords take effect now.' };
  } catch (e) { return { success: false, message: e.message }; }
}

function setDemoNoPassword(enabled) {
  try {
    PropertiesService.getScriptProperties().setProperty('DEMO_NO_PASSWORD', enabled ? 'TRUE' : 'FALSE');
    clearOfficerLoginCache();
    return { success: true, demoNoPassword: !!enabled };
  } catch (e) { return { success: false, message: e.message }; }
}

// ═══════════════════════════════════════════
// Officers Sheet — individual accounts managed by Master Admin
// ═══════════════════════════════════════════

function getOfficersSheet_() {
  var ss = openSheet_();
  if (!ss) return null;
  var sheet = findSheetCI_(ss, 'Officers');
  if (!sheet) {
    sheet = ss.insertSheet('Officers');
    sheet.getRange('A1:K1').setValues([[
      'EMAIL', 'PASSWORD', 'ROLE', 'FULLNAME', 'MOBILE',
      'STATUS', 'CREATED_BY', 'CREATED_AT', 'SCHOOL_YEAR', 'LAST_LOGIN', 'MUST_CHANGE_PW'
    ]]);
    sheet.getRange('A1:K1').setFontWeight('bold').setBackground('#F4F2EE');
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < 11) {
    // Self-heal older sheets that predate the MUST_CHANGE_PW column
    sheet.getRange(1, 11).setValue('MUST_CHANGE_PW');
    sheet.getRange(1, 11).setFontWeight('bold').setBackground('#F4F2EE');
  }
  return sheet;
}

function createOfficerAccount(data) {
  try {
    var sheet = getOfficersSheet_();
    if (!sheet) return { success: false, message: 'Spreadsheet not connected.' };

    var email = String(data.email || '').trim().toLowerCase();
    var password = String(data.password || '').trim();
    var role = String(data.role || '').trim().toLowerCase();
    var fullname = String(data.fullname || '').trim();
    var mobile = String(data.mobile || '').trim();
    var schoolYear = String(data.schoolYear || '').trim() ||
      PropertiesService.getScriptProperties().getProperty('SCHOOL_YEAR') || 'AY 2025-2026';

    if (!email || !password || !role || !fullname) {
      return { success: false, message: 'Email, password, role, and full name are required.' };
    }

    var validRoles = ['regular', 'shortterm', 'commodity', 'treasurer', 'chairperson'];
    if (validRoles.indexOf(role) === -1) {
      return { success: false, message: 'Invalid role. Must be: ' + validRoles.join(', ') + '.' };
    }

    var existing = sheet.getDataRange().getValues();
    for (var i = 1; i < existing.length; i++) {
      var existingEmail = String(existing[i][0] || '').trim().toLowerCase();
      if (existingEmail === email) {
        return { success: false, message: 'An account with this email already exists.' };
      }
    }

    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([email, password, role, fullname, mobile, 'Active', 'ICMADMIN', now, schoolYear, '', 'YES']);

    try { CacheService.getScriptCache().removeAll(['officer_accounts', 'login_officers_data']); } catch(e) {}

    // Send email notification with credentials
    try {
      var subject = '🔑 Your CampusCoop Officer Account Has Been Created';
      var roleLabels = {
        'regular': 'Regular Loan Officer',
        'shortterm': 'Short Term Loan Officer',
        'commodity': 'Commodity Loan Officer',
        'treasurer': 'Treasurer',
        'chairperson': 'Chairperson'
      };
      var roleLabel = roleLabels[role] || role;
      var htmlBody = '<div style="font-family:Arial,sans-serif;max-width:520px;background:#F4F2EE;padding:24px;">'
        + '<div style="background:#1C2B3A;padding:20px 24px;border-radius:10px 10px 0 0;text-align:center;">'
        + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
        + '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;">Officer Account Created</div>'
        + '</div>'
        + '<div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">'
        + '<p style="font-size:15px;color:#1C2B3A;">Dear <strong>' + fullname + '</strong>,</p>'
        + '<p style="font-size:13px;color:#555;line-height:1.7;">Your CampusCoop officer account has been created by the Master Admin. Use the credentials below to log in:</p>'
        + '<table style="border-collapse:collapse;width:100%;margin:14px 0;font-size:13px;">'
        + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;width:150px;">Role</td>'
        + '<td style="padding:10px 12px;font-weight:600;border:0.5px solid #E0DDD6;">' + roleLabel + '</td></tr>'
        + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;">Email</td>'
        + '<td style="padding:10px 12px;font-family:monospace;font-weight:600;border:0.5px solid #E0DDD6;">' + email + '</td></tr>'
        + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;">Password</td>'
        + '<td style="padding:10px 12px;font-family:monospace;font-weight:700;color:#A32D2D;border:0.5px solid #E0DDD6;">' + password + '</td></tr>'
        + '</table>'
        + '<p style="font-size:12px;color:#888;line-height:1.6;">Please log in at the CampusCoop system using the Officer Login tab. Select your section (' + roleLabel + ') and enter your email and password.</p>'
        + '<p style="font-size:13px;color:#555;line-height:1.7;"><strong>Important:</strong> For security, you will be required to change this password and set your own email address on your first sign-in.</p>'
        + '<div style="margin-top:20px;font-size:11px;color:#bbb;line-height:1.7;">This is an automated message from SKSU Cooperative. If you did not expect this, contact the cooperative office.</div>'
        + '</div></div>';
      MailApp.sendEmail({ to: email, subject: subject, htmlBody: htmlBody });
    } catch(emailErr) {
      Logger.log('Officer credential email error: ' + emailErr);
    }

    return { success: true, email: email, role: role };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getOfficerAccounts() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('officer_accounts');
    if (cached) { try { return { success: true, accounts: JSON.parse(cached) }; } catch(e) {} }

    var sheet = getOfficersSheet_();
    if (!sheet) return { success: false, message: 'No spreadsheet connected.', accounts: [] };

    var data = sheet.getDataRange().getValues();
    var accounts = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      accounts.push({
        email: String(row[0]),
        password: String(row[1]),
        role: String(row[2]),
        fullname: String(row[3]),
        mobile: String(row[4] || ''),
        status: String(row[5] || 'Active'),
        createdBy: String(row[6] || ''),
        createdAt: String(row[7] || ''),
        schoolYear: String(row[8] || ''),
        lastLogin: String(row[9] || '')
      });
    }

    try { cache.put('officer_accounts', JSON.stringify(accounts), 60); } catch(e) {}

    return { success: true, accounts: accounts };
  } catch (e) {
    return { success: false, message: e.message, accounts: [] };
  }
}

function updateOfficerAccount(email, data) {
  try {
    var sheet = getOfficersSheet_();
    if (!sheet) return { success: false, message: 'Spreadsheet not connected.' };

    var rows = sheet.getDataRange().getValues();
    var targetRow = -1;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim().toLowerCase() === String(email).trim().toLowerCase()) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) return { success: false, message: 'Account not found.' };

    if (data.email !== undefined && String(data.email).trim().toLowerCase() !== String(email).trim().toLowerCase()) {
      for (var j = 1; j < rows.length; j++) {
        if (j + 1 === targetRow) continue;
        if (String(rows[j][0] || '').trim().toLowerCase() === String(data.email).trim().toLowerCase()) {
          return { success: false, message: 'Email already in use by another account.' };
        }
      }
      sheet.getRange(targetRow, 1).setValue(String(data.email).trim().toLowerCase());
    }
    if (data.password) sheet.getRange(targetRow, 2).setValue(String(data.password));
    if (data.role) sheet.getRange(targetRow, 3).setValue(String(data.role).toLowerCase());
    if (data.fullname) sheet.getRange(targetRow, 4).setValue(String(data.fullname));
    if (data.mobile !== undefined) sheet.getRange(targetRow, 5).setValue(String(data.mobile));
    if (data.status) sheet.getRange(targetRow, 6).setValue(String(data.status));

    try { CacheService.getScriptCache().removeAll(['officer_accounts', 'login_officers_data']); } catch(e) {}

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function deactivateOfficerAccount(email) {
  return updateOfficerAccount(email, { status: 'Inactive' });
}

function deleteMyOfficerAccount(role) {
  try {
    var roleLower = String(role || '').trim().toLowerCase();
    var validRoles = ['regular', 'shortterm', 'commodity'];
    if (validRoles.indexOf(roleLower) === -1) {
      return { success: false, message: 'Invalid role. Only regular, shortterm, commodity officers can delete their own account.' };
    }
    
    var sheet = getOfficersSheet_();
    if (!sheet) return { success: false, message: 'Spreadsheet not connected.' };
    
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][2] || '').trim().toLowerCase() === roleLower) {
        var rowNum = i + 1;
        sheet.getRange(rowNum, 6).setValue('Inactive');
        return { success: true, message: 'Officer account deactivated.' };
      }
    }
    return { success: false, message: 'No officer found for role: ' + roleLower };
  } catch (e) { return { success: false, message: e.message }; }
}

// ═══ First sign-in: officer sets their own email + password ═══
// Verifies current credentials, then updates the Officers sheet
// row (login identifier + password) and clears MUST_CHANGE_PW.
function changeOfficerCredentials(data) {
  try {
    var identifier     = String(data.identifier || '').trim().toLowerCase();
    var currentPassword = String(data.currentPassword || '');
    var newPassword    = String(data.newPassword || '');
    var newEmail       = String(data.newEmail || '').trim().toLowerCase();

    if (!identifier)  return { success: false, message: 'Session expired. Please log in again.' };
    if (!currentPassword) return { success: false, message: 'Please enter your current password.' };
    if (!newEmail)    return { success: false, message: 'Please enter your new email address.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return { success: false, message: 'Please enter a valid email address.' };
    if (newPassword.length < 8) return { success: false, message: 'New password must be at least 8 characters.' };

    // Block reusing the temporary credential as the new one
    if (newPassword === currentPassword) return { success: false, message: 'New password must be different from your current password.' };

    var sheet = getOfficersSheet_();
    if (!sheet) return { success: false, message: 'Spreadsheet not connected.' };

    var rows = sheet.getDataRange().getValues();
    var targetRow = -1;
    var targetRole = '';
    var fullname = '';
    for (var i = 1; i < rows.length; i++) {
      var idA = String(rows[i][0] || '').trim().toLowerCase();
      if (idA === identifier && String(rows[i][1] || '') === currentPassword) {
        targetRow = i + 1;
        targetRole = String(rows[i][2] || '').trim().toLowerCase();
        fullname = String(rows[i][3] || '');
        break;
      }
    }
    if (targetRow === -1) return { success: false, message: 'Current password is incorrect.' };

    // New email must not collide with another officer account
    for (var j = 1; j < rows.length; j++) {
      if (j + 1 === targetRow) continue;
      if (String(rows[j][0] || '').trim().toLowerCase() === newEmail) {
        return { success: false, message: 'That email is already used by another officer account.' };
      }
    }

    var tz = Session.getScriptTimeZone();
    var now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    sheet.getRange(targetRow, 1).setNumberFormat('@').setValue(newEmail);
    sheet.getRange(targetRow, 2).setNumberFormat('@').setValue(newPassword);
    sheet.getRange(targetRow, 11).setValue('');   // clear MUST_CHANGE_PW
    sheet.getRange(targetRow, 10).setValue(now);  // treat this as first login

    // Keep legacy Script Properties in sync so old logins still resolve
    try {
      var props = PropertiesService.getScriptProperties();
      var roleKey = 'OFFICER_' + String(targetRole).toUpperCase();
      props.setProperty(roleKey + '_USER', newEmail);
      props.setProperty(roleKey + '_PASS', newPassword);
      props.setProperty(roleKey + '_EMAIL', newEmail);
    } catch(e) {}

    try { CacheService.getScriptCache().removeAll(['officer_accounts', 'officer_credentials', 'login_officers_data']); } catch(e) {}

    // Confirmation email to their new address
    try {
      var confirmBody = '<div style="font-family:Arial,sans-serif;max-width:520px;background:#F4F2EE;padding:24px;">'
        + '<div style="background:#1C2B3A;padding:20px 24px;border-radius:10px 10px 0 0;text-align:center;">'
        + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
        + '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;">Account Secured</div>'
        + '</div>'
        + '<div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">'
        + '<p style="font-size:15px;color:#1C2B3A;">Dear <strong>' + (fullname || 'Officer') + '</strong>,</p>'
        + '<p style="font-size:13px;color:#555;line-height:1.7;">Your CampusCoop officer account has been secured. Your sign-in email is now <strong>' + newEmail + '</strong> and your password has been changed successfully.</p>'
        + '<p style="font-size:12px;color:#888;line-height:1.6;">Use these credentials whenever you sign in through the Officer Login tab. If you did not make this change, contact the cooperative office immediately.</p>'
        + '<div style="margin-top:20px;font-size:11px;color:#bbb;line-height:1.7;">This is an automated message from SKSU Cooperative.</div>'
        + '</div></div>';
      GmailApp.sendEmail(newEmail, '\u2705 Your CampusCoop officer account is now secure', '', { htmlBody: confirmBody });
    } catch(mailErr) {
      Logger.log('Officer credential change confirmation email error: ' + mailErr.message);
    }

    return { success: true, fullname: fullname };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══ Chairman: assign a member as an officer (officer logs in with member credentials) ═══
function assignOfficerFromMember(data) {
  try {
    var role = String(data.role || '').trim().toLowerCase();
    var validRoles = ['regular', 'shortterm', 'commodity', 'treasurer', 'chairperson'];
    if (validRoles.indexOf(role) === -1) {
      return { success: false, message: 'Invalid officer role. Must be regular, shortterm, commodity, treasurer, or chairperson.' };
    }

    var memberId = String(data.memberId || '').trim();
    if (!memberId) return { success: false, message: 'Member is required.' };

    var mSheet = getMembersSheet_();
    if (!mSheet) return { success: false, message: 'Spreadsheet not connected.' };

    var mData = mSheet.getDataRange().getValues();
    var member = null;
    for (var i = 1; i < mData.length; i++) {
      if (String(mData[i][0] || '').trim() === memberId) {
        member = {
          username: String(mData[i][0] || '').trim(),
          password: String(mData[i][1] || ''),
          email: String(mData[i][2] || '').trim(),
          fullname: (String(mData[i][4] || '').trim() + ' ' + String(mData[i][5] || '').trim()).trim(),
          mobile: String(mData[i][9] || '').trim()
        };
        break;
      }
    }
    if (!member) return { success: false, message: 'Member not found.' };
    if (!member.password) return { success: false, message: 'This member has no password set yet.' };

    // Check if member is already a chairperson and trying to assign another role
    if (role !== 'chairperson') {
      for (var k = 1; k < rows.length; k++) {
        if (String(rows[k][2] || '').trim().toLowerCase() === 'chairperson' &&
            String(rows[k][0] || '').trim() === memberId) {
          return { success: false, message: 'This member is already the Chairperson. Chairperson cannot hold another officer role.' };
        }
      }
    }

    var oSheet = getOfficersSheet_();
    if (!oSheet) return { success: false, message: 'Spreadsheet not connected.' };

    // Find the existing row for this role (one officer per role) so reassignment replaces it
    var rows = oSheet.getDataRange().getValues();
    var targetRow = -1;
    var previousOfficer = null;
    for (var j = 1; j < rows.length; j++) {
      if (String(rows[j][2] || '').trim().toLowerCase() === role) {
        targetRow = j + 1;
        previousOfficer = {
          identifier: String(rows[j][0] || '').trim(),
          fullname: String(rows[j][3] || '').trim(),
          email: String(rows[j][0] || '').trim()
        };
        break;
      }
    }

    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var schoolYear = PropertiesService.getScriptProperties().getProperty('SCHOOL_YEAR') || 'AY 2025-2026';

    if (targetRow === -1) {
      oSheet.appendRow([member.username, member.password, role, member.fullname, member.mobile, 'Active', 'CHAIRPERSON', now, schoolYear, '', 'YES']);
    } else {
      oSheet.getRange(targetRow, 1).setValue(member.username);
      oSheet.getRange(targetRow, 2).setValue(member.password);
      oSheet.getRange(targetRow, 3).setValue(role);
      oSheet.getRange(targetRow, 4).setValue(member.fullname);
      oSheet.getRange(targetRow, 5).setValue(member.mobile);
      oSheet.getRange(targetRow, 6).setValue('Active');
      oSheet.getRange(targetRow, 8).setValue(now);
      oSheet.getRange(targetRow, 9).setValue(schoolYear);
      oSheet.getRange(targetRow, 11).setValue('YES');   // force credential change at first login
    }

    // Sync legacy Script Properties so role names/permissions stay consistent
    try {
      var props = PropertiesService.getScriptProperties();
      var roleKey = 'OFFICER_' + role.toUpperCase();
      props.setProperty(roleKey + '_USER', member.username);
      props.setProperty(roleKey + '_PASS', member.password);
      props.setProperty(roleKey + '_NAME', member.fullname);
      props.setProperty(roleKey + '_EMAIL', member.email || member.username);
      props.setProperty(roleKey + '_MOBILE', member.mobile);
    } catch(e) {}

    try {
      CacheService.getScriptCache().removeAll(['officer_accounts', 'officer_credentials', 'login_officers_data']);
    } catch(e) {}

    var roleLabels = {
      'regular': 'Regular Loan Officer',
      'shortterm': 'Short Term Loan Officer',
      'commodity': 'Commodity Loan Officer',
      'treasurer': 'Treasurer',
      'chairperson': 'Chairperson'
    };
    var roleLabel = roleLabels[role] || role;

    // ── Email notifications ──────────────────────────────────────────
    // 1) Notify the NEW officer in their Gmail with sign-in instructions.
    // 2) If this replaces a previous officer, notify them that their
    //    officer access has ended (access is revoked immediately).
    try {
      var tz2 = Session.getScriptTimeZone();
      var dateStr = Utilities.formatDate(new Date(), tz2, 'MMMM dd, yyyy');

      var newOfficerBody = '<div style="font-family:Arial,sans-serif;max-width:520px;background:#F4F2EE;padding:24px;">'
        + '<div style="background:#1C2B3A;padding:20px 24px;border-radius:10px 10px 0 0;text-align:center;">'
        + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
        + '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;">Officer Assignment Notice</div>'
        + '</div>'
        + '<div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">'
        + '<p style="font-size:15px;color:#1C2B3A;">Dear <strong>' + member.fullname + '</strong>,</p>'
        + '<p style="font-size:13px;color:#555;line-height:1.7;">You have been assigned as the <strong>' + roleLabel + '</strong> of the cooperative effective ' + dateStr + '. Congratulations!</p>'
        + '<table style="border-collapse:collapse;width:100%;margin:14px 0;font-size:13px;">'
        + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;width:150px;">Role</td>'
        + '<td style="padding:10px 12px;font-weight:600;border:0.5px solid #E0DDD6;">' + roleLabel + '</td></tr>'
        + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;">Login (Email / Username)</td>'
        + '<td style="padding:10px 12px;font-family:monospace;font-weight:600;border:0.5px solid #E0DDD6;">' + member.username + '</td></tr>'
        + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;">Password</td>'
        + '<td style="padding:10px 12px;border:0.5px solid #E0DDD6;">Your current member password</td></tr>'
        + '</table>'
        + '<p style="font-size:13px;color:#555;line-height:1.7;"><strong>Important:</strong> On your first sign-in you will be asked to set your own <strong>email address</strong> and a <strong>new password</strong>. This secures your officer account — please do not share it with anyone.</p>'
        + '<p style="font-size:12px;color:#888;line-height:1.6;">Sign in at the CampusCoop system using the Officer Login tab, select "' + roleLabel + '", then enter the credentials above.</p>'
        + '<div style="margin-top:20px;font-size:11px;color:#bbb;line-height:1.7;">This is an automated message from SKSU Cooperative. If you did not expect this, contact the cooperative office.</div>'
        + '</div></div>';
      if (member.email) {
        GmailApp.sendEmail(member.email, '\uD83D\uDD11 You have been assigned as ' + roleLabel + ' \u2014 CampusCoop', '', { htmlBody: newOfficerBody });
      }
    } catch (mailErr) {
      Logger.log('New officer assignment email error: ' + mailErr.message);
    }

    try {
      if (previousOfficer && previousOfficer.identifier &&
          String(previousOfficer.identifier).toLowerCase() !== String(member.username).toLowerCase()) {
        var oldBody = '<div style="font-family:Arial,sans-serif;max-width:520px;background:#F4F2EE;padding:24px;">'
          + '<div style="background:#1C2B3A;padding:20px 24px;border-radius:10px 10px 0 0;text-align:center;">'
          + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
          + '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;">Officer Access Update</div>'
          + '</div>'
          + '<div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">'
          + '<p style="font-size:15px;color:#1C2B3A;">Dear <strong>' + (previousOfficer.fullname || previousOfficer.identifier) + '</strong>,</p>'
          + '<p style="font-size:13px;color:#555;line-height:1.7;">This is to inform you that your assignment as <strong>' + roleLabel + '</strong> has ended effective ' + dateStr + ', and another member now holds this position.</p>'
          + '<p style="font-size:13px;color:#555;line-height:1.7;">Your officer access to the CampusCoop system has been revoked immediately. Your regular member account remains active and unaffected.</p>'
          + '<p style="font-size:12px;color:#888;line-height:1.6;">Thank you for your service to the cooperative.</p>'
          + '<div style="margin-top:20px;font-size:11px;color:#bbb;line-height:1.7;">This is an automated message from SKSU Cooperative. If you believe this is a mistake, contact the cooperative office.</div>'
          + '</div></div>';
        GmailApp.sendEmail(previousOfficer.email, 'Your ' + roleLabel + ' access has ended \u2014 CampusCoop', '', { htmlBody: oldBody });
      }
    } catch (oldMailErr) {
      Logger.log('Previous officer notice email error: ' + oldMailErr.message);
    }

    return {
      success: true,
      message: member.fullname + ' is now assigned as the ' + roleLabel + '. '
        + 'An email notice was sent to their Gmail (' + (member.email || 'no email on file') + '). '
        + 'They can log in with their member username (' + member.username + ') and password, and will be required to set their own email and password on first sign-in.'
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══ Chairperson Transfer: assign new chairperson with new credentials ═══
function transferChairperson(data) {
  try {
    var newMemberId = String(data.newMemberId || '').trim();
    var newUsername = String(data.newUsername || '').trim();
    var newPassword = String(data.newPassword || '').trim();
    var newEmail = String(data.newEmail || '').trim().toLowerCase();
    var adminName = String(data.adminName || '').trim();

    if (!newMemberId || !newUsername || !newPassword || !newEmail) {
      return { success: false, message: 'All fields are required: new member ID, new username, new password, new email.' };
    }

    // Validate email format
    if (newEmail.indexOf('@') === -1) {
      return { success: false, message: 'Invalid email format.' };
    }

    // Validate password length
    if (newPassword.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters.' };
    }

    var mSheet = getMembersSheet_();
    if (!mSheet) return { success: false, message: 'Spreadsheet not connected.' };

    // Find the new member
    var mData = mSheet.getDataRange().getValues();
    var newMember = null;
    var newMemberRow = -1;
    for (var i = 1; i < mData.length; i++) {
      if (String(mData[i][0] || '').trim() === newMemberId) {
        newMember = {
          username: String(mData[i][0] || '').trim(),
          password: String(mData[i][1] || ''),
          email: String(mData[i][2] || '').trim(),
          fullname: (String(mData[i][4] || '').trim() + ' ' + String(mData[i][5] || '').trim()).trim(),
          mobile: String(mData[i][9] || '').trim()
        };
        newMemberRow = i + 1;
        break;
      }
    }
    if (!newMember) return { success: false, message: 'New member not found.' };
    if (!newMember.password) return { success: false, message: 'This member has no password set yet.' };

    // Check if new username already exists in Officers sheet
    var oSheet = getOfficersSheet_();
    if (!oSheet) return { success: false, message: 'Spreadsheet not connected.' };
    var oRows = oSheet.getDataRange().getValues();
    for (var j = 1; j < oRows.length; j++) {
      if (String(oRows[j][0] || '').trim().toLowerCase() === newUsername.toLowerCase()) {
        return { success: false, message: 'This username is already taken by another officer.' };
      }
    }

    // Find and deactivate current chairperson
    var oldChairperson = null;
    for (var k = 1; k < oRows.length; k++) {
      if (String(oRows[k][2] || '').trim().toLowerCase() === 'chairperson') {
        oldChairperson = {
          identifier: String(oRows[k][0] || '').trim(),
          fullname: String(oRows[k][3] || '').trim(),
          email: String(oRows[k][0] || '').trim()
        };
        // Deactivate old chairperson
        oSheet.getRange(k + 1, 6).setValue('Inactive');
        break;
      }
    }

    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var schoolYear = PropertiesService.getScriptProperties().getProperty('SCHOOL_YEAR') || 'AY 2025-2026';

    // Add new chairperson with new credentials
    oSheet.appendRow([newUsername, newPassword, 'chairperson', newMember.fullname, newMember.mobile, 'Active', 'CHAIRPERSON', now, schoolYear, '', 'YES']);

    // Update member's role to Officer in Members sheet
    mSheet.getRange(newMemberRow, 14).setValue('Officer');

    // Sync legacy Script Properties
    try {
      var props = PropertiesService.getScriptProperties();
      props.setProperty('OFFICER_CHAIRPERSON_USER', newUsername);
      props.setProperty('OFFICER_CHAIRPERSON_PASS', newPassword);
      props.setProperty('OFFICER_CHAIRPERSON_NAME', newMember.fullname);
      props.setProperty('OFFICER_CHAIRPERSON_EMAIL', newEmail);
      props.setProperty('OFFICER_CHAIRPERSON_MOBILE', newMember.mobile);
    } catch(e) {}

    try {
      CacheService.getScriptCache().removeAll(['officer_accounts', 'officer_credentials', 'login_officers_data', 'members_data']);
    } catch(e) {}

    // Email notifications
    try {
      var tz2 = Session.getScriptTimeZone();
      var dateStr = Utilities.formatDate(new Date(), tz2, 'MMMM dd, yyyy');

      // Notify new chairperson
      var newChairBody = '<div style="font-family:Arial,sans-serif;max-width:520px;background:#F4F2EE;padding:24px;">'
        + '<div style="background:#1C2B3A;padding:20px 24px;border-radius:10px 10px 0 0;text-align:center;">'
        + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
        + '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;">Chairperson Assignment Notice</div>'
        + '</div>'
        + '<div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">'
        + '<p style="font-size:15px;color:#1C2B3A;">Dear <strong>' + newMember.fullname + '</strong>,</p>'
        + '<p style="font-size:13px;color:#555;line-height:1.7;">You have been assigned as the <strong>Chairperson</strong> of the cooperative effective ' + dateStr + '. Congratulations!</p>'
        + '<table style="border-collapse:collapse;width:100%;margin:14px 0;font-size:13px;">'
        + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;width:150px;">Role</td>'
        + '<td style="padding:10px 12px;font-weight:600;border:0.5px solid #E0DDD6;">Chairperson</td></tr>'
        + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;">Login (Username)</td>'
        + '<td style="padding:10px 12px;font-family:monospace;font-weight:600;border:0.5px solid #E0DDD6;">' + newUsername + '</td></tr>'
        + '<tr><td style="padding:10px 12px;background:#F8F7F5;font-weight:700;border:0.5px solid #E0DDD6;">Password</td>'
        + '<td style="padding:10px 12px;border:0.5px solid #E0DDD6;">' + newPassword + '</td></tr>'
        + '</table>'
        + '<p style="font-size:13px;color:#555;line-height:1.7;"><strong>Important:</strong> This is a dedicated Chairperson account with new credentials. You have view-only access to all loan data.</p>'
        + '<p style="font-size:12px;color:#888;line-height:1.6;">Sign in at the CampusCoop system using the Officer Login tab, select "Chairperson", then enter the credentials above.</p>'
        + '<div style="margin-top:20px;font-size:11px;color:#bbb;line-height:1.7;">This is an automated message from SKSU Cooperative. If you did not expect this, contact the cooperative office.</div>'
        + '</div></div>';
      if (newMember.email) {
        GmailApp.sendEmail(newMember.email, '\uD83D\uDD11 You have been assigned as Chairperson \u2014 CampusCoop', '', { htmlBody: newChairBody });
      }

      // Notify old chairperson
      if (oldChairperson && oldChairperson.identifier !== newMemberId) {
        var oldBody = '<div style="font-family:Arial,sans-serif;max-width:520px;background:#F4F2EE;padding:24px;">'
          + '<div style="background:#1C2B3A;padding:20px 24px;border-radius:10px 10px 0 0;text-align:center;">'
          + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
          + '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;">Chairperson Access Update</div>'
          + '</div>'
          + '<div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;">'
          + '<p style="font-size:15px;color:#1C2B3A;">Dear <strong>' + (oldChairperson.fullname || oldChairperson.identifier) + '</strong>,</p>'
          + '<p style="font-size:13px;color:#555;line-height:1.7;">This is to inform you that your assignment as <strong>Chairperson</strong> has ended effective ' + dateStr + ', and another member now holds this position.</p>'
          + '<p style="font-size:13px;color:#555;line-height:1.7;">Your Chairperson access to the CampusCoop system has been revoked immediately. Your regular member account remains active and unaffected.</p>'
          + '<p style="font-size:12px;color:#888;line-height:1.6;">Thank you for your service to the cooperative.</p>'
          + '<div style="margin-top:20px;font-size:11px;color:#bbb;line-height:1.7;">This is an automated message from SKSU Cooperative. If you believe this is a mistake, contact the cooperative office.</div>'
          + '</div></div>';
        GmailApp.sendEmail(oldChairperson.email, 'Your Chairperson access has ended \u2014 CampusCoop', '', { htmlBody: oldBody });
      }
    } catch (mailErr) {
      Logger.log('Chairperson transfer email error: ' + mailErr.message);
    }

    return {
      success: true,
      message: newMember.fullname + ' is now the Chairperson with new credentials. '
        + 'An email notice was sent to their Gmail (' + (newMember.email || 'no email on file') + '). '
        + 'They can log in with username: ' + newUsername + ' and the provided password.'
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function deleteOfficerAccount(email) {
  try {
    var sheet = getOfficersSheet_();
    if (!sheet) return { success: false, message: 'Spreadsheet not connected.' };

    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim().toLowerCase() === String(email).trim().toLowerCase()) {
        sheet.deleteRow(i + 1);
try { CacheService.getScriptCache().removeAll(['officer_accounts', 'login_officers_data']); } catch(e) {}
        return { success: true };
      }
    }
    return { success: false, message: 'Account not found.' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Member Profile & SMS
// ═══════════════════════════════════════════

function getNextMemberID(m) { return generateUsername_(m); }
function logout() { return { success: true }; }

function clearMembersCache() {
  try {
    CacheService.getScriptCache().removeAll(['members_data', 'login_members_data', 'applications_data', 'loans_data', 'payments_data', 'analytics_data', 'officer_accounts', 'officer_credentials', 'login_officers_data']);
    return { success: true, message: 'Cache cleared successfully' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/* ── Clear mustChangePw flag after first-login update ── */
function clearMustChangePw(memberId) {
  try {
    var sheet = getMembersSheet_();
    if (!sheet) return { success: false };
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(memberId).trim()) {
        sheet.getRange(i + 1, 13).setValue(0);
        try { CacheService.getScriptCache().removeAll(['login_members_data', 'members_data']); } catch(e) {}
        return { success: true };
      }
    }
    return { success: false };
  } catch (e) { return { success: false, message: e.message }; }
}

function updateMemberProfile(memberID, newEmail, newPhone, newDept) {
  try {
    var sheet = getMembersSheet_();
    if (!sheet) return { success: false };
    var data = sheet.getDataRange().getValues();
    if (newPhone) {
      var newDigits = String(newPhone).replace(/\D/g, '');
      if (newDigits.length > 10) newDigits = newDigits.slice(-10);
      for (var k = 1; k < data.length; k++) {
        if (String(data[k][0]).trim() === String(memberID).trim()) continue;
        var p = String(data[k][9] || '').replace(/\D/g, '');
        if (p.length > 10) p = p.slice(-10);
        if (p === newDigits) return { success: false, message: 'Phone used.' };
      }
    }
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(memberID).trim()) {
        if (newEmail) sheet.getRange(i + 1, 3).setValue(newEmail);
        if (newPhone) sheet.getRange(i+1, 10).setValue(newPhone);
        if (newDept) sheet.getRange(i + 1, 4).setValue(newDept);
        try { CacheService.getScriptCache().removeAll(['login_members_data', 'members_data']); } catch(e) {}
        return { success: true };
      }
    }
    return { success: false };
  } catch (e) { return { success: false }; }
}

function changeMemberPassword(mid, cur, next, skipCheck) {
  try {
    var sheet = getMembersSheet_();
    if (!sheet) return { success: false };
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(mid).trim()) {
        if (!skipCheck && String(data[i][1]) !== cur) return { success: false, message: 'Incorrect password.' };
        sheet.getRange(i + 1, 2).setNumberFormat('@').setValue(String(next));
        try { CacheService.getScriptCache().removeAll(['login_members_data', 'members_data']); } catch(e) {}
        return { success: true };
      }
    }
    return { success: false };
  } catch (e) { return { success: false }; }
}

// ═══════════════════════════════════════════
// Change Member ID (Login ID) — updates across all sheets
// ═══════════════════════════════════════════
function changeMemberId(oldId, currentPassword, newId) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };

    var mSheet = getMembersSheet_();
    if (!mSheet) return { success: false, message: 'Members sheet not found.' };

    var mData = mSheet.getDataRange().getValues();
    var memberRow = -1;
    var member = null;

    // Find member and verify password
    for (var i = 1; i < mData.length; i++) {
      if (String(mData[i][0]).trim() === String(oldId).trim()) {
        memberRow = i + 1;
        if (String(mData[i][1]) !== currentPassword) {
          return { success: false, message: 'Incorrect password.' };
        }
        member = {
          username: String(mData[i][0]).trim(),
          password: String(mData[i][1]),
          email: String(mData[i][2]).trim(),
          memberType: String(mData[i][3]).trim(),
          firstName: String(mData[i][4]).trim(),
          lastName: String(mData[i][5]).trim(),
          department: String(mData[i][6]).trim(),
          capital: Number(String(mData[i][7]).replace(/,/g, '')) || 0,
          dateJoined: String(mData[i][8]).trim(),
          phone: String(mData[i][9]).trim(),
          status: String(mData[i][10]).trim()
        };
        break;
      }
    }
    if (memberRow === -1) return { success: false, message: 'Member not found.' };
    if (!member) return { success: false, message: 'Member data error.' };

    // Check if new ID already exists
    var newIdTrim = String(newId).trim();
    for (var j = 1; j < mData.length; j++) {
      if (String(mData[j][0]).trim() === newIdTrim) {
        return { success: false, message: 'This Member ID is already taken.' };
      }
    }

    // Update Members sheet (column A = username/memberId)
    mSheet.getRange(memberRow, 1).setValue(newIdTrim);

    // Update Loans sheet (column B = MEMBER-ID)
    var loansSheet = findSheetCI_(ss, 'Loans');
    if (loansSheet) {
      var lData = loansSheet.getDataRange().getValues();
      for (var k = 1; k < lData.length; k++) {
        if (String(lData[k][1]).trim() === String(oldId).trim()) {
          loansSheet.getRange(k + 1, 2).setValue(newIdTrim);
        }
      }
    }

    // Update Payments sheet (column B = MEMBER-ID)
    var paySheet = findSheetCI_(ss, 'Payments');
    if (paySheet) {
      var pData = paySheet.getDataRange().getValues();
      for (var p = 1; p < pData.length; p++) {
        if (String(pData[p][1]).trim() === String(oldId).trim()) {
          paySheet.getRange(p + 1, 2).setValue(newIdTrim);
        }
      }
    }

    // Update Applications sheet (column B = MEMBER-ID)
    var appSheet = findSheetCI_(ss, 'Applications');
    if (appSheet) {
      var aData = appSheet.getDataRange().getValues();
      for (var a = 1; a < aData.length; a++) {
        if (String(aData[a][1]).trim() === String(oldId).trim()) {
          appSheet.getRange(a + 1, 2).setValue(newIdTrim);
        }
      }
    }

    // Update Officers sheet (column A = EMAIL/identifier)
    var offSheet = findSheetCI_(ss, 'Officers');
    if (offSheet) {
      var oData = offSheet.getDataRange().getValues();
      for (var o = 1; o < oData.length; o++) {
        if (String(oData[o][0]).trim() === String(oldId).trim()) {
          offSheet.getRange(o + 1, 1).setValue(newIdTrim);
        }
      }
    }

    // Update REGULAR sheet
    var regSheet = findSheetCI_(ss, 'REGULAR');
    if (regSheet) {
      var rData = regSheet.getDataRange().getValues();
      for (var r = 1; r < rData.length; r++) {
        if (String(rData[r][1]).trim() === String(oldId).trim()) {
          regSheet.getRange(r + 1, 2).setValue(newIdTrim);
        }
      }
    }

    // Update SHORT-TERM sheet
    var stSheet = findSheetCI_(ss, 'SHORT-TERM');
    if (stSheet) {
      var stData = stSheet.getDataRange().getValues();
      for (var s = 1; s < stData.length; s++) {
        if (String(stData[s][1]).trim() === String(oldId).trim()) {
          stSheet.getRange(s + 1, 2).setValue(newIdTrim);
        }
      }
    }

    // Update COMMODITY sheet
    var comSheet = findSheetCI_(ss, 'COMMODITY');
    if (comSheet) {
      var cData = comSheet.getDataRange().getValues();
      for (var c = 1; c < cData.length; c++) {
        if (String(cData[c][1]).trim() === String(oldId).trim()) {
          comSheet.getRange(c + 1, 2).setValue(newIdTrim);
        }
      }
    }

    // Clear caches
    try {
      CacheService.getScriptCache().removeAll([
        'login_members_data', 'members_data', 'analytics_data',
        'applications_data', 'loans_data', 'payments_data'
      ]);
    } catch(e) {}

    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
}

/* ── Send account-created SMS/email to new member ── */
function sendAccountCreatedSms(data) {
  try {
    // Accept both object and positional-style call
    var phone, firstName, lastName, password, email;
    if (typeof data === 'object' && data !== null) {
      phone     = String(data.phone     || data[0] || '').trim();
      firstName = String(data.firstName || data[1] || '').trim();
      lastName  = String(data.lastName  || data[2] || '').trim();
      password  = String(data.password  || data[3] || '').trim();
      email     = String(data.email     || '').trim();
    } else {
      // Fallback: called as positional args
      phone = String(data || '').trim();
      firstName = ''; lastName = ''; password = ''; email = '';
    }
    if (!phone) return { success: false, message: 'No phone.' };

    var smsMsg = 'SKSU-Coop: Account created. Login: ' + phone
      + ' | Password: ' + (password || 'see email') + '.'
      + ' Login at the member portal and change your password on first login.';

    var smsResult = { success: false, message: 'TextBee not configured.' };
    try { smsResult = sendTextBeeSms_(phone, smsMsg); } catch(e) {}

    // Also send email if address provided
    if (email && email.indexOf('@') > -1) {
      try {
        MailApp.sendEmail({
          to: email,
          subject: 'Your SKSU Cooperative Account Credentials',
          htmlBody: '<div style="font-family:Arial,sans-serif;max-width:480px;">'
            + '<h2 style="color:#1C2B3A;">Welcome to SKSU Cooperative!</h2>'
            + '<p>Hello ' + firstName + ' ' + lastName + ', your member account has been created.</p>'
            + '<table style="border-collapse:collapse;width:100%;margin:16px 0;">'
            + '<tr><td style="padding:8px;background:#F4F2EE;font-weight:bold;">Login ID (Mobile)</td>'
            + '<td style="padding:8px;font-family:monospace;font-weight:bold;">' + phone + '</td></tr>'
            + '<tr><td style="padding:8px;background:#F4F2EE;font-weight:bold;">Initial Password</td>'
            + '<td style="padding:8px;font-family:monospace;font-weight:bold;color:#A32D2D;">' + (password || 'See SMS') + '</td></tr>'
            + '</table>'
            + '<p style="color:#854F0B;"><strong>\u26A0 Important:</strong> You must update your password on first login.</p>'
            + '</div>'
        });
      } catch(mailErr) { Logger.log('Credential email error: ' + mailErr); }
    }
    return smsResult;
  } catch(e) {
    return { success: false, message: e.message };
  }
}
function sendAccountCreatedSmsLegacy(o) { return { success: true }; }

// ═══════════════════════════════════════════
// CBU & Deduction Settings
// ═══════════════════════════════════════════

function getCbuSettings() {
  var props = PropertiesService.getScriptProperties();
  return {
    success: true,
    regPct: Number(props.getProperty('CBU_REG_PCT')) || 300,
    stPct:  Number(props.getProperty('CBU_ST_PCT'))  || 80,
    comPct: Number(props.getProperty('CBU_COM_PCT')) || 80
  };
}

function saveCbuSettings(d) {
  var props = PropertiesService.getScriptProperties();
  if (d.regPct) props.setProperty('CBU_REG_PCT', String(d.regPct));
  if (d.stPct)  props.setProperty('CBU_ST_PCT', String(d.stPct));
  if (d.comPct) props.setProperty('CBU_COM_PCT', String(d.comPct));
  return { success: true };
}

// Each loan type keeps its own fully isolated deduction record,
// stored as JSON under a unique ScriptProperty key. No values are
// shared across loan types.

var DEDUCTION_TYPE_KEYS_ = {
  regular:   'regular_loan_deductions',
  shortTerm: 'short_term_loan_deductions',
  commodity: 'commodity_loan_deductions'
};

function _defaultTypeDeductions_(type) {
  if (type === 'regular') return { cbuRate: 2, service: 0, insurancePct: 1.62, notarial: 0, enabled: true };
  if (type === 'shortTerm') return { cbuRate: 1, service: 0, insurancePct: 1.62, enabled: true };
  return { cbuRate: 1, service: 0, enabled: true };
}

function _legacyFlatDeductions_(props, type) {
  if (type === 'regular') {
    if (props.getProperty('DED_REG_ON') === null) return null;
    return {
      cbuRate:   Number(props.getProperty('DED_REG_CBU_RATE'))  || 2,
      service:   Number(props.getProperty('DED_REG_SERVICE'))   || 0,
      insurancePct: 1.62,
      notarial:  Number(props.getProperty('DED_REG_NOTARIAL'))  || 0,
      enabled:   props.getProperty('DED_REG_ON') !== '0'
    };
  }
  if (type === 'shortTerm') {
    if (props.getProperty('DED_STL_ON') === null) return null;
    return {
      cbuRate: Number(props.getProperty('DED_STL_CBU_RATE')) || 1,
      service: Number(props.getProperty('DED_STL_SERVICE'))  || 0,
      insurancePct: 1.62,
      enabled: props.getProperty('DED_STL_ON') !== '0'
    };
  }
  if (type === 'commodity') {
    if (props.getProperty('DED_COM_ON') === null) return null;
    return {
      cbuRate: Number(props.getProperty('DED_COM_CBU_RATE')) || 1,
      service: Number(props.getProperty('DED_COM_SERVICE'))  || 0,
      enabled: props.getProperty('DED_COM_ON') !== '0'
    };
  }
  return null;
}

function _getTypeDeductions_(props, type) {
  var key = DEDUCTION_TYPE_KEYS_[type];
  var raw = props.getProperty(key);
  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      var def = _defaultTypeDeductions_(type);
      var merged = {};
      for (var k in def) merged[k] = parsed[k] === undefined ? def[k] : parsed[k];
      return merged;
    } catch (e) {}
  }
  var legacy = _legacyFlatDeductions_(props, type);
  if (legacy) {
    _setTypeDeductions_(props, type, legacy);
    return legacy;
  }
  return _defaultTypeDeductions_(type);
}

function _setTypeDeductions_(props, type, d) {
  var def = _defaultTypeDeductions_(type);
  var clean = {};
  for (var k in def) clean[k] = d[k] === undefined ? def[k] : d[k];
  props.setProperty(DEDUCTION_TYPE_KEYS_[type], JSON.stringify(clean));
}

function saveDeductionSettings(d) {
  try {
    var props = PropertiesService.getScriptProperties();

    // Regular — saved only into regular_loan_deductions
    var reg = _getTypeDeductions_(props, 'regular');
    if (d.regCbuRate !== undefined)     reg.cbuRate      = Number(d.regCbuRate);
    if (d.regService !== undefined)     reg.service      = Number(d.regService);
    if (d.regInsurance !== undefined && d.regInsurancePct === undefined)
      d.regInsurancePct = d.regInsurance;
    if (d.regInsurancePct !== undefined) reg.insurancePct = Number(d.regInsurancePct);
    if (d.regNotarial !== undefined)    reg.notarial     = Number(d.regNotarial);
    if (d.regOn !== undefined)          reg.enabled      = !!d.regOn;
    _setTypeDeductions_(props, 'regular', reg);

    // Short Term — saved only into short_term_loan_deductions
    var stl = _getTypeDeductions_(props, 'shortTerm');
    if (d.stlCbuRate !== undefined)     stl.cbuRate      = Number(d.stlCbuRate);
    if (d.stlService !== undefined)     stl.service      = Number(d.stlService);
    if (d.stlInsurance !== undefined && d.stlInsurancePct === undefined)
      d.stlInsurancePct = d.stlInsurance;
    if (d.stlInsurancePct !== undefined) stl.insurancePct = Number(d.stlInsurancePct);
    if (d.stlOn !== undefined)          stl.enabled      = !!d.stlOn;
    _setTypeDeductions_(props, 'shortTerm', stl);

    // Commodity — saved only into commodity_loan_deductions
    var com = _getTypeDeductions_(props, 'commodity');
    if (d.comCbuRate !== undefined) com.cbuRate = Number(d.comCbuRate);
    if (d.comService !== undefined) com.service = Number(d.comService);
    if (d.comOn !== undefined)      com.enabled = !!d.comOn;
    _setTypeDeductions_(props, 'commodity', com);

    return { success: true };
  } catch (e) { return { success: false, message: e.message }; }
}

function getDeductionSettings() {
  try {
    var props = PropertiesService.getScriptProperties();
    var reg = _getTypeDeductions_(props, 'regular');
    var stl = _getTypeDeductions_(props, 'shortTerm');
    var com = _getTypeDeductions_(props, 'commodity');
    return {
      success: true,
      regOn:        reg.enabled,
      stlOn:        stl.enabled,
      comOn:        com.enabled,
      regCbuRate:   reg.cbuRate,
      regService:   reg.service,
      regInsurancePct: reg.insurancePct,
      regInsurance: reg.insurancePct,
      regNotarial:  reg.notarial,
      stlCbuRate:   stl.cbuRate,
      stlService:   stl.service,
      stlInsurancePct: stl.insurancePct,
      stlInsurance: stl.insurancePct,
      comCbuRate:   com.cbuRate,
      comService:   com.service,
      regCbuPct:    Number(props.getProperty('CBU_REG_PCT'))        || 300,
      stCbuPct:     Number(props.getProperty('CBU_ST_PCT'))         || 80,
      comCbuPct:    Number(props.getProperty('CBU_COM_PCT'))        || 80
    };
  } catch (e) { return { success: false, message: e.message }; }
}

// ═══════════════════════════════════════════
// Member Phone Lookup Helper
// Used by BACKEND-LOANS.js for SMS notifications
// ═══════════════════════════════════════════

function getMemberPhone_(memberId) {
  try {
    var sheet = getMembersSheet_();
    if (!sheet) return '';
    var data = sheet.getDataRange().getValues();

    // Normalize the input to last 10 digits for comparison
    var inputDigits = String(memberId || '').trim().replace(/\D/g, '');
    if (inputDigits.length > 10) inputDigits = inputDigits.slice(-10);

    for (var i = 1; i < data.length; i++) {
      var colA = String(data[i][0] || '').trim(); // USERNAME (= phone)
      var colJ = String(data[i][9] || '').trim(); // PHONE column

      var digA = colA.replace(/\D/g, '');
      if (digA.length > 10) digA = digA.slice(-10);
      var digJ = colJ.replace(/\D/g, '');
      if (digJ.length > 10) digJ = digJ.slice(-10);

      // Match by exact username or normalized phone digits
      if (colA.toUpperCase() === String(memberId).trim().toUpperCase() ||
          (inputDigits.length > 0 && (digA === inputDigits || digJ === inputDigits))) {
        // Prefer col J (PHONE); fall back to col A (USERNAME which is also phone)
        return colJ || colA;
      }
    }
    return '';
  } catch (e) {
    Logger.log('getMemberPhone_ error: ' + e.message);
    return '';
  }
}

// ═══════════════════════════════════════════
// Coop Stats
// ═══════════════════════════════════════════

function getCoopStats() {
  try {
    var sheet = getMembersSheet_();
    if (!sheet) return { success: false, message: 'Spreadsheet not connected.' };
    var data = sheet.getDataRange().getValues();
    var totalCbu = 0, memberCount = 0;
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      if (String(data[i][10] || '').trim() === 'Pending') continue;
      totalCbu += Number(data[i][7]) || 0;
      memberCount++;
    }
    return { success: true, totalCbu: totalCbu, memberCount: memberCount };
  } catch (e) { return { success: false, message: e.message }; }
}

function testEmailAuth() {
  Logger.log('Auth test started...');
  MailApp.getRemainingDailyQuota();
  Logger.log('Auth test successful!');
}

// ═══════════════════════════════════════════
// Admin: Update a member's profile details
// Fields: firstName, lastName, email, phone,
//         department, memberType, capital,
//         status, password (optional)
// ═══════════════════════════════════════════
function updateMemberByAdmin(memberId, data) {
  try {
    var sheet = getMembersSheet_();
    if (!sheet) return { success: false, message: 'No spreadsheet connected.' };

    var rows = sheet.getDataRange().getValues();
    var targetRow = -1;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim().toUpperCase() === String(memberId).trim().toUpperCase()) {
        targetRow = i + 1; // 1-based sheet row
        break;
      }
    }
    if (targetRow === -1) return { success: false, message: 'Member not found.' };

    // Validate phone format if provided
    if (data.phone) {
      var ph = String(data.phone).trim();
      if (!/^09\d{9}$/.test(ph)) {
        return { success: false, message: 'Invalid phone format. Must be 09XXXXXXXXX (11 digits).' };
      }
    }

    // Validate email uniqueness if changed
    if (data.email) {
      var newEmail = String(data.email).trim().toLowerCase();
      for (var j = 1; j < rows.length; j++) {
        if (j + 1 === targetRow) continue; // skip the member being edited
        if (String(rows[j][2] || '').trim().toLowerCase() === newEmail) {
          return { success: false, message: 'Email is already in use by another member.' };
        }
      }
    }

    // Build range updates (columns B-K = indices 2-11 in 1-based = cols 2,3,4,5,6,7,8,10,11)
    // Sheet columns: A=USERNAME B=PASSWORD C=EMAIL D=MEMBER-TYPE E=FIRST-NAME
    //                F=LAST-NAME G=DEPARTMENT H=CAPITAL I=DATE-JOINED J=PHONE K=STATUS
    var currentRow = rows[targetRow - 1];
    var newPassword  = data.password  ? String(data.password).trim()   : currentRow[1];
    var newEmail2    = data.email     ? String(data.email).trim()       : currentRow[2];
    var newType      = data.memberType? String(data.memberType).trim()  : currentRow[3];
    var newFirst     = data.firstName ? String(data.firstName).trim()   : currentRow[4];
    var newLast      = data.lastName  ? String(data.lastName).trim()    : currentRow[5];
    var newDept      = data.department !== undefined ? String(data.department).trim() : currentRow[6];
    var newCapital   = data.capital   !== undefined ? Number(data.capital)           : currentRow[7];
    var newPhone     = data.phone     ? String(data.phone).trim()       : currentRow[9];
    var newStatus    = data.status    ? String(data.status).trim()      : currentRow[10];

    // Write B,C,D,E,F,G,H (7 cols) = columns 2-8
    sheet.getRange(targetRow, 2, 1, 7).setValues([[
      newPassword, newEmail2, newType, newFirst, newLast, newDept, newCapital
    ]]);
    // Write J (phone) = column 10
    sheet.getRange(targetRow, 10).setValue(newPhone);
    // Write K (status) = column 11
    sheet.getRange(targetRow, 11).setValue(newStatus);

    // Invalidate member caches
    try {
      CacheService.getScriptCache().removeAll(['members_data', 'applications_data']);
    } catch(e2) {}

    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

// ═══════════════════════════════════════════
// Role Management (Member ↔ Officer)
// Promotes a member to Officer or revokes the
// Officer role. Every change is written to the
// "Audit Log" sheet. No passwords are returned.
// ═══════════════════════════════════════════

function getAuditLogSheet_() {
  var ss = openSheet_();
  if (!ss) return null;
  var sheet = findSheetCI_(ss, 'Audit Log');
  if (!sheet) {
    sheet = ss.insertSheet('Audit Log');
    sheet.getRange('A1:E1').setValues([[
      'TIMESTAMP', 'ADMIN', 'MEMBER ID', 'OLD ROLE', 'NEW ROLE'
    ]]);
    sheet.getRange('A1:E1').setFontWeight('bold').setBackground('#F4F2EE');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendAuditLog_(memberId, oldRole, newRole, adminName) {
  try {
    var sheet = getAuditLogSheet_();
    if (!sheet) return;
    var tz = Session.getScriptTimeZone();
    var ts = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([ts, adminName || 'Unknown', memberId, oldRole, newRole]);
  } catch (e) {
    Logger.log('appendAuditLog_ error: ' + e.message);
  }
}

function changeMemberRole(memberId, newRole, adminName) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var sheet = getMembersSheet_();
    if (!sheet) { lock.releaseLock(); return { success: false, message: 'Spreadsheet not connected.' }; }

    var rows = sheet.getDataRange().getValues();
    var targetRow = -1;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim().toUpperCase() === String(memberId).trim().toUpperCase()) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow === -1) { lock.releaseLock(); return { success: false, message: 'Member not found.' }; }

    var oldRole = getMemberRole_(rows[targetRow - 1]);
    var roleToSet = String(newRole || '').trim();
    roleToSet = roleToSet.charAt(0).toUpperCase() + roleToSet.slice(1).toLowerCase();
    if (roleToSet !== 'Member' && roleToSet !== 'Officer') {
      lock.releaseLock();
      return { success: false, message: 'Invalid role. Must be Member or Officer.' };
    }
    if (oldRole === roleToSet) {
      lock.releaseLock();
      return { success: true, message: 'No change — ' + memberId + ' is already ' + roleToSet + '.', role: oldRole };
    }

    sheet.getRange(targetRow, 14).setValue(roleToSet);

    // Clear member caches so table/stat cards refresh
    try {
      CacheService.getScriptCache().removeAll(['members_data', 'applications_data', 'login_members_data']);
    } catch(e2) {}

    // Audit log
    appendAuditLog_(memberId, oldRole, roleToSet, adminName);

    lock.releaseLock();
    return {
      success: true,
      message: memberId + ' is now ' + roleToSet + ' (' + oldRole + ' → ' + roleToSet + ').',
      role: roleToSet
    };
  } catch (e) {
    try { lock.releaseLock(); } catch(e2) {}
    return { success: false, message: e.message };
  }
}

// Admin-triggered password reset: emails a 30-minute
// reset link to the member. Never exposes the password.
function sendMemberPasswordReset(memberId) {
  try {
    var sheet = getMembersSheet_();
    if (!sheet) return { success: false, message: 'Spreadsheet not connected.' };
    var rows = sheet.getDataRange().getValues();
    var member = null;
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim().toUpperCase() === String(memberId).trim().toUpperCase()) {
        member = {
          username: String(rows[i][0] || '').trim(),
          email: String(rows[i][2] || '').trim(),
          firstName: String(rows[i][4] || '').trim()
        };
        break;
      }
    }
    if (!member) return { success: false, message: 'Member not found.' };
    if (!member.email || member.email.indexOf('@') === -1) {
      return { success: false, message: 'This member has no valid email address on file.' };
    }

    var token = Utilities.getUuid().replace(/-/g, '');
    var expiry = new Date().getTime() + (30 * 60 * 1000);
    var props = PropertiesService.getScriptProperties();
    props.setProperty('RESET_TOKEN_' + token, JSON.stringify({
      memberId: member.username,
      email: member.email,
      expiry: expiry
    }));

    var baseUrl = ScriptApp.getService().getUrl();
    var resetLink = baseUrl + '?page=reset-password&token=' + token;

    var subject = '\ud83d\udd11 Password Reset \u2014 CampusCoop';
    var htmlBody = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">'
      + '<div style="background:#1C2B3A;padding:24px 28px;border-radius:10px 10px 0 0;text-align:center;">'
      + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:4px;">Cooperative Loan System \u2014 SKSU</div>'
      + '</div>'
      + '<div style="background:#fff;padding:28px;border-radius:0 0 10px 10px;">'
      + '<p style="font-size:15px;color:#1C2B3A;">Hi <strong>' + member.firstName + '</strong>,</p>'
      + '<p style="font-size:13px;color:#555;line-height:1.7;">An administrator has requested a password reset for your CampusCoop account. Click the button below to set a new password. This link expires in <strong>30 minutes</strong>.</p>'
      + '<div style="text-align:center;margin:24px 0;">'
      + '<a href="' + resetLink + '" style="display:inline-block;background:#1C2B3A;color:#fff;padding:14px 36px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Reset My Password</a>'
      + '</div>'
      + '<p style="font-size:12px;color:#aaa;line-height:1.6;">If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>'
      + '<hr style="border:none;border-top:1px solid #E8EAED;margin:20px 0;">'
      + '<p style="font-size:11px;color:#bbb;text-align:center;">CampusCoop \u00b7 Sultan Kudarat State University</p>'
      + '</div></div>';

    MailApp.sendEmail({
      to: member.email,
      subject: subject,
      htmlBody: htmlBody,
      name: 'CampusCoop \u00b7 SKSU'
    });

    return { success: true, message: 'Password reset link sent to ' + member.email };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
