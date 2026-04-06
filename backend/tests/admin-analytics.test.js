import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import Payment from '../src/modules/payments/payment.model.js';
import {
  authHeader,
  createCourse,
  createCourseProgress,
  createLesson,
  createLessonProgress,
  createSubscription,
  createSubscriptionPackage,
  createUser,
  setupIntegrationSuite
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

const createApprovedPayment = async ({ userId, subscriptionId, amount, paymentReference }) => {
  return Payment.create({
    user: userId,
    subscription: subscriptionId,
    amount,
    paymentReference,
    proofFile: '/uploads/test-proof.pdf',
    status: 'approved'
  });
};

test('admin courses by instructor returns batched course analytics and revenue data', async () => {
  const admin = await createUser({ role: 'admin' });
  const instructorA = await createUser({ role: 'instructor', name: 'Instructor Alpha' });
  const instructorB = await createUser({ role: 'instructor', name: 'Instructor Beta' });
  const studentOne = await createUser({ role: 'student' });
  const studentTwo = await createUser({ role: 'student' });
  const studentThree = await createUser({ role: 'student' });
  const studentFour = await createUser({ role: 'student' });

  const courseA1 = await createCourse({
    instructorId: instructorA.user._id,
    title: 'Alpha Course One',
    enrolledStudents: [studentOne.user._id, studentTwo.user._id]
  });
  const courseA2 = await createCourse({
    instructorId: instructorA.user._id,
    title: 'Alpha Course Two',
    enrolledStudents: [studentTwo.user._id, studentThree.user._id]
  });
  await createCourse({
    instructorId: instructorB.user._id,
    title: 'Beta Course',
    enrolledStudents: [studentFour.user._id]
  });

  const lessonA1Video = await createLesson({
    course: courseA1._id,
    title: 'Alpha Video Lesson',
    order: 1,
    vimeoVideoId: '111111',
    isPublished: true
  });
  const lessonA1Pending = await createLesson({
    course: courseA1._id,
    title: 'Alpha Pending Lesson',
    order: 2,
    isPublished: true
  });
  const lessonA2 = await createLesson({
    course: courseA2._id,
    title: 'Alpha Course Two Lesson',
    order: 1,
    isPublished: true
  });

  await createLessonProgress({
    user: studentOne.user._id,
    lesson: lessonA1Video._id,
    course: courseA1._id,
    watchPercentage: 80,
    isQualified: true,
    quizPassed: true,
    completedAt: new Date('2026-03-12T10:00:00.000Z')
  });
  await createLessonProgress({
    user: studentTwo.user._id,
    lesson: lessonA1Pending._id,
    course: courseA1._id,
    watchPercentage: 40,
    isQualified: false,
    quizPassed: false,
    completedAt: null
  });
  await createLessonProgress({
    user: studentThree.user._id,
    lesson: lessonA2._id,
    course: courseA2._id,
    watchPercentage: 90,
    isQualified: true,
    quizPassed: true,
    completedAt: new Date('2026-02-10T09:00:00.000Z')
  });

  const packageRecord = await createSubscriptionPackage({
    price: 600,
    courses: [courseA1._id, courseA2._id]
  });
  const subscription = await createSubscription({
    user: studentOne.user._id,
    package: packageRecord._id,
    status: 'active'
  });
  await createApprovedPayment({
    userId: studentOne.user._id,
    subscriptionId: subscription._id,
    amount: 600,
    paymentReference: 'PAY-ADMIN-COURSES-001'
  });

  const response = await request(suite.app)
    .get('/api/analytics/admin/courses-by-instructor')
    .set(authHeader(admin.token));

  assert.equal(response.status, 200);
  assert.equal(response.body.length, 2);
  assert.equal(response.body[0].instructor._id, instructorA.user._id.toString());

  const alphaRow = response.body.find(
    (entry) => entry.instructor._id === instructorA.user._id.toString()
  );

  assert.ok(alphaRow);
  assert.equal(alphaRow.totalCourses, 2);
  assert.equal(alphaRow.totalStudents, 3);
  assert.equal(alphaRow.totalRevenue, 600);

  const alphaCourseOne = alphaRow.courses.find((course) => course._id === courseA1._id.toString());
  const alphaCourseTwo = alphaRow.courses.find((course) => course._id === courseA2._id.toString());

  assert.ok(alphaCourseOne);
  assert.ok(alphaCourseTwo);
  assert.equal(alphaCourseOne.lessonsCount, 2);
  assert.equal(alphaCourseOne.videosAssigned, 1);
  assert.equal(alphaCourseOne.videosPending, 1);
  assert.equal(alphaCourseOne.avgWatchPercentage, 60);
  assert.equal(alphaCourseOne.qualifiedViews, 1);
  assert.equal(alphaCourseOne.quizPassCount, 1);
  assert.equal(alphaCourseOne.estimatedRevenue, 300);
  assert.deepEqual(
    alphaCourseOne.lessons.map((lesson) => ({
      title: lesson.title,
      hasVideo: lesson.hasVideo
    })),
    [
      { title: 'Alpha Video Lesson', hasVideo: true },
      { title: 'Alpha Pending Lesson', hasVideo: false }
    ]
  );

  assert.equal(alphaCourseTwo.lessonsCount, 1);
  assert.equal(alphaCourseTwo.videosAssigned, 0);
  assert.equal(alphaCourseTwo.avgWatchPercentage, 90);
  assert.equal(alphaCourseTwo.qualifiedViews, 1);
  assert.equal(alphaCourseTwo.quizPassCount, 1);
  assert.equal(alphaCourseTwo.estimatedRevenue, 300);
});

test('admin instructor detail returns summary, lesson metadata, and monthly enrollments', async () => {
  const admin = await createUser({ role: 'admin' });
  const instructor = await createUser({ role: 'instructor', name: 'Detail Instructor' });
  const studentOne = await createUser({ role: 'student' });
  const studentTwo = await createUser({ role: 'student' });
  const studentThree = await createUser({ role: 'student' });

  const courseOne = await createCourse({
    instructorId: instructor.user._id,
    title: 'Detail Course One',
    isPublished: true,
    enrolledStudents: [studentOne.user._id, studentTwo.user._id]
  });
  const courseTwo = await createCourse({
    instructorId: instructor.user._id,
    title: 'Detail Course Two',
    isPublished: false,
    enrolledStudents: [studentTwo.user._id, studentThree.user._id]
  });

  const lessonOne = await createLesson({
    course: courseOne._id,
    title: 'Detail Intro',
    order: 1,
    vimeoVideoId: '222222',
    supportingFile: '/uploads/detail-intro.pdf',
    supportingFileName: 'detail-intro.pdf',
    isPublished: true
  });
  const lessonTwo = await createLesson({
    course: courseOne._id,
    title: 'Detail Workshop',
    order: 2,
    isPublished: true
  });
  const lessonThree = await createLesson({
    course: courseTwo._id,
    title: 'Detail Studio',
    order: 1,
    supportingFile: '/uploads/detail-studio.pdf',
    supportingFileName: 'detail-studio.pdf',
    isPublished: true
  });

  await createLessonProgress({
    user: studentOne.user._id,
    lesson: lessonOne._id,
    course: courseOne._id,
    watchPercentage: 100,
    isQualified: true,
    quizPassed: true,
    completedAt: new Date('2026-03-14T12:00:00.000Z')
  });
  await createLessonProgress({
    user: studentTwo.user._id,
    lesson: lessonTwo._id,
    course: courseOne._id,
    watchPercentage: 50,
    isQualified: false,
    quizPassed: false,
    completedAt: null
  });
  await createLessonProgress({
    user: studentThree.user._id,
    lesson: lessonThree._id,
    course: courseTwo._id,
    watchPercentage: 75,
    isQualified: true,
    quizPassed: false,
    completedAt: new Date('2026-02-15T08:00:00.000Z')
  });

  await createCourseProgress({
    user: studentOne.user._id,
    course: courseOne._id,
    completedLessons: 2,
    totalLessons: 2,
    progressPercentage: 100,
    isCompleted: true,
    startedAt: new Date('2026-03-01T00:00:00.000Z'),
    completedAt: new Date('2026-03-15T00:00:00.000Z')
  });
  await createCourseProgress({
    user: studentTwo.user._id,
    course: courseOne._id,
    completedLessons: 1,
    totalLessons: 2,
    progressPercentage: 50,
    isCompleted: false,
    startedAt: new Date('2026-03-20T00:00:00.000Z')
  });
  await createCourseProgress({
    user: studentThree.user._id,
    course: courseTwo._id,
    completedLessons: 1,
    totalLessons: 1,
    progressPercentage: 100,
    isCompleted: false,
    startedAt: new Date('2026-02-05T00:00:00.000Z')
  });

  const packageRecord = await createSubscriptionPackage({
    price: 500,
    courses: [courseOne._id, courseTwo._id]
  });
  const subscription = await createSubscription({
    user: studentOne.user._id,
    package: packageRecord._id,
    status: 'active'
  });
  await createApprovedPayment({
    userId: studentOne.user._id,
    subscriptionId: subscription._id,
    amount: 500,
    paymentReference: 'PAY-ADMIN-DETAIL-001'
  });

  const response = await request(suite.app)
    .get(`/api/analytics/admin/instructors/${instructor.user._id}`)
    .set(authHeader(admin.token));

  assert.equal(response.status, 200);
  assert.equal(response.body.summary.totalCourses, 2);
  assert.equal(response.body.summary.publishedCourses, 1);
  assert.equal(response.body.summary.totalStudents, 3);
  assert.equal(response.body.summary.totalRevenue, 500);
  assert.equal(response.body.summary.avgWatchPercentage, 75);
  assert.equal(response.body.summary.completedCourses, 1);
  assert.equal(response.body.summary.qualifiedViews, 2);
  assert.equal(response.body.summary.quizPassRate, 33);
  assert.deepEqual(response.body.monthlyEnrollments, [
    { _id: { year: 2026, month: 3 }, count: 2 },
    { _id: { year: 2026, month: 2 }, count: 1 }
  ]);

  const detailCourseOne = response.body.courses.find(
    (course) => course._id === courseOne._id.toString()
  );
  const detailCourseTwo = response.body.courses.find(
    (course) => course._id === courseTwo._id.toString()
  );

  assert.ok(detailCourseOne);
  assert.ok(detailCourseTwo);
  assert.equal(detailCourseOne.lessonsCount, 2);
  assert.equal(detailCourseOne.videosAssigned, 1);
  assert.equal(detailCourseOne.videosPending, 1);
  assert.equal(detailCourseOne.avgWatchPercentage, 75);
  assert.equal(detailCourseOne.qualifiedViews, 1);
  assert.equal(detailCourseOne.quizPassCount, 1);
  assert.equal(detailCourseOne.estimatedRevenue, 250);
  assert.equal(detailCourseOne.lessons[0].supportingFile, '/uploads/detail-intro.pdf');
  assert.equal(detailCourseOne.lessons[0].supportingFileName, 'detail-intro.pdf');

  assert.equal(detailCourseTwo.lessonsCount, 1);
  assert.equal(detailCourseTwo.videosAssigned, 0);
  assert.equal(detailCourseTwo.avgWatchPercentage, 75);
  assert.equal(detailCourseTwo.qualifiedViews, 1);
  assert.equal(detailCourseTwo.quizPassCount, 0);
  assert.equal(detailCourseTwo.estimatedRevenue, 250);
  assert.equal(detailCourseTwo.lessons[0].supportingFile, '/uploads/detail-studio.pdf');
});
