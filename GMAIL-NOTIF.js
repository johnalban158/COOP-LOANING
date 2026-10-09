// ─── GMAIL-NOTIF.js ─────────────────────────────────────────────────────────
// Gmail notification functions for payment events.
// ─────────────────────────────────────────────────────────────────────────────

/* ── Helper: get admin email from script properties or fallback to owner ── */
function getAdminEmail_() {
    var stored = PropertiesService.getScriptProperties()
        .getProperty('ADMIN_EMAIL');
    if (stored && stored.indexOf('@') > -1) return stored;
    return Session.getEffectiveUser().getEmail();
}

/* ── Send payment submission notification to Admin ── */
function sendPaymentNotifToAdmin_(payment) {
    try {
        var adminEmail = getAdminEmail_();
        if (!adminEmail) return;

        var subject = '💳 New Payment Submitted — ' + payment.memberName
            + ' (' + payment.loanType + ')';

        var methodIcon = payment.method === 'Cash' ? '💵'
            : payment.method === 'GCash' ? '📱'
                : payment.method === 'Bank Transfer' ? '🏦'
                    : '📋';

        var body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F2EE;font-family:Montserrat,Arial,sans-serif;">'
            + '<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">'
            + '<div style="background:#1C2B3A;padding:24px 28px;">'
            + '<div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#fff;text-transform:uppercase;">CampusCoop</div>'
            + '<div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px;text-transform:uppercase;letter-spacing:0.05em;">Admin Notification</div>'
            + '</div>'
            + '<div style="padding:28px 28px 8px;">'
            + '<div style="font-size:18px;font-weight:700;color:#1C2B3A;margin-bottom:6px;">💳 New Payment Submitted</div>'
            + '<div style="font-size:13px;color:#888;margin-bottom:24px;">A member has submitted a payment and is awaiting your confirmation.</div>'

            + '<div style="background:#FAFAF8;border:0.5px solid #E0DDD6;border-radius:12px;padding:18px;margin-bottom:20px;">'
            + '<div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Payment Details</div>'
            + '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
            + '<tr><td style="padding:6px 0;color:#888;width:140px;">Member</td><td style="padding:6px 0;font-weight:600;color:#1C2B3A;">' + payment.memberName + ' <span style="color:#888;font-weight:400;">(' + payment.memberId + ')</span></td></tr>'
            + '<tr><td style="padding:6px 0;color:#888;">Loan type</td><td style="padding:6px 0;font-weight:600;">' + payment.loanType + '</td></tr>'
            + '<tr><td style="padding:6px 0;color:#888;">Month #</td><td style="padding:6px 0;font-weight:600;">Month ' + payment.monthNum + '</td></tr>'
            + '<tr><td style="padding:6px 0;color:#888;">Amount paid</td><td style="padding:6px 0;font-weight:700;font-size:16px;color:#1C2B3A;">₱' + Number(payment.amount).toLocaleString() + '</td></tr>'
            + '<tr><td style="padding:6px 0;color:#888;">Method</td><td style="padding:6px 0;">' + methodIcon + ' ' + payment.method + '</td></tr>'
            + (payment.reference ? '<tr><td style="padding:6px 0;color:#888;">Reference</td><td style="padding:6px 0;font-family:monospace;">' + payment.reference + '</td></tr>' : '')
            + '<tr><td style="padding:6px 0;color:#888;">Date paid</td><td style="padding:6px 0;">' + payment.datePaid + '</td></tr>'
            + (payment.notes ? '<tr><td style="padding:6px 0;color:#888;">Notes</td><td style="padding:6px 0;font-style:italic;color:#555;">' + payment.notes + '</td></tr>' : '')
            + '</table>'
            + '</div>'

            + '<div style="background:#FAEEDA;border:0.5px solid #F5C87A;border-radius:10px;padding:14px 18px;margin-bottom:24px;">'
            + '<div style="font-size:12px;color:#854F0B;font-weight:600;">⚠️ Action required</div>'
            + '<div style="font-size:12px;color:#854F0B;margin-top:4px;line-height:1.6;">Please log in to the admin Payments page and either <strong>Confirm</strong> this payment or mark it as <strong>Under Review</strong>. The member will be notified by email once you act.</div>'
            + '</div>'
            + '</div>'

            + '<div style="padding:0 28px 28px;">'
            + '<div style="font-size:11px;color:#bbb;line-height:1.7;">Submitted: ' + payment.timestamp + '</div>'
            + '<div style="font-size:11px;color:#bbb;margin-top:2px;">This is an automated notification from CampusCoop.</div>'
            + '</div>'
            + '</div></body></html>';

        MailApp.sendEmail({
            to: adminEmail,
            subject: subject,
            htmlBody: body
        });
    } catch (e) {
        // Non-fatal: log but don't break payment flow
        Logger.log('sendPaymentNotifToAdmin_ error: ' + e.message);
    }
}

