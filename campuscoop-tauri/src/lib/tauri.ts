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

// ─── Detect Tauri vs Browser ─────────────────────────────────────────────

const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;

let invoke: any = null;
if (isTauri) {
  import('@tauri-apps/api/core').then((mod) => {
    invoke = mod.invoke;
  });
}

// ─── Mock Data for Browser Development ───────────────────────────────────

const MOCK_MEMBERS: Member[] = [
  {
    username: 'ICMADMIN',
    password: 'ICM12345',
    email: 'admin@sksu.edu',
    member_type: 'masteradmin',
    first_name: 'Master',
    last_name: 'Admin',
    department: 'Administration',
    capital: 0,
    date_joined: '2025-01-01',
    phone: '',
    status: 'Active',
    role: 'masteradmin',
    is_profile_complete: true,
  },
  {
    username: '09171234567',
    password: 'sksu1234',
    email: 'member@sksu.edu',
    member_type: 'Teacher',
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    department: 'Education',
    capital: 50000,
    date_joined: '2025-01-15',
    phone: '09171234567',
    status: 'Active',
    role: 'Member',
    is_profile_complete: true,
  },
];

const MOCK_APPLICATIONS: LoanApplication[] = [];

const MOCK_LOANS: Loan[] = [];

const MOCK_PAYMENTS: Payment[] = [];

const MOCK_OFFICERS: Officer[] = [];

const MOCK_SETTINGS: Settings = {
  ss_id: '',
  school_year: 'AY 2025-2026',
  admin_password: 'admin1234',
};

// ─── LocalStorage Helpers ────────────────────────────────────────────────

function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// ─── Generic Call Helper (Tauri or Mock) ─────────────────────────────────

async function call<T>(cmd: string, args?: any): Promise<T> {
  // ─── Browser Mock Mode ─────────────────────────────────────────────
  if (!isTauri || !invoke) {
    return mockCall(cmd, args) as T;
  }

  // ─── Tauri Desktop Mode ────────────────────────────────────────────
  return invoke<T>(cmd, args || {});
}

// ─── Mock Command Handler ──────────────────────────────────────────────

