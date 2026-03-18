import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/auth.store";

export default function Index() {
  const session = useAuthStore((state) => state.session);
  return <Redirect href={session ? "/(app)/home" : "/(auth)/onboarding"} />;
}
