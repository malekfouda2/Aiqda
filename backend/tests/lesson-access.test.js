import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { CourseProgress, LessonProgress } from '../src/modules/analytics/progress.model.js';

import {
  authHeader,
  createCourse,
  createLesson,
  createQuiz,
  createSubscription,
  createSubscriptionPackage,
  createUser,
  setupIntegrationSuite
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

test('students only see published lessons they are enrolled in while instructors can see drafts', async () => {
  const instructor = await createUser({ role: 'instructor' });
  const enrolledStudent = await createUser({ role: 'student' });
  const outsiderStudent = await createUser({ role: 'student' });

  const course = await createCourse({
    instructorId: instructor.user._id,
    enrolledStudents: [enrolledStudent.user._id],
    isPublished: true,
    title: 'Lesson Access Course'
  });

  const packageRecord = await createSubscriptionPackage({
    courses: [course._id]
  });
  await createSubscription({
    user: enrolledStudent.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const publishedLesson = await createLesson({
    course: course._id,
    title: 'Published Lesson',
    order: 1,
    isPublished: true
  });

  const draftLesson = await createLesson({
    course: course._id,
    title: 'Draft Lesson',
    order: 2,
    isPublished: false
  });

  const publishedResponse = await request(suite.app)
    .get(`/api/lessons/${publishedLesson._id}`)
    .set(authHeader(enrolledStudent.token));
  assert.equal(publishedResponse.status, 200);
  assert.equal(publishedResponse.body.lesson.title, 'Published Lesson');

  const draftResponse = await request(suite.app)
    .get(`/api/lessons/${draftLesson._id}`)
    .set(authHeader(enrolledStudent.token));
  assert.equal(draftResponse.status, 403);

  const outsiderResponse = await request(suite.app)
    .get(`/api/lessons/${publishedLesson._id}`)
    .set(authHeader(outsiderStudent.token));
  assert.equal(outsiderResponse.status, 403);

  const publicListResponse = await request(suite.app)
    .get(`/api/lessons/course/${course._id}`);
  assert.equal(publicListResponse.status, 200);
  assert.equal(publicListResponse.body.length, 1);
  assert.equal(publicListResponse.body[0].title, 'Published Lesson');

  const instructorListResponse = await request(suite.app)
    .get(`/api/lessons/course/${course._id}`)
    .set(authHeader(instructor.token));
  assert.equal(instructorListResponse.status, 200);
  assert.equal(instructorListResponse.body.length, 2);
});

test('admin viewers can access member content without generating lesson or chapter progress', async () => {
  const instructor = await createUser({ role: 'instructor' });
  const admin = await createUser({ role: 'admin' });
  const student = await createUser({ role: 'student' });

  const course = await createCourse({
    instructorId: instructor.user._id,
    enrolledStudents: [student.user._id],
    isPublished: true,
    title: 'Admin Review Course'
  });

  const packageRecord = await createSubscriptionPackage({
    courses: [course._id]
  });
  await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const lesson = await createLesson({
    course: course._id,
    title: 'Admin Review Lesson',
    order: 1,
    isPublished: true
  });

  await createQuiz({ lesson: lesson._id });

  const lessonResponse = await request(suite.app)
    .get(`/api/lessons/${lesson._id}`)
    .set(authHeader(admin.token));
  assert.equal(lessonResponse.status, 200);
  assert.equal(lessonResponse.body.progress, null);

  const watchResponse = await request(suite.app)
    .post(`/api/lessons/${lesson._id}/progress`)
    .set(authHeader(admin.token))
    .send({ watchPercentage: 95 });
  assert.equal(watchResponse.status, 200);
  assert.equal(watchResponse.body.watchPercentage, 0);
  assert.equal(watchResponse.body.trackingDisabled, true);

  const quizResponse = await request(suite.app)
    .post(`/api/quizzes/lesson/${lesson._id}/submit`)
    .set(authHeader(admin.token))
    .send({ answers: [1] });
  assert.equal(quizResponse.status, 200);
  assert.equal(quizResponse.body.passed, true);
  assert.equal(quizResponse.body.progress.trackingDisabled, true);
  assert.equal(quizResponse.body.progress.watchPercentage, 0);

  const courseProgressResponse = await request(suite.app)
    .get(`/api/analytics/student/course/${course._id}`)
    .set(authHeader(admin.token));
  assert.equal(courseProgressResponse.status, 200);
  assert.equal(courseProgressResponse.body.courseProgress, null);
  assert.deepEqual(courseProgressResponse.body.lessonProgress, []);

  assert.equal(await LessonProgress.countDocuments({ user: admin.user._id }), 0);
  assert.equal(await CourseProgress.countDocuments({ user: admin.user._id }), 0);
});

test('students cannot access draft quizzes while admins can still review full quiz data', async () => {
  const instructor = await createUser({ role: 'instructor' });
  const admin = await createUser({ role: 'admin' });
  const student = await createUser({ role: 'student' });

  const course = await createCourse({
    instructorId: instructor.user._id,
    enrolledStudents: [student.user._id],
    isPublished: true,
    title: 'Quiz Access Course'
  });

  const packageRecord = await createSubscriptionPackage({
    courses: [course._id]
  });
  await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const draftLesson = await createLesson({
    course: course._id,
    title: 'Draft Quiz Lesson',
    order: 1,
    isPublished: false
  });

  await createQuiz({ lesson: draftLesson._id });

  const studentResponse = await request(suite.app)
    .get(`/api/quizzes/lesson/${draftLesson._id}`)
    .set(authHeader(student.token));
  assert.equal(studentResponse.status, 403);

  const adminResponse = await request(suite.app)
    .get(`/api/quizzes/lesson/${draftLesson._id}/full`)
    .set(authHeader(admin.token));
  assert.equal(adminResponse.status, 200);
  assert.equal(adminResponse.body.lesson.toString(), draftLesson._id.toString());
});

test('students cannot fetch Vimeo embed data for draft lessons even when enrolled', async () => {
  const instructor = await createUser({ role: 'instructor' });
  const student = await createUser({ role: 'student' });

  const course = await createCourse({
    instructorId: instructor.user._id,
    enrolledStudents: [student.user._id],
    isPublished: true,
    title: 'Draft Video Access Course'
  });

  const packageRecord = await createSubscriptionPackage({
    courses: [course._id]
  });
  await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const draftLesson = await createLesson({
    course: course._id,
    title: 'Draft Video Lesson',
    order: 1,
    isPublished: false,
    vimeoVideoId: '1186554397'
  });

  const studentResponse = await request(suite.app)
    .get(`/api/video/embed/${draftLesson._id}`)
    .set(authHeader(student.token));
  assert.equal(studentResponse.status, 403);

  const instructorResponse = await request(suite.app)
    .get(`/api/video/embed/${draftLesson._id}`)
    .set(authHeader(instructor.token));
  assert.equal(instructorResponse.status, 200);
  assert.equal(instructorResponse.body.lessonId.toString(), draftLesson._id.toString());
});

test('supporting lesson files require authorized download access and are not exposed under /uploads', async () => {
  const instructor = await createUser({ role: 'instructor' });
  const student = await createUser({ role: 'student' });

  const course = await createCourse({
    instructorId: instructor.user._id,
    enrolledStudents: [student.user._id],
    isPublished: true,
    title: 'Protected Supporting Files Course'
  });

  const packageRecord = await createSubscriptionPackage({
    courses: [course._id]
  });
  await createSubscription({
    user: student.user._id,
    package: packageRecord._id,
    status: 'active',
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  const lesson = await createLesson({
    course: course._id,
    title: 'Lesson With File',
    order: 1,
    isPublished: true
  });

  const uploadResponse = await request(suite.app)
    .post(`/api/lessons/${lesson._id}/upload-file`)
    .set(authHeader(instructor.token))
    .attach('file', Buffer.from('lesson support file'), {
      filename: 'notes.txt',
      contentType: 'text/plain'
    });
  assert.equal(uploadResponse.status, 200);

  const protectedDownloadResponse = await request(suite.app)
    .get(`/api/lessons/${lesson._id}/file`)
    .set(authHeader(student.token));
  assert.equal(protectedDownloadResponse.status, 200);
  assert.match(protectedDownloadResponse.headers['content-disposition'], /notes\.txt/);

  const publicDownloadResponse = await request(suite.app)
    .get(`/uploads/${uploadResponse.body.supportingFile}`);
  assert.equal(publicDownloadResponse.status, 404);
});

test('manual included package access lets higher tiers enroll in lower-tier courses', async () => {
  const student = await createUser({ role: 'student' });
  const lowerTierStudent = await createUser({ role: 'student' });
  const instructor = await createUser({ role: 'instructor' });

  const lowerTierCourse = await createCourse({
    instructorId: instructor.user._id,
    isPublished: true,
    title: 'Lower Tier Course'
  });

  const higherTierCourse = await createCourse({
    instructorId: instructor.user._id,
    isPublished: true,
    title: 'Higher Tier Course'
  });

  const lowerTierPackage = await createSubscriptionPackage({
    name: 'Lower Tier',
    courses: [lowerTierCourse._id],
  });
  const higherTierPackage = await createSubscriptionPackage({
    name: 'Higher Tier',
    courses: [higherTierCourse._id],
    includedPackages: [lowerTierPackage._id],
  });

  await createSubscription({
    user: student.user._id,
    package: higherTierPackage._id,
    status: 'active',
    billingTerm: 'annual',
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });

  await createSubscription({
    user: lowerTierStudent.user._id,
    package: lowerTierPackage._id,
    status: 'active',
    startDate: new Date(Date.now() - 60 * 60 * 1000),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const includedAccessResponse = await request(suite.app)
    .post(`/api/courses/${lowerTierCourse._id}/enroll`)
    .set(authHeader(student.token));
  assert.equal(includedAccessResponse.status, 200);

  const blockedUpgradeResponse = await request(suite.app)
    .post(`/api/courses/${higherTierCourse._id}/enroll`)
    .set(authHeader(lowerTierStudent.token));
  assert.equal(blockedUpgradeResponse.status, 400);
  assert.equal(
    blockedUpgradeResponse.body.error,
    'Your current subscription does not include access to this chapter'
  );
});
