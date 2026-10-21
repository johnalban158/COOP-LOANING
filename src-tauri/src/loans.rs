use crate::models::*;
use crate::database::*;
use chrono::{NaiveDate, Utc};
use std::collections::HashMap;

// ─── Submit Loan Application ────────────────────────────────────────────

pub fn submit_loan_application_impl(input: SubmitLoanApplicationInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(submit_loan_application_async(input))
    })
}

async fn submit_loan_application_async(input: SubmitLoanApplicationInput) -> ApiResponse<serde_json::Value> {
    // CBU Validation
    if !input.member_id.is_empty() && input.amount > 0.0 {
        let members = query_sql::<Member, _>(
            "SELECT capital, member_type FROM members WHERE username = ?1 OR phone = ?2 LIMIT 1",
            &[&input.member_id, &input.member_id],
            |row| {
                Ok(Member {
                    username: row.get("username")?,
                    password: None,
                    email: row.get("email")?,
                    member_type: row.get("member_type")?,
                    first_name: row.get("first_name")?,
                    last_name: row.get("last_name")?,
                    department: row.get("department")?,
                    capital: row.get::<_, Option<f64>>("capital")?.unwrap_or(0.0),
                    date_joined: row.get("date_joined")?,
                    phone: row.get("phone")?,
                    status: row.get("status")?,
                    role: row.get("role")?,
                    is_profile_complete: None,
                })
            },
        ).await;

        if let Ok(mems) = members {
            if let Some(m) = mems.first() {
                if m.capital > 0.0 {
                    let (reg_pct, st_pct, com_pct) = (300.0, 80.0, 80.0); // defaults from settings
                    let applicable_pct = match input.loan_type.as_str() {
                        "Regular" => reg_pct,
                        "Commodity" => com_pct,
                        _ => {
                            let member_type = m.member_type.to_lowercase();
                            if member_type == "teacher" { reg_pct } else { st_pct }
                        }
                    };
                    let max_loanable = (m.capital * applicable_pct / 100.0).round();
                    if input.amount > max_loanable {
                        return ApiResponse::err(&format!(
                            "Loan amount exceeds your CBU limit. Your Capital (CBU) is ₱{}. Maximum loanable: ₱{} ({}% of CBU).",
                            m.capital.to_locale_string(), max_loanable.to_locale_string(), applicable_pct
                        ));
                    }
                }
            }
        }
    }

    let today = Utc::now().format("%Y-%m-%d").to_string();
    let member_name = format!("{} {}", input.first_name, input.last_name);

    match execute_sql(
        "INSERT INTO loan_applications (member_id, first_name, last_name, loan_type, amount_requested, term, date_submitted, application_status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'Pending')",
        &[
            &input.member_id,
            &input.first_name,
            &input.last_name,
            &input.loan_type,
            &input.amount,
            &input.term,
            &today,
        ],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Application submission failed: {}", e)),
    }

    ApiResponse::ok(serde_json::json!({ "success": true }))
}

// ─── Get Loan Applications ─────────────────────────────────────────────

pub fn get_loan_applications_impl() -> ApiResponse<Vec<LoanApplication>> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_loan_applications_async())
    })
}

async fn get_loan_applications_async() -> ApiResponse<Vec<LoanApplication>> {
    let apps = query_sql::<LoanApplication, _>(
        "SELECT id as row, member_id, first_name, last_name, loan_type, amount_requested as amount, term, date_submitted, date_approved, application_status as status, reason_if_declined as reason, total_past_dues, other_deductions, net_proceeds, date_released, released_by, school, purpose FROM loan_applications ORDER BY date_submitted DESC",
        &[],
        |row| {
            Ok(LoanApplication {
                row: row.get("row")?,
                member_id: row.get("member_id")?,
                first_name: row.get("first_name")?,
                last_name: row.get("last_name")?,
                loan_type: row.get("loan_type")?,
                amount: row.get::<_, Option<f64>>("amount")?.unwrap_or(0.0),
                term: row.get::<_, Option<i64>>("term")?.unwrap_or(0) as i32,
                date_submitted: row.get("date_submitted")?,
                date_approved: row.get("date_approved")?,
                status: row.get("status")?,
                reason: row.get("reason")?,
                total_past_dues: row.get::<_, Option<f64>>("total_past_dues")?.unwrap_or(0.0),
                other_deductions: row.get::<_, Option<f64>>("other_deductions")?.unwrap_or(0.0),
                net_proceeds: row.get::<_, Option<f64>>("net_proceeds")?.unwrap_or(0.0),
                existing_balance: 0.0,
                member_capital: 0.0,
                member_type: "JO".to_string(),
                date_released: row.get("date_released")?,
                released_by: row.get("released_by")?,
                school: row.get("school")?,
                purpose: row.get("purpose")?,
            })
        },
    ).await;

    match apps {
        Ok(a) => ApiResponse::ok(a),
        Err(e) => ApiResponse::err(&format!("Database error: {}", e)),
    }
}

