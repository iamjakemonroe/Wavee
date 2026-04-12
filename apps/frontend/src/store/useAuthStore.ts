import { create } from "zustand";
import { clearAuthToken, getAuthToken, setAuthTokens } from "@/utils/authToken";
import { usePlayerStore } from "@/store/usePlayerStore";

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken?: string | null) => void;
  syncFromStorage: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getAuthToken(),
  isAuthenticated: Boolean(getAuthToken()),

  login: (accessToken, refreshToken) => {
    setAuthTokens(accessToken, refreshToken ?? undefined);
    set({ token: accessToken, isAuthenticated: true });
  },

  syncFromStorage: () => {
    const token = getAuthToken();
    set({ token, isAuthenticated: Boolean(token) });
  },

  logout: () => {
    clearAuthToken();
    usePlayerStore.getState().reset();
    set({ token: null, isAuthenticated: false });
  },
}));
