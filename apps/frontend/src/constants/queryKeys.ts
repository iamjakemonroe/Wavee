export const queryKeys = {
  /** Prefix: invalidates all home feed variants (logged-in vs logged-out). */
  homeFeed: ["home-feed"] as const,
  /** Exact key for `useInfiniteQuery` home feed — use for get/setQueryData. */
  homeFeedQuery: (isAuthenticated: boolean) =>
    [...queryKeys.homeFeed, isAuthenticated] as const,
  myLikes: ["my-likes"] as const,
  profile: ["profile"] as const,
  playlists: ["playlists"] as const,
  playlistSongs: (id: string) => ["playlist-songs", id] as const,
  playlistSongsSearch: (playlistId: string, q: string) =>
    ["playlist-songs-search", playlistId, q] as const,
  playlistsContaining: (songId: string) => ["playlists-containing", songId] as const,
  userSongs: (userId: string) => ["user-songs", userId] as const,
  userSongsSearch: (userId: string, q: string) =>
    ["user-songs-search", userId, q] as const,
  searchSongs: (query: string) => ["search-songs", query] as const,
  searchUsers: (query: string) => ["search-users", query] as const,
  song: (songId: string) => ["song", songId] as const,
} as const;
