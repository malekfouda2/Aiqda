import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

import { whatsappSettingsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { useLocale } from '../i18n/useLocale';
import { pageVariants, fadeInUp } from '../utils/animations';

const emptyForm = {
  isEnabled: false,
  englishNumber: '',
  arabicNumber: '',
};

function AdminWhatsAppSettings() {
  const { locale, isRTL } = useLocale();
  const { showError, showSuccess } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let ignore = false;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        const response = await whatsappSettingsAPI.getAdmin();
        if (!ignore) {
          setForm({
            isEnabled: Boolean(response.data.isEnabled),
            englishNumber: response.data.englishNumber || '',
            arabicNumber: response.data.arabicNumber || '',
          });
        }
      } catch (error) {
        if (!ignore) {
          showError(error.response?.data?.error || (locale === 'ar' ? 'تعذر تحميل إعدادات واتساب' : 'Failed to load WhatsApp settings'));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchSettings();

    return () => {
      ignore = true;
    };
  }, [locale, showError]);

  const configuredLanguages = useMemo(
    () => [form.englishNumber, form.arabicNumber].filter(Boolean).length,
    [form.arabicNumber, form.englishNumber]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await whatsappSettingsAPI.update(form);
      setForm({
        isEnabled: Boolean(response.data.isEnabled),
        englishNumber: response.data.englishNumber || '',
        arabicNumber: response.data.arabicNumber || '',
      });
      showSuccess(locale === 'ar' ? 'تم حفظ إعدادات واتساب بنجاح' : 'WhatsApp settings saved successfully');
    } catch (error) {
      showError(error.response?.data?.error || (locale === 'ar' ? 'تعذر حفظ إعدادات واتساب' : 'Failed to save WhatsApp settings'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" text={locale === 'ar' ? 'جارٍ تحميل إعدادات واتساب...' : 'Loading WhatsApp settings...'} />
      </div>
    );
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === 'ar' ? 'إعدادات واتساب' : 'WhatsApp Settings'}
          </h1>
          <p className="mt-2 text-gray-500">
            {locale === 'ar'
              ? 'تحكم في زر واتساب العائم والأرقام المستخدمة للدردشة الإنجليزية والعربية.'
              : 'Control the floating WhatsApp button and the numbers used for English and Arabic chats.'}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-green-600">
              {locale === 'ar' ? 'الحالة' : 'Status'}
            </p>
            <p className="mt-2 text-lg font-semibold text-gray-900">
              {form.isEnabled
                ? (locale === 'ar' ? 'مفعّل' : 'Enabled')
                : (locale === 'ar' ? 'معطّل' : 'Disabled')}
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600">
              {locale === 'ar' ? 'اللغات المهيأة' : 'Configured Languages'}
            </p>
            <p className="mt-2 text-lg font-semibold text-gray-900">{configuredLanguages}/2</p>
          </div>
        </div>
      </motion.div>

      <motion.form
        variants={fadeInUp}
        onSubmit={handleSubmit}
        className="card max-w-3xl space-y-6"
      >
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className={`flex items-start justify-between gap-4 ${isRTL ? 'flex-row-reverse text-right' : ''}`}>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {locale === 'ar' ? 'إظهار الزر العائم' : 'Show Floating Button'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {locale === 'ar'
                  ? 'عند تفعيل هذا الخيار، سيظهر زر واتساب العائم للمستخدمين على الواجهة العامة ولوحة الأعضاء.'
                  : 'When enabled, the floating WhatsApp button appears for users across the public site and member-facing pages.'}
              </p>
            </div>
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                {form.isEnabled
                  ? (locale === 'ar' ? 'مفعّل' : 'Enabled')
                  : (locale === 'ar' ? 'معطّل' : 'Disabled')}
              </span>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, isEnabled: !current.isEnabled }))}
                className={`relative h-8 w-14 rounded-full transition-colors duration-200 ${
                  form.isEnabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
                aria-pressed={form.isEnabled}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    form.isEnabled ? (isRTL ? 'translate-x-1' : 'translate-x-7') : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {locale === 'ar' ? 'رقم واتساب للدردشة الإنجليزية' : 'English Chat WhatsApp Number'}
            </label>
            <input
              type="text"
              value={form.englishNumber}
              onChange={(event) => setForm((current) => ({ ...current, englishNumber: event.target.value }))}
              className="input-field"
              placeholder={locale === 'ar' ? 'مثال: 447700900123' : 'Example: 447700900123'}
            />
            <p className="mt-2 text-xs text-gray-500">
              {locale === 'ar'
                ? 'أدخل الرقم بصيغة دولية، بدون رموز إضافية إذا أمكن.'
                : 'Use the international format with country code.'}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {locale === 'ar' ? 'رقم واتساب للدردشة العربية' : 'Arabic Chat WhatsApp Number'}
            </label>
            <input
              type="text"
              value={form.arabicNumber}
              onChange={(event) => setForm((current) => ({ ...current, arabicNumber: event.target.value }))}
              className="input-field"
              placeholder={locale === 'ar' ? 'مثال: 966500000000' : 'Example: 966500000000'}
            />
            <p className="mt-2 text-xs text-gray-500">
              {locale === 'ar'
                ? 'سيظهر هذا الخيار عندما يختار المستخدم العربية.'
                : 'This will be used when the user chooses Arabic chat.'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4 text-sm text-gray-600">
          <p className="font-semibold text-gray-900">
            {locale === 'ar' ? 'ماذا سيشاهد المستخدم؟' : 'What users will see'}
          </p>
          <p className="mt-2">
            {locale === 'ar'
              ? 'سيظهر زر واتساب عائم. عند الضغط عليه، سيختار المستخدم العربية أو الإنجليزية ثم يتم تحويله مباشرة إلى الرقم المخصص.'
              : 'Users will see a floating WhatsApp button. After clicking it, they can choose English or Arabic and will be redirected to the matching WhatsApp number.'}
          </p>
        </div>

        <div className={`flex flex-col gap-3 sm:flex-row ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving
              ? (locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...')
              : (locale === 'ar' ? 'حفظ إعدادات واتساب' : 'Save WhatsApp Settings')}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

export default AdminWhatsAppSettings;
