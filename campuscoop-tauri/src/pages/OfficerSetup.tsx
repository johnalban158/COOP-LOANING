import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginOfficer } from '../lib/tauri';
import { ArrowLeft } from 'lucide-react';

export default function OfficerSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const roles = [
    { value: 'regular', label: 'Regular Loan Officer' },
    { value: 'shortterm', label: 'Short Term Loan Officer' },
    { value: 'commodity', label: 'Commodity Loan Officer' },
    { value: 'treasurer', label: 'Treasurer' },
    { value: 'chairperson', label: 'Chairperson' },
  ];

  const handleSetup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;

    setLoading(true);
    setError('');

    try {
      // Demo bypass: username "1", password "1"
      const res = await loginOfficer({ username, password, role });
      if (res.success && res.data?.member) {
        localStorage.setItem('cc_user', JSON.stringify(res.data.member));
        localStorage.setItem('cc_role', res.data.member.role || role);
        navigate('/app/dashboard');
      } else {
        setError(res.message || 'Officer setup failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-coop-bg px-4">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-2 mb-6">
          <ArrowLeft className="w-4 h-4 text-gray-400 hover:text-coop-dark cursor-pointer" onClick={() => navigate('/login')} />
          <h1 className="text-2xl font-bold text-coop-dark">Officer Setup</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <p className="text-gray-600 text-sm mb-6">
            Secure your officer account. Select your section and log in.
          </p>

          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="label-text">Email / Username</label>
              <input
                name="username"
                type="email"
                className="input-field"
                placeholder="officer@sksu.edu"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Demo: enter <code className="text-coop-dark">1</code> for quick access</p>
            </div>
            <div>
              <label className="label-text">Password</label>
              <input
                name="password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                required
              />
              <p className="text-xs text-gray-400 mt-1">Demo: enter <code className="text-coop-dark">1</code> for quick access</p>
            </div>
            <div>
              <label className="label-text">Select Your Section</label>
              <select name="role" className="input-field">
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Setting up...' : 'Secure Officer Account'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © 2026 CampusCoop · SKSU
        </p>
      </div>
    </div>
  );
}
