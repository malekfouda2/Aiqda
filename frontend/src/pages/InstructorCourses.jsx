import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { coursesAPI, lessonsAPI, quizzesAPI, subscriptionsAPI, usersAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import useAuthStore from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';
import InfoTooltip from '../components/InfoTooltip';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, expandVariants } from '../utils/animations';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

const INITIAL_LESSON_FORM = {
  title: '',
  description: '',
  file: null,
  fileName: '',
  includeQuiz: false,
  questions: [{ question: '', options: ['', '', ''], correctAnswer: 0 }],
  passingScore: 1,
};

// Creative/3D/media/document formats accepted for lesson uploads. Must stay in
// sync with LESSON_ALLOWED_EXTENSIONS in backend upload.middleware.js.
const LESSON_FILE_ACCEPT = [
  '.ma', '.mb', '.max', '.blend', '.c4d', '.hip', '.hiplc', '.hipnc', '.ztl', '.zpr',
  '.mud', '.spp', '.sbs', '.sbsar', '.psd', '.psb', '.ai', '.indd', '.aep', '.aepx',
  '.prproj', '.fla', '.xfl', '.sesx', '.lrcat', '.drp', '.dra', '.nk', '.comp', '.xstage',
  '.sbpz', '.sboard', '.tvpp', '.moho', '.anme', '.uproject', '.uasset', '.unity', '.zprj',
  '.ccproject', '.iproject', '.tbscene', '.rizomuv', '.mix', '.fbx', '.obj', '.abc', '.usd',
  '.usda', '.usdc', '.usdz', '.gltf', '.glb', '.dae', '.3ds', '.stl', '.ply', '.x3d', '.wrl',
  '.lwo', '.lws', '.step', '.stp', '.iges', '.igs', '.sat', '.dwg', '.dxf', '.svg', '.eps',
  '.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.tga', '.bmp', '.gif', '.webp', '.heic',
  '.ico', '.dds', '.ktx', '.exr', '.hdr', '.raw', '.cr2', '.cr3', '.nef', '.arw', '.orf',
  '.rw2', '.mp4', '.mov', '.avi', '.mxf', '.mkv', '.webm', '.wmv', '.flv', '.m4v', '.mpg',
  '.mpeg', '.3gp', '.wav', '.mp3', '.aiff', '.flac', '.ogg', '.aac', '.m4a', '.mid', '.midi',
  '.xml', '.json', '.csv', '.yaml', '.yml', '.txt', '.rtf', '.doc', '.docx', '.xls', '.xlsx',
  '.ppt', '.pptx', '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso',
].join(',');

const LESSON_FILE_MAX_BYTES = 25 * 1024 * 1024;

// Human-readable sequence codes: chapters are CH-01, lessons are CH-01-L-03.
const pad2 = (n) => String(Number(n) || 0).padStart(2, '0');
const chapterCode = (course) => `CH-${pad2(course?.order)}`;
const lessonCode = (course, lesson) => `${chapterCode(course)}-L-${pad2(lesson?.order)}`;

// Derives the display label/style for a course or lesson based on its review state.
const getReviewState = (item) => {
  const status = item?.reviewStatus || (item?.isPublished ? 'published' : 'draft');
  if (item?.isPublished || status === 'published') {
    return { label: 'Published', className: 'bg-green-50 text-green-600 border border-green-100' };
  }
  if (status === 'pending_review') {
    return { label: 'In Review', className: 'bg-amber-50 text-amber-600 border border-amber-100' };
  }
  return { label: 'Draft', className: 'bg-gray-50 text-gray-500 border border-gray-200' };
};

