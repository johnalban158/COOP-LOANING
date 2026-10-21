use crate::models::*;
use crate::database::*;
use chrono::Utc;
use uuid::Uuid;

// ─── Member Login ───────────────────────────────────────────────────────

pub fn login_member_impl(input: LoginInput) -> ApiResponse<LoginResult> {
    // This is async but called from sync context; we use tokio::block_in_place
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(login_member_async(input))
    })
}

async fn login_member_async(input: LoginInput) -> ApiResponse<LoginResult> {
    let members = match query_sql::<Member, _>(
        "SELECT username, password, email, member_type, first_name, last_name, department, capital, date_joined, phone, status, role, must_change_pw FROM members",
        &[],
        |row| {
            Ok(Member {
                username: row.get("username")?,
                password: row.get("password")?,
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
                is_profile_complete: Some(row.get::<_, i32>("must_change_pw")? == 0),
            })
        },
    ).await;

    let members = match members {
        Ok(m) => m,
        Err(e) => return ApiResponse::err(&format!("Database error: {}", e)),
    };

    let input_raw = input.username.trim();
    let pw_trimmed = input.password.trim();

    for m in &members {
        if m.username.to_uppercase() != input_raw.to_uppercase() {
            continue;
        }

        if m.status == "Pending" {
            return ApiResponse::err("Account pending approval.");
        }

        // Password match
        let candidates = vec![
            m.password.as_deref().unwrap_or(""),
            &m.password.as_deref().unwrap_or("").replace(".0+$", ""),
            &m.password.as_deref().unwrap_or("").replace(',', ""),
        ];

        let mut matched = false;
        for cand in &candidates {
            if cand == pw_trimmed {
                matched = true;
                break;
            }
        }

        if matched {
            let is_complete = m.is_profile_complete.unwrap_or(false);
            return ApiResponse::ok(LoginResult {
                success: true,
                member: Some(Member {
                    username: m.username.clone(),
                    password: None,
                    email: m.email.clone(),
                    member_type: m.member_type.clone(),
                    first_name: m.first_name.clone(),
                    last_name: m.last_name.clone(),
                    department: m.department.clone(),
                    capital: m.capital,
                    date_joined: m.date_joined.clone(),
                    phone: m.phone.clone(),
                    status: m.status.clone(),
                    role: m.role.clone(),
                    is_profile_complete: Some(is_complete),
                }),
                message: None,
            });
        }
    }

    ApiResponse::err("Invalid credentials.")
}

pub fn login_officer_impl(input: LoginOfficerInput) -> ApiResponse<LoginResult> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(login_officer_async(input))
    })
}

