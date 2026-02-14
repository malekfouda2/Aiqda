import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { coursesAPI, lessonsAPI, quizzesAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';

function AdminCourses() {
  const { showSuccess, showError } = useUIStore();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(null);
  const [courseForm, setCourseForm] = useState({ title: '', description: '', category: 'General', level: 'beginner' });
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', minimumWatchPercentage: 80 });

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await coursesAPI.getAll();
      setCourses(response.data);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await coursesAPI.create(courseForm);
      showSuccess('Course created successfully');
      setCourseForm({ title: '', description: '', category: 'General', level: 'beginner' });
      setShowCourseForm(false);
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to create course');
    }
  };

  const handleCreateLesson = async (e, courseId) => {
    e.preventDefault();
    try {
      await lessonsAPI.create({ ...lessonForm, course: courseId });
      showSuccess('Lesson created successfully');
      setLessonForm({ title: '', description: '', minimumWatchPercentage: 80 });
      setShowLessonForm(null);
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to create lesson');
    }
  };

  const handleTogglePublish = async (courseId, isPublished) => {
    try {
      await coursesAPI.update(courseId, { isPublished: !isPublished });
      showSuccess(`Course ${isPublished ? 'unpublished' : 'published'}`);
      fetchCourses();
    } catch (error) {
      showError('Failed to update course');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading courses..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Management</h1>
              <p className="text-gray-500">Create and manage courses</p>
            </div>
            <button
              onClick={() => setShowCourseForm(!showCourseForm)}
              className="btn-primary"
            >
              {showCourseForm ? 'Cancel' : 'Create Course'}
            </button>
          </div>

          {showCourseForm && (
            <div className="card mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">New Course</h2>
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Title</label>
                    <input
                      type="text"
                      value={courseForm.title}
                      onChange={(e) => setCourseForm(f => ({ ...f, title: e.target.value }))}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Category</label>
                    <input
                      type="text"
                      value={courseForm.category}
                      onChange={(e) => setCourseForm(f => ({ ...f, category: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Description</label>
                  <textarea
                    value={courseForm.description}
                    onChange={(e) => setCourseForm(f => ({ ...f, description: e.target.value }))}
                    className="input-field"
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Level</label>
                  <select
                    value={courseForm.level}
                    onChange={(e) => setCourseForm(f => ({ ...f, level: e.target.value }))}
                    className="input-field"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary">Create Course</button>
              </form>
            </div>
          )}

          {courses.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No courses yet. Create your first course!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {courses.map((course) => (
                <div key={course._id} className="card">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{course.title}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          course.isPublished ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {course.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm">{course.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTogglePublish(course._id, course.isPublished)}
                        className="btn-secondary text-sm"
                      >
                        {course.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => setShowLessonForm(showLessonForm === course._id ? null : course._id)}
                        className="btn-primary text-sm"
                      >
                        Add Lesson
                      </button>
                    </div>
                  </div>

                  {showLessonForm === course._id && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-3">New Lesson</h4>
                      <form onSubmit={(e) => handleCreateLesson(e, course._id)} className="space-y-3">
                        <input
                          type="text"
                          placeholder="Lesson title"
                          value={lessonForm.title}
                          onChange={(e) => setLessonForm(f => ({ ...f, title: e.target.value }))}
                          className="input-field"
                          required
                        />
                        <textarea
                          placeholder="Lesson description"
                          value={lessonForm.description}
                          onChange={(e) => setLessonForm(f => ({ ...f, description: e.target.value }))}
                          className="input-field"
                          rows={2}
                        />
                        <input
                          type="number"
                          placeholder="Minimum watch %"
                          value={lessonForm.minimumWatchPercentage}
                          onChange={(e) => setLessonForm(f => ({ ...f, minimumWatchPercentage: parseInt(e.target.value) }))}
                          className="input-field"
                          min={0}
                          max={100}
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="btn-primary text-sm">Create Lesson</button>
                          <button type="button" onClick={() => setShowLessonForm(null)} className="btn-secondary text-sm">Cancel</button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="text-sm text-gray-400">
                    {course.lessonsCount || 0} lessons • {course.enrolledStudents?.length || 0} students
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default AdminCourses;
