import { payApi } from '../lib/pay';
import {
  keepPreviousData,
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
  invites: ['feature-invites'] as const,
  appearances: (id: string) => ['appearances', id] as const,
  myPlan: ['my-plan'] as const,
  myBoosts: ['my-boosts'] as const,
  promoted: ['promoted'] as const,
  founding: ['founding'] as const,
  myApplications: ['my-applications'] as const,
  picks: (week: string | null) => ['picks', week] as const,
  myWeek: ['my-week'] as const,
  challenge: ['challenge'] as const,
  finds: (id: string) => ['finds', id] as const,
  myInvites: ['my-invites'] as const,
  collections: ['collections'] as const,
  myFeedback: (id: string) => ['my-feedback', id] as const,
  feedbackSummary: (id: string) => ['feedback-summary', id] as const,
  insights: (days: number, song: string | null, user: string | null) => ['insights', days, song, user] as const,
  listening: (days: number) => ['listening', days] as const,
};

/** An artist's stats; the last numbers stay on screen while new ones load. */
export function useInsights(days: number, song: string | null, user: string | null, enabled = true) {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({
    queryKey: keys.insights(days, song, user),
    queryFn: () => api.insights(days, song, user),
    enabled: signedIn && enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });
}

/** Your own listening. */
export function useListening(days: number, enabled = true) {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({
    queryKey: keys.listening(days),
    queryFn: () => api.listening(days),
    enabled: signedIn && enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });
}

/** The Founding 100: spots taken and left, and yours. */
export function useFounding() {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({ queryKey: [...keys.founding, signedIn], queryFn: api.foundingStatus, staleTime: 60_000, retry: false });
}

/** Your code and your applications (founding, verified). */
export function useMyApplications(enabled = true) {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({ queryKey: keys.myApplications, queryFn: api.myApplications, enabled: signedIn && enabled, retry: false });
}

/** A week's Fresh Finds (null: the latest). */
export const usePicks = (week: string | null = null) =>
  useQuery({ queryKey: keys.picks(week), queryFn: () => api.picks(week), staleTime: 5 * 60_000, retry: false });

/** An artist's last seven days. */
export function useMyWeek(enabled: boolean) {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({ queryKey: keys.myWeek, queryFn: api.myWeek, enabled: signedIn && enabled, staleTime: 5 * 60_000, retry: false });
}

/** This week's discovery challenge. */
export function useChallenge() {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({ queryKey: keys.challenge, queryFn: api.challenge, enabled: signedIn, staleTime: 60_000, retry: false });
}

export const useFinds = (userId: string | undefined) =>
  useQuery({ queryKey: keys.finds(userId ?? ''), queryFn: () => api.finds(userId!), enabled: !!userId, retry: false });

export function useInvites(enabled = true) {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({ queryKey: keys.myInvites, queryFn: api.myInvites, enabled: signedIn && enabled, retry: false });
}

/** Playlists the team features on Home. */
export const useCollections = () =>
  useQuery({ queryKey: keys.collections, queryFn: api.collections, staleTime: 10 * 60_000, retry: false });

/** The signed-in artist's Artist Pro plan (and this month's free Boost). */
export function useMyPlan() {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({ queryKey: keys.myPlan, queryFn: payApi.myPlan, enabled: signedIn, staleTime: 60_000 });
}

export function useMyBoosts() {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({ queryKey: keys.myBoosts, queryFn: payApi.myBoosts, enabled: signedIn });
}

/** Boosted songs for this listener's feed (fetched once a visit). */
export function usePromoted() {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({ queryKey: [...keys.promoted, signedIn], queryFn: () => payApi.promoted(2), staleTime: 10 * 60_000, retry: false });
}

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

/** Songs you've been asked to feature on (a dot on Library while there are any). */
export function useFeatureInvites() {
  const signedIn = !!useAuth((s) => s.session);
  return useQuery({ queryKey: keys.invites, queryFn: api.featureInvites, enabled: signedIn, staleTime: 60_000, retry: false });
}

export const useAppearances = (userId: string | undefined) =>
  useQuery({ queryKey: keys.appearances(userId ?? ''), queryFn: () => api.appearances(userId!), enabled: !!userId, retry: false });

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

/** Sets a song's fields everywhere it's cached: lists, feed pages, chart entries and Fresh Finds
 * ({ song }), the week's top song, the queue. Only what changed is copied. */
export function patchSong(client: QueryClient, id: string, changes: Partial<Song>) {
  const walk = (value: unknown, depth: number): unknown => {
    if (depth > 4 || !value || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      let changed = false;
      const next = value.map((v) => {
        const w = walk(v, depth + 1);
        if (w !== v) changed = true;
        return w;
      });
      return changed ? next : value;
    }
    const obj = value as Record<string, unknown>;
    if ('audio_url' in obj && obj.id === id) return { ...obj, ...changes };
    let next: Record<string, unknown> | null = null;
    for (const [k, v] of Object.entries(obj)) {
      if (!v || typeof v !== 'object') continue;
      const w = walk(v, depth + 1);
      if (w !== v) (next ??= { ...obj })[k] = w;
    }
    return next ?? value;
  };
  client.setQueriesData<unknown>({}, (data: unknown) => walk(data, 0));
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
