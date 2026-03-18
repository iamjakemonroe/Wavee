import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { authSessionStorage } from "@/lib/api";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";

export function useAuthBootstrap() {
  const segments = useSegments();
  const router = useRouter();
  const {
    session,
    setSession,
    setProfile,
    isBootstrapping,
    setBootstrapping,
  } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const accessToken = await authSessionStorage.getAccessToken();
      if (!mounted) return;

      if (!accessToken) {
        setSession(null);
        setProfile(null);
        setBootstrapping(false);
        return;
      }

      try {
        const profile = await authService.getProfile();
        setSession({
          access_token: accessToken,
          refresh_token: "",
        });
        setProfile(profile);
      } catch {
        await authSessionStorage.clear();
        setSession(null);
        setProfile(null);
      }

      setBootstrapping(false);
    };

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [setBootstrapping, setProfile, setSession]);

  useEffect(() => {
    if (isBootstrapping) return;

    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) {
      router.replace("/(auth)/onboarding");
      return;
    }
    if (session && inAuthGroup) {
      router.replace("/(app)/home");
    }
  }, [isBootstrapping, router, segments, session]);
}
