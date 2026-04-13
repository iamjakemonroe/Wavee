/**
 * Maps raw Supabase Auth and Postgres/PostgREST errors to messages safe for end users.
 * Technical details stay in server logs only.
 */

const GENERIC_SIGNUP = "We couldn't create your account. Please try again.";
const GENERIC_SIGNIN = "We couldn't sign you in. Please try again.";

function looksLikeTechnicalError(message: string): boolean {
  return /constraint|duplicate key|violates unique|postgres|postgrest|sqlstate|pgrst/i.test(
    message,
  );
}

/** Supabase Auth (GoTrue) signup / sign-in error strings */
export function mapSupabaseAuthErrorMessage(
  raw: string | undefined,
  context: "signup" | "signin",
): string {
  if (!raw || !raw.trim()) {
    return context === "signin" ? GENERIC_SIGNIN : GENERIC_SIGNUP;
  }

  const lower = raw.toLowerCase();

  if (context === "signup") {
    if (
      lower.includes("already registered") ||
      lower.includes("user already") ||
      (lower.includes("email") && lower.includes("already"))
    ) {
      return "An account with this email already exists. Try signing in instead.";
    }
    if (lower.includes("rate limit") || lower.includes("too many")) {
      return "Too many attempts. Please wait a few minutes and try again.";
    }
    if (
      lower.includes("password") &&
      (lower.includes("short") || lower.includes("least"))
    ) {
      return "Your password doesn't meet the requirements. Use at least 8 characters.";
    }
    if (lower.includes("invalid") && lower.includes("email")) {
      return "Enter a valid email address.";
    }
  }

  if (context === "signin") {
    if (
      lower.includes("invalid login") ||
      lower.includes("invalid credentials") ||
      (lower.includes("invalid") && lower.includes("password"))
    ) {
      return "Incorrect email or password.";
    }
    if (
      lower.includes("email not confirmed") ||
      lower.includes("not verified")
    ) {
      return "Confirm your email before signing in. Check your inbox for the link.";
    }
    if (lower.includes("user not found")) {
      return "No account found with this email.";
    }
    if (lower.includes("rate limit") || lower.includes("too many")) {
      return "Too many sign-in attempts. Please wait a few minutes and try again.";
    }
  }

  if (looksLikeTechnicalError(raw)) {
    return context === "signin" ? GENERIC_SIGNIN : GENERIC_SIGNUP;
  }

  return raw;
}

/** PostgREST / Postgres errors from public.users upsert after auth signup */
export function mapProfileUpsertError(
  raw: string | undefined,
  code?: string,
): string {
  const msg = (raw ?? "").toLowerCase();
  const isUnique =
    code === "23505" ||
    msg.includes("duplicate key") ||
    msg.includes("unique constraint");

  if (!isUnique) {
    return looksLikeTechnicalError(raw ?? "")
      ? "We couldn't finish setting up your account. Please try again or contact support."
      : (raw ?? "We couldn't finish setting up your account.");
  }

  if (msg.includes("users_email_key") || msg.includes("(email)")) {
    return "An account with this email already exists. Try signing in instead.";
  }

  return "An account with this email already exists. Try signing in instead.";
}
