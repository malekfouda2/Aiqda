import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  BRAND_NAMES,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLocalizedValue,
  localizeBrandName,
  translations,
} from './translations';

const LocalizationContext = createContext(null);

const LOCALE_CODES = {
  en: 'en-US',
  ar: 'ar-SA',
};

const getNestedValue = (source, key) => key.split('.').reduce(
  (current, segment) => (current && current[segment] !== undefined ? current[segment] : undefined),
  source
);

const detectInitialLocale = () => {
  const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (storedLocale === 'en' || storedLocale === 'ar') {
    return storedLocale;
  }

  return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : DEFAULT_LOCALE;
};

function LocalizationProvider({ children }) {
  const [locale, setLocale] = useState(detectInitialLocale);
  const isRTL = locale === 'ar';

  useEffect(() => {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.dir = isRTL ? 'rtl' : 'ltr';
    document.body.classList.toggle('locale-rtl', isRTL);
    document.title = BRAND_NAMES[locale];
  }, [isRTL, locale]);

  const value = useMemo(() => {
    const t = (key, fallback = '') => {
      const localized = getNestedValue(translations[locale], key);
      if (typeof localized === 'string') {
        return localizeBrandName(localized, locale);
      }

      const english = getNestedValue(translations[DEFAULT_LOCALE], key);
      if (typeof english === 'string') {
        return localizeBrandName(english, locale);
      }

      return fallback || key;
    };

    const pick = (entry) => getLocalizedValue(entry, locale);

    const formatDate = (valueToFormat, options) => {
      if (!valueToFormat) {
        return '';
      }

      try {
        return new Intl.DateTimeFormat(LOCALE_CODES[locale], options).format(new Date(valueToFormat));
      } catch {
        return String(valueToFormat);
      }
    };

    const formatNumber = (valueToFormat, options) => {
      const numericValue = Number(valueToFormat);
      if (!Number.isFinite(numericValue)) {
        return '';
      }

      return new Intl.NumberFormat(LOCALE_CODES[locale], options).format(numericValue);
    };

    return {
      locale,
      isRTL,
      brandName: BRAND_NAMES[locale],
      setLocale,
      toggleLocale: () => setLocale((current) => (current === 'en' ? 'ar' : 'en')),
      t,
      pick,
      formatDate,
      formatNumber,
      formatRelativeDirection: (ltrValue, rtlValue) => (isRTL ? rtlValue : ltrValue),
    };
  }, [isRTL, locale]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export const useLocale = () => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocale must be used within LocalizationProvider');
  }

  return context;
};

export default LocalizationProvider;
