import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Users,
  Package,
  Clock,
  Plus,
  Mail,
  AlertTriangle,
  User,
  Settings as SettingsIcon,
  BarChart3,
} from 'lucide-react';
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
  getMemberDashboardData,
  getCbuHistory,
} from '../lib/tauri';
import { formatPeso, loanTypeLabel, normLoanType, formatDate } from '../lib/utils';
import type { Member, Payment, Loan, LoanApplication, TreasurerLoan } from '../types';

// ============================================================
// SHARED UI COMPONENTS
// ============================================================

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-coop-dark">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm">{subtitle}</p>}
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, color = 'coop-dark' }: { label: string; value: string | number; sub: string; icon: React.ElementType; color?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-${color}-100 text-${color}-600`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="text-2xl font-bold text-coop-dark">{value}</div>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

export function SectionTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-3 w-3 rounded-full bg-coop-dark" />
      <h3 className="font-semibold text-coop-dark text-sm">{title}</h3>
    </div>
  );
}

export function FilterRow({ active, onChange, options }: { active: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex gap-1 mb-4">
      <span className="text-xs font-medium text-gray-500 self-center mr-1">Filter:</span>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            active === o.value
              ? 'bg-coop-dark text-white shadow-sm'
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = 'No records found',
  emptyIcon = '📭',
  rowRenderer,
}: {
  columns: { key: string; label: string }[];
  data: T[];
  emptyMessage?: string;
  emptyIcon?: string;
  rowRenderer: (item: T, index: number) => React.ReactNode;
}) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <div className="text-center py-10 text-gray-500">
          <div className="text-3xl mb-3">{emptyIcon}</div>
          <p className="text-sm font-medium text-coop-dark">{emptyMessage}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-gray-50">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50 transition-colors">
              {rowRenderer(item, index)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-700',
    Confirmed: 'bg-green-100 text-green-700',
    Rejected: 'bg-red-100 text-red-700',
    'Under Review': 'bg-orange-100 text-orange-700',
    Active: 'bg-blue-100 text-blue-700',
    Paid: 'bg-emerald-100 text-emerald-700',
    Approved: 'bg-green-100 text-green-700',
    Released: 'bg-emerald-100 text-emerald-700',
    'Approved (In Settlement)': 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-tighter ${variants[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

export function InputField({ label, ...props }: { label?: string; [key: string]: any }) {
  return (
    <div className="mb-3">
      {label && <label className="block text-xs font-semibold text-coop-dark mb-1">{label}</label>}
      <input className="input-field" {...props} />
    </div>
  );
}

export function FormCard({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      {title && <h3 className="font-semibold text-coop-dark mb-4">{title}</h3>}
      {children}
    </div>
  );
}

export function InfoBanner({ title, text, icon = 'info', variant = 'info' }: { title: string; text: string; icon?: string; variant?: 'info' | 'success' | 'warning' | 'danger' }) {
  const variants: Record<string, { bg: string; border: string; text: string }> = {
    info: { bg: '#E6F1FB', border: '#B5D4F4', text: '#185FA5' },
    success: { bg: '#EAF3DE', border: '#C0DD97', text: '#3B6D11' },
    warning: { bg: '#FAEEDA', border: '#FAC775', text: '#854F0B' },
    danger: { bg: '#FCEBEB', border: '#F7C1C1', text: '#A32D2D' },
  };
  const v = variants[variant];
  return (
    <div className={`rounded-xl p-4 mb-4 border border-[1px] flex items-start gap-3`} style={{ backgroundColor: v.bg, borderColor: v.border }}>
      <div className={`flex-shrink-0 mt-0.5 text-${variant === 'info' ? 'blue-600' : variant === 'success' ? 'green-700' : variant === 'warning' ? 'yellow-700' : 'red-700'}`}>{icon}</div>
      <div>
        <div className={`font-semibold text-sm text-${variant === 'info' ? 'blue-900' : variant === 'success' ? 'green-900' : variant === 'warning' ? 'yellow-900' : 'red-900'}`}>{title}</div>
        <div className={`text-sm line-clamp-2 ${variant === 'info' ? 'text-blue-700' : variant === 'success' ? 'text-green-800' : variant === 'warning' ? 'text-yellow-800' : 'text-red-800'}`}>{text}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="text-center py-12 text-gray-500">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-sm font-medium text-coop-dark">{title}</div>
      <div className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">{sub}</div>
    </div>
  );
}

// ============================================================
// PAGES
// ============================================================

export function DashboardPage() {
  const [loading, setLoading] = useState(true);

  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [appRes, payRes, memRes] = await Promise.allSettled([
        getLoanApplications(),
        getPayments(),
        getMembers(),
      ]);
      if (appRes.status === 'fulfilled' && appRes.value.success && appRes.value.data) setApplications(appRes.value.data);
      if (payRes.status === 'fulfilled' && payRes.value.success && payRes.value.data) setPayments(payRes.value.data);
      if (memRes.status === 'fulfilled' && memRes.value.success && memRes.value.data) setMembers(memRes.value.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const pendingCount = applications.filter((a) => a.status === 'Pending').length;
  const settlementCount = applications.filter((a) => a.status === 'Approved (In Settlement)').length;
  const pendingPayments = payments.filter((p) => p.status === 'Pending').length;

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-coop-light border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Loan Dashboard" subtitle="AY 2025-2026 Welcome back Admin!" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Applications" value={pendingCount} sub="Awaiting approval" icon={FileText} color="amber" />
        <StatCard label="In Settlement" value={settlementCount} sub="Awaiting release" icon={Clock} color="blue" />
        <StatCard label="Pending Payments" value={pendingPayments} sub="Needs confirmation" icon={CreditCard} color="green" />
        <StatCard label="Total Members" value={members.length} sub="Registered members" icon={Users} color="coop-dark" />
      </div>

      <SectionTitle title="All Sections" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <DashboardCard label="Dashboard" icon={LayoutDashboard} sub="Overview of all loans collections and members" color="blue" badge="You are here" badgeColor="bg-blue-100 text-blue-700" />
        <DashboardCard label="Loan Applications" icon={FileText} sub="Review approve or reject member loan requests" color="amber" badge="No data yet" badgeColor="bg-yellow-100 text-yellow-700" />
        <DashboardCard label="Members" icon={Users} sub="All registered cooperative members" color="green" badge="View members" badgeColor="bg-green-100 text-green-700" />
        <DashboardCard label="Short Term Loans" icon={CreditCard} sub="Max 15000 1-6 months 6 percent flat" color="blue" badge="No data yet" badgeColor="bg-blue-100 text-blue-700" />
        <DashboardCard label="Regular Loans" icon={Users} sub="Max 200000 1-5 years 1 percent diminishing" color="green" badge="No data yet" badgeColor="bg-green-100 text-green-700" />
        <DashboardCard label="Payments" icon={CreditCard} sub="Review and confirm member loan payments" color="green" badge="View payments" badgeColor="bg-green-100 text-green-700" />
        <DashboardCard label="Collections" icon={CreditCard} sub="Monthly collection report and history" color="green" badge="View collections" badgeColor="bg-green-100 text-green-700" />
        <DashboardCard label="Overdue" icon={AlertTriangle} sub="Members who missed their payment due date" color="red" badge="View overdue" badgeColor="bg-red-100 text-red-700" />
        <DashboardCard label="Commodity Loans" icon={Package} sub="Max 5000 Max 2 months 1 percent interest per month" color="amber" badge="No data yet" badgeColor="bg-yellow-100 text-yellow-700" />
        <DashboardCard label="Settings" icon={SettingsIcon} sub="System configuration" color="gray" badge="Configure" badgeColor="bg-gray-100 text-gray-700" />
        <DashboardCard label="Payment Reminders" icon={Mail} sub="Send email reminders for upcoming dues" color="amber" badge="View reminders" badgeColor="bg-yellow-100 text-yellow-700" />
        <DashboardCard label="Financial Reports" icon={BarChart3} sub="Weekly monthly yearly reports" color="purple" badge="Generate" badgeColor="bg-purple-100 text-purple-700" />
      </div>

      <SectionTitle title="Recent Loan Accounts" />
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-50">
              <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Name</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Type</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Amount</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Balance</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {applications.slice(0, 10).map((app) => (
              <tr key={app.row} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium">{app.first_name} {app.last_name}</td>
                <td className="px-4 py-3 text-sm">{normLoanType(app.loan_type)}</td>
                <td className="px-4 py-3 text-sm font-semibold">{formatPeso(app.amount)}</td>
                <td className="px-4 py-3 text-sm">{formatPeso(app.net_proceeds)}</td>
                <td className="px-4 py-3"><Badge status={app.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DashboardCard({ label, icon, sub, color, badge, badgeColor }: { label: string; icon: React.ElementType; sub: string; color: string; badge: string; badgeColor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all cursor-pointer group">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${color}-100 text-${color}-600`}>
          <icon className="w-5 h-5" />
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}>{badge}</span>
      </div>
      <div className="font-semibold text-coop-dark text-sm">{label}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

