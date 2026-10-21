use crate::models::*;
use crate::database::*;
use chrono::Utc;

// ─── Record Payment (member side) ───────────────────────────────────────

pub fn record_payment_impl(input: RecordPaymentInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(record_payment_async(input))
    })
}

async fn record_payment_async(input: RecordPaymentInput) -> ApiResponse<serde_json::Value> {
    let timestamp = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let date_paid = input.date.unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    let proof_url = if let Some(b64) = &input.proof_base64 {
        // In a Tauri app, we'd save the file to disk. For now, store a reference.
        Some(format!("local://proofs/{}_{}.png", input.member_id, Utc::now().timestamp()))
    } else {
        None
    };

    // Generate OR number if confirmed immediately (non-salary deduction)
    let or_number = if input.method != "Salary Deduction" {
        let date_str = Utc::now().format("%Y%m%d").to_string();
        Some(format!("OR-{}-{:05}", date_str, fastrand::u32(10000..99999)))
    } else {
        None
    };

    let status = if input.method == "Salary Deduction" { "Pending" } else { "Confirmed" };

    match execute_sql(
        "INSERT INTO payments (timestamp, member_id, member_name, member_email, loan_type, month_num, amount, method, reference, date_paid, notes, status, proof_url, or_number) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        &[
            &timestamp,
            &input.member_id,
            &input.member_name,
            &input.member_email,
            &input.loan_type,
            &input.month_num,
            &input.amount,
            &input.method,
            &input.reference.unwrap_or_default(),
            &date_paid,
            &input.notes.unwrap_or_default(),
            &status,
            &proof_url,
            &or_number,
        ],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Payment record failed: {}", e)),
    }

    ApiResponse::ok(serde_json::json!({
        "success": true,
        "orNumber": or_number,
        "status": status
    }))
}

// ─── Get All Payments ───────────────────────────────────────────────────

pub fn get_payments_impl() -> ApiResponse<Vec<Payment>> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_payments_async())
    })
}

async fn get_payments_async() -> ApiResponse<Vec<Payment>> {
    let payments = query_sql::<Payment, _>(
        "SELECT id as row, timestamp, member_id, member_name, member_email, loan_type, month_num, amount, method, reference, date_paid, notes, status, proof_url, or_number FROM payments ORDER BY timestamp DESC",
        &[],
        |row| {
            Ok(Payment {
                row: row.get("row")?,
                timestamp: row.get("timestamp")?,
                member_id: row.get("member_id")?,
                member_name: row.get("member_name")?,
                member_email: row.get("member_email")?,
                loan_type: row.get("loan_type")?,
                month_num: row.get::<_, Option<i64>>("month_num")?.unwrap_or(1) as i32,
                amount: row.get::<_, Option<f64>>("amount")?.unwrap_or(0.0),
                method: row.get("method")?,
                reference: row.get("reference")?,
                date_paid: row.get("date_paid")?,
                notes: row.get("notes")?,
                status: row.get("status")?,
                proof_url: row.get("proof_url")?,
                or_number: row.get("or_number")?,
            })
        },
    ).await;

    match payments {
        Ok(p) => ApiResponse::ok(p),
        Err(e) => ApiResponse::err(&format!("Database error: {}", e)),
    }
}

// ─── Get Member Payments ────────────────────────────────────────────────

pub fn get_member_payments_impl(member_id: String) -> ApiResponse<Vec<Payment>> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_member_payments_async(member_id))
    })
}

async fn get_member_payments_async(member_id: String) -> ApiResponse<Vec<Payment>> {
    let input_digits: String = member_id.chars().filter(|c| c.is_ascii_digit()).collect();
    let input_last10: String = if input_digits.len() > 10 { input_digits[input_digits.len()-10..].to_string() } else { input_digits.clone() };

    let payments = query_sql::<Payment, _>(
        "SELECT id as row, timestamp, member_id, member_name, member_email, loan_type, month_num, amount, method, reference, date_paid, notes, status, proof_url, or_number FROM payments WHERE member_id = ?1 OR member_id = ?2 ORDER BY timestamp DESC",
        &[&member_id, &input_last10],
        |row| {
            Ok(Payment {
                row: row.get("row")?,
                timestamp: row.get("timestamp")?,
                member_id: row.get("member_id")?,
                member_name: row.get("member_name")?,
                member_email: row.get("member_email")?,
                loan_type: row.get("loan_type")?,
                month_num: row.get::<_, Option<i64>>("month_num")?.unwrap_or(1) as i32,
                amount: row.get::<_, Option<f64>>("amount")?.unwrap_or(0.0),
                method: row.get("method")?,
                reference: row.get("reference")?,
                date_paid: row.get("date_paid")?,
                notes: row.get("notes")?,
                status: row.get("status")?,
                proof_url: row.get("proof_url")?,
                or_number: row.get("or_number")?,
            })
        },
    ).await;

    match payments {
        Ok(p) => ApiResponse::ok(p),
        Err(e) => ApiResponse::err(&format!("Database error: {}", e)),
    }
}

