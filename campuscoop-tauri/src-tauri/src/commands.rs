use crate::models::*;
use crate::database::*;
use crate::auth::*;
use crate::loans::*;
use crate::payments::*;
use crate::members::*;
use crate::officers::*;
use crate::nemotron::*;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

// ─── Health ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn health_check() -> ApiResponse<HealthResponse> {
    let db_initialized = DB.get().is_some();
    ApiResponse::ok(HealthResponse {
        status: "ok".to_string(),
        version: "1.0.0".to_string(),
        database: if db_initialized { "sqlite" } else { "not_initialized" }.to_string(),
        timestamp: Utc::now().timestamp(),
    })
}

// ─── Auth Commands ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn login_member(input: LoginInput) -> ApiResponse<LoginResult> {
    login_member_impl(input)
}

#[tauri::command]
pub async fn login_officer(input: LoginOfficerInput) -> ApiResponse<LoginResult> {
    login_officer_impl(input)
}

#[tauri::command]
pub async fn login_admin(username: String, password: String) -> ApiResponse<LoginResult> {
    login_admin_impl(username, password)
}

#[tauri::command]
pub async fn complete_profile_setup(member_id: String, data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    complete_profile_setup_impl(member_id, data)
}

#[tauri::command]
pub async fn request_password_reset(email: String) -> ApiResponse<serde_json::Value> {
    request_password_reset_impl(email)
}

#[tauri::command]
pub async fn reset_password_with_token(token: String, new_password: String) -> ApiResponse<serde_json::Value> {
    reset_password_with_token_impl(token, new_password)
}

#[tauri::command]
pub async fn create_member(input: CreateMemberInput) -> ApiResponse<serde_json::Value> {
    create_member_impl(input)
}

#[tauri::command]
pub async fn get_members() -> ApiResponse<Vec<Member>> {
    get_members_impl()
}

#[tauri::command]
pub async fn get_member_profile(member_id: String) -> ApiResponse<Member> {
    get_member_profile_impl(member_id)
}

// ─── Officer Commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn create_officer_account(input: CreateOfficerInput) -> ApiResponse<Officer> {
    create_officer_account_impl(input)
}

#[tauri::command]
pub async fn get_officer_accounts() -> ApiResponse<Vec<Officer>> {
    get_officer_accounts_impl()
}

#[tauri::command]
pub async fn update_officer_account(email: String, data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    update_officer_account_impl(email, data)
}

#[tauri::command]
pub async fn deactivate_officer_account(email: String) -> ApiResponse<serde_json::Value> {
    deactivate_officer_account_impl(email)
}

#[tauri::command]
pub async fn change_officer_credentials(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    change_officer_credentials_impl(data)
}

// ─── Loan Commands ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn submit_loan_application(input: SubmitLoanApplicationInput) -> ApiResponse<serde_json::Value> {
    submit_loan_application_impl(input)
}

#[tauri::command]
pub async fn get_loan_applications() -> ApiResponse<Vec<LoanApplication>> {
    get_loan_applications_impl()
}

#[tauri::command]
pub async fn approve_application(sheet_row: i64, deduction_data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    approve_application_impl(sheet_row, deduction_data)
}

#[tauri::command]
pub async fn reject_application(sheet_row: i64, reason: String) -> ApiResponse<serde_json::Value> {
    reject_application_impl(sheet_row, reason)
}

#[tauri::command]
pub async fn final_release_loan(sheet_row: i64, deduction_data: serde_json::Value, claiming_schedule: serde_json::Value) -> ApiResponse<serde_json::Value> {
    final_release_loan_impl(sheet_row, deduction_data, claiming_schedule)
}

#[tauri::command]
pub async fn batch_release_loans(sheet_rows: Vec<i64>) -> ApiResponse<serde_json::Value> {
    batch_release_loans_impl(sheet_rows)
}

#[tauri::command]
pub async fn get_member_loans(member_id: String) -> ApiResponse<Vec<Loan>> {
    get_member_loans_impl(member_id)
}

#[tauri::command]
pub async fn get_all_loans_by_member(member_id: String) -> ApiResponse<Vec<Loan>> {
    get_all_loans_by_member_impl(member_id)
}

#[tauri::command]
pub async fn get_loan_terms(loan_id: String) -> ApiResponse<Loan> {
    get_loan_terms_impl(loan_id)
}

#[tauri::command]
pub async fn add_loan_direct(input: AddLoanDirectInput) -> ApiResponse<serde_json::Value> {
    add_loan_direct_impl(input)
}

#[tauri::command]
pub async fn add_migration_loan(input: AddMigrationLoanInput) -> ApiResponse<serde_json::Value> {
    add_migration_loan_impl(input)
}

#[tauri::command]
pub async fn get_officer_borrower_data() -> ApiResponse<Vec<BorrowerData>> {
    get_officer_borrower_data_impl()
}

