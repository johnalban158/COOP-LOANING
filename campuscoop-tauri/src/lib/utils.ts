import { invoke } from '@tauri-apps/api/core';

// Check if we're running in Tauri (desktop) or browser (dev fallback)
export const isTauri = () => {
  return window.__TAURI__ !== undefined;
};

// Helper to format peso
export const formatPeso = (val: number): string => {
  return '₱' + (Number(val) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper to format date
export const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// Helper to normalize loan type label
export const loanTypeLabel = (loanIdOrType: string): string => {
  const s = String(loanIdOrType || '').toUpperCase();
  if (s.indexOf('REG') === 0) return 'Regular';
  if (s.indexOf('COM') === 0) return 'Commodity';
  if (s.indexOf('STL') === 0 || s === 'SHORT TERM' || s === 'SHORTTERM') return 'Short Term';
  return s || 'Regular';
};

// Helper to normalize payment status
export const normalizePayStatus = (raw: string): string => {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'confirmed' || s === 'paid' || s === 'approved' || s === 'completed') return 'Confirmed';
  if (s === 'pending' || s === 'under review' || s === 'for confirmation') return 'Pending';
  if (s === 'rejected') return 'Rejected';
  return raw || 'Pending';
};

// Helper to normalize loan type for display
export const normLoanType = (raw: string): string => {
  const s = String(raw || '').toUpperCase();
  if (s.indexOf('REG') === 0) return 'Regular';
  if (s.indexOf('COM') === 0) return 'Commodity';
  if (s.indexOf('STL') === 0 || s.indexOf('SHORT') === 0 || s === 'ST') return 'Short Term';
  return raw || 'Regular';
};

// Generate OR number preview
export const generateORNumber = (): string => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISO = new Date(now.getTime() - tzOffset).toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 90000 + 10000);
  return `OR-${localISO}-${rand}`;
};

// Loan payment calculation (ported from Apps Script logic)
export const calculateLoanPayment = (loanType: string, amount: number, term: number) => {
  let monthly = 0;
  let totalPayable = 0;

  if (loanType === 'Regular') {
    const prin = amount / term;
    const int1 = amount * 0.01;
    monthly = Math.round(prin + int1);
    totalPayable = amount;
  } else if (loanType === 'Commodity') {
    totalPayable = Math.round(amount * (1 + 0.01 * term));
    monthly = Math.round(totalPayable / term);
  } else {
    // Short Term
    totalPayable = Math.round(amount * 1.06);
    monthly = Math.round(totalPayable / term);
  }

  return { monthly, totalPayable };
};

// CBU max loanable calculation
export const calculateMaxLoanable = (capital: number, loanType: string, memberType: string) => {
  const regPct = 300;
  const stPct = 80;
  const comPct = 80;

  let applicablePct: number;
  if (loanType === 'Regular') {
    applicablePct = regPct;
  } else if (loanType === 'Commodity') {
    applicablePct = comPct;
  } else {
    // Short Term: pct depends on member type
    applicablePct = memberType === 'Teacher' ? regPct : stPct;
  }

  return Math.round(capital * applicablePct / 100);
};
