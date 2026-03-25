/** Matches backend `authErrors` technical patterns — last line of defense if the API misbehaves. */
const LOOKS_TECHNICAL =
  /constraint|duplicate key|violates unique|postgres|postgrest|sqlstate|pgrst|internal server error/i;

export const AUTH_ERROR_FALLBACK_SIGNIN =
  "We couldn't sign you in. Please try again.";
export const AUTH_ERROR_FALLBACK_SIGNUP =
  "We couldn't create your account. Please try again.";

export function formatAuthErrorMessage(
  error: unknown,
  fallback: string
): string {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const trimmed = msg.trim();
  if (!trimmed) return fallback;
  if (LOOKS_TECHNICAL.test(trimmed)) return fallback;
  return trimmed;
}

export function formatVerificationCallbackError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "We couldn't verify your email. Please try signing in again.";
  }
  if (LOOKS_TECHNICAL.test(trimmed)) {
    return "We couldn't verify your email. Please try signing in again.";
  }
  return trimmed;
}
