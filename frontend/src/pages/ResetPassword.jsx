import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../services/api';
import { useLocale } from '../i18n/useLocale';

function ResetPassword() {
  const { isRTL, brandName } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError(isRTL ? 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية.' : 'Password reset link is invalid or has expired.');
      return;
    }

    if (password.length < 8) {
      setError(isRTL ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError(isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authAPI.resetPassword({ token, password });
      setMessage(response.data?.message || (isRTL ? 'تمت إعادة تعيين كلمة المرور بنجاح.' : 'Password reset successful.'));
      window.setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (requestError) {
      setError(requestError.response?.data?.error || (isRTL ? 'تعذر إعادة تعيين كلمة المرور.' : 'Failed to reset password.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden bg-gray-50">
      <div className="absolute inset-0 mesh-gradient" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="floating-orb w-[400px] h-[400px] bg-cyan-100/50 top-[-100px] left-[-100px] animate-float" />
        <div className="floating-orb w-[300px] h-[300px] bg-primary-100/40 bottom-[-50px] right-[-50px] animate-float-slow" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-block mb-8">
            <img src="/logo.png" alt={brandName} className="h-32 sm:h-40 w-auto mx-auto" />
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">{isRTL ? 'إعادة تعيين كلمة المرور' : 'Reset Password'}</h1>
          <p className="text-gray-500 text-lg">
            {isRTL ? 'أدخل كلمة مرور جديدة لحسابك.' : 'Enter a new password for your account.'}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
                {message}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="input-field"
                placeholder={isRTL ? '8 أحرف على الأقل' : 'Min 8 characters'}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="input-field"
                placeholder={isRTL ? 'أعد إدخال كلمة المرور' : 'Repeat your password'}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-4 text-base"
            >
              {isSubmitting
                ? (isRTL ? 'جارٍ الحفظ...' : 'Saving...')
                : (isRTL ? 'حفظ كلمة المرور الجديدة' : 'Save New Password')}
            </button>
          </form>

          <div className="text-center mt-8">
            <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium transition-colors">
              {isRTL ? 'العودة إلى تسجيل الدخول' : 'Back to Sign In'}
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default ResetPassword;
