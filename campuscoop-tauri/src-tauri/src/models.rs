use serde::{Deserialize, Serialize};
use chrono::{NaiveDate, Utc};

// ─── Generic API Response ───────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { success: true, message: None, data: Some(data) }
    }
    pub fn err(msg: &str) -> Self {
        Self { success: false, message: Some(msg.to_string()), data: None }
    }
}

// ─── Member ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Member {
    pub username: String,
    pub password: Option<String>,
    pub email: String,
    pub member_type: String,
    pub first_name: String,
    pub last_name: String,
    pub department: String,
    pub capital: f64,
    pub date_joined: Option<String>,
    pub phone: String,
    pub status: String,
    pub role: Option<String>,
    pub is_profile_complete: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMemberInput {
    pub phone: String,
    pub password: Option<String>,
    pub email: String,
    pub member_type: String,
    pub first_name: String,
    pub last_name: String,
    pub department: Option<String>,
    pub capital: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct LoginInput {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResult {
    pub success: bool,
    pub member: Option<Member>,
    pub message: Option<String>,
}

// ─── Officer ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Officer {
    pub email: String,
    pub password: String,
    pub role: String,
    pub fullname: String,
    pub mobile: String,
    pub status: String,
    pub created_by: String,
    pub created_at: Option<String>,
    pub school_year: String,
    pub last_login: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginOfficerInput {
    pub username: String,
    pub password: String,
    pub role: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateOfficerInput {
    pub email: String,
    pub password: String,
    pub role: String,
    pub fullname: String,
    pub mobile: Option<String>,
    pub school_year: Option<String>,
}

// ─── Loan Application ──────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoanApplication {
    pub row: i64,
    pub member_id: String,
    pub first_name: String,
    pub last_name: String,
    pub loan_type: String,
    pub amount: f64,
    pub term: i32,
    pub date_submitted: Option<String>,
    pub date_approved: Option<String>,
    pub status: String,
    pub reason: Option<String>,
    pub total_past_dues: f64,
    pub other_deductions: f64,
    pub net_proceeds: f64,
    pub existing_balance: f64,
    pub member_capital: f64,
    pub member_type: String,
    pub date_released: Option<String>,
    pub released_by: Option<String>,
    pub school: Option<String>,
    pub purpose: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitLoanApplicationInput {
    pub member_id: String,
    pub first_name: String,
    pub last_name: String,
    pub loan_type: String,
    pub amount: f64,
    pub term: i32,
    pub member_email: Option<String>,
}

// ─── Loan ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Loan {
    pub loan_id: String,
    pub member_id: String,
    pub member_name: String,
    pub amount: f64,
    pub monthly: f64,
    pub term: i32,
    pub total_payable: f64,
    pub date_released: Option<String>,
    pub maturity_date: Option<String>,
    pub balance: f64,
    pub status: String,
    pub school_year: Option<String>,
    pub loan_type: String,
    pub total_past_dues: Option<f64>,
    pub other_deductions: Option<f64>,
    pub net_proceeds: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct AddLoanDirectInput {
    pub loan_type: String,
    pub member_id: String,
    pub member_name: String,
    pub amount: f64,
    pub monthly: Option<f64>,
    pub term: i32,
    pub date_released: Option<String>,
    pub months_paid: Option<i32>,
    pub status: Option<String>,
    pub school_year: Option<String>,
    pub past_dues: Option<f64>,
    pub deductions: Option<f64>,
    pub net_proceeds: Option<f64>,
    pub total_to_pay: Option<f64>,
    pub balance: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct AddMigrationLoanInput {
    pub loan_type: String,
    pub member_id: String,
    pub member_name: String,
    pub amount: f64,
    pub term: i32,
    pub months_paid: Option<i32>,
    pub date_released: Option<String>,
    pub status: Option<String>,
}

// ─── Payment ────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Payment {
    pub row: i64,
    pub timestamp: String,
    pub member_id: String,
    pub member_name: String,
    pub member_email: String,
    pub loan_type: String,
    pub month_num: i32,
    pub amount: f64,
    pub method: String,
    pub reference: String,
    pub date_paid: String,
    pub notes: String,
    pub status: String,
    pub proof_url: Option<String>,
    pub or_number: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecordPaymentInput {
    pub member_id: String,
    pub member_name: String,
    pub member_email: String,
    pub loan_type: String,
    pub month_num: i32,
    pub amount: f64,
    pub method: String,
    pub reference: Option<String>,
    pub date: Option<String>,
    pub notes: Option<String>,
    pub proof_base64: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConfirmPaymentInput {
    pub row: i64,
    pub amount: f64,
    pub member_id: String,
    pub loan_type: String,
    pub member_email: Option<String>,
    pub member_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewRejectPaymentInput {
    pub row: i64,
    pub reject_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecordPaymentByAdminInput {
    pub member_id: String,
    pub member_name: String,
    pub member_email: Option<String>,
    pub loan_type: String,
    pub month_num: i32,
    pub amount: f64,
    pub method: String,
    pub reference: Option<String>,
    pub date_paid: Option<String>,
    pub notes: Option<String>,
    pub loan_id: Option<String>,
}

// ─── Deduction ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Deduction {
    pub id: i64,
    pub member_id: String,
    pub name: String,
    pub r#type: String,
    pub value: f64,
    pub applies_to: String,
    pub amount: f64,
    pub created_by: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddDeductionInput {
    pub member_id: String,
    pub name: String,
    pub r#type: String,
    pub value: f64,
    pub applies_to: String,
    pub amount: f64,
}

// ─── Settings ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub ss_id: String,
    pub school_year: String,
    pub admin_password: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveSettingsInput {
    pub school_year: Option<String>,
    pub admin_password: Option<String>,
}

// ─── Nemotron AI ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct NemotronChatInput {
    pub message: String,
    pub system_prompt: Option<String>,
    pub image_url: Option<String>, // For VL capabilities
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NemotronChatResponse {
    pub response: String,
    pub model: String,
    pub usage: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct NemotronLoanRecommendationInput {
    pub member_capital: f64,
    pub member_type: String,
    pub existing_loans: Vec<Loan>,
    pub requested_amount: f64,
    pub loan_type: String,
    pub term: i32,
}

// ─── Dashboard Data ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemberDashboardData {
    pub loans: Vec<Loan>,
    pub applications: Vec<LoanApplication>,
    pub payments: Vec<Payment>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CbuHistory {
    pub current_cbu: f64,
    pub date_joined: Option<String>,
    pub total_deducted: f64,
    pub deductions: Vec<Loan>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TreasurerLoan {
    pub row: i64,
    pub member_id: String,
    pub first_name: String,
    pub last_name: String,
    pub loan_type: String,
    pub amount: f64,
    pub term: i32,
    pub date_submitted: Option<String>,
    pub date_approved: Option<String>,
    pub status: String,
    pub total_past_dues: f64,
    pub other_deductions: f64,
    pub net_proceeds: f64,
    pub date_released: Option<String>,
    pub released_by: Option<String>,
    pub school: Option<String>,
    pub purpose: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BorrowerData {
    pub loan_id: String,
    pub member_id: String,
    pub first_name: String,
    pub last_name: String,
    pub school: String,
    pub principal: f64,
    pub paid: f64,
    pub balance: f64,
    pub status: String,
    pub date_released: Option<String>,
    pub maturity_date: Option<String>,
    pub payments: Vec<serde_json::Value>,
    pub remarks: String,
    pub total_deductions: f64,
}

// ─── Health ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub database: String,
    pub timestamp: i64,
}

// ─── Deepseek Frontend Config ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeepseekConfig {
    pub api_url: String,
    pub model: String,
    pub features: Vec<String>,
}

impl Default for DeepseekConfig {
    fn default() -> Self {
        Self {
            api_url: "https://api.deepseek.com".to_string(),
            model: "deepseek-chat".to_string(),
            features: vec![
                "code_assistance".to_string(),
                "loan_calculator".to_string(),
                "member_chat".to_string(),
                "document_summarization".to_string(),
            ],
        }
    }
}
