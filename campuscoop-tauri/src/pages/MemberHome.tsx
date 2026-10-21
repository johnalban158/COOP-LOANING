import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getMemberDashboardData,
  getCbuHistory,
  recordPayment,
  getMemberPayments,
} from '../lib/tauri';
import {
  CreditCard,
  FileText,
  DollarSign,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  User,
} from 'lucide-react';
import { formatPeso, loanTypeLabel, normLoanType, formatDate } from '../lib/utils';
import type { Member, Payment, Loan } from '../types';

export default function MemberHome() {
  const navigate = useNavigate();
  const userRaw = localStorage.getItem('cc_user');
  const user: Member | null = userRaw ? JSON.parse(userRaw) : null;
  const memberId = user?.username || '';

  const [dashboard, setDashboard] = useState<{ loans: any[]; applications: any[]; payments: any[] }>({
    loans: [],
    applications: [],
    payments: [],
  });
  const [cbu, setCbu] = useState<{ current_cbu: number; total_deducted: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'loans' | 'payments' | 'apply'>('loans');

  useEffect(() => {
    loadData();
  }, [memberId]);

  const loadData = async () => {
    try {
      const [dashRes, cbuRes] = await Promise.all([
        getMemberDashboardData(memberId),
        getCbuHistory(memberId),
      ]);

      if (dashRes.success && dashRes.data) {
        setDashboard(dashRes.data);
      }
      if (cbuRes.success && cbuRes.data) {
        setCbu(cbuRes.data);
      }
    } catch (err: any) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const loanType = formData.get('loanType') as string;
    const monthNum = Number(formData.get('monthNum')) || 1;
    const amount = Number(formData.get('amount')) || 0;
    const method = formData.get('method') as string;
    const reference = formData.get('reference') as string;
    const date = formData.get('date') as string;
    const notes = formData.get('notes') as string;

    try {
      const res = await recordPayment({
        memberId,
        memberName: user?.first_name + ' ' + user?.last_name || '',
        memberEmail: user?.email || '',
        loanType,
        monthNum,
        amount,
        method,
        reference,
        date: date || undefined,
        notes: notes || undefined,
      });

      if (res.success) {
        alert('Payment recorded successfully!' + (res.data?.orNumber ? '\nOR Number: ' + res.data.orNumber : ''));
        loadData();
      } else {
        alert(res.message || 'Payment failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Payment failed.');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-coop-light border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const activeLoans = dashboard.loans.filter((l: any) => l.status === 'Active');
  const totalBalance = activeLoans.reduce((sum, l) => sum + (l.balance || 0), 0);
  const pendingApps = dashboard.applications.filter((a: any) => a.status === 'Pending');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-coop-dark">Member Dashboard</h1>
          <p className="text-gray-500">
            Welcome back, <span className="font-semibold text-coop-dark">{user?.first_name} {user?.last_name}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadData} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Active Loans</p>
              <h3 className="text-2xl font-bold text-coop-dark">{activeLoans.length}</h3>
            </div>
            <DollarSign className="w-8 h-8 text-coop-light" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Outstanding Balance</p>
              <h3 className="text-2xl font-bold text-coop-dark">{formatPeso(totalBalance)}</h3>
            </div>
            <Clock className="w-8 h-8 text-coop-light" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Capital (CBU)</p>
              <h3 className="text-2xl font-bold text-coop-dark">{formatPeso(cbu?.current_cbu || user?.capital || 0)}</h3>
            </div>
            <User className="w-8 h-8 text-coop-light" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase">Pending Applications</p>
              <h3 className="text-2xl font-bold text-coop-dark">{pendingApps.length}</h3>
            </div>
            <FileText className="w-8 h-8 text-coop-light" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        <button
          onClick={() => setActiveTab('loans')}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'loans'
              ? 'border-coop-dark text-coop-dark'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          My Loans
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'payments'
              ? 'border-coop-dark text-coop-dark'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Payments
        </button>
        <button
          onClick={() => setActiveTab('apply')}
          className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'apply'
              ? 'border-coop-dark text-coop-dark'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Apply for Loan
        </button>
      </div>

      {/* Loans Tab */}
      {activeTab === 'loans' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-coop-dark">Your Loans</h3>
          </div>
          {activeLoans.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <CreditCard className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p>No active loans.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">Loan ID</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Amount</th>
                    <th className="table-header">Monthly</th>
                    <th className="table-header">Balance</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Maturity</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLoans.map((loan: Loan) => (
                    <tr key={loan.loan_id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-semibold text-coop-dark">{loan.loan_id}</td>
                      <td className="table-cell">
                        <span className={`badge ${loan.loan_type === 'Regular' ? 'badge-blue' : loan.loan_type === 'Commodity' ? 'badge-purple' : 'badge-indigo'}`}>
                          {loanTypeLabel(loan.loan_type)}
                        </span>
                      </td>
                      <td className="table-cell font-semibold">{formatPeso(loan.amount)}</td>
                      <td className="table-cell">{formatPeso(loan.monthly)}</td>
                      <td className="table-cell font-bold">{formatPeso(loan.balance)}</td>
                      <td className="table-cell">
                        <span className={`badge ${loan.status === 'Paid' ? 'badge-paid' : 'badge-active'}`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="table-cell text-gray-600">{formatDate(loan.maturity_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <h3 className="font-semibold text-coop-dark mb-4">Payment History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">Date</th>
                    <th className="table-header">Loan Type</th>
                    <th className="table-header">Month</th>
                    <th className="table-header">Amount</th>
                    <th className="table-header">Method</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">OR Number</th>
                  </tr>
                </thead>
                <tbody>
                  {(dashboard.payments as Payment[]).slice(0, 20).map((pay: Payment) => (
                    <tr key={pay.row} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell text-gray-600">{formatDate(pay.date_paid)}</td>
                      <td className="table-cell">{normLoanType(pay.loan_type)}</td>
                      <td className="table-cell">#{pay.month_num}</td>
                      <td className="table-cell font-semibold">{formatPeso(pay.amount)}</td>
                      <td className="table-cell text-sm">{pay.method}</td>
                      <td className="table-cell">
                        <span className={`badge ${pay.status === 'Confirmed' ? 'badge-confirmed' : pay.status === 'Pending' ? 'badge-pending' : pay.status === 'Rejected' ? 'badge-rejected' : 'badge-under-review'}`}>
                          {pay.status}
                        </span>
                      </td>
                      <td className="table-cell text-sm">{pay.or_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-coop-dark mb-4">Record Payment</h3>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Loan Type</label>
                  <select name="loanType" className="input-field">
                    <option value="Regular">Regular</option>
                    <option value="Short Term">Short Term</option>
                    <option value="Commodity">Commodity</option>
                  </select>
                </div>
                <div>
                  <label className="label-text">Month #</label>
                  <input name="monthNum" type="number" defaultValue="1" min="1" className="input-field" />
                </div>
              </div>
              <div>
                <label className="label-text">Amount (₱)</label>
                <input name="amount" type="number" step="0.01" className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Method</label>
                  <select name="method" className="input-field">
                    <option value="Cash">Cash</option>
                    <option value="Salary Deduction">Salary Deduction</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
                <div>
                  <label className="label-text">Reference</label>
                  <input name="reference" type="text" className="input-field" placeholder="Optional" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text">Date Paid</label>
                  <input name="date" type="date" className="input-field" />
                </div>
                <div>
                  <label className="label-text">Notes</label>
                  <input name="notes" type="text" className="input-field" placeholder="Optional" />
                </div>
              </div>
              <button type="submit" className="btn-success w-full flex items-center justify-center gap-2">
                <CreditCard className="w-4 h-4" /> Record Payment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Apply Tab */}
      {activeTab === 'apply' && (
        <div className="card">
          <h3 className="font-semibold text-coop-dark mb-4">Apply for Loan</h3>
          <p className="text-sm text-gray-500 mb-4">
            Your maximum loanable amount is based on your Capital (CBU):{' '}
            <span className="font-semibold text-coop-dark">{formatPeso(cbu?.current_cbu || user?.capital || 0)}</span>
          </p>
          <div className="text-sm text-gray-500 mb-4">
            Regular: up to 300% of CBU | Short Term: up to 80% of CBU | Commodity: up to 80% of CBU
          </div>
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label-text">Loan Type</label>
                <select name="loanType" className="input-field" required>
                  <option value="Regular">Regular</option>
                  <option value="Short Term">Short Term</option>
                  <option value="Commodity">Commodity</option>
                </select>
              </div>
              <div>
                <label className="label-text">Amount Requested (₱)</label>
                <input name="amount" type="number" step="0.01" className="input-field" required />
              </div>
              <div>
                <label className="label-text">Term (Months)</label>
                <input name="term" type="number" className="input-field" required />
              </div>
              <div>
                <label className="label-text">First Name</label>
                <input name="firstName" type="text" defaultValue={user?.first_name} className="input-field" required />
              </div>
              <div>
                <label className="label-text">Last Name</label>
                <input name="lastName" type="text" defaultValue={user?.last_name} className="input-field" required />
              </div>
            </div>
            <div className="pt-4">
              <button type="button" className="btn-info w-full flex items-center justify-center gap-2 disabled:opacity-50">
                <FileText className="w-4 h-4" /> Submit Application
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Application submission requires backend endpoint. Contact your loan officer.
              </p>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
