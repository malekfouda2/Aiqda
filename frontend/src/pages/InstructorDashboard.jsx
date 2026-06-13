import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { analyticsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  pageVariants,
  fadeInUp,
  staggerContainer,
  cardVariants,
} from '../utils/animations';
import { useLocale } from '../i18n/useLocale';

const clampPercentage = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

function formatCurrency(value, formatNumber, isRTL) {
  return `${isRTL ? 'ر.س ' : 'SAR '}${formatNumber(Math.round(Number(value) || 0))}`;
}

function SectionHeader({ eyebrow, title, description, align = 'start' }) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      {eyebrow && (
        <span className="inline-flex items-center rounded-full border border-primary-100 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary-500 shadow-sm">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-4 text-2xl font-semibold text-slate-900 sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
    </div>
  );
}

function OverviewCard({ icon, value, label, accent, sublabel }) {
  return (
    <motion.div
      variants={cardVariants}
      className="card relative overflow-hidden border border-slate-100 bg-white shadow-[0_20px_60px_-40px_rgba(15,23,42,0.28)]"
    >
      <div className={`absolute inset-x-6 top-0 h-1 rounded-full bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {sublabel ? <p className="mt-2 text-xs text-slate-400">{sublabel}</p> : null}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-xl shadow-sm ${accent}`}>
          <span className="drop-shadow-sm">{icon}</span>
        </div>
      </div>
    </motion.div>
  );
}

