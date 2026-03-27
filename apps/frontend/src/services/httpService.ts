import type { ApiResponse } from "@/types/api";
import { apiEndpoints } from "@/services/apiEndpoints";
import { shouldIgnoreUnauthorizedRedirect } from "@/services/ignoreUnauthorizedRedirectUrls";
import { getAuthToken, getRefreshToken, setAuthTokens } from "@/utils/authToken";
import { useAuthStore } from "@/store/useAuthStore";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

interface SessionPayload {
  session: {
    access_token: string;
    refresh_token: string;
  } | null;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${baseURL}${apiEndpoints.auth.refresh}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      const payload = (await res.json()) as ApiResponse<SessionPayload>;
      if (!res.ok || !payload.ok || !payload.data?.session?.access_token) {
        return false;
      }
      const { access_token, refresh_token } = payload.data.session;
      setAuthTokens(access_token, refresh_token);
      useAuthStore.getState().syncFromStorage();
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

class HttpService {
  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    data?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    const send = async () => {
      const token = getAuthToken();
      const headers = new Headers(init?.headers);
      const isFormData = data instanceof FormData;

      const body: BodyInit | undefined =
        data === undefined
          ? undefined
          : isFormData
            ? (data as BodyInit)
            : JSON.stringify(data);

      if (!isFormData && body !== undefined) {
        headers.set("Content-Type", "application/json");
      }
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      return fetch(`${baseURL}${url}`, {
        ...init,
        method,
        headers,
        body,
      });
    };

    let response = await send();
    let payload = (await response.json()) as ApiResponse<T>;

    if (response.status === 401 && getRefreshToken()) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        response = await send();
        payload = (await response.json()) as ApiResponse<T>;
      }
    }

    if (!response.ok || !payload.ok) {
      if (
        response.status === 401 &&
        !shouldIgnoreUnauthorizedRedirect(url)
      ) {
        window.dispatchEvent(new CustomEvent("wavee:unauthorized"));
      }
      throw new Error(payload.error?.message ?? "Request failed");
    }

    return payload.data;
  }

  get<T>(url: string, init?: RequestInit) {
    return this.request<T>("GET", url, undefined, init);
  }

  post<T>(url: string, data?: unknown, init?: RequestInit) {
    return this.request<T>("POST", url, data, init);
  }

  patch<T>(url: string, data?: unknown, init?: RequestInit) {
    return this.request<T>("PATCH", url, data, init);
  }

  delete<T>(url: string, init?: RequestInit) {
    return this.request<T>("DELETE", url, undefined, init);
  }
}

export const httpService = new HttpService();
