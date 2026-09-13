-- Fix: entity ids from Firestore are arbitrary strings ("c1", "m_1783...", "lm_...abc"),
-- not UUIDs. Only `users` should be uuid (it maps 1:1 to Supabase auth.users). Everything
-- else keyed by a Firestore doc id becomes text. Nothing real has landed yet, so drop
-- and recreate rather than ALTER.
drop table if exists endorsements, tournament_registrations, planned_matches, friends,
  conversation_messages, conversations, live_matches, court_sessions, notifications,
  club_messages, clubs, challenges, tournaments, matches cascade;

create table matches (
  id text primary key,
  type text not null,
  player1_id uuid references users(uid), player1_name text, player1_username text,
  player1_partner_id uuid references users(uid), player1_partner_name text, player1_partner_username text,
  player2_id uuid references users(uid), player2_name text, player2_username text,
  player2_partner_id uuid references users(uid), player2_partner_name text, player2_partner_username text,
  winner_id uuid,
  games jsonb not null,
  status text not null default 'Pending',
  mmr_change int,
  played_at timestamptz not null default now(),
  location text, venue text,
  pending_confirmations uuid[],
  planned_match_id text,
  recorded_live boolean,
  live_stats jsonb
);
create index on matches (player1_id);
create index on matches (player2_id);

create table tournaments (
  id text primary key,
  is_dummy boolean, country text, name text not null, type text not null,
  status text not null default 'Upcoming', prize_pool numeric not null default 0,
  entry_fee numeric not null default 0, min_mmr int, max_mmr int,
  max_players int not null, current_players int not null default 0,
  state text, venue text not null, date date not null, time text,
  is_private boolean, bracket jsonb, tags text[], description text, organiser text,
  host_uid uuid references users(uid), participants jsonb
);

create table challenges (
  id text primary key,
  from_id uuid references users(uid), from_name text, from_username text,
  to_id uuid references users(uid), to_name text, to_username text,
  format text not null, venue text not null, date timestamptz not null,
  message text, status text not null default 'pending', created_at timestamptz not null default now()
);

create table clubs (
  id text primary key,
  is_dummy boolean, name text not null, short_name text not null, description text,
  purpose text not null, state text, area text, logo_initials text, color text,
  max_members int not null, min_mmr int, is_private boolean not null default false,
  admin_id uuid references users(uid) not null, moderator_ids uuid[],
  member_ids uuid[] not null default '{}', pending_ids uuid[] not null default '{}',
  avg_mmr numeric, top_players uuid[], tags text[], founded_year int, announcement text
);

create table club_messages (
  id text primary key,
  club_id text references clubs(id) on delete cascade not null,
  sender_id uuid references users(uid), sender_name text, text text not null,
  sent_at timestamptz not null default now()
);
create index on club_messages (club_id);

create table notifications (
  id text primary key default gen_random_uuid()::text,
  user_id uuid references users(uid) on delete cascade not null,
  type text not null, title text not null, body text, read boolean not null default false,
  created_at timestamptz not null default now(), link_to text, meta jsonb
);
create index on notifications (user_id);

create table court_sessions (
  id text primary key,
  join_code text unique not null, host_uid uuid references users(uid) not null,
  status text not null default 'active', positions jsonb not null default '[]',
  created_at timestamptz not null default now(), planned_match_id text, venue text
);

create table live_matches (
  id text primary key,
  join_code text unique not null, format text not null,
  team_a jsonb not null, team_b jsonb not null, team_a_name text, team_b_name text, venue text,
  host_uid uuid references users(uid) not null, best_of int not null default 3,
  status text not null default 'active', current_game int not null default 0,
  games jsonb not null default '[]', game_wins jsonb not null default '{"a":0,"b":0}',
  winning_side text, created_at timestamptz not null default now(), completed_at timestamptz,
  clip_url text, record_mode text, live_stats jsonb, active_seconds_accumulated int
);

create table conversations (
  id text primary key default gen_random_uuid()::text,
  participant_ids uuid[] not null, last_message text, last_at timestamptz,
  created_at timestamptz not null default now()
);

