import { useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import { FiUploadCloud, FiMusic, FiImage, FiCheck } from "react-icons/fi";
import { useUploadSongMutation } from "@/hooks/mutations/useUploadSongMutation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassPanel } from "@/components/ui/GlassPanel";

export function UploadPage() {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const mutation = useUploadSongMutation();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!audioFile) return;
    mutation.mutate(
      { title, genre, audioFile, coverFile: coverFile ?? undefined },
      {
        onSuccess: () => {
          setTitle("");
          setGenre("");
          setAudioFile(null);
          setCoverFile(null);
        },
      },
    );
  };

  return (
    <section>
      <header className="mb-6">
        <h2 className="text-3xl font-black tracking-tight">Upload</h2>
        <p className="mt-1 text-sm text-wavee-muted">
          Share your music with the world
        </p>
      </header>

      <GlassPanel className="max-w-lg p-6">
        {mutation.isSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-8"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-wavee-primary/20">
              <FiCheck className="text-wavee-primary" size={28} />
            </div>
            <p className="text-lg font-semibold">Track uploaded</p>
            <Button variant="ghost" onClick={() => mutation.reset()}>
              Upload another
            </Button>
          </motion.div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <Input
              id="title"
              label="Song title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My awesome track"
              required
            />
            <Input
              id="genre"
              label="Genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="electronic, lofi, hip-hop..."
              required
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-wavee-muted">
                Audio file
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-wavee-border p-4 transition-colors hover:border-wavee-primary/40">
                <FiMusic className="shrink-0 text-wavee-muted" size={20} />
                <span className="truncate text-sm text-wavee-muted">
                  {audioFile ? audioFile.name : "Choose audio file (MP3, WAV)"}
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                  required
                />
              </label>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-wavee-muted">
                Cover image (optional)
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-wavee-border p-4 transition-colors hover:border-wavee-primary/40">
                <FiImage className="shrink-0 text-wavee-muted" size={20} />
                <span className="truncate text-sm text-wavee-muted">
                  {coverFile ? coverFile.name : "Choose cover image"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

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
              <FiUploadCloud size={18} />
              {mutation.isPending ? "Uploading..." : "Upload Track"}
            </Button>
          </form>
        )}
      </GlassPanel>
    </section>
  );
}
