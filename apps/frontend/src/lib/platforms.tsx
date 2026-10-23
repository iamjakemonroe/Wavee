import type { ReactNode } from 'react';
import { LuGlobe, LuMusic2, LuTicket } from 'react-icons/lu';
import {
  SiApplemusic,
  SiAudiomack,
  SiBandcamp,
  SiInstagram,
  SiSoundcloud,
  SiSpotify,
  SiTidal,
  SiTiktok,
  SiX,
  SiYoutube,
} from 'react-icons/si';

/** Where else an artist or a song can be found. The database accepts the same platforms and
 * domains (wavee_link_domains), so a link labelled Spotify really goes to Spotify. */
export type Platform =
  | 'spotify'
  | 'apple_music'
  | 'audiomack'
  | 'boomplay'
  | 'youtube'
  | 'soundcloud'
  | 'deezer'
  | 'tidal'
  | 'bandcamp'
  | 'tiktok'
  | 'instagram'
  | 'x'
  | 'website'
  | 'presave';

export type Links = Partial<Record<Platform, string>>;

interface PlatformInfo {
  label: string;
  icon: ReactNode;
  /** The brand's colour, for the icon. */
  color: string;
  domains: string;
  example: string;
}

/** Boomplay and Deezer have no icon in the set: a lettered disc in their colour. */
function Letter({ letter }: { letter: string }) {
  return (
    <span className="grid h-[1em] w-[1em] place-items-center rounded-full bg-current">
      <span className="text-[0.6em] font-bold leading-none text-bg">{letter}</span>
    </span>
  );
}

export const PLATFORMS: Record<Platform, PlatformInfo> = {
  spotify: { label: 'Spotify', icon: <SiSpotify />, color: '#1ed760', domains: 'open\\.spotify\\.com|spotify\\.link', example: 'open.spotify.com/artist/…' },
  apple_music: { label: 'Apple Music', icon: <SiApplemusic />, color: '#fa2d48', domains: 'music\\.apple\\.com', example: 'music.apple.com/…' },
  audiomack: { label: 'Audiomack', icon: <SiAudiomack />, color: '#ffa200', domains: 'audiomack\\.com', example: 'audiomack.com/you' },
  boomplay: { label: 'Boomplay', icon: <Letter letter="B" />, color: '#2a6cff', domains: 'boomplay\\.com|boomplaymusic\\.com', example: 'boomplay.com/artists/…' },
  youtube: { label: 'YouTube', icon: <SiYoutube />, color: '#ff0033', domains: 'youtube\\.com|youtu\\.be', example: 'youtube.com/@you' },
  soundcloud: { label: 'SoundCloud', icon: <SiSoundcloud />, color: '#ff5500', domains: 'soundcloud\\.com|snd\\.sc', example: 'soundcloud.com/you' },
  deezer: { label: 'Deezer', icon: <Letter letter="D" />, color: '#a238ff', domains: 'deezer\\.com|deezer\\.page\\.link', example: 'deezer.com/artist/…' },
  tidal: { label: 'TIDAL', icon: <SiTidal />, color: '#ffffff', domains: 'tidal\\.com', example: 'tidal.com/artist/…' },
  bandcamp: { label: 'Bandcamp', icon: <SiBandcamp />, color: '#1da0c3', domains: 'bandcamp\\.com', example: 'you.bandcamp.com' },
  tiktok: { label: 'TikTok', icon: <SiTiktok />, color: '#ffffff', domains: 'tiktok\\.com', example: 'tiktok.com/@you' },
  instagram: { label: 'Instagram', icon: <SiInstagram />, color: '#ff4f8b', domains: 'instagram\\.com', example: 'instagram.com/you' },
  x: { label: 'X', icon: <SiX />, color: '#ffffff', domains: 'x\\.com|twitter\\.com', example: 'x.com/you' },
  website: { label: 'Website', icon: <LuGlobe />, color: '#b8c0cf', domains: '[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}', example: 'yourname.com' },
  presave: {
    label: 'Pre-save',
    icon: <LuTicket />,
    color: '#18e2b0',
    domains: 'distrokid\\.com|lnk\\.to|ffm\\.to|smarturl\\.it|hypeddit\\.com|found\\.ee|show\\.co|orcd\\.co|push\\.fm|linkfire\\.com',
    example: 'distrokid.com/hyperfollow/…',
  },
};

/** On a profile: where to listen, then where to follow. */
export const ARTIST_PLATFORMS: Platform[] = [
  'spotify', 'apple_music', 'audiomack', 'boomplay', 'youtube', 'soundcloud', 'deezer', 'tidal', 'bandcamp',
  'instagram', 'tiktok', 'x', 'website',
];

/** On a song: where else it plays, and a pre-save link (DistroKid HyperFollow and the like). */
export const SONG_PLATFORMS: Platform[] = [
  'spotify', 'apple_music', 'audiomack', 'boomplay', 'youtube', 'soundcloud', 'deezer', 'tidal', 'presave',
];

export const ListenIcon = LuMusic2;

/** Tidies what someone pasted: adds https://, upgrades http://, trims. */
export function tidyLink(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (/^http:\/\//i.test(v)) return `https://${v.slice(7)}`;
  if (!/^[a-z]+:/i.test(v)) return `https://${v}`;
  return v;
}

/** Why [url] can't be [platform]'s link, or null if it can. */
export function checkLink(platform: Platform, url: string): string | null {
  if (!url) return null;
  if (url.length > 300) return 'That link is too long.';
  const info = PLATFORMS[platform];
  const ok = new RegExp(`^https://([a-z0-9-]+\\.)*(${info.domains})(:443)?([/?#][^\\s"'<>\\\\]*)?$`, 'i').test(url);
  return ok ? null : `That isn’t a ${info.label} link (like ${info.example}).`;
}

/** Only the platforms with a link, in display order. */
export function presentLinks(links: Links | null | undefined, order: Platform[]): [Platform, string][] {
  if (!links) return [];
  return order.filter((p) => typeof links[p] === 'string' && links[p]).map((p) => [p, links[p]!]);
}
