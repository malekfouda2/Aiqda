import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarOpen: false,
  notifications: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),

  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, { id: Date.now(), ...notification }]
  })),

  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),

  showSuccess: (message) => set((state) => ({
    notifications: [...state.notifications, { id: Date.now(), type: 'success', message }]
  })),

  showError: (message) => set((state) => ({
    notifications: [...state.notifications, { id: Date.now(), type: 'error', message }]
  }))
}));

export default useUIStore;
