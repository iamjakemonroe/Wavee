import { apiEndpoints } from "@/services/apiEndpoints";

/**
 * API paths where HTTP 401 means “invalid credentials” (or similar), not “session expired”.
 * Do not dispatch `wavee:unauthorized` for these — otherwise auth pages full-reload and hide errors.
 */
export const IGNORE_REDIRECTION_FOR_API_URLS: readonly string[] = [
  apiEndpoints.auth.signin,
  apiEndpoints.auth.signup,
];

export function shouldIgnoreUnauthorizedRedirect(requestPath: string): boolean {
  const path = requestPath.split("?")[0] ?? requestPath;
  return IGNORE_REDIRECTION_FOR_API_URLS.some((prefix) => path === prefix);
}
