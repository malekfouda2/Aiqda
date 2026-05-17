import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import {
  authHeader,
  createCourse,
  createCourseProgress,
  createLesson,
  createLessonProgress,
  createSubscription,
  createSubscriptionPackage,
  createUser,
  setupIntegrationSuite,
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('student analytics returns live rewards, badges, and leaderboard data for eligible members', async () => {
  const memberOne = await createUser({ role: 'student', name: 'Momentum Member' });
  const memberTwo = await createUser({ role: 'student', name: 'Steady Member' });

  const chapterOne = await createCourse({
    title: 'Reward Chapter One',
    enrolledStudents: [memberOne.user._id, memberTwo.user._id],
  });
  const chapterTwo = await createCourse({
    title: 'Reward Chapter Two',
    enrolledStudents: [memberOne.user._id],
  });

  const lessonOne = await createLesson({ course: chapterOne._id, order: 1, isPublished: true });
  const lessonTwo = await createLesson({ course: chapterOne._id, order: 2, isPublished: true });
  const lessonThree = await createLesson({ course: chapterTwo._id, order: 1, isPublished: true });

  const subscriptionPackage = await createSubscriptionPackage({
    courses: [chapterOne._id, chapterTwo._id],
  });

  const now = new Date();
  const futureDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  await createSubscription({
    user: memberOne.user._id,
    package: subscriptionPackage._id,
    status: 'active',
    startDate: now,
    endDate: futureDate,
  });
  await createSubscription({
    user: memberTwo.user._id,
    package: subscriptionPackage._id,
    status: 'active',
    startDate: now,
    endDate: futureDate,
  });

  await createCourseProgress({
    user: memberOne.user._id,
    course: chapterOne._id,
    completedLessons: 2,
    totalLessons: 2,
    progressPercentage: 100,
    isCompleted: true,
  });
  await createCourseProgress({
    user: memberOne.user._id,
    course: chapterTwo._id,
    completedLessons: 1,
    totalLessons: 1,
    progressPercentage: 100,
    isCompleted: true,
  });
  await createCourseProgress({
    user: memberTwo.user._id,
    course: chapterOne._id,
    completedLessons: 1,
    totalLessons: 2,
    progressPercentage: 50,
    isCompleted: false,
  });

  await createLessonProgress({
    user: memberOne.user._id,
    lesson: lessonOne._id,
    course: chapterOne._id,
    watchPercentage: 100,
    quizPassed: true,
    isQualified: true,
    quizAttempts: 1,
    completedAt: now,
    lastWatchedAt: now,
  });
  await createLessonProgress({
    user: memberOne.user._id,
    lesson: lessonTwo._id,
    course: chapterOne._id,
    watchPercentage: 85,
    quizPassed: true,
    isQualified: true,
    quizAttempts: 1,
    completedAt: now,
    lastWatchedAt: now,
  });
  await createLessonProgress({
    user: memberOne.user._id,
    lesson: lessonThree._id,
    course: chapterTwo._id,
    watchPercentage: 70,
    quizPassed: false,
    isQualified: false,
    quizAttempts: 1,
    lastWatchedAt: now,
  });

  await createLessonProgress({
    user: memberTwo.user._id,
    lesson: lessonOne._id,
    course: chapterOne._id,
    watchPercentage: 60,
    quizPassed: false,
    isQualified: false,
    quizAttempts: 1,
    lastWatchedAt: now,
  });

  const response = await request(suite.app)
    .get('/api/analytics/student')
    .set(authHeader(memberOne.token));

  assert.equal(response.status, 200);
  assert.equal(response.body.rewards.isEligible, true);
  assert.equal(response.body.rewards.completedChapterCount, 2);
  assert.equal(response.body.rewards.qualifiedContentCount, 2);
  assert.equal(response.body.rewards.rank.position, 1);
  assert.equal(response.body.rewards.rank.totalEligibleMembers, 2);
  assert.ok(response.body.rewards.points > 0);
  assert.equal(response.body.rewards.leaderboard.length, 2);
  assert.equal(response.body.rewards.leaderboard[0].name, 'Momentum Member');
  assert.equal(response.body.rewards.leaderboard[0].isCurrentUser, true);
  assert.ok(response.body.rewards.badges.some((badge) => badge.id === 'chapter-finisher' && badge.unlocked));
});

test('student recent activity only returns currently accessible content for continue development links', async () => {
  const member = await createUser({ role: 'student', name: 'Filtered Member' });

  const accessibleChapter = await createCourse({
    title: 'Accessible Chapter',
    enrolledStudents: [member.user._id],
  });
  const inaccessibleChapter = await createCourse({
    title: 'Locked Chapter',
    enrolledStudents: [member.user._id],
  });

  const accessibleLesson = await createLesson({
    course: accessibleChapter._id,
    title: 'Accessible Lesson',
    order: 1,
    isPublished: true,
  });
  const inaccessibleLesson = await createLesson({
    course: inaccessibleChapter._id,
    title: 'Locked Lesson',
    order: 1,
    isPublished: true,
  });

  const accessiblePackage = await createSubscriptionPackage({
    courses: [accessibleChapter._id],
  });

  const now = new Date();
  const futureDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

  await createSubscription({
    user: member.user._id,
    package: accessiblePackage._id,
    status: 'active',
    startDate: now,
    endDate: futureDate,
  });

  await createLessonProgress({
    user: member.user._id,
    lesson: inaccessibleLesson._id,
    course: inaccessibleChapter._id,
    watchPercentage: 80,
    quizPassed: false,
    isQualified: false,
    lastWatchedAt: new Date(now.getTime() + 5 * 60 * 1000),
  });
  await createLessonProgress({
    user: member.user._id,
    lesson: accessibleLesson._id,
    course: accessibleChapter._id,
    watchPercentage: 55,
    quizPassed: false,
    isQualified: false,
    lastWatchedAt: now,
  });

  const response = await request(suite.app)
    .get('/api/analytics/student')
    .set(authHeader(member.token));

  assert.equal(response.status, 200);
  assert.equal(response.body.recentActivity.length, 1);
  assert.equal(response.body.recentActivity[0].lesson.title, 'Accessible Lesson');
});