// ─── Deduction Commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn get_deductions_for_member(member_id: String) -> ApiResponse<Vec<Deduction>> {
    get_deductions_for_member_impl(member_id)
}

#[tauri::command]
pub async fn add_deduction(input: AddDeductionInput) -> ApiResponse<serde_json::Value> {
    add_deduction_impl(input)
}

#[tauri::command]
pub async fn remove_deduction(row: i64) -> ApiResponse<serde_json::Value> {
    remove_deduction_impl(row)
}

#[tauri::command]
pub async fn save_borrower_remarks(member_id: String, remarks: String) -> ApiResponse<serde_json::Value> {
    save_borrower_remarks_impl(member_id, remarks)
}

// ─── Payment Commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn record_payment(input: RecordPaymentInput) -> ApiResponse<serde_json::Value> {
    record_payment_impl(input)
}

#[tauri::command]
pub async fn get_payments() -> ApiResponse<Vec<Payment>> {
    get_payments_impl()
}

#[tauri::command]
pub async fn get_member_payments(member_id: String) -> ApiResponse<Vec<Payment>> {
    get_member_payments_impl(member_id)
}

#[tauri::command]
pub async fn confirm_payment(input: ConfirmPaymentInput) -> ApiResponse<serde_json::Value> {
    confirm_payment_impl(input)
}

#[tauri::command]
pub async fn review_payment(input: ReviewRejectPaymentInput) -> ApiResponse<serde_json::Value> {
    review_payment_impl(input)
}

#[tauri::command]
pub async fn reject_payment_record(input: ReviewRejectPaymentInput) -> ApiResponse<serde_json::Value> {
    reject_payment_record_impl(input)
}

#[tauri::command]
pub async fn record_payment_by_admin(input: RecordPaymentByAdminInput) -> ApiResponse<serde_json::Value> {
    record_payment_by_admin_impl(input)
}

#[tauri::command]
pub async fn search_payment_by_or(ref_num: String) -> ApiResponse<serde_json::Value> {
    search_payment_by_or_impl(ref_num)
}

#[tauri::command]
pub async fn bulk_mark_months_paid(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    bulk_mark_months_paid_impl(data)
}

#[tauri::command]
pub async fn submit_multi_month_payment(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    submit_multi_month_payment_impl(data)
}

#[tauri::command]
pub async fn get_payments_by_loan_id(loan_id: String) -> ApiResponse<Vec<Payment>> {
    get_payments_by_loan_id_impl(loan_id)
}

// ─── Member Dashboard ───────────────────────────────────────────────────

#[tauri::command]
pub async fn get_member_dashboard_data(member_id: String) -> ApiResponse<MemberDashboardData> {
    get_member_dashboard_data_impl(member_id)
}

#[tauri::command]
pub async fn get_cbu_history(member_id: String) -> ApiResponse<CbuHistory> {
    get_cbu_history_impl(member_id)
}

#[tauri::command]
pub async fn get_member_ledger_data(member_id: String) -> ApiResponse<serde_json::Value> {
    get_member_ledger_data_impl(member_id)
}

#[tauri::command]
pub async fn send_member_question(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    send_member_question_impl(data)
}

// ─── Treasurer ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_treasurer_release_data() -> ApiResponse<Vec<TreasurerLoan>> {
    get_treasurer_release_data_impl()
}

// ─── Settings ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_settings() -> ApiResponse<Settings> {
    get_settings_impl()
}

#[tauri::command]
pub async fn save_settings(input: SaveSettingsInput) -> ApiResponse<serde_json::Value> {
    save_settings_impl(input)
}

#[tauri::command]
pub async fn check_spreadsheet_connected() -> ApiResponse<serde_json::Value> {
    check_spreadsheet_connected_impl()
}

// ─── Deduction Settings ─────────────────────────────────────────────────

#[tauri::command]
pub async fn get_deduction_settings() -> ApiResponse<serde_json::Value> {
    get_deduction_settings_impl()
}

#[tauri::command]
pub async fn save_deduction_settings(data: serde_json::Value) -> ApiResponse<serde_json::Value> {
    save_deduction_settings_impl(data)
}

// ─── Nemotron AI Commands ───────────────────────────────────────────────

#[tauri::command]
pub async fn nemotron_chat(input: NemotronChatInput) -> ApiResponse<NemotronChatResponse> {
    nemotron_chat_impl(input)
}

#[tauri::command]
pub async fn nemotron_analyze_document(document_text: String) -> ApiResponse<serde_json::Value> {
    nemotron_analyze_document_impl(document_text)
}

#[tauri::command]
pub async fn nemotron_loan_recommendation(input: NemotronLoanRecommendationInput) -> ApiResponse<serde_json::Value> {
    nemotron_loan_recommendation_impl(input)
}

// ─── Deepseek Config ────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_deepseek_config() -> ApiResponse<DeepseekConfig> {
    ApiResponse::ok(DeepseekConfig::default())
}
