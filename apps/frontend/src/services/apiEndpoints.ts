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
    toggleLike: (songId: string) => `/v1/engagement/toggle-like/${songId}`,
    myLikes: "/v1/engagement/likes/mine",
    like: (songId: string) => `/v1/engagement/likes/${songId}`,
    plays: "/v1/engagement/plays",
  },
  playlists: {
    base: "/v1/playlists",
    songs: (playlistId: string) => `/v1/playlists/${playlistId}/songs`,
    containing: (songId: string) => `/v1/playlists/containing/${songId}`,
  },
  profile: {
    me: "/v1/profile/me",
    patch: "/v1/profile/me",
    avatar: "/v1/profile/avatar",
  },
} as const;
