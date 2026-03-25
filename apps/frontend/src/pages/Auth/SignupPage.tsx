import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useSignupMutation } from "@/hooks/mutations/useAuthMutation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { WaveeLogo } from "@/components/ui/WaveeLogo";
import {
  AUTH_ERROR_FALLBACK_SIGNUP,
  formatAuthErrorMessage,
} from "@/utils/authErrorMessage";

export function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const mutation = useSignupMutation();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { email, password, username },
      {
        onSuccess: () => {
          setSuccess(true);
        },
      },
    );
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wavee-bg bg-wavee-gradient p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <WaveeLogo size={64} className="mx-auto mb-4 rounded-2xl shadow-neon" />
          <h2 className="text-2xl font-bold">Check your email</h2>
          <p className="mt-2 text-wavee-muted">
            We sent a confirmation link
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-wavee-bg bg-wavee-gradient p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <WaveeLogo size={48} className="rounded-2xl shadow-neon" />
          <h1 className="text-2xl font-black tracking-tight text-gradient">
            Create account
          </h1>
          <p className="text-sm text-wavee-muted">Join the next wave of music</p>
        </div>

        <GlassPanel className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="username"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourname"
              required
            />
            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
            />
            <Input
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              minLength={8}
              required
            />

            {mutation.error && (
              <p className="text-sm text-wavee-danger">
                {formatAuthErrorMessage(mutation.error, AUTH_ERROR_FALLBACK_SIGNUP)}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={mutation.isPending}
            >
              Create Account
            </Button>
          </form>
        </GlassPanel>

        <p className="mt-4 text-center text-sm text-wavee-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-wavee-primary hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