// ─── Confirm Payment ────────────────────────────────────────────────────

pub fn confirm_payment_impl(input: ConfirmPaymentInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(confirm_payment_async(input))
    })
}

async fn confirm_payment_async(input: ConfirmPaymentInput) -> ApiResponse<serde_json::Value> {
    let date_str = Utc::now().format("%Y%m%d").to_string();
    let or_number = format!("OR-{}-{:05}", date_str, fastrand::u32(10000..99999));
    let confirm_datetime = Utc::now().format("%b %d, %Y %I:%M %p").to_string();

    // Mark payment as confirmed
    match execute_sql(
        "UPDATE payments SET status = 'Confirmed', or_number = ?1 WHERE id = ?2",
        &[&or_number, &input.row],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Confirm failed: {}", e)),
    }

    // Deduct from loan balance
    let _ = execute_sql(
        "UPDATE loans SET balance = MAX(0, balance - ?1) WHERE member_id = ?2 AND status != 'Paid' LIMIT 1",
        &[&input.amount, &input.member_id],
    ).await;

    // Update loan status if balance is 0
    let _ = execute_sql(
        "UPDATE loans SET status = 'Paid' WHERE member_id = ?1 AND balance <= 0 AND status != 'Paid'",
        &[&input.member_id],
    ).await;

    ApiResponse::ok(serde_json::json!({
        "success": true,
        "orNumber": or_number,
        "confirmDateTime": confirm_datetime
    }))
}

// ─── Review Payment ─────────────────────────────────────────────────────

pub fn review_payment_impl(input: ReviewRejectPaymentInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(review_payment_async(input))
    })
}

async fn review_payment_async(input: ReviewRejectPaymentInput) -> ApiResponse<serde_json::Value> {
    match execute_sql(
        "UPDATE payments SET status = 'Under Review' WHERE id = ?1",
        &[&input.row],
    ).await {
        Ok(_) => ApiResponse::ok(serde_json::json!({ "success": true })),
        Err(e) => ApiResponse::err(&format!("Review failed: {}", e)),
    }
}

// ─── Reject Payment Record ─────────────────────────────────────────────

pub fn reject_payment_record_impl(input: ReviewRejectPaymentInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(reject_payment_record_async(input))
    })
}

async fn reject_payment_record_async(input: ReviewRejectPaymentInput) -> ApiResponse<serde_json::Value> {
    let notes_update = if let Some(reason) = &input.reject_reason {
        format(" | Rejection reason: {}", reason)
    } else {
        String::new()
    };

    match execute_sql(
        "UPDATE payments SET status = 'Rejected', notes = notes || ?1 WHERE id = ?2",
        &[&notes_update, &input.row],
    ).await {
        Ok(_) => ApiResponse::ok(serde_json::json!({ "success": true })),
        Err(e) => ApiResponse::err(&format!("Reject failed: {}", e)),
    }
}

// ─── Record Payment by Admin ────────────────────────────────────────────

pub fn record_payment_by_admin_impl(input: RecordPaymentByAdminInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(record_payment_by_admin_async(input))
    })
}