// ─── Approve Application ────────────────────────────────────────────────

pub fn approve_application_impl(sheet_row: i64, deduction_data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(approve_application_async(sheet_row, deduction_data))
    })
}

async fn approve_application_async(sheet_row: i64, deduction_data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    // Check current status
    let apps = query_sql::<LoanApplication, _>(
        "SELECT application_status as status FROM loan_applications WHERE id = ?1",
        &[&sheet_row],
        |row| Ok(LoanApplication {
            row: 0, member_id: String::new(), first_name: String::new(), last_name: String::new(),
            loan_type: String::new(), amount: 0.0, term: 0, date_submitted: None, date_approved: None,
            status: row.get("status")?, reason: None, total_past_dues: 0.0, other_deductions: 0.0,
            net_proceeds: 0.0, existing_balance: 0.0, member_capital: 0.0, member_type: String::new(),
            date_released: None, released_by: None, school: None, purpose: None,
        }),
    ).await;

    let app_list = match apps {
        Ok(a) => a,
        Err(e) => return ApiResponse::err(&format!("Database error: {}", e)),
    };

    if app_list.is_empty() {
        return ApiResponse::err("Application not found.");
    }

    let current_status = &app_list[0].status;
    if current_status == "Approved" {
        return ApiResponse::err("This application has already been approved.");
    }

    let today = Utc::now().format("%Y-%m-%d").to_string();
    let app = &app_list[0];

    // Update application status
    match execute_sql(
        "UPDATE loan_applications SET date_approved = ?1, application_status = 'Approved (In Settlement)', total_past_dues = ?2, other_deductions = ?3, net_proceeds = ?4 WHERE id = ?5",
        &[
            &today,
            &deduction_data.get("totalB").and_then(|v| v.as_f64()).unwrap_or(0.0),
            &deduction_data.get("totalC").and_then(|v| v.as_f64()).unwrap_or(0.0),
            &deduction_data.get("netProceeds").and_then(|v| v.as_f64()).unwrap_or(0.0),
            &sheet_row,
        ],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Update failed: {}", e)),
    }

    // Compute payment
    let (monthly, total_to_pay) = match app.loan_type.as_str() {
        "Regular" => {
            let prin = app.amount / app.term as f64;
            let int1 = app.amount * 0.01;
            ((prin + int1).round(), app.amount)
        }
        "Commodity" => {
            let total = (app.amount * (1.0 + 0.01 * app.term as f64)).round();
            (total / app.term as f64, total)
        }
        _ => {
            let total = (app.amount * 1.06).round();
            (total / app.term as f64, total)
        }
    };

    // Maturity date
    let maturity = chrono::NaiveDate::parse_from_str(&today, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::NaiveDate::from_ymd_opt(2025, 1, 1).unwrap())
        .plus(chrono::Duration::days(30 * app.term as i64));
    let maturity_str = maturity.format("%Y-%m-%d").to_string();

    // School year
    let now = Utc::now();
    let sy = if now.month() >= 6 {
        format!("{}-{}", now.year(), now.year() + 1)
    } else {
        format!("{}-{}", now.year() - 1, now.year())
    };

    // Loan ID
    let prefix = match app.loan_type.as_str() {
        "Regular" => "REG",
        "Commodity" => "COM",
        _ => "STL",
    };

    // Generate next loan ID
    let existing_loans = query_sql::<serde_json::Value, _>(
        "SELECT loan_id FROM loans WHERE loan_id LIKE ?1 ORDER BY loan_id DESC LIMIT 1",
        &[&format!("{}%", prefix)],
        |row| Ok(serde_json::json!({ "loan_id": row.get::<_, String>("loan_id")? })),
    ).await;

    let next_num = match &existing_loans {
        Ok(loans) if !loans.is_empty() => {
            let lid = loans[0].get("loan_id").and_then(|v| v.as_str()).unwrap_or("0");
            let num: i32 = lid.split('-').nth(1).unwrap_or("0").parse().unwrap_or(0);
            num + 1
        }
        _ => 1,
    };
    let loan_id = format!("{}-{:03}", prefix, next_num);

    // Insert into loans table
    let net_proceeds = deduction_data.get("netProceeds").and_then(|v| v.as_f64()).unwrap_or(app.amount);
    let total_b = deduction_data.get("totalB").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let total_c = deduction_data.get("totalC").and_then(|v| v.as_f64()).unwrap_or(0.0);

    match execute_sql(
        "INSERT INTO loans (loan_id, member_id, member_name, amount, monthly_payment, term_months, total_payable, date_released, maturity_date, balance, status, school_year, total_past_dues, other_deductions, net_proceeds) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'Active', ?11, ?12, ?13, ?14)",
        &[
            &loan_id,
            &app.member_id,
            &format!("{}, {}", app.last_name, app.first_name),
            &app.amount,
            &monthly,
            &app.term,
            &total_to_pay,
            &today,
            &maturity_str,
            &total_to_pay,
            &sy,
            &total_b,
            &total_c,
            &net_proceeds,
        ],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Loan creation failed: {}", e)),
    }

    // Also insert into type-specific table
    let type_table = match app.loan_type.as_str() {
        "Regular" => "loans_regular",
        "Commodity" => "loans_commodity",
        _ => "loans_short_term",
    };

    match execute_sql(
        &format!("INSERT INTO {} (loan_id, member_id, member_name, amount, monthly_payment, term_months, total_payable, date_released, maturity_date, balance, status, school_year, total_past_dues, other_deductions, net_proceeds) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'Active', ?11, ?12, ?13, ?14)", type_table),
        &[
            &loan_id,
            &app.member_id,
            &format!("{}, {}", app.last_name, app.first_name),
            &app.amount,
            &monthly,
            &app.term,
            &total_to_pay,
            &today,
            &maturity_str,
            &total_to_pay,
            &sy,
            &total_b,
            &total_c,
            &net_proceeds,
        ],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Type-specific loan creation failed: {}", e)),
    }

    // Deduct from CBU
    match execute_sql(
        "UPDATE members SET capital = MAX(0, capital - ?1) WHERE username = ?2",
        &[&app.amount, &app.member_id],
    ).await {
        Ok(_) => {}
        Err(e) => eprintln!("CBU deduction warning: {}", e),
    }

    ApiResponse::ok(serde_json::json!({ "success": true }))
}

