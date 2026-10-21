import { invoke } from '@tauri-apps/api/core';
import type {
  ApiResponse,
  LoginInput,
  LoginOfficerInput,
  CreateMemberInput,
  SubmitLoanApplicationInput,
  ConfirmPaymentInput,
  RecordPaymentInput,
  RecordPaymentByAdminInput,
  ReviewRejectPaymentInput,
  NemotronChatInput,
  NemotronChatResponse,
  NemotronLoanRecommendationInput,
  Settings,
  SaveSettingsInput,
  AddLoanDirectInput,
  AddMigrationLoanInput,
  AddDeductionInput,
  Member,
  Officer,
  Loan,
  LoanApplication,
  Payment,
  Deduction,
  MemberDashboardData,
  CbuHistory,
  TreasurerLoan,
  BorrowerData,
  DeepseekConfig,
} from '../types';

// ─── Generic invoke helper ──────────────────────────────────────────────

async function call<T>(cmd: string, args?: any): Promise<T> {
  return invoke<T>(cmd, args || {});
}

// ─── Auth ───────────────────────────────────────────────────────────────

export const loginMember = (input: LoginInput) =>
  call<ApiResponse<{ member?: Member }>>('login_member', input);

export const loginOfficer = (input: LoginOfficerInput) =>
  call<ApiResponse<{ member?: Member }>>('login_officer', input);

export const loginAdmin = (username: string, password: string) =>
  call<ApiResponse<{ member?: Member }>>('login_admin', { username, password });

export const completeProfileSetup = (memberId: string, data: any) =>
  call<ApiResponse<any>>('complete_profile_setup', { member_id: memberId, ...data });

export const requestPasswordReset = (email: string) =>
  call<ApiResponse<any>>('request_password_reset', { email });

export const resetPasswordWithToken = (token: string, newPassword: string) =>
  call<ApiResponse<any>>('reset_password_with_token', { token, new_password: newPassword });

export const createMember = (input: CreateMemberInput) =>
  call<ApiResponse<any>>('create_member', input);

export const getMembers = () => call<ApiResponse<Member[]>>('get_members');

export const getMemberProfile = (memberId: string) =>
  call<ApiResponse<Member>>('get_member_profile', { member_id: memberId });

// ─── Officers ───────────────────────────────────────────────────────────

export const createOfficerAccount = (input: any) =>
  call<ApiResponse<Officer>>('create_officer_account', input);

export const getOfficerAccounts = () => call<ApiResponse<Officer[]>>('get_officer_accounts');

export const updateOfficerAccount = (email: string, data: any) =>
  call<ApiResponse<any>>('update_officer_account', { email, ...data });

export const deactivateOfficerAccount = (email: string) =>
  call<ApiResponse<any>>('deactivate_officer_account', { email });

export const changeOfficerCredentials = (data: any) =>
  call<ApiResponse<any>>('change_officer_credentials', data);

// ─── Loans ──────────────────────────────────────────────────────────────

export const submitLoanApplication = (input: SubmitLoanApplicationInput) =>
  call<ApiResponse<any>>('submit_loan_application', input);

export const getLoanApplications = () => call<ApiResponse<LoanApplication[]>>('get_loan_applications');

export const approveApplication = (sheetRow: number, deductionData: any) =>
  call<ApiResponse<any>>('approve_application', { sheet_row: sheetRow, deduction_data: deductionData });

export const rejectApplication = (sheetRow: number, reason: string) =>
  call<ApiResponse<any>>('reject_application', { sheet_row: sheetRow, reason });

export const finalReleaseLoan = (sheetRow: number, deductionData: any, claimingSchedule: any) =>
  call<ApiResponse<any>>('final_release_loan', { sheet_row: sheetRow, deduction_data: deductionData, claiming_schedule: claimingSchedule });

export const batchReleaseLoans = (sheetRows: number[]) =>
  call<ApiResponse<any>>('batch_release_loans', { sheet_rows: sheetRows });

export const getMemberLoans = (memberId: string) =>
  call<ApiResponse<Loan[]>>('get_member_loans', { member_id: memberId });

export const getAllLoansByMember = (memberId: string) =>
  call<ApiResponse<Loan[]>>('get_all_loans_by_member', { member_id: memberId });

export const getLoanTerms = (loanId: string) =>
  call<ApiResponse<Loan>>('get_loan_terms', { loan_id: loanId });

export const addLoanDirect = (input: AddLoanDirectInput) =>
  call<ApiResponse<any>>('add_loan_direct', input);

export const addMigrationLoan = (input: AddMigrationLoanInput) =>
  call<ApiResponse<any>>('add_migration_loan', input);

