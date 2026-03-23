export const queryKeys = {
  homeFeed: ["home-feed"] as const,
  profile: ["profile"] as const,
  playlists: ["playlists"] as const,
  searchSongs: (query: string) => ["search-songs", query] as const,
} as const;
