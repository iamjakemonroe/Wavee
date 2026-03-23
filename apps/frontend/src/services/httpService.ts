import type { ApiResponse } from "@/types/api";
import { getAuthToken } from "@/utils/authToken";

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

class HttpService {
  private async request<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    url: string,
    data?: unknown,
    init?: RequestInit
  ): Promise<T> {
    const token = getAuthToken();
    const headers = new Headers(init?.headers);
    const isFormData = data instanceof FormData;

    if (!isFormData) {
      headers.set("Content-Type", "application/json");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${baseURL}${url}`, {
      ...init,
      method,
      headers,
      body:
        data === undefined
          ? undefined
          : isFormData
            ? (data as BodyInit)
            : JSON.stringify(data),
    });

    const payload = (await response.json()) as ApiResponse<T>;
    if (!response.ok || !payload.ok) {
      if (response.status === 401) {
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
