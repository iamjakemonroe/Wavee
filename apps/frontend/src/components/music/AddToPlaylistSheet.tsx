import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiMusic, FiPlus, FiCheck, FiLoader } from "react-icons/fi";
import { usePlaylistsQuery } from "@/hooks/queries/usePlaylistsQuery";
import { usePlaylistsContainingSongQuery } from "@/hooks/queries/usePlaylistsContainingSongQuery";
import { useCreatePlaylistMutation } from "@/hooks/mutations/useCreatePlaylistMutation";
import { useAddToPlaylistMutation } from "@/hooks/mutations/useAddToPlaylistMutation";

interface AddToPlaylistSheetProps {
  songId: string;
  songTitle: string;
  open: boolean;
  onClose: () => void;
}

export function AddToPlaylistSheet({
  songId,
  songTitle,
  open,
  onClose,
}: AddToPlaylistSheetProps) {
  const playlistsQuery = usePlaylistsQuery(open);
  const containingQuery = usePlaylistsContainingSongQuery(songId, open);
  const addMutation = useAddToPlaylistMutation();
  const createMutation = useCreatePlaylistMutation();
  const [newName, setNewName] = useState("");
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (containingQuery.data) {
      setAddedTo(new Set(containingQuery.data));
    }
  }, [containingQuery.data]);

  const handleAdd = (playlistId: string) => {
    addMutation.mutate(
      { playlistId, songId },
      {
        onSuccess: () => {
          setAddedTo((prev) => new Set(prev).add(playlistId));
        },
      },
    );
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate(newName.trim(), {
      onSuccess: (playlist) => {
        setNewName("");
        handleAdd(playlist.id);
      },
    });
  };

  const handleClose = () => {
    setAddedTo(new Set());
    setNewName("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 350 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-hidden rounded-t-2xl border-t border-white/10 bg-wavee-surface"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-wavee-text">
                  Add to Playlist
                </h3>
                <p className="truncate text-xs text-wavee-muted">{songTitle}</p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-full p-2 text-wavee-muted transition-colors hover:bg-white/[0.06] hover:text-wavee-text"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-3" style={{ maxHeight: "50vh" }}>
              <form onSubmit={handleCreate} className="mb-3 flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Create new playlist..."
                  className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-base outline-none transition-colors placeholder:text-wavee-muted/50 focus:border-wavee-primary/40 md:text-sm"
                />
                <button
                  type="submit"
                  disabled={!newName.trim() || createMutation.isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-wavee-primary px-3 py-2.5 text-sm font-medium text-black transition-all hover:shadow-neon disabled:opacity-50"
                >
                  <FiPlus size={14} />
                  New
                </button>
              </form>

              {playlistsQuery.isLoading || containingQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <FiLoader className="animate-spin text-wavee-muted" size={20} />
                </div>
              ) : playlistsQuery.data?.length ? (
                <div className="space-y-1">
                  {playlistsQuery.data.map((playlist) => {
                    const isAdded = addedTo.has(playlist.id);
                    return (
                      <button
                        key={playlist.id}
                        onClick={() => !isAdded && handleAdd(playlist.id)}
                        disabled={isAdded || addMutation.isPending}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${isAdded
                          ? "border border-wavee-primary/30 bg-wavee-primary/[0.06] shadow-[0_0_12px_rgba(0,209,160,0.15)]"
                          : "border border-transparent hover:bg-white/[0.04]"
                          }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${isAdded
                            ? "bg-wavee-primary/20"
                            : "bg-white/[0.06]"
                            }`}
                        >
                          {isAdded ? (
                            <FiCheck className="text-wavee-primary" size={16} />
                          ) : (
                            <FiMusic className="text-wavee-muted" size={16} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-wavee-text">
                            {playlist.name}
                          </p>
                          <p
                            className={`text-[11px] ${isAdded ? "text-wavee-primary" : "text-wavee-muted"
                              }`}
                          >
                            {isAdded ? "Already added" : "Tap to add"}
                          </p>
                        </div>
                        {!isAdded && (
                          <FiPlus className="shrink-0 text-wavee-muted" size={16} />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <FiMusic
                    className="mx-auto mb-2 text-wavee-muted/30"
                    size={28}
                  />
                  <p className="text-sm text-wavee-muted">
                    No playlists yet. Create one above!
                  </p>
                </div>
              )}
            </div>

            <div
              className="border-t border-white/[0.06] px-5 py-3"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
            >
              <button
                onClick={handleClose}
                className="w-full rounded-xl border border-white/[0.06] py-2.5 text-sm font-medium text-wavee-muted transition-colors hover:bg-white/[0.04]"
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
