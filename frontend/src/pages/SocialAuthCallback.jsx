import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import LoadingSpinner from '../components/LoadingSpinner';
import useAuthStore from '../store/authStore';
import { pageVariants, fadeInUp } from '../utils/animations';

function SocialAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeSocialLogin } = useAuthStore();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const finishSocialLogin = async () => {
      const providerError = searchParams.get('error');
      const loginToken = searchParams.get('token');

      if (providerError) {
        if (!cancelled) {
          setErrorMessage(providerError);
        }
        return;
      }

      if (!loginToken) {
        if (!cancelled) {
          setErrorMessage('Social sign-in could not be completed. Please try again.');
        }
        return;
      }

      const result = await completeSocialLogin(loginToken);
      if (cancelled) {
        return;
      }

      if (result.success) {
        navigate(result.redirectPath || '/dashboard', { replace: true });
        return;
      }

      setErrorMessage(result.error || 'Social sign-in could not be completed. Please try again.');
    };

    finishSocialLogin();

    return () => {
      cancelled = true;
    };
  }, [completeSocialLogin, navigate, searchParams]);

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen flex items-center justify-center px-4 py-16 bg-gray-50 relative overflow-hidden"
    >
      <div className="absolute inset-0 mesh-gradient" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[340px] h-[340px] bg-primary-100/45 top-[-100px] right-[-60px] animate-float" />
        <div className="floating-orb w-[260px] h-[260px] bg-cyan-100/40 bottom-[-60px] left-[-40px] animate-float-slow" />
      </div>

      <motion.div variants={fadeInUp} className="relative w-full max-w-md card text-center">
        {errorMessage ? (
          <div className="space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 3c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3Z" />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Sign-in Couldn&apos;t Finish</h1>
              <p className="text-gray-500 leading-relaxed">{errorMessage}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/login" className="btn-primary flex-1">
                Back to Login
              </Link>
              <Link to="/register" className="btn-secondary flex-1">
                Create Account
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <LoadingSpinner size="lg" text="" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Completing Sign-In</h1>
              <p className="text-gray-500 leading-relaxed">
                We&apos;re confirming your account and sending you back into Aiqda.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default SocialAuthCallback;
