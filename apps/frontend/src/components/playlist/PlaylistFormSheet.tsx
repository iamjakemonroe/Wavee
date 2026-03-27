import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { BottomSheetModal } from "@/components/ui/BottomSheetModal";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useCreatePlaylistMutation } from "@/hooks/mutations/useCreatePlaylistMutation";
import { useDeletePlaylistMutation } from "@/hooks/mutations/useDeletePlaylistMutation";
import { usePatchPlaylistMutation } from "@/hooks/mutations/usePatchPlaylistMutation";
import { useUploadPlaylistCoverMutation } from "@/hooks/mutations/useUploadPlaylistCoverMutation";
import type { Playlist } from "@/types/entities";

type Mode = "create" | "edit";

interface PlaylistFormSheetProps {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required when mode is edit */
  playlist?: Playlist | null;
}

export function PlaylistFormSheet({ mode, open, onOpenChange, playlist }: PlaylistFormSheetProps) {
  const navigate = useNavigate();
  const nameId = useId();
  const descId = useId();
  const fileInputId = useId();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const createMutation = useCreatePlaylistMutation();
  const patchMutation = usePatchPlaylistMutation();
  const uploadCoverMutation = useUploadPlaylistCoverMutation();
  const deleteMutation = useDeletePlaylistMutation();

  const isSaving =
    createMutation.isPending || patchMutation.isPending || uploadCoverMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && playlist) {
      setName(playlist.name);
      setDescription(playlist.description ?? "");
    } else {
      setName("");
      setDescription("");
    }
    setCoverFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open, mode, playlist]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displayCoverSrc = previewUrl ?? (mode === "edit" ? playlist?.cover_image_url : null) ?? null;

  const onPickCover = (file: File | null) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCoverFile(file);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (mode === "create") {
      await createMutation.mutateAsync({
        name: trimmed,
        description: description.trim(),
        cover: coverFile,
      });
      onOpenChange(false);
      return;
    }

    if (!playlist) return;

    await patchMutation.mutateAsync({
      playlistId: playlist.id,
      body: {
        name: trimmed,
        description: description.trim() === "" ? null : description.trim(),
      },
    });

    if (coverFile) {
      await uploadCoverMutation.mutateAsync({ playlistId: playlist.id, file: coverFile });
    }

    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!playlist) return;
    await deleteMutation.mutateAsync(playlist.id);
    setConfirmDeleteOpen(false);
    onOpenChange(false);
    navigate("/playlists");
  };

  const normalizedDescription = description.trim() === "" ? null : description.trim();
  const playlistDesc = playlist?.description ?? null;
  const editHasUnsavedChanges =
    mode === "edit" &&
    playlist &&
    (name.trim() !== playlist.name ||
      normalizedDescription !== playlistDesc ||
      coverFile !== null);

  const saveDisabled =
    !name.trim() ||
    (mode === "edit" && (!playlist || !editHasUnsavedChanges));

  return (
    <>
      <BottomSheetModal
        open={open}
        onOpenChange={onOpenChange}
        title=""
        onSave={handleSave}
        isSaving={isSaving}
        saveDisabled={saveDisabled}
      >
        <div className="flex gap-3 pb-2">
          <div className="shrink-0">
            <input
              id={fileInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor={fileInputId}
              className="flex h-[104px] w-[104px] cursor-pointer items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.09]"
            >
              {displayCoverSrc ? (
                <img
                  src={displayCoverSrc}
                  alt=""
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                <FiEdit2 className="text-white/50" size={22} />
              )}
            </label>
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
            <Input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Playlist name"
              className="rounded-xl border-white/[0.08] bg-white/[0.06] text-sm"
            />
            <Textarea
              id={descId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={3}
              className="rounded-xl border-white/[0.08] bg-white/[0.06] text-sm"
            />
          </div>
        </div>

        <div className="mt-4 space-y-1 border-t border-white/[0.06] pt-3">
          {mode === "edit" && playlist && (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setConfirmDeleteOpen(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left text-sm text-wavee-danger transition-colors hover:bg-wavee-danger/10"
            >
              <FiTrash2 className="shrink-0" size={18} />
              <span className="font-medium">Delete playlist</span>
            </button>
          )}
        </div>
      </BottomSheetModal>

      {mode === "edit" && playlist && (
        <ConfirmationModal
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="Delete playlist"
          message={`Delete “${playlist.name}”? This cannot be undone.`}
          proceedLabel="Delete"
          onProceed={handleDelete}
          isProceeding={isDeleting}
        />
      )}
    </>
  );
}