export function ApplicationsPage() {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLoanApplications().then((res) => {
      if (res.success && res.data) setApplications(res.data);
      setLoading(false);
    });
  }, []);

  const filtered = applications.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return a.status === 'Pending';
    if (filter === 'approved') return a.status === 'Approved (In Settlement)';
    if (filter === 'rejected') return a.status === 'Rejected';
    return true;
  });

  const handleApprove = async (row: number, app: LoanApplication) => {
    if (!confirm(`Approve loan for ${app.first_name} ${app.last_name} amount ${app.amount}?`)) return;
    const deductionData = {
      totalB: app.total_past_dues,
      totalC: app.other_deductions,
      netProceeds: app.net_proceeds,
    };
    const res = await approveApplication(row, deductionData);
    if (res.success) {
      alert('Approved!');
      getLoanApplications().then((r) => { if (r.success && r.data) setApplications(r.data); });
    } else {
      alert(res.message || 'Failed');
    }
  };

  const handleReject = async (row: number, app: LoanApplication) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    const res = await rejectApplication(row, reason);
    if (res.success) {
      alert('Rejected');
      getLoanApplications().then((r) => { if (r.success && r.data) setApplications(r.data); });
    } else {
      alert(res.message || 'Failed');
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-coop-light border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Loan Applications"
        subtitle="Review approve or reject member loan requests"
        actions={
          <div className="flex items-center gap-3">
            <button className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Refresh</button>
          </div>
        }
      />

      <FilterRow
        active={filter}
        onChange={setFilter as (v: string) => void}
        options={[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
        ]}
      />

      <DataTable
        columns={[
          { key: 'applicant', label: 'Applicant' },
          { key: 'type', label: 'Type' },
          { key: 'loan', label: 'Loan' },
          { key: 'amount', label: 'Amount' },
          { key: 'months', label: 'Months' },
          { key: 'date', label: 'Date Filed' },
          { key: 'status', label: 'Status' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={filtered}
        rowRenderer={(app) => (
          <>
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
          </>
        )}
        emptyMessage="No loan applications yet"
        emptyIcon="📋"
      />
    </div>
  );
}

export function CommodityPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Commodity Loans"
        subtitle="Max 5000 Max 2 months 1 percent interest per month"
        actions={<button className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Commodity Loan</button>}
      />

      <InfoBanner
        title="Commodity Loan Rules"
        text="Maximum amount 5000 Maximum term 2 months Interest 1 percent per month Monthly Amount times 1.01 divided by Months"
        icon="box"
        variant="warning"
      />

      <FilterRow
        active="all"
        onChange={() => {}}
        options={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'paid', label: 'Paid' },
        ]}
      />

      <DataTable
        columns={[
          { key: 'member', label: 'Member' },
          { key: 'type', label: 'Type' },
          { key: 'amount', label: 'Amount' },
          { key: 'monthly', label: 'Monthly' },
          { key: 'months', label: 'Months' },
          { key: 'progress', label: 'Progress' },
          { key: 'balance', label: 'Balance' },
          { key: 'status', label: 'Status' },
          { key: 'action', label: 'Action' },
        ]}
        data={[]}
        rowRenderer={() => (
          <>
            <td className="px-4 py-3 text-sm">-</td>
            <td className="px-4 py-3 text-sm">Commodity</td>
            <td className="px-4 py-3 text-sm">0.00</td>
            <td className="px-4 py-3 text-sm">0.00</td>
            <td className="px-4 py-3 text-sm">-</td>
            <td className="px-4 py-3 text-sm">-</td>
            <td className="px-4 py-3 text-sm">0.00</td>
            <td className="px-4 py-3"><Badge status="Paid" /></td>
            <td className="px-4 py-3"><button className="px-2 py-1 text-gray-500 hover:text-coop-dark">View</button></td>
          </>
        )}
        emptyMessage="No commodity loans yet"
        emptyIcon="📦"
      />
    </div>
  );
}

