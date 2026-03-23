export interface ApiErrorPayload {
  message: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  error?: ApiErrorPayload;
}
