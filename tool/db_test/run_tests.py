#!/usr/bin/env python3
"""Proves the Wavee relaunch migration on a throwaway local Postgres.

What it does:
  1. Starts a temporary Postgres cluster (data dir under /tmp, Unix socket only, no TCP) or, with
     --dsn, uses an existing server you point it at (it creates and drops its own database there).
  2. Creates a stand-in for what Supabase provides (supabase_stub.sql): roles anon /
     authenticated / service_role / supabase_auth_admin, a non-superuser `postgres` role that runs
     the migrations, auth.users + auth.uid(), storage tables, the extensions schema and Supabase's
     default privileges.
  3. Runs the old migrations apps/backend/db/migrations/0001-0013 in order, seeds legacy-shaped data
     (seed_legacy.sql), then runs supabase/migrations/20261023100000_wavee_relaunch.sql twice and
     checks the second run changes nothing.
  4. Checks the database contract from docs/RELAUNCH.md, querying as anon, authenticated users,
     admins and the service role the way PostgREST would (SET ROLE + request.jwt.claims).

Usage:
  python3 tool/db_test/run_tests.py                       # needs initdb/pg_ctl/postgres on PATH
  python3 tool/db_test/run_tests.py --pg-bin /path/to/bin # or PG_BIN=/path/to/bin
  python3 tool/db_test/run_tests.py --dsn "host=localhost user=postgres"   # existing server (superuser)

Needs Python 3.9+ and psycopg 3 (pip install -r tool/db_test/requirements.txt).
No Postgres at hand? tool/db_test/fetch_postgres.sh downloads portable binaries into /tmp.
Exit code 0 when every check passes.
"""

import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import traceback
import uuid
from contextlib import contextmanager

try:
    import psycopg
    from psycopg import sql as pgsql
except ImportError:  # pragma: no cover
    sys.stderr.write("psycopg 3 is required: pip install -r tool/db_test/requirements.txt\n")
    sys.exit(2)

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
MEDIA = "https://media.wavee.kaivon.app"
OLD_MIGRATIONS = sorted(glob.glob(os.path.join(REPO, "apps", "backend", "db", "migrations", "*.sql")))
NEW_MIGRATION = os.path.join(REPO, "supabase", "migrations", "20261023100000_wavee_relaunch.sql")
NEW_MIGRATIONS = sorted(glob.glob(os.path.join(REPO, "supabase", "migrations", "*.sql")))
STUB = os.path.join(HERE, "supabase_stub.sql")
SEED = os.path.join(HERE, "seed_legacy.sql")

ROLES_SQL = """
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'postgres') then
    create role postgres login nosuperuser createrole;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end $$;
"""


# ─────────────────────────────────────────────────────────────────────────────
# Server
# ─────────────────────────────────────────────────────────────────────────────

def find_pg_bin(explicit):
    candidates = [explicit, os.environ.get("PG_BIN")]
    for c in candidates:
        if c and os.path.exists(os.path.join(c, "initdb")):
            return c
    found = shutil.which("initdb")
    if found:
        return os.path.dirname(found)
    for pattern in ("/opt/homebrew/opt/postgresql@*/bin", "/usr/local/opt/postgresql@*/bin",
                    "/Applications/Postgres.app/Contents/Versions/*/bin", "/usr/lib/postgresql/*/bin"):
        for c in sorted(glob.glob(pattern), reverse=True):
            if os.path.exists(os.path.join(c, "initdb")):
                return c
    return None


