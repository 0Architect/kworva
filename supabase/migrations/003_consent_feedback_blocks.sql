-- Migration 003 — consent tracking, feedback, user blocks, phone column
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New query).

-- ── profiles additions ────────────────────────────────────────

alter table profiles add column if not exists phone        text;
alter table profiles add column if not exists consent_at   timestamptz;
alter table profiles add column if not exists policy_version text;

-- ── feedback ─────────────────────────────────────────────────

create table if not exists feedback (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references profiles,
  category    text,
  body        text        not null,
  created_at  timestamptz not null default now()
);

alter table feedback enable row level security;

create policy "feedback_insert"
  on feedback for insert with check (
    auth.uid() is not null and
    (user_id is null or user_id = auth.uid())
  );

-- ── user_blocks ───────────────────────────────────────────────

create table if not exists user_blocks (
  id          uuid        primary key default gen_random_uuid(),
  blocker_id  uuid        not null references profiles on delete cascade,
  blocked_id  uuid        not null references profiles on delete cascade,
  created_at  timestamptz not null default now(),
  unique(blocker_id, blocked_id)
);

alter table user_blocks enable row level security;

create policy "blocks_select_own"
  on user_blocks for select using (auth.uid() = blocker_id);

create policy "blocks_insert_own"
  on user_blocks for insert with check (
    auth.uid() = blocker_id and
    blocker_id != blocked_id
  );

create policy "blocks_delete_own"
  on user_blocks for delete using (auth.uid() = blocker_id);
