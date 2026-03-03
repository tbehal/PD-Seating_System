import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  authenticated: null,
  setAuthenticated: (val) => set({ authenticated: val }),
}));
