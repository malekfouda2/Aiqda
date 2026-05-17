import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { coursesAPI, subscriptionsAPI, analyticsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { getLocalizedField } from '../i18n/translations';
import { useLocale } from '../i18n/useLocale';

const rewardIconMap = {
  Spark: '✨',
  Focus: '🎯',
  Flag: '🏁',
  Bolt: '⚡',
  Target: '👁️',
  Compass: '🧭',
};
const rewardLevelLabels = {
  Explorer: { en: 'Explorer', ar: 'المستكشف' },
  'Momentum Builder': { en: 'Momentum Builder', ar: 'صانع الزخم' },
  'Skill Climber': { en: 'Skill Climber', ar: 'متسلق المهارات' },
  'Chapter Challenger': { en: 'Chapter Challenger', ar: 'متحدي الفصول' },
  'Creative Force': { en: 'Creative Force', ar: 'القوة الإبداعية' },
  'Aiqda Trailblazer': { en: 'Aiqda Trailblazer', ar: 'رائد اقدع' },
};
const rewardBadgeCopy = {
  'first-step': {
    title: { en: 'First Step', ar: 'الخطوة الأولى' },
    description: { en: 'Start your first content item.', ar: 'ابدأ أول محتوى لك.' },
  },
  'qualified-trio': {
    title: { en: 'Qualified Trio', ar: 'ثلاثية الإنجاز' },
    description: { en: 'Qualify 3 content items.', ar: 'أكمل 3 محتويات بنجاح.' },
  },
  'chapter-finisher': {
    title: { en: 'Chapter Finisher', ar: 'منهي الفصل' },
    description: { en: 'Complete your first chapter.', ar: 'أكمل أول فصل لك.' },
  },
  'momentum-mode': {
    title: { en: 'Momentum Mode', ar: 'وضع الزخم' },
    description: { en: 'Stay active across 3 content items in the last 14 days.', ar: 'كن نشطًا في 3 محتويات خلال آخر 14 يومًا.' },
  },
  'watch-master': {
    title: { en: 'Watch Master', ar: 'سيد المشاهدة' },
    description: { en: 'Maintain an 85% average watch rate.', ar: 'حافظ على متوسط مشاهدة 85٪.' },
  },
  pathfinder: {
    title: { en: 'Pathfinder', ar: 'مكتشف المسار' },
    description: { en: 'Be enrolled across 3 chapters.', ar: 'سجّل في 3 فصول.' },
  },
};

const getRewardLevelLabel = (title, isRTL) => {
  const labels = rewardLevelLabels[title];
  return labels ? (isRTL ? labels.ar : labels.en) : title;
};

const getRewardBadgeCopy = (badge, isRTL) => {
  const copy = rewardBadgeCopy[badge.id];
  return copy
    ? {
        title: isRTL ? copy.title.ar : copy.title.en,
        description: isRTL ? copy.description.ar : copy.description.en,
      }
    : {
        title: badge.title,
        description: badge.description,
      };
};

const getRewardFeatureMessage = (rewards, isRTL) => {
  if (!rewards) {
    return '';
  }

  if (!rewards.isEligible) {
    return rewards.reason;
  }

  if (rewards.level?.nextLevel) {
    return isRTL
      ? `أنت على بُعد ${rewards.level.pointsToNextLevel} نقطة من مستوى ${getRewardLevelLabel(rewards.level.nextLevel.title, true)}.`
      : `You are ${rewards.level.pointsToNextLevel} points away from ${getRewardLevelLabel(rewards.level.nextLevel.title, false)}.`;
  }

  return isRTL
    ? 'لقد وصلت إلى أعلى مستوى بين الأعضاء. استمر في الحفاظ على الصدارة.'
    : 'You have reached the top member level. Keep leading the way.';
};

const getMilestoneRewardCopy = (milestone, rewards, isRTL) => {
  if (milestone.id === 'next-level') {
    if (!rewards.level?.nextLevel) {
      return isRTL ? 'أنت بالفعل في أعلى فئة.' : 'You are already in the top tier.';
    }

    return isRTL
      ? `${rewards.level.pointsToNextLevel} نقطة تفصلك عن ${getRewardLevelLabel(rewards.level.nextLevel.title, true)}`
      : `${rewards.level.pointsToNextLevel} points away from ${getRewardLevelLabel(rewards.level.nextLevel.title, false)}`;
  }

  if (milestone.id === 'qualified-content') {
    const remaining = Math.max(milestone.target - milestone.current, 0);
    return remaining > 0
      ? (isRTL ? `أكمل ${remaining} محتوى إضافي لفتح الإنجاز التالي.` : `Qualify ${remaining} more content items to unlock the next milestone.`)
      : (isRTL ? 'تم الوصول إلى هدف المحتوى الحالي.' : 'This content milestone is already reached.');
  }

  if (milestone.id === 'completed-chapters') {
    const remaining = Math.max(milestone.target - milestone.current, 0);
    return remaining > 0
      ? (isRTL ? `أكمل ${remaining} فصل إضافي لفتح الإنجاز التالي.` : `Complete ${remaining} more chapters to unlock the next milestone.`)
      : (isRTL ? 'تم الوصول إلى هدف الفصول الحالي.' : 'This chapter milestone is already reached.');
  }

  return milestone.reward;
};

function Dashboard() {
  const { formatDate, isRTL, locale } = useLocale();
  const { user } = useAuthStore();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progressLoading, setProgressLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setLoading(true);
      setProgressLoading(true);

      try {
        const [coursesResult, subscriptionResult] = await Promise.allSettled([
          coursesAPI.getEnrolled(),
          subscriptionsAPI.getActiveSubscription(),
        ]);

        if (!active) {
          return;
        }

        if (coursesResult.status === 'fulfilled') {
          setEnrolledCourses(coursesResult.value.data);
        } else {
          console.error('Failed to fetch enrolled chapters:', coursesResult.reason);
          setEnrolledCourses([]);
        }

        if (subscriptionResult.status === 'fulfilled') {
          setSubscription(subscriptionResult.value.data);
        } else {
          console.error('Failed to fetch active subscription:', subscriptionResult.reason);
          setSubscription(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }

      try {
        const progressRes = await analyticsAPI.getStudentProgress();
        if (active) {
          setProgress(progressRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard progress:', error);
        if (active) {
          setProgress(null);
        }
      } finally {
        if (active) {
          setProgressLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ تحميل لوحة التحكم...' : 'Loading dashboard...'} />
      </div>
    );
  }

  const quickLinks = [
    { to: '/dashboard/subscription', icon: '💳', label: isRTL ? 'الاشتراك' : 'Subscription' },
    { to: '/dashboard/payments', icon: '📝', label: isRTL ? 'سجل المدفوعات' : 'Payment History' },
    { to: '/chapters', icon: '🔍', label: isRTL ? 'تصفح الفصول' : 'Browse Chapters' },
  ];
  const continueLearningEntry = progress?.recentActivity?.find((activity) => !activity.isQualified && activity.lesson?._id)
    || progress?.recentActivity?.find((activity) => activity.lesson?._id)
    || null;
  const rewards = progress?.rewards || null;
  const rewardBadges = rewards?.badges || [];
  const eligibleLeaderboard = rewards?.leaderboard || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
          <div className="mb-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4"
            >
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500">{isRTL ? 'لوحة العضو' : 'Member Dashboard'}</span>
            </motion.div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {isRTL ? 'مرحبًا بعودتك، ' : 'Welcome back, '}<span className="gradient-text">{user?.name}</span>
            </h1>
            <p className="text-gray-500 text-lg">{isRTL ? 'تابع رحلة تطويرك' : 'Continue your development journey'}</p>
          </div>

          {!progressLoading && continueLearningEntry && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="card mb-8 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500/8 via-white to-cyan-500/8 pointer-events-none" />
              <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-primary-100 text-xs text-primary-500 font-medium mb-4">
                    <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                    {isRTL ? 'تابع من حيث توقفت' : 'Pick Up Where You Left Off'}
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                    {getLocalizedField(continueLearningEntry.lesson, 'title', locale)}
                  </h2>
                  <p className="text-gray-500 mb-4">
                    {isRTL ? 'ضمن فصل' : 'Inside'}{' '}
                    <span className="font-medium text-gray-700">
                      {getLocalizedField(continueLearningEntry.course, 'title', locale)}
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
                      {continueLearningEntry.watchPercentage}% {isRTL ? 'تمت مشاهدته' : 'watched'}
                    </span>
                    {continueLearningEntry.isQualified && (
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                        {isRTL ? 'مكتمل' : 'Completed'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to={`/development/${continueLearningEntry.lesson._id}`}
                    className="btn-primary justify-center"
                  >
                    {continueLearningEntry.isQualified
                      ? (isRTL ? 'راجع المحتوى ←' : 'Review Content →')
                      : (isRTL ? 'تابع التطوير ←' : 'Continue Development →')}
                  </Link>
                  <Link
                    to={`/chapters/${continueLearningEntry.course?._id}`}
                    className="btn-secondary justify-center"
                  >
                    {isRTL ? 'افتح الفصل' : 'Open Chapter'}
                  </Link>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid lg:grid-cols-3 gap-6 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="stat-card group"
            >
              <div className="flex items-center gap-4">
                <div className="icon-box icon-box-primary transition-transform duration-300 group-hover:scale-110">
                  <span>📚</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{enrolledCourses.length}</p>
                  <p className="text-gray-500 text-sm">{isRTL ? 'الفصول المسجلة' : 'Enrolled Chapters'}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="stat-card group"
            >
              <div className="flex items-center gap-4">
                <div className="icon-box icon-box-success transition-transform duration-300 group-hover:scale-110">
                  <span>✅</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{progressLoading ? '…' : (progress?.stats?.completedCourses || 0)}</p>
                  <p className="text-gray-500 text-sm">{isRTL ? 'الفصول المكتملة' : 'Completed Chapters'}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="stat-card group"
            >
              <div className="flex items-center gap-4">
                <div className="icon-box icon-box-accent transition-transform duration-300 group-hover:scale-110">
                  <span>🎯</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{progressLoading ? '…' : (progress?.stats?.totalLessonsCompleted || 0)}</p>
                  <p className="text-gray-500 text-sm">{isRTL ? 'المحتويات المكتملة' : 'Contents Completed'}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {!progressLoading && rewards && (
            <div className="grid xl:grid-cols-[1.35fr_0.95fr] gap-6 mb-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="card relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.11),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.12),transparent_34%)] pointer-events-none" />
                <div className="relative">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-primary-100 text-xs text-primary-500 font-medium mb-4">
                        <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
                        {isRTL ? 'نظام التقدم والتحفيز' : 'Member Momentum'}
                      </div>
                      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                        {rewards.isEligible
                          ? (isRTL ? 'كل خطوة الآن تكسبك نقاطًا ومكانة' : 'Every step now earns momentum')
                          : (isRTL ? 'افتح التصنيف والمكافآت' : 'Unlock rankings and rewards')}
                      </h2>
                      <p className="text-gray-500 max-w-2xl">
                        {getRewardFeatureMessage(rewards, isRTL) || (isRTL ? 'حافظ على تقدمك لتصعد في الترتيب بين الأعضاء.' : 'Keep progressing to climb the member leaderboard.')}
                      </p>
                    </div>

                    {rewards.rank ? (
                      <div className="rounded-2xl bg-slate-950 text-white px-5 py-4 min-w-[220px] shadow-lg shadow-slate-900/10">
                        <p className="text-xs uppercase tracking-[0.3em] text-white/60 mb-2">
                          {isRTL ? 'ترتيبك الحالي' : 'Your Standing'}
                        </p>
                        <p className="text-3xl font-bold">
                          #{rewards.rank.position}
                        </p>
                        <p className="text-sm text-white/70 mt-1">
                          {isRTL
                            ? `من بين ${rewards.rank.totalEligibleMembers} عضوًا مؤهلًا`
                            : `of ${rewards.rank.totalEligibleMembers} eligible members`}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-gray-200 bg-white/80 px-5 py-4 min-w-[220px]">
                        <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-2">
                          {isRTL ? 'الحالة' : 'Status'}
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          {rewards.isEligible
                            ? (isRTL ? 'جارٍ حساب الترتيب' : 'Ranking in progress')
                            : (isRTL ? 'غير مؤهل بعد' : 'Not eligible yet')}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {rewards.reason || (isRTL ? 'سيظهر ترتيبك بعد استيفاء الشروط.' : 'Your ranking appears once you qualify.')}
                        </p>
                      </div>
                    )}
                  </div>

                  {rewards.isEligible ? (
                    <>
                      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6 mb-6">
                        <div className="rounded-3xl bg-slate-950 text-white p-6 shadow-xl shadow-slate-900/10">
                          <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                            <div>
                              <p className="text-xs uppercase tracking-[0.35em] text-white/55 mb-2">
                                {isRTL ? 'إجمالي النقاط' : 'Reward Points'}
                              </p>
                              <p className="text-5xl font-bold leading-none">{rewards.points}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs uppercase tracking-[0.35em] text-white/55 mb-2">
                                {isRTL ? 'مستواك الحالي' : 'Current Level'}
                              </p>
                              <p className="text-xl font-semibold">{getRewardLevelLabel(rewards.level.title, isRTL)}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm text-white/70 mb-2">
                            <span>
                              {isRTL ? 'التقدم للمستوى التالي' : 'Progress to next level'}
                            </span>
                            <span>
                              {rewards.level.nextLevel
                                ? `${rewards.level.pointsToNextLevel} ${isRTL ? 'نقطة متبقية' : 'pts to go'}`
                                : (isRTL ? 'تم بلوغ أعلى مستوى' : 'Top tier reached')}
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary-400 via-brand-teal to-brand-blue transition-all duration-700"
                              style={{ width: `${rewards.level.progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4">
                            <p className="text-xs uppercase tracking-[0.28em] text-gray-400 mb-2">
                              {isRTL ? 'المحتويات المؤهلة' : 'Qualified Content'}
                            </p>
                            <p className="text-3xl font-bold text-gray-900">{rewards.qualifiedContentCount}</p>
                            <p className="text-sm text-gray-500 mt-2">{isRTL ? 'تدفع ترتيبك للأمام' : 'Drives your ranking up'}</p>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4">
                            <p className="text-xs uppercase tracking-[0.28em] text-gray-400 mb-2">
                              {isRTL ? 'الفصول المكتملة' : 'Completed Chapters'}
                            </p>
                            <p className="text-3xl font-bold text-gray-900">{rewards.completedChapterCount}</p>
                            <p className="text-sm text-gray-500 mt-2">{isRTL ? 'تفتح قفزات كبيرة بالنقاط' : 'Unlocks major point boosts'}</p>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4">
                            <p className="text-xs uppercase tracking-[0.28em] text-gray-400 mb-2">
                              {isRTL ? 'متوسط المشاهدة' : 'Average Watch'}
                            </p>
                            <p className="text-3xl font-bold text-gray-900">{rewards.avgWatchPercentage}%</p>
                            <p className="text-sm text-gray-500 mt-2">{isRTL ? 'كلما ارتفع زادت فرص الشارات' : 'Higher rates unlock stronger badges'}</p>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-white/90 p-4">
                            <p className="text-xs uppercase tracking-[0.28em] text-gray-400 mb-2">
                              {isRTL ? 'نشاط آخر 14 يومًا' : 'Active in 14 Days'}
                            </p>
                            <p className="text-3xl font-bold text-gray-900">{rewards.recentlyActiveCount}</p>
                            <p className="text-sm text-gray-500 mt-2">{isRTL ? 'يحافظ على زخمك' : 'Keeps your momentum bonus alive'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
                        <div className="rounded-2xl border border-gray-200 bg-white/85 p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {isRTL ? 'شاراتك الحالية' : 'Unlocked Badges'}
                            </h3>
                            <span className="text-sm text-gray-500">
                              {rewardBadges.filter((badge) => badge.unlocked).length}/{rewardBadges.length}
                            </span>
                          </div>
                          <div className="grid sm:grid-cols-2 gap-3">
                            {rewardBadges.map((badge) => (
                              <div
                                key={badge.id}
                                className={`rounded-2xl border p-4 transition-all duration-300 ${badge.unlocked ? 'border-primary-100 bg-gradient-to-br from-primary-50 to-cyan-50' : 'border-gray-200 bg-gray-50/70 opacity-75'}`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className={`text-2xl ${badge.unlocked ? '' : 'grayscale'}`}>{rewardIconMap[badge.icon] || '🏅'}</span>
                                  <div>
                                    <p className="font-semibold text-gray-900">{getRewardBadgeCopy(badge, isRTL).title}</p>
                                    <p className="text-sm text-gray-500 mt-1">{getRewardBadgeCopy(badge, isRTL).description}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white/85 p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {isRTL ? 'أهدافك التالية' : 'Next Milestones'}
                            </h3>
                            <span className="text-sm text-gray-500">
                              {isRTL ? 'خطوات واضحة' : 'Clear next steps'}
                            </span>
                          </div>
                          <div className="space-y-4">
                            {rewards.milestones.map((milestone) => (
                              <div key={milestone.id} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <p className="font-medium text-gray-900">
                                    {milestone.id === 'next-level'
                                      ? (isRTL ? 'المستوى التالي' : 'Next Level')
                                      : milestone.id === 'qualified-content'
                                        ? (isRTL ? 'تأهيل المحتوى' : 'Qualified Content Goal')
                                        : milestone.id === 'completed-chapters'
                                          ? (isRTL ? 'إكمال الفصول' : 'Chapter Completion Goal')
                                          : milestone.title}
                                  </p>
                                  <span className="text-sm text-gray-500">
                                    {milestone.current}/{milestone.target}
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-white overflow-hidden mb-2">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-primary-500 via-brand-teal to-brand-blue transition-all duration-700"
                                    style={{ width: `${milestone.progressPercentage}%` }}
                                  />
                                </div>
                                <p className="text-sm text-gray-500">{getMilestoneRewardCopy(milestone, rewards, isRTL)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-primary-200 bg-gradient-to-br from-primary-50 via-white to-cyan-50 p-6">
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">
                        {isRTL ? 'أنت قريب من الدخول إلى لوحة الترتيب' : 'You are close to joining the leaderboard'}
                      </h3>
                      <p className="text-gray-500 mb-5 max-w-2xl">
                        {rewards.reason}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        {!subscription ? (
                          <Link to="/dashboard/subscription" className="btn-primary justify-center">
                            {isRTL ? 'فعّل الاشتراك' : 'Activate Subscription'}
                          </Link>
                        ) : (
                          <Link to="/chapters" className="btn-primary justify-center">
                            {isRTL ? 'ابدأ التسجيل في فصل' : 'Enroll in a Chapter'}
                          </Link>
                        )}
                        <Link to="/chapters" className="btn-secondary justify-center">
                          {isRTL ? 'استكشف الفصول' : 'Browse Chapters'}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="card"
              >
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {isRTL ? 'لوحة المتصدرين' : 'Leaderboard'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {isRTL ? 'للأعضاء النشطين والمؤهلين فقط' : 'Only active, enrolled members are ranked here'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-50 to-cyan-50 border border-primary-100 flex items-center justify-center text-2xl">
                    🏆
                  </div>
                </div>

                {eligibleLeaderboard.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center text-gray-500">
                    {isRTL ? 'سيظهر التصنيف بمجرد وجود أعضاء مؤهلين نشطين.' : 'The leaderboard appears once eligible active members are progressing.'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {eligibleLeaderboard.map((entry) => (
                      <div
                        key={entry.userId}
                        className={`rounded-2xl border p-4 transition-all duration-300 ${entry.isCurrentUser ? 'border-primary-200 bg-gradient-to-r from-primary-50 to-cyan-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-semibold ${entry.position === 1 ? 'bg-amber-100 text-amber-700' : entry.position === 2 ? 'bg-slate-100 text-slate-700' : entry.position === 3 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                            #{entry.position}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-900 truncate">{entry.name}</p>
                              {entry.isCurrentUser && (
                                <span className="px-2 py-0.5 rounded-full bg-white border border-primary-200 text-xs text-primary-500">
                                  {isRTL ? 'أنت' : 'You'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {getRewardLevelLabel(entry.level.title, isRTL)} • {entry.completedChapterCount} {isRTL ? 'فصل مكتمل' : 'completed chapters'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">{entry.points}</p>
                            <p className="text-xs text-gray-500">{isRTL ? 'نقطة' : 'points'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {rewards.rank && !eligibleLeaderboard.some((entry) => entry.isCurrentUser) && (
                  <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50/70 p-4">
                    <p className="text-sm font-medium text-primary-600">
                      {isRTL
                        ? `ترتيبك الحالي #${rewards.rank.position} من ${rewards.rank.totalEligibleMembers}`
                        : `Your current rank is #${rewards.rank.position} of ${rewards.rank.totalEligibleMembers}`}
                    </p>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">{isRTL ? 'فصولي' : 'My Chapters'}</h2>
                  <Link to="/chapters" className="text-primary-500 hover:text-primary-600 text-sm font-medium transition-colors">
                    {isRTL ? 'تصفح المزيد ←' : 'Browse More →'}
                  </Link>
                </div>

                {enrolledCourses.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center">
                      <span className="text-4xl">📖</span>
                    </div>
                    <p className="text-gray-500 mb-6">{isRTL ? 'لم تسجّل في أي فصل بعد' : "You haven't enrolled in any chapters yet"}</p>
                    <Link to="/chapters" className="btn-primary">
                      {isRTL ? 'استكشف الفصول' : 'Explore Chapters'}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {enrolledCourses.slice(0, 4).map((course, index) => {
                      const courseProgress = progress?.courseProgress?.find(
                        cp => cp.course?._id === course._id
                      );
                      return (
                        <motion.div
                          key={course._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                        >
                          <Link
                            to={`/chapters/${course._id}`}
                            className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-200 transition-all duration-300 group"
                          >
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center border border-primary-100 group-hover:scale-105 transition-transform duration-300">
                              <span className="text-2xl">🎓</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-gray-900 group-hover:text-primary-500 transition-colors truncate">
                                {getLocalizedField(course, 'title', locale)}
                              </h3>
                              <p className="text-sm text-gray-400">
                                {getLocalizedField(course.instructor, 'name', locale)}
                              </p>
                              <div className="mt-2 progress-bar">
                                <div
                                  className="progress-bar-fill"
                                  style={{ width: `${courseProgress?.progressPercentage || 0}%` }}
                                />
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                                <span>
                                  {Math.round(courseProgress?.progressPercentage || 0) >= 100
                                    ? (isRTL ? 'الفصل مكتمل' : 'Chapter completed')
                                    : (isRTL ? 'افتح الفصل لمتابعة مسارك' : 'Open chapter to continue your path')}
                                </span>
                                <span className="text-primary-500 font-medium">
                                  {isRTL ? 'عرض المسار ←' : 'View Path →'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-bold text-gray-900">
                                {Math.round(courseProgress?.progressPercentage || 0)}%
                              </span>
                            </div>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>

              {!progressLoading && progress?.recentActivity?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="card"
                >
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">{isRTL ? 'النشاط الأخير' : 'Recent Activity'}</h2>
                  <div className="space-y-3">
                    {progress.recentActivity.slice(0, 5).map((activity, index) => (
                      <motion.div
                        key={activity._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 + index * 0.05 }}
                        className="flex items-center gap-4 text-sm p-3 rounded-lg bg-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <div className={`w-3 h-3 rounded-full ${activity.isQualified ? 'bg-emerald-400' : 'bg-primary-500'} shadow-lg ${activity.isQualified ? 'shadow-emerald-400/30' : 'shadow-primary-400/30'}`} />
                        <span className="text-gray-600 flex-1">{activity.lesson?.title}</span>
                        <span className="text-gray-400 font-medium">
                          {activity.watchPercentage}% {isRTL ? 'تمت مشاهدته' : 'watched'}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            <div className="space-y-6">
              {progressLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="card"
                >
                  <div className="flex items-center gap-3">
                    <LoadingSpinner size="sm" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {isRTL ? 'جارٍ تجهيز تقدمك...' : 'Preparing your progress...'}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {isRTL ? 'سيظهر آخر نشاطك والتصنيف خلال لحظات.' : 'Your recent activity and ranking will appear shortly.'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="card"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{isRTL ? 'الاشتراك' : 'Subscription'}</h2>
                {subscription ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-md shadow-emerald-200 animate-pulse" />
                      <span className="text-emerald-600 font-medium">{isRTL ? 'نشط' : 'Active'}</span>
                    </div>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-200 mb-4">
                      <p className="text-gray-900 font-medium mb-1">
                        {subscription.package?.name}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {isRTL ? 'ينتهي في: ' : 'Expires: '}{formatDate(subscription.endDate)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 mb-4">
                      <p className="text-gray-500 text-sm mb-1">{isRTL ? 'لا يوجد اشتراك نشط' : 'No active subscription'}</p>
                      <p className="text-gray-400 text-xs">{isRTL ? 'احصل على الوصول إلى المحتوى المميز' : 'Get access to premium content'}</p>
                    </div>
                    <Link to="/dashboard/subscription" className="btn-primary w-full text-sm justify-center">
                      {isRTL ? 'احصل على اشتراك' : 'Get Subscription'}
                    </Link>
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="card"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{isRTL ? 'روابط سريعة' : 'Quick Links'}</h2>
                <div className="space-y-2">
                  {quickLinks.map((link, index) => (
                    <motion.div
                      key={link.to}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + index * 0.05 }}
                    >
                      <Link
                        to={link.to}
                        className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-primary-200 transition-all duration-300 group"
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">{link.icon}</span>
                        <span className="text-gray-600 group-hover:text-gray-900 transition-colors">{link.label}</span>
                        <span className="ml-auto text-gray-400 group-hover:text-primary-500 transition-colors">{isRTL ? '←' : '→'}</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
    </motion.div>
  );
}

export default Dashboard;
