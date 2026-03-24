export const queryKeys = {
  homeFeed: ["home-feed"] as const,
  myLikes: ["my-likes"] as const,
  profile: ["profile"] as const,
  playlists: ["playlists"] as const,
  playlistSongs: (id: string) => ["playlist-songs", id] as const,
  playlistsContaining: (songId: string) => ["playlists-containing", songId] as const,
  searchSongs: (query: string) => ["search-songs", query] as const,
} as const;