export function RegularPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Regular Loans"
        subtitle="Max 200000 1-5 years 1 percent diminishing"
        actions={<button className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New Regular Loan</button>}
      />

      <InfoBanner
        title="Regular Loan Rules"
        text="Max 200000 or 3 times capital 1-5 years 1 percent monthly on remaining balance diminishing Teachers only"
        icon="bank"
        variant="success"
      />

      <FilterRow
        active="all"
        onChange={() => {}}
        options={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'paid', label: 'Paid' },
        ]}
      />

      <DataTable
        columns={[
          { key: 'member', label: 'Member' },
          { key: 'type', label: 'Type' },
          { key: 'amount', label: 'Amount' },
          { key: 'principal', label: 'Principal/Mo' },
          { key: 'interest', label: 'This Mo Interest' },
          { key: 'progress', label: 'Progress' },
          { key: 'balance', label: 'Balance' },
          { key: 'status', label: 'Status' },
          { key: 'action', label: 'Action' },
        ]}
        data={[]}
        rowRenderer={() => (
          <>
            <td className="px-4 py-3 text-sm">-</td>
            <td className="px-4 py-3 text-sm">Regular</td>
            <td className="px-4 py-3 text-sm">0.00</td>
            <td className="px-4 py-3 text-sm">0.00</td>
            <td className="px-4 py-3 text-sm">0.00</td>
            <td className="px-4 py-3 text-sm">-</td>
            <td className="px-4 py-3 text-sm">0.00</td>
            <td className="px-4 py-3"><Badge status="Active" /></td>
            <td className="px-4 py-3"><button className="px-2 py-1 text-gray-500 hover:text-coop-dark">View</button></td>
          </>
        )}
        emptyMessage="No regular loans yet"
        emptyIcon="🏦"
      />
    </div>
  );
}