function ChartEmptyState({ message }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

function MetricRing({ label, value, sublabel, percentage, colorClasses }) {
  const progress = clampPercentage(percentage);
  const ringStyle = {
    background: `conic-gradient(${colorClasses.ring} 0deg ${progress * 3.6}deg, rgba(148, 163, 184, 0.14) ${progress * 3.6}deg 360deg)`,
  };

  return (
    <div className="rounded-[26px] border border-slate-100 bg-white/85 p-5 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{sublabel}</p>
        </div>
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full p-2" style={ringStyle}>
          <div className="absolute inset-[10px] rounded-full bg-white shadow-inner" />
          <div className="relative text-center">
            <p className={`text-lg font-bold ${colorClasses.text}`}>{progress}%</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Live</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendChart({ title, description, data, monthLabel, formatNumber, accentLabel, emptyText }) {
  if (!data.length) {
    return (
      <div className="card border border-slate-100 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.32)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">{accentLabel}</span>
        </div>
        <ChartEmptyState message={emptyText} />
      </div>
    );
  }

  const width = 720;
  const height = 260;
  const paddingX = 28;
  const paddingTop = 22;
  const paddingBottom = 38;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingX * 2;
  const maxValue = Math.max(...data.map((entry) => entry.count), 1);
  const gridValues = [0, Math.ceil(maxValue / 2), maxValue].filter((value, index, list) => list.indexOf(value) === index);

  const points = data.map((entry, index) => {
    const x = data.length === 1
      ? width / 2
      : paddingX + (chartWidth / (data.length - 1)) * index;
    const y = paddingTop + chartHeight - ((entry.count / maxValue) * chartHeight);
    return { ...entry, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;

  return (
    <div className="card border border-slate-100 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.32)]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">{accentLabel}</span>
      </div>

      <div className="rounded-[28px] border border-slate-100 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[250px] w-full">
          {gridValues.map((value) => {
            const y = paddingTop + chartHeight - ((value / maxValue) * chartHeight);
            return (
              <g key={value}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(148,163,184,0.16)" strokeDasharray="4 6" />
                <text x={paddingX - 8} y={y + 4} textAnchor="end" fontSize="11" fill="rgba(100,116,139,0.9)">
                  {formatNumber(value)}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#qualifiedViewsArea)" />
          <path
            d={linePath}
            fill="none"
            stroke="url(#qualifiedViewsLine)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point) => (
            <g key={`${point._id.year}-${point._id.month}`}>
              <circle cx={point.x} cy={point.y} r="6.5" fill="#fff" stroke="#ec4899" strokeWidth="3" />
              <text x={point.x} y={point.y - 14} textAnchor="middle" fontSize="11" fontWeight="600" fill="rgba(15,23,42,0.9)">
                {formatNumber(point.count)}
              </text>
              <text x={point.x} y={height - 12} textAnchor="middle" fontSize="11" fill="rgba(100,116,139,0.92)">
                {monthLabel(point)}
              </text>
            </g>
          ))}

          <defs>
            <linearGradient id="qualifiedViewsLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ec4899" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <linearGradient id="qualifiedViewsArea" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(236,72,153,0.24)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0.02)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

function HorizontalBars({ title, description, items, emptyText, formatNumber, isRTL }) {
  if (!items.length) {
    return (
      <div className="card border border-slate-100 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.32)]">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        <div className="mt-6">
          <ChartEmptyState message={emptyText} />
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...items.map((item) => item.estimatedRevenue), 1);

  return (
    <div className="card border border-slate-100 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.32)]">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <div className="mt-6 space-y-4">
        {items.map((item) => {
          const width = Math.max((item.estimatedRevenue / maxValue) * 100, item.estimatedRevenue > 0 ? 7 : 0);
          return (
            <div key={item.courseId} className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatNumber(item.enrolledCount)} {isRTL ? 'عضو' : 'members'} • {formatNumber(item.qualifiedViews)} {isRTL ? 'مشاهدة مؤهلة' : 'qualified views'}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-700">{formatCurrency(item.estimatedRevenue, formatNumber, isRTL)}</p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 via-fuchsia-500 to-cyan-400"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WatchQualityChart({ title, description, items, emptyText, formatNumber, isRTL }) {
  if (!items.length) {
    return (
      <div className="card border border-slate-100 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.32)]">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        <div className="mt-6">
          <ChartEmptyState message={emptyText} />
        </div>
      </div>
    );
  }

  return (
    <div className="card border border-slate-100 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.32)]">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <div className="mt-6 space-y-4">
        {items.map((item) => {
          const watchPercentage = clampPercentage(item.avgWatchPercentage);
          const videoCoverage = item.lessonsCount > 0
            ? clampPercentage((item.videosAssigned / item.lessonsCount) * 100)
            : 0;

          return (
            <div key={item.courseId} className="rounded-[24px] border border-slate-100 bg-slate-50/80 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatNumber(item.enrolledCount)} {isRTL ? 'عضو' : 'members'} • {formatNumber(item.quizPassRate)}% {isRTL ? 'نجاح الاختبارات' : 'quiz pass'}
                  </p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  {formatNumber(item.qualifiedViews)} {isRTL ? 'مؤهل' : 'qualified'}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{isRTL ? 'جودة المشاهدة' : 'Watch quality'}</span>
                    <span className="font-semibold text-slate-700">{watchPercentage}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${watchPercentage}%` }}
                      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{isRTL ? 'جاهزية الفيديو' : 'Video readiness'}</span>
                    <span className="font-semibold text-slate-700">
                      {formatNumber(item.videosAssigned)}/{formatNumber(item.lessonsCount)}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${videoCoverage}%` }}
                      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-pink-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChapterIntelligence({ items, formatNumber, isRTL }) {
  if (!items.length) {
    return (
      <div className="card border border-slate-100 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.32)]">
        <SectionHeader
          eyebrow={isRTL ? 'الفصول' : 'Chapters'}
          title={isRTL ? 'استخبارات الفصول' : 'Chapter Intelligence'}
          description={isRTL ? 'عند إنشاء الفصول ستظهر هنا مؤشرات الأداء المباشرة.' : 'Create a chapter to start seeing live performance breakdowns here.'}
        />
      </div>
    );
  }

  const maxRevenue = Math.max(...items.map((item) => item.estimatedRevenue), 1);

  return (
    <div className="card border border-slate-100 bg-white shadow-[0_24px_70px_-48px_rgba(15,23,42,0.32)]">
      <SectionHeader
        eyebrow={isRTL ? 'الفصول' : 'Chapters'}
        title={isRTL ? 'استخبارات الفصول' : 'Chapter Intelligence'}
        description={isRTL
          ? 'نظرة أعمق على كل فصل من حيث المتابعة، الإيراد، وجاهزية الأصول.'
          : 'A deeper read on every chapter across audience traction, revenue, and asset readiness.'}
      />

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="mt-8 grid gap-5 xl:grid-cols-2">
        {items.map((item) => {
          const revenueStrength = Math.max((item.estimatedRevenue / maxRevenue) * 100, item.estimatedRevenue > 0 ? 8 : 0);
          const watchPercentage = clampPercentage(item.avgWatchPercentage);
          const videoCoverage = item.lessonsCount > 0
            ? clampPercentage((item.videosAssigned / item.lessonsCount) * 100)
            : 0;

          return (
            <motion.div key={item.courseId} variants={cardVariants}>
              <Link
                to={`/chapters/${item.courseId}`}
                className="group block overflow-hidden rounded-[28px] border border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-5 shadow-[0_20px_70px_-50px_rgba(15,23,42,0.35)] transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900 transition-colors group-hover:text-primary-600">{item.title}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {item.isPublished ? (isRTL ? 'منشور' : 'Published') : (isRTL ? 'مسودة' : 'Draft')}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {formatNumber(item.enrolledCount)} {isRTL ? 'عضو' : 'members'} • {formatNumber(item.lessonsCount)} {isRTL ? 'محتوى' : 'contents'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-primary-50 px-3 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-primary-500">{isRTL ? 'الإيراد' : 'Revenue'}</p>
                    <p className="mt-1 text-sm font-semibold text-primary-700">{formatCurrency(item.estimatedRevenue, formatNumber, isRTL)}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">{isRTL ? 'المشاهدات المؤهلة' : 'Qualified Views'}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatNumber(item.qualifiedViews)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">{isRTL ? 'متوسط المشاهدة' : 'Avg Watch'}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatNumber(item.avgWatchPercentage)}%</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">{isRTL ? 'نجاح الاختبارات' : 'Quiz Pass'}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatNumber(item.quizPassRate)}%</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{isRTL ? 'قوة الإيراد' : 'Revenue strength'}</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(item.estimatedRevenue, formatNumber, isRTL)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary-500 via-fuchsia-500 to-cyan-400" style={{ width: `${revenueStrength}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{isRTL ? 'جودة المشاهدة' : 'Watch quality'}</span>
                      <span className="font-semibold text-slate-700">{watchPercentage}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${watchPercentage}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{isRTL ? 'جاهزية الفيديو' : 'Video readiness'}</span>
                      <span className="font-semibold text-slate-700">{formatNumber(item.videosAssigned)}/{formatNumber(item.lessonsCount)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-pink-500" style={{ width: `${videoCoverage}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

function InstructorDashboard() {
  const { isRTL, formatDate, formatNumber } = useLocale();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const analyticsRes = await analyticsAPI.getInstructorAnalytics();
      setAnalytics(analyticsRes.data);
    } catch (error) {
      console.error('Failed to fetch instructor analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthlyTrend = useMemo(() => (
    [...(analytics?.monthlyStats || [])]
      .sort((a, b) => a._id.year - b._id.year || a._id.month - b._id.month)
      .slice(-6)
  ), [analytics]);

  const revenueLeaders = useMemo(() => (
    [...(analytics?.courseStats || [])]
      .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue)
      .slice(0, 6)
  ), [analytics]);

  const watchLeaders = useMemo(() => (
    [...(analytics?.courseStats || [])]
      .sort((a, b) => {
        if (b.avgWatchPercentage !== a.avgWatchPercentage) {
          return b.avgWatchPercentage - a.avgWatchPercentage;
        }

        return b.enrolledCount - a.enrolledCount;
      })
      .slice(0, 6)
  ), [analytics]);

  const stats = useMemo(() => ([
    {
      icon: '📚',
      accent: 'from-primary-400/25 to-fuchsia-400/25',
      value: formatNumber(analytics?.totalCourses || 0),
      label: isRTL ? 'الفصول' : 'Chapters',
      sublabel: `${formatNumber(analytics?.publishedCourses || 0)} ${isRTL ? 'منشور' : 'published'}`,
    },
    {
      icon: '👥',
      accent: 'from-emerald-400/25 to-cyan-400/25',
      value: formatNumber(analytics?.totalStudents || 0),
      label: isRTL ? 'الأعضاء' : 'Members',
      sublabel: `${formatNumber(analytics?.totalQualifiedViews || 0)} ${isRTL ? 'مشاهدة مؤهلة' : 'qualified views'}`,
    },
    {
      icon: '🎬',
      accent: 'from-amber-400/25 to-pink-400/25',
      value: formatNumber(analytics?.totalLessons || 0),
      label: isRTL ? 'المحتويات' : 'Contents',
      sublabel: `${formatNumber(analytics?.videosAssigned || 0)} ${isRTL ? 'فيديو جاهز' : 'video-ready'}`,
    },
    {
      icon: '💰',
      accent: 'from-sky-400/25 to-indigo-400/25',
      value: formatCurrency(analytics?.totalRevenue || 0, formatNumber, isRTL),
      label: isRTL ? 'الإيراد' : 'Revenue',
      sublabel: isRTL ? 'مقدر من الاشتراكات المعتمدة' : 'Estimated from approved subscriptions',
    },
  ]), [analytics, formatNumber, isRTL]);

  const ringMetrics = useMemo(() => {
    const publishRate = analytics?.totalCourses
      ? Math.round(((analytics?.publishedCourses || 0) / analytics.totalCourses) * 100)
      : 0;
    const videoReadiness = analytics?.totalLessons
      ? Math.round(((analytics?.videosAssigned || 0) / analytics.totalLessons) * 100)
      : 0;

    return [
      {
        label: isRTL ? 'متوسط المشاهدة' : 'Average Watch',
        value: `${formatNumber(analytics?.avgWatchPercentage || 0)}%`,
        sublabel: isRTL ? 'متوسط حي عبر تقدم الأعضاء' : 'Live average across member progress',
        percentage: analytics?.avgWatchPercentage || 0,
        colorClasses: { ring: '#06b6d4', text: 'text-cyan-600' },
      },
      {
        label: isRTL ? 'جاهزية الفيديو' : 'Video Readiness',
        value: `${formatNumber(analytics?.videosAssigned || 0)}/${formatNumber(analytics?.totalLessons || 0)}`,
        sublabel: isRTL ? 'المحتويات المرتبطة بفيديوهات حية' : 'Lessons currently wired to live video',
        percentage: videoReadiness,
        colorClasses: { ring: '#f59e0b', text: 'text-amber-600' },
      },
      {
        label: isRTL ? 'نسبة النشر' : 'Publishing Rate',
        value: `${formatNumber(analytics?.publishedCourses || 0)}/${formatNumber(analytics?.totalCourses || 0)}`,
        sublabel: isRTL ? 'الفصول المنشورة مقابل المسودات' : 'Published chapters versus drafts',
        percentage: publishRate,
        colorClasses: { ring: '#ec4899', text: 'text-pink-600' },
      },
      {
        label: isRTL ? 'نجاح الاختبارات' : 'Quiz Pass Rate',
        value: `${formatNumber(analytics?.quizPassRate || 0)}%`,
        sublabel: isRTL ? 'معدل النجاح عبر المحاولات المسجلة' : 'Success rate across recorded attempts',
        percentage: analytics?.quizPassRate || 0,
        colorClasses: { ring: '#6366f1', text: 'text-indigo-600' },
      },
    ];
  }, [analytics, formatNumber, isRTL]);

  const monthLabel = (entry) => {
    const date = new Date(Date.UTC(entry._id.year, entry._id.month - 1, 1));
    return formatDate(date, { month: 'short' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ تحميل تحليلات صانع المحتوى...' : 'Loading creator analytics...'} />
      </div>
    );
  }

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="space-y-8">
      <motion.section variants={fadeInUp} className="relative overflow-hidden rounded-[34px] border border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-8 shadow-[0_30px_90px_-60px_rgba(15,23,42,0.35)] sm:p-10">
        <div className="absolute -right-10 top-8 h-32 w-32 rounded-full bg-primary-100/40 blur-3xl" />
        <div className="absolute -left-6 bottom-0 h-36 w-36 rounded-full bg-cyan-100/50 blur-3xl" />
        <div className="relative">
          <SectionHeader
            eyebrow={isRTL ? 'لوحة المتابعة' : 'Performance Studio'}
            title={isRTL ? 'تحليلات صانع المحتوى' : 'Creator Analytics'}
            description={isRTL
              ? 'لوحة أكثر احترافية لمتابعة الإيراد، الأداء، وجودة المشاهدة عبر فصولك.'
              : 'A more professional view of your revenue, audience traction, and watch quality across every chapter.'}
          />
          {analytics?.revenueCalculation?.methodology ? (
            <p className="mt-4 max-w-3xl text-xs leading-6 text-slate-400">
              {isRTL
                ? 'يتم تقدير الإيراد من المدفوعات الناجحة للاشتراكات، ثم توزيعه بالتساوي على الفصول المضمنة في كل باقة.'
                : 'Revenue is estimated from successful subscription payments allocated evenly across each package\'s included chapters.'}
            </p>
          ) : null}
        </div>
      </motion.section>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <OverviewCard key={stat.label} {...stat} />
        ))}
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-8 xl:grid-cols-[1.35fr_0.95fr]">
        <motion.div variants={cardVariants}>
          <TrendChart
            title={isRTL ? 'اتجاه المشاهدات المؤهلة' : 'Qualified Views Trend'}
            description={isRTL ? 'متابعة شهرية للمشاهدات التي استوفت شروط التقدم في الفصول.' : 'Monthly movement of views that reached your chapter qualification threshold.'}
            data={monthlyTrend}
            monthLabel={monthLabel}
            formatNumber={formatNumber}
            accentLabel={isRTL ? 'آخر 6 أشهر' : 'Last 6 months'}
            emptyText={isRTL ? 'لا توجد مشاهدات مؤهلة كافية بعد لعرض الاتجاه الشهري.' : 'There is not enough qualified view activity yet to show a monthly trend.'}
          />
        </motion.div>

        <motion.div variants={cardVariants} className="card border border-slate-100 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_24px_70px_-48px_rgba(15,23,42,0.32)]">
          <h3 className="text-lg font-semibold text-slate-900">{isRTL ? 'عدادات الصحة العامة' : 'Performance Health'}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {isRTL ? 'مؤشرات سريعة توضح مدى جاهزية مكتبتك ونضج متابعة الأعضاء.' : 'Fast visual indicators for library readiness and audience quality.'}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {ringMetrics.map((metric) => (
              <MetricRing key={metric.label} {...metric} />
            ))}
          </div>
        </motion.div>
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid gap-8 xl:grid-cols-2">
        <motion.div variants={cardVariants}>
          <HorizontalBars
            title={isRTL ? 'الإيراد حسب الفصل' : 'Revenue by Chapter'}
            description={isRTL ? 'أي الفصول تحقق أعلى عائد حاليًا.' : 'See which chapters are driving the strongest current revenue contribution.'}
            items={revenueLeaders}
            emptyText={isRTL ? 'لن يظهر هذا الرسم حتى يتم ربط الفصول بباقة ومدفوعات معتمدة.' : 'This chart will fill in once your chapters are connected to approved package payments.'}
            formatNumber={formatNumber}
            isRTL={isRTL}
          />
        </motion.div>

        <motion.div variants={cardVariants}>
          <WatchQualityChart
            title={isRTL ? 'جودة المتابعة لكل فصل' : 'Watch Quality by Chapter'}
            description={isRTL ? 'مزيج من متوسط المشاهدة، نجاح الاختبارات، وجاهزية الفيديو.' : 'A sharper view of watch depth, quiz success, and video readiness chapter by chapter.'}
            items={watchLeaders}
            emptyText={isRTL ? 'أضف محتوى ومشاهدات أكثر حتى تظهر مؤشرات الجودة هنا.' : 'Add more lesson activity to start seeing chapter watch quality insights here.'}
            formatNumber={formatNumber}
            isRTL={isRTL}
          />
        </motion.div>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <ChapterIntelligence
          items={analytics?.courseStats || []}
          formatNumber={formatNumber}
          isRTL={isRTL}
        />
      </motion.div>
    </motion.div>
  );
}

export default InstructorDashboard;
