import { LessonProgress, CourseProgress } from './progress.model.js';
import Course from '../courses/course.model.js';
import Lesson from '../lessons/lesson.model.js';

export const getStudentProgress = async (userId) => {
  const courseProgress = await CourseProgress.find({ user: userId })
    .populate('course', 'title thumbnail')
    .sort({ updatedAt: -1 });

  const lessonProgress = await LessonProgress.find({ user: userId })
    .populate('lesson', 'title')
    .populate('course', 'title')
    .sort({ lastWatchedAt: -1 })
    .limit(10);

  const stats = {
    totalCourses: courseProgress.length,
    completedCourses: courseProgress.filter(cp => cp.isCompleted).length,
    totalLessonsCompleted: courseProgress.reduce((acc, cp) => acc + cp.completedLessons, 0),
    overallProgress: courseProgress.length > 0 
      ? courseProgress.reduce((acc, cp) => acc + cp.progressPercentage, 0) / courseProgress.length 
      : 0
  };

  return { courseProgress, recentActivity: lessonProgress, stats };
};

export const getCourseProgress = async (userId, courseId) => {
  const courseProgress = await CourseProgress.findOne({ user: userId, course: courseId })
    .populate('course');

  const lessonProgress = await LessonProgress.find({ user: userId, course: courseId })
    .populate('lesson')
    .sort({ 'lesson.order': 1 });

  return { courseProgress, lessonProgress };
};

export const getInstructorAnalytics = async (instructorId) => {
  const courses = await Course.find({ instructor: instructorId });
  const courseIds = courses.map(c => c._id);

  const totalStudents = new Set();
  courses.forEach(c => c.enrolledStudents.forEach(s => totalStudents.add(s.toString())));

  const qualifiedViews = await LessonProgress.countDocuments({
    course: { $in: courseIds },
    isQualified: true
  });

  const monthlyStats = await LessonProgress.aggregate([
    { $match: { course: { $in: courseIds }, isQualified: true } },
    {
      $group: {
        _id: {
          year: { $year: '$completedAt' },
          month: { $month: '$completedAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 12 }
  ]);

  const courseStats = await Promise.all(courses.map(async (course) => {
    const lessons = await Lesson.countDocuments({ course: course._id });
    const qualified = await LessonProgress.countDocuments({ 
      course: course._id, 
      isQualified: true 
    });
    
    return {
      courseId: course._id,
      title: course.title,
      enrolledCount: course.enrolledStudents.length,
      lessonsCount: lessons,
      qualifiedViews: qualified
    };
  }));

  return {
    totalCourses: courses.length,
    totalStudents: totalStudents.size,
    totalQualifiedViews: qualifiedViews,
    monthlyStats,
    courseStats,
    revenueCalculation: {
      placeholder: true,
      message: 'Revenue calculation will be implemented based on business rules'
    }
  };
};

export const getAdminAnalytics = async () => {
  const totalCourses = await Course.countDocuments();
  const publishedCourses = await Course.countDocuments({ isPublished: true });
  const totalLessons = await Lesson.countDocuments();
  
  const courseProgress = await CourseProgress.find();
  const totalEnrollments = courseProgress.length;
  const completedCourses = courseProgress.filter(cp => cp.isCompleted).length;

  const qualifiedLessons = await LessonProgress.countDocuments({ isQualified: true });

  const recentActivity = await LessonProgress.find()
    .populate('user', 'name email')
    .populate('lesson', 'title')
    .populate('course', 'title')
    .sort({ updatedAt: -1 })
    .limit(20);

  return {
    overview: {
      totalCourses,
      publishedCourses,
      totalLessons,
      totalEnrollments,
      completedCourses,
      qualifiedLessons
    },
    recentActivity
  };
};

export const getLessonAnalytics = async (lessonId) => {
  const progress = await LessonProgress.find({ lesson: lessonId })
    .populate('user', 'name email');

  const stats = {
    totalViews: progress.length,
    averageWatchPercentage: progress.reduce((acc, p) => acc + p.watchPercentage, 0) / (progress.length || 1),
    quizPassRate: (progress.filter(p => p.quizPassed).length / (progress.length || 1)) * 100,
    qualificationRate: (progress.filter(p => p.isQualified).length / (progress.length || 1)) * 100
  };

  return { stats, progress };
};