// ─── Reject Application ─────────────────────────────────────────────────

pub fn reject_application_impl(sheet_row: i64, reason: String) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(reject_application_async(sheet_row, reason))
    })
}

async fn reject_application_async(sheet_row: i64, reason: String) -> ApiResponse<serde_json::Value> {
    match execute_sql(
        "UPDATE loan_applications SET application_status = 'Rejected', reason_if_declined = ?1 WHERE id = ?2",
        &[&reason, &sheet_row],
    ).await {
        Ok(_) => ApiResponse::ok(serde_json::json!({ "success": true })),
        Err(e) => ApiResponse::err(&format!("Reject failed: {}", e)),
    }
}

// ─── Final Release ──────────────────────────────────────────────────────

pub fn final_release_loan_impl(sheet_row: i64, deduction_data: serde_json::Value, claiming_schedule: serde_json::Value) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(final_release_loan_async(sheet_row, deduction_data, claiming_schedule))
    })
}

async fn final_release_loan_async(sheet_row: i64, deduction_data: serde_json::Value, claiming_schedule: serde_json::Value) -> ApiResponse<serde_json::Value> {
    let apps = query_sql::<LoanApplication, _>(
        "SELECT application_status as status, member_id, first_name, last_name, loan_type, amount_requested as amount, net_proceeds FROM loan_applications WHERE id = ?1",
        &[&sheet_row],
        |row| {
            Ok(LoanApplication {
                row: row.get("row")?,
                member_id: row.get("member_id")?,
                first_name: row.get("first_name")?,
                last_name: row.get("last_name")?,
                loan_type: row.get("loan_type")?,
                amount: row.get::<_, Option<f64>>("amount")?.unwrap_or(0.0),
                term: row.get::<_, Option<i64>>("term")?.unwrap_or(0) as i32,
                date_submitted: row.get("date_submitted")?,
                date_approved: row.get("date_approved")?,
                status: row.get("status")?,
                reason: row.get("reason")?,
                total_past_dues: row.get::<_, Option<f64>>("total_past_dues")?.unwrap_or(0.0),
                other_deductions: row.get::<_, Option<f64>>("other_deductions")?.unwrap_or(0.0),
                net_proceeds: row.get::<_, Option<f64>>("net_proceeds")?.unwrap_or(0.0),
                existing_balance: 0.0, member_capital: 0.0, member_type: String::new(),
                date_released: row.get("date_released")?,
                released_by: row.get("released_by")?,
                school: row.get("school")?,
                purpose: row.get("purpose")?,
            })
        },
    ).await;

    let app_list = match apps {
        Ok(a) => a,
        Err(e) => return ApiResponse::err(&format!("Database error: {}", e)),
    };

    if app_list.is_empty() {
        return ApiResponse::err("Application not found.");
    }

    let app = &app_list[0];
    if app.status != "Approved (In Settlement)" {
        return ApiResponse::err(&format!("This loan is not in settlement status. Current status: {}", app.status));
    }

    let net_proceeds = deduction_data.get("netProceeds").and_then(|v| v.as_f64()).unwrap_or(app.net_proceeds);
    let total_b = deduction_data.get("totalB").and_then(|v| v.as_f64()).unwrap_or(app.total_past_dues);
    let total_c = deduction_data.get("totalC").and_then(|v| v.as_f64()).unwrap_or(app.other_deductions);

    match execute_sql(
        "UPDATE loan_applications SET application_status = 'Released', total_past_dues = ?1, other_deductions = ?2, net_proceeds = ?3, date_released = datetime('now') WHERE id = ?4",
        &[&total_b, &total_c, &net_proceeds, &sheet_row],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Release failed: {}", e)),
    }

    ApiResponse::ok(serde_json::json!({ "success": true }))
}

