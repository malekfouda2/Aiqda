import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';
import SocialAuthButtons from '../components/SocialAuthButtons';
import PlatformNoticeModal from '../components/PlatformNoticeModal';
import { useLocale } from '../i18n/useLocale';

function Register() {
  const { t, isRTL, brandName } = useLocale();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const { register, isLoading, error } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedPath = location.state?.from?.pathname || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError(isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setLocalError(isRTL ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }

    setShowTermsModal(true);
  };

  const handleRegisterWithTerms = async () => {
    const result = await register(name, email, password, 'student', true);
    if (result.success) {
      navigate('/dashboard');
      return;
    }

    setShowTermsModal(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden bg-gray-50">
      <div className="absolute inset-0 mesh-gradient" />
      
      <div className="absolute inset-0 overflow-hidden">
        <div className="floating-orb w-[400px] h-[400px] bg-cyan-100/50 top-[-100px] left-[-100px] animate-float" />
        <div className="floating-orb w-[300px] h-[300px] bg-primary-100/40 bottom-[-50px] right-[-50px] animate-float-slow" />
        <div className="floating-orb w-[200px] h-[200px] bg-orange-100/30 top-1/2 right-1/4 animate-glow-pulse" />
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
          <h1 className="text-4xl font-bold text-gray-900 mb-3">{isRTL ? 'أنشئ حسابًا' : 'Create Account'}</h1>
          <p className="text-gray-500 text-lg">{isRTL ? `انضم إلى ${brandName} وابدأ رحلتك اليوم` : `Join ${brandName} and start learning today`}</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {(error || localError) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm"
              >
                {error || localError}
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.fullName')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder={isRTL ? 'الاسم الكامل' : 'John Doe'}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.emailAddress')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('common.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder={isRTL ? '8 أحرف على الأقل' : 'Min 8 characters'}
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
              disabled={isLoading}
              className="btn-primary w-full py-4 text-base"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {isRTL ? 'جارٍ إنشاء الحساب...' : 'Creating account...'}
                </span>
              ) : (isRTL ? 'إنشاء الحساب' : 'Create Account')}
            </button>
          </form>

          <div className="mt-7">
            <SocialAuthButtons redirectPath={requestedPath} />
          </div>

          <div className="divider my-8" />

          <div className="text-center space-y-3">
            <p className="text-gray-500">
              {isRTL ? 'لديك حساب بالفعل؟ ' : 'Already have an account? '}
              <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium transition-colors">
                {isRTL ? 'سجّل الدخول' : 'Sign in'}
              </Link>
            </p>
            <p className="text-gray-400 text-sm">
              {isRTL ? 'هل أنت صانع محتوى؟ ' : 'Are you a creator? '}
              <Link to="/apply-instructor" className="text-brand-teal hover:text-teal-600 font-medium transition-colors">
                {isRTL ? 'قدّم من هنا' : 'Apply here'}
              </Link>
            </p>
          </div>
        </div>

        <PlatformNoticeModal
          open={showTermsModal}
          onAccept={handleRegisterWithTerms}
          onDecline={() => setShowTermsModal(false)}
          isSubmitting={isLoading}
          acceptLabel={isRTL ? 'إنشاء الحساب' : 'Create Account'}
          declineLabel={t('common.back')}
          title={isRTL ? 'يرجى مراجعة هذه الشروط' : 'Please Review These Terms'}
          subtitle={isRTL ? 'هذا الإقرار مطلوب قبل إنشاء حسابك.' : 'This acknowledgement is required before your account can be created.'}
          badgeLabel={isRTL ? 'شروط إنشاء الحساب' : 'Account Creation Terms'}
          confirmSummary={isRTL ? 'من خلال إنشاء حسابك، فإنك تؤكد أنك راجعت ووافقت على الشروط والأحكام الخاصة بالمستخدمين والسياسات المرتبطة بها والمذكورة أدناه.' : 'By creating your account, you confirm that you have reviewed and accepted the Terms & Conditions For Users and the related policies listed below.'}
        />
      </motion.div>
    </div>
  );
}

export default Register;
