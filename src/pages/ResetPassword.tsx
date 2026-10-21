import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resetPasswordWithToken } from '../lib/tauri';
import { Lock, Mail, ArrowLeft } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get token from URL
  const token = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null;

  const handleReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newPassword = formData.get('newPassword') as string;

    if (!token) {
      setError('No reset token found. Please request a new reset link.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await resetPasswordWithToken(token, newPassword);
      if (res.success) {
        setSuccess('Password reset successfully! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(res.message || 'Reset failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-coop-bg px-4">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-2 mb-6">
          <ArrowLeft className="w-4 h-4 text-gray-400 hover:text-coop-dark cursor-pointer" onClick={() => navigate('/login')} />
          <h1 className="text-2xl font-bold text-coop-dark">Reset Password</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {!token && (
            <div className="text-center">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-coop-dark">No Reset Link</h2>
              <p className="text-gray-500 text-sm mt-2">
                You need a valid reset token to reset your password. Please request one first.
              </p>
              <button onClick={() => navigate('/profile-setup')} className="mt-4 text-sm text-coop-dark hover:underline font-medium">
                Request Reset Link
              </button>
            </div>
          )}

          {token && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="label-text">New Password (min 8 chars)</label>
                <div className="flex items-center">
                  <Lock className="w-4 h-4 text-gray-400 mr-2" />
                  <input name="newPassword" type="password" className="input-field pl-10" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-success w-full">
                {loading ? 'Resetting...' : 'Reset My Password'}
              </button>
            </form>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm">
              {success}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
