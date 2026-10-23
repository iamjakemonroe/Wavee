import { Link } from 'react-router-dom';
import { Bars, Button } from '../components/ui';

/** Nothing here: a page, song, person or playlist that doesn't exist (or
 * was removed). */
export function NotFound({ what = 'page' }: { what?: 'page' | 'song' | 'person' | 'playlist' }) {
  const text = {
    page: 'This page doesn’t exist.',
    song: 'This song isn’t available. It may have been removed by the artist.',
    person: 'There’s nobody here with that username.',
    playlist: 'This playlist doesn’t exist, or it’s private.',
  }[what];
  return (
    <div className="animate-rise flex flex-col items-center px-6 py-24 text-center">
      <Bars className="mb-8 h-16 w-16 opacity-60" />
      <h1 className="text-3xl">Lost the beat</h1>
      <p className="mt-3 max-w-sm text-muted">{text}</p>
      <Link to="/" className="mt-8">
        <Button variant="primary">Back to the music</Button>
      </Link>
    </div>
  );
}
