-- Display names can match (e.g. artists with the same name); identity remains email + user id.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_username_key;
