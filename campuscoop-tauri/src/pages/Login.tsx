import { useState } from 'react';
import { loginMember, loginOfficer, loginAdmin, checkSpreadsheetConnected } from '../lib/tauri';
import { formatPeso } from '../lib/utils';
import { User, ShieldAlert, Mail, Lock, ArrowRight } from 'lucide-react';

type RoleConfig = {
  label: string;
  icon: React.ElementType;
  color: string;
};

const ROLE_CONFIGS: Record<string, RoleConfig> = {
  regular: { label: 'Regular Loan Officer', icon: User, color: 'bg-blue-100 text-blue-700' },
  shortterm: { label: 'Short Term Officer', icon: User, color: 'bg-green-100 text-green-700' },
  commodity: { label: 'Commodity Officer', icon: User, color: 'bg-purple-100 text-purple-700' },
  treasurer: { label: 'Treasurer', icon: ShieldAlert, color: 'bg-orange-100 text-orange-700' },
  chairperson: { label: 'Chairperson', icon: ShieldAlert, color: 'bg-indigo-100 text-indigo-700' },
  admin: { label: 'Administrator', icon: ShieldAlert, color: 'bg-red-100 text-red-700' },
  masteradmin: { label: 'Master Admin', icon: ShieldAlert, color: 'bg-coop-dark text-white' },
};

export default function LoginPage() {
  const [view, setView] = useState<'member' | 'officer' | 'admin'>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    setLoading(true);
    setError('');
    try {
      const res = await loginMember({ username, password });
      if (res.success && res.data?.member) {
        localStorage.setItem('cc_user', JSON.stringify(res.data.member));
        localStorage.setItem('cc_role', res.data.member.role || 'member');
        window.location.href = '/app/member-home';
      } else {
        setError(res.message || 'Invalid credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOfficerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;

    setLoading(true);
    setError('');
    try {
      const res = await loginOfficer({ username, password, role });
      if (res.success && res.data?.member) {
        localStorage.setItem('cc_user', JSON.stringify(res.data.member));
        localStorage.setItem('cc_role', res.data.member.role || role);
        window.location.href = '/app/dashboard';
      } else {
        setError(res.message || 'Invalid credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    setLoading(true);
    setError('');
    try {
      const res = await loginAdmin(username, password);
      if (res.success && res.data?.member) {
        localStorage.setItem('cc_user', JSON.stringify(res.data.member));
        localStorage.setItem('cc_role', res.data.member.role || 'admin');
        window.location.href = '/app/dashboard';
      } else {
        setError(res.message || 'Invalid admin credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Admin login failed.');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = Object.entries(ROLE_CONFIGS).map(([key, cfg]) => ({
    value: key,
    label: cfg.label,
  }));

  return (
    <div className="min-h-screen flex items-center justify-center bg-coop-bg px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-coop-dark rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <User className="w-9 h-9 text-coop-light" />
          </div>
          <h1 className="text-2xl font-bold text-coop-dark">CAMPUS<span className="text-coop-light">COOP</span></h1>
          <p className="text-gray-500 text-sm">SKSU Cooperative Loan System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Role Tabs */}
          <div className="flex gap-2 mb-6">
            {['member', 'officer', 'admin'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  view === v
                    ? 'bg-coop-dark text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {v === 'member' && <User className="w-4 h-4 mr-2" />}
                {v === 'officer' && <ShieldAlert className="w-4 h-4 mr-2" />}
                {v === 'admin' && <Mail className="w-4 h-4 mr-2" />}
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {view === 'member' && (
            <form onSubmit={handleMemberLogin} className="space-y-4">
              <div>
                <label className="label-text">Login ID (Mobile Number)</label>
                <input
                  name="username"
                  type="text"
                  className="input-field"
                  placeholder="09171234567"
                  required
                />
              </div>
              <div>
                <label className="label-text">Password</label>
                <input
                  name="password"
                  type="password"
                  className="input-field"
                  placeholder="sksu1234"
                  required
                />
              </div>
              <p className="text-xs text-gray-500">
                Default password is <code className="text-coop-dark">sksu1234</code>. Change it after first login.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Signing in...' : 'Sign In as Member'}
              </button>
            </form>
          )}

          {view === 'officer' && (
            <form onSubmit={handleOfficerLogin} className="space-y-4">
              <div>
                <label className="label-text">Email</label>
                <input name="username" type="email" className="input-field" placeholder="officer@sksu.edu" required />
              </div>
              <div>
                <label className="label-text">Password</label>
                <input name="password" type="password" className="input-field" placeholder="••••••••" required />
              </div>
              <div>
                <label className="label-text">Section / Role</label>
                <select name="role" className="input-field">
                  {roleOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                Demo: username <code className="text-coop-dark">1</code>, password <code className="text-coop-dark">1</code>
              </p>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Signing in...' : 'Sign In as Officer'}
              </button>
            </form>
          )}

          {view === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="label-text">Admin Username</label>
                <input name="username" type="text" className="input-field" placeholder="ICMADMIN" required />
              </div>
              <div>
                <label className="label-text">Admin Password</label>
                <input name="password" type="password" className="input-field" placeholder="••••••••" required />
              </div>
              <p className="text-xs text-gray-500">
                Master admin: <code className="text-coop-dark">ICMADMIN</code> / <code className="text-coop-dark">ICM12345</code>
              </p>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Signing in...' : 'Sign In as Admin'}
              </button>
            </form>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-sm text-gray-600 text-center mb-4">
              New member? Contact your cooperative officer to create an account.
            </p>
            <button
              onClick={() => window.location.href = '/profile-setup'}
              className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
            >
              Profile Setup / Forgot Password
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          © 2026 CampusCoop · Sultan Kudarat State University
        </div>
      </div>
    </div>
  );
}
