import { useMutation } from "@tanstack/react-query";
import { apiEndpoints } from "@/services/apiEndpoints";
import { httpService } from "@/services/httpService";

interface LoginPayload {
  email: string;
  password: string;
}

interface SignupPayload {
  email: string;
  password: string;
  username: string;
}

interface AuthResponse {
  session: {
    access_token: string;
    refresh_token: string;
  } | null;
  user: unknown;
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      httpService.post<AuthResponse>(apiEndpoints.auth.signin, payload),
  });
}

export function useSignupMutation() {
  return useMutation({
    mutationFn: (payload: SignupPayload) =>
      httpService.post<AuthResponse>(apiEndpoints.auth.signup, payload),
  });
}
