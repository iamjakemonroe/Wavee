-- Wavee's money, through Flutterwave (the Worker's /api/pay/* talks to it):
--
--   * Boost: an artist pays to put a song in front of new listeners, shown in
--     the feed as Promoted until it has reached the listeners paid for
--     (boost_packs / boost_prices, boosts, boost_reach). A listener counts
--     once they've heard it for a while (boost_heard). Boosted listeners never
--     count toward the charts or trending for that song: that's what keeps the
--     charts worth climbing and Boost worth paying for.
--   * Wavee Artist Pro, monthly (wavee_plans / wavee_plan_prices,
--     wavee_subscriptions): one free 100-listener Boost each month, bigger
--     uploads (the Worker checks wavee_my_plan) and song stats (song_stats).
--     A Flutterwave payment plan charges the card again each month until it's
--     cancelled; the Worker makes the plan the first time a price is paid.
--   * wavee_charges: every payment, credited once.
--
-- Prices are in US dollars (Flutterwave converts for cards in other
-- currencies); change them in the SQL editor, e.g.
--   update boost_prices set amount = 3.49 where pack = 'wavee.boost.100' and currency = 'USD';
--   (for a plan, also set flw_plan_id = null so a Flutterwave plan at the new price is made)

-- ── Boost ───────────────────────────────────────────────────────────────

create table if not exists public.boost_packs (
  id        text primary key,
  listeners int not null check (listeners > 0),
  sort      int not null default 0
);

insert into public.boost_packs (id, listeners, sort) values
  ('wavee.boost.100', 100, 1),
  ('wavee.boost.500', 500, 2),
  ('wavee.boost.2000', 2000, 3)
on conflict (id) do nothing;

create table if not exists public.boost_prices (
  pack     text not null references public.boost_packs (id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount   numeric(12, 2) not null check (amount > 0),
  primary key (pack, currency)
);

insert into public.boost_prices (pack, currency, amount) values
  ('wavee.boost.100', 'USD', 2.99),
  ('wavee.boost.500', 'USD', 9.99),
  ('wavee.boost.2000', 'USD', 29.99)
on conflict (pack, currency) do nothing;

create table if not exists public.boosts (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,
  song_id     uuid not null references public.songs (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  pack        text not null references public.boost_packs (id),
  listeners   int not null check (listeners > 0),
  reached     int not null default 0,
  -- 'paid' through checkout, or a Pro member's free one for the month.
  source      text not null default 'paid' check (source in ('paid', 'pro')),
  currency    text not null,
  amount      numeric(12, 2) not null,
  status      text not null default 'pending' check (status in ('pending', 'active', 'done', 'stopped')),
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  created_at  timestamptz not null default now(),
  paid_at     timestamptz,
  done_at     timestamptz
);

create index if not exists boosts_live on public.boosts (status, song_id) where status = 'active';
create index if not exists boosts_by_user on public.boosts (user_id, created_at desc);
create index if not exists boosts_by_song on public.boosts (song_id);
create index if not exists boosts_by_pack on public.boosts (pack);

create table if not exists public.boost_reach (
  boost_id uuid not null references public.boosts (id) on delete cascade,
  user_id  uuid not null references public.users (id) on delete cascade,
  at       timestamptz not null default now(),
  primary key (boost_id, user_id)
);

create index if not exists boost_reach_by_user on public.boost_reach (user_id);

-- ── Artist Pro ──────────────────────────────────────────────────────────

create table if not exists public.wavee_plans (
  id      text primary key,
  title   text not null,
  period  text not null check (period in ('weekly', 'monthly')),
  days    int not null check (days > 0),
  sort    int not null default 0
);

insert into public.wavee_plans (id, title, period, days, sort) values
  ('wavee.pro.monthly', 'Wavee Artist Pro', 'monthly', 30, 1)
on conflict (id) do nothing;

create table if not exists public.wavee_plan_prices (
  plan_id     text not null references public.wavee_plans (id) on delete cascade,
  currency    text not null check (currency ~ '^[A-Z]{3}$'),
  amount      numeric(12, 2) not null check (amount > 0),
  flw_plan_id text,
  primary key (plan_id, currency)
);

insert into public.wavee_plan_prices (plan_id, currency, amount) values
  ('wavee.pro.monthly', 'USD', 4.99)
on conflict (plan_id, currency) do nothing;

create table if not exists public.wavee_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  plan_id     text not null references public.wavee_plans (id),
  currency    text not null,
  amount      numeric(12, 2) not null,
  ref         text not null unique,
  email       text not null,
  flw_plan_id text,
  status      text not null default 'pending' check (status in ('pending', 'active', 'cancelled', 'ended')),
  period_end  timestamptz,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists wavee_subscriptions_by_user on public.wavee_subscriptions (user_id, created_at desc);
create index if not exists wavee_subscriptions_by_plan on public.wavee_subscriptions (plan_id);
create index if not exists wavee_subscriptions_by_plan_email on public.wavee_subscriptions (flw_plan_id, lower(email));

create table if not exists public.wavee_charges (
  provider_id text primary key,
  ref         text not null,
  amount      numeric(12, 2) not null,
  currency    text not null,
  created_at  timestamptz not null default now()
);

alter table public.boost_packs enable row level security;
alter table public.boost_prices enable row level security;
alter table public.boosts enable row level security;
alter table public.boost_reach enable row level security;
alter table public.wavee_plans enable row level security;
alter table public.wavee_plan_prices enable row level security;
alter table public.wavee_subscriptions enable row level security;
alter table public.wavee_charges enable row level security;
revoke all on public.boost_packs, public.boost_prices, public.boosts, public.boost_reach,
  public.wavee_plans, public.wavee_plan_prices, public.wavee_subscriptions, public.wavee_charges
  from anon, authenticated;

/** Until when [p_user] is an Artist Pro member (null: not now). */
create or replace function public._wavee_pro_until(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(period_end) from public.wavee_subscriptions
   where user_id = p_user and status in ('active', 'cancelled') and period_end > now();
$$;

revoke all on function public._wavee_pro_until(uuid) from public, anon, authenticated;

/** The signed-in artist's plan: {pro_until, free_boost} (whether this
 * month's free Boost is still there). */
create or replace function public.wavee_my_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_until timestamptz;
  v_used boolean := false;
begin
  if v_me is null then return jsonb_build_object('pro_until', null, 'free_boost', false); end if;
  v_until := public._wavee_pro_until(v_me);
  if v_until is not null then
    v_used := exists (select 1 from public.boosts
                       where user_id = v_me and source = 'pro'
                         and created_at > v_until - interval '31 days');
  end if;
  return jsonb_build_object('pro_until', v_until, 'free_boost', v_until is not null and not v_used);
end;
$$;

revoke all on function public.wavee_my_plan() from public, anon;
grant execute on function public.wavee_my_plan() to authenticated;

/** What's for sale, priced in [p_currency] (dollars where there's no price
 * in it): {packs: [{id, listeners, currency, amount}], plans: [...]}. */
create or replace function public.wavee_shop(p_currency text default 'USD')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'packs', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', k.id, 'listeners', k.listeners,
                'currency', coalesce(l.currency, u.currency), 'amount', coalesce(l.amount, u.amount))
                order by k.sort), '[]'::jsonb)
                from public.boost_packs k
                join public.boost_prices u on u.pack = k.id and u.currency = 'USD'
                left join public.boost_prices l on l.pack = k.id and l.currency = upper(coalesce(p_currency, 'USD'))),
    'plans', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', p.id, 'title', p.title, 'period', p.period,
                'currency', coalesce(l.currency, u.currency), 'amount', coalesce(l.amount, u.amount))
                order by p.sort), '[]'::jsonb)
                from public.wavee_plans p
                join public.wavee_plan_prices u on u.plan_id = p.id and u.currency = 'USD'
                left join public.wavee_plan_prices l on l.plan_id = p.id and l.currency = upper(coalesce(p_currency, 'USD')))
  );