// ─── Batch Release ──────────────────────────────────────────────────────

pub fn batch_release_loans_impl(sheet_rows: Vec<i64>) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(batch_release_loans_async(sheet_rows))
    })
}

async fn batch_release_loans_async(sheet_rows: Vec<i64>) -> ApiResponse<serde_json::Value> {
    let mut released_count = 0;
    let mut errors: Vec<String> = Vec::new();

    for row in &sheet_rows {
        match execute_sql(
            "UPDATE loan_applications SET application_status = 'Released', date_released = datetime('now') WHERE id = ?1 AND application_status = 'Approved (In Settlement)'",
            &[row],
        ).await {
            Ok(_) => released_count += 1,
            Err(e) => errors.push(format!("Row {}: {}", row, e)),
        }
    }

    ApiResponse::ok(serde_json::json!({
        "success": true,
        "releasedCount": released_count,
        "errors": errors
    }))
}

// ─── Get Member Loans ───────────────────────────────────────────────────

pub fn get_member_loans_impl(member_id: String) -> ApiResponse<Vec<Loan>> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_member_loans_async(member_id))
    })
}

async fn get_member_loans_async(member_id: String) -> ApiResponse<Vec<Loan>> {
    let input_digits: String = member_id.chars().filter(|c| c.is_ascii_digit()).collect();
    let input_last10: String = if input_digits.len() > 10 { input_digits[input_digits.len()-10..].to_string() } else { input_digits.clone() };

    let loans = query_sql::<Loan, _>(
        "SELECT loan_id, member_id, member_name, amount, monthly_payment as monthly, term_months as term, total_payable, date_released, maturity_date, balance, status, school_year, total_past_dues, other_deductions, net_proceeds FROM loans WHERE member_id = ?1 OR member_id = ?2 ORDER BY date_released DESC",
        &[&member_id, &input_last10],
        |row| {
            Ok(Loan {
                loan_id: row.get("loan_id")?,
                member_id: row.get("member_id")?,
                member_name: row.get("member_name")?,
                amount: row.get::<_, Option<f64>>("amount")?.unwrap_or(0.0),
                monthly: row.get::<_, Option<f64>>("monthly")?.unwrap_or(0.0),
                term: row.get::<_, Option<i64>>("term")?.unwrap_or(0) as i32,
                total_payable: row.get::<_, Option<f64>>("total_payable")?.unwrap_or(0.0),
                date_released: row.get("date_released")?,
                maturity_date: row.get("maturity_date")?,
                balance: row.get::<_, Option<f64>>("balance")?.unwrap_or(0.0),
                status: row.get("status")?,
                school_year: row.get("school_year")?,
                loan_type: row.get("loan_id")?.split('-').next().map(|s| match s {
                    "REG" => "Regular".to_string(),
                    "COM" => "Commodity".to_string(),
                    "STL" => "Short Term".to_string(),
                    _ => "Unknown".to_string()
                }).unwrap_or_else(|| "Unknown".to_string()),
                total_past_dues: row.get::<_, Option<f64>>("total_past_dues")?,
                other_deductions: row.get::<_, Option<f64>>("other_deductions")?,
                net_proceeds: row.get::<_, Option<f64>>("net_proceeds")?,
            })
        },
    ).await;

    match loans {
        Ok(l) => ApiResponse::ok(l),
        Err(e) => ApiResponse::err(&format!("Database error: {}", e)),
    }
}

