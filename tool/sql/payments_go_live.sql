-- Run once when Flutterwave's live keys go in (the Worker's FLW_SECRET_KEY).
--
-- 1. Artist Pro's prices forget the Flutterwave payment plans made with the
--    test keys: those plans don't exist on the live account, so the first
--    live subscription makes a live plan instead.
-- 2. Subscriptions paid with Flutterwave's test card (environment 'sandbox')
--    end now: test payments never gave real access.
--
-- Run in Wavee's Supabase dashboard: SQL Editor > New query, paste, Run.
update public.wavee_plan_prices set flw_plan_id = null where flw_plan_id is not null;

update public.wavee_subscriptions
   set status = 'ended', period_end = least(coalesce(period_end, now()), now()), updated_at = now()
 where environment = 'sandbox' and status in ('pending', 'active', 'cancelled');

select
  (select count(*) from public.wavee_plan_prices where flw_plan_id is not null) as test_plans_left,
  (select count(*) from public.wavee_subscriptions where environment = 'sandbox' and status <> 'ended') as test_subscriptions_left,
  (select count(*) from public.wavee_subscriptions where environment = 'production' and status = 'active') as live_subscriptions;