$$;

revoke all on function public.wavee_shop(text) from public;
grant execute on function public.wavee_shop(text) to anon, authenticated;

/** The signed-in artist's email for checkout (Flutterwave needs one). */
create or replace function public._wavee_email(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(a.email, u.email) from public.users u left join auth.users a on a.id = u.id where u.id = p_user;
$$;

revoke all on function public._wavee_email(uuid) from public, anon, authenticated;

/** Starts paying to boost [p_song] (theirs, live) with [p_pack]: the
 * checkout's reference and price. */
create or replace function public.boost_start(p_song uuid, p_pack text, p_currency text default 'USD')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_song public.songs;
  v_pack public.boost_packs;
  v_price public.boost_prices;
  v_ref text;
begin
  if v_me is null then raise exception 'Please sign in' using errcode = '42501'; end if;
  select * into v_song from public.songs where id = p_song;
  if not found or v_song.user_id <> v_me then raise exception 'not your song'; end if;
  if v_song.status <> 'active' then raise exception 'song not live'; end if;
  if exists (select 1 from public.users where id = v_me and banned_at is not null) then
    raise exception 'not allowed';
  end if;
  select * into v_pack from public.boost_packs where id = p_pack;
  if not found then raise exception 'unknown pack'; end if;
  select * into v_price from public.boost_prices where pack = p_pack and currency = upper(coalesce(p_currency, 'USD'));
  if not found then
    select * into v_price from public.boost_prices where pack = p_pack and currency = 'USD';
  end if;
  v_ref := 'wavee-boost-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.boosts (ref, song_id, user_id, pack, listeners, currency, amount)
  values (v_ref, p_song, v_me, p_pack, v_pack.listeners, v_price.currency, v_price.amount);
  return jsonb_build_object(
    'ref', v_ref, 'amount', v_price.amount, 'currency', v_price.currency,
    'listeners', v_pack.listeners, 'title', v_song.title, 'email', public._wavee_email(v_me),
    'name', (select coalesce(display_name, username) from public.users where id = v_me)
  );
end;
$$;

revoke all on function public.boost_start(uuid, text, text) from public, anon;
grant execute on function public.boost_start(uuid, text, text) to authenticated;

/** An Artist Pro member's free 100-listener Boost for the month, on [p_song]. */
create or replace function public.boost_free(p_song uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_song public.songs;
  v_id uuid;
begin
  if v_me is null then raise exception 'Please sign in' using errcode = '42501'; end if;
  if not coalesce((public.wavee_my_plan() ->> 'free_boost')::boolean, false) then
    raise exception 'no free boost';
  end if;
  select * into v_song from public.songs where id = p_song;
  if not found or v_song.user_id <> v_me then raise exception 'not your song'; end if;
  if v_song.status <> 'active' then raise exception 'song not live'; end if;
  insert into public.boosts (ref, song_id, user_id, pack, listeners, source, currency, amount, status, paid_at)
  values ('wavee-free-' || replace(gen_random_uuid()::text, '-', ''), p_song, v_me, 'wavee.boost.100', 100,
          'pro', 'USD', 0, 'active', now())
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'listeners', 100);
end;
$$;

revoke all on function public.boost_free(uuid) from public, anon;
grant execute on function public.boost_free(uuid) to authenticated;

/** Flutterwave confirmed payment [p_provider_id] for checkout [p_ref]: a
 * Boost goes live, or a subscription's first period starts. Once. */
create or replace function public.wavee_credit(
  p_ref text,
  p_provider_id text,
  p_amount numeric,
  p_currency text,
  p_environment text default 'production'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_boost public.boosts;
  v_sub public.wavee_subscriptions;
  v_env text := case when p_environment = 'sandbox' then 'sandbox' else 'production' end;
begin
  if p_ref like 'wavee-boost-%' then
    select * into v_boost from public.boosts where ref = p_ref for update;
    if not found then raise exception 'unknown payment'; end if;
    if upper(p_currency) <> v_boost.currency or p_amount < v_boost.amount then
      raise exception 'paid % %, expected % %', p_amount, p_currency, v_boost.amount, v_boost.currency;
    end if;
    insert into public.wavee_charges (provider_id, ref, amount, currency)
      values (p_provider_id, p_ref, p_amount, upper(p_currency)) on conflict (provider_id) do nothing;
    if found and v_boost.status = 'pending' then
      update public.boosts set status = 'active', paid_at = now(), environment = v_env where id = v_boost.id;
    end if;
    return jsonb_build_object('kind', 'boost', 'user_id', v_boost.user_id, 'listeners', v_boost.listeners);
  end if;
  select * into v_sub from public.wavee_subscriptions where ref = p_ref for update;
  if not found then raise exception 'unknown payment'; end if;
  return public._wavee_sub_paid(v_sub, p_provider_id, p_amount, p_currency, v_env);
end;
$$;

/** A payment for subscription [p_sub]: the period paid for starts now (or
 * when the last one ends), with a day's grace for the next charge. */
create or replace function public._wavee_sub_paid(
  p_sub public.wavee_subscriptions,
  p_provider_id text,
  p_amount numeric,
  p_currency text,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int;
  v_end timestamptz;
begin
  if upper(p_currency) <> p_sub.currency or p_amount < p_sub.amount then
    raise exception 'paid % %, expected % %', p_amount, p_currency, p_sub.amount, p_sub.currency;
  end if;
  insert into public.wavee_charges (provider_id, ref, amount, currency)
    values (p_provider_id, p_sub.ref, p_amount, upper(p_currency)) on conflict (provider_id) do nothing;
  if not found then
    return jsonb_build_object('kind', 'pro', 'user_id', p_sub.user_id, 'until', p_sub.period_end, 'again', true);
  end if;
  select days into v_days from public.wavee_plans where id = p_sub.plan_id;
  v_end := greatest(coalesce(p_sub.period_end, now()), now()) + make_interval(days => v_days + 1);
  update public.wavee_subscriptions
     set status = 'active', period_end = v_end, environment = p_environment, updated_at = now()
   where id = p_sub.id;
  return jsonb_build_object('kind', 'pro', 'user_id', p_sub.user_id, 'until', v_end);
end;
$$;

/** A renewal: Flutterwave charged [p_email] again on plan [p_flw_plan_id]. */
create or replace function public.wavee_renew(
  p_flw_plan_id text,
  p_email text,
  p_provider_id text,
  p_amount numeric,
  p_currency text,
  p_environment text default 'production'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.wavee_subscriptions;
begin
  select * into v_sub from public.wavee_subscriptions
   where flw_plan_id = p_flw_plan_id and lower(email) = lower(p_email) and status <> 'pending'
   order by created_at desc limit 1 for update;
  if not found then raise exception 'unknown subscription'; end if;
  return public._wavee_sub_paid(v_sub, p_provider_id, p_amount, p_currency,
                                case when p_environment = 'sandbox' then 'sandbox' else 'production' end);
end;
$$;

/** Cancelled: paid-up time is kept, nothing more is charged. */
create or replace function public.wavee_end(p_flw_plan_id text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.wavee_subscriptions;
begin
  update public.wavee_subscriptions
     set status = case when period_end > now() then 'cancelled' else 'ended' end, updated_at = now()
   where id = (select id from public.wavee_subscriptions
                where flw_plan_id = p_flw_plan_id and lower(email) = lower(p_email)
                  and status in ('active', 'cancelled')
                order by created_at desc limit 1)
  returning * into v_sub;
  if v_sub.id is null then return jsonb_build_object('ended', false); end if;
  return jsonb_build_object('ended', true, 'user_id', v_sub.user_id, 'until', v_sub.period_end);
end;
$$;

/** Starts subscribing to [p_plan]: the checkout's reference, price and
 * Flutterwave plan (null until the Worker has made it). */
create or replace function public.wavee_subscribe_start(p_plan text, p_currency text default 'USD')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_plan public.wavee_plans;
  v_price public.wavee_plan_prices;
  v_ref text;
  v_email text;
begin
  if v_me is null then raise exception 'Please sign in' using errcode = '42501'; end if;
  select * into v_plan from public.wavee_plans where id = p_plan;
  if not found then raise exception 'unknown plan'; end if;
  if public._wavee_pro_until(v_me) is not null then raise exception 'already a member'; end if;
  select * into v_price from public.wavee_plan_prices where plan_id = p_plan and currency = upper(coalesce(p_currency, 'USD'));
  if not found then
    select * into v_price from public.wavee_plan_prices where plan_id = p_plan and currency = 'USD';
  end if;
  v_email := public._wavee_email(v_me);
  v_ref := 'wavee-sub-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.wavee_subscriptions (user_id, plan_id, currency, amount, ref, email, flw_plan_id)
  values (v_me, p_plan, v_price.currency, v_price.amount, v_ref, v_email, v_price.flw_plan_id);
  return jsonb_build_object(
    'ref', v_ref, 'plan', p_plan, 'title', v_plan.title, 'period', v_plan.period,
    'amount', v_price.amount, 'currency', v_price.currency, 'flw_plan_id', v_price.flw_plan_id,
    'email', v_email, 'name', (select coalesce(display_name, username) from public.users where id = v_me)
  );
end;
$$;

revoke all on function public.wavee_subscribe_start(text, text) from public, anon;
grant execute on function public.wavee_subscribe_start(text, text) to authenticated;

/** The Worker made Flutterwave's plan for a price: kept for later
 * checkouts, and on the checkout [p_ref]. */
create or replace function public.wavee_plan_flw(p_plan text, p_currency text, p_flw_plan_id text, p_ref text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.wavee_plan_prices set flw_plan_id = p_flw_plan_id
   where plan_id = p_plan and currency = p_currency and flw_plan_id is null;
  update public.wavee_subscriptions set flw_plan_id = p_flw_plan_id, updated_at = now()
   where ref = p_ref and flw_plan_id is null;
$$;

/** The member's own subscription, to cancel it with Flutterwave. */
create or replace function public.wavee_subscription_mine()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('flw_plan_id', flw_plan_id, 'email', email, 'until', period_end, 'status', status)
    from public.wavee_subscriptions
   where user_id = auth.uid() and status in ('active', 'cancelled')
   order by created_at desc limit 1;
$$;

revoke all on function public.wavee_subscription_mine() from public, anon;
grant execute on function public.wavee_subscription_mine() to authenticated;

revoke all on function public.wavee_credit(text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public._wavee_sub_paid(public.wavee_subscriptions, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.wavee_renew(text, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.wavee_end(text, text) from public, anon, authenticated;
revoke all on function public.wavee_plan_flw(text, text, text, text) from public, anon, authenticated;
grant execute on function public.wavee_credit(text, text, numeric, text, text) to service_role;
grant execute on function public.wavee_renew(text, text, text, numeric, text, text) to service_role;
grant execute on function public.wavee_end(text, text) to service_role;
grant execute on function public.wavee_plan_flw(text, text, text, text) to service_role;

-- ── Promoted in the feed ────────────────────────────────────────────────

/** Up to [p_limit] boosted songs for this listener: live boosts of live
 * songs, not their own, not ones that have reached them already; the ones
 * furthest from their goal first. [{boost_id, song}] */
create or replace function public.get_promoted(p_limit integer default 2)
returns jsonb
language sql
volatile
security definer
set search_path = public, extensions
as $$
  with picks as (
    select b.id, b.song_id,
           row_number() over (order by b.reached::float / b.listeners, random()) as n
      from public.boosts b
      join public.songs s on s.id = b.song_id
      join public.users u on u.id = s.user_id
     where b.status = 'active' and s.status = 'active' and u.banned_at is null
       and (auth.uid() is null or (s.user_id <> auth.uid()
            and not exists (select 1 from public.boost_reach r where r.boost_id = b.id and r.user_id = auth.uid())))
     order by n
     limit least(greatest(coalesce(p_limit, 2), 1), 5)
  )
  select coalesce(jsonb_agg(jsonb_build_object('boost_id', p.id, 'song', to_jsonb(c)) order by p.n), '[]'::jsonb)
    from picks p
    cross join lateral public.wavee_song_cards(array[p.song_id]) c;
$$;

revoke all on function public.get_promoted(integer) from public;
grant execute on function public.get_promoted(integer) to anon, authenticated;

/** A signed-in listener heard boosted song [p_boost] for a while: they count
 * toward it, once; a Boost that's reached everyone it paid for is done. */
create or replace function public.boost_heard(p_boost uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_boost public.boosts;
begin
  if v_me is null then return jsonb_build_object('counted', false); end if;
  select * into v_boost from public.boosts where id = p_boost for update;
  if not found or v_boost.status <> 'active' or v_boost.user_id = v_me then
    return jsonb_build_object('counted', false);
  end if;
  insert into public.boost_reach (boost_id, user_id) values (p_boost, v_me) on conflict do nothing;
  if not found then return jsonb_build_object('counted', false); end if;
  update public.boosts
     set reached = reached + 1,
         status = case when reached + 1 >= listeners then 'done' else status end,
         done_at = case when reached + 1 >= listeners then now() else done_at end
   where id = p_boost;
  return jsonb_build_object('counted', true);
end;
$$;

revoke all on function public.boost_heard(uuid) from public, anon;
grant execute on function public.boost_heard(uuid) to authenticated;

/** The signed-in artist's Boosts, newest first. */
create or replace function public.my_boosts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'song_id', b.song_id, 'title', s.title, 'cover', s.cover_image_url,
           'listeners', b.listeners, 'reached', b.reached, 'status', b.status, 'source', b.source,
           'amount', b.amount, 'currency', b.currency, 'created_at', b.created_at, 'done_at', b.done_at)
           order by b.created_at desc), '[]'::jsonb)
    from public.boosts b join public.songs s on s.id = b.song_id
   where b.user_id = auth.uid() and b.status <> 'pending';
$$;

revoke all on function public.my_boosts() from public, anon;
grant execute on function public.my_boosts() to authenticated;

-- ── Stats (Artist Pro) ──────────────────────────────────────────────────

/** [p_song]'s last 30 days, for its artist: plays and listeners (counted the
 * way the charts count them), how much of it people hear, likes. Pro members
 * (and admins) get every day; everyone else the totals. */
create or replace function public.song_stats(p_song uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_me uuid := auth.uid();
  v_song public.songs;
  v_pro boolean;
  v_totals jsonb;
  v_days jsonb := null;
begin
  if v_me is null then raise exception 'Please sign in' using errcode = '42501'; end if;
  select * into v_song from public.songs where id = p_song;
  if not found or (v_song.user_id <> v_me and not public.wavee_is_admin()) then
    raise exception 'not your song';
  end if;
  v_pro := public._wavee_pro_until(v_me) is not null or public.wavee_is_admin();
  select jsonb_build_object(
           'plays', count(*),
           'listeners', count(distinct p.user_id),
           'heard_pct', round(coalesce(avg(least(p.duration_listened / nullif(p.song_duration, 0), 1)), 0) * 100),
           'likes', v_song.likes_count)
    into v_totals
    from public.plays p
   where p.song_id = p_song and p.created_at >= now() - interval '30 days'
     and (p.user_id is null or p.user_id <> v_song.user_id);
  if v_pro then
    select jsonb_agg(jsonb_build_object('day', d.day, 'plays', coalesce(c.n, 0), 'listeners', coalesce(c.l, 0))
                     order by d.day)
      into v_days
      from generate_series(((now() at time zone 'utc')::date - 29), (now() at time zone 'utc')::date, interval '1 day') as d(day)
      left join (
        select (p.created_at at time zone 'utc')::date as day, count(*) as n, count(distinct p.user_id) as l
          from public.plays p
         where p.song_id = p_song and p.created_at >= now() - interval '31 days'
           and (p.user_id is null or p.user_id <> v_song.user_id)
         group by 1
      ) c on c.day = d.day::date;
  end if;
  return v_totals || jsonb_build_object('pro', v_pro, 'days', v_days);
end;
$$;

revoke all on function public.song_stats(uuid) from public, anon;
grant execute on function public.song_stats(uuid) to authenticated;

-- ── The charts don't count boosted listeners ────────────────────────────

/** Whether listener [p_user] reached [p_song] through a Boost. */
create or replace function public._wavee_boosted(p_song uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and exists (
    select 1 from public.boost_reach r join public.boosts b on b.id = r.boost_id
     where b.song_id = p_song and r.user_id = p_user);
$$;

revoke all on function public._wavee_boosted(uuid, uuid) from public, anon, authenticated;

create or replace function public.wavee_chart_plays()
returns table (song_id uuid, this_week bigint, last_week bigint)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with bounds as (select date_trunc('hour', now()) as t)
  select p.song_id,
         count(*) filter (where p.created_at >= b.t - interval '7 days') as this_week,
         count(*) filter (where p.created_at < b.t - interval '7 days') as last_week
  from public.plays p
  cross join bounds b
  join public.songs s on s.id = p.song_id
  join public.users o on o.id = s.user_id
  where p.created_at >= b.t - interval '14 days'
    and not o.is_official
    and p.created_at < b.t
    and (p.user_id is null or p.user_id <> s.user_id)
    and (p.duration_listened >= 30 or (p.song_duration > 0 and p.duration_listened >= p.song_duration / 2.0))
    and not public._wavee_boosted(p.song_id, p.user_id)
  group by p.song_id
$$;

create or replace function public.get_trending(p_limit integer default 20)
returns setof public.song_card
language sql
stable
security definer
set search_path = public, extensions
as $$
  select * from public.wavee_song_cards(array(
    select s.id
    from public.songs s
    join public.users u on u.id = s.user_id
    left join (
      select p.song_id, count(*) as n
      from public.plays p
      where p.created_at >= now() - interval '7 days'
        and not public._wavee_boosted(p.song_id, p.user_id)
      group by p.song_id
    ) t on t.song_id = s.id
    where s.status = 'active' and u.banned_at is null and not u.is_official
    order by coalesce(t.n, 0) desc, s.likes_count desc, s.created_at desc, s.id
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ))
$$;