async function mockCall(cmd: string, args: any = {}): Promise<any> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 300));

  switch (cmd) {
    // ─── Auth ──────────────────────────────────────────────────────
    case 'login_member': {
      const { username, password } = args;
      const member = MOCK_MEMBERS.find(
        (m) => m.username.toUpperCase() === username.toUpperCase() && m.password === password
      );
      if (!member) return { success: false, message: 'Invalid credentials.' };
      return { success: true, data: { member } };
    }

    case 'login_officer': {
      const { username, password, role } = args;
      // Demo bypass: username "1", password "1"
      if (username === '1' && password === '1') {
        const member: Member = {
          username: 'Demo ' + role,
          password: '',
          email: 'demo@sksu.edu',
          member_type: role,
          first_name: 'Demo',
          last_name: role,
          department: role,
          capital: 0,
          date_joined: new Date().toISOString(),
          phone: '',
          status: 'Active',
          role,
          is_profile_complete: true,
        };
        return { success: true, data: { member } };
      }
      return { success: false, message: 'Invalid credentials.' };
    }

    case 'login_admin': {
      const { username, password } = args;
      if (username === 'ICMADMIN' && password === 'ICM12345') {
        const member: Member = {
          username: 'ICMADMIN',
          password: '',
          email: 'admin@sksu.edu',
          member_type: 'masteradmin',
          first_name: 'Master',
          last_name: 'Admin',
          department: 'Administration',
          capital: 0,
          date_joined: new Date().toISOString(),
          phone: '',
          status: 'Active',
          role: 'masteradmin',
          is_profile_complete: true,
        };
        return { success: true, data: { member } };
      }
      return { success: false, message: 'Invalid admin credentials.' };
    }

    case 'complete_profile_setup':
      return { success: true, data: { success: true } };

    case 'request_password_reset':
      return { success: true, data: { success: true } };

    case 'reset_password_with_token':
      return { success: true, data: { success: true } };

    case 'create_member':
      return { success: true, data: { success: true } };

    case 'get_members':
      return { success: true, data: MOCK_MEMBERS };

    case 'get_member_profile':
      return { success: true, data: MOCK_MEMBERS[0] };

    // ─── Officers ────────────────────────────────────────────────────
    case 'create_officer_account':
      return { success: true, data: { success: true } };
    case 'get_officer_accounts':
      return { success: true, data: MOCK_OFFICERS };
    case 'update_officer_account':
      return { success: true, data: { success: true } };
    case 'deactivate_officer_account':
      return { success: true, data: { success: true } };
    case 'change_officer_credentials':
      return { success: true, data: { success: true } };

    // ─── Loans ───────────────────────────────────────────────────────
    case 'submit_loan_application':
      return { success: true, data: { success: true } };
    case 'get_loan_applications':
      return { success: true, data: MOCK_APPLICATIONS };
    case 'approve_application':
      return { success: true, data: { success: true } };
    case 'reject_application':
      return { success: true, data: { success: true } };
    case 'final_release_loan':
      return { success: true, data: { success: true } };
    case 'batch_release_loans':
      return { success: true, data: { success: true } };
    case 'get_member_loans':
      return { success: true, data: MOCK_LOANS };
    case 'get_all_loans_by_member':
      return { success: true, data: MOCK_LOANS };
    case 'get_loan_terms':
      return { success: false, message: 'Loan not found.' };
    case 'add_loan_direct':
      return { success: true, data: { success: true } };
    case 'add_migration_loan':
      return { success: true, data: { success: true } };
    case 'get_officer_borrower_data':
      return { success: true, data: [] };

    // ─── Deductions ──────────────────────────────────────────────────
    case 'get_deductions_for_member':
      return { success: true, data: [] };
    case 'add_deduction':
      return { success: true, data: { success: true } };
    case 'remove_deduction':
      return { success: true, data: { success: true } };
    case 'save_borrower_remarks':
      return { success: true, data: { success: true } };

    // ─── Payments ────────────────────────────────────────────────────
    case 'record_payment':
      return { success: true, data: { success: true } };
    case 'get_payments':
      return { success: true, data: MOCK_PAYMENTS };
    case 'get_member_payments':
      return { success: true, data: MOCK_PAYMENTS };
    case 'confirm_payment':
      return { success: true, data: { success: true } };
    case 'review_payment':
      return { success: true, data: { success: true } };
    case 'reject_payment_record':
      return { success: true, data: { success: true } };
    case 'record_payment_by_admin':
      return { success: true, data: { success: true } };
    case 'search_payment_by_or':
      return { success: true, data: { success: true, found: false } };
    case 'bulk_mark_months_paid':
      return { success: true, data: { success: true } };
    case 'submit_multi_month_payment':
      return { success: true, data: { success: true } };
    case 'get_payments_by_loan_id':
      return { success: true, data: MOCK_PAYMENTS };

    // ─── Member Dashboard ────────────────────────────────────────────
    case 'get_member_dashboard_data':
      return {
        success: true,
        data: { loans: MOCK_LOANS, applications: MOCK_APPLICATIONS, payments: MOCK_PAYMENTS },
      };
    case 'get_cbu_history':
      return {
        success: true,
        data: {
          current_cbu: 50000,
          date_joined: '2025-01-15',
          total_deducted: 0,
          deductions: [],
        },
      };
    case 'get_member_ledger_data':
      return { success: true, data: { loans: MOCK_LOANS, payments: MOCK_PAYMENTS } };
    case 'send_member_question':
      return { success: true, data: { success: true } };

    // ─── Treasurer ───────────────────────────────────────────────────
    case 'get_treasurer_release_data':
      return { success: true, data: MOCK_APPLICATIONS };

    // ─── Settings ────────────────────────────────────────────────────
    case 'get_settings':
      return { success: true, data: MOCK_SETTINGS };
    case 'save_settings':
      return { success: true, data: { success: true } };
    case 'check_spreadsheet_connected':
      return { success: true, data: { connected: true, database: 'sqlite', message: 'Mock database connected' } };
    case 'get_deduction_settings':
      return { success: true, data: { CBU_REG_PCT: 300, CBU_ST_PCT: 80, CBU_COM_PCT: 80 } };
    case 'save_deduction_settings':
      return { success: true, data: { success: true } };

    // ─── Nemotron AI ─────────────────────────────────────────────────
    case 'nemotron_chat':
      return {
        success: true,
        data: {
          response: '[Nemotron 3.5 Super VL - Mock Mode]\n\nI received your message: "' + args.message + '"\n\nNote: Running in browser mock mode. Set up Tauri backend for real AI responses.',
          model: 'mock-nemotron',
          usage: null,
        },
      };
    case 'nemotron_analyze_document':
      return { success: true, data: { analysis: 'Mock analysis - configure Tauri backend for real AI.' } };
    case 'nemotron_loan_recommendation':
      return {
        success: true,
        data: {
          recommendation: 'Mock recommendation - configure Tauri backend for real AI.',
          model: 'mock-nemotron',
        },
      };

    // ─── Deepseek Config ─────────────────────────────────────────────
    case 'get_deepseek_config':
      return {
        success: true,
        data: {
          api_url: 'https://api.deepseek.com',
          model: 'deepseek-chat',
          features: ['code_assistance', 'loan_calculator', 'member_chat'],
        },
      };

    // ─── Health ──────────────────────────────────────────────────────
    case 'health_check':
      return {
        success: true,
        data: { status: 'ok', version: '1.0.0', database: 'mock', timestamp: Date.now() },
      };

    default:
      return { success: false, message: 'Unknown command: ' + cmd };
  }
}

// ─── Exported API Functions ────────────────────────────────────────────

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

export const healthCheck = () =>
  call<ApiResponse<{ status: string; version: string; database: string; timestamp: number }>>('health_check');
