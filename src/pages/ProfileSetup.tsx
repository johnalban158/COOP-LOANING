import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeProfileSetup, requestPasswordReset } from '../lib/tauri';
import { User, Mail, Lock, Phone, ArrowLeft } from 'lucide-react';

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'setup' | 'reset'>('setup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleProfileSetup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const memberId = formData.get('memberId') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await completeProfileSetup(memberId, { phone, email, newPassword, confirmPassword });
      if (res.success) {
        setSuccess('Profile completed successfully! You can now log in.');
        setTimeout(() => navigate('/login'), 1500);
      } else {
        setError(res.message || 'Profile setup failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await requestPasswordReset(email);
      if (res.success) {
        setSuccess('Reset link generated. Check your email (or the app for the link).');
      } else {
        setError(res.message || 'Reset request failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-coop-bg px-4">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-2 mb-6">
          <ArrowLeft className="w-4 h-4 text-gray-400 hover:text-coop-dark cursor-pointer" onClick={() => navigate('/login')} />
          <h1 className="text-2xl font-bold text-coop-dark">{mode === 'setup' ? 'Profile Setup' : 'Reset Password'}</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {mode === 'setup' && (
            <form onSubmit={handleProfileSetup} className="space-y-4">
              <div>
                <label className="label-text">Login ID (Mobile Number)</label>
                <div className="flex items-center">
                  <User className="w-4 h-4 text-gray-400 mr-2" />
                  <input name="memberId" type="text" className="input-field pl-10" placeholder="09171234567" required />
                </div>
              </div>
              <div>
                <label className="label-text">Phone Number</label>
                <div className="flex items-center">
                  <Phone className="w-4 h-4 text-gray-400 mr-2" />
                  <input name="phone" type="tel" className="input-field pl-10" placeholder="09171234567" required />
                </div>
              </div>
              <div>
                <label className="label-text">Email Address</label>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 text-gray-400 mr-2" />
                  <input name="email" type="email" className="input-field pl-10" placeholder="name@email.com" required />
                </div>
              </div>
              <div>
                <label className="label-text">New Password (min 8 chars)</label>
                <div className="flex items-center">
                  <Lock className="w-4 h-4 text-gray-400 mr-2" />
                  <input name="newPassword" type="password" className="input-field pl-10" required />
                </div>
              </div>
              <div>
                <label className="label-text">Confirm Password</label>
                <div className="flex items-center">
                  <Lock className="w-4 h-4 text-gray-400 mr-2" />
                  <input name="confirmPassword" type="password" className="input-field pl-10" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-success w-full">
                {loading ? 'Saving...' : 'Complete Profile Setup'}
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetRequest} className="space-y-4">
              <div>
                <label className="label-text">Email Address</label>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 text-gray-400 mr-2" />
                  <input name="email" type="email" className="input-field pl-10" placeholder="name@email.com" required />
                </div>
              </div>
              <p className="text-sm text-gray-500">
                A reset link will be sent to your email. Link expires in 30 minutes.
              </p>
              <button type="submit" disabled={loading} className="btn-info w-full">
                {loading ? 'Sending...' : 'Send Reset Link'}
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

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <button
              onClick={() => setMode(mode === 'setup' ? 'reset' : 'setup')}
              className="text-sm text-coop-dark hover:underline font-medium"
            >
              {mode === 'setup' ? 'Forgot Password instead?' : 'Back to Profile Setup'}
            </button>
            <br />
            <button onClick={() => navigate('/login')} className="mt-3 text-sm text-gray-600 hover:text-coop-dark">
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
