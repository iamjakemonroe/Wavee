export const apiEndpoints = {
  auth: {
    signin: "/v1/auth/signin",
    signup: "/v1/auth/signup",
    refresh: "/v1/auth/refresh",
    me: "/v1/auth/me",
  },
  feed: {
    home: "/v1/feed/home",
  },
  songs: {
    search: "/v1/songs/search",
    upload: "/v1/songs/upload",
    byId: (songId: string) => `/v1/songs/${songId}`,
  },
  engagement: {
    toggleLike: (songId: string) => `/v1/engagement/toggle-like/${songId}`,
    myLikes: "/v1/engagement/likes/mine",
    like: (songId: string) => `/v1/engagement/likes/${songId}`,
    plays: "/v1/engagement/plays",
  },
  playlists: {
    base: "/v1/playlists",
    byId: (playlistId: string) => `/v1/playlists/${playlistId}`,
    cover: (playlistId: string) => `/v1/playlists/${playlistId}/cover`,
    songs: (playlistId: string) => `/v1/playlists/${playlistId}/songs`,
    songsSearch: (playlistId: string, q: string) =>
      `/v1/playlists/${playlistId}/songs/search?q=${encodeURIComponent(q)}`,
    songInPlaylist: (playlistId: string, songId: string) =>
      `/v1/playlists/${playlistId}/songs/${songId}`,
    containing: (songId: string) => `/v1/playlists/containing/${songId}`,
  },
  profile: {
    me: "/v1/profile/me",
    search: "/v1/profile/search",
    patch: "/v1/profile/me",
    avatar: "/v1/profile/avatar",
    userSongs: (userId: string) => `/v1/profile/${userId}/songs`,
    userSongsSearch: (userId: string, q: string) =>
      `/v1/profile/${userId}/songs/search?q=${encodeURIComponent(q)}`,
  },
} as const;
