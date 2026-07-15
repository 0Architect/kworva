-- Kworva v1 — initial schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- All tables have RLS enabled. Service role bypasses RLS for Edge Functions.
--
-- Prerequisite: Supabase project created, Auth configured for email magic-link.
-- Set site URL and redirect URL to your app scheme in:
--   Dashboard > Authentication > URL Configuration
--   Redirect URL: kworva://auth/callback

-- ──────────────────────────────────────────────────────────────
-- Config
-- ──────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────

create type transaction_type as enum (
  'buy', 'borrow_rent', 'hire', 'split', 'swap'
);

create type request_status as enum (
  'open', 'matched', 'closed', 'expired'
);

create type response_status as enum (
  'sent', 'accepted', 'declined'
);

create type report_target as enum (
  'user', 'request', 'message'
);

-- ──────────────────────────────────────────────────────────────
-- categories  (config-driven; seeded below; editable via dashboard)
-- ──────────────────────────────────────────────────────────────

create table categories (
  id         uuid    primary key default gen_random_uuid(),
  name       text    not null unique,
  is_active  boolean not null default true
);

alter table categories enable row level security;

create policy "categories_select_all"
  on categories for select using (true);

insert into categories (name) values
  ('Food'),
  ('Repairs'),
  ('Thrift'),
  ('Academics'),
  ('Grooming'),
  ('Electronics'),
  ('Events'),
  ('Errands'),
  ('Other');

-- ──────────────────────────────────────────────────────────────
-- profiles  (extends auth.users)
-- ──────────────────────────────────────────────────────────────

