// Builds Wavee and deploys it to Cloudflare (wavee.kaivon.app).
// The Supabase URL and publishable key come from .env.local, so they're
// never committed: the app bundle and the Worker get the same values.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in apps/frontend/.env.local');
  process.exit(1);
}

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', cwd: new URL('..', import.meta.url) });
run('npx', ['tsc', '-b']);
run('npx', ['vite', 'build']);
run('npx', ['wrangler', 'deploy', '--var', `SUPABASE_URL:${url}`, '--var', `SUPABASE_ANON_KEY:${key}`]);
