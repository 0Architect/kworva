-- M2 — matchRequest server-side implementation as a PostgreSQL RPC.
-- Run this in Supabase SQL Editor after 001_initial.sql.
--
-- This is the v1 matching logic behind the RankedCandidate interface (spec §7).
-- Swap in pgvector/Edge Function later without changing callers.

-- Enable requests table for Realtime (needed for Offers feed)
alter publication supabase_realtime add table requests;
alter publication supabase_realtime add table responses;

-- ──────────────────────────────────────────────────────────────
-- match_request(p_request_id)
-- Returns up to 20 ranked candidate plugs for a given request.
-- Scoring:
--   +3 per capacity tag matching the request's category
--   +2 if plug's area == request's area
--   +0.5 * rating_avg
--   +1 if plug has been active (any event) in the last 30 days
-- Only includes plugs with at least one matching signal (category OR area).
-- ──────────────────────────────────────────────────────────────

create or replace function match_request(p_request_id uuid)
returns table(plug_id uuid, score float, reason text)
language plpgsql security definer
as $$
declare
  v_request   requests%rowtype;
  v_cat_name  text;
begin
  select * into v_request from requests where id = p_request_id;
  if not found then return; end if;

  select name into v_cat_name from categories where id = v_request.category_id;

  return query
  select
    p.id as plug_id,

    -- Score
    (
      (select count(*)::float from capacity_tags ct
       where ct.profile_id = p.id
         and ct.category_id = v_request.category_id) * 3.0
      + case when p.area = v_request.area then 2.0 else 0.0 end
      + p.rating_avg::float * 0.5
      + case when exists(
            select 1 from events e
            where e.user_id = p.id
              and e.created_at > now() - interval '30 days'
          ) then 1.0 else 0.0 end
    ) as score,

    -- Human-readable reason string
    (
      case when exists(
            select 1 from capacity_tags ct
            where ct.profile_id = p.id
              and ct.category_id = v_request.category_id
          ) then 'category=' || coalesce(v_cat_name, '?') || '; '
           else ''
      end
      || case when p.area = v_request.area
              then 'area=' || p.area || '; '
              else ''
         end
      || 'rating=' || round(p.rating_avg, 1)::text
    ) as reason

  from profiles p
  where p.id        != v_request.author_id
    and p.is_active  = true
    and (
      -- Must match on at least one signal
      exists(
        select 1 from capacity_tags ct
        where ct.profile_id = p.id
          and ct.category_id = v_request.category_id
      )
      or p.area = v_request.area
    )
  order by score desc
  limit 20;
end;
$$;

-- Grant execute to authenticated users (client calls this directly)
grant execute on function match_request(uuid) to authenticated;
