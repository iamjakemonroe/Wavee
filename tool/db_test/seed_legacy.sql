-- Data shaped like the live database under the old schema (0001-0013), inserted before the
-- relaunch migration runs so the tests can check how it is fixed up. Run as a superuser.

insert into auth.users (id, email, raw_user_meta_data, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 'jake@example.com',        '{}', now() - interval '30 days'),
  ('00000000-0000-0000-0000-00000000000b', 'jake.upper@example.com',  '{}', now() - interval '29 days'),
  ('00000000-0000-0000-0000-00000000000c', 'shouty@example.com',      '{}', now() - interval '28 days'),
  ('00000000-0000-0000-0000-00000000000d', 'jake2@example.com',       '{}', now() - interval '27 days'),
  ('00000000-0000-0000-0000-00000000000e', 'dj@example.com',          '{}', now() - interval '26 days'),
  ('00000000-0000-0000-0000-00000000000f', 'a@example.com',           '{}', now() - interval '25 days'),
  ('00000000-0000-0000-0000-000000000010', 'long@example.com',        '{}', now() - interval '24 days'),
  ('00000000-0000-0000-0000-000000000011', 'samejake@example.com',    '{}', now() - interval '20 days'),
  -- has no public.users row: the migration must backfill it
  ('00000000-0000-0000-0000-000000000012', 'orphan.user@example.com', '{"username": "orphan"}', now() - interval '19 days');

insert into public.users (id, username, email, bio, is_artist, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 'jake',    'jake@example.com',       repeat('b', 400), true,  now() - interval '30 days'),
  ('00000000-0000-0000-0000-00000000000b', 'Jake',    'jake.upper@example.com', null,             false, now() - interval '29 days'),
  ('00000000-0000-0000-0000-00000000000c', 'JAKE',    'shouty@example.com',     null,             false, now() - interval '28 days'),
  ('00000000-0000-0000-0000-00000000000d', 'jake2',   'jake2@example.com',      null,             false, now() - interval '27 days'),
  ('00000000-0000-0000-0000-00000000000e', 'DJ Cool', 'dj@example.com',         'House DJ',       true,  now() - interval '26 days'),
  ('00000000-0000-0000-0000-00000000000f', 'a',       'a@example.com',          null,             false, now() - interval '25 days'),
  ('00000000-0000-0000-0000-000000000010', 'this_is_a_very_long_username_way_over_thirty_characters',
                                                      'long@example.com',       null,             false, now() - interval '24 days'),
  ('00000000-0000-0000-0000-000000000011', 'jake',    'samejake@example.com',   null,             false, now() - interval '20 days');

insert into public.songs (id, user_id, title, audio_url, genre, plays_count, likes_count, created_at) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Old Song One',   'https://example.com/1.mp3', 'pop',   5, 99, now() - interval '20 days'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'Old Song Two',   'https://example.com/2.mp3', 'pop',   3,  0, now() - interval '19 days'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000e', 'Night Drive',    'https://example.com/3.mp3', 'house', 7,  0, now() - interval '18 days');

-- likes_count above is stale on purpose (99 and 0); the migration recomputes it.
alter table public.likes disable trigger trigger_update_song_likes_count;
insert into public.likes (user_id, song_id, created_at) values
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', now() - interval '10 days'),
  ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000003', now() - interval '10 days');
alter table public.likes enable trigger trigger_update_song_likes_count;

insert into public.follows (follower_id, following_id) values
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a');

insert into public.playlists (id, user_id, name, is_private, created_at) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Legacy mix', false, now() - interval '9 days');

insert into public.playlist_songs (playlist_id, song_id, created_at) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', now() - interval '9 days'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() - interval '8 days'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', now() - interval '7 days');

insert into public.plays (user_id, song_id, duration_listened, song_duration, created_at) values
  ('00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-000000000001', 120, 180, now() - interval '3 days'),
  (null,                                   '10000000-0000-0000-0000-000000000003',  60, 200, now() - interval '2 days');
