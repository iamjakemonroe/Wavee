import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiUploadCloud, FiMusic, FiImage, FiCheck, FiLogIn } from "react-icons/fi";
import { useUploadSongMutation } from "@/hooks/mutations/useUploadSongMutation";
import { clearUploadDraft, loadUploadDraft, saveUploadDraft } from "@/lib/uploadDraftIDB";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAuthStore } from "@/store/useAuthStore";
import { AUDIO_ACCEPT_ATTR, isAllowedAudioFile } from "@/utils/audioFileAccept";

const DRAFT_SAVE_MS = 450;

function recordFromState(args: {
  title: string;
  genre: string;
  audioFile: File;
  coverFile: File | null;
}) {
  return {
    title: args.title,
    genre: args.genre,
    audioName: args.audioFile.name,
    audioType: args.audioFile.type || "audio/mpeg",
    audioBlob: args.audioFile,
    coverName: args.coverFile?.name,
    coverType: args.coverFile?.type,
    coverBlob: args.coverFile ?? undefined,
  };
}

function UploadPageSignedOut() {
  return (
    <section>
      <header className="mb-6">
        <h2 className="text-3xl font-black tracking-tight">Upload</h2>
        <p className="mt-1 text-sm text-wavee-muted">
          Share your music with the world
        </p>
      </header>

      <GlassPanel className="max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/[0.08]">
          <FiLogIn className="text-wavee-muted" size={28} />
        </div>
        <h3 className="text-lg font-semibold text-wavee-text">Sign in to upload</h3>
        <p className="mt-2 text-sm text-wavee-muted">
          Log in to add tracks, cover art, and share your sound with listeners.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/login" className="sm:flex-1 sm:max-w-[11rem]">
            <Button type="button" className="w-full" size="lg">
              Log in
            </Button>
          </Link>
          <Link to="/signup" className="sm:flex-1 sm:max-w-[11rem]">
            <Button type="button" variant="secondary" className="w-full" size="lg">
              Create account
            </Button>
          </Link>
        </div>
      </GlassPanel>
    </section>
  );
}

function UploadPageForm() {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [audioHint, setAudioHint] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef(title);
  const genreRef = useRef(genre);
  const mutation = useUploadSongMutation();

  titleRef.current = title;
  genreRef.current = genre;

  useEffect(() => {
    let cancelled = false;
    void loadUploadDraft().then((d) => {
      if (cancelled || !d) {
        if (!cancelled) setDraftReady(true);
        return;
      }
      setTitle(d.title);
      setGenre(d.genre);
      setAudioFile(
        new File([d.audioBlob], d.audioName, {
          type: d.audioType || "audio/mpeg",
        }),
      );
      if (d.coverBlob && d.coverName) {
        setCoverFile(
          new File([d.coverBlob], d.coverName, {
            type: d.coverType || "image/jpeg",
          }),
        );
      }
      setDraftReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (!draftReady || !audioFile) return;
    void saveUploadDraft(
      recordFromState({
        title: titleRef.current,
        genre: genreRef.current,
        audioFile,
        coverFile,
      }),
    );
  }, [draftReady, audioFile, coverFile]);

  useEffect(() => {
    if (!draftReady || !audioFile) return;
    const t = window.setTimeout(() => {
      void saveUploadDraft(
        recordFromState({ title, genre, audioFile, coverFile }),
      );
    }, DRAFT_SAVE_MS);
    return () => window.clearTimeout(t);
  }, [draftReady, title, genre, audioFile, coverFile]);

  useEffect(() => {
    if (!draftReady) return;
    if (audioFile) return;
    const t = window.setTimeout(() => {
      void clearUploadDraft();
    }, DRAFT_SAVE_MS);
    return () => window.clearTimeout(t);
  }, [draftReady, audioFile]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void loadUploadDraft().then((d) => {
        if (!d?.audioBlob) return;
        setAudioFile((prev) => {
          if (prev != null) return prev;
          queueMicrotask(() => {
            setTitle(d.title);
            setGenre(d.genre);
            if (d.coverBlob && d.coverName) {
              setCoverFile(
                new File([d.coverBlob], d.coverName, {
                  type: d.coverType || "image/jpeg",
                }),
              );
            } else {
              setCoverFile(null);
            }
          });
          return new File([d.audioBlob], d.audioName, {
            type: d.audioType || "audio/mpeg",
          });
        });
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!draftReady || !audioFile) return;
    const persist = () => {
      void saveUploadDraft(
        recordFromState({
          title: titleRef.current,
          genre: genreRef.current,
          audioFile,
          coverFile,
        }),
      );
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [draftReady, audioFile, coverFile]);

  const onAudioPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setAudioHint(null);
    if (!f) {
      setAudioFile(null);
      return;
    }
    if (!isAllowedAudioFile(f)) {
      setAudioHint("Please choose an MP3 or WAV file.");
      setAudioFile(null);
      e.target.value = "";
      return;
    }
    setAudioFile(f);
    void saveUploadDraft(
      recordFromState({
        title: titleRef.current,
        genre: genreRef.current,
        audioFile: f,
        coverFile: coverFile,
      }),
    );
  }, [coverFile]);

  const onCoverPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      setCoverFile(f);
      const audio = audioFile;
      if (!audio || !f) return;
      void saveUploadDraft(
        recordFromState({
          title: titleRef.current,
          genre: genreRef.current,
          audioFile: audio,
          coverFile: f,
        }),
      );
    },
    [audioFile],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!audioFile) return;
    mutation.mutate(
      { title, genre, audioFile, coverFile: coverFile ?? undefined },
      {
        onSuccess: () => {
          void clearUploadDraft();
          setTitle("");
          setGenre("");
          setAudioFile(null);
          setCoverFile(null);
          setAudioHint(null);
          if (audioInputRef.current) audioInputRef.current.value = "";
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
                  {audioFile ? audioFile.name : "Choose audio file (MP3, WAV, M4A)"}
                </span>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept={AUDIO_ACCEPT_ATTR}
                  className="hidden"
                  onChange={onAudioPick}
                />
              </label>
              {audioHint ? <p className="mt-1.5 text-xs text-wavee-danger">{audioHint}</p> : null}
              <p className="mt-1 text-[11px] text-wavee-muted/80">
                Only MP3 and WAV are supported. Your selection is saved on this device if the browser
                reloads when you return from the file picker.
              </p>
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
                  accept="image/jpeg,image/png,image/webp,image/*"
                  className="hidden"
                  onChange={onCoverPick}
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
              disabled={!audioFile}
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

export function UploadPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <UploadPageSignedOut />;
  }
  return <UploadPageForm />;
}