export const getOfficerBorrowerData = () => call<ApiResponse<BorrowerData[]>>('get_officer_borrower_data');

// ─── Deductions ─────────────────────────────────────────────────────────

export const getDeductionsForMember = (memberId: string) =>
  call<ApiResponse<Deduction[]>>('get_deductions_for_member', { member_id: memberId });

export const addDeduction = (input: AddDeductionInput) =>
  call<ApiResponse<any>>('add_deduction', input);

export const removeDeduction = (row: number) =>
  call<ApiResponse<any>>('remove_deduction', { row });

export const saveBorrowerRemarks = (memberId: string, remarks: string) =>
  call<ApiResponse<any>>('save_borrower_remarks', { member_id: memberId, remarks });

// ─── Payments ───────────────────────────────────────────────────────────

export const recordPayment = (input: RecordPaymentInput) =>
  call<ApiResponse<any>>('record_payment', input);

export const getPayments = () => call<ApiResponse<Payment[]>>('get_payments');

export const getMemberPayments = (memberId: string) =>
  call<ApiResponse<Payment[]>>('get_member_payments', { member_id: memberId });

export const confirmPayment = (input: ConfirmPaymentInput) =>
  call<ApiResponse<any>>('confirm_payment', input);

export const reviewPayment = (input: ReviewRejectPaymentInput) =>
  call<ApiResponse<any>>('review_payment', input);

export const rejectPaymentRecord = (input: ReviewRejectPaymentInput) =>
  call<ApiResponse<any>>('reject_payment_record', input);

export const recordPaymentByAdmin = (input: RecordPaymentByAdminInput) =>
  call<ApiResponse<any>>('record_payment_by_admin', input);

export const searchPaymentByOR = (refNum: string) =>
  call<ApiResponse<any>>('search_payment_by_or', { ref_num: refNum });

export const bulkMarkMonthsPaid = (data: any) =>
  call<ApiResponse<any>>('bulk_mark_months_paid', data);

export const submitMultiMonthPayment = (data: any) =>
  call<ApiResponse<any>>('submit_multi_month_payment', data);

export const getPaymentsByLoanId = (loanId: string) =>
  call<ApiResponse<Payment[]>>('get_payments_by_loan_id', { loan_id: loanId });

// ─── Member Dashboard ───────────────────────────────────────────────────

export const getMemberDashboardData = (memberId: string) =>
  call<ApiResponse<MemberDashboardData>>('get_member_dashboard_data', { member_id: memberId });

export const getCbuHistory = (memberId: string) =>
  call<ApiResponse<CbuHistory>>('get_cbu_history', { member_id: memberId });

export const getMemberLedgerData = (memberId: string) =>
  call<ApiResponse<any>>('get_member_ledger_data', { member_id: memberId });

export const sendMemberQuestion = (data: any) =>
  call<ApiResponse<any>>('send_member_question', data);

// ─── Treasurer ──────────────────────────────────────────────────────────

export const getTreasurerReleaseData = () => call<ApiResponse<TreasurerLoan[]>>('get_treasurer_release_data');

// ─── Settings ───────────────────────────────────────────────────────────

export const getSettings = () => call<ApiResponse<Settings>>('get_settings');

export const saveSettings = (input: SaveSettingsInput) =>
  call<ApiResponse<any>>('save_settings', input);

export const checkSpreadsheetConnected = () =>
  call<ApiResponse<any>>('check_spreadsheet_connected');

export const getDeductionSettings = () => call<ApiResponse<any>>('get_deduction_settings');

export const saveDeductionSettings = (data: any) =>
  call<ApiResponse<any>>('save_deduction_settings', data);

// ─── Nemotron AI ────────────────────────────────────────────────────────

export const nemotronChat = (input: NemotronChatInput) =>
  call<ApiResponse<NemotronChatResponse>>('nemotron_chat', input);

export const nemotronAnalyzeDocument = (documentText: string) =>
  call<ApiResponse<any>>('nemotron_analyze_document', { document_text: documentText });

export const nemotronLoanRecommendation = (input: NemotronLoanRecommendationInput) =>
  call<ApiResponse<any>>('nemotron_loan_recommendation', input);

// ─── Deepseek Config ────────────────────────────────────────────────────

export const getDeepseekConfig = () => call<ApiResponse<DeepseekConfig>>('get_deepseek_config');

// ─── Health ─────────────────────────────────────────────────────────────

export const healthCheck = () => call<ApiResponse<{ status: string; version: string; database: string; timestamp: number }>>('health_check');