export function ShortTermPage() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Short Term Loans"
        subtitle="Max 15000 1-6 months 6 percent flat"
        actions={<button className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> New STL</button>}
      />

      <InfoBanner
        title="Short Term Loan Rules"
        text="Max 15000 1-6 months 6 percent flat rate Monthly Amount times 1.06 divided by Months"
        icon="credit-card"
        variant="info"
      />

      <FilterRow
        active="all"
        onChange={() => {}}
        options={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'overdue', label: 'Overdue' },
          { value: 'paid', label: 'Paid' },
        ]}
      />

      <DataTable
        columns={[
          { key: 'member', label: 'Member' },
          { key: 'type', label: 'Type' },
          { key: 'amount', label: 'Amount' },
          { key: 'monthly', label: 'Monthly' },
          { key: 'months', label: 'Months' },
          { key: 'progress', label: 'Progress' },
          { key: 'balance', label: 'Balance' },
          { key: 'status', label: 'Status' },
          { key: 'action', label: 'Action' },
        ]}
        data={[]}
        rowRenderer={() => (
          <>
            <td className="px-4 py-3 text-sm">-</td>
            <td className="px-4 py-3 text-sm">Short Term</td>
            <td className="px-4 py-3 text-sm">0.00</td>
            <td className="px-4 py-3 text-sm">0.00</td>
            <td className="px-4 py-3 text-sm">-</td>
            <td className="px-4 py-3 text-sm">-</td>
            <td className="px-4 py-3 text-sm">0.00</td>
            <td className="px-4 py-3"><Badge status="Active" /></td>
            <td className="px-4 py-3"><button className="px-2 py-1 text-gray-500 hover:text-coop-dark">View</button></td>
          </>
        )}
        emptyMessage="No short term loans yet"
        emptyIcon="💳"
      />
    </div>
  );
}