function InstructorCourses() {
  const { showSuccess, showError } = useUIStore();
  const user = useAuthStore((state) => state.user);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const isAdmin = user?.role === 'admin';
  const [teaserUploading, setTeaserUploading] = useState(false);
  const teaserFileRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const assignedPackageIds = new Set((user?.assignedPackages || []).map((pkg) => pkg._id || pkg));
  const [courses, setCourses] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    category: 'General',
    packageIds: [],
    software: [],
  });
  const [softwareInput, setSoftwareInput] = useState('');
  const [dragCourseIdx, setDragCourseIdx] = useState(null);
  const [dragLesson, setDragLesson] = useState(null);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editCourseForm, setEditCourseForm] = useState({ title: '', description: '', software: [] });
  const [editSoftwareInput, setEditSoftwareInput] = useState('');
  const [savingCourseEdit, setSavingCourseEdit] = useState(false);
  const [courseLessons, setCourseLessons] = useState({});
  const [showLessonForm, setShowLessonForm] = useState(null);
  const [lessonStep, setLessonStep] = useState(1);
  const [lessonForm, setLessonForm] = useState({ ...INITIAL_LESSON_FORM });
  const [submittingLesson, setSubmittingLesson] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editLessonForm, setEditLessonForm] = useState({ title: '', description: '', file: null });
  const [savingLessonEdit, setSavingLessonEdit] = useState(false);
  const editLessonFileRef = useRef(null);
  const [showQuizEditor, setShowQuizEditor] = useState(null);
  const [quizData, setQuizData] = useState(null);
  const fileInputRef = useRef(null);
  const lessonFileRef = useRef(null);

  useBodyScrollLock(Boolean(showQuizEditor && quizData));

  useEffect(() => {
    fetchData();
  }, []);

  // Deep-link from a notification (?courseId=): expand that chapter and scroll to
  // it, then clear the param so it doesn't re-trigger on later renders.
  useEffect(() => {
    const courseId = searchParams.get('courseId');
    if (!courseId || courses.length === 0) {
      return;
    }
    if (!courses.some((course) => String(course._id) === courseId)) {
      return;
    }
    setExpandedCourse(courseId);
    if (!courseLessons[courseId]) {
      fetchLessons(courseId);
    }
    setSearchParams({}, { replace: true });
    requestAnimationFrame(() => {
      document.getElementById(`creator-course-${courseId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [courses, searchParams, setSearchParams]);

  const fetchData = async () => {
    try {
      const [coursesResponse, packagesResponse] = await Promise.all([
        coursesAPI.getTeaching(),
        subscriptionsAPI.getPackages(true),
      ]);
      setCourses(coursesResponse.data);
      setPackages(packagesResponse.data);
    } catch (error) {
      console.error('Failed to fetch creator data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await coursesAPI.getTeaching();
      setCourses(response.data);
    } catch (error) {
      console.error('Failed to fetch courses:', error);
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

  const handleCourseDrop = async (targetIdx) => {
    const from = dragCourseIdx;
    setDragCourseIdx(null);
    if (from === null || from === targetIdx) return;
    const reordered = [...courses];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(targetIdx, 0, moved);
    const withOrder = reordered.map((c, i) => ({ ...c, order: i + 1 }));
    setCourses(withOrder);
    try {
      await coursesAPI.reorder(withOrder.map((c) => ({ courseId: c._id, order: c.order })));
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to reorder chapters');
      fetchCourses();
    }
  };

  const handleLessonDrop = async (courseId, targetIdx) => {
    const drag = dragLesson;
    setDragLesson(null);
    if (!drag || drag.courseId !== courseId || drag.idx === targetIdx) return;
    const list = [...(courseLessons[courseId] || [])];
    const [moved] = list.splice(drag.idx, 1);
    list.splice(targetIdx, 0, moved);
    const withOrder = list.map((l, i) => ({ ...l, order: i + 1 }));
    setCourseLessons((prev) => ({ ...prev, [courseId]: withOrder }));
    try {
      await lessonsAPI.reorder(courseId, withOrder.map((l) => ({ lessonId: l._id, order: l.order })));
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to reorder lesson');
      fetchLessons(courseId);
    }
  };

  const addSoftwareTag = (raw) => {
    const tag = String(raw || '').trim();
    if (!tag) return;
    setCourseForm((f) => (
      f.software.some((s) => s.toLowerCase() === tag.toLowerCase())
        ? f
        : { ...f, software: [...f.software, tag] }
    ));
    setSoftwareInput('');
  };

  const removeSoftwareTag = (tag) => {
    setCourseForm((f) => ({ ...f, software: f.software.filter((s) => s !== tag) }));
  };

  const handleSoftwareKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSoftwareTag(softwareInput);
    } else if (e.key === 'Backspace' && !softwareInput && courseForm.software.length > 0) {
      removeSoftwareTag(courseForm.software[courseForm.software.length - 1]);
    }
  };

  const TEASER_MAX_BYTES = 100 * 1024 * 1024;

  const handleTeaserUpload = async (file) => {
    if (!file) return;
    if (file.size > TEASER_MAX_BYTES) {
      showError('Video exceeds the 100MB limit');
      return;
    }
    setTeaserUploading(true);
    try {
      await usersAPI.uploadTeaser(file);
      await refreshProfile();
      showSuccess('Teaser video saved');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to upload teaser');
    } finally {
      setTeaserUploading(false);
      if (teaserFileRef.current) teaserFileRef.current.value = '';
    }
  };

  const handleRemoveTeaser = async () => {
    if (!confirm('Remove your teaser video?')) return;
    try {
      await usersAPI.deleteTeaser();
      await refreshProfile();
      showSuccess('Teaser video removed');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to remove teaser');
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...courseForm };
      if (softwareInput.trim() && !payload.software.some((s) => s.toLowerCase() === softwareInput.trim().toLowerCase())) {
        payload.software = [...payload.software, softwareInput.trim()];
      }
      await coursesAPI.create(payload);
      showSuccess('Chapter created successfully');
      setCourseForm({
        title: '',
        description: '',
        category: 'General',
        packageIds: [],
        software: [],
      });
      setSoftwareInput('');
      setShowCourseForm(false);
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to create chapter');
    }
  };

  const openEditCourse = (course) => {
    setEditingCourseId(course._id);
    setEditCourseForm({ title: course.title || '', description: course.description || '', software: [...(course.software || [])] });
    setEditSoftwareInput('');
  };

  const closeEditCourse = () => {
    setEditingCourseId(null);
    setEditCourseForm({ title: '', description: '', software: [] });
    setEditSoftwareInput('');
  };

  const addEditSoftwareTag = (raw) => {
    const tag = String(raw || '').trim();
    if (!tag) return;
    setEditCourseForm((f) => (
      (f.software || []).some((s) => s.toLowerCase() === tag.toLowerCase())
        ? f
        : { ...f, software: [...(f.software || []), tag] }
    ));
    setEditSoftwareInput('');
  };

  const removeEditSoftwareTag = (tag) => {
    setEditCourseForm((f) => ({ ...f, software: (f.software || []).filter((s) => s !== tag) }));
  };

  const handleEditSoftwareKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEditSoftwareTag(editSoftwareInput);
    } else if (e.key === 'Backspace' && !editSoftwareInput && (editCourseForm.software || []).length > 0) {
      removeEditSoftwareTag(editCourseForm.software[editCourseForm.software.length - 1]);
    }
  };

  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    if (!editCourseForm.title.trim()) {
      showError('Chapter title is required');
      return;
    }
    setSavingCourseEdit(true);
    try {
      const software = [...(editCourseForm.software || [])];
      if (editSoftwareInput.trim() && !software.some((s) => s.toLowerCase() === editSoftwareInput.trim().toLowerCase())) {
        software.push(editSoftwareInput.trim());
      }
      await coursesAPI.update(editingCourseId, {
        title: editCourseForm.title.trim(),
        description: editCourseForm.description.trim(),
        software,
      });
      showSuccess('Chapter updated successfully');
      closeEditCourse();
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to update chapter');
    } finally {
      setSavingCourseEdit(false);
    }
  };

  const togglePackageAssignment = (packageId) => {
    setCourseForm((current) => ({
      ...current,
      packageIds: current.packageIds.includes(packageId)
        ? current.packageIds.filter((id) => id !== packageId)
        : [...current.packageIds, packageId],
    }));
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

  // Pulls a human-readable reason out of any error (API message, network, or generic).
  const errorReason = (error, fallback) => {
    if (error?.response?.data?.error) return error.response.data.error;
    if (error?.message === 'Network Error') return 'network problem — check your connection';
    return error?.message || fallback;
  };

  // Returns an error string if the quiz is invalid, or null if it's fine.
  const validateQuiz = () => {
    const questions = lessonForm.questions;
    if (questions.length === 0) {
      return 'Add at least one question, or turn the quiz off.';
    }
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      if (!q.question.trim()) return `Question ${i + 1} needs some text.`;
      if (q.options.some((o) => !o.trim())) return `Question ${i + 1}: fill in all 3 answer options.`;
    }
    return null;
  };

  const handleSubmitLesson = async (courseId) => {
    // Only the title is required. File and quiz are optional.
    if (!lessonForm.title.trim()) {
      showError('Please enter a lesson title to continue.');
      return;
    }
    if (lessonForm.includeQuiz) {
      const quizError = validateQuiz();
      if (quizError) {
        showError(quizError);
        return;
      }
    }

    setSubmittingLesson(true);

    // Step 1: create the lesson itself. If this fails, nothing was created — safe to retry.
    let lessonId;
    try {
      const lessonRes = await lessonsAPI.create({
        title: lessonForm.title.trim(),
        description: lessonForm.description.trim(),
        course: courseId,
      });
      lessonId = lessonRes.data._id;
    } catch (error) {
      setSubmittingLesson(false);
      showError(`Couldn't create the lesson: ${errorReason(error, 'please try again')}.`);
      return;
    }

    // Steps 2 & 3 are optional add-ons. If one fails, the lesson still exists — we tell
    // the creator exactly what to fix (via Edit) instead of failing the whole thing.
    const warnings = [];
    if (lessonForm.file) {
      try {
        await lessonsAPI.uploadFile(lessonId, lessonForm.file);
      } catch (error) {
        warnings.push(`the file wasn't attached (${errorReason(error, 'upload failed')})`);
      }
    }
    if (lessonForm.includeQuiz) {
      try {
        await quizzesAPI.create({
          lesson: lessonId,
          questions: lessonForm.questions,
          passingScore: lessonForm.passingScore,
        });
      } catch (error) {
        warnings.push(`the quiz wasn't saved (${errorReason(error, 'please try again')})`);
      }
    }

    setSubmittingLesson(false);
    closeLessonForm();
    fetchLessons(courseId);
    fetchCourses();

    if (warnings.length > 0) {
      showError(`Lesson created, but ${warnings.join(' and ')}. Open the lesson's Edit button to fix it.`);
    } else {
      showSuccess('Lesson created.');
    }
  };

  const handleDeleteLesson = async (lessonId, courseId) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return;
    try {
      await lessonsAPI.delete(lessonId);
      showSuccess('Lesson deleted');
      fetchLessons(courseId);
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete lesson');
    }
  };

  const handleSubmitCourseForReview = async (courseId) => {
    try {
      await coursesAPI.submitForReview(courseId);
      showSuccess('Chapter submitted for review. An admin will publish it once approved.');
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to submit chapter for review');
    }
  };

  const handleSubmitLessonForReview = async (courseId, lessonId) => {
    try {
      await lessonsAPI.submitForReview(lessonId);
      showSuccess('Lesson submitted for review. An admin will publish it once approved.');
      fetchLessons(courseId);
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to submit lesson for review');
    }
  };

  const openEditLesson = (lesson) => {
    setShowLessonForm(null);
    setEditingLessonId(lesson._id);
    setEditLessonForm({ title: lesson.title || '', description: lesson.description || '', file: null });
    if (editLessonFileRef.current) {
      editLessonFileRef.current.value = '';
    }
  };

  const closeEditLesson = () => {
    setEditingLessonId(null);
    setEditLessonForm({ title: '', description: '', file: null });
    if (editLessonFileRef.current) {
      editLessonFileRef.current.value = '';
    }
  };

  const handleUpdateLesson = async (e, courseId) => {
    e.preventDefault();
    if (!editLessonForm.title.trim()) {
      showError('Lesson title is required');
      return;
    }
    setSavingLessonEdit(true);
    try {
      await lessonsAPI.update(editingLessonId, {
        title: editLessonForm.title.trim(),
        description: editLessonForm.description.trim(),
      });
      if (editLessonForm.file) {
        await lessonsAPI.uploadFile(editingLessonId, editLessonForm.file);
      }
      showSuccess('Lesson updated');
      closeEditLesson();
      fetchLessons(courseId);
      fetchCourses();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to update lesson');
    } finally {
      setSavingLessonEdit(false);
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            My Chapters
            <InfoTooltip text="A chapter is your course. Add lessons (content + quiz) inside it, then submit for review so an admin can publish it to members." />
          </h1>
          <p className="text-gray-500">Create and manage your chapters, lessons, and quizzes</p>
        </div>
        {(isAdmin || courses.length === 0 || showCourseForm) && (
          <button onClick={() => setShowCourseForm(!showCourseForm)} className="btn-primary">
            {showCourseForm ? 'Cancel' : 'New Chapter'}
          </button>
        )}
      </motion.div>

      <motion.div variants={fadeInUp} className="card mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              Your teaser video
              <InfoTooltip text="A short intro video about yourself. It appears before your chapters on your public creator page. Max 100MB (MP4, WebM, MOV)." />
            </h2>
            <p className="text-sm text-gray-500">A short intro about yourself, shown to members before your chapters.</p>
          </div>
        </div>
        {user?.teaserVideo ? (
          <div className="space-y-3">
            <video src={user.teaserVideo} controls className="w-full max-w-2xl rounded-xl border border-gray-100 bg-black" />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => teaserFileRef.current?.click()} disabled={teaserUploading} className="btn-secondary text-sm disabled:opacity-60">
                {teaserUploading ? 'Uploading…' : 'Replace video'}
              </button>
              <button onClick={handleRemoveTeaser} className="text-sm text-red-500 hover:text-red-600 px-3">Remove</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => teaserFileRef.current?.click()}
            disabled={teaserUploading}
            className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 transition-colors flex flex-col items-center gap-2 disabled:opacity-60"
          >
            <span className="text-3xl">🎥</span>
            <span className="text-sm font-medium">{teaserUploading ? 'Uploading…' : 'Upload a teaser video (MP4, WebM, MOV · max 100MB)'}</span>
          </button>
        )}
        <input
          ref={teaserFileRef}
          type="file"
          accept=".mp4,.webm,.ogg,.mov,.m4v"
          className="hidden"
          onChange={(e) => { handleTeaserUpload(e.target.files?.[0]); }}
        />
      </motion.div>

      <AnimatePresence>
        {showCourseForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="card mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Chapter</h2>
              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">Title
                    <InfoTooltip text="The name of your chapter as members will see it. Keep it clear and descriptive." />
                  </label>
                  <input type="text" value={courseForm.title} onChange={(e) => setCourseForm(f => ({ ...f, title: e.target.value }))} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">Tiers
                    <InfoTooltip text="Subscription tiers that will include this chapter. You can only pick tiers an admin assigned to you; locked tiers aren't available." />
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    {isAdmin
                      ? 'Select the tiers that should include this chapter.'
                      : 'Select from the subscription tiers an admin has assigned to you. Locked tiers are not available to you.'}
                  </p>
                  {packages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                      No active subscription tiers are available yet.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {packages.map((pkg) => {
                        const isSelected = courseForm.packageIds.includes(pkg._id);
                        const isAssignable = isAdmin || assignedPackageIds.has(pkg._id);
                        if (!isAssignable) {
                          return (
                            <span
                              key={pkg._id}
                              title="You are not assigned to this tier"
                              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed select-none"
                            >
                              <span aria-hidden="true">🔒</span>
                              {pkg.name}
                            </span>
                          );
                        }
                        return (
                          <button
                            key={pkg._id}
                            type="button"
                            onClick={() => togglePackageAssignment(pkg._id)}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                              isSelected
                                ? 'border-primary-500 bg-primary-50 text-primary-600'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-primary-200 hover:text-primary-500'
                            }`}
                          >
                            {pkg.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">Category
                      <InfoTooltip text="A topic label to group your chapter (e.g. 3D, Animation, Design). Helps members find related content." />
                    </label>
                    <input type="text" value={courseForm.category} onChange={(e) => setCourseForm(f => ({ ...f, category: e.target.value }))} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">Description
                      <InfoTooltip text="A short summary of what members will learn in this chapter. Shown on the chapter page." />
                    </label>
                    <textarea value={courseForm.description} onChange={(e) => setCourseForm(f => ({ ...f, description: e.target.value }))} className="input-field" rows={3} required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">Software used
                    <InfoTooltip text="Tag the tools used in this chapter (e.g. Blender, Maya, Photoshop). These tags show on the chapter everywhere. Press Enter or comma to add." />
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Tag the software/tools used in this chapter (e.g. Blender, Maya, Photoshop). Press Enter or comma to add.</p>
                  {courseForm.software.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {courseForm.software.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-sm font-medium text-primary-600">
                          {tag}
                          <button type="button" onClick={() => removeSoftwareTag(tag)} className="text-primary-400 hover:text-primary-600" aria-label={`Remove ${tag}`}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <input
                    type="text"
                    value={softwareInput}
                    onChange={(e) => setSoftwareInput(e.target.value)}
                    onKeyDown={handleSoftwareKeyDown}
                    onBlur={() => addSoftwareTag(softwareInput)}
                    className="input-field"
                    placeholder="Type a software name and press Enter"
                  />
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
          {courses.map((course, courseIdx) => (
            <div
              key={course._id}
              id={`creator-course-${course._id}`}
              className={`card ${dragCourseIdx === courseIdx ? 'opacity-50' : ''}`}
              onDragOver={(e) => { if (dragCourseIdx !== null) e.preventDefault(); }}
              onDrop={() => handleCourseDrop(courseIdx)}
            >
              <div className="flex items-center justify-between cursor-pointer" onClick={() => handleExpandCourse(course._id)}>
                <div className="flex items-center gap-4">
                  <span
                    draggable
                    onDragStart={() => setDragCourseIdx(courseIdx)}
                    onDragEnd={() => setDragCourseIdx(null)}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none px-1"
                    title="Drag to reorder chapter"
                  >
                    ⠿
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center border border-primary-100">
                    <span className="text-xl">📚</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-500">{chapterCode(course)}</span>
                      <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getReviewState(course).className}`}>
                        {getReviewState(course).label}
                      </span>
                      <InfoTooltip text="CH-01 is this chapter's sequence code (lessons are CH-01-L-01). The badge shows its status: Draft (editable), In Review (waiting for an admin), or Published (live to members). Drag the ⠿ handle to reorder chapters." />
                    </div>
                    <p className="text-sm text-gray-400">{course.lessonsCount || 0} lessons · {course.enrolledStudents?.length || 0} members · {course.category}</p>
                    {(course.software || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {course.software.map((tag) => (
                          <span key={tag} className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            🛠 {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(course.assignedPackages || []).length > 0 ? (
                        course.assignedPackages.map((pkg) => (
                          <span
                            key={pkg._id}
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                              pkg.isActive
                                ? 'border-primary-100 bg-primary-50 text-primary-600'
                                : 'border-gray-200 bg-gray-100 text-gray-500'
                            }`}
                          >
                            {pkg.name}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
                          Not assigned to any package
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); editingCourseId === course._id ? closeEditCourse() : openEditCourse(course); }}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    {editingCourseId === course._id ? 'Cancel' : 'Edit'}
                  </button>
                  {course.isPublished ? (
                    <span className="text-xs px-3 py-1.5 text-green-600 font-medium">Live</span>
                  ) : course.reviewStatus === 'pending_review' ? (
                    <span className="text-xs px-3 py-1.5 text-amber-600 font-medium">Awaiting Review</span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); handleSubmitCourseForReview(course._id); }} className="btn-secondary text-xs px-3 py-1.5">
                      Submit for Review
                    </button>
                  )}
                  <span className={`text-gray-400 transition-transform duration-200 ${expandedCourse === course._id ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </div>

              <AnimatePresence>
                {editingCourseId === course._id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <form onSubmit={handleUpdateCourse} onClick={(e) => e.stopPropagation()} className="mt-4 space-y-4 rounded-xl border-2 border-primary-100 bg-white p-5 shadow-sm">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Chapter Title <span className="text-red-400">*</span></label>
                        <input
                          type="text"
                          value={editCourseForm.title}
                          onChange={(e) => setEditCourseForm(f => ({ ...f, title: e.target.value }))}
                          className="input-field"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                        <textarea
                          value={editCourseForm.description}
                          onChange={(e) => setEditCourseForm(f => ({ ...f, description: e.target.value }))}
                          className="input-field"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Software used</label>
                        {(editCourseForm.software || []).length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {editCourseForm.software.map((tag) => (
                              <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-sm font-medium text-primary-600">
                                {tag}
                                <button type="button" onClick={() => removeEditSoftwareTag(tag)} className="text-primary-400 hover:text-primary-600" aria-label={`Remove ${tag}`}>✕</button>
                              </span>
                            ))}
                          </div>
                        )}
                        <input
                          type="text"
                          value={editSoftwareInput}
                          onChange={(e) => setEditSoftwareInput(e.target.value)}
                          onKeyDown={handleEditSoftwareKeyDown}
                          onBlur={() => addEditSoftwareTag(editSoftwareInput)}
                          className="input-field"
                          placeholder="Type a software name and press Enter"
                        />
                      </div>
                      {(course.isPublished || course.reviewStatus === 'pending_review') && (
                        <p className="text-xs text-amber-600">
                          Editing returns this chapter to draft and requires re-submitting for review.
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <button type="submit" disabled={savingCourseEdit} className="btn-primary text-sm disabled:opacity-60">
                          {savingCourseEdit ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button type="button" onClick={closeEditCourse} className="btn-secondary text-sm">Cancel</button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {expandedCourse === course._id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">Lessons
                          <InfoTooltip text="Lessons hold your teaching content. Only a title is required — a supporting file and a quiz are optional, and the video is assigned by an admin. Drag the number badge to reorder. Submit each lesson for review to get it published." />
                        </h4>
                        {showLessonForm !== course._id && (
                          <button onClick={() => openLessonForm(course._id)} className="text-sm text-primary-500 hover:text-primary-600 font-medium">
                            + Add Lesson
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {showLessonForm === course._id && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="bg-white rounded-xl p-5 mb-4 border-2 border-primary-100 shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-semibold text-gray-900">New Lesson</h4>
                                <button onClick={closeLessonForm} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
                              </div>

                              <p className="text-sm text-gray-500 mb-5">Fill in the title, then optionally attach a file and add a quiz. Only the title is required — you can add or change everything later by editing the lesson.</p>

                              <div className="space-y-6">
                                {/* 1. Details */}
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Lesson title <span className="text-red-400">*</span></label>
                                    <input type="text" placeholder="e.g. Introduction to Variables" value={lessonForm.title} onChange={(e) => setLessonForm(f => ({ ...f, title: e.target.value }))} className="input-field" />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                                    <textarea placeholder="What will members learn in this lesson?" value={lessonForm.description} onChange={(e) => setLessonForm(f => ({ ...f, description: e.target.value }))} className="input-field" rows={2} />
                                  </div>
                                </div>

                                {/* 2. Supporting file (optional) */}
                                <div className="space-y-2 border-t border-gray-100 pt-5">
                                  <label className="block text-sm font-medium text-gray-600">Supporting file <span className="text-gray-400 font-normal">(optional)</span></label>
                                  <p className="text-xs text-gray-400 mb-1">A downloadable resource for members. Up to 25MB. The lesson video is added separately by an admin.</p>
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
                                      className="w-full py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-primary-300 hover:text-primary-500 hover:bg-primary-50/30 transition-colors flex flex-col items-center gap-2"
                                    >
                                      <span className="text-3xl">📎</span>
                                      <span className="text-sm font-medium">Click to attach a file</span>
                                    </button>
                                  )}
                                  <input
                                    ref={lessonFileRef}
                                    type="file"
                                    className="hidden"
                                    accept={LESSON_FILE_ACCEPT}
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (file) {
                                        if (file.size > LESSON_FILE_MAX_BYTES) {
                                          showError('That file is over the 25MB limit. Please choose a smaller file.');
                                        } else {
                                          setLessonForm(f => ({ ...f, file, fileName: file.name }));
                                        }
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                </div>

                                {/* 3. Quiz (optional) */}
                                <div className="border-t border-gray-100 pt-5">
                                  <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={lessonForm.includeQuiz}
                                      onChange={(e) => setLessonForm(f => ({ ...f, includeQuiz: e.target.checked }))}
                                      className="mt-1"
                                    />
                                    <span>
                                      <span className="block text-sm font-medium text-gray-700">Add a quiz to this lesson <span className="text-gray-400 font-normal">(optional)</span></span>
                                      <span className="block text-xs text-gray-400">Members answer it after the lesson. You can add one later instead.</span>
                                    </span>
                                  </label>

                                  {lessonForm.includeQuiz && (
                                    <div className="space-y-4 mt-4">
                                      <p className="text-xs text-gray-400">Add 1–8 questions, each with 3 options. Tap the circle to mark the correct answer.</p>
                                      {renderQuestionEditor(
                                        lessonForm.questions,
                                        addQuestion,
                                        removeQuestion,
                                        updateQuestion,
                                        updateOption,
                                        'create'
                                      )}
                                      <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-2">Passing score (out of {lessonForm.questions.length})</label>
                                        <input type="number" value={lessonForm.passingScore} onChange={(e) => setLessonForm(prev => ({ ...prev, passingScore: Math.max(1, Math.min(prev.questions.length, parseInt(e.target.value) || 1)) }))} className="input-field w-32" min={1} max={lessonForm.questions.length} />
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-2 border-t border-gray-100 pt-5">
                                  <button type="button" onClick={closeLessonForm} className="btn-secondary text-sm">Cancel</button>
                                  <button
                                    type="button"
                                    onClick={() => handleSubmitLesson(course._id)}
                                    disabled={submittingLesson}
                                    className="btn-primary text-sm disabled:opacity-60"
                                  >
                                    {submittingLesson ? 'Creating lesson…' : 'Create lesson'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!courseLessons[course._id] ? (
                        <div className="py-4 text-center"><LoadingSpinner size="sm" /></div>
                      ) : courseLessons[course._id].length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-6">No lessons yet. Add your first lesson above.</p>
                      ) : (
                        <div className="space-y-3">
                          {courseLessons[course._id].map((lesson, lessonIdx) => (
                            <div
                              key={lesson._id}
                              className={`bg-gray-50 rounded-xl p-4 border border-gray-100 ${dragLesson?.courseId === course._id && dragLesson?.idx === lessonIdx ? 'opacity-50' : ''}`}
                              onDragOver={(e) => { if (dragLesson?.courseId === course._id) e.preventDefault(); }}
                              onDrop={() => handleLessonDrop(course._id, lessonIdx)}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <span
                                    draggable
                                    onDragStart={() => setDragLesson({ courseId: course._id, idx: lessonIdx })}
                                    onDragEnd={() => setDragLesson(null)}
                                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-500 shrink-0 cursor-grab active:cursor-grabbing select-none"
                                    title="Drag to reorder lesson"
                                  >
                                    {lesson.order}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-500">{lessonCode(course, lesson)}</span>
                                      <h5 className="font-medium text-gray-900">{lesson.title}</h5>
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getReviewState(lesson).className}`}>
                                        {getReviewState(lesson).label}
                                      </span>
                                    </div>
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
                                  {lesson.isPublished ? (
                                    <span className="p-2 text-green-600 text-sm" title="Published by an admin">✅</span>
                                  ) : lesson.reviewStatus === 'pending_review' ? (
                                    <span className="p-2 text-amber-600 text-sm" title="Awaiting admin review">⏳</span>
                                  ) : (
                                    <button
                                      onClick={() => handleSubmitLessonForReview(course._id, lesson._id)}
                                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                      title="Submit lesson for review"
                                    >
                                      🚀
                                    </button>
                                  )}
                                  {!lesson.isPublished && (
                                    <button
                                      onClick={() => (editingLessonId === lesson._id ? closeEditLesson() : openEditLesson(lesson))}
                                      className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                                      title="Edit lesson"
                                    >
                                      ✏️
                                    </button>
                                  )}
                                  <button onClick={() => openQuizEditor(lesson)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors" title="Edit quiz">
                                    📝
                                  </button>
                                  {!lesson.isPublished && lesson.reviewStatus === 'draft' && (
                                    <button onClick={() => handleDeleteLesson(lesson._id, course._id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete lesson">
                                      🗑
                                    </button>
                                  )}
                                </div>
                              </div>
                              <AnimatePresence>
                                {editingLessonId === lesson._id && !lesson.isPublished && (
                                  <motion.form
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    onSubmit={(e) => handleUpdateLesson(e, course._id)}
                                    className="overflow-hidden mt-4 space-y-3 border-t border-gray-100 pt-4"
                                  >
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                                      <input
                                        type="text"
                                        value={editLessonForm.title}
                                        onChange={(e) => setEditLessonForm((f) => ({ ...f, title: e.target.value }))}
                                        className="input-field"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                                      <textarea
                                        value={editLessonForm.description}
                                        onChange={(e) => setEditLessonForm((f) => ({ ...f, description: e.target.value }))}
                                        className="input-field"
                                        rows={3}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Replace supporting document (optional)</label>
                                      <input
                                        ref={editLessonFileRef}
                                        type="file"
                                        accept={LESSON_FILE_ACCEPT}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0] || null;
                                          if (file && file.size > LESSON_FILE_MAX_BYTES) {
                                            showError('File exceeds the 25MB upload limit');
                                            e.target.value = '';
                                            return;
                                          }
                                          setEditLessonForm((f) => ({ ...f, file }));
                                        }}
                                        className="input-field"
                                      />
                                      {lesson.supportingFileName && !editLessonForm.file && (
                                        <p className="text-xs text-gray-400 mt-1">Current: {lesson.supportingFileName}. Leave empty to keep it.</p>
                                      )}
                                    </div>
                                    {lesson.reviewStatus === 'pending_review' && (
                                      <p className="text-xs text-amber-600">Editing returns this lesson to draft and requires re-submitting for review.</p>
                                    )}
                                    <div className="flex gap-2">
                                      <button type="submit" disabled={savingLessonEdit} className="btn-primary text-sm disabled:opacity-60">
                                        {savingLessonEdit ? 'Saving…' : 'Save Changes'}
                                      </button>
                                      <button type="button" onClick={closeEditLesson} className="btn-secondary text-sm">Cancel</button>
                                    </div>
                                  </motion.form>
                                )}
                              </AnimatePresence>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="app-modal-shell z-50" onClick={() => { setShowQuizEditor(null); setQuizData(null); }}>
            <div className="app-modal-backdrop" />
            <motion.div initial={{ scale: 0.99, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.99, opacity: 0, y: 10 }} transition={{ duration: 0.16, ease: 'easeOut' }} className="app-modal-panel max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto app-modal-scroll" onClick={(e) => e.stopPropagation()}>
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
