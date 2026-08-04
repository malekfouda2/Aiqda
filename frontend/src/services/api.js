import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthRoute = error.config?.url?.includes('/auth/login')
        || error.config?.url?.includes('/auth/register')
        || error.config?.url?.includes('/auth/social/complete')
        || error.config?.url?.includes('/auth/profile')
        || error.config?.url?.includes('/auth/logout');
      if (!isAuthRoute) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  requestPasswordReset: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  logout: () => api.post('/auth/logout'),
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
  assignPackages: (id, packageIds) => api.patch(`/users/${id}/assigned-packages`, { packageIds }),
  remove: (id) => api.delete(`/users/${id}`),
  acknowledgePlatformNotice: () => api.post('/users/me/platform-notice-acknowledgement'),
  getCreatorPublic: (id) => api.get(`/users/creators/${id}/public`),
  setCreatorTeaser: (creatorId, vimeoVideoId) => api.post(`/users/${creatorId}/teaser`, { vimeoVideoId }),
  deleteCreatorTeaser: (creatorId) => api.delete(`/users/${creatorId}/teaser`),
  setChapterLimit: (creatorId, chapterLimit) => api.patch(`/users/${creatorId}/chapter-limit`, { chapterLimit })
};

export const subscriptionsAPI = {
  getPackages: (activeOnly = true) => api.get('/subscriptions/packages', { params: { active: activeOnly } }),
  getPackageById: (id) => api.get(`/subscriptions/packages/${id}`),
  createPackage: (data) => api.post('/subscriptions/packages', data),
  updatePackage: (id, data) => api.put(`/subscriptions/packages/${id}`, data),
  requestSubscription: (packageId, billingTerm) => api.post('/subscriptions/request', { packageId, billingTerm }),
  getUserSubscriptions: () => api.get('/subscriptions/my'),
  getActiveSubscription: () => api.get('/subscriptions/active'),
  updateAutoRenew: (id, enabled) => api.patch(`/subscriptions/${id}/auto-renew`, { enabled }),
  getAll: (status) => api.get('/subscriptions', { params: { status } }),
  cancel: (id) => api.patch(`/subscriptions/${id}/cancel`),
  remove: (id) => api.delete(`/subscriptions/${id}`)
};

export const paymentsAPI = {
  getTapConfig: () => api.get('/payments/tap/config'),
  createTapCharge: (data) => api.post('/payments/tap/charge', data),
  createBillingProfileSetupCharge: (data) => api.post('/payments/tap/billing-profile/setup', data),
  syncTapCharge: (chargeId) => api.get(`/payments/tap/charges/${chargeId}`),
  removeSavedBillingProfile: () => api.delete('/payments/tap/billing-profile'),
  getUserPayments: () => api.get('/payments/my'),
  getAll: (status) => api.get('/payments', { params: { status } }),
  getById: (id) => api.get(`/payments/${id}`),
  refund: (id, data = {}) => api.post(`/payments/${id}/refund`, data),
  remove: (id) => api.delete(`/payments/${id}`)
};

export const coursesAPI = {
  getPublished: () => api.get('/courses/published'),
  getAll: (params) => api.get('/courses', { params }),
  getById: (id) => api.get(`/courses/${id}`),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.put(`/courses/${id}`, data),
  submitForReview: (id) => api.post(`/courses/${id}/submit-review`),
  setPublish: (id, isPublished) => api.patch(`/courses/${id}/publish`, { isPublished }),
  delete: (id) => api.delete(`/courses/${id}`),
  reorder: (courseOrders) => api.put('/courses/reorder', { courseOrders }),
  enroll: (id) => api.post(`/courses/${id}/enroll`),
  getEnrolled: () => api.get('/courses/my/enrolled'),
  getTeaching: () => api.get('/courses/my/teaching')
};

export const lessonsAPI = {
  getByCourse: (courseId) => api.get(`/lessons/course/${courseId}`),
  getById: (id) => api.get(`/lessons/${id}`),
  create: (data) => api.post('/lessons', data),
  update: (id, data) => api.put(`/lessons/${id}`, data),
  submitForReview: (id) => api.post(`/lessons/${id}/submit-review`),
  setPublish: (id, isPublished) => api.patch(`/lessons/${id}/publish`, { isPublished }),
  reorder: (courseId, lessonOrders) => api.put(`/lessons/course/${courseId}/reorder`, { lessonOrders }),
  delete: (id) => api.delete(`/lessons/${id}`),
  uploadFile: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/lessons/${id}/upload-file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  updateProgress: (id, watchPercentage) => api.post(`/lessons/${id}/progress`, { watchPercentage }),
  downloadFile: (id) => api.get(`/lessons/${id}/file`, { responseType: 'blob' }),
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
  trackPublicEvent: (data) => api.post('/analytics/public', data),
  getStudentProgress: () => api.get('/analytics/student'),
  getCourseProgress: (courseId) => api.get(`/analytics/student/course/${courseId}`),
  getInstructorAnalytics: () => api.get('/analytics/instructor'),
  getAdminAnalytics: () => api.get('/analytics/admin'),
  getAdminAnalyticsCenter: (params) => api.get('/analytics/admin/measurement-center', { params }),
  getAdminCoursesByInstructor: () => api.get('/analytics/admin/courses-by-instructor'),
  getAdminInstructors: () => api.get('/analytics/admin/instructors'),
  getAdminInstructorDetail: (id) => api.get(`/analytics/admin/instructors/${id}`),
  getLessonAnalytics: (lessonId) => api.get(`/analytics/lesson/${lessonId}`)
};

