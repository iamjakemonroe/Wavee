/** User-safe messages for profile updates; raw DB errors stay in logs only. */
export function mapProfileUpdateError(raw: string | undefined, code?: string): string {
  const msg = (raw ?? "").toLowerCase();
  const isUnique =
    code === "23505" || msg.includes("duplicate key") || msg.includes("unique constraint");

  if (isUnique && (msg.includes("users_username_key") || msg.includes("(username)"))) {
    return "This username is already taken. Try another one.";
  }

  if (/constraint|duplicate key|violates|postgres|postgrest/i.test(raw ?? "")) {
    return "We couldn't update your profile. Please try again.";
  }

  return raw?.trim() || "We couldn't update your profile.";
}
