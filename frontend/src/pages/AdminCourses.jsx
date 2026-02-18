import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { coursesAPI, lessonsAPI, quizzesAPI, videoAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';

function AdminCourses() {
  const { showSuccess, showError } = useUIStore();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: '', description: '', category: 'General', level: 'beginner' });
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [courseLessons, setCourseLessons] = useState({});
  const [videoInputs, setVideoInputs] = useState({});
  const [assigningVideo, setAssigningVideo] = useState(null);

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

  const fetchLessons = async (courseId) => {
    try {
      const response = await lessonsAPI.getByCourse(courseId);
      setCourseLessons(prev => ({ ...prev, [courseId]: response.data }));
    } catch (error) {
      console.error('Failed to fetch lessons:', error);
    }
  };

  const handleExpandCourse = async (courseId) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
      return;
    }
    setExpandedCourse(courseId);
    await fetchLessons(courseId);
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

  const handleTogglePublish = async (courseId, isPublished) => {
    try {
      await coursesAPI.update(courseId, { isPublished: !isPublished });
      showSuccess(`Course ${isPublished ? 'unpublished' : 'published'}`);
      fetchCourses();
    } catch (error) {
      showError('Failed to update course');
    }
  };

  const handleAssignVideo = async (lessonId, courseId) => {
    const vimeoVideoId = videoInputs[lessonId];
    if (!vimeoVideoId?.trim()) {
      showError('Please enter a Vimeo Video ID');
      return;
    }
    setAssigningVideo(lessonId);
    try {
      await videoAPI.assign(lessonId, vimeoVideoId.trim());
      showSuccess('Video assigned to lesson');
      setVideoInputs(prev => ({ ...prev, [lessonId]: '' }));
      fetchLessons(courseId);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to assign video');
    } finally {
      setAssigningVideo(null);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!confirm('Are you sure? This will delete the course and all its lessons.')) return;
    try {
      await coursesAPI.delete(courseId);
      showSuccess('Course deleted');
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete course');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading courses..." />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Management</h1>
          <p className="text-gray-500">Manage all courses and assign videos to lessons</p>
        </div>
        <button onClick={() => setShowCourseForm(!showCourseForm)} className="btn-primary">
          {showCourseForm ? 'Cancel' : 'Create Course'}
        </button>
      </div>

      <AnimatePresence>
        {showCourseForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">New Course</h2>
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Title</label>
                    <input type="text" value={courseForm.title} onChange={(e) => setCourseForm(f => ({ ...f, title: e.target.value }))} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Category</label>
                    <input type="text" value={courseForm.category} onChange={(e) => setCourseForm(f => ({ ...f, category: e.target.value }))} className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Description</label>
                  <textarea value={courseForm.description} onChange={(e) => setCourseForm(f => ({ ...f, description: e.target.value }))} className="input-field" rows={3} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Level</label>
                  <select value={courseForm.level} onChange={(e) => setCourseForm(f => ({ ...f, level: e.target.value }))} className="input-field">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary">Create Course</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {courses.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No courses yet. Create your first course!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map((course) => (
            <div key={course._id} className="card">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => handleExpandCourse(course._id)}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center border border-primary-100">
                    <span className="text-xl">📚</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${course.isPublished ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                        {course.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{course.instructor?.name} · {course.lessonsCount || 0} lessons · {course.enrolledStudents?.length || 0} students</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); handleTogglePublish(course._id, course.isPublished); }} className="btn-secondary text-xs px-3 py-1.5">
                    {course.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course._id); }} className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5">
                    Delete
                  </button>
                  <span className={`text-gray-400 transition-transform duration-200 ${expandedCourse === course._id ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </div>

              <AnimatePresence>
                {expandedCourse === course._id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h4 className="font-semibold text-gray-900 mb-4">Lessons & Video Assignment</h4>

                      {!courseLessons[course._id] ? (
                        <div className="py-4 text-center"><LoadingSpinner size="sm" /></div>
                      ) : courseLessons[course._id].length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-6">No lessons in this course yet. Instructors can add lessons from their dashboard.</p>
                      ) : (
                        <div className="space-y-3">
                          {courseLessons[course._id].map((lesson) => (
                            <div key={lesson._id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex items-start gap-3">
                                  <span className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-500 shrink-0">{lesson.order}</span>
                                  <div>
                                    <h5 className="font-medium text-gray-900">{lesson.title}</h5>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {lesson.vimeoVideoId ? (
                                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full border border-green-100">🎬 {lesson.vimeoVideoId}</span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-full border border-amber-100">⚠ No video</span>
                                      )}
                                      {lesson.supportingFile && (
                                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full border border-blue-100">📎 File attached</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  placeholder="Vimeo Video ID (e.g., 123456789)"
                                  value={videoInputs[lesson._id] || ''}
                                  onChange={(e) => setVideoInputs(prev => ({ ...prev, [lesson._id]: e.target.value }))}
                                  className="input-field flex-1 text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAssignVideo(lesson._id, course._id); }}
                                  disabled={assigningVideo === lesson._id}
                                  className="btn-primary text-sm shrink-0"
                                >
                                  {assigningVideo === lesson._id ? 'Assigning...' : lesson.vimeoVideoId ? 'Update Video' : 'Assign Video'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default AdminCourses;
