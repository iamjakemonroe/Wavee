const LOOKS_TECHNICAL =
  /constraint|duplicate key|violates unique|postgres|postgrest|sqlstate|pgrst|internal server error/i;

const FALLBACK_SIGNIN = "We couldn't sign you in. Please try again.";
const FALLBACK_SIGNUP = "We couldn't create your account. Please try again.";

export function formatAuthErrorMessage(
  error: unknown,
  mode: "signin" | "signup"
): string {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const trimmed = msg.trim();
  const fallback = mode === "signin" ? FALLBACK_SIGNIN : FALLBACK_SIGNUP;
  if (!trimmed) return fallback;
  if (LOOKS_TECHNICAL.test(trimmed)) return fallback;
  return trimmed;
}
