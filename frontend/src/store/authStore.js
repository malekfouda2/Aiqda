import { create } from 'zustand';
import { authAPI, usersAPI } from '../services/api';
import { PLATFORM_NOTICE_VERSION } from '../content/platformNotice';

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login({ email, password });
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isLoading: false });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  register: async (name, email, password, role = 'student', platformNoticeAccepted = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.register({ name, email, password, role, platformNoticeAccepted });
      const { user, token } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isLoading: false });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  completeSocialLogin: async (loginToken) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.completeSocialLogin({ token: loginToken });
      const { user, token, redirectPath } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      set({ user, token, isLoading: false });
      return { success: true, redirectPath };
    } catch (error) {
      const message = error.response?.data?.error || 'Social login failed';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },

  refreshProfile: async () => {
    try {
      const response = await authAPI.getProfile();
      const user = response.data;
      localStorage.setItem('user', JSON.stringify(user));
      set({ user });
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  },

  acknowledgePlatformNotice: async () => {
    try {
      const response = await usersAPI.acknowledgePlatformNotice();
      const user = response.data;
      localStorage.setItem('user', JSON.stringify(user));
      set({ user });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to save acknowledgement';
      return { success: false, error: message };
    }
  },

  isAuthenticated: () => !!get().token,
  isAdmin: () => get().user?.role === 'admin',
  isInstructor: () => ['instructor', 'admin'].includes(get().user?.role),
  isStudent: () => get().user?.role === 'student',
  hasAcceptedCurrentPlatformNotice: () => {
    const acknowledgement = get().user?.platformNoticeAcknowledgement;
    return acknowledgement?.version === PLATFORM_NOTICE_VERSION && Boolean(acknowledgement?.acceptedAt);
  }
}));

export default useAuthStore;
