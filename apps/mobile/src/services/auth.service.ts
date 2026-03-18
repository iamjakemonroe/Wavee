import { api, authSessionStorage } from "@/lib/api";
import { AppUser, AuthSession } from "@/types/entities";
import { useAuthStore } from "@/store/auth.store";

interface AuthPayload {
  email: string;
  password: string;
  username?: string;
}

export const authService = {
  async signIn(payload: AuthPayload) {
    const data = await api.post<{ user: unknown; session: AuthSession }>("/v1/auth/signin", {
      email: payload.email,
      password: payload.password,
    });
    await authSessionStorage.save(data.session.access_token, data.session.refresh_token);
    const profile = await this.getProfile();
    useAuthStore.getState().setSession(data.session);
    useAuthStore.getState().setProfile(profile);
    return data;
  },

  async signUp(payload: AuthPayload) {
    const data = await api.post<{ user: unknown; session: AuthSession | null }>("/v1/auth/signup", {
      email: payload.email,
      password: payload.password,
      username: payload.username,
    });
    if (data.session) {
      await authSessionStorage.save(data.session.access_token, data.session.refresh_token);
      const profile = await this.getProfile();
      useAuthStore.getState().setSession(data.session);
      useAuthStore.getState().setProfile(profile);
    }
    return data;
  },

  async signOut() {
    await authSessionStorage.clear();
    useAuthStore.getState().setSession(null);
    useAuthStore.getState().setProfile(null);
  },

  async getProfile() {
    return api.get<AppUser>("/v1/auth/me");
  },
};
