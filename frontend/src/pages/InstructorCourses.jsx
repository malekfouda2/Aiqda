import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { coursesAPI, lessonsAPI, quizzesAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, expandVariants } from '../utils/animations';

const INITIAL_LESSON_FORM = {
  title: '',
  description: '',
  file: null,
  fileName: '',
  questions: [{ question: '', options: ['', '', ''], correctAnswer: 0 }],
  passingScore: 1,
};

function InstructorCourses() {
  const { showSuccess, showError } = useUIStore();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: '', description: '', category: 'General', level: 'beginner' });
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [courseLessons, setCourseLessons] = useState({});
  const [showLessonForm, setShowLessonForm] = useState(null);
  const [lessonStep, setLessonStep] = useState(1);
  const [lessonForm, setLessonForm] = useState({ ...INITIAL_LESSON_FORM });
  const [submittingLesson, setSubmittingLesson] = useState(false);
  const [showQuizEditor, setShowQuizEditor] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const fileInputRef = useRef(null);
  const lessonFileRef = useRef(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await coursesAPI.getTeaching();
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
    if (!courseLessons[courseId]) {
      await fetchLessons(courseId);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      await coursesAPI.create(courseForm);
      showSuccess('Chapter created successfully');
      setCourseForm({ title: '', description: '', category: 'General', level: 'beginner' });
      setShowCourseForm(false);
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to create chapter');
    }
  };

  const openLessonForm = (courseId) => {
    setShowLessonForm(courseId);
    setLessonStep(1);
    setLessonForm({ ...INITIAL_LESSON_FORM });
  };

  const closeLessonForm = () => {
    setShowLessonForm(null);
    setLessonStep(1);
    setLessonForm({ ...INITIAL_LESSON_FORM });
  };

  const validateStep1 = () => {
    if (!lessonForm.title.trim()) {
      showError('Content title is required');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!lessonForm.file) {
      showError('A supporting document is required');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    for (const q of lessonForm.questions) {
      if (!q.question.trim()) {
        showError('All questions must have text');
        return false;
      }
      if (q.options.some(o => !o.trim())) {
        showError('All options must have text');
        return false;
      }
    }
    return true;
  };

  const goToStep = (step) => {
    if (step === 2 && !validateStep1()) return;
    if (step === 3 && !validateStep2()) return;
    setLessonStep(step);
  };

  const handleSubmitLesson = async (courseId) => {
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    setSubmittingLesson(true);
    try {
      const lessonRes = await lessonsAPI.create({
        title: lessonForm.title,
        description: lessonForm.description,
        course: courseId,
      });
      const lessonId = lessonRes.data._id;

      await lessonsAPI.uploadFile(lessonId, lessonForm.file);

      await quizzesAPI.create({
        lesson: lessonId,
        questions: lessonForm.questions,
        passingScore: lessonForm.passingScore,
      });

      showSuccess('Content created with document and quiz');
      closeLessonForm();
      fetchLessons(courseId);
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to create content');
    } finally {
      setSubmittingLesson(false);
    }
  };

  const handleDeleteLesson = async (lessonId, courseId) => {
    if (!confirm('Are you sure you want to delete this content?')) return;
    try {
      await lessonsAPI.delete(lessonId);
      showSuccess('Content deleted');
      fetchLessons(courseId);
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete content');
    }
  };

  const handleTogglePublish = async (courseId, isPublished) => {
    try {
      await coursesAPI.update(courseId, { isPublished: !isPublished });
      showSuccess(`Chapter ${isPublished ? 'unpublished' : 'published'}`);
      fetchCourses();
    } catch (error) {
      showError('Failed to update chapter');
    }
  };

  const addQuestion = () => {
    if (lessonForm.questions.length >= 8) {
      showError('Maximum 8 questions allowed');
      return;
    }
    setLessonForm(prev => ({
      ...prev,
      questions: [...prev.questions, { question: '', options: ['', '', ''], correctAnswer: 0 }],
    }));
  };

  const removeQuestion = (index) => {
    if (lessonForm.questions.length <= 1) {
      showError('Minimum 1 question required');
      return;
    }
    setLessonForm(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index),
    }));
  };

  const updateQuestion = (index, field, value) => {
    setLessonForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    }));
  };

  const updateOption = (qIndex, oIndex, value) => {
    setLessonForm(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIndex) return q;
        const newOptions = [...q.options];
        newOptions[oIndex] = value;
        return { ...q, options: newOptions };
      }),
    }));
  };

  const openQuizEditor = async (lesson) => {
    setShowQuizEditor(lesson._id);
    try {
      const response = await quizzesAPI.getFullByLesson(lesson._id);
      setQuizData(response.data);
    } catch {
      setQuizData({
        lesson: lesson._id,
        questions: [{ question: '', options: ['', '', ''], correctAnswer: 0 }],
        passingScore: 1,
        isNew: true,
      });
    }
  };

  const handleSaveQuiz = async () => {
    try {
      const payload = {
        lesson: quizData.lesson || showQuizEditor,
        questions: quizData.questions,
        passingScore: quizData.passingScore,
      };
      for (const q of payload.questions) {
        if (!q.question.trim()) { showError('All questions must have text'); return; }
        if (q.options.some(o => !o.trim())) { showError('All options must have text'); return; }
      }
      if (quizData.isNew) {
        await quizzesAPI.create(payload);
        showSuccess('Quiz created successfully');
      } else {
        await quizzesAPI.update(quizData._id, payload);
        showSuccess('Quiz updated successfully');
      }
      setShowQuizEditor(null);
      setQuizData(null);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to save quiz');
    }
  };

  const editQuizAddQuestion = () => {
    if (quizData.questions.length >= 8) { showError('Maximum 8 questions'); return; }
    setQuizData(prev => ({ ...prev, questions: [...prev.questions, { question: '', options: ['', '', ''], correctAnswer: 0 }] }));
  };

  const editQuizRemoveQuestion = (index) => {
    if (quizData.questions.length <= 1) { showError('Minimum 1 question'); return; }
    setQuizData(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== index) }));
  };

  const editQuizUpdateQuestion = (index, field, value) => {
    setQuizData(prev => ({ ...prev, questions: prev.questions.map((q, i) => (i === index ? { ...q, [field]: value } : q)) }));
  };

  const editQuizUpdateOption = (qIndex, oIndex, value) => {
    setQuizData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIndex) return q;
        const newOptions = [...q.options];
        newOptions[oIndex] = value;
        return { ...q, options: newOptions };
      }),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text="Loading chapters..." />
      </div>
    );
  }

  const stepIndicator = (
    <div className="flex items-center gap-2 mb-6">
      {[
        { num: 1, label: 'Details' },
        { num: 2, label: 'Document' },
        { num: 3, label: 'Quiz' },
      ].map((s, idx) => (
        <div key={s.num} className="flex items-center gap-2">
          {idx > 0 && <div className={`w-8 h-0.5 ${lessonStep >= s.num ? 'bg-primary-400' : 'bg-gray-200'}`} />}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            lessonStep === s.num ? 'bg-primary-50 text-primary-600 border border-primary-200' :
            lessonStep > s.num ? 'bg-green-50 text-green-600 border border-green-200' :
            'bg-gray-50 text-gray-400 border border-gray-200'
          }`}>
            {lessonStep > s.num ? '✓' : s.num} {s.label}
          </div>
        </div>
      ))}
    </div>
  );

  const renderQuestionEditor = (questions, addFn, removeFn, updateQFn, updateOFn, contextLabel) => (
    <div className="space-y-4">
      {questions.map((q, qIdx) => (
        <div key={qIdx} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-500">Question {qIdx + 1}</span>
            {questions.length > 1 && (
              <button type="button" onClick={() => removeFn(qIdx)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
            )}
          </div>
          <input type="text" placeholder="Enter your question" value={q.question} onChange={(e) => updateQFn(qIdx, 'question', e.target.value)} className="input-field mb-3" />
          <div className="space-y-2">
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <button type="button" onClick={() => updateQFn(qIdx, 'correctAnswer', oIdx)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${q.correctAnswer === oIdx ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 hover:border-green-300'}`}>
                  {q.correctAnswer === oIdx && '✓'}
                </button>
                <input type="text" placeholder={`Option ${oIdx + 1}`} value={opt} onChange={(e) => updateOFn(qIdx, oIdx, e.target.value)} className="input-field flex-1" />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Click the circle to mark the correct answer</p>
        </div>
      ))}
      {questions.length < 8 && (
        <button type="button" onClick={addFn} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-colors text-sm font-medium">
          + Add Question ({questions.length}/8)
        </button>
      )}
    </div>
  );

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Chapters</h1>
          <p className="text-gray-500">Create and manage your chapters, contents, and quizzes</p>
        </div>
        <button onClick={() => setShowCourseForm(!showCourseForm)} className="btn-primary">
          {showCourseForm ? 'Cancel' : 'New Chapter'}
        </button>
      </motion.div>

      <AnimatePresence>
        {showCourseForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Chapter</h2>
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
                <button type="submit" className="btn-primary">Create Chapter</button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {courses.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center">
            <span className="text-4xl">📚</span>
          </div>
          <p className="text-gray-500 mb-4">You haven't created any chapters yet</p>
          <button onClick={() => setShowCourseForm(true)} className="btn-primary">Create Your First Chapter</button>
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
                    <p className="text-sm text-gray-400">{course.lessonsCount || 0} contents · {course.enrolledStudents?.length || 0} members · {course.category} · {course.level}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); handleTogglePublish(course._id, course.isPublished); }} className="btn-secondary text-xs px-3 py-1.5">
                    {course.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <span className={`text-gray-400 transition-transform duration-200 ${expandedCourse === course._id ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </div>

              <AnimatePresence>
                {expandedCourse === course._id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">Contents</h4>
                        {showLessonForm !== course._id && (
                          <button onClick={() => openLessonForm(course._id)} className="text-sm text-primary-500 hover:text-primary-600 font-medium">
                            + Add Content
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {showLessonForm === course._id && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="bg-white rounded-xl p-5 mb-4 border-2 border-primary-100 shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-semibold text-gray-900">New Content</h4>
                                <button onClick={closeLessonForm} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
                              </div>

                              {stepIndicator}

                              {lessonStep === 1 && (
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Content Title <span className="text-red-400">*</span></label>
                                    <input type="text" placeholder="e.g. Introduction to Variables" value={lessonForm.title} onChange={(e) => setLessonForm(f => ({ ...f, title: e.target.value }))} className="input-field" />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                                    <textarea placeholder="What will members learn in this content?" value={lessonForm.description} onChange={(e) => setLessonForm(f => ({ ...f, description: e.target.value }))} className="input-field" rows={2} />
                                  </div>
                                  <div className="flex justify-end">
                                    <button type="button" onClick={() => goToStep(2)} className="btn-primary text-sm">Next: Upload Document</button>
                                  </div>
                                </div>
                              )}

                              {lessonStep === 2 && (
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Supporting Document <span className="text-red-400">*</span></label>
                                    <p className="text-xs text-gray-400 mb-3">Upload a file for members (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, images, or TXT). Max 50MB.</p>
                                    {lessonForm.file ? (
                                      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                                        <span className="text-2xl">📄</span>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-gray-900 truncate">{lessonForm.fileName}</p>
                                          <p className="text-xs text-gray-400">{(lessonForm.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                        <button type="button" onClick={() => setLessonForm(f => ({ ...f, file: null, fileName: '' }))} className="text-sm text-red-400 hover:text-red-600 font-medium">Remove</button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => lessonFileRef.current?.click()}
                                        className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 transition-colors flex flex-col items-center gap-2"
                                      >
                                        <span className="text-3xl">📎</span>
                                        <span className="text-sm font-medium">Click to select a file</span>
                                      </button>
                                    )}
                                    <input
                                      ref={lessonFileRef}
                                      type="file"
                                      className="hidden"
                                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png,.gif,.txt"
                                      onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) {
                                          setLessonForm(f => ({ ...f, file, fileName: file.name }));
                                        }
                                        e.target.value = '';
                                      }}
                                    />
                                  </div>
                                  <div className="flex justify-between">
                                    <button type="button" onClick={() => setLessonStep(1)} className="btn-secondary text-sm">Back</button>
                                    <button type="button" onClick={() => goToStep(3)} className="btn-primary text-sm">Next: Create Quiz</button>
                                  </div>
                                </div>
                              )}

                              {lessonStep === 3 && (
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Quiz Questions <span className="text-red-400">*</span></label>
                                    <p className="text-xs text-gray-400 mb-3">Add 1-8 questions with 3 options each. Mark the correct answer for each question.</p>
                                  </div>

                                  {renderQuestionEditor(
                                    lessonForm.questions,
                                    addQuestion,
                                    removeQuestion,
                                    updateQuestion,
                                    updateOption,
                                    'create'
                                  )}

                                  <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">Passing Score (out of {lessonForm.questions.length})</label>
                                    <input type="number" value={lessonForm.passingScore} onChange={(e) => setLessonForm(prev => ({ ...prev, passingScore: Math.max(1, Math.min(prev.questions.length, parseInt(e.target.value) || 1)) }))} className="input-field w-32" min={1} max={lessonForm.questions.length} />
                                  </div>

                                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <h5 className="text-sm font-semibold text-gray-700 mb-2">Summary</h5>
                                    <ul className="text-sm text-gray-500 space-y-1">
                                      <li>Title: <span className="text-gray-900 font-medium">{lessonForm.title}</span></li>
                                      <li>Document: <span className="text-gray-900 font-medium">{lessonForm.fileName}</span></li>
                                      <li>Quiz: <span className="text-gray-900 font-medium">{lessonForm.questions.length} question{lessonForm.questions.length > 1 ? 's' : ''}, pass {lessonForm.passingScore}/{lessonForm.questions.length}</span></li>
                                    </ul>
                                  </div>

                                  <div className="flex justify-between">
                                    <button type="button" onClick={() => setLessonStep(2)} className="btn-secondary text-sm">Back</button>
                                    <button
                                      type="button"
                                      onClick={() => handleSubmitLesson(course._id)}
                                      disabled={submittingLesson}
                                      className="btn-primary text-sm"
                                    >
                                      {submittingLesson ? 'Creating Content...' : 'Create Content'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!courseLessons[course._id] ? (
                        <div className="py-4 text-center"><LoadingSpinner size="sm" /></div>
                      ) : courseLessons[course._id].length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-6">No contents yet. Add your first content above.</p>
                      ) : (
                        <div className="space-y-3">
                          {courseLessons[course._id].map((lesson) => (
                            <div key={lesson._id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <span className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-500 shrink-0">{lesson.order}</span>
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-medium text-gray-900">{lesson.title}</h5>
                                    {lesson.description && <p className="text-sm text-gray-400 mt-1">{lesson.description}</p>}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {lesson.vimeoVideoId ? (
                                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full border border-green-100">🎬 Video assigned</span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-full border border-amber-100">⚠ No video (admin assigns)</span>
                                      )}
                                      {lesson.supportingFile ? (
                                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full border border-blue-100">📎 {lesson.supportingFileName || 'File attached'}</span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">📎 No file</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button onClick={() => openQuizEditor(lesson)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors" title="Edit quiz">
                                    📝
                                  </button>
                                  <button onClick={() => handleDeleteLesson(lesson._id, course._id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete content">
                                    🗑
                                  </button>
                                </div>
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

      <AnimatePresence>
        {showQuizEditor && quizData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setShowQuizEditor(null); setQuizData(null); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-100 p-6 rounded-t-2xl z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900">{quizData.isNew ? 'Create Quiz' : 'Edit Quiz'}</h3>
                  <button onClick={() => { setShowQuizEditor(null); setQuizData(null); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">✕</button>
                </div>
                <p className="text-sm text-gray-400 mt-1">{quizData.questions.length}/8 questions · 3 options each</p>
              </div>

              <div className="p-6 space-y-6">
                {renderQuestionEditor(
                  quizData.questions,
                  editQuizAddQuestion,
                  editQuizRemoveQuestion,
                  editQuizUpdateQuestion,
                  editQuizUpdateOption,
                  'edit'
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Passing Score (out of {quizData.questions.length})</label>
                  <input type="number" value={quizData.passingScore} onChange={(e) => setQuizData(prev => ({ ...prev, passingScore: Math.max(1, Math.min(prev.questions.length, parseInt(e.target.value) || 1)) }))} className="input-field w-32" min={1} max={quizData.questions.length} />
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-100 p-6 rounded-b-2xl flex gap-3 justify-end">
                <button onClick={() => { setShowQuizEditor(null); setQuizData(null); }} className="btn-secondary">Cancel</button>
                <button onClick={handleSaveQuiz} className="btn-primary">Save Quiz</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default InstructorCourses;
