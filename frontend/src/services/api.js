import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getProfile: () => api.get('/auth/profile')
};

export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  toggleStatus: (id) => api.patch(`/users/${id}/toggle-status`),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role })
};

export const subscriptionsAPI = {
  getPackages: (activeOnly = true) => api.get('/subscriptions/packages', { params: { active: activeOnly } }),
  getPackageById: (id) => api.get(`/subscriptions/packages/${id}`),
  createPackage: (data) => api.post('/subscriptions/packages', data),
  updatePackage: (id, data) => api.put(`/subscriptions/packages/${id}`, data),
  requestSubscription: (packageId) => api.post('/subscriptions/request', { packageId }),
  getUserSubscriptions: () => api.get('/subscriptions/my'),
  getActiveSubscription: () => api.get('/subscriptions/active'),
  getAll: (status) => api.get('/subscriptions', { params: { status } }),
  approve: (id) => api.patch(`/subscriptions/${id}/approve`),
  cancel: (id) => api.patch(`/subscriptions/${id}/cancel`)
};

export const paymentsAPI = {
  getBankDetails: () => api.get('/payments/bank-details'),
  submit: (data) => api.post('/payments', data),
  getUserPayments: () => api.get('/payments/my'),
  getAll: (status) => api.get('/payments', { params: { status } }),
  getById: (id) => api.get(`/payments/${id}`),
  approve: (id) => api.patch(`/payments/${id}/approve`),
  reject: (id, reason) => api.patch(`/payments/${id}/reject`, { reason })
};

export const coursesAPI = {
  getPublished: () => api.get('/courses/published'),
  getAll: (params) => api.get('/courses', { params }),
  getById: (id) => api.get(`/courses/${id}`),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  delete: (id) => api.delete(`/courses/${id}`),
  enroll: (id) => api.post(`/courses/${id}/enroll`),
  getEnrolled: () => api.get('/courses/my/enrolled'),
  getTeaching: () => api.get('/courses/my/teaching')
};

export const lessonsAPI = {
  getByCourse: (courseId) => api.get(`/lessons/course/${courseId}`),
  getById: (id) => api.get(`/lessons/${id}`),
  create: (data) => api.post('/lessons', data),
  update: (id, data) => api.put(`/lessons/${id}`, data),
  delete: (id) => api.delete(`/lessons/${id}`),
  updateProgress: (id, watchPercentage) => api.post(`/lessons/${id}/progress`, { watchPercentage }),
  getVideoToken: (id) => api.get(`/lessons/${id}/video-token`)
};

export const quizzesAPI = {
  getByLesson: (lessonId) => api.get(`/quizzes/lesson/${lessonId}`),
  getFullByLesson: (lessonId) => api.get(`/quizzes/lesson/${lessonId}/full`),
  create: (data) => api.post('/quizzes', data),
  update: (id, data) => api.put(`/quizzes/${id}`, data),
  delete: (id) => api.delete(`/quizzes/${id}`),
  submit: (lessonId, answers) => api.post(`/quizzes/lesson/${lessonId}/submit`, { answers })
};

export const analyticsAPI = {
  getStudentProgress: () => api.get('/analytics/student'),
  getCourseProgress: (courseId) => api.get(`/analytics/student/course/${courseId}`),
  getInstructorAnalytics: () => api.get('/analytics/instructor'),
  getAdminAnalytics: () => api.get('/analytics/admin'),
  getLessonAnalytics: (lessonId) => api.get(`/analytics/lesson/${lessonId}`)
};

export const videoAPI = {
  upload: (data) => api.post('/video/upload', data),
  getList: () => api.get('/video/list'),
  assign: (lessonId, vimeoVideoId) => api.post('/video/assign', { lessonId, vimeoVideoId }),
  getEmbed: (lessonId) => api.get(`/video/embed/${lessonId}`),
  delete: (videoId) => api.delete(`/video/${videoId}`)
};

export default api;