async fn login_officer_async(input: LoginOfficerInput) -> ApiResponse<LoginResult> {
    // Hardcoded super-admin
    if input.username == "ICMADMIN" && input.password == "ICM12345" {
        return ApiResponse::ok(LoginResult {
            success: true,
            member: Some(Member {
                username: "ICMADMIN".to_string(),
                password: None,
                email: "admin@sksu.edu".to_string(),
                member_type: "admin".to_string(),
                first_name: "Master".to_string(),
                last_name: "Admin".to_string(),
                department: "Administration".to_string(),
                capital: 0.0,
                date_joined: Some(Utc::now().to_rfc3339()),
                phone: "".to_string(),
                status: "Active".to_string(),
                role: Some("admin".to_string()),
                is_profile_complete: Some(true),
            }),
            message: None,
        });
    }

    // Demo bypass: username "1" password "1"
    if input.username.trim() == "1" && input.password.trim() == "1" {
        let role = match input.role.to_lowercase().as_str() {
            "regular" | "shortterm" | "commodity" | "treasurer" | "chairperson" => input.role.to_lowercase(),
            _ => "regular".to_string(),
        };
        return ApiResponse::ok(LoginResult {
            success: true,
            member: Some(Member {
                username: format!("Demo {}", role),
                password: None,
                email: "demo@sksu.edu".to_string(),
                member_type: role.clone(),
                first_name: "Demo".to_string(),
                last_name: role.clone(),
                department: "Demo".to_string(),
                capital: 0.0,
                date_joined: Some(Utc::now().to_rfc3339()),
                phone: "".to_string(),
                status: "Active".to_string(),
                role: Some(role),
                is_profile_complete: Some(true),
            }),
            message: None,
        });
    }

    // Lookup in officers table
    let officers = match query_sql::<Officer, _>(
        "SELECT email, password, role, fullname, mobile, status, created_by, created_at, school_year, last_login FROM officers WHERE LOWER(email) = LOWER(?1) AND status = 'Active'",
        &[&input.username],
        |row| {
            Ok(Officer {
                email: row.get("email")?,
                password: row.get("password")?,
                role: row.get("role")?,
                fullname: row.get("fullname")?,
                mobile: row.get("mobile")?,
                status: row.get("status")?,
                created_by: row.get("created_by")?,
                created_at: row.get("created_at")?,
                school_year: row.get("school_year")?,
                last_login: row.get("last_login")?,
            })
        },
    ).await;

    let officers = match officers {
        Ok(o) => o,
        Err(e) => return ApiResponse::err(&format!("Database error: {}", e)),
    };

    for o in &officers {
        if o.password == input.password {
            let name_parts: Vec<&str> = o.fullname.split(' ').collect();
            let first_name = name_parts.first().unwrap_or(&"").to_string();
            let last_name = name_parts.get(1).unwrap_or(&"").to_string();
            return ApiResponse::ok(LoginResult {
                success: true,
                member: Some(Member {
                    username: o.email.clone(),
                    password: None,
                    email: o.email.clone(),
                    member_type: o.role.clone(),
                    first_name,
                    last_name,
                    department: o.role.clone(),
                    capital: 0.0,
                    date_joined: o.created_at.clone(),
                    phone: o.mobile.clone(),
                    status: o.status.clone(),
                    role: Some(o.role.clone()),
                    is_profile_complete: Some(!o.fullname.is_empty()),
                }),
                message: None,
            });
        }
    }

    ApiResponse::err("Invalid credentials.")
}

pub fn login_admin_impl(username: String, password: String) -> ApiResponse<LoginResult> {
    if username == "ICMADMIN" && password == "ICM12345" {
        return ApiResponse::ok(LoginResult {
            success: true,
            member: Some(Member {
                username: "ICMADMIN".to_string(),
                password: None,
                email: "admin@sksu.edu".to_string(),
                member_type: "masteradmin".to_string(),
                first_name: "Master".to_string(),
                last_name: "Admin".to_string(),
                department: "Administration".to_string(),
                capital: 0.0,
                date_joined: Some(Utc::now().to_rfc3339()),
                phone: "".to_string(),
                status: "Active".to_string(),
                role: Some("masteradmin".to_string()),
                is_profile_complete: Some(true),
            }),
            message: None,
        });
    }
    ApiResponse::err("Invalid admin credentials.")
}

// ─── Profile Setup ─────────────────────────────────────────────────────

pub fn complete_profile_setup_impl(member_id: String, data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(complete_profile_setup_async(member_id, data))
    })
}

async fn complete_profile_setup_async(member_id: String, data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    let phone = data.get("phone").and_then(|v| v.as_str()).unwrap_or("").trim();
    let email = data.get("email").and_then(|v| v.as_str()).unwrap_or("").trim().to_lowercase();
    let new_password = data.get("newPassword").and_then(|v| v.as_str()).unwrap_or("").trim();
    let confirm_password = data.get("confirmPassword").and_then(|v| v.as_str()).unwrap_or("").trim();

    if phone.is_empty() || email.is_empty() || new_password.is_empty() || confirm_password.is_empty() {
        return ApiResponse::err("All fields are required.");
    }

    let phone_digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    if !phone_digits.starts_with("09") || phone_digits.len() != 11 {
        return ApiResponse::err("Phone must be a valid PH mobile number (e.g. 09171234567).");
    }

    if !email.contains('@') || !email.contains('.') {
        return ApiResponse::err("Please enter a valid email address.");
    }

    if new_password.len() < 8 {
        return ApiResponse::err("Password must be at least 8 characters.");
    }

    if new_password != confirm_password {
        return ApiResponse::err("Passwords do not match.");
    }

    // Check email uniqueness
    let existing_email = query_sql::<serde_json::Value, _>(
        "SELECT email FROM members WHERE LOWER(email) = LOWER(?1) AND username != ?2",
        &[&email, &member_id],
        |row| Ok(serde_json::json!({ "email": row.get::<_, String>("email")? })),
    ).await;

    if let Ok(emails) = existing_email {
        if !emails.is_empty() {
            return ApiResponse::err("This email address is already in use by another member.");
        }
    }

    // Update member
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    match execute_sql(
        "UPDATE members SET password = ?1, email = ?2, phone = ?3, must_change_pw = 0, activated_at = ?4 WHERE username = ?5",
        &[&new_password, &email, &phone_digits, &now, &member_id],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Update failed: {}", e)),
    }

    ApiResponse::ok(serde_json::json!({
        "success": true,
        "member": {
            "username": member_id,
            "email": email,
            "phone": phone_digits,
            "is_profile_complete": true
        }
    }))
}