@contextmanager
def temp_cluster(pg_bin, port):
    """A throwaway cluster in /tmp listening only on a Unix socket in its own directory."""
    tmp = tempfile.mkdtemp(prefix="wavee-db-test-", dir="/tmp")
    data = os.path.join(tmp, "data")
    log = os.path.join(tmp, "postgres.log")
    started = False
    try:
        subprocess.run([os.path.join(pg_bin, "initdb"), "-D", data, "-U", "supabase_admin",
                        "-A", "trust", "-E", "UTF8", "--no-locale"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        opts = f"-p {port} -k {tmp} -c listen_addresses='' -c fsync=off -c full_page_writes=off"
        subprocess.run([os.path.join(pg_bin, "pg_ctl"), "-D", data, "-o", opts, "-l", log, "-w",
                        "start"], check=True, stdout=subprocess.DEVNULL)
        started = True
        print(f"Started temporary Postgres in {tmp} (socket only, port {port})")
        yield {"host": tmp, "port": port, "user": "supabase_admin"}
    finally:
        if started:
            subprocess.run([os.path.join(pg_bin, "pg_ctl"), "-D", data, "-m", "fast", "-w", "stop"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.rmtree(tmp, ignore_errors=True)
        print(f"Stopped the temporary Postgres and deleted {tmp}")


@contextmanager
def existing_server(dsn):
    info = psycopg.conninfo.conninfo_to_dict(dsn)
    info.pop("dbname", None)
    yield info


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def run_file(conn, path, role=None):
    with open(path) as f:
        text = f.read()
    with conn.transaction():
        with conn.cursor() as cur:
            if role:
                cur.execute(pgsql.SQL("set local role {}").format(pgsql.Identifier(role)))
            cur.execute(text)


FINGERPRINT_SQL = """
select md5(string_agg(x, E'\\n' order by x)) from (
  select 'policy ' || tablename || '.' || policyname || ' ' || cmd || ' ' || roles::text || ' '
         || coalesce(qual, '') || ' ' || coalesce(with_check, '')
  from pg_policies where schemaname in ('public', 'auth')
  union all
  select 'proc ' || p.oid::regprocedure::text || ' ' || md5(p.prosrc) || ' ' || coalesce(p.proacl::text, '')
         || ' ' || p.prosecdef || ' ' || coalesce(p.proconfig::text, '') || ' ' || p.provolatile::text
  from pg_proc p where p.pronamespace = 'public'::regnamespace
  union all
  select 'rel ' || c.relname || ' ' || c.relkind::text || ' ' || coalesce(c.relacl::text, '') || ' ' || c.relrowsecurity
  from pg_class c where c.relnamespace = 'public'::regnamespace
  union all
  select 'col ' || c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || ' '
         || a.attnotnull || ' ' || coalesce(a.attacl::text, '') || ' ' || coalesce(pg_get_expr(d.adbin, d.adrelid), '')
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where c.relnamespace = 'public'::regnamespace and a.attnum > 0 and not a.attisdropped
  union all
  select 'con ' || conrelid::regclass::text || '.' || conname || ' ' || pg_get_constraintdef(oid) || ' ' || convalidated
  from pg_constraint where connamespace = 'public'::regnamespace
  union all
  select 'idx ' || pg_get_indexdef(i.indexrelid)
  from pg_index i join pg_class c on c.oid = i.indrelid where c.relnamespace = 'public'::regnamespace
  union all
  select 'trg ' || pg_get_triggerdef(t.oid) from pg_trigger t where not t.tgisinternal
  union all
  select 'type ' || t.typname || ' ' || coalesce((
    select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by a.attnum)
    from pg_attribute a where a.attrelid = t.typrelid), '')
  from pg_type t where t.typnamespace = 'public'::regnamespace and t.typtype = 'c'
  union all
  select 'ext ' || e.extname || ' ' || n.nspname
  from pg_extension e join pg_namespace n on n.oid = e.extnamespace
) s(x)
"""

DATA_FINGERPRINT_SQL = """
select md5(coalesce((select string_agg(row(u.*)::text, '|' order by u.id) from public.users u), '')
        || coalesce((select string_agg(row(s.*)::text, '|' order by s.id) from public.songs s), '')
        || coalesce((select string_agg(row(p.*)::text, '|' order by p.id) from public.playlist_songs p), '')
        || coalesce((select string_agg(row(l.*)::text, '|' order by l.id) from public.likes l), '')
        || coalesce((select string_agg(row(f.*)::text, '|' order by f.id) from public.follows f), ''))
"""


class Db:
    """Runs statements the way PostgREST would: one transaction, SET LOCAL ROLE, JWT claims."""

    def __init__(self, conn):
        self.conn = conn

    def q(self, query, params=None, role=None, uid=None, headers=None):
        with self.conn.transaction():
            with self.conn.cursor() as cur:
                if role:
                    cur.execute(pgsql.SQL("set local role {}").format(pgsql.Identifier(role)))
                    claims = {"role": role}
                    if uid:
                        claims["sub"] = str(uid)
                    cur.execute(
                        "select set_config('request.jwt.claims', %s, true),"
                        " set_config('request.jwt.claim.sub', %s, true),"
                        " set_config('request.jwt.claim.role', %s, true),"
                        " set_config('request.headers', %s, true)",
                        (json.dumps(claims), str(uid) if uid else "", role, json.dumps(headers or {})),
                    )
                cur.execute(query, params)
                if cur.description is None:
                    return cur.rowcount
                return cur.fetchall()

    def one(self, query, params=None, **kw):
        rows = self.q(query, params, **kw)
        return rows[0][0] if rows else None

    # role shortcuts
    def anon(self, query, params=None, headers=None):
        return self.q(query, params, role="anon", headers=headers)

    def user(self, uid, query, params=None, headers=None):
        return self.q(query, params, role="authenticated", uid=uid, headers=headers)

    def service(self, query, params=None):
        return self.q(query, params, role="service_role")

    def su(self, query, params=None):
        return self.q(query, params)


class Checks:
    def __init__(self):
        self.passed = 0
        self.failed = []
        self.section = ""

    def start(self, name):
        self.section = name
        print(f"\n== {name}")

    def ok(self, name, cond, detail=""):
        label = f"{self.section}: {name}"
        if cond:
            self.passed += 1
            print(f"  PASS  {name}")
        else:
            self.failed.append(label)
            print(f"  FAIL  {name}" + (f"  ({detail})" if detail else ""))
        return cond

    def raises(self, name, fn, *needles):
        """Passes if fn() raises a database error whose SQLSTATE or message contains any needle."""
        try:
            result = fn()
        except psycopg.Error as e:
            msg = f"{e.sqlstate or ''} {e}"
            if not needles or any(n.lower() in msg.lower() for n in needles):
                return self.ok(name, True)
            return self.ok(name, False, f"wrong error: {msg.strip()[:200]}")
        return self.ok(name, False, f"no error (returned {result!r:.200})")

    def safe(self, name, fn):
        """Runs a block of checks; an unexpected exception counts as one failure."""
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            self.failed.append(f"{self.section}: {name} (crashed)")
            print(f"  FAIL  {name} crashed: {e}")
            traceback.print_exc(limit=3)


def uid():
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────

def run_contract_tests(db, c):
    A = "00000000-0000-0000-0000-00000000000a"  # legacy 'jake' (artist)
    E = "00000000-0000-0000-0000-00000000000e"  # legacy 'DJ Cool'
    SONG1 = "10000000-0000-0000-0000-000000000001"
    SONG3 = "10000000-0000-0000-0000-000000000003"
    LEGACY_PLAYLIST = "20000000-0000-0000-0000-000000000001"

    def signup(email, meta=None, id_=None):
        id_ = id_ or uid()
        db.q("insert into auth.users (id, email, raw_user_meta_data) values (%s, %s, %s)",
             (id_, email, json.dumps(meta or {})), role="supabase_auth_admin")
        return id_

    def username_of(u):
        return db.su("select username from public.users where id = %s", (u,))[0][0]

    def new_song(owner, title, genre="pop", duration=None, **extra):
        key = f"audio/{extra.get('user_id', owner)}/{uuid.uuid4()}.mp3"
        cols = {"user_id": owner, "title": title, "audio_url": f"{MEDIA}/{key}", "audio_key": key,
                "genre": genre, "duration_seconds": duration, "rights_confirmed_at": "2026-10-23T00:00:00Z"}
        cols.update(extra)
        names = ", ".join(cols)
        marks = ", ".join(["%s"] * len(cols))
        return str(db.user(owner, f"insert into public.songs ({names}) values ({marks}) returning id",
                           tuple(cols.values()))[0][0])

    def card_ids(rows):
        return [str(r[0]) for r in rows]

    # ── Legacy data ─────────────────────────────────────────────────────────
    c.start("Legacy data fixed by the migration")

    def legacy():
        rows = dict((str(r[0]), r[1:]) for r in db.su(
            "select id, username, display_name, bio from public.users"))
        names = [r[0] for r in rows.values()]
        c.ok("every username matches ^[a-z0-9_.]{3,30}$",
             all(__import__("re").fullmatch(r"[a-z0-9_.]{3,30}", n) for n in names), names)
        c.ok("usernames unique case-insensitively", len({n.lower() for n in names}) == len(names))
        c.ok("oldest valid 'jake' kept its name", rows[A][0] == "jake", rows[A])
        c.ok("valid unique 'jake2' kept its name",
             rows["00000000-0000-0000-0000-00000000000d"][0] == "jake2")
        renamed = [rows[k][0] for k in ("00000000-0000-0000-0000-00000000000b",
                                         "00000000-0000-0000-0000-00000000000c",
                                         "00000000-0000-0000-0000-000000000011")]
        c.ok("duplicates 'Jake', 'JAKE', 'jake' renamed jake3, jake4, jake5 (oldest first)",
             renamed == ["jake3", "jake4", "jake5"], renamed)
        c.ok("'DJ Cool' became username dj_cool, display name kept",
             rows[E][0] == "dj_cool" and rows[E][1] == "DJ Cool", rows[E])
        c.ok("too-short 'a' padded to a valid name",
             rows["00000000-0000-0000-0000-00000000000f"][0] == "a00",
             rows["00000000-0000-0000-0000-00000000000f"])
        c.ok("too-long name cut to 30 characters",
             rows["00000000-0000-0000-0000-000000000010"][0] == "this_is_a_very_long_username_w")
        c.ok("auth user without a profile was backfilled (username from metadata)",
             rows.get("00000000-0000-0000-0000-000000000012", [None])[0] == "orphan")
        c.ok("bio over 300 characters truncated", len(rows[A][2]) == 300)
        likes = dict(db.su("select id::text, likes_count from public.songs where id in (%s, %s)", (SONG1, SONG3)))
        c.ok("stale likes_count recomputed from likes", likes == {SONG1: 1, SONG3: 1}, likes)
        fc = db.su("select followers_count, following_count from public.users where id = %s", (A,))[0]
        c.ok("followers_count backfilled", fc == (2, 0), fc)
        pos = db.su("select song_id::text, position from public.playlist_songs where playlist_id = %s "
                    "order by position", (LEGACY_PLAYLIST,))
        c.ok("playlist positions backfilled 0..n-1 in insertion order",
             [p for _, p in pos] == [0, 1, 2] and pos[0][0] == SONG3, pos)
        status = db.su("select count(*) from public.songs where status <> 'active' or updated_at is null")[0][0]
        c.ok("existing songs are active with updated_at set", status == 0)
        old = db.su("select tablename, policyname from pg_policies where schemaname = 'public' and policyname in "
                    "('users are readable', 'plays are readable', 'plays can be inserted', 'songs are readable', "
                    "'users can upsert self', 'playlist songs are readable', 'likes are readable')")
        c.ok("old permissive policies are gone", old == [], old)
        plays_pol = db.su("select count(*) from pg_policies where schemaname = 'public' and tablename = 'plays'")[0][0]
        c.ok("plays has no policies (no client access)", plays_pol == 0)
        trgm = db.su("select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace "
                     "where e.extname = 'pg_trgm'")
        c.ok("pg_trgm installed in extensions schema", trgm == [("extensions",)], trgm)
        idx = {r[0] for r in db.su("select indexname from pg_indexes where schemaname = 'public'")}
        need = {"songs_created_at_idx", "songs_user_id_created_at_idx", "plays_song_id_created_at_idx",
                "playlist_songs_playlist_id_position_idx", "songs_title_trgm_idx", "users_username_trgm_idx",
                "users_display_name_trgm_idx", "users_username_lower_key", "likes_song_id_idx",
                "follows_following_id_idx", "playlists_user_id_idx", "playlist_songs_song_id_idx",
                "plays_user_id_created_at_idx", "plays_created_at_song_id_idx", "reports_reporter_id_idx", "bug_reports_user_id_idx"}
        c.ok("contract indexes exist", need <= idx, sorted(need - idx))
        fk_missing = db.su("""
            select c.conrelid::regclass::text || '(' || a.attname || ')'
            from pg_constraint c
            join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
            where c.contype = 'f' and c.connamespace = 'public'::regnamespace
              and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])""")
        c.ok("every foreign key has an index", fk_missing == [], fk_missing)
        defs = db.su("""
            select p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname = any(%s)
              and not (p.prosecdef and p.proconfig @> array['search_path=public, extensions'])""",
                     (["my_account", "username_available", "get_feed", "get_trending", "get_new_releases",
                       "search_songs", "search_users", "get_song", "get_user_songs", "get_profile",
                       "get_liked_songs", "get_playlist_songs", "toggle_like", "set_follow", "add_to_playlist",
                       "remove_from_playlist", "move_in_playlist", "record_play", "submit_report",
                       "submit_bug_report", "moderate_song", "resolve_report", "admin_reports",
                       "admin_bug_reports"],))
        c.ok("contract functions are security definer with search_path = public, extensions", defs == [], defs)

    c.safe("legacy", legacy)

    # ── Signup trigger ─────────────────────────────────────────────────────
    c.start("Signup trigger on auth.users")
    state = {}

    def signups():
        u1 = signup("first.artist@example.com", {"username": "newbie", "display_name": "New Bie"})
        c.ok("free, valid metadata username is used", username_of(u1) == "newbie")
        c.ok("display_name from metadata",
             db.su("select display_name from public.users where id = %s", (u1,))[0][0] == "New Bie")
        u2 = signup("Someone.Else+tag@example.com", {"username": "NEWBIE"})
        c.ok("taken username falls back to the sanitised email local part",
             username_of(u2) == "someone.else_tag", username_of(u2))
        u3 = signup("jake@another.example", {"username": "Bad Name!"})
        c.ok("invalid username falls back to email, made unique with a suffix",
             username_of(u3) == "jake6", username_of(u3))
        c.ok("display_name defaults to the username",
             db.su("select display_name from public.users where id = %s", (u3,))[0][0] == "jake6")
        u4 = signup(None, {})
        c.ok("signup without email still gets a profile",
             username_of(u4).startswith("user"), username_of(u4))
        u5 = signup("x@example.com", {"username": "Mixed.Case_1"})
        c.ok("metadata username is lower-cased", username_of(u5) == "mixed.case_1", username_of(u5))
        u6 = signup("listener@example.com", {"username": "listener"})
        u7 = signup("other@example.com", {"username": "other_listener", "display_name": "Other"})
        u8 = signup("admin@example.com", {"username": "the_admin"})
        state.update(artist=u1, listener=u6, other=u7, admin=u8, misc=u2)
        # my_account self-heals when a profile is missing
        u9 = signup("heal@example.com", {"username": "healme"})
        db.su("delete from public.users where id = %s", (u9,))
        acct = db.user(u9, "select public.my_account()")[0][0]
        c.ok("my_account() recreates a missing profile", acct and acct["username"] == "healme", acct)

    c.safe("signups", signups)
    ARTIST, LISTENER, OTHER, ADMIN = state["artist"], state["listener"], state["other"], state["admin"]
    db.service("update public.users set is_admin = true where id = %s", (ADMIN,))

    # ── Email privacy and profile updates ───────────────────────────────────
    c.start("users: email privacy, column privileges")

    def privacy():
        c.raises("anon cannot select email", lambda: db.anon("select email from public.users"), "42501")
        c.raises("authenticated cannot select another user's email",
                 lambda: db.user(LISTENER, "select email from public.users where id = %s", (ARTIST,)), "42501")
        c.raises("authenticated cannot select own email from the table",
                 lambda: db.user(LISTENER, "select email from public.users where id = %s", (LISTENER,)), "42501")
        c.raises("select * on users is refused (email column)",
                 lambda: db.user(LISTENER, "select * from public.users"), "42501")
        rows = db.anon("select id, username, display_name, avatar_url, bio, is_artist, music_roles, "
                       "followers_count, following_count, created_at from public.users")
        c.ok("anon can read the public profile columns", len(rows) > 5)
        acct = db.user(LISTENER, "select public.my_account()")[0][0]
        c.ok("my_account() returns own email", acct["email"] == "listener@example.com", acct)
        c.ok("my_account() has exactly the contract keys",
             set(acct) == {"id", "username", "display_name", "email", "avatar_url", "bio", "is_artist",
                           "music_roles", "is_admin", "links"}, sorted(acct))
        c.ok("my_account() is null when signed out", db.anon("select public.my_account()")[0][0] is None)
        prof = db.anon("select public.get_profile('newbie')")[0][0]
        c.ok("get_profile has no email", prof and "email" not in prof, prof)
        c.raises("cannot set own is_admin",
                 lambda: db.user(LISTENER, "update public.users set is_admin = true where id = %s", (LISTENER,)), "42501")
        c.raises("cannot set own followers_count",
                 lambda: db.user(LISTENER, "update public.users set followers_count = 1000 where id = %s", (LISTENER,)), "42501")
        c.raises("cannot clear own banned_at",
                 lambda: db.user(LISTENER, "update public.users set banned_at = null where id = %s", (LISTENER,)), "42501")
        c.raises("cannot change own email column",
                 lambda: db.user(LISTENER, "update public.users set email = 'x@y.z' where id = %s", (LISTENER,)), "42501")
        n = db.user(LISTENER, "update public.users set display_name = ' Lis ', bio = 'hi', is_artist = true, "
                              "music_roles = '{producer}' where id = %s", (LISTENER,))
        c.ok("can update own display_name / bio / is_artist / music_roles", n == 1)
        c.ok("display_name is trimmed",
             db.su("select display_name from public.users where id = %s", (LISTENER,))[0][0] == "Lis")
        n = db.user(LISTENER, "update public.users set bio = 'hacked' where id = %s", (ARTIST,))
        c.ok("cannot update someone else's profile (0 rows)", n == 0)
        c.raises("username with invalid characters rejected",
                 lambda: db.user(LISTENER, "update public.users set username = 'no spaces' where id = %s", (LISTENER,)),
                 "users_username_format")
        c.raises("username taken case-insensitively rejected",
                 lambda: db.user(LISTENER, "update public.users set username = 'NEWBIE' where id = %s", (LISTENER,)),
                 "23505")
        db.user(LISTENER, "update public.users set username = 'Listener_Two' where id = %s", (LISTENER,))
        c.ok("username lower-cased on update", username_of(LISTENER) == "listener_two")
        c.raises("anon cannot insert users", lambda: db.anon(
            "insert into public.users (id, username) values (gen_random_uuid(), 'zzz')"), "42501")
        c.raises("authenticated cannot insert users rows directly", lambda: db.user(
            LISTENER, "insert into public.users (id, username) values (%s, 'zzzz')", (LISTENER,)), "42501")
        avail = db.anon("select public.username_available('newbie'), public.username_available('NewBie'), "
                        "public.username_available('free_name'), public.username_available('ab'), "
                        "public.username_available('bad name')")[0]
        c.ok("username_available: taken/taken(ci)/free/short/invalid",
             avail == (False, False, True, False, False), avail)
        c.ok("username_available: own name counts as available",
             db.user(ARTIST, "select public.username_available('newbie')")[0][0] is True)

    c.safe("privacy", privacy)

    # ── Songs ───────────────────────────────────────────────────────────────
    c.start("songs: inserts, owner updates, deletes")
    songs = {}

    def song_rules():
        c.raises("insert without rights_confirmed_at refused",
                 lambda: db.user(ARTIST, "insert into public.songs (user_id, title, audio_url) values (%s, 't', 'u')",
                                 (ARTIST,)), "rights")
        sid = new_song(ARTIST, "Gaming Attempt", plays_count=1000, likes_count=50, status="hidden",
                       created_at="2030-01-01T00:00:00Z")
        row = db.su("select plays_count, likes_count, status, created_at <= now() from public.songs where id = %s", (sid,))[0]
        c.ok("insert forces zero counts, active status and server created_at", row == (0, 0, "active", True), row)
        songs["main"] = sid
        c.raises("cannot insert a song for someone else",
                 lambda: new_song(ARTIST, "Not mine", user_id=LISTENER), "42501", "row-level")
        c.raises("anon cannot insert songs",
                 lambda: db.anon("insert into public.songs (user_id, title, audio_url, rights_confirmed_at) "
                                 "values (%s, 't', 'u', now())", (ARTIST,)), "42501")
        c.raises("description over 1000 characters refused",
                 lambda: new_song(ARTIST, "Long", description="x" * 1001), "songs_description_length")
        before = db.su("select updated_at from public.songs where id = %s", (sid,))[0][0]
        ck, vk = f"cover/{ARTIST}/{uuid.uuid4()}.jpg", f"video/{ARTIST}/{uuid.uuid4()}.mp4"
        n = db.user(ARTIST, "update public.songs set title = 'Renamed', genre = 'rock', description = 'd', "
                            "explicit = true, cover_image_url = %s, cover_key = %s, video_url = %s, video_key = %s "
                            "where id = %s", (f"{MEDIA}/{ck}", ck, f"{MEDIA}/{vk}", vk, sid))
        after = db.su("select title, explicit, updated_at from public.songs where id = %s", (sid,))[0]
        c.ok("owner updates title/genre/description/cover/video/explicit", n == 1 and after[0] == "Renamed" and after[1])
        c.ok("updated_at bumped on edit", after[2] > before)
        for col, val in (("status", "'hidden'"), ("plays_count", "999"), ("likes_count", "999"),
                         ("user_id", f"'{LISTENER}'"), ("audio_url", "'https://evil'"), ("created_at", "now() + interval '1 day'")):
            c.raises(f"owner cannot change {col}",
                     lambda col=col, val=val: db.user(ARTIST, f"update public.songs set {col} = {val} where id = %s", (sid,)),
                     "42501")
        n = db.user(LISTENER, "update public.songs set title = 'pwned' where id = %s", (sid,))
        c.ok("other users cannot update the song (0 rows)", n == 0)
        tmp = new_song(ARTIST, "Delete me")
        c.ok("other users cannot delete it (0 rows)",
             db.user(LISTENER, "delete from public.songs where id = %s", (tmp,)) == 0)
        c.ok("owner deletes own song", db.user(ARTIST, "delete from public.songs where id = %s", (tmp,)) == 1)
        own = db.user(ARTIST, "select audio_key, video_key, cover_key from public.songs where id = %s", (sid,))
        c.ok("owner can read own song's keys (web app delete flow)", len(own) == 1)

    c.safe("songs", song_rules)

    # ── Media links ────────────────────────────────────────────────────────
    c.start("media links: only files uploaded through Wavee")

    def media_links():
        sid = songs["main"]
        c.raises("song with an outside audio URL refused",
                 lambda: new_song(ARTIST, "Hotlink", audio_url="https://evil.example/a.mp3", audio_key=None), "23514")
        other = f"audio/{LISTENER}/{uuid.uuid4()}.mp3"
        c.raises("song pointing at someone else's upload refused",
                 lambda: new_song(ARTIST, "Borrowed", audio_url=f"{MEDIA}/{other}", audio_key=other), "23514")
        key = f"audio/{ARTIST}/{uuid.uuid4()}.mp3"
        c.raises("audio URL that doesn't match its key refused",
                 lambda: new_song(ARTIST, "Mismatch", audio_url=f"{MEDIA}/audio/{ARTIST}/{uuid.uuid4()}.mp3",
                                  audio_key=key), "23514")
        c.raises("outside cover URL refused",
                 lambda: db.user(ARTIST, "update public.songs set cover_image_url = 'https://evil.example/c.jpg', "
                                         "cover_key = null where id = %s", (sid,)), "23514")
        c.raises("javascript: video URL refused",
                 lambda: db.user(ARTIST, "update public.songs set video_url = 'javascript:alert(1)', video_key = null "
                                         "where id = %s", (sid,)), "23514")
        c.ok("cover and video can be cleared",
             db.user(ARTIST, "update public.songs set cover_image_url = null, cover_key = null, video_url = null, "
                             "video_key = null where id = %s", (sid,)) == 1)
        c.ok("editing other fields leaves a legacy link alone",
             db.user(A, "update public.songs set title = 'Old Song One' where id = %s", (SONG1,)) == 1)
        own = f"{MEDIA}/avatar/{LISTENER}/{uuid.uuid4()}.webp"
        c.ok("own uploaded avatar accepted",
             db.user(LISTENER, "update public.users set avatar_url = %s where id = %s", (own, LISTENER)) == 1)
        c.raises("outside avatar refused",
                 lambda: db.user(LISTENER, "update public.users set avatar_url = 'https://evil.example/x.png' "
                                           "where id = %s", (LISTENER,)), "23514")
        pid = db.user(LISTENER, "insert into public.playlists (user_id, name) values (%s, 'Covers') returning id",
                      (LISTENER,))[0][0]
        c.raises("outside playlist cover refused",
                 lambda: db.user(LISTENER, "update public.playlists set cover_image_url = 'https://evil.example/p.png' "
                                           "where id = %s", (pid,)), "23514")
        good = f"{MEDIA}/playlist/{LISTENER}/{uuid.uuid4()}.png"
        c.ok("own playlist cover accepted",
             db.user(LISTENER, "update public.playlists set cover_image_url = %s where id = %s", (good, pid)) == 1)
        c.ok("the service role isn't limited",
             db.service("update public.users set avatar_url = 'https://example.com/a.png' where id = %s", (OTHER,)) == 1)

    c.safe("media links", media_links)

    # ── Likes and follows ──────────────────────────────────────────────────
    c.start("likes and follows: idempotent with counts")

    def likes_follows():
        sid = songs["main"]
        r1 = db.user(LISTENER, "select public.toggle_like(%s, true)", (sid,))[0][0]
        r2 = db.user(LISTENER, "select public.toggle_like(%s, true)", (sid,))[0][0]
        c.ok("toggle_like(true) twice -> liked, likes_count 1",
             r1 == {"liked": True, "likes_count": 1} and r2 == r1, (r1, r2))
        r3 = db.user(OTHER, "select public.toggle_like(%s, true)", (sid,))[0][0]
        c.ok("second user's like -> 2", r3 == {"liked": True, "likes_count": 2}, r3)
        liked = db.user(LISTENER, "select liked from public.get_new_releases(50) where id = %s", (sid,))
        c.ok("song card liked=true for the liker", liked == [(True,)], liked)
        c.ok("song card liked=false when signed out",
             db.anon("select liked from public.get_new_releases(50) where id = %s", (sid,)) == [(False,)])
        c.ok("song card liked=false for someone who didn't like it",
             db.user(ARTIST, "select liked from public.get_new_releases(50) where id = %s", (sid,)) == [(False,)])
        c.ok("get_liked_songs lists it", sid in card_ids(db.user(LISTENER, "select * from public.get_liked_songs(10, 0)")))
        r4 = db.user(LISTENER, "select public.toggle_like(%s, false)", (sid,))[0][0]
        r5 = db.user(LISTENER, "select public.toggle_like(%s, false)", (sid,))[0][0]
        c.ok("toggle_like(false) twice -> 1 like left",
             r4 == {"liked": False, "likes_count": 1} and r5 == r4, (r4, r5))
        db.user(OTHER, "select public.toggle_like(%s, false)", (sid,))
        c.ok("likes_count back to 0",
             db.su("select likes_count from public.songs where id = %s", (sid,))[0][0] == 0)
        c.raises("anon cannot call toggle_like",
                 lambda: db.anon("select public.toggle_like(%s, true)", (sid,)), "42501")
        c.raises("liking an unknown song fails",
                 lambda: db.user(LISTENER, "select public.toggle_like(%s, true)", (uid(),)), "not found")
        db.user(LISTENER, "select public.toggle_like(%s, true)", (sid,))
        c.ok("likes are private: others see none of them",
             db.user(OTHER, "select count(*) from public.likes")[0][0] == 0)
        c.ok("users see their own likes", db.user(LISTENER, "select count(*) from public.likes")[0][0] == 1)
        db.user(LISTENER, "select public.toggle_like(%s, false)", (sid,))

        f1 = db.user(LISTENER, "select public.set_follow(%s, true)", (ARTIST,))[0][0]
        f2 = db.user(LISTENER, "select public.set_follow(%s, true)", (ARTIST,))[0][0]
        c.ok("set_follow(true) twice -> following, followers_count 1",
             f1 == {"following": True, "followers_count": 1} and f2 == f1, (f1, f2))
        c.ok("follower's following_count is 1",
             db.su("select following_count from public.users where id = %s", (LISTENER,))[0][0] == 1)
        prof = db.user(LISTENER, "select public.get_profile('newbie')")[0][0]
        c.ok("get_profile is_following true for the follower", prof["is_following"] is True, prof)
        c.ok("get_profile is_following false when signed out",
             db.anon("select public.get_profile('newbie')")[0][0]["is_following"] is False)
        f3 = db.user(LISTENER, "select public.set_follow(%s, false)", (ARTIST,))[0][0]
        f4 = db.user(LISTENER, "select public.set_follow(%s, false)", (ARTIST,))[0][0]
        c.ok("set_follow(false) twice -> 0", f3 == {"following": False, "followers_count": 0} and f4 == f3, (f3, f4))
        c.ok("following_count back to 0",
             db.su("select following_count from public.users where id = %s", (LISTENER,))[0][0] == 0)
        c.raises("cannot follow yourself", lambda: db.user(LISTENER, "select public.set_follow(%s, true)", (LISTENER,)),
                 "yourself")
        c.raises("direct self-follow insert refused by the check constraint",
                 lambda: db.user(LISTENER, "insert into public.follows (follower_id, following_id) values (%s, %s)",
                                 (LISTENER, LISTENER)), "23514")
        db.user(OTHER, "insert into public.follows (follower_id, following_id) values (%s, %s)", (OTHER, ARTIST))
        c.ok("direct follow insert also maintains followers_count",
             db.su("select followers_count from public.users where id = %s", (ARTIST,))[0][0] == 1)
        db.user(OTHER, "delete from public.follows where follower_id = %s", (OTHER,))
        c.ok("direct unfollow decrements",
             db.su("select followers_count from public.users where id = %s", (ARTIST,))[0][0] == 0)

    c.safe("likes/follows", likes_follows)

    # ── Playlists ──────────────────────────────────────────────────────────
    c.start("playlists: privacy and ordering")

    def playlists():
        s1 = songs["main"]
        s2 = new_song(ARTIST, "Second")
        s3 = new_song(ARTIST, "Third")
        priv = str(db.user(ARTIST, "insert into public.playlists (user_id, name, is_private) values (%s, 'Secret', true) "
                                   "returning id", (ARTIST,))[0][0])
        pub = str(db.user(ARTIST, "insert into public.playlists (user_id, name) values (%s, 'Open') returning id",
                          (ARTIST,))[0][0])
        for s in (s1, s2, s3):
            db.user(ARTIST, "select public.add_to_playlist(%s, %s)", (priv, s))
            db.user(ARTIST, "select public.add_to_playlist(%s, %s)", (pub, s))
        db.user(ARTIST, "select public.add_to_playlist(%s, %s)", (priv, s1))
        own = db.user(ARTIST, "select id, position from public.get_playlist_songs(%s)", (priv,))
        c.ok("owner sees the private playlist in order, positions 0..2, add is idempotent",
             [(str(i), p) for i, p in own] == [(s1, 0), (s2, 1), (s3, 2)], own)
        c.ok("others cannot see the private playlist row",
             db.user(LISTENER, "select count(*) from public.playlists where id = %s", (priv,))[0][0] == 0)
        c.ok("anon cannot see the private playlist row",
             db.anon("select count(*) from public.playlists where id = %s", (priv,))[0][0] == 0)
        c.ok("others cannot see the private playlist's songs (table)",
             db.user(LISTENER, "select count(*) from public.playlist_songs where playlist_id = %s", (priv,))[0][0] == 0)
        c.ok("others get nothing from get_playlist_songs(private)",
             db.user(LISTENER, "select count(*) from public.get_playlist_songs(%s)", (priv,))[0][0] == 0)
        c.ok("anon gets nothing from get_playlist_songs(private)",
             db.anon("select count(*) from public.get_playlist_songs(%s)", (priv,))[0][0] == 0)
        c.ok("public playlist and songs visible to anon",
             db.anon("select count(*) from public.get_playlist_songs(%s)", (pub,))[0][0] == 3
             and db.anon("select count(*) from public.playlists where id = %s", (pub,))[0][0] == 1)
        c.ok("owner embed query (playlist + owner columns) works for anon",
             len(db.anon("select p.id, u.username, u.display_name, u.avatar_url from public.playlists p "
                         "join public.users u on u.id = p.user_id where p.id = %s", (pub,))) == 1)
        db.user(ARTIST, "select public.move_in_playlist(%s, %s, 0)", (priv, s3))
        order = [str(r[0]) for r in db.user(ARTIST, "select id from public.get_playlist_songs(%s)", (priv,))]
        c.ok("move_in_playlist moves to the front", order == [s3, s1, s2], order)
        db.user(ARTIST, "select public.move_in_playlist(%s, %s, 99)", (priv, s3))
        order = [str(r[0]) for r in db.user(ARTIST, "select id from public.get_playlist_songs(%s)", (priv,))]
        c.ok("move_in_playlist clamps past the end", order == [s1, s2, s3], order)
        db.user(ARTIST, "select public.remove_from_playlist(%s, %s)", (priv, s1))
        own = db.user(ARTIST, "select id, position from public.get_playlist_songs(%s)", (priv,))
        c.ok("remove_from_playlist compacts positions", [(str(i), p) for i, p in own] == [(s2, 0), (s3, 1)], own)
        c.raises("others cannot add to someone's playlist",
                 lambda: db.user(LISTENER, "select public.add_to_playlist(%s, %s)", (pub, s1)), "not found")
        c.raises("others cannot move in someone's playlist",
                 lambda: db.user(LISTENER, "select public.move_in_playlist(%s, %s, 0)", (pub, s1)), "not found")
        c.raises("others cannot insert playlist_songs directly",
                 lambda: db.user(LISTENER, "insert into public.playlist_songs (playlist_id, song_id) values (%s, %s)",
                                 (pub, s1)), "42501", "row-level")
        c.ok("others cannot delete playlist_songs directly (0 rows)",
             db.user(LISTENER, "delete from public.playlist_songs where playlist_id = %s", (pub,)) == 0)
        c.ok("others cannot rename the playlist (0 rows)",
             db.user(LISTENER, "update public.playlists set name = 'x' where id = %s", (pub,)) == 0)
        c.raises("anon cannot call add_to_playlist",
                 lambda: db.anon("select public.add_to_playlist(%s, %s)", (pub, s1)), "42501")
        db.user(ARTIST, "insert into public.playlist_songs (playlist_id, song_id) values (%s, %s)", (priv, s1))
        c.ok("direct insert by the owner appends at the end",
             db.su("select position from public.playlist_songs where playlist_id = %s and song_id = %s",
                   (priv, s1))[0][0] == 2)
        songs.update(s2=s2, s3=s3, pub=pub, priv=priv)

    c.safe("playlists", playlists)

    # ── record_play ────────────────────────────────────────────────────────
    c.start("record_play: clamp, dedupe, counting")

    def plays():
        s100 = new_song(ARTIST, "Hundred", duration=100)
        s40 = new_song(ARTIST, "Forty", duration=40)
        s_unknown = new_song(ARTIST, "No duration")

        def count(s):
            return db.su("select plays_count, (select count(*) from public.plays where song_id = %s) "
                         "from public.songs where id = %s", (s, s))[0]

        db.user(LISTENER, "select public.record_play(%s, 500, 100, false, 'sess-1')", (s100,))
        row = db.su("select duration_listened, song_duration, session_hash is not null from public.plays "
                    "where song_id = %s", (s100,))
        c.ok("listened clamped to the song's duration", row == [(100, 100, True)], row)
        c.ok("full listen counted", count(s100) == (1, 1), count(s100))
        db.user(LISTENER, "select public.record_play(%s, 100, 100, false, 'sess-1')", (s100,))
        db.user(LISTENER, "select public.record_play(%s, 100, 100, false, 'sess-other')", (s100,))
        c.ok("repeat by the same user within 30 s ignored (even with another session)", count(s100) == (1, 1), count(s100))
        db.su("update public.plays set created_at = created_at - interval '31 seconds' where song_id = %s", (s100,))
        db.user(LISTENER, "select public.record_play(%s, 10, 100, true, 'sess-1')", (s100,))
        c.ok("after 30 s a new play is recorded; 10 s of 100 not counted", count(s100) == (1, 2), count(s100))
        db.su("update public.plays set created_at = created_at - interval '31 seconds' where song_id = %s", (s100,))
        db.user(LISTENER, "select public.record_play(%s, 30, 100, false, null)", (s100,))
        c.ok("30 seconds counts", count(s100) == (2, 3), count(s100))
        db.user(LISTENER, "select public.record_play(%s, 20, 40, false, null)", (s40,))
        c.ok("half of a 40 s song (20 s) counts", count(s40) == (1, 1), count(s40))
        db.user(OTHER, "select public.record_play(%s, 19, 40, false, null)", (s40,))
        c.ok("19 s of a 40 s song does not count", count(s40) == (1, 2), count(s40))
        db.anon("select public.record_play(%s, 40, 40, false, 'anon-session-A')", (s40,))
        db.anon("select public.record_play(%s, 40, 40, false, 'anon-session-A')", (s40,))
        c.ok("anon play recorded once per session within 30 s", count(s40) == (2, 3), count(s40))
        db.anon("select public.record_play(%s, 40, 40, false, 'anon-session-B')", (s40,))
        c.ok("another anon session counts", count(s40) == (3, 4), count(s40))
        db.user(LISTENER, "select public.record_play(%s, 'NaN', 'NaN', false, null)", (s_unknown,))
        row = db.su("select duration_listened, song_duration from public.plays where song_id = %s", (s_unknown,))
        c.ok("NaN listened stored as 0 and not counted", row == [(0, 0)] and count(s_unknown)[0] == 0, row)
        db.user(OTHER, "select public.record_play(%s, 5000, 200, false, null)", (s_unknown,))
        row = db.su("select max(duration_listened) from public.plays where song_id = %s", (s_unknown,))[0][0]
        c.ok("unknown stored duration: clamped to p_duration", row == 200, row)
        db.user(ARTIST, "select public.record_play(%s, -5, 100, false, null)", (s100,))
        row = db.su("select min(duration_listened) from public.plays where song_id = %s", (s100,))[0][0]
        c.ok("negative listened stored as 0", row == 0, row)
        before = db.su("select count(*) from public.plays")[0][0]
        db.user(LISTENER, "select public.record_play(%s, 50, 100, false, null)", (uid(),))
        c.ok("unknown song ignored silently", db.su("select count(*) from public.plays")[0][0] == before)
        c.raises("clients cannot read plays", lambda: db.user(LISTENER, "select * from public.plays"), "42501")
        c.raises("anon cannot read plays", lambda: db.anon("select count(*) from public.plays"), "42501")
        c.raises("clients cannot insert plays",
                 lambda: db.user(LISTENER, "insert into public.plays (user_id, song_id) values (%s, %s)", (LISTENER, s100)),
                 "42501")
        songs.update(s100=s100, s40=s40)

    c.safe("plays", plays)

    # ── Admin moderation ───────────────────────────────────────────────────
    c.start("admin moderation")

    def moderation():
        sid = songs["s100"]
        c.raises("non-admin cannot moderate", lambda: db.user(ARTIST, "select public.moderate_song(%s, 'hidden', 'x')", (sid,)),
                 "42501")
        c.raises("anon cannot call moderate_song",
                 lambda: db.anon("select public.moderate_song(%s, 'hidden', 'x')", (sid,)), "42501")
        c.raises("service_role-only: authenticated cannot make itself admin",
                 lambda: db.user(ARTIST, "update public.users set is_admin = true where id = %s", (ARTIST,)), "42501")
        db.user(ADMIN, "select public.moderate_song(%s, 'hidden', 'copyright claim #1')", (sid,))
        c.ok("admin hides a song",
             db.su("select status from public.songs where id = %s", (sid,))[0][0] == "hidden")
        c.ok("moderation note logged",
             db.su("select note, action, admin_id::text from public.moderation_log where target_id = %s", (sid,))
             == [("copyright claim #1", "hidden", ADMIN)])
        c.ok("hidden song: get_song is null for others",
             db.user(LISTENER, "select public.get_song(%s)", (sid,))[0][0] is None)
        c.ok("hidden song: get_song is null for anon", db.anon("select public.get_song(%s)", (sid,))[0][0] is None)
        c.ok("hidden song: invisible in songs table to others",
             db.user(LISTENER, "select count(*) from public.songs where id = %s", (sid,))[0][0] == 0)
        c.ok("hidden song: not in new releases / trending / feed / search",
             sid not in card_ids(db.anon("select * from public.get_new_releases(100)"))
             and sid not in card_ids(db.anon("select * from public.get_trending(100)"))
             and sid not in card_ids(db.user(LISTENER, "select * from public.get_feed(100, 0)"))
             and sid not in card_ids(db.anon("select * from public.search_songs('Hundred', 30)")))
        c.ok("hidden song: not in the artist's list for others",
             sid not in card_ids(db.anon("select * from public.get_user_songs(%s, 100, 0)", (ARTIST,))))
        c.ok("hidden song: still visible to its owner",
             db.user(ARTIST, "select public.get_song(%s)", (sid,))[0][0] is not None
             and sid in card_ids(db.user(ARTIST, "select * from public.get_user_songs(%s, 100, 0)", (ARTIST,))))
        c.ok("hidden song: visible to admins", db.user(ADMIN, "select public.get_song(%s)", (sid,))[0][0] is not None)
        c.raises("owner cannot un-hide it", lambda: db.user(ARTIST, "update public.songs set status = 'active' where id = %s",
                                                            (sid,)), "42501")
        before = db.su("select count(*) from public.plays where song_id = %s", (sid,))[0][0]
        db.user(OTHER, "select public.record_play(%s, 100, 100, false, null)", (sid,))
        c.ok("plays of a hidden song are ignored",
             db.su("select count(*) from public.plays where song_id = %s", (sid,))[0][0] == before)
        n = db.user(ADMIN, "update public.songs set status = 'active' where id = %s", (sid,))
        c.ok("admin can restore status through the table too", n == 1 and
             db.su("select status from public.songs where id = %s", (sid,))[0][0] == "active")
        c.raises("invalid status rejected",
                 lambda: db.user(ADMIN, "select public.moderate_song(%s, 'deleted', null)", (sid,)), "status")

    c.safe("moderation", moderation)

    # ── Reports ────────────────────────────────────────────────────────────
    c.start("reports and bug reports: validation, privacy, rate limits")

    def reports():
        sid = songs["main"]

        def report(caller, reason="spam", headers=None, email=None, **kw):
            args = {"t": kw.get("target_type", "song"), "id": kw.get("target_id", sid), "r": reason,
                    "d": kw.get("details", "details"), "e": email, "n": kw.get("claimant"), "s": kw.get("sworn", False)}
            q = "select public.submit_report(%(t)s, %(id)s, %(r)s, %(d)s, %(e)s, %(n)s, %(s)s)"
            if caller is None:
                return db.anon(q, args, headers=headers)[0][0]
            return db.user(caller, q, args, headers=headers)[0][0]

        r = report(LISTENER)
        c.ok("submit_report returns { id }", isinstance(r, dict) and set(r) == {"id"}, r)
        row = db.su("select reporter_id::text, status, sworn from public.reports where id = %s", (r["id"],))[0]
        c.ok("report stored open with the reporter", row == (LISTENER, "open", False), row)
        c.raises("unknown reason rejected", lambda: report(LISTENER, reason="boring"), "reason")
        c.raises("unknown target rejected", lambda: report(LISTENER, target_id=uid()), "not found")
        c.raises("details over 2000 characters rejected", lambda: report(LISTENER, details="x" * 2001), "2000")
        c.raises("copyright claim needs the sworn statement",
                 lambda: report(None, "copyright", {"x-forwarded-for": "198.51.100.9"}, "rights@label.example",
                                claimant="Label"), "sworn")
        c.raises("copyright claim needs a claimant name",
                 lambda: report(None, "copyright", {"x-forwarded-for": "198.51.100.9"}, "rights@label.example",
                                sworn=True), "name")
        c.raises("copyright claim needs a contact email when signed out",
                 lambda: report(None, "copyright", {"x-forwarded-for": "198.51.100.9"}, None, claimant="L", sworn=True),
                 "email")
        r = report(OTHER, "copyright", claimant="Other Label", sworn=True)
        row = db.su("select contact_email, claimant_name, sworn from public.reports where id = %s", (r["id"],))[0]
        c.ok("signed-in copyright claim falls back to the account email",
             row == ("other@example.com", "Other Label", True), row)
        c.raises("invalid contact email rejected", lambda: report(None, email="not-an-email",
                                                                  headers={"x-forwarded-for": "198.51.100.9"}), "email")
        # rate limit: 10 per hour per user (LISTENER already filed 1 successful report)
        for _ in range(9):
            report(LISTENER)
        c.raises("11th report from one user within the hour is rate limited",
                 lambda: report(LISTENER), "too many")
        ip_a = {"x-forwarded-for": "203.0.113.7, 10.0.0.1"}
        for _ in range(10):
            report(None, headers=ip_a)
        c.raises("11th anonymous report from one IP is rate limited", lambda: report(None, headers=ip_a), "too many")
        c.ok("another IP is not affected",
             isinstance(report(None, headers={"cf-connecting-ip": "203.0.113.99"}), dict))
        for _ in range(10):
            report(None, email="spammer@example.com")
        c.raises("without IP headers, anonymous reports are limited per contact email",
                 lambda: report(None, email="spammer@example.com"), "too many")
        c.ok("a different contact email is not affected",
             isinstance(report(None, email="honest@example.com"), dict))
        stored = db.su("select count(*) from public.rate_events where rate_key like 'ip:%%' and rate_key like %s",
                       ("%203.0.113%",))[0][0]
        c.ok("IP addresses are stored hashed, not raw", stored == 0)

        # privacy
        c.ok("non-admins read no reports", db.user(LISTENER, "select count(*) from public.reports")[0][0] == 0)
        c.raises("anon cannot read reports", lambda: db.anon("select count(*) from public.reports"), "42501")
        c.raises("clients cannot insert reports directly", lambda: db.user(
            LISTENER, "insert into public.reports (target_type, target_id, reason) values ('song', %s, 'spam')", (sid,)),
            "42501")
        c.ok("non-admins cannot update reports (0 rows)",
             db.user(LISTENER, "update public.reports set status = 'dismissed'") == 0)
        c.raises("non-admin cannot call admin_reports",
                 lambda: db.user(LISTENER, "select * from public.admin_reports('open')"), "42501")
        open_reports = db.user(ADMIN, "select id, status from public.admin_reports('open')")
        all_reports = db.user(ADMIN, "select count(*) from public.admin_reports(null)")[0][0]
        c.ok("admin_reports lists reports", len(open_reports) > 20 and all_reports >= len(open_reports))
        rid = open_reports[0][0]
        db.user(ADMIN, "select public.resolve_report(%s, 'actioned', 'removed the song')", (rid,))
        row = db.su("select status, resolution_note, resolved_at is not null, resolved_by::text from public.reports "
                    "where id = %s", (rid,))[0]
        c.ok("resolve_report records status, note, time and admin",
             row == ("actioned", "removed the song", True, ADMIN), row)
        c.raises("non-admin cannot resolve", lambda: db.user(
            LISTENER, "select public.resolve_report(%s, 'dismissed', null)", (rid,)), "42501")
        c.ok("admin can update reports through the table",
             db.user(ADMIN, "update public.reports set status = 'reviewing' where id = %s", (rid,)) == 1)

        # bug reports
        def bug(caller, headers=None, email=None, msg="Player stops"):
            q = "select public.submit_bug_report(%s, '/feed', 'UA', null, %s)"
            if caller is None:
                return db.anon(q, (msg, email), headers=headers)[0][0]
            return db.user(caller, q, (msg, email), headers=headers)[0][0]

        b = bug(LISTENER)
        c.ok("submit_bug_report returns { id }", isinstance(b, dict) and set(b) == {"id"}, b)
        c.raises("empty bug message rejected", lambda: bug(LISTENER, msg="   "), "describe")
        c.raises("bug message over 4000 characters rejected", lambda: bug(LISTENER, msg="x" * 4001), "4000")
        c.raises("screenshot must be an http(s) URL", lambda: db.user(
            LISTENER, "select public.submit_bug_report('m', null, null, 'javascript:alert(1)', null)"), "screenshot")
        for _ in range(9):
            bug(LISTENER)
        c.raises("11th bug report from one user is rate limited", lambda: bug(LISTENER), "too many")
        ip_b = {"x-real-ip": "192.0.2.44"}
        for _ in range(10):
            bug(None, headers=ip_b)
        c.raises("11th anonymous bug report from one IP is rate limited", lambda: bug(None, headers=ip_b), "too many")
        c.ok("non-admins read no bug reports", db.user(LISTENER, "select count(*) from public.bug_reports")[0][0] == 0)
        c.ok("admin_bug_reports lists them",
             db.user(ADMIN, "select count(*) from public.admin_bug_reports('open')")[0][0] == 20)
        c.ok("admin_bug_reports('all') too",
             db.user(ADMIN, "select count(*) from public.admin_bug_reports('all')")[0][0] == 20)
        c.ok("admin can update bug report status",
             db.user(ADMIN, "update public.bug_reports set status = 'fixed' where id = %s", (b["id"],)) == 1)
        c.raises("anon cannot call admin_bug_reports",
                 lambda: db.anon("select * from public.admin_bug_reports('open')"), "42501")

    c.safe("reports", reports)

    # ── Feed ───────────────────────────────────────────────────────────────
    c.start("feed: one order, paged")

    def feed():
        artists = [signup(f"artist{i}@example.com", {"username": f"feed_artist_{i}"}) for i in range(5)]
        # 30 songs, very uneven per artist (one artist has 14) so the diversity rule has work to do.
        layout = [0] * 14 + [1] * 6 + [2] * 5 + [3] * 3 + [4] * 2
        for n, a in enumerate(layout):
            db.su("insert into public.songs (user_id, title, audio_url, genre, created_at, rights_confirmed_at) "
                  "values (%s, %s, 'https://media.example/x.mp3', %s, now() - make_interval(hours => %s), now())",
                  (artists[a], f"Feed Song {n:02d}", ["pop", "house", "rock"][n % 3], n * 5 + 2))
        total = db.anon("select count(*) from public.get_new_releases(100)")[0][0]
        active = db.su("select count(*) from public.songs s join public.users u on u.id = s.user_id "
                       "where s.status = 'active' and u.banned_at is null")[0][0]
        c.ok("fixture: more than 36 active songs", active > 36, active)

        for who, run in (("signed in", lambda q, p: db.user(LISTENER, q, p)), ("anon", lambda q, p: db.anon(q, p))):
            p1 = card_ids(run("select * from public.get_feed(%s, %s)", (12, 0)))
            p2 = card_ids(run("select * from public.get_feed(%s, %s)", (12, 12)))
            p3 = card_ids(run("select * from public.get_feed(%s, %s)", (12, 24)))
            whole = card_ids(run("select * from public.get_feed(%s, %s)", (36, 0)))
            again = card_ids(run("select * from public.get_feed(%s, %s)", (12, 12)))
            c.ok(f"{who}: three pages of 12 are full", (len(p1), len(p2), len(p3)) == (12, 12, 12),
                 (len(p1), len(p2), len(p3)))
            c.ok(f"{who}: pages never repeat a song", len(set(p1 + p2 + p3)) == 36)
            c.ok(f"{who}: pages are slices of one order", p1 + p2 + p3 == whole)
            c.ok(f"{who}: same page twice gives the same songs", again == p2)
            everything = card_ids(run("select * from public.get_feed(%s, %s)", (100, 0)))
            c.ok(f"{who}: the feed covers every active song", len(everything) == active == len(set(everything)),
                 (len(everything), active))
            past_end = run("select * from public.get_feed(%s, %s)", (12, active))
            c.ok(f"{who}: paging past the end returns nothing", past_end == [])
            art = dict(db.su("select id::text, user_id::text from public.songs"))
            seq = [art[i] for i in everything]
            worst = 0
            for k in range(len(seq) - 2):
                if seq[k] == seq[k + 1] == seq[k + 2] and len(set(seq[k:])) > 1:
                    worst += 1
            c.ok(f"{who}: never 3 in a row by one artist while others remain", worst == 0, worst)

        # Personalisation: following an artist lifts their songs.
        fan = signup("fan@example.com", {"username": "fan"})
        small = artists[4]
        before = card_ids(db.user(fan, "select * from public.get_feed(100, 0)"))
        db.user(fan, "select public.set_follow(%s, true)", (small,))
        after = card_ids(db.user(fan, "select * from public.get_feed(100, 0)"))
        small_songs = [r[0] for r in db.su("select id::text from public.songs where user_id = %s", (small,))]
        pos_b = sorted(before.index(s) for s in small_songs)
        pos_a = sorted(after.index(s) for s in small_songs)
        c.ok("followed artist's songs move up", sum(pos_a) < sum(pos_b), (pos_b, pos_a))
        # Songs skipped repeatedly move down (plays before the current hour count).
        target = after[0]
        for _ in range(2):
            db.su("insert into public.plays (user_id, song_id, duration_listened, song_duration, skipped, created_at) "
                  "values (%s, %s, 3, 100, true, date_trunc('hour', now()) - interval '1 hour')", (fan, target))
        later = card_ids(db.user(fan, "select * from public.get_feed(100, 0)"))
        c.ok("a song skipped twice moves down", later.index(target) > 0, later.index(target))
        # Trending: plays in the last 7 days lift a song for everyone.
        quiet = before[-1]
        for i in range(25):
            db.su("insert into public.plays (song_id, duration_listened, song_duration, created_at) "
                  "values (%s, 60, 100, now() - interval '2 days')", (quiet,))
        anon_feed = card_ids(db.anon("select * from public.get_feed(100, 0)"))
        c.ok("a song with many plays this week climbs the feed", anon_feed.index(quiet) < len(anon_feed) // 2,
             anon_feed.index(quiet))
        trending = card_ids(db.anon("select * from public.get_trending(5)"))
        c.ok("get_trending puts the most played song (last 7 days) first", trending[0] == quiet, trending[:3])
        new = db.anon("select id, created_at from public.get_new_releases(10)")
        c.ok("get_new_releases is newest first", [r[1] for r in new] == sorted([r[1] for r in new], reverse=True))
        c.ok("limits are capped", db.anon("select count(*) from public.get_feed(100000, 0)")[0][0] <= 100)
        songs["feed_artists"] = artists
        songs["total_cards"] = total

    c.safe("feed", feed)

    # ── Search ─────────────────────────────────────────────────────────────
    c.start("search")

    def search():
        db.su("update public.users set display_name = 'Midnight Collective' where username = 'feed_artist_3'")
        c.ok("song by exact title first", card_ids(db.anon("select * from public.search_songs('Night Drive', 30)"))[:1]
             == [SONG3])
        c.ok("song by partial title", SONG3 in card_ids(db.anon("select * from public.search_songs('drive', 30)")))
        c.ok("song by misspelt title (trigram)",
             SONG3 in card_ids(db.anon("select * from public.search_songs('nite drive', 30)")))
        c.ok("song by artist username",
             SONG3 in card_ids(db.anon("select * from public.search_songs('dj_cool', 30)")))
        by_display = card_ids(db.anon("select * from public.search_songs('Midnight Collective', 30)"))
        c.ok("song by artist display name", len(by_display) == 3, len(by_display))
        c.ok("song by genre", SONG3 in card_ids(db.anon("select * from public.search_songs('house', 30)")))
        c.ok("LIKE wildcard '%' in the query is literal (matches nothing here)",
             db.anon("select count(*) from public.search_songs('%', 30)")[0][0] == 0)
        hits = db.anon("select title, genre, artist_username, coalesce(artist_display_name, '') "
                       "from public.search_songs('_', 100)")
        c.ok("LIKE wildcard '_' only matches a literal underscore",
             hits and all(any("_" in f for f in h) for h in hits), hits[:3])
        c.ok("empty query returns nothing", db.anon("select count(*) from public.search_songs('  ', 30)")[0][0] == 0)
        users = db.anon("select username from public.search_users('jake', 20)")
        c.ok("search_users exact match first", users and users[0][0] == "jake", users[:3])
        cols = [d for d in db.anon("select * from public.search_users('jake', 1)")]
        c.ok("user_card has 8 columns", cols and len(cols[0]) == 8)
        c.ok("search_users by display name",
             [r[0] for r in db.anon("select username from public.search_users('Midnight', 20)")] == ["feed_artist_3"])

    c.safe("search", search)

    # ── Banned users ───────────────────────────────────────────────────────
    c.start("banned users")

    def banned():
        bad = songs["feed_artists"][1]
        bad_songs = [r[0] for r in db.su("select id::text from public.songs where user_id = %s", (bad,))]
        c.raises("authenticated cannot ban anyone",
                 lambda: db.user(ADMIN, "update public.users set banned_at = now() where id = %s", (bad,)), "42501")
        db.service("update public.users set banned_at = now() where id = %s", (bad,))
        lists = {
            "new releases": card_ids(db.anon("select * from public.get_new_releases(100)")),
            "trending": card_ids(db.anon("select * from public.get_trending(100)")),
            "feed": card_ids(db.user(LISTENER, "select * from public.get_feed(100, 0)")),
            "search": card_ids(db.anon("select * from public.search_songs('Feed Song', 100)")),
            "user songs": card_ids(db.anon("select * from public.get_user_songs(%s, 100, 0)", (bad,))),
            "songs table": [str(r[0]) for r in db.anon("select id from public.songs")],
        }
        for name, ids in lists.items():
            c.ok(f"banned artist's songs hidden from {name}", not (set(bad_songs) & set(ids)))
        c.ok("get_song is null for a banned artist's song",
             db.anon("select public.get_song(%s)", (bad_songs[0],))[0][0] is None)
        c.ok("get_profile is null for a banned user", db.anon("select public.get_profile('feed_artist_1')")[0][0] is None)
        c.ok("search_users hides banned users",
             bad not in [str(r[0]) for r in db.anon("select id from public.search_users('feed_artist_1', 20)")])
        c.ok("banned user still sees their own profile",
             db.user(bad, "select public.get_profile('feed_artist_1')")[0][0] is not None)
        c.raises("banned user cannot upload", lambda: new_song(bad, "Comeback"), "42501", "row-level")
        c.raises("banned user cannot be followed",
                 lambda: db.user(LISTENER, "select public.set_follow(%s, true)", (bad,)), "not found")
        db.service("update public.users set banned_at = null where id = %s", (bad,))
        c.ok("unbanning brings the songs back",
             set(bad_songs) <= set(card_ids(db.anon("select * from public.get_new_releases(100)"))))

    c.safe("banned", banned)

    # ── Grants ─────────────────────────────────────────────────────────────
    c.start("function and view privileges")

    def grants():
        for fn in ("public.get_liked_songs(10, 0)", f"public.set_follow('{ARTIST}', true)",
                   f"public.remove_from_playlist('{LEGACY_PLAYLIST}', '{SONG1}')",
                   f"public.move_in_playlist('{LEGACY_PLAYLIST}', '{SONG1}', 0)",
                   f"public.resolve_report('{uid()}', 'open', null)", "public.admin_reports('open')"):
            c.raises(f"anon cannot execute {fn.split('(')[0]}", lambda fn=fn: db.anon(f"select {fn}"), "42501")
        for fn in (f"public.wavee_create_profile('{uid()}', 'x@y.z', '{{}}')",
                   "public.wavee_rate_limit('report', 'k', 10)",
                   f"public.wavee_song_cards(array['{SONG1}'::uuid])", "public.wavee_unique_username('x')",
                   f"public.wavee_require_playlist_owner('{LEGACY_PLAYLIST}')"):
            c.raises(f"clients cannot execute {fn.split('(')[0]}",
                     lambda fn=fn: db.user(LISTENER, f"select {fn}"), "42501")
        c.raises("old get_home_feed_public no longer callable by anon",
                 lambda: db.anon("select * from public.get_home_feed_public(5, 0)"), "42501")
        c.raises("old get_home_feed no longer callable",
                 lambda: db.user(LISTENER, f"select * from public.get_home_feed('{LISTENER}', 5, 0)"), "42501")
        c.raises("old song_scores view closed to clients",
                 lambda: db.anon("select * from public.song_scores"), "42501")
        c.raises("rate_events closed to clients", lambda: db.user(LISTENER, "select * from public.rate_events"), "42501")
        c.ok("service_role can read everything (bypasses RLS)",
             db.service("select count(*) from public.plays")[0][0] > 0
             and db.service("select count(email) from public.users")[0][0] > 0)
        cols = [r[0] for r in db.anon("select column_name from information_schema.column_privileges "
                                      "where table_schema = 'public' and table_name = 'users' "
                                      "and grantee = 'anon' and privilege_type = 'SELECT'")]
        c.ok("anon's selectable users columns exclude email", "email" not in cols and "username" in cols, cols)
        song = db.anon("select public.get_song(%s)", (SONG1,))[0][0]
        c.ok("get_song returns exactly the song_card keys",
             set(song) == {"id", "title", "genre", "description", "audio_url", "video_url", "cover_image_url",
                           "duration_seconds", "explicit", "plays_count", "likes_count", "created_at", "artist_id",
                           "artist_username", "artist_display_name", "artist_avatar_url", "liked", "hook_start",
                           "artist_verified", "links"}, sorted(song))
        c.ok("get_song of an unknown id is null", db.anon("select public.get_song(%s)", (uid(),))[0][0] is None)
        prof = db.anon("select public.get_profile('NEWBIE')")[0][0]
        c.ok("get_profile is case-insensitive and has the contract keys",
             prof and set(prof) == {"id", "username", "display_name", "avatar_url", "bio", "is_artist", "music_roles",
                                    "followers_count", "following_count", "songs_count", "is_following", "links",
                                    "ear", "verified"}, prof)
        c.ok("get_profile of an unknown user is null",
             db.anon("select public.get_profile('nobody_here')")[0][0] is None)

    c.safe("grants", grants)

    # ── Growth: links, hooks, early likes, charts ───────────────────────────
    c.start("growth: links, hooks, tastemakers, charts")

    def growth():
        good = {"spotify": "https://open.spotify.com/artist/4tZwfgrHOc3mvqYlEYSvVi",
                "apple_music": "https://music.apple.com/ng/artist/x/123",
                "audiomack": "https://audiomack.com/someone", "boomplay": "https://www.boomplay.com/artists/1",
                "youtube": "https://www.youtube.com/@someone", "instagram": "https://www.instagram.com/someone/",
                "x": "https://x.com/someone", "website": "https://someone.music"}
        c.ok("artist saves links to their platforms",
             db.user(ARTIST, "update public.users set links = %s where id = %s", (json.dumps(good), ARTIST)) == 1)
        for label, links in (
            ("a Spotify link to another site", {"spotify": "https://evil.example/open.spotify.com"}),
            ("a look-alike domain", {"spotify": "https://open.spotify.com.evil.example/x"}),
            ("a user@host trick", {"spotify": "https://open.spotify.com@evil.example/x"}),
            ("plain http", {"spotify": "http://open.spotify.com/artist/x"}),
            ("javascript:", {"website": "javascript:alert(1)"}),
            ("an unknown platform", {"myspace": "https://myspace.com/x"}),
            ("a pre-save link on a profile", {"presave": "https://distrokid.com/hyperfollow/x/y"}),
            ("a non-text value", {"spotify": 5}),
            ("an IP address website", {"website": "https://10.0.0.1/admin"}),
        ):
            c.raises(f"profile link refused: {label}",
                     lambda links=links: db.user(ARTIST, "update public.users set links = %s where id = %s",
                                                 (json.dumps(links), ARTIST)), "23514")
        c.ok("others cannot change someone's links (0 rows)",
             db.user(LISTENER, "update public.users set links = '{}' where id = %s", (ARTIST,)) == 0)
        prof = db.anon("select public.get_profile(%s)", (username_of(ARTIST),))[0][0]
        c.ok("get_profile carries the links", prof["links"] == good, prof.get("links"))
        c.ok("my_account carries the links", db.user(ARTIST, "select public.my_account()")[0][0]["links"] == good)

        sid = new_song(ARTIST, "Hooky", duration=100)
        song_links = {"spotify": "https://open.spotify.com/track/abc", "presave": "https://distrokid.com/hyperfollow/a/b"}
        c.ok("owner adds a song's links and hook",
             db.user(ARTIST, "update public.songs set links = %s, hook_start = 45 where id = %s",
                     (json.dumps(song_links), sid)) == 1)
        c.raises("song link refused: Instagram isn't a place to listen",
                 lambda: db.user(ARTIST, "update public.songs set links = %s where id = %s",
                                 (json.dumps({"instagram": "https://instagram.com/x"}), sid)), "23514")
        c.raises("hook past the end of the song refused",
                 lambda: db.user(ARTIST, "update public.songs set hook_start = 150 where id = %s", (sid,)), "23514")
        c.raises("negative hook refused",
                 lambda: db.user(ARTIST, "update public.songs set hook_start = -1 where id = %s", (sid,)), "23514")
        c.ok("others cannot set someone's hook (0 rows)",
             db.user(LISTENER, "update public.songs set hook_start = 1 where id = %s", (sid,)) == 0)
        song = db.anon("select public.get_song(%s)", (sid,))[0][0]
        c.ok("get_song carries links and hook", song["links"] == song_links and song["hook_start"] == 45, song)
        card = [r for r in db.anon("select id, hook_start from public.get_new_releases(100)") if str(r[0]) == sid]
        c.ok("song cards in lists carry the hook", card and card[0][1] == 45, card)

        # Early likes: listened properly, under 50 counted plays, not your own song.
        early = new_song(ARTIST, "Early One", duration=120)
        db.user(LISTENER, "select public.record_play(%s, 40, 120, false, null)", (early,))
        db.user(LISTENER, "select public.toggle_like(%s, true)", (early,))
        db.user(OTHER, "select public.toggle_like(%s, true)", (early,))
        db.user(ARTIST, "select public.record_play(%s, 60, 120, false, null)", (early,))
        db.user(ARTIST, "select public.toggle_like(%s, true)", (early,))
        flags = dict((str(u), e) for u, e in db.su("select user_id, early from public.likes where song_id = %s", (early,)))
        c.ok("a like after a real listen is early", flags.get(LISTENER) is True, flags)
        c.ok("a like without listening isn't early", flags.get(OTHER) is False, flags)
        c.ok("liking your own song isn't early", flags.get(ARTIST) is False, flags)
        popular = new_song(ARTIST, "Already Big", duration=120)
        db.su("update public.songs set plays_count = 80 where id = %s", (popular,))
        db.user(OTHER, "select public.record_play(%s, 60, 120, false, null)", (popular,))
        db.user(OTHER, "select public.toggle_like(%s, true)", (popular,))
        c.ok("a like once a song has 50+ plays isn't early",
             db.su("select early from public.likes where song_id = %s and user_id = %s", (popular, OTHER))[0][0] is False)
        ear = db.anon("select public.get_profile(%s)", (username_of(LISTENER),))[0][0]["ear"]
        c.ok("a listener's ear counts early likes", ear == {"early_likes": 1, "hits": 0}, ear)
        db.su("update public.songs set plays_count = 300 where id = %s", (early,))
        ear = db.anon("select public.get_profile(%s)", (username_of(LISTENER),))[0][0]["ear"]
        c.ok("an early like on a song that reaches 250 plays is a hit", ear == {"early_likes": 1, "hits": 1}, ear)
        board = db.anon("select public.get_tastemakers(20)")[0][0]
        c.ok("tastemaker leaderboard puts the hit-maker first",
             board and board[0]["user"]["id"] == LISTENER and board[0]["hits"] == 1, board)
        c.ok("tastemaker leaderboard shows no emails", "email" not in json.dumps(board))

        # Charts: counted plays in the last 7 days (to the start of this hour), not the artist's.
        a, b, cc = (new_song(ARTIST, t, genre="Chart Test", duration=100) for t in ("Chart A", "Chart B", "Chart C"))
        def plays(song, n, days_ago, listened=60, user=None):
            for _ in range(n):
                db.su("insert into public.plays (user_id, song_id, duration_listened, song_duration, created_at) "
                      "values (%s, %s, %s, 100, now() - %s::interval)", (user, song, listened, f"{days_ago} days 2 hours"))
        plays(a, 5, 1)
        plays(b, 3, 2)
        plays(cc, 2, 3)
        plays(cc, 6, 9)
        plays(b, 4, 1, listened=10)       # too short to count
        plays(cc, 9, 1, user=ARTIST)      # the artist's own
        top = db.anon("select public.get_chart('top', 'chart test', 10)")[0][0]
        c.ok("top chart orders by counted plays this week",
             [e["song"]["id"] for e in top] == [a, b, cc] and [e["plays"] for e in top] == [5, 3, 2], top)
        c.ok("top chart has last week's position", top[2]["last_rank"] == 1 and top[0]["last_rank"] is None, top)
        c.ok("genre matching ignores case and punctuation",
             len(db.anon("select public.get_chart('top', 'CHART-TEST', 10)")[0][0]) == 3)
        rising = db.anon("select public.get_chart('rising', 'chart test', 10)")[0][0]
        c.ok("rising chart: biggest gains, falling songs left out",
             [e["song"]["id"] for e in rising] == [a, b], rising)
        fresh = db.anon("select public.get_chart('fresh', 'chart test', 10)")[0][0]
        c.ok("fresh chart lists new songs with plays", [e["song"]["id"] for e in fresh] == [a, b, cc], fresh)
        db.service("update public.songs set status = 'hidden' where id = %s", (a,))
        c.ok("hidden songs drop off the charts",
             a not in [e["song"]["id"] for e in db.anon("select public.get_chart('top', 'chart test', 10)")[0][0]])
        db.service("update public.songs set status = 'active' where id = %s", (a,))
        c.ok("an unknown chart reads as top",
             len(db.anon("select public.get_chart('nonsense', 'chart test', 10)")[0][0]) == 3)

        # Verified artists: only moderators give the badge.
        name = username_of(ARTIST)
        c.ok("artists start unverified", db.anon("select public.get_profile(%s)", (name,))[0][0]["verified"] is False)
        c.raises("an artist can't verify themselves (column)",
                 lambda: db.user(ARTIST, "update public.users set verified_at = now() where id = %s", (ARTIST,)), "42501")
        c.raises("an artist can't verify themselves (function)",
                 lambda: db.user(ARTIST, "select public.set_verified(%s, true)", (ARTIST,)), "42501")
        c.raises("anon can't call set_verified",
                 lambda: db.anon("select public.set_verified(%s, true)", (ARTIST,)), "42501")
        r = db.user(ADMIN, "select public.set_verified(%s, true, 'label confirmed by email')", (ARTIST,))[0][0]
        c.ok("a moderator verifies an artist", r == {"verified": True}, r)
        c.ok("the profile shows the badge", db.anon("select public.get_profile(%s)", (name,))[0][0]["verified"] is True)
        cards = [r for r in db.anon("select id, artist_verified from public.get_new_releases(100)") if str(r[0]) == sid]
        c.ok("their song cards carry the badge", cards and cards[0][1] is True, cards)
        c.ok("the decision is logged",
             db.su("select count(*) from public.moderation_log where target_id = %s and action = 'verified'",
                   (ARTIST,))[0][0] == 1)
        db.user(ADMIN, "select public.set_verified(%s, false)", (ARTIST,))
        c.ok("a moderator can take the badge away",
             db.anon("select public.get_profile(%s)", (name,))[0][0]["verified"] is False)

    c.safe("growth", growth)

    # ── Account deletion (the delete-account Edge Function deletes the auth user) ──
    c.start("account deletion")

    def deletion():
        leaver = signup("leaver@example.com", {"username": "leaver"})
        sid = songs["main"]
        db.user(leaver, "select public.set_follow(%s, true)", (ARTIST,))
        db.user(leaver, "select public.toggle_like(%s, true)", (sid,))
        mine = new_song(leaver, "Leaving soon")
        db.user(leaver, "select public.record_play(%s, 60, 100, false, null)", (sid,))
        before = db.su("select (select followers_count from public.users where id = %s), "
                       "(select likes_count from public.songs where id = %s)", (ARTIST, sid))[0]
        db.q("delete from auth.users where id = %s", (leaver,), role="supabase_auth_admin")
        after = db.su("select (select followers_count from public.users where id = %s), "
                      "(select likes_count from public.songs where id = %s)", (ARTIST, sid))[0]
        c.ok("profile removed with the auth user",
             db.su("select count(*) from public.users where id = %s", (leaver,))[0][0] == 0)
        c.ok("their songs are removed", db.su("select count(*) from public.songs where id = %s", (mine,))[0][0] == 0)
        c.ok("followers_count and likes_count drop with them", after == (before[0] - 1, before[1] - 1), (before, after))
        c.ok("their plays stay, anonymised",
             db.su("select count(*) from public.plays where song_id = %s and user_id is null", (sid,))[0][0] >= 1)

    c.safe("deletion", deletion)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pg-bin", help="directory with initdb, pg_ctl and postgres (default: $PG_BIN or PATH)")
    ap.add_argument("--port", type=int, default=55439, help="port for the temporary server's socket name")
    ap.add_argument("--dsn", help="use this existing server (superuser) instead of starting one")
    args = ap.parse_args()

    if not os.path.exists(NEW_MIGRATION):
        sys.exit(f"missing {NEW_MIGRATION}")

    if args.dsn:
        server = existing_server(args.dsn)
    else:
        pg_bin = find_pg_bin(args.pg_bin)
        if not pg_bin:
            sys.exit("No Postgres binaries found. Pass --pg-bin, set PG_BIN, use --dsn, "
                     "or run tool/db_test/fetch_postgres.sh.")
        server = temp_cluster(pg_bin, args.port)

    c = Checks()
    with server as info:
        dbname = f"wavee_test_{uuid.uuid4().hex[:8]}"
        with psycopg.connect(**info, dbname="postgres", autocommit=True) as admin:
            admin.execute(ROLES_SQL)
            admin.execute(pgsql.SQL("create database {} owner postgres").format(pgsql.Identifier(dbname)))
            version = admin.execute("select version()").fetchone()[0]
        print(version)
        try:
            with psycopg.connect(**info, dbname=dbname, autocommit=True) as conn:
                conn.add_notice_handler(lambda n: None)
                db = Db(conn)
                c.start("Migrations")
                run_file(conn, STUB)
                for path in OLD_MIGRATIONS:
                    run_file(conn, path, role="postgres")
                c.ok(f"old migrations apply in order ({len(OLD_MIGRATIONS)} files)", True)
                run_file(conn, SEED)
                names = ", ".join(os.path.basename(p) for p in NEW_MIGRATIONS)
                try:
                    for path in NEW_MIGRATIONS:
                        run_file(conn, path, role="postgres")
                    c.ok(f"migrations apply as the non-superuser postgres role ({names})", True)
                except psycopg.Error as e:
                    c.ok(f"migrations apply as the non-superuser postgres role ({names})", False, str(e))
                    raise
                schema1 = db.one(FINGERPRINT_SQL)
                data1 = db.one(DATA_FINGERPRINT_SQL)
                # Each migration must survive running again as the newest one (an applied migration
                # is never re-run after a later one, so only the newest is repeated here; the relaunch
                # was proven the same way when it was newest).
                latest = os.path.basename(NEW_MIGRATIONS[-1])
                try:
                    run_file(conn, NEW_MIGRATIONS[-1], role="postgres")
                    c.ok(f"{latest} runs cleanly a second time", True)
                except psycopg.Error as e:
                    c.ok(f"{latest} runs cleanly a second time", False, str(e))
                    raise
                c.ok("second run leaves the schema, grants and policies unchanged", db.one(FINGERPRINT_SQL) == schema1)
                c.ok("second run leaves the data unchanged", db.one(DATA_FINGERPRINT_SQL) == data1)
                run_contract_tests(db, c)
        finally:
            with psycopg.connect(**info, dbname="postgres", autocommit=True) as admin:
                admin.execute(pgsql.SQL("drop database if exists {} with (force)").format(pgsql.Identifier(dbname)))

    print(f"\n{c.passed} passed, {len(c.failed)} failed")
    for f in c.failed:
        print(f"  FAILED: {f}")
    sys.exit(1 if c.failed else 0)


if __name__ == "__main__":
    main()
