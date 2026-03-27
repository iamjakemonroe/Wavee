const ACCESS_KEY = "wavee_web_access_token";
const REFRESH_KEY = "wavee_web_refresh_token";

export function getAuthToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

/** Persist tokens. Empty refresh removes the key (no silent renewal until next sign-in). */
export function setAuthTokens(accessToken: string, refreshToken?: string | null) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
}

export function clearAuthToken() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
