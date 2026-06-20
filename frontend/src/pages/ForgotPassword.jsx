import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authAPI } from '../services/api';
import { useLocale } from '../i18n/useLocale';

function ForgotPassword() {
  const { isRTL, brandName } = useLocale();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await authAPI.requestPasswordReset({ email });
      setMessage(
        response.data?.message
        || (isRTL
          ? 'إذا كان البريد الإلكتروني مسجلًا، فسيصلك رابط إعادة تعيين كلمة المرور.'
          : 'If this email is registered, a password reset link will be sent.')
      );
    } catch (requestError) {
      setError(requestError.response?.data?.error || (isRTL ? 'تعذر إرسال رابط إعادة التعيين.' : 'Failed to send password reset link.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden bg-gray-50">
      <div className="absolute inset-0 mesh-gradient" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="floating-orb w-[400px] h-[400px] bg-primary-100/50 top-[-100px] right-[-100px] animate-float" />
        <div className="floating-orb w-[300px] h-[300px] bg-cyan-100/40 bottom-[-50px] left-[-50px] animate-float-slow" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-block mb-8">
            <img src="/logo.png" alt={brandName} className="h-16 w-auto mx-auto" />
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">{isRTL ? 'نسيت كلمة المرور' : 'Forgot Password'}</h1>
          <p className="text-gray-500 text-lg">
            {isRTL ? 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين.' : 'Enter your email and we will send you a reset link.'}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                {isRTL ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-4 text-base"
            >
              {isSubmitting
                ? (isRTL ? 'جارٍ الإرسال...' : 'Sending...')
                : (isRTL ? 'إرسال رابط إعادة التعيين' : 'Send Reset Link')}
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

export default ForgotPassword;
