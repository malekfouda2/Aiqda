import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { consultationsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import useAuthStore from '../store/authStore';
import { pageVariants, fadeInUp, staggerContainer, cardVariants } from '../utils/animations';
import { getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';

function Consultations() {
  const { locale, isRTL } = useLocale();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchConsultations();
  }, []);

  const fetchConsultations = async () => {
    try {
      const response = await consultationsAPI.getActive();
      setConsultations(response.data);
    } catch (error) {
      console.error('Failed to fetch consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ تحميل الاستشارات...' : 'Loading consultations...'} />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-30" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[400px] h-[400px] bg-primary-100/40 top-[-100px] left-[-100px] animate-float" />
        <div className="floating-orb w-[300px] h-[300px] bg-cyan-100/40 bottom-[-100px] right-[-50px] animate-float-slow" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={pageVariants}
          initial="hidden"
          animate="visible"
          className="text-center mb-16"
        >
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6"
          >
            <span className="text-lg">✨</span>
            <span className="text-sm text-gray-600 font-medium">{isRTL ? 'خدمات الاستشارة' : 'Consultation Services'}</span>
          </motion.div>

          <motion.h1 
            variants={fadeInUp}
            className="text-5xl font-bold text-gray-900 mb-6"
          >
            {isRTL ? 'استشارات ' : 'Expert '}<span className="gradient-text">{isRTL ? 'احترافية' : 'Consultations'}</span>
          </motion.h1>
          <motion.p 
            variants={fadeInUp}
            className="text-gray-500 max-w-2xl mx-auto text-lg"
          >
            {isRTL ? 'جلسات فردية وجماعية مع محترفين من المجال عبر Zoom' : 'One-on-one and group sessions with industry professionals via Zoom'}
          </motion.p>
        </motion.div>

        {consultations.length === 0 ? (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="text-center py-20"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center border border-primary-100">
              <span className="text-5xl">📅</span>
            </div>
            <h3 className="text-2xl font-semibold text-gray-900 mb-3">{isRTL ? 'لا توجد استشارات متاحة' : 'No consultations available'}</h3>
            <p className="text-gray-500 text-lg">{isRTL ? 'عد قريبًا للاطلاع على المواعيد المتاحة!' : 'Check back soon for available slots!'}</p>
          </motion.div>
        ) : (
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {consultations.map((consultation) => (
              <motion.div
                key={consultation._id}
                variants={cardVariants}
                className="h-full"
              >
                <div className="card h-full flex flex-col group hover:shadow-2xl transition-all duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                      consultation.mode === '1 to 1' 
                        ? 'bg-primary-50 text-primary-600 border border-primary-100' 
                        : 'bg-cyan-50 text-cyan-600 border border-cyan-100'
                    }`}>
                      {consultation.mode === '1 to 1' ? (isRTL ? 'فردي' : consultation.mode) : (isRTL ? 'جماعي' : consultation.mode)}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-gray-50 text-gray-500 text-xs font-semibold border border-gray-100">
                      {consultation.duration}
                    </span>
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-primary-600 transition-colors">
                    {getLocalizedField(consultation, 'title', locale)}
                  </h3>
                  
                  <p className="text-gray-500 text-sm line-clamp-3 mb-6 leading-relaxed">
                    {getLocalizedField(consultation, 'description', locale)}
                  </p>

                  <div className="space-y-3 mb-8 flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{isRTL ? 'نقاط التركيز' : 'Focus Points'}</p>
                    <ul className="space-y-2">
                      {consultation.focusPoints?.slice(0, 4).map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-primary-500 mt-0.5">✓</span>
                          <span>{point}</span>
                        </li>
                      ))}
                      {consultation.focusPoints?.length > 4 && (
                        <li className="text-xs text-gray-400 italic">{isRTL ? '+ نقاط إضافية...' : '+ more points...'}</li>
                      )}
                    </ul>
                  </div>

                  <div className="pt-6 border-t border-gray-100 mt-auto">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold">{isRTL ? 'السعر' : 'Price'}</p>
                        <p className="text-xl font-bold text-gray-900">
                          {consultation.priceType === 'fixed' 
                            ? `${consultation.price} ${consultation.currency}`
                            : (isRTL ? 'حسب الاتفاق' : 'Contract Based')}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/consultations/${consultation._id}`}
                      className={`w-full py-3 px-6 rounded-xl font-bold text-center transition-all duration-300 ${
                        user 
                          ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {user ? (isRTL ? 'احجز الآن ←' : 'Book Now →') : (isRTL ? 'سجّل الدخول للحجز' : 'Login to Book')}
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default Consultations;
