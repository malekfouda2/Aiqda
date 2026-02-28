import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { analyticsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, expandVariants } from '../utils/animations';

function StatCard({ label, value, sub, color = 'gray' }) {
  const colors = {
    gray: 'bg-gray-50 border-gray-100',
    green: 'bg-green-50 border-green-100',
    blue: 'bg-blue-50 border-blue-100',
    amber: 'bg-amber-50 border-amber-100',
    primary: 'bg-primary-50 border-primary-100',
    cyan: 'bg-cyan-50 border-cyan-100',
    red: 'bg-red-50 border-red-100',
  };
  return (
    <div className={`rounded-xl p-3 border ${colors[color]}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function AdminInstructors() {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstructor, setSelectedInstructor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      const response = await analyticsAPI.getAdminInstructors();
      setInstructors(response.data);
    } catch (error) {
      console.error('Failed to fetch instructors:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (instructorId) => {
    if (selectedInstructor === instructorId) {
      setSelectedInstructor(null);
      setDetail(null);
      return;
    }
    setSelectedInstructor(instructorId);
    setDetailLoading(true);
    try {
      const response = await analyticsAPI.getAdminInstructorDetail(instructorId);
      setDetail(response.data);
    } catch (error) {
      console.error('Failed to fetch instructor detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = instructors.filter(i =>
    !searchTerm ||
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading instructors..." />
      </div>
    );
  }

  const totals = {
    instructors: instructors.length,
    active: instructors.filter(i => i.isActive).length,
    courses: instructors.reduce((a, i) => a + i.totalCourses, 0),
    students: instructors.reduce((a, i) => a + i.totalStudents, 0),
    revenue: instructors.reduce((a, i) => a + i.totalRevenue, 0),
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Instructor Management</h1>
        <p className="text-gray-500">Detailed analytics and performance tracking for all instructors</p>
      </motion.div>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <motion.div variants={cardVariants}><StatCard label="Total Instructors" value={totals.instructors} sub={`${totals.active} active`} color="primary" /></motion.div>
        <motion.div variants={cardVariants}><StatCard label="Total Courses" value={totals.courses} color="blue" /></motion.div>
        <motion.div variants={cardVariants}><StatCard label="Total Students" value={totals.students} color="green" /></motion.div>
        <motion.div variants={cardVariants}><StatCard label="Total Revenue" value={`SAR ${totals.revenue.toLocaleString()}`} color="cyan" /></motion.div>
        <motion.div variants={cardVariants}><StatCard label="Avg Revenue/Instructor" value={`SAR ${totals.instructors > 0 ? Math.round(totals.revenue / totals.instructors).toLocaleString() : 0}`} color="amber" /></motion.div>
      </motion.div>

      <motion.div variants={fadeInUp} className="mb-6">
        <input
          type="text"
          placeholder="Search instructors by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-field"
        />
      </motion.div>

      {filtered.length === 0 ? (
        <motion.div variants={fadeInUp} className="card text-center py-12">
          <p className="text-gray-500">{searchTerm ? 'No instructors match your search.' : 'No instructors registered yet.'}</p>
        </motion.div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
          {filtered.map((instructor) => (
            <motion.div key={instructor._id} variants={cardVariants} className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => openDetail(instructor._id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-cyan-100 flex items-center justify-center border border-primary-200 text-lg font-bold text-primary-600">
                    {instructor.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{instructor.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${instructor.isActive ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-500 border border-red-100'}`}>
                        {instructor.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{instructor.email} · Joined {new Date(instructor.joinedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden md:grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{instructor.totalCourses}</p>
                      <p className="text-xs text-gray-400">Courses</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{instructor.totalStudents}</p>
                      <p className="text-xs text-gray-400">Students</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{instructor.avgWatchPercentage}%</p>
                      <p className="text-xs text-gray-400">Avg Watch</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">SAR {instructor.totalRevenue}</p>
                      <p className="text-xs text-gray-400">Revenue</p>
                    </div>
                  </div>
                  <motion.span
                    animate={{ rotate: selectedInstructor === instructor._id ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-gray-400"
                  >▼</motion.span>
                </div>
              </div>

              <AnimatePresence>
                {selectedInstructor === instructor._id && (
                  <motion.div
                    variants={expandVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="overflow-hidden"
                  >
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      {detailLoading ? (
                        <div className="py-8 text-center"><LoadingSpinner size="sm" text="Loading analytics..." /></div>
                      ) : detail ? (
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
                          <motion.div variants={cardVariants} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard label="Total Courses" value={detail.summary.totalCourses} sub={`${detail.summary.publishedCourses} published`} color="blue" />
                            <StatCard label="Total Students" value={detail.summary.totalStudents} color="green" />
                            <StatCard label="Total Revenue" value={`SAR ${detail.summary.totalRevenue.toLocaleString()}`} color="cyan" />
                            <StatCard label="Avg Watch %" value={`${detail.summary.avgWatchPercentage}%`} color="primary" />
                          </motion.div>
                          <motion.div variants={cardVariants} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard label="Qualified Views" value={detail.summary.qualifiedViews} color="green" />
                            <StatCard label="Quiz Pass Rate" value={`${detail.summary.quizPassRate}%`} color="amber" />
                            <StatCard label="Completed Courses" value={detail.summary.completedCourses} sub="by students" color="blue" />
                            <StatCard label="Joined" value={new Date(detail.instructor.joinedAt).toLocaleDateString()} color="gray" />
                          </motion.div>

                          {detail.monthlyEnrollments.length > 0 && (
                            <motion.div variants={cardVariants}>
                              <h4 className="font-semibold text-gray-900 mb-3">Monthly Enrollments</h4>
                              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                <div className="flex items-end gap-1 h-24">
                                  {detail.monthlyEnrollments.slice().reverse().map((m, idx) => {
                                    const max = Math.max(...detail.monthlyEnrollments.map(x => x.count));
                                    const height = max > 0 ? (m.count / max) * 100 : 0;
                                    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                                    return (
                                      <motion.div
                                        key={idx}
                                        initial={{ scaleY: 0 }}
                                        animate={{ scaleY: 1 }}
                                        transition={{ duration: 0.5, delay: idx * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
                                        style={{ transformOrigin: 'bottom' }}
                                        className="flex-1 flex flex-col items-center gap-1"
                                      >
                                        <span className="text-xs text-gray-500 font-medium">{m.count}</span>
                                        <div className="w-full bg-primary-200 rounded-t" style={{ height: `${Math.max(height, 4)}%` }} />
                                        <span className="text-xs text-gray-400">{monthNames[m._id.month]}</span>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          )}

                          <motion.div variants={cardVariants}>
                            <h4 className="font-semibold text-gray-900 mb-3">Courses Breakdown</h4>
                            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                              {detail.courses.map((course) => (
                                <motion.div key={course._id} variants={cardVariants} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                  <div className="flex items-start justify-between gap-4 mb-3">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <h5 className="font-semibold text-gray-900">{course.title}</h5>
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${course.isPublished ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                          {course.isPublished ? 'Published' : 'Draft'}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-400">{course.category} · {course.level}</p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                                      <p className="text-sm font-bold text-gray-900">{course.videosAssigned}/{course.lessonsCount}</p>
                                      <p className="text-xs text-gray-400">Videos</p>
                                    </div>
                                    <div className="text-center bg-white rounded-lg p-2 border border-gray-100">
                                      <p className="text-sm font-bold text-gray-900">SAR {course.estimatedRevenue}</p>
                                      <p className="text-xs text-gray-400">Revenue</p>
                                    </div>
                                  </div>

                                  {course.lessons && course.lessons.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                      <p className="text-xs font-semibold text-gray-500 mb-2">Lessons ({course.lessons.length})</p>
                                      <div className="space-y-1">
                                        {course.lessons.map((lesson) => (
                                          <div key={lesson._id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2 border border-gray-100">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs text-gray-400 w-5">{lesson.order}.</span>
                                              <span className="text-gray-900">{lesson.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              {lesson.vimeoVideoId ? (
                                                <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100">🎬 {lesson.vimeoVideoId}</span>
                                              ) : (
                                                <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100">No video</span>
                                              )}
                                              {lesson.supportingFile && (
                                                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">📎</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </motion.div>
                              ))}
                            </motion.div>
                          </motion.div>
                        </motion.div>
                      ) : (
                        <p className="text-gray-400 text-center py-4">Failed to load details.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export default AdminInstructors;