export function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMembers().then((res) => {
      if (res.success && res.data) setMembers(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-coop-light border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Members"
        subtitle="All registered cooperative members"
        actions={<button className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Enroll Member</button>}
      />

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'loginId', label: 'Login ID' },
          { key: 'type', label: 'Type' },
          { key: 'capital', label: 'Capital' },
          { key: 'status', label: 'Status' },
          { key: 'role', label: 'Role' },
        ]}
        data={members}
        rowRenderer={(m) => (
          <>
            <td className="px-4 py-3 text-sm font-medium">{m.first_name} {m.last_name}</td>
            <td className="px-4 py-3 text-sm font-semibold">{m.username}</td>
            <td className="px-4 py-3 text-sm">{m.member_type}</td>
            <td className="px-4 py-3 text-sm">{formatPeso(m.capital)}</td>
            <td className="px-4 py-3"><Badge status={m.status} /></td>
            <td className="px-4 py-3 text-sm">{m.role || 'Member'}</td>
          </>
        )}
        emptyMessage="No members enrolled yet"
        emptyIcon="👥"
      />
    </div>
  );
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPayments().then((res) => {
      if (res.success && res.data) setPayments(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-coop-light border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Review and confirm member loan payments"
        actions={<button className="btn-primary flex items-center gap-2"><CreditCard className="w-4 h-4" /> Record Payment</button>}
      />

      <FilterRow
        active="all"
        onChange={() => {}}
        options={[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'rejected', label: 'Rejected' },
        ]}
      />

      <DataTable
        columns={[
          { key: 'member', label: 'Member' },
          { key: 'type', label: 'Loan Type' },
          { key: 'amount', label: 'Amount' },
          { key: 'method', label: 'Method' },
          { key: 'date', label: 'Date' },
          { key: 'status', label: 'Status' },
          { key: 'or', label: 'OR Number' },
          { key: 'actions', label: 'Actions' },
        ]}
        data={payments.slice(0, 50)}
        rowRenderer={(pay) => (
          <>
            <td className="px-4 py-3 text-sm">{pay.member_name}</td>
            <td className="px-4 py-3 text-sm">{normLoanType(pay.loan_type)}</td>
            <td className="px-4 py-3 text-sm font-semibold">{formatPeso(pay.amount)}</td>
            <td className="px-4 py-3 text-sm">{pay.method}</td>
            <td className="px-4 py-3 text-sm text-gray-600">{formatDate(pay.date_paid)}</td>
            <td className="px-4 py-3"><Badge status={pay.status} /></td>
            <td className="px-4 py-3 text-sm">{pay.or_number || '-'}</td>
            <td className="px-4 py-3">
              <div className="flex gap-1">
                {pay.status === 'Pending' && (
                  <>
                    <button className="px-2 py-1 text-green-600 hover:bg-green-50 rounded-lg text-xs">Confirm</button>
                    <button className="px-2 py-1 text-yellow-600 hover:bg-yellow-50 rounded-lg text-xs">Review</button>
                    <button className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg text-xs">Reject</button>
                  </>
                )}
              </div>
            </td>
          </>
        )}
        emptyMessage="No payments recorded yet"
        emptyIcon="💳"
      />
    </div>
  );
}

