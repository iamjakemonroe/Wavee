export const apiEndpoints = {
  auth: {
    signin: "/v1/auth/signin",
    signup: "/v1/auth/signup",
    me: "/v1/auth/me",
  },
  feed: {
    home: "/v1/feed/home",
  },
  songs: {
    search: "/v1/songs/search",
    upload: "/v1/songs/upload",
  },
  engagement: {
    like: (songId: string) => `/v1/engagement/likes/${songId}`,
  },
  playlists: {
    base: "/v1/playlists",
    songs: (playlistId: string) => `/v1/playlists/${playlistId}/songs`,
  },
  profile: {
    me: "/v1/profile/me",
  },
} as const;
