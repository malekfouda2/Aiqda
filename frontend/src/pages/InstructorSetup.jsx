import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../services/api';
import { useLocale } from '../i18n/useLocale';

function InstructorSetup() {
  const { t, isRTL, brandName } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(isRTL ? 'رابط الإعداد هذا لا يحتوي على رمز صالح.' : 'This setup link is missing a token.');
      return;
    }

    if (password.length < 8) {
      setError(isRTL ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.' : 'Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError(isRTL ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authAPI.acceptInstructorInvite({ token, password });
      setSuccess(response.data.message);
      setTimeout(() => navigate('/login'), 1200);
    } catch (inviteError) {
      setError(inviteError.response?.data?.error || (isRTL ? 'تعذر إكمال إعداد الحساب.' : 'Failed to complete account setup.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden bg-gray-50">
      <div className="absolute inset-0 mesh-gradient" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-block mb-8">
            <img src="/logo.png" alt={brandName} className="h-16 w-auto mx-auto" />
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">{isRTL ? 'قم بتعيين كلمة المرور' : 'Set Your Password'}</h1>
          <p className="text-gray-500 text-lg">{isRTL ? 'أكمل تفعيل حساب صانع المحتوى الخاص بك' : 'Finish activating your instructor account'}</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {(error || success) && (
              <div
                className={`px-4 py-3 rounded-xl text-sm border ${
                  success
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}
              >
                {success || error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder={isRTL ? '8 أحرف على الأقل' : 'At least 8 characters'}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.confirmPassword')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {isSubmitting ? t('common.saving') : (isRTL ? 'تفعيل الحساب' : 'Activate Account')}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default InstructorSetup;
