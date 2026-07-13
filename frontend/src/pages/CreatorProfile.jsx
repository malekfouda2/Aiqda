import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usersAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';
import { pageVariants, fadeInUp, staggerContainer, cardVariants } from '../utils/animations';

function CreatorProfile() {
  const { locale, isRTL } = useLocale();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const response = await usersAPI.getCreatorPublic(id);
        if (active) setData(response.data);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ التحميل...' : 'Loading...'} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="max-w-3xl mx-auto py-20 text-center">
        <p className="text-gray-500">{isRTL ? 'صانع المحتوى غير موجود' : 'Creator not found'}</p>
        <Link to="/chapters" className="text-primary-600 hover:underline mt-4 inline-block">
          {isRTL ? 'تصفّح الفصول' : 'Browse chapters'}
        </Link>
      </div>
    );
  }

  const { creator, chapters } = data;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="max-w-5xl mx-auto">
      <motion.div variants={fadeInUp} className="card mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-100 to-cyan-100 flex items-center justify-center border border-primary-200 text-xl font-bold text-primary-600 overflow-hidden">
            {creator.avatar ? (
              <img src={creator.avatar} alt={creator.name} className="w-full h-full object-cover" />
            ) : (
              creator.name?.charAt(0)?.toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{creator.name}</h1>
            <p className="text-sm text-gray-500">{isRTL ? 'صانع محتوى' : 'Creator'}</p>
          </div>
        </div>

        {creator.teaserVideo && (
          <video
            src={creator.teaserVideo}
            controls
            playsInline
            className="w-full rounded-xl border border-gray-100 bg-black"
          />
        )}
      </motion.div>

      <motion.h2 variants={fadeInUp} className="text-xl font-semibold text-gray-900 mb-4">
        {isRTL ? 'فصول هذا الصانع' : 'Chapters by this creator'}
      </motion.h2>

      {chapters.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          {isRTL ? 'لا توجد فصول منشورة بعد' : 'No published chapters yet'}
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((chapter) => (
            <motion.div key={chapter._id} variants={cardVariants}>
              <Link to={`/chapters/${chapter._id}`} className="card block hover:shadow-lg transition-shadow h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center border border-primary-100">
                    <span className="text-lg">📚</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 line-clamp-2">{getLocalizedField(chapter, 'title', locale)}</h3>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{getLocalizedField(chapter, 'description', locale)}</p>
                {(chapter.software || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {chapter.software.map((tag) => (
                      <span key={tag} className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        🛠 {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export default CreatorProfile;