export function TreasurerPage() {
  const [loans, setLoans] = useState<TreasurerLoan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTreasurerReleaseData().then((res) => {
      if (res.success && res.data) setLoans(res.data);
      setLoading(false);
    });
  }, []);

  const handleRelease = async (row: number, loan: TreasurerLoan) => {
    if (!confirm(`Release loan for ${loan.first_name} ${loan.last_name}?`)) return;
    const res = await finalReleaseLoan(row, {}, {});
    if (res.success) {
      alert('Released!');
      getTreasurerReleaseData().then((r) => { if (r.success && r.data) setLoans(r.data); });
    } else {
      alert(res.message || 'Failed');
    }
  };

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-coop-light border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Treasurer Loan Release" subtitle="Release approved loans to members" />

      <DataTable
        columns={[
          { key: 'member', label: 'Member' },
          { key: 'type', label: 'Loan Type' },
          { key: 'amount', label: 'Amount' },
          { key: 'proceeds', label: 'Net Proceeds' },
          { key: 'status', label: 'Status' },
          { key: 'action', label: 'Action' },
        ]}
        data={loans}
        rowRenderer={(loan) => (
          <>
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
          </>
        )}
        emptyMessage="No loans awaiting release"
        emptyIcon="📦"
      />
    </div>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState({ school_year: 'AY 2025-2026', admin_password: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSettings().then((res) => {
      if (res.success && res.data) {
        setSettings({ school_year: res.data.school_year, admin_password: res.data.admin_password });
      }
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await saveSettings({ school_year: settings.school_year, admin_password: settings.admin_password });
    setLoading(false);
    if (res.success) alert('Settings saved');
    else alert(res.message || 'Save failed');
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Settings" subtitle="System configuration" />
      <FormCard title="System Settings">
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <InputField label="School Year" name="schoolYear" defaultValue={settings.school_year} onChange={(e) => setSettings({ ...settings, school_year: e.target.value })} />
          <InputField label="Admin Password" name="adminPassword" type="password" defaultValue={settings.admin_password} onChange={(e) => setSettings({ ...settings, admin_password: e.target.value })} />
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </FormCard>
    </div>
  );
}

export function MemberHomePage() {
  const [data, setData] = useState<any>({ loans: [], applications: [], payments: [] });
  const [cbu, setCbu] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'loans' | 'payments' | 'apply'>('loans');

  const userRaw = localStorage.getItem('cc_user');
  const user: Member | null = userRaw ? JSON.parse(userRaw) : null;
  const memberId = user?.username || '';

  useEffect(() => {
    loadData();
  }, [memberId]);

  const loadData = async () => {
    try {
      const [dashRes, cbuRes] = await Promise.all([getMemberDashboardData(memberId), getCbuHistory(memberId)]);
      if (dashRes.success && dashRes.data) setData(dashRes.data);
      if (cbuRes.success && cbuRes.data) setCbu(cbuRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const activeLoans = (data.loans || []).filter((l: Loan) => l.status === 'Active');
  const totalBalance = activeLoans.reduce((sum: number, l: Loan) => sum + l.balance, 0);

  if (loading) {
    return <div className="p-6 flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-coop-light border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-coop-dark">Member Dashboard</h1>
          <p className="text-gray-500">Welcome back {user?.first_name} {user?.last_name}</p>
        </div>
        <button className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50" onClick={loadData}>Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Active Loans" value={activeLoans.length} sub="Currently running" icon={CreditCard} color="blue" />
        <StatCard label="Outstanding Balance" value={formatPeso(totalBalance)} sub="Total remaining" icon={Clock} color="coop-dark" />
        <StatCard label="Capital CBU" value={formatPeso(cbu?.current_cbu || user?.capital || 0)} sub="Your capital" icon={User} color="green" />
        <StatCard label="Pending Applications" value={(data.applications || []).filter((a: LoanApplication) => a.status === 'Pending').length} sub="Awaiting review" icon={FileText} color="amber" />
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {['loans', 'payments', 'apply'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as 'loans' | 'payments' | 'apply')}
            className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
              tab === t ? 'border-coop-dark text-coop-dark' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'loans' ? 'My Loans' : t === 'payments' ? 'Payments' : 'Apply for Loan'}
          </button>
        ))}
      </div>

      {tab === 'loans' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-coop-dark mb-4">Your Loans</h3>
          {activeLoans.length === 0 ? (
            <EmptyState icon="credit-card" title="No active loans" sub="Your active loans will appear here once approved." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Loan ID</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Monthly</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Balance</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Maturity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activeLoans.map((loan) => (
                    <tr key={loan.loan_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium">{loan.loan_id}</td>
                      <td className="px-4 py-3 text-sm">{loanTypeLabel(loan.loan_type)}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{formatPeso(loan.amount)}</td>
                      <td className="px-4 py-3 text-sm">{formatPeso(loan.monthly)}</td>
                      <td className="px-4 py-3 text-sm font-bold">{formatPeso(loan.balance)}</td>
                      <td className="px-4 py-3"><Badge status={loan.status} /></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(loan.maturity_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-coop-dark mb-4">Payment History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Loan Type</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Month</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Method</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase">OR Number</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(data.payments || []).slice(0, 20).map((pay: Payment) => (
                    <tr key={pay.row} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(pay.date_paid)}</td>
                      <td className="px-4 py-3 text-sm">{normLoanType(pay.loan_type)}</td>
                      <td className="px-4 py-3 text-sm">#{pay.month_num}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{formatPeso(pay.amount)}</td>
                      <td className="px-4 py-3 text-sm">{pay.method}</td>
                      <td className="px-4 py-3"><Badge status={pay.status} /></td>
                      <td className="px-4 py-3 text-sm">{pay.or_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-semibold text-coop-dark mb-4">Record Payment</h3>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-coop-dark mb-1">Loan Type</label>
                  <select className="input-field">
                    <option>Regular</option>
                    <option>Short Term</option>
                    <option>Commodity</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-coop-dark mb-1">Month #</label>
                  <input type="number" defaultValue="1" min="1" className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-coop-dark mb-1">Amount peso</label>
                <input type="number" step="0.01" className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-coop-dark mb-1">Method</label>
                  <select className="input-field">
                    <option>Cash</option>
                    <option>Salary Deduction</option>
                    <option>Bank Transfer</option>
                    <option>Online</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-coop-dark mb-1">Reference</label>
                  <input type="text" placeholder="Optional" className="input-field" />
                </div>
              </div>
              <button type="button" className="btn-success w-full flex items-center justify-center gap-2">
                <CreditCard className="w-4 h-4" /> Record Payment
              </button>
            </form>
          </div>
        </div>
      )}

      {tab === 'apply' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h3 className="font-semibold text-coop-dark mb-4">Apply for Loan</h3>
          <p className="text-sm text-gray-500 mb-4">
            Your maximum loanable amount based on Capital CBU: <span className="font-semibold text-coop-dark">{formatPeso(cbu?.current_cbu || user?.capital || 0)}</span>
          </p>
          <p className="text-xs text-gray-500 mb-4">Regular up to 300 percent of CBU Short Term up to 80 percent of CBU Commodity up to 80 percent of CBU</p>
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-coop-dark mb-1">Loan Type</label>
                <select className="input-field">
                  <option>Regular</option>
                  <option>Short Term</option>
                  <option>Commodity</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-coop-dark mb-1">Amount Requested peso</label>
                <input type="number" step="0.01" className="input-field" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-coop-dark mb-1">Term Months</label>
                <input type="number" className="input-field" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-coop-dark mb-1">First Name</label>
                <input type="text" defaultValue={user?.first_name} className="input-field" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-coop-dark mb-1">Last Name</label>
                <input type="text" defaultValue={user?.last_name} className="input-field" required />
              </div>
            </div>
            <button type="button" className="btn-info w-full flex items-center justify-center gap-2">
              <FileText className="w-4 h-4" /> Submit Application
            </button>
            <p className="text-xs text-gray-500 mt-2">Application submission requires backend endpoint Contact your loan officer.</p>
          </form>
        </div>
      )}
    </div>
  );
}
