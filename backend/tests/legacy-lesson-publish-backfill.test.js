import assert from 'node:assert/strict';
import test from 'node:test';

import Course from '../src/modules/courses/course.model.js';
import Lesson from '../src/modules/lessons/lesson.model.js';
import { backfillLegacyLessonPublishState } from '../src/startup/legacyLessonPublishBackfill.js';
import { createCourse, createLesson, createUser, setupIntegrationSuite } from './helpers/integration.js';

setupIntegrationSuite();

test('backfills clearly legacy draft lessons in published courses', async () => {
  const instructor = await createUser({ role: 'instructor' });
  const course = await createCourse({
    instructorId: instructor.user._id,
    isPublished: true,
    title: 'Legacy Published Course'
  });

  const legacyDate = new Date('2026-04-01T00:00:00.000Z');
  await Course.collection.updateOne(
    { _id: course._id },
    { $set: { createdAt: legacyDate, updatedAt: legacyDate } }
  );

  await createLesson({ course: course._id, title: 'Legacy Lesson 1', order: 1, isPublished: false });
  await createLesson({ course: course._id, title: 'Legacy Lesson 2', order: 2, isPublished: false });
  await Lesson.collection.updateMany(
    { course: course._id },
    { $set: { createdAt: legacyDate, updatedAt: legacyDate } }
  );

  const result = await backfillLegacyLessonPublishState({
    cutoff: '2026-04-05T00:00:00.000Z'
  });

  assert.equal(result.updatedCourses, 1);
  assert.equal(result.updatedLessons, 2);

  const lessons = await Lesson.find({ course: course._id }).sort({ order: 1 });
  assert.equal(lessons.length, 2);
  assert.ok(lessons.every((lesson) => lesson.isPublished === true));
});

test('skips mixed or modern draft lessons so future drafts stay untouched', async () => {
  const instructor = await createUser({ role: 'instructor' });

  const mixedCourse = await createCourse({
    instructorId: instructor.user._id,
    isPublished: true,
    title: 'Mixed Publish Course'
  });
  const legacyDate = new Date('2026-04-01T00:00:00.000Z');
  await Course.collection.updateOne(
    { _id: mixedCourse._id },
    { $set: { createdAt: legacyDate, updatedAt: legacyDate } }
  );
  await createLesson({ course: mixedCourse._id, title: 'Published Lesson', order: 1, isPublished: true });
  await createLesson({ course: mixedCourse._id, title: 'Draft Lesson', order: 2, isPublished: false });
  await Lesson.collection.updateMany(
    { course: mixedCourse._id },
    { $set: { createdAt: legacyDate, updatedAt: legacyDate } }
  );

  const modernCourse = await createCourse({
    instructorId: instructor.user._id,
    isPublished: true,
    title: 'Modern Draft Course'
  });
  await createLesson({ course: modernCourse._id, title: 'Modern Draft Lesson', order: 1, isPublished: false });

  const result = await backfillLegacyLessonPublishState({
    cutoff: '2026-04-05T00:00:00.000Z'
  });

  assert.equal(result.updatedCourses, 0);
  assert.equal(result.updatedLessons, 0);

  const mixedLessons = await Lesson.find({ course: mixedCourse._id }).sort({ order: 1 });
  assert.equal(mixedLessons[0].isPublished, true);
  assert.equal(mixedLessons[1].isPublished, false);

  const modernLessons = await Lesson.find({ course: modernCourse._id });
  assert.equal(modernLessons[0].isPublished, false);
});
