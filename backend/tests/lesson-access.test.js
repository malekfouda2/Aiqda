import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';

import { authHeader, createCourse, createLesson, createQuiz, createUser, setupIntegrationSuite } from './helpers/integration.js';

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
