create extension if not exists "pgcrypto";

create type position_code as enum (
  'GK',
  'LB',
  'CB',
  'RB',
  'LWB',
  'RWB',
  'CDM',
  'CM',
  'CAM',
  'LM',
  'RM',
  'LW',
  'RW',
  'CF',
  'ST',
  'DEF',
  'MID',
  'FWD'
);
create type group_role as enum ('OWNER', 'ADMIN', 'PLAYER');
create type invitation_status as enum ('PENDING', 'ACCEPTED', 'DECLINED');
create type match_status as enum ('SCHEDULED', 'AUCTION', 'LIVE', 'ENDED');
create type availability_status as enum ('PLAYING', 'NOT_PLAYING', 'MAYBE');
create type auction_status as enum ('DRAFT', 'LIVE', 'ENDED');
create type match_event_type as enum ('GOAL', 'UNDO', 'MOTM');

create table users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null,
  phone text unique,
  profile_image text,
  preferred_position position_code not null,
  secondary_position position_code,
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo text,
  description text,
  created_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role group_role not null default 'PLAYER',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  invited_user_id uuid not null references users(id) on delete cascade,
  invited_by uuid not null references users(id) on delete cascade,
  status invitation_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (group_id, invited_user_id, status)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  scheduled_date date not null,
  auction_time time,
  match_time time not null,
  location text not null,
  maximum_players integer not null default 12 check (maximum_players > 1),
  notes text,
  status match_status not null default 'SCHEDULED',
  created_at timestamptz not null default now()
);

create table match_availability (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status availability_status not null,
  created_at timestamptz not null default now(),
  unique (match_id, user_id)
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  name text not null,
  formation text not null default '4-3-3',
  captain_id uuid references users(id) on delete set null
);

create table team_players (
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references users(id) on delete cascade,
  auction_price integer not null default 0 check (auction_price >= 0),
  primary key (team_id, player_id)
);

create table auctions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references matches(id) on delete cascade,
  status auction_status not null default 'DRAFT',
  starting_purse integer not null default 1000 check (starting_purse > 0),
  created_at timestamptz not null default now()
);

create table auction_bids (
  id uuid primary key default gen_random_uuid(),
  auction_id uuid not null references auctions(id) on delete cascade,
  player_id uuid not null references users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  event_type match_event_type not null,
  team_id uuid references teams(id) on delete set null,
  player_id uuid references users(id) on delete set null,
  assist_player_id uuid references users(id) on delete set null,
  minute integer check (minute >= 0),
  created_at timestamptz not null default now(),
  check (assist_player_id is null or assist_player_id <> player_id)
);

create table player_ratings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  rater_id uuid not null references users(id) on delete cascade,
  rated_player_id uuid not null references users(id) on delete cascade,
  rating numeric(3,1) not null check (rating >= 1 and rating <= 10),
  created_at timestamptz not null default now(),
  unique (match_id, rater_id, rated_player_id),
  check (rater_id <> rated_player_id)
);

create index users_clerk_user_id_idx on users (clerk_user_id);
create index users_username_idx on users (username);
create index users_phone_idx on users (phone);
create index group_members_user_id_idx on group_members (user_id);
create index group_invitations_invited_user_id_idx on group_invitations (invited_user_id, status);
create index matches_group_date_idx on matches (group_id, scheduled_date);
create index match_availability_match_status_idx on match_availability (match_id, status);
create index match_events_match_created_idx on match_events (match_id, created_at);
create index player_ratings_rated_player_idx on player_ratings (rated_player_id);

create or replace view player_stat_summary as
with match_participants as (
  select
    tp.player_id as user_id,
    m.group_id,
    m.id as match_id
  from team_players tp
  join teams t on t.id = tp.team_id
  join matches m on m.id = t.match_id
  where m.status = 'ENDED'
),
goals as (
  select match_id, player_id as user_id, count(*)::int as goals
  from match_events
  where event_type = 'GOAL' and player_id is not null
  group by match_id, player_id
),
assists as (
  select match_id, assist_player_id as user_id, count(*)::int as assists
  from match_events
  where event_type = 'GOAL' and assist_player_id is not null
  group by match_id, assist_player_id
),
ratings as (
  select match_id, rated_player_id as user_id, avg(rating)::numeric(3,1) as average_rating
  from player_ratings
  group by match_id, rated_player_id
)
select
  mp.user_id,
  mp.group_id,
  count(distinct mp.match_id)::int as matches,
  coalesce(sum(g.goals), 0)::int as goals,
  coalesce(sum(a.assists), 0)::int as assists,
  0::int as wins,
  0::int as motm,
  coalesce(avg(r.average_rating), 0)::numeric(3,1) as average_rating
from match_participants mp
left join goals g on g.match_id = mp.match_id and g.user_id = mp.user_id
left join assists a on a.match_id = mp.match_id and a.user_id = mp.user_id
left join ratings r on r.match_id = mp.match_id and r.user_id = mp.user_id
group by mp.user_id, mp.group_id;

alter table users enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table group_invitations enable row level security;
alter table matches enable row level security;
alter table match_availability enable row level security;
alter table teams enable row level security;
alter table team_players enable row level security;
alter table auctions enable row level security;
alter table auction_bids enable row level security;
alter table match_events enable row level security;
alter table player_ratings enable row level security;

alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table match_events;
alter publication supabase_realtime add table match_availability;