create table conversation_messages (
  id text primary key default gen_random_uuid()::text,
  conversation_id text references conversations(id) on delete cascade not null,
  sender_id uuid references users(uid), text text not null, sent_at timestamptz not null default now()
);
create index on conversation_messages (conversation_id);

create table friends (
  user_id uuid references users(uid) on delete cascade not null,
  friend_id uuid references users(uid) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

create table planned_matches (
  id text primary key,
  host_uid uuid references users(uid) not null,
  format text, venue text, date timestamptz, status text not null default 'upcoming',
  live_match_id text references live_matches(id),
  data jsonb
);

create table tournament_registrations (
  id text primary key default gen_random_uuid()::text,
  tournament_id text references tournaments(id) on delete cascade not null,
  user_id uuid references users(uid) on delete cascade not null,
  created_at timestamptz not null default now()
);

create table endorsements (
  id text primary key default gen_random_uuid()::text,
  from_uid uuid references users(uid) not null, to_uid uuid references users(uid) not null,
  skill text not null, created_at timestamptz not null default now()
);

alter table matches enable row level security;
alter table tournaments enable row level security;
alter table challenges enable row level security;
alter table clubs enable row level security;
alter table club_messages enable row level security;
alter table notifications enable row level security;
alter table court_sessions enable row level security;
alter table live_matches enable row level security;
alter table conversations enable row level security;
alter table conversation_messages enable row level security;
alter table friends enable row level security;
alter table planned_matches enable row level security;
alter table tournament_registrations enable row level security;
alter table endorsements enable row level security;

create policy "public read" on matches for select using (true);
create policy "public read" on tournaments for select using (true);
create policy "public read" on clubs for select using (true);
create policy "public read" on club_messages for select using (true);
create policy "public read" on live_matches for select using (true);

create policy "notifications owner only" on notifications for all using (auth.uid() = user_id);
create policy "conversations participant only" on conversations for select using (auth.uid() = any(participant_ids));
create policy "conversation_messages participant only" on conversation_messages
  for select using (auth.uid() in (select unnest(participant_ids) from conversations where id = conversation_id));
create policy "friends owner only" on friends for all using (auth.uid() = user_id);

create policy "auth insert" on matches for insert with check (auth.uid() is not null);
create policy "participant update" on matches for update using (auth.uid() in (player1_id, player2_id, player1_partner_id, player2_partner_id));

create policy "auth insert" on tournaments for insert with check (auth.uid() is not null);
create policy "host update" on tournaments for update using (auth.uid() = host_uid);

create policy "auth insert" on clubs for insert with check (auth.uid() is not null);
create policy "member update" on clubs for update using (auth.uid() = admin_id or auth.uid() = any(moderator_ids));

create policy "member insert" on club_messages for insert with check (auth.uid() in (select unnest(member_ids) from clubs where id = club_id));

create policy "participant read" on challenges for select using (auth.uid() in (from_id, to_id));
create policy "auth insert" on challenges for insert with check (auth.uid() = from_id);
create policy "participant update" on challenges for update using (auth.uid() in (from_id, to_id));

create policy "read" on court_sessions for select using (true);
create policy "auth insert" on court_sessions for insert with check (auth.uid() = host_uid);
create policy "host update" on court_sessions for update using (auth.uid() = host_uid);

create policy "auth insert" on live_matches for insert with check (auth.uid() = host_uid);
create policy "auth update" on live_matches for update using (auth.uid() is not null);

create policy "auth insert" on conversations for insert with check (auth.uid() = any(participant_ids));
create policy "auth insert" on conversation_messages for insert with check (
  auth.uid() in (select unnest(participant_ids) from conversations where id = conversation_id));

create policy "read own" on planned_matches for select using (auth.uid() = host_uid);
create policy "auth insert" on planned_matches for insert with check (auth.uid() = host_uid);
create policy "host update" on planned_matches for update using (auth.uid() = host_uid);

create policy "read own" on tournament_registrations for select using (auth.uid() = user_id);
create policy "auth insert" on tournament_registrations for insert with check (auth.uid() = user_id);

create policy "read" on endorsements for select using (true);
create policy "auth insert" on endorsements for insert with check (auth.uid() = from_uid);
