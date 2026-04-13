/** User-safe messages for profile updates; raw DB errors stay in logs only. */
export function mapProfileUpdateError(
  raw: string | undefined,
  _code?: string,
): string {
  if (/constraint|duplicate key|violates|postgres|postgrest/i.test(raw ?? "")) {
    return "We couldn't update your profile. Please try again.";
  }

  return raw?.trim() || "We couldn't update your profile.";
}
