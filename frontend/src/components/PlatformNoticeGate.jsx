import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import PlatformNoticeModal from './PlatformNoticeModal';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import { useLocale } from '../i18n/useLocale';

const EXCLUDED_PATHS = new Set([
  '/login',
  '/register',
  '/privacy-policy',
  '/terms-and-conditions',
  '/terms-and-conditions-for-creators',
  '/terms-and-conditions-for-users',
  '/refund-policy',
  '/user-content-access-policy',
  '/auth/social/callback',
]);

function PlatformNoticeGate() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, acknowledgePlatformNotice, hasAcceptedCurrentPlatformNotice } = useAuthStore();
  const { showError } = useUIStore();
  const { locale, t } = useLocale();
  const [submitting, setSubmitting] = useState(false);

  const shouldShow = useMemo(() => {
    if (!user) {
      return false;
    }

    if (EXCLUDED_PATHS.has(location.pathname)) {
      return false;
    }

    return !hasAcceptedCurrentPlatformNotice();
  }, [hasAcceptedCurrentPlatformNotice, location.pathname, user]);

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      const result = await acknowledgePlatformNotice();
      if (!result.success) {
        showError(result.error || (locale === 'ar' ? 'فشل حفظ الإقرار' : 'Failed to save your acknowledgement'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <PlatformNoticeModal
      open={shouldShow}
      onAccept={handleAccept}
      onDecline={handleDecline}
      isSubmitting={submitting}
      acceptLabel={t('common.continue')}
      declineLabel={t('common.logout')}
    />
  );
}

export default PlatformNoticeGate;
