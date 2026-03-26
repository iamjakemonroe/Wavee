import { useEffect, useId, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { FiCamera, FiUser } from "react-icons/fi";
import type { MusicRole } from "@/constants/musicRoles";
import { MUSIC_ROLES, normalizeMusicRoles } from "@/constants/musicRoles";
import { useUpdateProfileMutation } from "@/hooks/mutations/useUpdateProfileMutation";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { UserProfile } from "@/types/entities";

interface EditProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
}

export function EditProfileModal({ open, onOpenChange, profile }: EditProfileModalProps) {
  const titleId = useId();
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [selectedRoles, setSelectedRoles] = useState<MusicRole[]>(() =>
    normalizeMusicRoles(profile.music_roles),
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const mutation = useUpdateProfileMutation();

  useEffect(() => {
    if (!open) return;
    setUsername(profile.username);
    setBio(profile.bio ?? "");
    setSelectedRoles(normalizeMusicRoles(profile.music_roles));
    setAvatarFile(null);
    setPreviewUrl(null);
  }, [open, profile]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !mutation.isPending) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, mutation.isPending]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const displayAvatar = previewUrl ?? profile.avatar_url;

  const onAvatarPick = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAvatarFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const toggleRole = (role: MusicRole) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const music_roles = Array.from(new Set(selectedRoles));
    mutation.mutate(
      {
        username,
        bio,
        music_roles,
        avatarFile,
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  if (!open) return null;

  const node = (
    <div className="fixed inset-0 z-[100] md:flex md:items-center md:justify-center md:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 z-0 hidden bg-black/60 backdrop-blur-sm md:block"
        disabled={mutation.isPending}
        onClick={() => onOpenChange(false)}
      />
      <GlassPanel
        intensity="heavy"
        className="relative z-[101] flex max-h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden rounded-none border-0 md:min-h-0 md:max-h-[90dvh] md:max-w-lg md:rounded-2xl md:border md:border-white/[0.08] md:shadow-neon-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] md:pb-6 md:pt-6">
          <h2 id={titleId} className="text-lg font-bold text-wavee-text">
            Edit profile
          </h2>
          <p className="mt-1 text-sm text-wavee-muted">
            Update how you appear on Wavee
          </p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-wavee-primary to-wavee-secondary">
                  {displayAvatar ? (
                    <img
                      src={displayAvatar}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FiUser className="text-white" size={36} />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-wavee-surface shadow-lg transition-colors hover:border-wavee-primary/40">
                  <FiCamera className="text-wavee-text" size={16} />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => onAvatarPick(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <p className="text-center text-xs text-wavee-muted">
                JPEG, PNG, or WebP · up to 5MB
              </p>
            </div>

            <Input
              id="edit-username"
              label="Display name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              maxLength={24}
              required
            />

            <Textarea
              id="edit-bio"
              label="About (optional)"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              placeholder="Tell listeners about you..."
            />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-wavee-muted">
                Roles in music (optional)
              </legend>
              <p className="text-xs text-wavee-muted/80">
                Select all that apply
              </p>
              <div className="flex flex-col gap-1 rounded-xl border border-wavee-border bg-wavee-surface p-3">
                {MUSIC_ROLES.map((r) => (
                  <label
                    key={r.value}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(r.value)}
                      onChange={() => toggleRole(r.value)}
                      className="h-4 w-4 rounded border-wavee-border bg-wavee-bg text-wavee-primary focus:ring-wavee-primary/30"
                    />
                    <span className="text-sm text-wavee-text">{r.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {mutation.error && (
              <p className="text-sm text-wavee-danger">
                {mutation.error instanceof Error ? mutation.error.message : "Update failed"}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="sm:min-w-[6rem]"
                disabled={mutation.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="sm:min-w-[6rem]" isLoading={mutation.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </div>
      </GlassPanel>
    </div>
  );

  return createPortal(node, document.body);
}
