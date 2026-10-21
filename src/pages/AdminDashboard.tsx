import { useState, useEffect } from 'react';
import {
  getLoanApplications,
  approveApplication,
  rejectApplication,
  finalReleaseLoan,
  getPayments,
  getMembers,
  getTreasurerReleaseData,
  getSettings,
  saveSettings,
} from '../lib/tauri';
import type { LoanApplication, Payment, Member, TreasurerLoan, Settings } from '../types';
import { formatPeso, normLoanType, formatDate } from '../lib/utils';
import {
  FileText,
  CreditCard,
  Users,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Plus,
  Mail,
} from 'lucide-react';

export default function AdminDashboard() {
  const [tab, setTab] = useState<'applications' | 'payments' | 'members' | 'officers' | 'treasurer' | 'settings'>('applications');
  const [loading, setLoading] = useState(false);

  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [treasurerLoans, setTreasurerLoans] = useState<TreasurerLoan[]>([]);
  const [settings, setSettings] = useState<Settings>({ ss_id: '', school_year: 'AY 2025-2026', admin_password: '' });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [appRes, payRes, memRes, treasRes, setRes] = await Promise.allSettled([
        getLoanApplications(),
        getPayments(),
        getMembers(),
        getTreasurerReleaseData(),
        getSettings(),
      ]);

      if (appRes.status === 'fulfilled' && appRes.value.success && appRes.value.data) {
        setApplications(appRes.value.data);
      }
      if (payRes.status === 'fulfilled' && payRes.value.success && payRes.value.data) {
        setPayments(payRes.value.data);
      }
      if (memRes.status === 'fulfilled' && memRes.value.success && memRes.value.data) {
        setMembers(memRes.value.data);
      }
      if (treasRes.status === 'fulfilled' && treasRes.value.success && treasRes.value.data) {
        setTreasurerLoans(treasRes.value.data);
      }
      if (setRes.status === 'fulfilled' && setRes.value.success && setRes.value.data) {
        setSettings(setRes.value.data);
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (row: number, app: LoanApplication) => {
    if (!confirm(`Approve loan for ${app.first_name} ${app.last_name} (₱${app.amount})?`)) return;
    const deductionData = {
      totalB: app.total_past_dues,
      totalC: app.other_deductions,
      netProceeds: app.net_proceeds,
    };
    try {
      const res = await approveApplication(row, deductionData);
      if (res.success) {
        alert('Application approved!');
        loadAll();
      } else {
        alert(res.message || 'Approval failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Approval failed.');
    }
  };

  const handleReject = async (row: number, app: LoanApplication) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      const res = await rejectApplication(row, reason);
      if (res.success) {
        alert('Application rejected.');
        loadAll();
      } else {
        alert(res.message || 'Reject failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Reject failed.');
    }
  };

  const handleRelease = async (row: number, loan: TreasurerLoan) => {
    if (!confirm(`Release loan for ${loan.first_name} ${loan.last_name}?`)) return;
    try {
      const res = await finalReleaseLoan(row, {}, {});
      if (res.success) {
        alert('Loan released!');
        loadAll();
      } else {
        alert(res.message || 'Release failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Release failed.');
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await saveSettings({ school_year: settings.school_year, admin_password: settings.admin_password });
      if (res.success) {
        alert('Settings saved.');
      } else {
        alert(res.message || 'Save failed.');
      }
    } catch (err: any) {
      alert(err.message || 'Save failed.');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-coop-light border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-gray-500">Loading admin dashboard...</p>
      </div>
    );
  }

  const pendingCount = applications.filter((a) => a.status === 'Pending').length;
  const settlementCount = applications.filter((a) => a.status === 'Approved (In Settlement)').length;
  const pendingPayments = payments.filter((p) => p.status === 'Pending').length;

  const navItems = [
    { key: 'applications', label: 'Loan Applications' },
    { key: 'payments', label: 'Payments' },
    { key: 'members', label: 'Members' },
    { key: 'officers', label: 'Officers' },
    { key: 'treasurer', label: 'Treasurer Release' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-coop-dark">Admin Dashboard</h1>
          <p className="text-gray-500">Manage loans, payments, members, and officers.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pending Applications</p>
          <h3 className="text-2xl font-bold text-coop-dark">{pendingCount}</h3>
          <p className="text-xs text-gray-500 mt-1">Awaiting approval</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">In Settlement</p>
          <h3 className="text-2xl font-bold text-coop-dark">{settlementCount}</h3>
          <p className="text-xs text-gray-500 mt-1">Awaiting release</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pending Payments</p>
          <h3 className="text-2xl font-bold text-coop-dark">{pendingPayments}</h3>
          <p className="text-xs text-gray-500 mt-1">Needs confirmation</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Members</p>
          <h3 className="text-2xl font-bold text-coop-dark">{members.length}</h3>
          <p className="text-xs text-gray-500 mt-1">Registered members</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
      {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
              tab === item.key ? 'border-coop-dark text-coop-dark' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'applications' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4 p-6">
            <h3 className="font-semibold text-coop-dark">Loan Applications</h3>
            <button className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Application
            </button>
          </div>
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Applicant</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Loan</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Months</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Date Filed</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {applications.map((app) => (
                  <tr key={app.row} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm">{app.first_name} {app.last_name}</td>
                    <td className="px-4 py-3 text-sm">{normLoanType(app.loan_type)}</td>
                    <td className="px-4 py-3 text-sm">{app.loan_type}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{formatPeso(app.amount)}</td>
                    <td className="px-4 py-3 text-sm">{app.term}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(app.date_submitted)}</td>
                    <td className="px-4 py-3"><Badge status={app.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {app.status === 'Pending' && (
                          <>
                            <button onClick={() => handleApprove(app.row, app)} className="px-3 py-1.5 text-green-600 bg-green-50 rounded-lg text-xs font-semibold hover:bg-green-100">Approve</button>
                            <button onClick={() => handleReject(app.row, app)} className="px-3 py-1.5 text-red-600 bg-red-50 rounded-lg text-xs font-semibold hover:bg-red-100">Reject</button>
                          </>
                        )}
                        {app.status === 'Approved (In Settlement)' && (
                          <button className="px-3 py-1.5 text-blue-600 bg-blue-50 rounded-lg text-xs font-semibold hover:bg-blue-100">Release</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-coop-dark mb-4 p-6">All Payments</h3>
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Member</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Loan Type</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Method</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">OR Number</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.slice(0, 50).map((pay) => (
                  <tr key={pay.row} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm">{pay.member_name}</td>
                    <td className="px-4 py-3 text-sm">{normLoanType(pay.loan_type)}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{formatPeso(pay.amount)}</td>
                    <td className="px-4 py-3 text-sm">{pay.method}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(pay.date_paid)}</td>
                    <td className="px-4 py-3"><Badge status={pay.status} /></td>
                    <td className="px-4 py-3 text-sm">{pay.or_number || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {pay.status === 'Pending' && (
                          <>
                            <button onClick={() => alert('Confirm payment ' + pay.row)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg text-xs" title="Confirm">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => alert('Review payment ' + pay.row)} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg text-xs" title="Review">
                              <Clock className="w-4 h-4" />
                            </button>
                            <button onClick={() => alert('Reject payment ' + pay.row)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg text-xs" title="Reject">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'members' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-coop-dark mb-4 p-6">Members</h3>
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Login ID</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Capital</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((m) => (
                  <tr key={m.username} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm">{m.first_name} {m.last_name}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{m.username}</td>
                    <td className="px-4 py-3 text-sm">{m.member_type}</td>
                    <td className="px-4 py-3 text-sm">{formatPeso(m.capital)}</td>
                    <td className="px-4 py-3"><Badge status={m.status} /></td>
                    <td className="px-4 py-3 text-sm">{m.role || 'Member'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'officers' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-coop-dark mb-4">Officer Accounts</h3>
          <p className="text-sm text-gray-500 mb-4">Manage officer accounts (regular, shortterm, commodity, treasurer, chairperson).</p>
        </div>
      )}

      {tab === 'treasurer' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-coop-dark mb-4 p-6">Treasurer — Loan Release</h3>
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Member</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Loan Type</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Net Proceeds</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {treasurerLoans.map((loan) => (
                  <tr key={loan.row} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm">{loan.first_name} {loan.last_name}</td>
                    <td className="px-4 py-3 text-sm">{normLoanType(loan.loan_type)}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{formatPeso(loan.amount)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-700">{formatPeso(loan.net_proceeds)}</td>
                    <td className="px-4 py-3"><Badge status={loan.status} /></td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleRelease(loan.row, loan)}
                        disabled={loan.status === 'Released'}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          loan.status === 'Released'
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-coop-dark text-white hover:bg-coop-dark/90'
                        }`}
                      >
                        Release
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-coop-dark mb-4">System Settings</h3>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveSettings(); }} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-semibold text-coop-dark mb-1">School Year</label>
              <input
                name="schoolYear"
                type="text"
                defaultValue={settings.school_year}
                className="input-field"
                onChange={(e) => setSettings({ ...settings, school_year: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-coop-dark mb-1">Admin Password</label>
              <input
                name="adminPassword"
                type="password"
                defaultValue={settings.admin_password}
                className="input-field"
                onChange={(e) => setSettings({ ...settings, admin_password: e.target.value })}
              />
            </div>
            <button type="submit" className="btn-primary w-full">Save Settings</button>
          </form>
        </div>
      )}
    </div>
  );
}

// Badge component used locally
function Badge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    'Pending': 'bg-yellow-100 text-yellow-700',
    'Confirmed': 'bg-green-100 text-green-700',
    'Rejected': 'bg-red-100 text-red-700',
    'Under Review': 'bg-orange-100 text-orange-700',
    'Active': 'bg-blue-100 text-blue-700',
    'Paid': 'bg-emerald-100 text-emerald-700',
    'Approved': 'bg-green-100 text-green-700',
    'Released': 'bg-emerald-100 text-emerald-700',
    'Approved (In Settlement)': 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-tighter ${variants[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}
