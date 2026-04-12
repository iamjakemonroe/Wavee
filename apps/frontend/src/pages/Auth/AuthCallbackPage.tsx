import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { WaveeLogo } from "@/components/ui/WaveeLogo";

function hashParams(): URLSearchParams {
  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(raw);
}

function redirectQueryForAuthError(params: URLSearchParams): "expired" | "failed" {
  const code = params.get("error_code");
  const desc = params.get("error_description") ?? "";
  const err = params.get("error") ?? "";
  const combined = `${code} ${desc} ${err}`.toLowerCase();
  if (
    code === "otp_expired" ||
    /expired|invalid.*link|link.*invalid/.test(combined)
  ) {
    return "expired";
  }
  return "failed";
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = hashParams();
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error || errorDescription) {
      const q = redirectQueryForAuthError(params);
      navigate(`/login?verification=${q}`, { replace: true });
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken) {
      login(accessToken, refreshToken);
      navigate("/", { replace: true });
      return;
    }

    navigate("/login?verification=failed", { replace: true });
  }, [login, navigate]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-wavee-bg">
      <div className="text-center">
        <WaveeLogo size={48} className="mx-auto mb-4 animate-pulse rounded-2xl" />
        <p className="text-sm text-wavee-muted">Confirming your account…</p>
      </div>
    </div>
  );
}