pub fn get_all_loans_by_member_impl(member_id: String) -> ApiResponse<Vec<Loan>> {
    get_member_loans_impl(member_id)
}

// ─── Get Loan Terms ─────────────────────────────────────────────────────

pub fn get_loan_terms_impl(loan_id: String) -> ApiResponse<Loan> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_loan_terms_async(loan_id))
    })
}

async fn get_loan_terms_async(loan_id: String) -> ApiResponse<Loan> {
    let loans = query_sql::<Loan, _>(
        "SELECT loan_id, member_id, member_name, amount, monthly_payment as monthly, term_months as term, total_payable, date_released, maturity_date, balance, status, school_year, total_past_dues, other_deductions, net_proceeds FROM loans WHERE loan_id = ?1 LIMIT 1",
        &[&loan_id],
        |row| {
            Ok(Loan {
                loan_id: row.get("loan_id")?,
                member_id: row.get("member_id")?,
                member_name: row.get("member_name")?,
                amount: row.get::<_, Option<f64>>("amount")?.unwrap_or(0.0),
                monthly: row.get::<_, Option<f64>>("monthly")?.unwrap_or(0.0),
                term: row.get::<_, Option<i64>>("term")?.unwrap_or(0) as i32,
                total_payable: row.get::<_, Option<f64>>("total_payable")?.unwrap_or(0.0),
                date_released: row.get("date_released")?,
                maturity_date: row.get("maturity_date")?,
                balance: row.get::<_, Option<f64>>("balance")?.unwrap_or(0.0),
                status: row.get("status")?,
                school_year: row.get("school_year")?,
                loan_type: loan_id.split('-').next().map(|s| match s {
                    "REG" => "Regular".to_string(),
                    "COM" => "Commodity".to_string(),
                    "STL" => "Short Term".to_string(),
                    _ => "Unknown".to_string()
                }).unwrap_or_else(|| "Unknown".to_string()),
                total_past_dues: row.get::<_, Option<f64>>("total_past_dues")?,
                other_deductions: row.get::<_, Option<f64>>("other_deductions")?,
                net_proceeds: row.get::<_, Option<f64>>("net_proceeds")?,
            })
        },
    ).await;

    match loans {
        Ok(l) if !l.is_empty() => ApiResponse::ok(l.into_iter().next().unwrap()),
        _ => ApiResponse::err("Loan not found."),
    }
}

// ─── Add Loan Direct ────────────────────────────────────────────────────

pub fn add_loan_direct_impl(input: AddLoanDirectInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(add_loan_direct_async(input))
    })
}

