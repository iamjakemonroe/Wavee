import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiDisc } from "react-icons/fi";
import { useLoginMutation } from "@/hooks/mutations/useAuthMutation";
import { useAuthStore } from "@/store/useAuthStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassPanel } from "@/components/ui/GlassPanel";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const mutation = useLoginMutation();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          if (data.session?.access_token) {
            login(data.session.access_token);
            navigate("/");
          }
        },
      },
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-wavee-bg bg-wavee-gradient p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-wavee-primary to-wavee-secondary shadow-neon">
            <FiDisc className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gradient">
            Welcome back
          </h1>
          <p className="text-sm text-wavee-muted">Sign in to continue listening</p>
        </div>

        <GlassPanel className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="Your password"
              required
            />

            {mutation.error && (
              <p className="text-sm text-wavee-danger">
                {(mutation.error as Error).message}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={mutation.isPending}
            >
              Sign In
            </Button>
          </form>
        </GlassPanel>

        <p className="mt-4 text-center text-sm text-wavee-muted">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="text-wavee-primary hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
