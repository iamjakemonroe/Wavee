import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { WaveeLogo } from "@/components/ui/WaveeLogo";
import { formatVerificationCallbackError } from "@/utils/authErrorMessage";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const errorDescription = params.get("error_description");

    if (errorDescription) {
      setError(formatVerificationCallbackError(decodeURIComponent(errorDescription)));
      return;
    }

    if (accessToken) {
      login(accessToken);
      navigate("/", { replace: true });
    } else {
      setError("No authentication token received. Please try signing in again.");
    }
  }, [login, navigate]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-wavee-bg p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-wavee-danger/10">
            <span className="text-2xl">✕</span>
          </div>
          <h2 className="mb-2 text-lg font-bold text-wavee-text">
            Verification Failed
          </h2>
          <p className="mb-6 text-sm text-wavee-muted">{error}</p>
          <a
            href="/login"
            className="inline-block rounded-xl bg-wavee-primary px-6 py-3 font-semibold text-black transition-all hover:shadow-neon"
          >
            Go to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-wavee-bg">
      <div className="text-center">
        <WaveeLogo size={48} className="mx-auto mb-4 animate-pulse rounded-2xl" />
        <p className="text-sm text-wavee-muted">Confirming your account...</p>
      </div>
    </div>
  );
}
