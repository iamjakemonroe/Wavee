import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, type ChartKind, type Song } from '../lib/api';
import { audio } from '../lib/audio';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { toast } from '../store/toast';

const PAGE = 20;

export const keys = {
  feed: ['feed'] as const,
  trending: ['trending'] as const,
  fresh: ['new'] as const,
  song: (id: string) => ['song', id] as const,
  profile: (username: string) => ['profile', username] as const,
  userSongs: (id: string) => ['user-songs', id] as const,
  liked: ['liked'] as const,
  myPlaylists: ['my-playlists'] as const,
  userPlaylists: (id: string) => ['user-playlists', id] as const,
  playlist: (id: string) => ['playlist', id] as const,
  playlistSongs: (id: string) => ['playlist-songs', id] as const,
  search: (q: string) => ['search', q] as const,
  chart: (kind: ChartKind, genre: string | null) => ['chart', kind, genre] as const,
  tastemakers: ['tastemakers'] as const,
};

/** The For You feed, a page at a time: each page continues the same order. */
export function useFeed() {
  const signedIn = !!useAuth((s) => s.session);
  return useInfiniteQuery({
    queryKey: [...keys.feed, signedIn],
    queryFn: ({ pageParam }) => api.feed(PAGE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.length < PAGE ? undefined : pages.length * PAGE),
  });
}

export const useTrending = (limit = 20) =>
  useQuery({ queryKey: [...keys.trending, limit], queryFn: () => api.trending(limit) });

export const useNewReleases = (limit = 20) =>
  useQuery({ queryKey: [...keys.fresh, limit], queryFn: () => api.newReleases(limit) });

export const useSong = (id: string) =>
  useQuery({ queryKey: keys.song(id), queryFn: () => api.song(id), enabled: !!id });

export const useProfile = (username: string) =>
  useQuery({ queryKey: keys.profile(username), queryFn: () => api.profile(username), enabled: !!username });

export const useUserSongs = (userId: string | undefined) =>
  useQuery({
    queryKey: keys.userSongs(userId ?? ''),
    queryFn: () => api.userSongs(userId!, 100, 0),
    enabled: !!userId,
  });

export function useLiked() {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({ queryKey: keys.liked, queryFn: () => api.likedSongs(200, 0), enabled: signedIn });
}

export function useMyPlaylists() {
  const userId = useAuth((s) => s.session?.user.id);
  return useQuery({
    queryKey: keys.myPlaylists,
    queryFn: () => api.myPlaylists(userId!),
    enabled: !!userId,
  });
}

export const useUserPlaylists = (userId: string | undefined) =>
  useQuery({
    queryKey: keys.userPlaylists(userId ?? ''),
    queryFn: () => api.userPlaylists(userId!),
    enabled: !!userId,
  });

export const usePlaylist = (id: string) =>
  useQuery({ queryKey: keys.playlist(id), queryFn: () => api.playlist(id), enabled: !!id });

export const usePlaylistSongs = (id: string) =>
  useQuery({ queryKey: keys.playlistSongs(id), queryFn: () => api.playlistSongs(id), enabled: !!id });

/** Charts change hourly (they're counted to the start of the hour). */
export const useChart = (kind: ChartKind, genre: string | null, limit = 50) =>
  useQuery({
    queryKey: [...keys.chart(kind, genre), limit],
    queryFn: () => api.chart(kind, genre, limit),
    staleTime: 5 * 60_000,
  });

export const useTastemakers = () =>
  useQuery({ queryKey: keys.tastemakers, queryFn: () => api.tastemakers(50), staleTime: 5 * 60_000 });

/** Search, a beat after the typing stops. */
export function useSearch(query: string) {
  const [q, setQ] = useState(query);
  useEffect(() => {
    const t = window.setTimeout(() => setQ(query.trim()), 250);
    return () => window.clearTimeout(t);
  }, [query]);
  const songs = useQuery({
    queryKey: [...keys.search(q), 'songs'],
    queryFn: () => api.searchSongs(q),
    enabled: q.length >= 2,
  });
  const people = useQuery({
    queryKey: [...keys.search(q), 'people'],
    queryFn: () => api.searchUsers(q),
    enabled: q.length >= 2,
  });
  return { q, songs, people };
}

/** Sets a song's fields everywhere it's cached (lists, pages, the queue). */
export function patchSong(client: QueryClient, id: string, changes: Partial<Song>) {
  const fix = (s: Song) => (s.id === id ? { ...s, ...changes } : s);
  client.setQueriesData<unknown>({}, (data: unknown) => {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map((s) => (s && typeof s === 'object' && 'audio_url' in s ? fix(s as Song) : s));
    const d = data as { pages?: unknown[]; id?: string; audio_url?: string };
    if (Array.isArray(d.pages)) {
      return { ...d, pages: d.pages.map((p) => (Array.isArray(p) ? p.map((s) => fix(s as Song)) : p)) };
    }
    if (d.audio_url && d.id === id) return { ...d, ...changes };
    return data;
  });
  usePlayer.getState().updateSong(id, changes);
}

/** Likes or unlikes at once; puts it back if the server says no. */
export function useLike() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ song, liked }: { song: Song; liked: boolean }) => api.toggleLike(song.id, liked),
    onMutate: ({ song, liked }) => {
      patchSong(client, song.id, {
        liked,
        likes_count: Math.max(0, song.likes_count + (liked ? 1 : -1)),
      });
    },
    onError: (e, { song }) => {
      patchSong(client, song.id, { liked: song.liked, likes_count: song.likes_count });
      toast((e as Error).message, 'error');
    },
    onSuccess: (result, { song }) => {
      if (result) patchSong(client, song.id, { liked: result.liked, likes_count: result.likes_count });
      void client.invalidateQueries({ queryKey: keys.liked });
    },
  });
}

export function useFollow(username: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, follow }: { userId: string; follow: boolean }) => api.setFollow(userId, follow),
    onSuccess: (result) => {
      if (!result) return;
      client.setQueryData(keys.profile(username), (p: object | null | undefined) =>
        p ? { ...p, is_following: result.following, followers_count: result.followers_count } : p,
      );
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });
}

/** The playback clock, for the progress bar only (so the rest of the app
 * doesn't redraw four times a second). */
export function usePlaybackTime() {
  const [state, setState] = useState(() => ({
    time: audio.time,
    duration: audio.duration,
    buffered: audio.buffered,
  }));
  useEffect(() => {
    const update = () => setState({ time: audio.time, duration: audio.duration, buffered: audio.buffered });
    const offs = [audio.on('time', update), audio.on('meta', update), audio.on('playing', update)];
    return () => offs.forEach((off) => off());
  }, []);
  return state;
}
