const toComparableId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    if (value._id) {
      return value._id.toString();
    }

    if (value.id) {
      return value.id.toString();
    }
  }

  return value.toString();
};

const toTimestamp = (value) => {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const getEntityId = (value) => toComparableId(value);

export const buildLessonProgressMap = (lessonProgress = []) => {
  const entries = lessonProgress
    .map((entry) => [toComparableId(entry.lesson), entry])
    .filter(([lessonId]) => Boolean(lessonId));

  return new Map(entries);
};

export const getLessonProgressState = (lesson, progressSource = []) => {
  const progressMap = progressSource instanceof Map
    ? progressSource
    : buildLessonProgressMap(progressSource);

  const lessonId = toComparableId(lesson);
  const progressEntry = lessonId ? progressMap.get(lessonId) : null;
  const watchPercentage = Math.max(0, Math.round(Number(progressEntry?.watchPercentage || 0)));
  const isQualified = Boolean(progressEntry?.isQualified);
  const hasStarted = isQualified || watchPercentage > 0 || Boolean(progressEntry?.lastWatchedAt);

  return {
    progressEntry,
    watchPercentage,
    isQualified,
    hasStarted,
    lastWatchedAt: progressEntry?.lastWatchedAt || null,
  };
};

export const getCourseJourney = ({
  lessons = [],
  lessonProgress = [],
  currentLessonId = null,
} = {}) => {
  const orderedLessons = [...lessons].sort((left, right) => {
    const leftOrder = Number(left?.order || 0);
    const rightOrder = Number(right?.order || 0);
    return leftOrder - rightOrder;
  });

  const progressMap = buildLessonProgressMap(lessonProgress);
  const lessonStates = orderedLessons.map((lesson) => ({
    lesson,
    ...getLessonProgressState(lesson, progressMap),
  }));

  const currentId = toComparableId(currentLessonId);
  const currentIndex = orderedLessons.findIndex((lesson) => toComparableId(lesson) === currentId);
  const currentLesson = currentIndex >= 0 ? orderedLessons[currentIndex] : null;
  const previousLesson = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < orderedLessons.length - 1
    ? orderedLessons[currentIndex + 1]
    : null;

  const completedCount = lessonStates.filter((state) => state.isQualified).length;
  const startedCount = lessonStates.filter((state) => state.hasStarted).length;
  const completionPercentage = orderedLessons.length > 0
    ? Math.round((completedCount / orderedLessons.length) * 100)
    : 0;

  const resumeLesson = [...lessonStates]
    .filter((state) => state.hasStarted && !state.isQualified)
    .sort((left, right) => {
      const lastWatchedDiff = toTimestamp(right.lastWatchedAt) - toTimestamp(left.lastWatchedAt);
      if (lastWatchedDiff !== 0) {
        return lastWatchedDiff;
      }

      const watchDiff = right.watchPercentage - left.watchPercentage;
      if (watchDiff !== 0) {
        return watchDiff;
      }

      return Number(left.lesson?.order || 0) - Number(right.lesson?.order || 0);
    })[0]?.lesson || null;

  const firstIncompleteLesson = lessonStates.find((state) => !state.isQualified)?.lesson || null;
  const firstLesson = orderedLessons[0] || null;
  const recommendedLesson = resumeLesson || firstIncompleteLesson || firstLesson;

  const nextIncompleteAfterCurrent = currentIndex >= 0
    ? lessonStates
      .slice(currentIndex + 1)
      .find((state) => !state.isQualified)?.lesson || null
    : null;

  return {
    lessons: orderedLessons,
    lessonStates,
    progressMap,
    firstLesson,
    currentLesson,
    currentIndex,
    previousLesson,
    nextLesson,
    nextIncompleteAfterCurrent,
    firstIncompleteLesson,
    recommendedLesson,
    resumeLesson,
    completedCount,
    startedCount,
    completionPercentage,
    isCompleted: orderedLessons.length > 0 && completedCount === orderedLessons.length,
  };
};