async fn record_payment_by_admin_async(input: RecordPaymentByAdminInput) -> ApiResponse<serde_json::Value> {
    let is_salary = input.method == "Salary Deduction";
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let date_paid = input.date_paid.unwrap_or_else(|| now.clone());

    let (or_number, status) = if is_salary {
        (String::new(), "Pending".to_string())
    } else {
        let date_str = Utc::now().format("%Y%m%d").to_string();
        (format!("OR-{}-{:05}", date_str, fastrand::u32(10000..99999)), "Confirmed".to_string())
    };

    match execute_sql(
        "INSERT INTO payments (timestamp, member_id, member_name, member_email, loan_type, month_num, amount, method, reference, date_paid, notes, status, proof_url, or_number) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        &[
            &now,
            &input.member_id,
            &input.member_name,
            &input.member_email.unwrap_or_default(),
            &input.loan_type,
            &input.month_num,
            &input.amount,
            &input.method,
            &input.reference.unwrap_or_default(),
            &date_paid,
            &input.notes.unwrap_or_else(|| if is_salary { "Salary deduction — awaiting approval".to_string() } else { "Recorded by admin".to_string() }),
            &status,
            &"",
            &or_number,
        ],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Admin payment record failed: {}", e)),
    }

    // Update loan balance if not salary deduction
    if !is_salary {
        if let Some(loan_id) = &input.loan_id {
            let _ = execute_sql(
                "UPDATE loans SET balance = MAX(0, balance - ?1) WHERE loan_id = ?2",
                &[&input.amount, loan_id],
            ).await;
            let _ = execute_sql(
                "UPDATE loans SET status = 'Paid' WHERE loan_id = ?1 AND balance <= 0 AND status != 'Paid'",
                &[loan_id],
            ).await;
        }
    }

    ApiResponse::ok(serde_json::json!({
        "success": true,
        "orNumber": if or_number.is_empty() { None } else { Some(or_number) }
    }))
}

// ─── Search Payment by OR ───────────────────────────────────────────────

pub fn search_payment_by_or_impl(ref_num: String) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(search_payment_by_or_async(ref_num))
    })
}

async fn search_payment_by_or_async(ref_num: String) -> ApiResponse<serde_json::Value> {
    let search_upper = ref_num.trim().to_uppercase();
    let payments = query_sql::<Payment, _>(
        "SELECT id as row, timestamp, member_id, member_name, member_email, loan_type, month_num, amount, method, reference, date_paid, notes, status, proof_url, or_number FROM payments WHERE UPPER(or_number) = ?1 LIMIT 1",
        &[&search_upper],
        |row| {
            Ok(Payment {
                row: row.get("row")?,
                timestamp: row.get("timestamp")?,
                member_id: row.get("member_id")?,
                member_name: row.get("member_name")?,
                member_email: row.get("member_email")?,
                loan_type: row.get("loan_type")?,
                month_num: row.get::<_, Option<i64>>("month_num")?.unwrap_or(1) as i32,
                amount: row.get::<_, Option<f64>>("amount")?.unwrap_or(0.0),
                method: row.get("method")?,
                reference: row.get("reference")?,
                date_paid: row.get("date_paid")?,
                notes: row.get("notes")?,
                status: row.get("status")?,
                proof_url: row.get("proof_url")?,
                or_number: row.get("or_number")?,
            })
        },
    ).await;

    match payments {
        Ok(p) if !p.is_empty() => {
            let pay = &p[0];
            ApiResponse::ok(serde_json::json!({
                "success": true,
                "found": true,
                "payment": serde_json::json!({
                    "row": pay.row,
                    "timestamp": pay.timestamp,
                    "memberId": pay.member_id,
                    "memberName": pay.member_name,
                    "memberEmail": pay.member_email,
                    "loanType": pay.loan_type,
                    "monthNum": pay.month_num,
                    "amount": pay.amount,
                    "method": pay.method,
                    "reference": pay.reference,
                    "datePaid": pay.date_paid,
                    "notes": pay.notes,
                    "status": pay.status,
                    "proofUrl": pay.proof_url,
                    "orNumber": pay.or_number
                })
            }))
        }
        Ok(_) => ApiResponse::ok(serde_json::json!({ "success": true, "found": false })),
        Err(e) => ApiResponse::err(&format!("Database error: {}", e)),
    }
}

// ─── Bulk Mark Months Paid ──────────────────────────────────────────────

pub fn bulk_mark_months_paid_impl(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(bulk_mark_months_paid_async(data))
    })
}

