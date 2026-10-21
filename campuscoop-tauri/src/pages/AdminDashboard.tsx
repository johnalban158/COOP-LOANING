import { useState, useEffect } from 'react';
import {
  getLoanApplications,
  approveApplication,
  rejectApplication,
  finalReleaseLoan,
  batchReleaseLoans,
  getPayments,
  getMembers,
  getTreasurerReleaseData,
  getOfficerBorrowerData,
  getSettings,
  saveSettings,
} from '../lib/tauri';
import type { LoanApplication, Payment, Member, TreasurerLoan, Settings } from '../types';
import { formatPeso, loanTypeLabel, normLoanType, formatDate } from '../lib/utils';
import {
  FileText,
  CreditCard,
  Users,
  ShieldAlert,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Plus,
  Mail,
  AlertTriangle,
} from 'lucide-react';

export default function AdminDashboard() {
  const [tab, setTab] = useState<'applications' | 'payments' | 'members' | 'officers' | 'treasurer' | 'settings'>('applications');
  const [loading, setLoading] = useState(false);

  // Data
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
    const deductionData = {
      totalB: app.total_past_dues,
      totalC: app.other_deductions,
      netProceeds: app.net_proceeds,
    };
    if (!confirm(`Approve loan application for ${app.firstName} ${app.lastName} (₱${app.amount})?`)) return;

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

  const handleRelease = async (row: number, app: TreasurerLoan) => {
    if (!confirm(`Release loan for ${app.firstName} ${app.lastName}?`)) return;
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
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

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Pending Applications</p>
          <h3 className="text-2xl font-bold text-coop-dark">{pendingCount}</h3>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">In Settlement</p>
          <h3 className="text-2xl font-bold text-coop-dark">{settlementCount}</h3>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Pending Payments</p>
          <h3 className="text-2xl font-bold text-coop-dark">{pendingPayments}</h3>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase">Total Members</p>
          <h3 className="text-2xl font-bold text-coop-dark">{members.length}</h3>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[['applications', 'Loan Applications'], ['payments', 'Payments'], ['members', 'Members'], ['officers', 'Officers'], ['treasurer', 'Treasurer Release'], ['settings', 'Settings']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
              tab === key ? 'border-coop-dark text-coop-dark' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Applications Tab */}
      {tab === 'applications' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-coop-dark">Loan Applications</h3>
            <button className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Application
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Member</th>
                  <th className="table-header">Loan Type</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Term</th>
                  <th className="table-header">Submitted</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app: LoanApplication) => (
                  <tr key={app.row} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">{app.firstName} {app.lastName}</td>
                    <td className="table-cell">{normLoanType(app.loan_type)}</td>
                    <td className="table-cell font-semibold">{formatPeso(app.amount)}</td>
                    <td className="table-cell">{app.term} months</td>
                    <td className="table-cell text-gray-600 text-sm">{formatDate(app.date_submitted)}</td>
                    <td className="table-cell">
                      <span className={`badge ${
                        app.status === 'Pending' ? 'badge-pending' :
                        app.status.includes('Approved') ? 'badge-active' :
                        app.status === 'Released' ? 'badge-paid' :
                        app.status === 'Rejected' ? 'badge-rejected' : 'badge-under-review'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        {app.status === 'Pending' && (
                          <>
                            <button onClick={() => handleApprove(app.row, app)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Approve">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleReject(app.row, app)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Reject">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {app.status === 'Approved (In Settlement)' && (
                          <button onClick={() => handleRelease(app.row, app)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Release">
                            <Mail className="w-4 h-4" />
                          </button>
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

      {/* Payments Tab */}
      {tab === 'payments' && (
        <div className="card">
          <h3 className="font-semibold text-coop-dark mb-4">All Payments</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Member</th>
                  <th className="table-header">Loan Type</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Method</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">OR Number</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.slice(0, 50).map((pay: Payment) => (
                  <tr key={pay.row} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">{pay.memberName}</td>
                    <td className="table-cell">{normLoanType(pay.loan_type)}</td>
                    <td className="table-cell font-semibold">{formatPeso(pay.amount)}</td>
                    <td className="table-cell text-sm">{pay.method}</td>
                    <td className="table-cell text-gray-600 text-sm">{formatDate(pay.date_paid)}</td>
                    <td className="table-cell">
                      <span className={`badge ${
                        pay.status === 'Confirmed' ? 'badge-confirmed' :
                        pay.status === 'Pending' ? 'badge-pending' :
                        pay.status === 'Rejected' ? 'badge-rejected' : 'badge-under-review'
                      }`}>
                        {pay.status}
                      </span>
                    </td>
                    <td className="table-cell text-sm">{pay.or_number || '-'}</td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        {pay.status === 'Pending' && (
                          <>
                            <button onClick={() => alert('Confirm payment ' + pay.row)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Confirm">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => alert('Review payment ' + pay.row)} className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg" title="Review">
                              <Clock className="w-4 h-4" />
                            </button>
                            <button onClick={() => alert('Reject payment ' + pay.row)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Reject">
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

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="card">
          <h3 className="font-semibold text-coop-dark mb-4">Members</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Name</th>
                  <th className="table-header">Login ID</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Capital</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Role</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: Member) => (
                  <tr key={m.username} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">{m.firstName} {m.lastName}</td>
                    <td className="table-cell font-semibold">{m.username}</td>
                    <td className="table-cell">{m.member_type}</td>
                    <td className="table-cell">{formatPeso(m.capital)}</td>
                    <td className="table-cell">
                      <span className={`badge ${m.status === 'Active' ? 'badge-active' : 'badge-pending'}`}>{m.status}</span>
                    </td>
                    <td className="table-cell">{m.role || 'Member'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Officers Tab */}
      {tab === 'officers' && (
        <div className="card">
          <h3 className="font-semibold text-coop-dark mb-4">Officer Accounts</h3>
          <p className="text-sm text-gray-500 mb-4">Manage officer accounts (regular, shortterm, commodity, treasurer, chairperson).</p>
        </div>
      )}

      {/* Treasurer Tab */}
      {tab === 'treasurer' && (
        <div className="card">
          <h3 className="font-semibold text-coop-dark mb-4">Treasurer - Loan Release</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Member</th>
                  <th className="table-header">Loan Type</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Net Proceeds</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Action</th>
                </tr>
              </thead>
              <tbody>
                {treasurerLoans.map((loan: TreasurerLoan) => (
                  <tr key={loan.row} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">{loan.firstName} {loan.lastName}</td>
                    <td className="table-cell">{normLoanType(loan.loan_type)}</td>
                    <td className="table-cell font-semibold">{formatPeso(loan.amount)}</td>
                    <td className="table-cell font-semibold text-green-700">{formatPeso(loan.net_proceeds)}</td>
                    <td className="table-cell">
                      <span className={`badge ${loan.status.includes('Released') ? 'badge-paid' : 'badge-active'}`}>{loan.status}</span>
                    </td>
                    <td className="table-cell">
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

      {/* Settings Tab */}
      {tab === 'settings' && (
        <div className="card">
          <h3 className="font-semibold text-coop-dark mb-4">System Settings</h3>
          <form onSubmit={(e) => { e.preventDefault(); handleSaveSettings(); }} className="space-y-4 max-w-md">
            <div>
              <label className="label-text">School Year</label>
              <input
                name="schoolYear"
                type="text"
                defaultValue={settings.school_year}
                className="input-field"
                onChange={(e) => setSettings({ ...settings, school_year: e.target.value })}
              />
            </div>
            <div>
              <label className="label-text">Admin Password</label>
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
