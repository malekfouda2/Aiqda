import Course from '../modules/courses/course.model.js';

export const removeLegacyCourseLevels = async () => {
  const result = await Course.updateMany(
    { level: { $exists: true } },
    { $unset: { level: 1 } }
  );

  return {
    updatedCourses: result.modifiedCount || 0,
  };
};