// ─── Password Reset ─────────────────────────────────────────────────────

pub fn request_password_reset_impl(email: String) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(request_password_reset_async(email))
    })
}

async fn request_password_reset_async(email: String) -> ApiResponse<serde_json::Value> {
    let email_input = email.trim().to_lowercase();
    if !email_input.contains('@') {
        return ApiResponse::err("Please enter a valid email address.");
    }

    let member = query_sql::<Member, _>(
        "SELECT username, first_name, email, must_change_pw FROM members WHERE LOWER(email) = LOWER(?1)",
        &[&email_input],
        |row| Ok(Member {
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
            is_profile_complete: Some(row.get::<_, i32>("must_change_pw")? == 0),
        }),
    ).await;

    let members = match member {
        Ok(m) => m,
        Err(e) => return ApiResponse::err(&format!("Database error: {}", e)),
    };

    if members.is_empty() {
        return ApiResponse::err("No account found with that email address.");
    }

    let m = &members[0];
    if !m.is_profile_complete.unwrap_or(false) {
        return ApiResponse::err("Profile setup not completed yet. Please log in with your username and default password first.");
    }

    // Generate token
    let token = Uuid::new_v4().to_string().replace('-', "");
    let expiry = Utc::now().timestamp() + 1800; // 30 minutes

    // Store token (using settings as simple key-value, or we could add a tokens table)
    // For simplicity, we'll store in memory via a tokens table
    match execute_sql(
        "CREATE TABLE IF NOT EXISTS reset_tokens (token TEXT PRIMARY KEY, member_id TEXT, email TEXT, expiry INTEGER)",
        &[],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Token storage error: {}", e)),
    }

    match execute_sql(
        "INSERT OR REPLACE INTO reset_tokens (token, member_id, email, expiry) VALUES (?1, ?2, ?3, ?4)",
        &[&token, &m.username, &email_input, &expiry],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Token insert error: {}", e)),
    }

    // In a real app, send email here. For now, return the token.
    ApiResponse::ok(serde_json::json!({
        "success": true,
        "token": token,
        "resetLink": format!("?page=reset-password&token={}", token),
        "message": "Reset link generated. Check your email."
    }))
}

pub fn reset_password_with_token_impl(token: String, new_password: String) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(reset_password_with_token_async(token, new_password))
    })
}

async fn reset_password_with_token_async(token: String, new_password: String) -> ApiResponse<serde_json::Value> {
    if new_password.len() < 8 {
        return ApiResponse::err("Password must be at least 8 characters.");
    }

    // Verify token
    let token_data = query_sql::<serde_json::Value, _>(
        "SELECT member_id, expiry FROM reset_tokens WHERE token = ?1",
        &[&token],
        |row| Ok(serde_json::json!({
            "member_id": row.get::<_, String>("member_id")?,
            "expiry": row.get::<_, i64>("expiry")?
        })),
    ).await;

    let tokens = match token_data {
        Ok(t) => t,
        Err(_) => return ApiResponse::err("Invalid or expired reset link. Please request a new one."),
    };

    if tokens.is_empty() {
        return ApiResponse::err("Invalid or expired reset link. Please request a new one.");
    }

    let expiry = tokens[0].get("expiry").and_then(|v| v.as_i64()).unwrap_or(0);
    if Utc::now().timestamp() > expiry {
        let _ = execute_sql("DELETE FROM reset_tokens WHERE token = ?1", &[&token]).await;
        return ApiResponse::err("This reset link has expired. Please request a new one.");
    }

    let member_id = tokens[0].get("member_id").and_then(|v| v.as_str()).unwrap_or("").to_string();

    // Update password
    match execute_sql(
        "UPDATE members SET password = ?1 WHERE username = ?2",
        &[&new_password, &member_id],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Password update failed: {}", e)),
    }

    // Delete token
    let _ = execute_sql("DELETE FROM reset_tokens WHERE token = ?1", &[&token]).await;

    ApiResponse::ok(serde_json::json!({ "success": true }))
}

