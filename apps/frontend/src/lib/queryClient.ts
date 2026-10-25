import { QueryClient } from '@tanstack/react-query';

/** The app's one cache of server data (cleared when the signed-in person changes). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/** Only paths inside Wavee: "/library", never "//elsewhere.com" or "https://…". */
export const safePath = (path: string | null | undefined, fallback = '/') =>
  path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : fallback;
