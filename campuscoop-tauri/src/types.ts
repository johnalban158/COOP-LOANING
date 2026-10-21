export interface Member {
  username: string;
  password?: string;
  email: string;
  member_type: string;
  first_name: string;
  last_name: string;
  department: string;
  capital: number;
  date_joined?: string;
  phone: string;
  status: string;
  role?: string;
  is_profile_complete?: boolean;
}

export interface Officer {
  email: string;
  password: string;
  role: string;
  fullname: string;
  mobile: string;
  status: string;
  created_by: string;
  created_at?: string;
  school_year: string;
  last_login?: string;
}

export interface LoanApplication {
  row: number;
  member_id: string;
  first_name: string;
  last_name: string;
  loan_type: string;
  amount: number;
  term: number;
  date_submitted?: string;
  date_approved?: string;
  status: string;
  reason?: string;
  total_past_dues: number;
  other_deductions: number;
  net_proceeds: number;
  existing_balance: number;
  member_capital: number;
  member_type: string;
  date_released?: string;
  released_by?: string;
  school?: string;
  purpose?: string;
}

export interface Loan {
  loan_id: string;
  member_id: string;
  member_name: string;
  amount: number;
  monthly: number;
  term: number;
  total_payable: number;
  date_released?: string;
  maturity_date?: string;
  balance: number;
  status: string;
  school_year?: string;
  loan_type: string;
  total_past_dues?: number;
  other_deductions?: number;
  net_proceeds?: number;
}

export interface Payment {
  row: number;
  timestamp: string;
  member_id: string;
  member_name: string;
  member_email: string;
  loan_type: string;
  month_num: number;
  amount: number;
  method: string;
  reference: string;
  date_paid: string;
  notes: string;
  status: string;
  proof_url?: string;
  or_number?: string;
}

export interface Deduction {
  id: number;
  member_id: string;
  name: string;
  type: string;
  value: number;
  applies_to: string;
  amount: number;
  created_by: string;
  created_at?: string;
}

export interface Settings {
  ss_id: string;
  school_year: string;
  admin_password: string;
}

export interface MemberDashboardData {
  loans: Loan[];
  applications: LoanApplication[];
  payments: Payment[];
}

export interface CbuHistory {
  current_cbu: number;
  date_joined?: string;
  total_deducted: number;
  deductions: Loan[];
}

export interface TreasurerLoan {
  row: number;
  member_id: string;
  first_name: string;
  last_name: string;
  loan_type: string;
  amount: number;
  term: number;
  date_submitted?: string;
  date_approved?: string;
  status: string;
  total_past_dues: number;
  other_deductions: number;
  net_proceeds: number;
  date_released?: string;
  released_by?: string;
  school?: string;
  purpose?: string;
}

export interface BorrowerData {
  loan_id: string;
  member_id: string;
  first_name: string;
  last_name: string;
  school: string;
  principal: number;
  paid: number;
  balance: number;
  status: string;
  date_released?: string;
  maturity_date?: string;
  payments: any[];
  remarks: string;
  total_deductions: number;
}

export interface NemotronChatResponse {
  response: string;
  model: string;
  usage?: any;
}

export interface DeepseekConfig {
  api_url: string;
  model: string;
  features: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export type UserRole = 'member' | 'regular' | 'shortterm' | 'commodity' | 'treasurer' | 'chairperson' | 'admin' | 'masteradmin';

export interface AuthUser {
  username: string;
  email: string;
  member_type: string;
  first_name: string;
  last_name: string;
  department: string;
  capital: number;
  role?: string;
  is_profile_complete?: boolean;
}
