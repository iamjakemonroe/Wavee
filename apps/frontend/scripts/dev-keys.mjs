// Saves Wavee's service_role key in .dev.vars (git-ignored), for the Worker
// on this Mac (npm run dev:api). Nothing is printed. Run it yourself, once:
// npm run keys
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const REF = 'ysdzcoqpmnhjfmqokcmi';
const file = new URL('../.dev.vars', import.meta.url);
const keys = Object.fromEntries(
  JSON.parse(execFileSync('supabase', ['projects', 'api-keys', '--project-ref', REF, '-o', 'json']).toString()).map((k) => [k.name, k.api_key]),
);
if (!keys.service_role) throw new Error('Supabase didn’t return the keys. Are you logged in (supabase login)?');
const lines = (existsSync(file) ? readFileSync(file, 'utf8') : readFileSync(new URL('../.dev.vars.example', import.meta.url), 'utf8')).split('\n');
const i = lines.findIndex((l) => l.startsWith('SUPABASE_SERVICE_ROLE_KEY='));
if (i >= 0) lines[i] = `SUPABASE_SERVICE_ROLE_KEY=${keys.service_role}`;
else lines.push(`SUPABASE_SERVICE_ROLE_KEY=${keys.service_role}`);
writeFileSync(file, lines.join('\n'), { mode: 0o600 });
console.log('Saved Wavee’s service key in .dev.vars.');
