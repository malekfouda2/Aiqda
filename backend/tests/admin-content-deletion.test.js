import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import { CourseProgress, LessonProgress } from '../src/modules/analytics/progress.model.js';
import Course from '../src/modules/courses/course.model.js';
import Lesson from '../src/modules/lessons/lesson.model.js';
import Quiz from '../src/modules/quizzes/quiz.model.js';
import { SubscriptionPackage } from '../src/modules/subscriptions/subscription.model.js';
import {
  authHeader,
  createCourse,
  createCourseProgress,
  createLesson,
  createLessonProgress,
  createQuiz,
  createSubscriptionPackage,
  createUser,
  setupIntegrationSuite
} from './helpers/integration.js';

const suite = setupIntegrationSuite();

const createLiveChapter = async () => {
  const creator = await createUser({ role: 'instructor' });
  const member = await createUser({ role: 'student' });
  const course = await createCourse({ instructorId: creator.user._id, title: 'Live Chapter' });
  const lessons = await Promise.all([
    createLesson({ course: course._id, title: 'Live Content A', isPublished: true }),
    createLesson({ course: course._id, title: 'Live Content B', isPublished: true }),
  ]);
  for (const lesson of lessons) {
    await createQuiz({ lesson: lesson._id });
    await createLessonProgress({ user: member.user._id, lesson: lesson._id, course: course._id });
  }
  await createCourseProgress({ user: member.user._id, course: course._id });

  const tier = await createSubscriptionPackage({ name: `Deletion Tier ${course._id}` });
  await SubscriptionPackage.updateOne({ _id: tier._id }, { $set: { courses: [course._id] } });

  return { creator, course, lessons, tier };
};

test('admins can delete a live chapter with everything that hangs off it', async () => {
  const admin = await createUser({ role: 'admin' });
  const { course, lessons, tier } = await createLiveChapter();
  const lessonIds = lessons.map((lesson) => lesson._id);

  const response = await request(suite.app)
    .delete(`/api/courses/${course._id}`)
    .set(authHeader(admin.token));

  assert.equal(response.status, 200);
  assert.equal(await Course.countDocuments({ _id: course._id }), 0);
  assert.equal(await Lesson.countDocuments({ course: course._id }), 0);
  assert.equal(await Quiz.countDocuments({ lesson: { $in: lessonIds } }), 0);
  assert.equal(await LessonProgress.countDocuments({ course: course._id }), 0);
  assert.equal(await CourseProgress.countDocuments({ course: course._id }), 0);
  assert.deepEqual((await SubscriptionPackage.findById(tier._id).lean()).courses, []);
});

test('admins can delete a single live content item and its siblings stay', async () => {
  const admin = await createUser({ role: 'admin' });
  const { course, lessons } = await createLiveChapter();
  const [deleted, kept] = lessons;

  const response = await request(suite.app)
    .delete(`/api/lessons/${deleted._id}`)
    .set(authHeader(admin.token));

  assert.equal(response.status, 200);
  assert.equal(await Lesson.countDocuments({ _id: deleted._id }), 0);
  assert.equal(await Quiz.countDocuments({ lesson: deleted._id }), 0);
  assert.equal(await LessonProgress.countDocuments({ lesson: deleted._id }), 0);

  assert.equal(await Lesson.countDocuments({ _id: kept._id }), 1);
  assert.equal(await Quiz.countDocuments({ lesson: kept._id }), 1);
  assert.equal(await LessonProgress.countDocuments({ lesson: kept._id }), 1);
  assert.equal((await Course.findById(course._id)).lessonsCount, 1);
});

test('creators still cannot delete live chapters or content', async () => {
  const { creator, course, lessons } = await createLiveChapter();

  const chapterResponse = await request(suite.app)
    .delete(`/api/courses/${course._id}`)
    .set(authHeader(creator.token));
  assert.equal(chapterResponse.status, 400);
  assert.match(chapterResponse.body.error, /Only draft chapters can be deleted/);

  const contentResponse = await request(suite.app)
    .delete(`/api/lessons/${lessons[0]._id}`)
    .set(authHeader(creator.token));
  assert.equal(contentResponse.status, 400);
  assert.match(contentResponse.body.error, /Only draft content can be deleted/);

  assert.equal(await Lesson.countDocuments({ course: course._id }), 2);
});
