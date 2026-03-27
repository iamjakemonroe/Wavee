import { memo } from "react";
import { Link } from "react-router-dom";
import { FiUser } from "react-icons/fi";
import { formatMusicRoles } from "@/constants/musicRoles";
import type { SearchUser } from "@/types/search";

interface SearchUserCardProps {
  user: SearchUser;
}

function roleLabel(user: SearchUser): string {
  return (
    formatMusicRoles(user.music_roles) ?? (user.is_artist ? "Artist" : "Listener")
  );
}

export const SearchUserCard = memo(function SearchUserCard({ user }: SearchUserCardProps) {
  return (
    <Link
      to={`/users/${user.id}`}
      className="flex aspect-square h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3 shadow-[0_0_0_1px_rgba(0,209,160,0.06)] backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wavee-primary/45 sm:p-4 hover:border-wavee-primary/25 hover:shadow-neon/30"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-wavee-primary/30 to-wavee-secondary/25 ring-2 ring-white/10 sm:h-16 sm:w-16">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <FiUser className="text-wavee-text/90" size={28} />
        )}
      </div>
      <div className="mt-3 min-h-0 min-w-0 w-full flex-1 overflow-hidden">
        <h3 className="block truncate text-sm font-bold leading-tight tracking-tight text-wavee-text sm:text-base">
          {user.username}
        </h3>
        <p className="mt-1 line-clamp-2 break-words text-xs font-medium text-wavee-muted">
          {roleLabel(user)}
        </p>
      </div>
    </Link>
  );
});
