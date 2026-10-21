use crate::models::*;
use crate::database::*;
use chrono::Utc;

// ─── Member Dashboard Data ─────────────────────────────────────────────

pub fn get_member_dashboard_data_impl(member_id: String) -> ApiResponse<MemberDashboardData> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_member_dashboard_data_async(member_id))
    })
}

async fn get_member_dashboard_data_async(member_id: String) -> ApiResponse<MemberDashboardData> {
    let loans_res = get_member_loans_async(member_id.clone()).await;
    let loans = match &loans_res {
        ApiResponse { success: true, data: Some(d), .. } => d.clone(),
        _ => Vec::new(),
    };

    // Get applications
    let apps = query_sql::<LoanApplication, _>(
        "SELECT id as row, member_id, first_name, last_name, loan_type, amount_requested as amount, term, date_submitted, date_approved, application_status as status, reason_if_declined as reason, total_past_dues, other_deductions, net_proceeds, date_released, released_by, school, purpose FROM loan_applications WHERE member_id = ?1 ORDER BY date_submitted DESC",
        &[&member_id],
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

    let applications = match apps {
        Ok(a) => a,
        Err(_) => Vec::new(),
    };

    // Get payments
    let pay_res = get_member_payments_async(member_id.clone()).await;
    let payments = match &pay_res {
        ApiResponse { success: true, data: Some(d), .. } => d.clone(),
        _ => Vec::new(),
    };

    ApiResponse::ok(MemberDashboardData {
        loans,
        applications,
        payments,
    })
}

// ─── CBU History ────────────────────────────────────────────────────────

pub fn get_cbu_history_impl(member_id: String) -> ApiResponse<CbuHistory> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_cbu_history_async(member_id))
    })
}

async fn get_cbu_history_async(member_id: String) -> ApiResponse<CbuHistory> {
    let members = query_sql::<Member, _>(
        "SELECT capital, date_joined FROM members WHERE username = ?1 OR phone = ?2 LIMIT 1",
        &[&member_id, &member_id],
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

    let member_list = match members {
        Ok(m) => m,
        Err(e) => return ApiResponse::err(&format!("Database error: {}", e)),
    };

    if member_list.is_empty() {
        return ApiResponse::err("Member not found.");
    }

    let m = &member_list[0];
    let current_cbu = m.capital;
    let date_joined = m.date_joined.clone();

    // Get loans as deductions
    let loans_res = get_member_loans_async(member_id.clone()).await;
    let loans = match &loans_res {
        ApiResponse { success: true, data: Some(d), .. } => d.clone(),
        _ => Vec::new(),
    };

    let total_deducted: f64 = loans.iter().map(|l| l.amount).sum();

    ApiResponse::ok(CbuHistory {
        current_cbu,
        date_joined,
        total_deducted,
        deductions: loans,
    })
}

// ─── Member Ledger Data ─────────────────────────────────────────────────

pub fn get_member_ledger_data_impl(member_id: String) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_member_ledger_data_async(member_id))
    })
}

async fn get_member_ledger_data_async(member_id: String) -> ApiResponse<serde_json::Value> {
    if member_id.is_empty() {
        return ApiResponse::err("Member ID required.");
    }

    let loans_res = get_member_loans_async(member_id.clone()).await;
    let loans = match &loans_res {
        ApiResponse { success: true, data: Some(d), .. } => d.clone(),
        _ => Vec::new(),
    };

    let active_loans: Vec<&Loan> = loans.iter().filter(|l| l.status == "Active").collect();

    let pay_res = get_member_payments_async(member_id).await;
    let payments = match &pay_res {
        ApiResponse { success: true, data: Some(d), .. } => d.clone(),
        _ => Vec::new(),
    };

    ApiResponse::ok(serde_json::json!({
        "success": true,
        "loans": active_loans,
        "payments": payments
    }))
}

// ─── Send Member Question ──────────────────────────────────────────────

pub fn send_member_question_impl(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(send_member_question_async(data))
    })
}