// ─── Create Member ──────────────────────────────────────────────────────

pub fn create_member_impl(input: CreateMemberInput) -> ApiResponse<serde_json::Value> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(create_member_async(input))
    })
}

async fn create_member_async(input: CreateMemberInput) -> ApiResponse<serde_json::Value> {
    let phone = input.phone.trim();
    let phone_digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    let phone_last10: String = if phone_digits.len() > 10 { phone_digits[phone_digits.len()-10..].to_string() } else { phone_digits.clone() };

    // Check duplicate
    let existing = query_sql::<serde_json::Value, _>(
        "SELECT username, phone FROM members WHERE phone = ?1 OR username = ?2",
        &[&phone_last10, &phone],
        |row| Ok(serde_json::json!({ "username": row.get::<_, String>("username")? })),
    ).await;

    if let Ok(existing) = existing {
        if !existing.is_empty() {
            return ApiResponse::err("This mobile number is already registered.");
        }
    }

    let temp_pw = input.password.unwrap_or_else(|| "sksu1234".to_string());
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    match execute_sql(
        "INSERT INTO members (username, password, email, member_type, first_name, last_name, department, capital, date_joined, phone, status, must_change_pw, activated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        &[
            &phone,
            &temp_pw,
            &input.email,
            &input.member_type,
            &input.first_name,
            &input.last_name,
            &input.department.unwrap_or_default(),
            &input.capital.unwrap_or(0.0),
            &today,
            &phone_last10,
            "Active",
            &1i32,
            &now,
        ],
    ).await {
        Ok(_) => {}
        Err(e) => return ApiResponse::err(&format!("Create member failed: {}", e)),
    }

    ApiResponse::ok(serde_json::json!({
        "success": true,
        "username": phone,
        "tempPassword": temp_pw,
        "smsStatus": "Not Sent (configure SMS provider)",
        "emailStatus": "Not Sent (configure email provider)"
    }))
}

// ─── Get Members ────────────────────────────────────────────────────────

pub fn get_members_impl() -> ApiResponse<Vec<Member>> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_members_async())
    })
}

async fn get_members_async() -> ApiResponse<Vec<Member>> {
    let members = query_sql::<Member, _>(
        "SELECT username, password, email, member_type, first_name, last_name, department, capital, date_joined, phone, status, role, must_change_pw FROM members ORDER BY first_name, last_name",
        &[],
        |row| {
            Ok(Member {
                username: row.get("username")?,
                password: row.get("password")?,
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
                is_profile_complete: Some(row.get::<_, i32>("must_change_pw")? == 0),
            })
        },
    ).await;

    match members {
        Ok(m) => ApiResponse::ok(m),
        Err(e) => ApiResponse::err(&format!("Database error: {}", e)),
    }
}

pub fn get_member_profile_impl(member_id: String) -> ApiResponse<Member> {
    tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(get_member_profile_async(member_id))
    })
}

async fn get_member_profile_async(member_id: String) -> ApiResponse<Member> {
    let members = query_sql::<Member, _>(
        "SELECT username, password, email, member_type, first_name, last_name, department, capital, date_joined, phone, status, role, must_change_pw FROM members WHERE username = ?1 LIMIT 1",
        &[&member_id],
        |row| {
            Ok(Member {
                username: row.get("username")?,
                password: row.get("password")?,
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
                is_profile_complete: Some(row.get::<_, i32>("must_change_pw")? == 0),
            })
        },
    ).await;

    match members {
        Ok(m) if !m.is_empty() => ApiResponse::ok(m.into_iter().next().unwrap()),
        _ => ApiResponse::err("Member not found."),
    }
}
