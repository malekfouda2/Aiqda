import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

import { whatsappSettingsAPI } from '../services/api';
import { useLocale } from '../i18n/useLocale';

const buildWhatsAppLink = (number) => `https://wa.me/${number}`;

function WhatsAppIcon({ className = 'w-6 h-6' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.11 17.21c-.29-.15-1.72-.85-1.98-.95-.26-.1-.45-.15-.65.14-.19.29-.74.95-.91 1.15-.17.19-.34.22-.63.07-.29-.14-1.2-.44-2.29-1.4-.85-.76-1.43-1.7-1.59-1.99-.17-.29-.02-.45.12-.6.13-.13.29-.34.43-.51.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.15-.65-1.57-.89-2.15-.23-.56-.47-.48-.65-.49l-.55-.01c-.19 0-.49.07-.75.36-.26.29-1 1-.99 2.43 0 1.43 1.04 2.8 1.19 3 .14.19 2.05 3.14 4.97 4.4.69.3 1.24.48 1.66.61.7.22 1.34.19 1.85.12.56-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.27-.19-.56-.34Z"
      />
      <path
        fill="currentColor"
        d="M27.39 4.57A15.85 15.85 0 0 0 16.1 0C7.35 0 .22 7.13.22 15.89c0 2.8.73 5.54 2.1 7.95L0 32l8.4-2.2a15.78 15.78 0 0 0 7.69 1.96h.01c8.75 0 15.88-7.13 15.89-15.89A15.79 15.79 0 0 0 27.39 4.57ZM16.1 29.08h-.01a13.16 13.16 0 0 1-6.71-1.84l-.48-.29-4.99 1.31 1.33-4.86-.31-.5a13.19 13.19 0 0 1-2.03-7.01c0-7.27 5.92-13.19 13.2-13.19a13.1 13.1 0 0 1 9.34 3.87 13.09 13.09 0 0 1 3.86 9.33c0 7.27-5.92 13.18-13.2 13.18Z"
      />
    </svg>
  );
}

function WhatsAppButton() {
  const location = useLocation();
  const { locale, isRTL } = useLocale();
  const [settings, setSettings] = useState(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    const loadSettings = async () => {
      try {
        const response = await whatsappSettingsAPI.getPublic();
        if (!ignore) {
          setSettings(response.data);
        }
      } catch (error) {
        if (!ignore) {
          setSettings({ isEnabled: false, englishNumber: '', arabicNumber: '' });
        }
      }
    };

    loadSettings();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  const choices = useMemo(() => {
    if (!settings) {
      return [];
    }

    return [
      settings.englishNumber
        ? {
            key: 'en',
            label: 'English',
            helper: locale === 'ar' ? 'الدردشة باللغة الإنجليزية' : 'Chat in English',
            href: buildWhatsAppLink(settings.englishNumber),
          }
        : null,
      settings.arabicNumber
        ? {
            key: 'ar',
            label: 'العربية',
            helper: locale === 'ar' ? 'الدردشة باللغة العربية' : 'Chat in Arabic',
            href: buildWhatsAppLink(settings.arabicNumber),
          }
        : null,
    ].filter(Boolean);
  }, [locale, settings]);

  const shouldHide = location.pathname.startsWith('/development/');
  const isEnabled = settings?.isEnabled && choices.length > 0;

  if (shouldHide || !isEnabled) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-4 z-40 sm:bottom-6 ${isRTL ? 'left-4 sm:left-6' : 'right-4 sm:right-6'}`}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            dir={isRTL ? 'rtl' : 'ltr'}
            className={`mb-3 w-[min(20rem,calc(100vw-2rem))] rounded-3xl border border-green-100 bg-white p-4 shadow-2xl shadow-green-900/10 ${
              isRTL ? 'text-right' : 'text-left'
            }`}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-600">
                  WhatsApp
                </p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">
                  {locale === 'ar' ? 'اختر لغة المحادثة' : 'Choose your chat language'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {locale === 'ar'
                    ? 'سيتم تحويلك إلى محادثة واتساب المناسبة مباشرة.'
                    : 'You will be redirected to the matching WhatsApp chat.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              {choices.map((choice) => (
                <a
                  key={choice.key}
                  href={choice.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 transition-all duration-200 hover:border-green-200 hover:bg-green-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{choice.label}</p>
                    <p className="text-xs text-gray-500">{choice.helper}</p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-500 text-white shadow-lg shadow-green-500/20">
                    <WhatsAppIcon className="h-5 w-5" />
                  </div>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((current) => !current)}
        whileTap={{ scale: 0.96 }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl shadow-green-600/30 transition-transform duration-200 hover:scale-[1.03]"
        aria-label={locale === 'ar' ? 'فتح محادثة واتساب' : 'Open WhatsApp chat'}
      >
        <WhatsAppIcon className="h-8 w-8" />
      </motion.button>
    </div>
  );
}

export default WhatsAppButton;
