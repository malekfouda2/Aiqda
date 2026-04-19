import { useLocale } from '../i18n/useLocale';

function LanguageToggle({ className = '' }) {
  const { locale, toggleLocale, t } = useLocale();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className={`inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-primary-200 hover:text-gray-900 ${className}`.trim()}
      aria-label={t('locale.switchLanguage')}
    >
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">
        {t('locale.short')}
      </span>
      <span>{locale === 'en' ? t('locale.arabic') : t('locale.english')}</span>
    </button>
  );
}

export default LanguageToggle;