async fn send_member_question_async(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    let admin_email = "admin@sksu.edu".to_string(); // Default admin email
    let member_name = data.get("memberName").and_then(|v| v.as_str()).unwrap_or("A member").to_string();
    let member_id = data.get("memberId").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let member_email = data.get("memberEmail").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let subject = data.get("subject").and_then(|v| v.as_str()).unwrap_or("General").to_string();
    let message = data.get("message").and_then(|v| v.as_str()).unwrap_or("(No message)").to_string();

    // In a real app, send email via SMTP. For now, store in a questions table.
    let _ = execute_sql(
        "CREATE TABLE IF NOT EXISTS member_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT, member_name TEXT, member_email TEXT, subject TEXT, message TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
        &[],
    ).await;

    let _ = execute_sql(
        "INSERT INTO member_questions (member_id, member_name, member_email, subject, message) VALUES (?1, ?2, ?3, ?4, ?5)",
        &[&member_id, &member_name, &member_email, &subject, &message],
    ).await;

    ApiResponse::ok(serde_json::json!({ "success": true }))
}

// ─── Treasurer Release Data ─────────────────────────────────────────────

pub fn get_treasurer_release_data_impl() -> ApiResponse<Vec<TreasurerLoan>> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_treasurer_release_data_async())
    })
}

async fn get_treasurer_release_data_async() -> ApiResponse<Vec<TreasurerLoan>> {
    let loans = query_sql::<TreasurerLoan, _>(
        "SELECT id as row, member_id, first_name, last_name, loan_type, amount_requested as amount, term, date_submitted, date_approved, application_status as status, total_past_dues, other_deductions, net_proceeds, date_released, released_by, school, purpose FROM loan_applications WHERE application_status IN ('Approved (In Settlement)', 'Released') ORDER BY date_submitted DESC",
        &[],
        |row| {
            Ok(TreasurerLoan {
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
                total_past_dues: row.get::<_, Option<f64>>("total_past_dues")?.unwrap_or(0.0),
                other_deductions: row.get::<_, Option<f64>>("other_deductions")?.unwrap_or(0.0),
                net_proceeds: row.get::<_, Option<f64>>("net_proceeds")?.unwrap_or(0.0),
                date_released: row.get("date_released")?,
                released_by: row.get("released_by")?,
                school: row.get("school")?,
                purpose: row.get("purpose")?,
            })
        },
    ).await;

    match loans {
        Ok(l) => ApiResponse::ok(l),
        Err(e) => ApiResponse::err(&format!("Database error: {}", e)),
    }
}

// ─── Settings ───────────────────────────────────────────────────────────

pub fn get_settings_impl() -> ApiResponse<Settings> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_settings_async())
    })
}

async fn get_settings_async() -> ApiResponse<Settings> {
    let settings = query_sql::<Settings, _>(
        "SELECT school_year, admin_password FROM settings WHERE id = 1",
        &[],
        |row| {
            Ok(Settings {
                ss_id: String::new(), // Not stored locally, it's a Google Sheets concept
                school_year: row.get("school_year")?,
                admin_password: row.get("admin_password")?,
            })
        },
    ).await;

    match settings {
        Ok(s) if !s.is_empty() => ApiResponse::ok(s.into_iter().next().unwrap()),
        _ => ApiResponse::ok(Settings {
            ss_id: String::new(),
            school_year: "AY 2025-2026".to_string(),
            admin_password: "admin1234".to_string(),
        }),
    }
}

pub fn save_settings_impl(input: SaveSettingsInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(save_settings_async(input))
    })
}

async fn save_settings_async(input: SaveSettingsInput) -> ApiResponse<serde_json::Value> {
    let school_year = input.school_year.unwrap_or_else(|| "AY 2025-2026".to_string());
    let admin_password = input.admin_password.unwrap_or_else(|| "admin1234".to_string());

    match execute_sql(
        "UPDATE settings SET school_year = ?1, admin_password = ?2, updated_at = datetime('now') WHERE id = 1",
        &[&school_year, &admin_password],
    ).await {
        Ok(_) => ApiResponse::ok(serde_json::json!({ "success": true })),
        Err(e) => ApiResponse::err(&format!("Save settings failed: {}", e)),
    }
}

pub fn check_spreadsheet_connected_impl() -> ApiResponse<serde_json::Value> {
    // In the Tauri version, we use SQLite directly, so we're always "connected"
    let db_initialized = crate::database::DB.get().is_some();
    ApiResponse::ok(serde_json::json!({
        "connected": db_initialized,
        "database": "sqlite",
        "message": if db_initialized { "Database connected (SQLite)" } else { "Database not initialized" }
    }))
}
