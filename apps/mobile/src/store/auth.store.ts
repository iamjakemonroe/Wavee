import { create } from "zustand";
import { AppUser, AuthSession } from "@/types/entities";

interface AuthState {
  session: AuthSession | null;
  profile: AppUser | null;
  isBootstrapping: boolean;
  setSession: (session: AuthSession | null) => void;
  setProfile: (profile: AppUser | null) => void;
  setBootstrapping: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isBootstrapping: true,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setBootstrapping: (value) => set({ isBootstrapping: value }),
}));