create table profiles (
  id               uuid      primary key references auth.users on delete cascade,
  display_name     text      not null,
  campus           text      not null default 'Unilag',
  area             text      not null,
  bio_text         text,
  phone_verified   boolean   not null default false,
  rating_avg       numeric(3,2) not null default 0,
  deals_count      integer   not null default 0,
  expo_push_token  text,
  is_active        boolean   not null default true,
  created_at       timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_all"
  on profiles for select using (true);

create policy "profiles_insert_own"
  on profiles for insert with check (auth.uid() = id);

create policy "profiles_update_own"
  on profiles for update using (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────
-- capacity_tags  (declared standing supply — matching hint only)
-- ──────────────────────────────────────────────────────────────

create table capacity_tags (
  id          uuid        primary key default gen_random_uuid(),
  profile_id  uuid        not null references profiles on delete cascade,
  label       text        not null,
  category_id uuid        references categories,
  created_at  timestamptz not null default now()
);

alter table capacity_tags enable row level security;

create policy "capacity_tags_select_all"
  on capacity_tags for select using (true);

create policy "capacity_tags_insert_own"
  on capacity_tags for insert with check (auth.uid() = profile_id);

create policy "capacity_tags_delete_own"
  on capacity_tags for delete using (auth.uid() = profile_id);

-- ──────────────────────────────────────────────────────────────
-- requests
-- ──────────────────────────────────────────────────────────────

create table requests (
  id               uuid             primary key default gen_random_uuid(),
  author_id        uuid             not null references profiles on delete cascade,
  text             text             not null,
  transaction_type transaction_type not null,
  category_id      uuid             references categories,
  budget_text      text,
  area             text             not null,
  status           request_status   not null default 'open',
  created_at       timestamptz      not null default now(),
  expires_at       timestamptz
);

alter table requests enable row level security;

create policy "requests_select_all"
  on requests for select using (true);

create policy "requests_insert_own"
  on requests for insert with check (auth.uid() = author_id);

create policy "requests_update_own"
  on requests for update using (auth.uid() = author_id);

-- ──────────────────────────────────────────────────────────────
-- responses
-- ──────────────────────────────────────────────────────────────

create table responses (
  id          uuid            primary key default gen_random_uuid(),
  request_id  uuid            not null references requests on delete cascade,
  plug_id     uuid            not null references profiles on delete cascade,
  message     text            not null,
  price_text  text,
  status      response_status not null default 'sent',
  created_at  timestamptz     not null default now(),
  unique(request_id, plug_id)
);

alter table responses enable row level security;

-- Visible to: the plug who sent it, or the request author
create policy "responses_select_participant"
  on responses for select using (
    auth.uid() = plug_id or
    auth.uid() = (select author_id from requests where id = request_id)
  );

-- Plug can respond to any request that isn't theirs
create policy "responses_insert_plug"
  on responses for insert with check (
    auth.uid() = plug_id and
    auth.uid() != (select author_id from requests where id = request_id)
  );

-- Request author can accept/decline; plug can withdraw
create policy "responses_update_participant"
  on responses for update using (
    auth.uid() = plug_id or
    auth.uid() = (select author_id from requests where id = request_id)
  );

-- ──────────────────────────────────────────────────────────────
-- chats  (one row per request+plug pair)
-- ──────────────────────────────────────────────────────────────

create table chats (
  id          uuid        primary key default gen_random_uuid(),
  request_id  uuid        not null references requests on delete cascade,
  buyer_id    uuid        not null references profiles on delete cascade,
  plug_id     uuid        not null references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  unique(request_id, plug_id)
);

alter table chats enable row level security;

create policy "chats_select_participant"
  on chats for select using (
    auth.uid() = buyer_id or auth.uid() = plug_id
  );

-- Plug initiates the chat; buyer_id must be the request author
create policy "chats_insert_plug"
  on chats for insert with check (
    auth.uid() = plug_id and
    buyer_id = (select author_id from requests where id = request_id)
  );

-- ──────────────────────────────────────────────────────────────
-- messages
-- ──────────────────────────────────────────────────────────────

create table messages (
  id         uuid        primary key default gen_random_uuid(),
  chat_id    uuid        not null references chats on delete cascade,
  sender_id  uuid        not null references profiles on delete cascade,
  body       text        not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "messages_select_participant"
  on messages for select using (
    exists (
      select 1 from chats
      where id = chat_id
        and (buyer_id = auth.uid() or plug_id = auth.uid())
    )
  );

create policy "messages_insert_participant"
  on messages for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from chats
      where id = chat_id
        and (buyer_id = auth.uid() or plug_id = auth.uid())
    )
  );

-- Recipient marks messages read
create policy "messages_update_recipient"
  on messages for update using (
    exists (
      select 1 from chats
      where id = chat_id
        and (buyer_id = auth.uid() or plug_id = auth.uid())
    )
  );

-- ──────────────────────────────────────────────────────────────
-- ratings
-- ──────────────────────────────────────────────────────────────

create table ratings (
  id          uuid        primary key default gen_random_uuid(),
  rater_id    uuid        not null references profiles on delete cascade,
  ratee_id    uuid        not null references profiles on delete cascade,
  request_id  uuid        not null references requests,
  stars       integer     not null check (stars between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now(),
  unique(rater_id, ratee_id, request_id)
);

alter table ratings enable row level security;

create policy "ratings_select_all"
  on ratings for select using (true);

-- Only users who share a chat on this request can rate
create policy "ratings_insert_participant"
  on ratings for insert with check (
    auth.uid() = rater_id and
    rater_id != ratee_id and
    exists (
      select 1 from chats
      where request_id = ratings.request_id
        and (buyer_id = auth.uid() or plug_id = auth.uid())
    )
  );

-- ──────────────────────────────────────────────────────────────
-- events  (append-only — THE ASSET; never update or delete)
-- ──────────────────────────────────────────────────────────────

create table events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references profiles,
  type       text        not null,
  payload    jsonb       not null default '{}',
  created_at timestamptz not null default now()
);

alter table events enable row level security;

-- Authenticated clients can insert their own events (no reads from client)
create policy "events_insert_own"
  on events for insert with check (
    auth.uid() is not null and
    (user_id is null or user_id = auth.uid())
  );

-- Prevent updates and deletes at RLS level (append-only guarantee)
-- Service role can read for analytics.

-- ──────────────────────────────────────────────────────────────
-- reports  (safety)
-- ──────────────────────────────────────────────────────────────

create table reports (
  id           uuid          primary key default gen_random_uuid(),
  reporter_id  uuid          not null references profiles on delete cascade,
  target_type  report_target not null,
  target_id    uuid          not null,
  reason       text          not null,
  created_at   timestamptz   not null default now()
);

alter table reports enable row level security;

create policy "reports_insert_own"
  on reports for insert with check (auth.uid() = reporter_id);

-- ──────────────────────────────────────────────────────────────
-- Trigger: keep profiles.rating_avg + deals_count in sync
-- ──────────────────────────────────────────────────────────────

create or replace function sync_profile_rating()
returns trigger language plpgsql security definer as $$
begin
  update profiles
  set
    rating_avg  = (select coalesce(round(avg(stars)::numeric, 2), 0) from ratings where ratee_id = new.ratee_id),
    deals_count = (select count(*) from ratings where ratee_id = new.ratee_id)
  where id = new.ratee_id;
  return new;
end;
$$;

create trigger trg_sync_profile_rating
  after insert on ratings
  for each row execute function sync_profile_rating();

-- ──────────────────────────────────────────────────────────────
-- Realtime: enable for chat tables
-- ──────────────────────────────────────────────────────────────

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table chats;
