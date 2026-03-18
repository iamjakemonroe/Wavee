import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error("Missing EXPO_PUBLIC_API_URL in mobile environment");
}

const TOKEN_KEY = "wavee_access_token";
const REFRESH_TOKEN_KEY = "wavee_refresh_token";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  contentType?: string;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers);

  if (options.contentType !== "multipart/form-data") {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body === undefined || options.body instanceof FormData
        ? (options.body as BodyInit | undefined)
        : JSON.stringify(options.body),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    data?: T;
    error?: { message?: string };
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error?.message ?? "API request failed");
  }

  return payload.data as T;
}

export const authSessionStorage = {
  async save(accessToken: string, refreshToken: string) {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, accessToken],
      [REFRESH_TOKEN_KEY, refreshToken],
    ]);
  },

  async clear() {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
  },

  async getAccessToken() {
    return AsyncStorage.getItem(TOKEN_KEY);
  },
};

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postFormData: <T>(path: string, body: FormData) =>
    request<T>(path, {
      method: "POST",
      body,
      contentType: "multipart/form-data",
    }),
};