async fn bulk_mark_months_paid_async(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    let loan_id = data.get("loanId").and_then(|v| v.as_str()).unwrap_or("");
    let member_id = data.get("memberId").and_then(|v| v.as_str()).unwrap_or("");
    let member_name = data.get("memberName").and_then(|v| v.as_str()).unwrap_or("");
    let member_email = data.get("memberEmail").and_then(|v| v.as_str()).unwrap_or("");
    let loan_type = data.get("loanType").and_then(|v| v.as_str()).unwrap_or("");
    let num_months = data.get("numMonths").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
    let month_start = data.get("monthStart").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
    let monthly_amount = data.get("monthlyAmount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let date_paid = data.get("datePaid").and_then(|v| v.as_str()).unwrap_or(&Utc::now().format("%Y-%m-%d").to_string()).to_string();

    let total_amount = monthly_amount * num_months as f64;
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Get current balance
    let loans = query_sql::<serde_json::Value, _>(
        "SELECT balance FROM loans WHERE loan_id = ?1 LIMIT 1",
        &[&loan_id],
        |row| Ok(serde_json::json!({ "balance": row.get::<_, f64>("balance")? })),
    ).await;

    let current_balance = match &loans {
        Ok(l) if !l.is_empty() => l[0].get("balance").and_then(|v| v.as_f64()).unwrap_or(0.0),
        _ => 0.0,
    };

    let mut payments_created = 0;
    let mut cumulative_amount = 0.0;
    let mut running_balance = current_balance;
    let mut or_numbers: Vec<String> = Vec::new();

    let fixed_principal = if loan_type == "Regular" && num_months > 0 {
        // Get loan amount
        let loan_amt = query_sql::<serde_json::Value, _>(
            "SELECT amount FROM loans WHERE loan_id = ?1 LIMIT 1",
            &[&loan_id],
            |row| Ok(serde_json::json!({ "amount": row.get::<_, f64>("amount")? })),
        ).await;
        let amount = match &loan_amt {
            Ok(l) if !l.is_empty() => l[0].get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0),
            _ => 0.0,
        };
        (amount / num_months as f64).round()
    } else {
        0.0
    };

    for m in 0..num_months {
        let mn = month_start + m;
        let date_str = Utc::now().format("%Y%m%d").to_string();
        let or_number = format!("OR-{}-{:05}", date_str, fastrand::u32(10000..99999));

        let (month_payment, principal_paid) = if loan_type == "Regular" && fixed_principal > 0.0 {
            let interest = (running_balance * 0.01).round();
            let principal_part = fixed_principal.min(running_balance);
            let payment = principal_part + interest;
            (payment, principal_part)
        } else {
            (monthly_amount, monthly_amount)
        };

        match execute_sql(
            "INSERT INTO payments (timestamp, member_id, member_name, member_email, loan_type, month_num, amount, method, reference, date_paid, notes, status, proof_url, or_number) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'Confirmed', ?12, ?13)",
            &[
                &now, &member_id, &member_name, &member_email, &loan_type, &mn,
                &month_payment, "Counter", "", &date_paid,
                &format!("Bulk mark — {} months by admin", num_months), "", &or_number,
            ],
        ).await {
            Ok(_) => {}
            Err(e) => return ApiResponse::err(&format!("Bulk payment insert failed: {}", e)),
        }

        payments_created += 1;
        cumulative_amount += principal_paid;
        running_balance = (running_balance - principal_paid).max(0.0);
        or_numbers.push(or_number);
    }

    // Update loan balance
    let new_balance = (current_balance - cumulative_amount).max(0.0);
    match execute_sql(
        "UPDATE loans SET balance = ?1 WHERE loan_id = ?2",
        &[&new_balance, &loan_id],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Loan balance update failed: {}", e)),
    }

    if new_balance <= 0.0 {
        let _ = execute_sql("UPDATE loans SET status = 'Paid' WHERE loan_id = ?1", &[&loan_id]).await;
    }

    ApiResponse::ok(serde_json::json!({
        "success": true,
        "paymentsCreated": payments_created,
        "totalAmount": cumulative_amount,
        "orNumbers": or_numbers,
        "newBalance": new_balance,
        "message": format!("Marked {} month{} as paid for {}", num_months, if num_months > 1 { "s" } else { "" }, member_name)
    }))
}

// ─── Submit Multi Month Payment ─────────────────────────────────────────

pub fn submit_multi_month_payment_impl(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(submit_multi_month_payment_async(data))
    })
}

