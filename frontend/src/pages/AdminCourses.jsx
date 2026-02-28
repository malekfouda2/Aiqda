import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsAPI, videoAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';

function StatCard({ label, value, sub, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-50 border-gray-100',
    green: 'bg-green-50 border-green-100',
    blue: 'bg-blue-50 border-blue-100',
    amber: 'bg-amber-50 border-amber-100',
    primary: 'bg-primary-50 border-primary-100',
    cyan: 'bg-cyan-50 border-cyan-100',
  };
  return (
    <div className={`rounded-xl p-3 border ${colors[color]}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function AdminCourses() {
  const { showSuccess, showError } = useUIStore();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedInstructor, setExpandedInstructor] = useState(null);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [videoInputs, setVideoInputs] = useState({});
  const [assigningVideo, setAssigningVideo] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await analyticsAPI.getAdminCoursesByInstructor();
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignVideo = async (lessonId) => {
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
      fetchData();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to assign video');
    } finally {
      setAssigningVideo(null);
    }
  };

  const filtered = data.filter(item =>
    !searchTerm ||
    item.instructor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.instructor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.courses.some(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading course analytics..." />
      </div>
    );
  }

  const totalCourses = data.reduce((acc, d) => acc + d.totalCourses, 0);
  const totalStudents = data.reduce((acc, d) => acc + d.totalStudents, 0);
  const totalRevenue = data.reduce((acc, d) => acc + d.totalRevenue, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Course Management</h1>
        <p className="text-gray-500">Courses organized by instructor with analytics and video assignment</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Instructors" value={data.length} color="primary" />
        <StatCard label="Total Courses" value={totalCourses} color="blue" />
        <StatCard label="Total Students" value={totalStudents} color="green" />
        <StatCard label="Est. Revenue" value={`SAR ${totalRevenue.toLocaleString()}`} color="cyan" />
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by instructor name, email, or course title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">{searchTerm ? 'No results match your search.' : 'No instructors with courses yet.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <div key={item.instructor._id} className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedInstructor(expandedInstructor === item.instructor._id ? null : item.instructor._id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-cyan-100 flex items-center justify-center border border-primary-200 text-lg font-bold text-primary-600">
                    {item.instructor.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{item.instructor.name}</h3>
                    <p className="text-sm text-gray-400">{item.instructor.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-3 text-sm text-gray-500">
                    <span>{item.totalCourses} course{item.totalCourses !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300">|</span>
                    <span>{item.totalStudents} student{item.totalStudents !== 1 ? 's' : ''}</span>
                    <span className="text-gray-300">|</span>
                    <span>SAR {item.totalRevenue.toLocaleString()}</span>
                  </div>
                  <span className={`text-gray-400 transition-transform duration-200 ${expandedInstructor === item.instructor._id ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </div>

              <AnimatePresence>
                {expandedInstructor === item.instructor._id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <StatCard label="Courses" value={item.totalCourses} color="blue" />
                        <StatCard label="Students" value={item.totalStudents} color="green" />
                        <StatCard label="Revenue" value={`SAR ${item.totalRevenue.toLocaleString()}`} color="cyan" />
                        <StatCard label="Joined" value={new Date(item.instructor.joinedAt).toLocaleDateString()} color="gray" />
                      </div>

                      <div className="space-y-3">
                        {item.courses.map((course) => (
                          <div key={course._id} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                            <div
                              className="p-4 cursor-pointer"
                              onClick={() => setExpandedCourse(expandedCourse === course._id ? null : course._id)}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-semibold text-gray-900">{course.title}</h4>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${course.isPublished ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                      {course.isPublished ? 'Published' : 'Draft'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-400 mb-2">{course.category} · {course.level} · Created {new Date(course.createdAt).toLocaleDateString()}</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="text-center bg-white rounded-lg p-2 border border-gray-100">
                                      <p className="text-sm font-bold text-gray-900">{course.enrolledStudents}</p>
                                      <p className="text-xs text-gray-400">Students</p>
                                    </div>
                                    <div className="text-center bg-white rounded-lg p-2 border border-gray-100">
                                      <p className="text-sm font-bold text-gray-900">{course.avgWatchPercentage}%</p>
                                      <p className="text-xs text-gray-400">Avg Watch</p>
                                    </div>
                                    <div className="text-center bg-white rounded-lg p-2 border border-gray-100">
                                      <p className="text-sm font-bold text-gray-900">{course.qualifiedViews}</p>
                                      <p className="text-xs text-gray-400">Qualified</p>
                                    </div>
                                    <div className="text-center bg-white rounded-lg p-2 border border-gray-100">
                                      <p className="text-sm font-bold text-gray-900">SAR {course.estimatedRevenue}</p>
                                      <p className="text-xs text-gray-400">Revenue</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${course.videosPending > 0 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                                      🎬 {course.videosAssigned}/{course.lessonsCount}
                                    </span>
                                  </div>
                                  <span className={`text-gray-400 text-sm transition-transform duration-200 ${expandedCourse === course._id ? 'rotate-180' : ''}`}>▼</span>
                                </div>
                              </div>
                            </div>

                            <AnimatePresence>
                              {expandedCourse === course._id && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                                    <h5 className="text-sm font-semibold text-gray-700 mb-3">Lessons & Video Assignment</h5>
                                    {course.lessons.length === 0 ? (
                                      <p className="text-sm text-gray-400 text-center py-4">No lessons in this course yet.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {course.lessons.map((lesson) => (
                                          <div key={lesson._id} className="bg-white rounded-lg p-3 border border-gray-100">
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">{lesson.order}</span>
                                                <span className="text-sm font-medium text-gray-900 truncate">{lesson.title}</span>
                                                {lesson.hasVideo ? (
                                                  <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 shrink-0">🎬 {lesson.vimeoVideoId}</span>
                                                ) : (
                                                  <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 shrink-0">No video</span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="text"
                                                placeholder="Vimeo Video ID (e.g., 123456789)"
                                                value={videoInputs[lesson._id] || ''}
                                                onChange={(e) => setVideoInputs(prev => ({ ...prev, [lesson._id]: e.target.value }))}
                                                className="input-field flex-1 text-sm !py-1.5"
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                              <button
                                                onClick={(e) => { e.stopPropagation(); handleAssignVideo(lesson._id); }}
                                                disabled={assigningVideo === lesson._id}
                                                className="btn-primary text-xs px-3 py-1.5 shrink-0"
                                              >
                                                {assigningVideo === lesson._id ? '...' : lesson.hasVideo ? 'Update' : 'Assign'}
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