async fn add_loan_direct_async(input: AddLoanDirectInput) -> ApiResponse<serde_json::Value> {
    let prefix = match input.loan_type.as_str() {
        "Regular" => "REG",
        "Commodity" => "COM",
        _ => "STL",
    };
    let type_table = match input.loan_type.as_str() {
        "Regular" => "loans_regular",
        "Commodity" => "loans_commodity",
        _ => "loans_short_term",
    };

    let existing = query_sql::<serde_json::Value, _>(
        "SELECT loan_id FROM loans WHERE loan_id LIKE ?1 ORDER BY loan_id DESC LIMIT 1",
        &[&format!("{}%", prefix)],
        |row| Ok(serde_json::json!({ "loan_id": row.get::<_, String>("loan_id")? })),
    ).await;

    let next_num = match &existing {
        Ok(loans) if !loans.is_empty() => {
            let lid = loans[0].get("loan_id").and_then(|v| v.as_str()).unwrap_or("0");
            let num: i32 = lid.split('-').nth(1).unwrap_or("0").parse().unwrap_or(0);
            num + 1
        }
        _ => 1,
    };
    let loan_id = format!("{}-{:03}", prefix, next_num);

    let term = input.term;
    let amount = input.amount;
    let date_released = input.date_released.unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());

    let maturity = NaiveDate::parse_from_str(&date_released, "%Y-%m-%d")
        .unwrap_or_else(|_| Utc::now().date_naive())
        .plus(chrono::Duration::days(30 * term as i64));
    let maturity_str = maturity.format("%Y-%m-%d").to_string();

    let now = Utc::now();
    let sy = if now.month() >= 6 {
        format!("{}-{}", now.year(), now.year() + 1)
    } else {
        format!("{}-{}", now.year() - 1, now.year())
    };

    let monthly = input.monthly.unwrap_or_else(|| {
        match input.loan_type.as_str() {
            "Regular" => {
                let prin = amount / term as f64;
                let int1 = amount * 0.01;
                (prin + int1).round()
            }
            "Commodity" => {
                let total = (amount * (1.0 + 0.01 * term as f64)).round();
                total / term as f64
            }
            _ => {
                let total = (amount * 1.06).round();
                total / term as f64
            }
        }
    });

    let total_to_pay = input.total_to_pay.unwrap_or(monthly * term as f64);
    let balance = input.balance.unwrap_or(total_to_pay);
    let past_dues = input.past_dues.unwrap_or(0.0);
    let deductions = input.deductions.unwrap_or(0.0);
    let net_proceeds = input.net_proceeds.unwrap_or(amount - past_dues - deductions);
    let status = input.status.unwrap_or_else(|| if balance <= 0.0 { "Paid".to_string() } else { "Active".to_string() });
    let school_year = input.school_year.unwrap_or(sy);

    let row_data = (
        &loan_id, &input.member_id, &input.member_name, &amount, &monthly, &term,
        &total_to_pay, &date_released, &maturity_str, &balance, &status, &school_year,
        &past_dues, &deductions, &net_proceeds
    );

    match execute_sql(
        "INSERT INTO loans (loan_id, member_id, member_name, amount, monthly_payment, term_months, total_payable, date_released, maturity_date, balance, status, school_year, total_past_dues, other_deductions, net_proceeds) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        &[&row_data.0, &row_data.1, &row_data.2, &row_data.3, &row_data.4, &row_data.5, &row_data.6, &row_data.7, &row_data.8, &row_data.9, &row_data.10, &row_data.11, &row_data.12, &row_data.13, &row_data.14],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Loan insert failed: {}", e)),
    }

    match execute_sql(
        &format!("INSERT INTO {} (loan_id, member_id, member_name, amount, monthly_payment, term_months, total_payable, date_released, maturity_date, balance, status, school_year, total_past_dues, other_deductions, net_proceeds) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)", type_table),
        &[&row_data.0, &row_data.1, &row_data.2, &row_data.3, &row_data.4, &row_data.5, &row_data.6, &row_data.7, &row_data.8, &row_data.9, &row_data.10, &row_data.11, &row_data.12, &row_data.13, &row_data.14],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Type-specific loan insert failed: {}", e)),
    }

    ApiResponse::ok(serde_json::json!({ "success": true, "loanId": loan_id }))
}

// ─── Add Migration Loan ─────────────────────────────────────────────────

pub fn add_migration_loan_impl(input: AddMigrationLoanInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(add_migration_loan_async(input))
    })
}

