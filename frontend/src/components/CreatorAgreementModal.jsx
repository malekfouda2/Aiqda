import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

import useBodyScrollLock from '../hooks/useBodyScrollLock';
import {
  CREATOR_AGREEMENT_DISCLAIMER_EFFECTIVE_DATE,
  CREATOR_AGREEMENT_DISCLAIMER_LABEL,
  CREATOR_AGREEMENT_DISCLAIMER_VERSION,
  creatorAgreementDisclaimerParagraphs,
} from '../content/creatorTerms';
import { useLocale } from '../i18n/useLocale';

function CreatorAgreementModal({ open, onConfirm, onCancel, isSubmitting = false }) {
  const { pick, t, isRTL } = useLocale();
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onCancel, open]);

  const handleConfirm = async () => {
    if (isSubmitting) {
      return;
    }

    await onConfirm();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="app-modal-shell z-[75] items-start overflow-y-auto px-2 py-2 sm:items-center sm:px-4 sm:py-6"
          onClick={() => {
            if (!isSubmitting) {
              onCancel();
            }
          }}
        >
          <div className="app-modal-backdrop" />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="app-modal-panel flex max-w-3xl flex-col overflow-hidden rounded-[1.75rem] sm:rounded-[2rem] max-h-[calc(100dvh-1rem)] sm:max-h-[min(calc(100dvh-3rem),840px)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative shrink-0 border-b border-gray-100 bg-gradient-to-br from-primary-50/80 via-white to-cyan-50/60 px-4 pb-4 pt-4 sm:px-8 sm:pb-6 sm:pt-8">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                aria-label={t('common.close', 'Close')}
                className={`absolute top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-500 transition-colors hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60 sm:top-6 ${isRTL ? 'left-4 sm:left-6' : 'right-4 sm:right-6'}`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-2 sm:px-4">
                <span className="h-2 w-2 rounded-full bg-brand-teal animate-pulse" />
                <span className="text-sm text-gray-600">{isRTL ? 'إقرار صانع المحتوى' : 'Creator Agreement'}</span>
              </div>

              <div className="mt-4 flex flex-col gap-4 lg:mt-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 sm:text-4xl">
                    {isRTL ? (
                      <>
                        <span className="gradient-text text-glow">صانع المحتوى</span> إقرار
                      </>
                    ) : (
                      <>
                        Creator <span className="gradient-text text-glow">Acknowledgement</span>
                      </>
                    )}
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-8 text-gray-500 sm:leading-relaxed">
                    {isRTL
                      ? 'هذا الإقرار مطلوب قبل أن نتمكن من قبول طلبك كصانع محتوى.'
                      : 'This acknowledgement is required before we can accept your creator application.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 text-sm text-gray-500 sm:self-start lg:self-auto">
                  <p>
                    <span className="font-semibold text-gray-700">{t('common.reference')}:</span> {CREATOR_AGREEMENT_DISCLAIMER_VERSION}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">{t('common.effectiveDate')}:</span> {pick(CREATOR_AGREEMENT_DISCLAIMER_EFFECTIVE_DATE)}
                  </p>
                </div>
              </div>
            </div>

            <div className="app-modal-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
              <div className="space-y-4">
                {creatorAgreementDisclaimerParagraphs.map((paragraph, index) => (
                  <p key={`creator-disclaimer-${index}`} className="text-gray-600 leading-8">
                    {pick(paragraph)}
                  </p>
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-gray-200 bg-gray-50 p-4 sm:mt-8 sm:p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-400">
                  {t('common.relatedLinks')}
                </h3>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/terms-and-conditions-for-creators"
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-primary-200 hover:text-gray-900"
                  >
                    {t('policies.creatorTerms')}
                  </Link>
                  <Link
                    to="/contact-us"
                    className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-primary-200 hover:text-gray-900"
                  >
                    {t('common.contactUs')}
                  </Link>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] sm:px-8 sm:py-6">
              <p className="text-sm leading-relaxed text-gray-500">
                {isRTL ? (
                  <>
                    بالنقر على <span className="font-semibold text-gray-700">{pick(CREATOR_AGREEMENT_DISCLAIMER_LABEL)}</span>، فإنك تؤكد أنك قرأت ووافقت على إقرار صانع المحتوى وعلى الشروط ذات الصلة.
                  </>
                ) : (
                  <>
                    By clicking <span className="font-semibold text-gray-700">{pick(CREATOR_AGREEMENT_DISCLAIMER_LABEL)}</span>, you confirm that you have read and accepted the creator agreement disclaimer and the related creator terms.
                  </>
                )}
              </p>

              <div className="mt-4 flex flex-col-reverse gap-3 sm:mt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="btn-secondary w-full justify-center sm:w-auto"
                >
                  {t('common.back')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="btn-primary w-full sm:min-w-[220px] sm:w-auto justify-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? t('common.submitting') : pick(CREATOR_AGREEMENT_DISCLAIMER_LABEL)}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default CreatorAgreementModal;
