import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

import {
  PLATFORM_NOTICE_ACKNOWLEDGEMENTS,
  PLATFORM_NOTICE_ACKNOWLEDGEMENT_LABEL,
  PLATFORM_NOTICE_EFFECTIVE_DATE,
  PLATFORM_NOTICE_PARAGRAPHS,
  PLATFORM_NOTICE_VERSION,
} from '../content/platformNotice';
import { useLocale } from '../i18n/useLocale';

function PlatformNoticeModal({
  open,
  onAccept,
  onDecline,
  isSubmitting = false,
  acceptLabel = 'Continue',
  declineLabel = 'Logout',
  title = 'Please Review These Terms',
  subtitle = 'This acknowledgement is required at account creation and before first purchase or content access.',
  badgeLabel = 'Mandatory Terms Acceptance',
  confirmSummary = 'By continuing, you confirm that you have read and accepted the Terms & Conditions For Users and the related policies listed below.',
}) {
  const { pick, t, isRTL } = useLocale();
  useBodyScrollLock(open);
  const [confirmed, setConfirmed] = useState(false);

  const relatedPolicies = useMemo(
    () => [
      { to: '/privacy-policy', label: t('policies.privacyPolicy') },
      { to: '/user-content-access-policy', label: t('policies.accessPolicy') },
      { to: '/terms-and-conditions-for-users', label: t('policies.userTerms') },
      { to: '/refund-policy', label: t('policies.refundPolicy') },
    ],
    [t]
  );

  useEffect(() => {
    if (open) {
      setConfirmed(false);
    }
  }, [open]);

  const handleAccept = async () => {
    if (isSubmitting || !confirmed) {
      return;
    }

    await onAccept();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="app-modal-shell z-[70] items-start sm:items-center overflow-y-auto px-3 py-3 sm:px-4 sm:py-6"
        >
          <div className="app-modal-backdrop" />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="app-modal-panel flex max-w-4xl flex-col overflow-hidden rounded-[2rem] h-[min(92vh,860px)]"
          >
            <div className="shrink-0 border-b border-gray-100 bg-gradient-to-br from-primary-50/80 via-white to-cyan-50/60 px-5 pb-5 pt-5 sm:px-8 sm:pb-6 sm:pt-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-5">
                <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
                <span className="text-sm text-gray-600">{badgeLabel}</span>
              </div>
              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
                    {typeof title === 'string' ? title : pick(title)}
                  </h2>
                  <p className="text-gray-500 leading-relaxed max-w-3xl">
                    {typeof subtitle === 'string' ? subtitle : pick(subtitle)}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 text-sm text-gray-500">
                  <p><span className="font-semibold text-gray-700">{t('common.reference')}:</span> {PLATFORM_NOTICE_VERSION}</p>
                  <p><span className="font-semibold text-gray-700">{t('common.effectiveDate')}:</span> {pick(PLATFORM_NOTICE_EFFECTIVE_DATE)}</p>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-b border-primary-100/70 bg-primary-50/60 px-5 py-3 sm:px-8">
              <p className="text-sm font-medium text-primary-800">
                {isRTL
                  ? 'يرجى مراجعة الشروط أدناه، ثم تحديد مربع الإقرار والمتابعة.'
                  : 'Review the terms below, check the acknowledgement box, then continue.'}
              </p>
            </div>

            <div className="app-modal-scroll min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8 space-y-8">
              <div className="space-y-4">
                {PLATFORM_NOTICE_PARAGRAPHS.map((paragraph, index) => (
                  <p key={`platform-notice-paragraph-${index}`} className="text-gray-600 leading-8">
                    {pick(paragraph)}
                  </p>
                ))}
              </div>

              <div className="rounded-3xl border border-primary-100 bg-primary-50/60 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {isRTL ? 'بمتابعتك، فإنك تقر وتوافق صراحة على ما يلي:' : 'By proceeding, you expressly acknowledge and agree that:'}
                </h3>
                <div className="space-y-3">
                  {PLATFORM_NOTICE_ACKNOWLEDGEMENTS.map((item, index) => (
                    <div key={`platform-notice-item-${index}`} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-primary-200 text-xs font-semibold text-primary-600">
                        {index + 1}
                      </span>
                      <p className="text-sm text-gray-600 leading-7">{pick(item)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
                <h3 className="text-sm font-semibold tracking-[0.2em] uppercase text-gray-400 mb-4">
                  {t('common.relatedPolicies')}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {relatedPolicies.map((policy) => (
                    <Link
                      key={policy.to}
                      to={policy.to}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:border-primary-200 transition-colors"
                    >
                      {policy.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] sm:px-8 sm:py-6">
              <p className="text-sm text-gray-500 leading-relaxed">
                {typeof confirmSummary === 'string' ? confirmSummary : pick(confirmSummary)}
              </p>

              <label className="mt-4 flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm leading-7 text-gray-600">
                  {pick(PLATFORM_NOTICE_ACKNOWLEDGEMENT_LABEL)}
                </span>
              </label>

              <div className="mt-4 flex flex-col-reverse gap-3 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={onDecline}
                  className="btn-secondary justify-center"
                  disabled={isSubmitting}
                >
                  {typeof declineLabel === 'string' ? declineLabel : pick(declineLabel)}
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isSubmitting || !confirmed}
                  className="btn-primary min-w-[180px] justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? t('common.saving') : (typeof acceptLabel === 'string' ? acceptLabel : pick(acceptLabel))}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PlatformNoticeModal;