async fn add_migration_loan_async(input: AddMigrationLoanInput) -> ApiResponse<serde_json::Value> {
    let prefix = match input.loan_type.as_str() {
        "Regular" => "REG",
        "Commodity" => "COM",
        _ => "STL",
    };
    let type_table = match input.loan_type.as_str() {
        "Regular" => "loans_regular",
        "Commodity" => "loans_commodity",
        _ => "loans_short_term",
    };

    let amount = input.amount;
    let term = input.term;
    let months_paid = input.months_paid.unwrap_or(0);

    let (monthly, total_to_pay) = match input.loan_type.as_str() {
        "Regular" => {
            let prin = amount / term as f64;
            let int1 = amount * 0.01;
            ((prin + int1).round(), amount)
        }
        "Commodity" => {
            let total = (amount * (1.0 + 0.01 * term as f64)).round();
            (total / term as f64, total)
        }
        _ => {
            let total = (amount * 1.06).round();
            (total / term as f64, total)
        }
    };

    let amount_paid = monthly * months_paid as f64;
    let balance = (total_to_pay - amount_paid).max(0.0);
    let status = input.status.unwrap_or_else(|| if balance <= 0.0 { "Paid".to_string() } else { "Active".to_string() });

    let date_released = input.date_released.unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string());
    let maturity = NaiveDate::parse_from_str(&date_released, "%Y-%m-%d")
        .unwrap_or_else(|_| Utc::now().date_naive())
        .plus(chrono::Duration::days(30 * term as i64));
    let maturity_str = maturity.format("%Y-%m-%d").to_string();

    let now = Utc::now();
    let sy = if now.month() >= 6 {
        format!("{}-{}", now.year(), now.year() + 1)
    } else {
        format!("{}-{}", now.year() - 1, now.year())
    };

    let existing = query_sql::<serde_json::Value, _>(
        "SELECT loan_id FROM loans WHERE loan_id LIKE ?1 ORDER BY loan_id DESC LIMIT 1",
        &[&format!("{}%", prefix)],
        |row| Ok(serde_json::json!({ "loan_id": row.get::<_, String>("loan_id")? })),
    ).await;

    let next_num = match &existing {
        Ok(loans) if !loans.is_empty() => {
            let lid = loans[0].get("loan_id").and_then(|v| v.as_str()).unwrap_or("0");
            let num: i32 = lid.split('-').nth(1).unwrap_or("0").parse().unwrap_or(0);
            num + 1
        }
        _ => 1,
    };
    let loan_id = format!("{}-{:03}", prefix, next_num);

    let row_data = (
        &loan_id, &input.member_id, &input.member_name, &amount, &monthly, &term,
        &total_to_pay, &date_released, &maturity_str, &balance, &status, &sy,
        &0.0, &0.0, &amount
    );

    match execute_sql(
        "INSERT INTO loans (loan_id, member_id, member_name, amount, monthly_payment, term_months, total_payable, date_released, maturity_date, balance, status, school_year, total_past_dues, other_deductions, net_proceeds) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        &[&row_data.0, &row_data.1, &row_data.2, &row_data.3, &row_data.4, &row_data.5, &row_data.6, &row_data.7, &row_data.8, &row_data.9, &row_data.10, &row_data.11, &row_data.12, &row_data.13, &row_data.14],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Migration loan insert failed: {}", e)),
    }

    match execute_sql(
        &format!("INSERT INTO {} (loan_id, member_id, member_name, amount, monthly_payment, term_months, total_payable, date_released, maturity_date, balance, status, school_year, total_past_dues, other_deductions, net_proceeds) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)", type_table),
        &[&row_data.0, &row_data.1, &row_data.2, &row_data.3, &row_data.4, &row_data.5, &row_data.6, &row_data.7, &row_data.8, &row_data.9, &row_data.10, &row_data.11, &row_data.12, &row_data.13, &row_data.14],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Type-specific migration loan insert failed: {}", e)),
    }

    ApiResponse::ok(serde_json::json!({ "success": true, "loanId": loan_id }))
}

// ─── Get Officer Borrower Data ──────────────────────────────────────────

pub fn get_officer_borrower_data_impl() -> ApiResponse<Vec<BorrowerData>> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_officer_borrower_data_async())
    })
}

