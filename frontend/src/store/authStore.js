import { create } from 'zustand';
import { authAPI, usersAPI } from '../services/api';
import { PLATFORM_NOTICE_VERSION } from '../content/platformNotice';
import { canAccessAdminPanel, canAccessInstructorPanel, canAccessMemberDashboard, isAdminRole } from '../utils/roles';

const useAuthStore = create((set, get) => ({
  user: null,
  isLoading: false,
  isHydrating: false,
  hasHydrated: false,
  error: null,

  initializeAuth: async () => {
    if (get().isHydrating || get().hasHydrated) {
      return;
    }

    set({ isHydrating: true, error: null });
    try {
      const response = await authAPI.getProfile();
      set({
        user: response.data,
        isHydrating: false,
        hasHydrated: true,
      });
    } catch {
      if (get().user) {
        set({
          isHydrating: false,
          hasHydrated: true,
        });
        return;
      }

      set({
        user: null,
        isHydrating: false,
        hasHydrated: true,
      });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login({ email, password });
      set({
        user: response.data.user,
        isLoading: false,
        isHydrating: false,
        hasHydrated: true,
      });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      set({ error: message, isLoading: false, isHydrating: false });
      return { success: false, error: message };
    }
  },

  register: async (name, email, password, role = 'student', platformNoticeAccepted = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.register({ name, email, password, role, platformNoticeAccepted });
      set({
        user: response.data.user,
        isLoading: false,
        isHydrating: false,
        hasHydrated: true,
      });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      set({ error: message, isLoading: false, isHydrating: false });
      return { success: false, error: message };
    }
  },

  completeSocialLogin: async (loginToken) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.completeSocialLogin({ token: loginToken });
      set({
        user: response.data.user,
        isLoading: false,
        isHydrating: false,
        hasHydrated: true,
      });
      return { success: true, redirectPath: response.data.redirectPath };
    } catch (error) {
      const message = error.response?.data?.error || 'Social login failed';
      set({ error: message, isLoading: false, isHydrating: false });
      return { success: false, error: message };
    }
  },

  logout: async () => {
    set({ user: null, error: null, isHydrating: false, hasHydrated: true });
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Failed to clear the server session:', error);
    }
  },

  refreshProfile: async () => {
    try {
      const response = await authAPI.getProfile();
      set({ user: response.data, hasHydrated: true });
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      if (error.response?.status === 401) {
        set({ user: null, hasHydrated: true });
      }
    }
  },

  acknowledgePlatformNotice: async () => {
    try {
      const response = await usersAPI.acknowledgePlatformNotice();
      set({ user: response.data });
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to save acknowledgement';
      return { success: false, error: message };
    }
  },

  isAuthenticated: () => !!get().user,
  isAdmin: () => isAdminRole(get().user?.role),
  canAccessAdminPanel: () => canAccessAdminPanel(get().user?.role),
  isInstructor: () => canAccessInstructorPanel(get().user?.role),
  isStudent: () => get().user?.role === 'student',
  canAccessMemberDashboard: () => canAccessMemberDashboard(get().user?.role),
  hasAcceptedCurrentPlatformNotice: () => {
    const acknowledgement = get().user?.platformNoticeAcknowledgement;
    return acknowledgement?.version === PLATFORM_NOTICE_VERSION && Boolean(acknowledgement?.acceptedAt);
  }
}));

export default useAuthStore;
