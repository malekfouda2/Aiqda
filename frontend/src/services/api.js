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
      const isAuthRoute = error.config?.url?.includes('/auth/login')
        || error.config?.url?.includes('/auth/register')
        || error.config?.url?.includes('/auth/social/complete');
      if (!isAuthRoute) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getSocialProviders: () => api.get('/auth/social/providers'),
  completeSocialLogin: (data) => api.post('/auth/social/complete', data),
  acceptInstructorInvite: (data) => api.post('/auth/invite/accept', data),
  getProfile: () => api.get('/auth/profile')
};

export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  toggleStatus: (id) => api.patch(`/users/${id}/toggle-status`),
  updateRole: (id, role) => api.patch(`/users/${id}/role`, { role }),
  acknowledgePlatformNotice: () => api.post('/users/me/platform-notice-acknowledgement')
};

export const subscriptionsAPI = {
  getPackages: (activeOnly = true) => api.get('/subscriptions/packages', { params: { active: activeOnly } }),
  getPackageById: (id) => api.get(`/subscriptions/packages/${id}`),
  createPackage: (data) => api.post('/subscriptions/packages', data),
  updatePackage: (id, data) => api.put(`/subscriptions/packages/${id}`, data),
  requestSubscription: (packageId, billingTerm) => api.post('/subscriptions/request', { packageId, billingTerm }),
  getUserSubscriptions: () => api.get('/subscriptions/my'),
  getActiveSubscription: () => api.get('/subscriptions/active'),
  getAll: (status) => api.get('/subscriptions', { params: { status } }),
  approve: (id) => api.patch(`/subscriptions/${id}/approve`),
  cancel: (id) => api.patch(`/subscriptions/${id}/cancel`)
};

export const paymentsAPI = {
  getBankDetails: () => api.get('/payments/bank-details'),
  submit: (data) => {
    if (data instanceof FormData) {
      return api.post('/payments', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }

    return api.post('/payments', data);
  },
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
  uploadFile: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/lessons/${id}/upload-file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
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
  getAdminCoursesByInstructor: () => api.get('/analytics/admin/courses-by-instructor'),
  getAdminInstructors: () => api.get('/analytics/admin/instructors'),
  getAdminInstructorDetail: (id) => api.get(`/analytics/admin/instructors/${id}`),
  getLessonAnalytics: (lessonId) => api.get(`/analytics/lesson/${lessonId}`)
};

export const contactMessagesAPI = {
  submit: (data) => api.post('/contact-messages', data),
  getAll: (status) => api.get('/contact-messages', { params: { status } }),
  getById: (id) => api.get(`/contact-messages/${id}`),
  markRead: (id) => api.patch(`/contact-messages/${id}/read`),
  markUnread: (id) => api.patch(`/contact-messages/${id}/unread`),
  remove: (id) => api.delete(`/contact-messages/${id}`)
};

export const teamMembersAPI = {
  getPublic: () => api.get('/team-members'),
  getAll: () => api.get('/team-members/admin'),
  getById: (id) => api.get(`/team-members/admin/${id}`),
  create: (formData) => api.post('/team-members', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, formData) => api.put(`/team-members/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  remove: (id) => api.delete(`/team-members/${id}`)
};

export const partnersAPI = {
  getPublic: () => api.get('/partners'),
  getAll: () => api.get('/partners/admin'),
  getById: (id) => api.get(`/partners/admin/${id}`),
  create: (formData) => api.post('/partners', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, formData) => api.put(`/partners/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  remove: (id) => api.delete(`/partners/${id}`)
};

export const instructorApplicationsAPI = {
  submit: (formData) => api.post('/instructor-applications', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAll: (status) => api.get('/instructor-applications', { params: { status } }),
  getById: (id) => api.get(`/instructor-applications/${id}`),
  approve: (id) => api.patch(`/instructor-applications/${id}/approve`),
  reject: (id, reason) => api.patch(`/instructor-applications/${id}/reject`, { reason })
};

export const studioApplicationsAPI = {
  submit: (data) => api.post('/studio-applications', data),
  getAll: (status) => api.get('/studio-applications', { params: { status } }),
  getById: (id) => api.get(`/studio-applications/${id}`),
  approve: (id) => api.patch(`/studio-applications/${id}/approve`),
  reject: (id, reason) => api.patch(`/studio-applications/${id}/reject`, { reason })
};

export const consultationsAPI = {
  getActive: () => api.get('/consultations'),
  getById: (id) => api.get(`/consultations/${id}`),
  create: (data) => api.post('/consultations', data),
  update: (id, data) => api.put(`/consultations/${id}`, data),
  remove: (id) => api.delete(`/consultations/${id}`)
};

export const consultationBookingsAPI = {
  submit: (data) => api.post('/consultation-bookings', data),
  getMy: () => api.get('/consultation-bookings/my'),
  getAll: (status) => api.get('/consultation-bookings', { params: { status } }),
  getById: (id) => api.get(`/consultation-bookings/${id}`),
  confirm: (id) => api.patch(`/consultation-bookings/${id}/confirm`),
  reject: (id, reason) => api.patch(`/consultation-bookings/${id}/reject`, { reason }),
  cancel: (id) => api.patch(`/consultation-bookings/${id}/cancel`)
};

export const videoAPI = {
  getList: (params) => api.get('/video/list', { params }),
  getDetails: (videoId) => api.get(`/video/details/${videoId}`),
  assign: (lessonId, vimeoVideoId) => api.post('/video/assign', { lessonId, vimeoVideoId }),
  getEmbed: (lessonId) => api.get(`/video/embed/${lessonId}`),
  validateToken: () => api.get('/video/validate-token'),
};

export default api;