async fn get_officer_borrower_data_async() -> ApiResponse<Vec<BorrowerData>> {
    let loans = query_sql::<Loan, _>(
        "SELECT loan_id, member_id, member_name, amount, monthly_payment as monthly, term_months as term, total_payable, date_released, maturity_date, balance, status, school_year FROM loans ORDER BY date_released DESC",
        &[],
        |row| {
            Ok(Loan {
                loan_id: row.get("loan_id")?,
                member_id: row.get("member_id")?,
                member_name: row.get("member_name")?,
                amount: row.get::<_, Option<f64>>("amount")?.unwrap_or(0.0),
                monthly: row.get::<_, Option<f64>>("monthly")?.unwrap_or(0.0),
                term: row.get::<_, Option<i64>>("term")?.unwrap_or(0) as i32,
                total_payable: row.get::<_, Option<f64>>("total_payable")?.unwrap_or(0.0),
                date_released: row.get("date_released")?,
                maturity_date: row.get("maturity_date")?,
                balance: row.get::<_, Option<f64>>("balance")?.unwrap_or(0.0),
                status: row.get("status")?,
                school_year: row.get("school_year")?,
                loan_type: row.get("loan_id")?.split('-').next().map(|s| match s {
                    "REG" => "Regular".to_string(),
                    "COM" => "Commodity".to_string(),
                    "STL" => "Short Term".to_string(),
                    _ => "Unknown".to_string()
                }).unwrap_or_else(|| "Unknown".to_string()),
                total_past_dues: None,
                other_deductions: None,
                net_proceeds: None,
            })
        },
    ).await;

    let loan_list = match loans {
        Ok(l) => l,
        Err(e) => return ApiResponse::err(&format!("Database error: {}", e)),
    };

    let mut borrowers: Vec<BorrowerData> = Vec::new();
    for l in &loan_list {
        let name_parts: Vec<&str> = l.member_name.split(", ").collect();
        let last_name = name_parts.first().cloned().unwrap_or(&l.member_name).to_string();
        let first_name = name_parts.get(1).cloned().unwrap_or("").to_string();

        // Get total paid from payments
        let payments = query_sql::<serde_json::Value, _>(
            "SELECT amount FROM payments WHERE member_id = ?1 AND status = 'Confirmed'",
            &[&l.member_id],
            |row| Ok(serde_json::json!({ "amount": row.get::<_, f64>("amount")? })),
        ).await;

        let pay_list = payments.unwrap_or_default();
        let total_paid: f64 = pay_list.iter().filter_map(|p| p.get("amount").and_then(|v| v.as_f64())).sum();

        borrowers.push(BorrowerData {
            loan_id: l.loan_id.clone(),
            member_id: l.member_id.clone(),
            first_name,
            last_name,
            school: l.school_year.clone().unwrap_or_default(),
            principal: l.amount,
            paid: total_paid,
            balance: l.balance,
            status: l.status.clone(),
            date_released: l.date_released.clone(),
            maturity_date: l.maturity_date.clone(),
            payments: pay_list,
            remarks: String::new(),
            total_deductions: 0.0,
        });
    }

    ApiResponse::ok(borrowers)
}

// ─── Deduction Settings ─────────────────────────────────────────────────

pub fn get_deduction_settings_impl() -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_deduction_settings_async())
    })
}

async fn get_deduction_settings_async() -> ApiResponse<serde_json::Value> {
    let settings = query_sql::<serde_json::Value, _>(
        "SELECT cbu_reg_pct, cbu_st_pct, cbu_com_pct FROM settings WHERE id = 1",
        &[],
        |row| Ok(serde_json::json!({
            "CBU_REG_PCT": row.get::<_, Option<f64>>("cbu_reg_pct")?.unwrap_or(300.0),
            "CBU_ST_PCT": row.get::<_, Option<f64>>("cbu_st_pct")?.unwrap_or(80.0),
            "CBU_COM_PCT": row.get::<_, Option<f64>>("cbu_com_pct")?.unwrap_or(80.0),
        })),
    ).await;

    match settings {
        Ok(s) if !s.is_empty() => ApiResponse::ok(s.into_iter().next().unwrap()),
        _ => ApiResponse::ok(serde_json::json!({
            "CBU_REG_PCT": 300.0,
            "CBU_ST_PCT": 80.0,
            "CBU_COM_PCT": 80.0,
        })),
    }
}

pub fn save_deduction_settings_impl(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(save_deduction_settings_async(data))
    })
}

async fn save_deduction_settings_async(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    let reg_pct = data.get("CBU_REG_PCT").and_then(|v| v.as_f64()).unwrap_or(300.0);
    let st_pct = data.get("CBU_ST_PCT").and_then(|v| v.as_f64()).unwrap_or(80.0);
    let com_pct = data.get("CBU_COM_PCT").and_then(|v| v.as_f64()).unwrap_or(80.0);

    match execute_sql(
        "UPDATE settings SET cbu_reg_pct = ?1, cbu_st_pct = ?2, cbu_com_pct = ?3, updated_at = datetime('now') WHERE id = 1",
        &[&reg_pct, &st_pct, &com_pct],
    ).await {
        Ok(_) => ApiResponse::ok(serde_json::json!({ "success": true })),
        Err(e) => ApiResponse::err(&format!("Save settings failed: {}", e)),
    }
}

trait ToLocaleString {
    fn to_locale_string(&self) -> String;
}

impl ToLocaleString for f64 {
    fn to_locale_string(&self) -> String {
        format!("{:.2}", self)
    }
}
