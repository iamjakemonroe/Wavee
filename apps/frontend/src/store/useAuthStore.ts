import { create } from "zustand";
import { getAuthToken, setAuthToken, clearAuthToken } from "@/utils/authToken";

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getAuthToken(),
  isAuthenticated: Boolean(getAuthToken()),

  login: (token) => {
    setAuthToken(token);
    set({ token, isAuthenticated: true });
  },

  logout: () => {
    clearAuthToken();
    set({ token: null, isAuthenticated: false });
  },
}));