/* ── Send payment status update email to Member ── */
function sendPaymentStatusToMember_(memberEmail, memberName, payment, status) {
    try {
        if (!memberEmail || memberEmail.indexOf('@') === -1) return;

        var isConfirmed = status === 'Confirmed';
        var isRejected = status === 'Rejected';
        var isReview = status === 'Under Review';

        var subject = isConfirmed
            ? '\u2705 Payment Confirmed \u2014 Official Receipt \u2014 CampusCoop'
            : isRejected
                ? '\u274C Payment Rejected \u2014 CampusCoop'
                : '\ud83d\udd04 Payment Under Review \u2014 CampusCoop';

        /* ── Build full OR receipt email for confirmed payments ── */
        if (isConfirmed) {
            var qrData = 'CampusCoop OR: ' + (payment.orNumber || 'N/A')
                + ' | Member: ' + (payment.memberId || '')
                + ' | Amount: P' + (payment.amount || 0)
                + ' | Loan: ' + (payment.loanType || '')
                + ' | Date: ' + (payment.confirmDateTime || payment.datePaid || '');
            var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(qrData);

            var body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F2EE;font-family:Montserrat,Arial,sans-serif;">'
                + '<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">'

                /* ── Header with CAMPUSCOOP branding ── */
                + '<div style="background:linear-gradient(135deg,#0D1B2A 0%,#1C2B3A 40%,#2A4A6B 100%);padding:32px 28px;text-align:center;">'
                + '<div style="font-size:28px;font-weight:700;color:#fff;letter-spacing:0.08em;text-shadow:0 2px 8px rgba(0,0,0,0.25);">CAMPUS<span style="color:#5EB8FF;text-shadow:0 0 20px rgba(94,184,255,0.4),0 2px 8px rgba(0,0,0,0.2);">COOP</span></div>'
                + '<div style="font-size:11px;color:rgba(255,255,255,0.65);text-transform:uppercase;letter-spacing:0.10em;margin-top:5px;font-weight:500;">Cooperative Loan System &middot; Sultan Kudarat State University</div>'
                + '<div style="display:inline-block;background:rgba(94,184,255,0.18);color:#5EB8FF;font-size:10px;font-weight:700;letter-spacing:0.12em;padding:6px 18px;border-radius:20px;margin-top:14px;text-transform:uppercase;border:1px solid rgba(94,184,255,0.25);">ELECTRONIC OFFICIAL RECEIPT</div>'
                + '</div>'

                /* ── Greeting ── */
                + '<div style="padding:24px 28px 0;">'
                + '<div style="display:inline-block;background:#EAF3DE;border:0.5px solid #C0DD97;border-radius:20px;padding:6px 16px;font-size:12px;font-weight:600;color:#3B6D11;margin-bottom:14px;">\u2705 Payment Confirmed</div>'
                + '<div style="font-size:16px;font-weight:700;color:#1C2B3A;margin-bottom:6px;">Hi ' + memberName + ',</div>'
                + '<div style="font-size:13px;color:#555;line-height:1.7;margin-bottom:20px;">Your payment has been <strong>confirmed</strong> by the cooperative admin. Below is your official receipt for your records.</div>'
                + '</div>'

                /* ── OR Reference Number ── */
                + '<div style="background:#F8F9FA;padding:18px;text-align:center;border-top:0.5px solid #E0DDD6;border-bottom:0.5px solid #E0DDD6;">'
                + '<div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Reference Number</div>'
                + '<div style="font-size:20px;font-weight:700;font-family:monospace;color:#000;letter-spacing:0.05em;">' + (payment.orNumber || '\u2014') + '</div>'
                + '</div>'

                /* ── Payment Details Grid ── */
                + '<div style="padding:0 28px;">'
                + '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:20px;">'
                + '<tr><td style="padding:8px 0;color:#888;width:140px;border-bottom:0.5px solid #F0EDE8;">Member Name</td><td style="padding:8px 0;font-weight:600;color:#000;border-bottom:0.5px solid #F0EDE8;">' + memberName + '</td></tr>'
                + '<tr><td style="padding:8px 0;color:#888;border-bottom:0.5px solid #F0EDE8;">Member ID</td><td style="padding:8px 0;font-weight:600;color:#000;border-bottom:0.5px solid #F0EDE8;">' + (payment.memberId || '\u2014') + '</td></tr>'
                + '<tr><td style="padding:8px 0;color:#888;border-bottom:0.5px solid #F0EDE8;">Loan Type</td><td style="padding:8px 0;font-weight:600;color:#000;border-bottom:0.5px solid #F0EDE8;">' + payment.loanType + '</td></tr>'
                + '<tr><td style="padding:8px 0;color:#888;border-bottom:0.5px solid #F0EDE8;">Month</td><td style="padding:8px 0;font-weight:600;color:#000;border-bottom:0.5px solid #F0EDE8;">Month ' + payment.monthNum + '</td></tr>'
                + '<tr><td style="padding:8px 0;color:#888;border-bottom:0.5px solid #F0EDE8;">Amount Paid</td><td style="padding:8px 0;font-weight:700;font-size:16px;color:#000;border-bottom:0.5px solid #F0EDE8;">\u20B1' + Number(payment.amount).toLocaleString() + '</td></tr>'
                + '<tr><td style="padding:8px 0;color:#888;border-bottom:0.5px solid #F0EDE8;">Payment Method</td><td style="padding:8px 0;font-weight:600;color:#000;border-bottom:0.5px solid #F0EDE8;">' + (payment.method || '\u2014') + '</td></tr>'
                + '<tr><td style="padding:8px 0;color:#888;border-bottom:0.5px solid #F0EDE8;">Date Paid</td><td style="padding:8px 0;font-weight:600;color:#000;border-bottom:0.5px solid #F0EDE8;">' + (payment.datePaid || '\u2014') + '</td></tr>'
                + '<tr><td style="padding:8px 0;color:#888;border-bottom:0.5px solid #F0EDE8;">Confirmed On</td><td style="padding:8px 0;font-weight:600;color:#000;border-bottom:0.5px solid #F0EDE8;">' + (payment.confirmDateTime || '\u2014') + '</td></tr>'
                + '<tr><td style="padding:8px 0;color:#888;">Status</td><td style="padding:8px 0;font-weight:700;color:#3B6D11;">CONFIRMED</td></tr>'
                + '</table>'
                + '</div>'

                /* ── QR Code ── */
                + '<div style="padding:24px 28px;text-align:center;border-top:0.5px solid #E0DDD6;margin-top:20px;background:#FDFCFB;">'
                + '<img src="' + qrUrl + '" alt="QR Code" style="width:120px;height:120px;border:4px solid #fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.08);" />'
                + '<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-top:8px;font-weight:500;">Scan to verify this receipt</div>'
                + '</div>'

                /* ── Footer ── */
                + '<div style="padding:16px 28px;font-size:11px;color:#555;text-align:center;background:#FAFAF8;border-top:0.5px solid #E0DDD6;line-height:1.7;">'
                + '<strong>&#128196; This is your official proof of payment.</strong> Please keep this email for your records. You may print it anytime.<br/>'
                + '<span style="color:#bbb;">CampusCoop &middot; Sultan Kudarat State University &middot; AY 2025-2026</span>'
                + '</div>'

                + '</div></body></html>';

            MailApp.sendEmail({
                to: memberEmail,
                subject: subject,
                htmlBody: body
            });
            return;
        }

        /* ── Non-confirmed status emails (rejected / under review) ── */
        var headerBg = isRejected ? '#A32D2D' : '#1565C0';
        var badgeBg = isRejected ? '#FCEBEB' : '#E3F2FD';
        var badgeBdr = isRejected ? '#F7C1C1' : '#90CAF9';
        var badgeClr = isRejected ? '#A32D2D' : '#1565C0';
        var badgeText = isRejected ? '\u274C Payment Rejected' : '\ud83d\udd04 Under Review';

        var msgBody = isRejected
            ? 'We regret to inform you that your payment of <strong>\u20B1' + Number(payment.amount).toLocaleString() + '</strong> for <strong>' + payment.loanType + ' \u2014 Month ' + payment.monthNum + '</strong> has been <strong>rejected</strong>.'
            + (payment.rejectReason ? '<br/><br/><strong>Reason:</strong> ' + payment.rejectReason : '')
            + '<br/><br/>Please contact the cooperative office to resolve this.'
            : 'Your payment of <strong>\u20B1' + Number(payment.amount).toLocaleString() + '</strong> for <strong>' + payment.loanType + ' \u2014 Month ' + payment.monthNum + '</strong> is currently being reviewed. You will be notified once it is confirmed.';

        var body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F2EE;font-family:Montserrat,Arial,sans-serif;">'
            + '<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">'
            + '<div style="background:' + headerBg + ';padding:24px 28px;">'
            + '<div style="font-size:13px;font-weight:700;letter-spacing:0.08em;color:#fff;text-transform:uppercase;">CampusCoop</div>'
            + '<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px;text-transform:uppercase;letter-spacing:0.05em;">Payment Update</div>'
            + '</div>'
            + '<div style="padding:28px;">'
            + '<div style="display:inline-block;background:' + badgeBg + ';border:0.5px solid ' + badgeBdr + ';border-radius:20px;padding:6px 16px;font-size:12px;font-weight:600;color:' + badgeClr + ';margin-bottom:18px;">' + badgeText + '</div>'
            + '<div style="font-size:17px;font-weight:700;color:#1C2B3A;margin-bottom:8px;">Hi ' + memberName + ',</div>'
            + '<div style="font-size:13px;color:#555;line-height:1.7;margin-bottom:24px;">' + msgBody + '</div>'
            + '<div style="background:#FAFAF8;border:0.5px solid #E0DDD6;border-radius:12px;padding:18px;margin-bottom:24px;">'
            + '<div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Payment Summary</div>'
            + '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
            + '<tr><td style="padding:5px 0;color:#888;width:130px;">Loan type</td><td style="padding:5px 0;font-weight:600;">' + payment.loanType + '</td></tr>'
            + '<tr><td style="padding:5px 0;color:#888;">Month</td><td style="padding:5px 0;font-weight:600;">Month ' + payment.monthNum + '</td></tr>'
            + '<tr><td style="padding:5px 0;color:#888;">Amount paid</td><td style="padding:5px 0;font-weight:700;font-size:15px;color:#1C2B3A;">\u20B1' + Number(payment.amount).toLocaleString() + '</td></tr>'
            + '<tr><td style="padding:5px 0;color:#888;">Method</td><td style="padding:5px 0;">' + (payment.method || '\u2014') + '</td></tr>'
            + '<tr><td style="padding:5px 0;color:#888;">Date paid</td><td style="padding:5px 0;">' + (payment.datePaid || '\u2014') + '</td></tr>'
            + '<tr><td style="padding:5px 0;color:#888;">Status</td><td style="padding:5px 0;font-weight:600;color:' + badgeClr + ';">' + badgeText + '</td></tr>'
            + '</table>'
            + '</div>'
            + '<div style="font-size:12px;color:#bbb;line-height:1.7;">This is an automated message from CampusCoop. Please do not reply to this email.</div>'
            + '</div>'
            + '</div></body></html>';

        MailApp.sendEmail({
            to: memberEmail,
            subject: subject,
            htmlBody: body
        });
    } catch (e) {
        Logger.log('sendPaymentStatusToMember_ error: ' + e.message);
    }
}