async fn submit_multi_month_payment_async(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    let member_id = data.get("memberId").and_then(|v| v.as_str()).unwrap_or("");
    let member_name = data.get("memberName").and_then(|v| v.as_str()).unwrap_or("");
    let member_email = data.get("memberEmail").and_then(|v| v.as_str()).unwrap_or("");
    let loan_type = data.get("loanType").and_then(|v| v.as_str()).unwrap_or("");
    let month_start = data.get("monthStart").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
    let num_months = data.get("numMonths").and_then(|v| v.as_i64()).unwrap_or(1) as i32;
    let monthly_amount = data.get("monthlyAmount").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let total_amount = data.get("totalAmount").and_then(|v| v.as_f64()).unwrap_or(monthly_amount * num_months as f64);
    let method = data.get("method").and_then(|v| v.as_str()).unwrap_or("Cash");
    let reference = data.get("reference").and_then(|v| v.as_str()).unwrap_or("");
    let date = data.get("date").and_then(|v| v.as_str()).unwrap_or("");
    let notes = data.get("notes").and_then(|v| v.as_str()).unwrap_or("");
    let proof_base64 = data.get("proofBase64").and_then(|v| v.as_str()).map(|s| s.to_string());

    let timestamp = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let proof_url = if let Some(b64) = &proof_base64 {
        Some(format!("local://proofs/{}_{}.png", member_id, Utc::now().timestamp()))
    } else {
        None
    };

    let mut notes_base = notes.to_string();
    if notes_base.contains("[Salary Deduction]") {
        notes_base = notes_base.replace(" [Salary Deduction]", "");
    }

    for m in 0..num_months {
        let mn = month_start + m;
        let mut row_notes = notes_base.clone();
        if num_months > 1 {
            row_notes = format!("{} [Month {} of {}]", row_notes, mn, month_start + num_months - 1);
        }
        if method == "Salary Deduction" {
            row_notes = format!("{} [Salary Deduction]", row_notes);
        }

        match execute_sql(
            "INSERT INTO payments (timestamp, member_id, member_name, member_email, loan_type, month_num, amount, method, reference, date_paid, notes, status, proof_url, or_number) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'Pending', ?12, ?13)",
            &[
                &timestamp, &member_id, &member_name, &member_email, &loan_type, &mn,
                &monthly_amount, &method, &reference, &date,
                &row_notes, &proof_url, &"",
            ],
        ).await {
            Ok(_) => {}
            Err(e) => return ApiResponse::err(&format!("Multi-month payment insert failed: {}", e)),
        }
    }

    ApiResponse::ok(serde_json::json!({
        "success": true,
        "numMonths": num_months,
        "monthStart": month_start,
        "monthEnd": month_start + num_months - 1,
        "totalAmount": total_amount
    }))
}

// ─── Get Payments by Loan ID ────────────────────────────────────────────

pub fn get_payments_by_loan_id_impl(loan_id: String) -> ApiResponse<Vec<Payment>> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_payments_by_loan_id_async(loan_id))
    })
}

async fn get_payments_by_loan_id_async(loan_id: String) -> ApiResponse<Vec<Payment>> {
    // Payments don't have loan_id directly, match by member + loan type
    // For now return all payments (frontend can filter)
    let payments = query_sql::<Payment, _>(
        "SELECT id as row, timestamp, member_id, member_name, member_email, loan_type, month_num, amount, method, reference, date_paid, notes, status, proof_url, or_number FROM payments ORDER BY timestamp DESC",
        &[],
        |row| {
            Ok(Payment {
                row: row.get("row")?,
                timestamp: row.get("timestamp")?,
                member_id: row.get("member_id")?,
                member_name: row.get("member_name")?,
                member_email: row.get("member_email")?,
                loan_type: row.get("loan_type")?,
                month_num: row.get::<_, Option<i64>>("month_num")?.unwrap_or(1) as i32,
                amount: row.get::<_, Option<f64>>("amount")?.unwrap_or(0.0),
                method: row.get("method")?,
                reference: row.get("reference")?,
                date_paid: row.get("date_paid")?,
                notes: row.get("notes")?,
                status: row.get("status")?,
                proof_url: row.get("proof_url")?,
                or_number: row.get("or_number")?,
            })
        },
    ).await;

    match payments {
        Ok(p) => ApiResponse::ok(p),
        Err(e) => ApiResponse::err(&format!("Database error: {}", e)),
    }
}


// (removed unused local format helper)