export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  remove: (id) => api.delete(`/notifications/${id}`),
  clearAll: () => api.delete('/notifications/clear-all'),
};

export const searchAPI = {
  search: (q) => api.get('/search', { params: { q } }),
};

export const financeAPI = {
  getOverview: (params) => api.get('/finance/overview', { params }),
  getSettings: () => api.get('/finance/settings'),
  updateSettings: (data) => api.put('/finance/settings', data),
  getInstructorProfile: (id) => api.get(`/finance/instructors/${id}/profile`),
  getEarnings: (params) => api.get('/finance/earnings', { params }),
  bulkEarnings: (payload) => api.patch('/finance/earnings/bulk', payload),
  exportEarnings: (params) => api.get('/finance/export/earnings.csv', { params, responseType: 'blob' }),
  getAllocations: (packageId) => api.get('/finance/allocations', { params: { package: packageId } }),
  saveAllocations: (payload) => api.post('/finance/allocations', payload),
  getPayoutBatches: (instructor) => api.get('/finance/payout-batches', { params: { instructor } }),
  createPayoutBatch: (payload) => api.post('/finance/payout-batches', payload),
  approvePayoutBatch: (id) => api.patch(`/finance/payout-batches/${id}/approve`),
  settlePayoutBatch: (id, payload) => api.patch(`/finance/payout-batches/${id}/settle`, payload),
  cancelPayoutBatch: (id) => api.patch(`/finance/payout-batches/${id}/cancel`),
  recordChargeback: (payload) => api.post('/finance/chargebacks', payload),
  getRecoveries: () => api.get('/finance/recoveries'),
  getAudit: (params) => api.get('/finance/audit', { params }),
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
  create: (formData) => api.post('/team-members', formData),
  update: (id, formData) => api.put(`/team-members/${id}`, formData),
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

export const authenticationAPI = {
  getPublic: () => api.get('/authentication'),
  getAll: () => api.get('/authentication/admin'),
  getById: (id) => api.get(`/authentication/admin/${id}`),
  create: (formData) => api.post('/authentication', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, formData) => api.put(`/authentication/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  remove: (id) => api.delete(`/authentication/${id}`)
};

export const whatsappSettingsAPI = {
  getPublic: () => api.get('/whatsapp-settings'),
  getAdmin: () => api.get('/whatsapp-settings/admin'),
  update: (data) => api.put('/whatsapp-settings/admin', data),
};

export const instructorApplicationsAPI = {
  submit: (formData) => api.post('/instructor-applications', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getAll: (status) => api.get('/instructor-applications', { params: { status } }),
  getById: (id) => api.get(`/instructor-applications/${id}`),
  downloadFile: (id, field) => api.get(`/instructor-applications/${id}/files/${field}`, { responseType: 'blob' }),
  approve: (id) => api.patch(`/instructor-applications/${id}/approve`),
  reject: (id, reason) => api.patch(`/instructor-applications/${id}/reject`, { reason }),
  remove: (id) => api.delete(`/instructor-applications/${id}`)
};

export const studioApplicationsAPI = {
  submit: (data) => api.post('/studio-applications', data),
  getAll: (status) => api.get('/studio-applications', { params: { status } }),
  getById: (id) => api.get(`/studio-applications/${id}`),
  approve: (id) => api.patch(`/studio-applications/${id}/approve`),
  reject: (id, reason) => api.patch(`/studio-applications/${id}/reject`, { reason }),
  remove: (id) => api.delete(`/studio-applications/${id}`)
};

export const consultationsAPI = {
  getActive: () => api.get('/consultations'),
  getAll: () => api.get('/consultations/admin'),
  getById: (id) => api.get(`/consultations/${id}`),
  create: (data) => api.post('/consultations', data),
  update: (id, data) => api.put(`/consultations/${id}`, data),
  remove: (id) => api.delete(`/consultations/${id}`)
};

export const consultationBookingsAPI = {
  submit: (data) => api.post('/consultation-bookings', data),
  createCheckout: (data) => api.post('/consultation-bookings/checkout', data),
  getMy: () => api.get('/consultation-bookings/my'),
  getAll: (status) => api.get('/consultation-bookings', { params: { status } }),
  getById: (id) => api.get(`/consultation-bookings/${id}`),
  confirm: (id) => api.patch(`/consultation-bookings/${id}/confirm`),
  reject: (id, reason) => api.patch(`/consultation-bookings/${id}/reject`, { reason }),
  cancel: (id) => api.patch(`/consultation-bookings/${id}/cancel`),
  remove: (id) => api.delete(`/consultation-bookings/${id}`)
};

export const videoAPI = {
  getList: (params) => api.get('/video/list', { params }),
  getDetails: (videoId) => api.get(`/video/details/${videoId}`),
  assign: (lessonId, vimeoVideoId) => api.post('/video/assign', { lessonId, vimeoVideoId }),
  syncSecurity: (lessonId) => api.post('/video/sync-security', lessonId ? { lessonId } : {}),
  getEmbed: (lessonId) => api.get(`/video/embed/${lessonId}`),
  validateToken: () => api.get('/video/validate-token'),
};

export default api;