/* ── Send loan approval deduction summary email to Admin ── */
function sendLoanApprovalDeductionEmailToAdmin_(memberName, memberId, loanType, amount, deductionData) {
  try {
    var adminEmail = getAdminEmail_();
    if (!adminEmail) return;

    var d = deductionData || {};
    var totalB = Number(d.totalB) || 0;
    var totalC = Number(d.totalC) || 0;
    var netProceeds = Number(d.netProceeds) || (amount - totalB - totalC);

    function peso(n) { return '\u20B1' + (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function dedRow(label, val) {
      if (!val || val === 0) return '';
      return '<tr><td style="padding:5px 0;color:#888;font-size:13px;">' + label + '</td>'
        + '<td style="padding:5px 0;font-weight:600;color:#1C2B3A;text-align:right;font-size:13px;">' + peso(val) + '</td></tr>';
    }

    // Past Dues rows
    var pastDuesRows = ''
      + dedRow('Short Term Loan', d.pastSt)
      + dedRow('Regular Loan (existing bal)', d.pastReg)
      + dedRow('Commodity', d.pastCom)
      + dedRow('Canteen Credit', d.pastCanteen)
      + dedRow('Ticket/Load', d.pastTicket)
      + dedRow('Others', d.pastOthers);

    // Deductions rows
    var deductionRows = ''
      + dedRow('Regular Loan (existing bal)', d.dedReg)
      + dedRow('Capital Build-Up', d.dedCbu)
      + dedRow('Service Fee', d.dedService)
      + dedRow('Insurance', d.dedInsurance)
      + dedRow('Notarial Fee', d.dedNotarial);

    var subject = '\u2705 Loan Approved with Deductions \u2014 ' + memberName + ' (' + loanType + ')';

    var body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F2EE;font-family:Montserrat,Arial,sans-serif;">'
      + '<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">'

      // Header
      + '<div style="background:linear-gradient(135deg,#0D1B2A 0%,#1C2B3A 40%,#2A4A6B 100%);padding:28px;">'
      + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.07em;margin-top:3px;">Admin Notification \u00B7 Loan Approved</div>'
      + '</div>'

      // Body
      + '<div style="padding:28px;">'
      + '<div style="display:inline-block;background:#EAF3DE;border:0.5px solid #C0DD97;border-radius:20px;padding:6px 18px;font-size:12px;font-weight:700;color:#3B6D11;margin-bottom:18px;">\u2705 Loan Approved &amp; Released</div>'
      + '<div style="font-size:15px;font-weight:700;color:#1C2B3A;margin-bottom:4px;">' + memberName + '</div>'
      + '<div style="font-size:12px;color:#888;margin-bottom:22px;">Member ID: ' + memberId + ' &nbsp;|&nbsp; Loan Type: ' + loanType + '</div>'

      // Amount Applied
      + '<div style="background:#F8F7F5;border-radius:10px;padding:14px 18px;margin-bottom:16px;border:0.5px solid #E0DDD6;">'
      + '<div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Amount Applied (A)</div>'
      + '<div style="font-size:22px;font-weight:700;color:#1C2B3A;">' + peso(amount) + '</div>'
      + '</div>'

      // Two-col deductions grid
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">'

      // Past Dues (B)
      + '<div style="background:#FFF8EE;border:0.5px solid #F5C87A;border-radius:10px;padding:14px 16px;">'
      + '<div style="font-size:10px;font-weight:700;color:#854F0B;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">Past Dues (B)</div>'
      + '<table style="width:100%;border-collapse:collapse;">'
      + (pastDuesRows || '<tr><td style="padding:4px 0;color:#aaa;font-size:12px;font-style:italic;" colspan="2">None</td></tr>')
      + '</table>'
      + '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #F5C87A;display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:#854F0B;">'
      + '<span>TOTAL (B)</span><span>' + peso(totalB) + '</span>'
      + '</div>'
      + '</div>'

      // Deductions (C)
      + '<div style="background:#F0F4FF;border:0.5px solid #90B8F8;border-radius:10px;padding:14px 16px;">'
      + '<div style="font-size:10px;font-weight:700;color:#1A3A7A;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;">Deductions (C)</div>'
      + '<table style="width:100%;border-collapse:collapse;">'
      + (deductionRows || '<tr><td style="padding:4px 0;color:#aaa;font-size:12px;font-style:italic;" colspan="2">None</td></tr>')
      + '</table>'
      + '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #90B8F8;display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:#1A3A7A;">'
      + '<span>TOTAL (C)</span><span>' + peso(totalC) + '</span>'
      + '</div>'
      + '</div>'
      + '</div>' // end grid

      // Net Proceeds
      + '<div style="background:linear-gradient(135deg,#0D1B2A,#1C2B3A);border-radius:10px;padding:18px 20px;display:flex;justify-content:space-between;align-items:center;">'
      + '<div>'
      + '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Net Proceeds — A \u2212 (B+C)</div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,0.45);">Amount actually released to member</div>'
      + '</div>'
      + '<div style="font-size:26px;font-weight:700;color:#5EB8FF;letter-spacing:-0.01em;">' + peso(netProceeds) + '</div>'
      + '</div>'

      + '<div style="margin-top:20px;font-size:11px;color:#bbb;line-height:1.7;">This is an automated notification from CampusCoop. The member has been notified via SMS and email.</div>'
      + '</div>'

      // Footer
      + '<div style="padding:14px 28px;background:#FAFAF8;border-top:0.5px solid #E0DDD6;font-size:11px;color:#bbb;text-align:center;">'
      + 'CampusCoop &middot; Sultan Kudarat State University &middot; AY 2025-2026'
      + '</div>'
      + '</div></body></html>';

    MailApp.sendEmail({
      to: adminEmail,
      subject: subject,
      htmlBody: body
    });
  } catch (e) {
    Logger.log('sendLoanApprovalDeductionEmailToAdmin_ error: ' + e.message);
  }
}

/* ── Send Account Created email to Member ── */
function sendAccountCreatedEmail(memberPhone, firstName, lastName, password) {
  try {
    var ss = openSheet_();
    if (!ss) return { success: false, message: 'Spreadsheet not connected.' };
    var sheet = findSheetCI_(ss, 'Members');
    if (!sheet) return { success: false, message: 'Members sheet not found.' };

    var data = sheet.getDataRange().getValues();
    var email = '';
    var searchDigits = String(memberPhone).replace(/\D/g, '');
    if (searchDigits.length > 10) searchDigits = searchDigits.slice(-10);

    for (var i = 1; i < data.length; i++) {
      var colA = String(data[i][0] || '').replace(/\D/g, '');
      if (colA.length > 10) colA = colA.slice(-10);
      var colJ = String(data[i][9] || '').replace(/\D/g, '');
      if (colJ.length > 10) colJ = colJ.slice(-10);

      if (colA === searchDigits || colJ === searchDigits) {
        email = data[i][2]; // Col C = EMAIL
        break;
      }
    }

    if (!email || email.indexOf('@') === -1) {
      return { success: false, message: 'No valid email found for this member.' };
    }

    var subject = '🔑 Your CampusCoop Account is Ready — Sultan Kudarat State University';
    var body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F2EE;font-family:Montserrat,Arial,sans-serif;">'
      + '<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">'
      + '<div style="background:#1C2B3A;padding:32px 28px;text-align:center;">'
      + '<div style="font-size:24px;font-weight:700;color:#fff;letter-spacing:0.08em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.1em;margin-top:4px;">Official Member Account</div>'
      + '</div>'
      + '<div style="padding:28px;">'
      + '<div style="font-size:18px;font-weight:700;color:#1C2B3A;margin-bottom:8px;">Welcome, ' + firstName + '!</div>'
      + '<div style="font-size:13px;color:#555;line-height:1.7;margin-bottom:24px;">Your cooperative member account has been successfully created. You can now log in to the dashboard to apply for loans and track your payments.</div>'
      + '<div style="background:#F8F9FA;border:0.5px solid #E0DDD6;border-radius:12px;padding:20px;margin-bottom:24px;">'
      + '<div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;">Login Credentials</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:14px;">'
      + '<tr><td style="padding:6px 0;color:#888;width:120px;">Username</td><td style="padding:6px 0;font-weight:700;color:#1C2B3A;font-family:monospace;">' + memberPhone + '</td></tr>'
      + '<tr><td style="padding:6px 0;color:#888;">Password</td><td style="padding:6px 0;font-weight:700;color:#1C2B3A;font-family:monospace;letter-spacing:1px;">' + password + '</td></tr>'
      + '</table>'
      + '</div>'
      + '<div style="background:#EAF3DE;border-radius:10px;padding:14px 18px;margin-bottom:24px;border:0.5px solid #C0DD97;">'
      + '<div style="font-size:12px;color:#3B6D11;font-weight:600;">✅ Account active</div>'
      + '<div style="font-size:12px;color:#3B6D11;margin-top:4px;line-height:1.6;">Please change your password after your first login for better security.</div>'
      + '</div>'
      + '<div style="text-align:center;">'
      + '<a href="' + ScriptApp.getService().getUrl() + '" style="display:inline-block;background:#1C2B3A;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:700;font-size:14px;">Login to Dashboard</a>'
      + '</div>'
      + '</div>'
      + '<div style="padding:20px 28px 32px;font-size:11px;color:#bbb;text-align:center;">'
      + 'CampusCoop &middot; Sultan Kudarat State University &middot; AY 2025-2026'
      + '</div></div></body></html>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: body
    });
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/* ── Send Loan Released email to Member ── */
function sendReleasedEmail(memberEmail, memberName, memberId, loanType, amount, netProceeds, claimingSchedule) {
  try {
    if (!memberEmail || memberEmail.indexOf('@') === -1) return;

    var claimingDate = claimingSchedule && claimingSchedule.claimingDate ? claimingSchedule.claimingDate : '';
    var claimingTime = claimingSchedule && claimingSchedule.claimingTime ? claimingSchedule.claimingTime : '';
    var claimingLocation = claimingSchedule && claimingSchedule.claimingLocation ? claimingSchedule.claimingLocation : '';

    var subject = '🎉 Your Loan is Ready for Claiming — CampusCoop';
    
    var body = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F4F2EE;font-family:Montserrat,Arial,sans-serif;">'
      + '<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">'
      + '<div style="background:linear-gradient(135deg,#0D1B2A 0%,#1C2B3A 40%,#2A4A6B 100%);padding:28px;">'
      + '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.06em;">CAMPUS<span style="color:#5EB8FF;">COOP</span></div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.07em;margin-top:3px;">Loan Release Notification</div>'
      + '</div>'
      + '<div style="padding:28px;">'
      + '<div style="display:inline-block;background:#EAF3DE;border:0.5px solid #C0DD97;border-radius:20px;padding:6px 18px;font-size:12px;font-weight:700;color:#3B6D11;margin-bottom:18px;">🎉 Loan Released</div>'
      + '<div style="font-size:17px;font-weight:700;color:#1C2B3A;margin-bottom:8px;">Hi ' + memberName + ',</div>'
      + '<div style="font-size:13px;color:#555;line-height:1.7;margin-bottom:24px;">Your loan application has been <strong>approved and released</strong>. You can now claim your loan proceeds at the cooperative office.</div>'
      
      // Loan Details
      + '<div style="background:#F8F7F5;border-radius:10px;padding:14px 18px;margin-bottom:16px;border:0.5px solid #E0DDD6;">'
      + '<div style="font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Loan Details</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
      + '<tr><td style="padding:5px 0;color:#888;width:130px;">Member ID</td><td style="padding:5px 0;font-weight:600;">' + memberId + '</td></tr>'
      + '<tr><td style="padding:5px 0;color:#888;">Loan Type</td><td style="padding:5px 0;font-weight:600;">' + loanType + '</td></tr>'
      + '<tr><td style="padding:5px 0;color:#888;">Loan Amount</td><td style="padding:5px 0;font-weight:700;font-size:15px;color:#1C2B3A;">₱' + Number(amount).toLocaleString() + '</td></tr>'
      + '<tr><td style="padding:5px 0;color:#888;">Net Proceeds</td><td style="padding:5px 0;font-weight:700;font-size:15px;color:#3B6D11;">₱' + Number(netProceeds).toLocaleString() + '</td></tr>'
      + '</table>'
      + '</div>';
    
    // Claiming Schedule
    if (claimingDate) {
      body += '<div style="background:#FFF9E6;border-radius:10px;padding:14px 18px;margin-bottom:16px;border:0.5px solid #F5C842;">'
        + '<div style="font-size:10px;font-weight:700;color:#854F0B;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">📅 Claiming Schedule</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:13px;">'
        + '<tr><td style="padding:5px 0;color:#888;width:130px;">Date</td><td style="padding:5px 0;font-weight:700;color:#854F0B;">' + claimingDate + '</td></tr>';
      if (claimingTime) {
        body += '<tr><td style="padding:5px 0;color:#888;">Time</td><td style="padding:5px 0;font-weight:600;">' + claimingTime + '</td></tr>';
      }
      if (claimingLocation) {
        body += '<tr><td style="padding:5px 0;color:#888;">Location</td><td style="padding:5px 0;font-weight:600;">' + claimingLocation + '</td></tr>';
      }
      body += '</table>'
        + '</div>';
    }
    
    body += '<div style="background:#E3F2FD;border-radius:10px;padding:14px 18px;margin-bottom:24px;border:0.5px solid #90CAF9;">'
      + '<div style="font-size:12px;color:#1565C0;font-weight:600;">📋 Requirements</div>'
      + '<div style="font-size:12px;color:#1565C0;margin-top:4px;line-height:1.6;">Please bring a valid ID and sign the release documents when claiming your loan.</div>'
      + '</div>'
      + '<div style="font-size:12px;color:#bbb;line-height:1.7;">This is an automated message from CampusCoop. Please do not reply to this email.</div>'
      + '</div>'
      + '<div style="padding:14px 28px;background:#FAFAF8;border-top:0.5px solid #E0DDD6;font-size:11px;color:#bbb;text-align:center;">'
      + 'CampusCoop &middot; Sultan Kudarat State University &middot; AY 2025-2026'
      + '</div>'
      + '</div></body></html>';

    MailApp.sendEmail({
      to: memberEmail,
      subject: subject,
      htmlBody: body
    });
  } catch (e) {
    Logger.log('sendReleasedEmail error: ' + e.message);
  }
}
