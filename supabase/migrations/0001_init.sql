-- 家的時光:第一版資料表
-- 一套相簿系統:小孩的相簿全家看得到(family),夫妻的相簿只有管理員看得到(admins)。
-- 全部資料表開 RLS 但不開任何 policy:只有伺服器(service role)能碰,瀏覽器碰不到。

create extension if not exists pgcrypto;

-- 相簿:每個小孩一本、夫妻一本
create table if not exists albums (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  birthday date,                                   -- 小孩生日,拿來算「幾歲幾個月」;夫妻相簿留空
  visibility text not null default 'family' check (visibility in ('family', 'admins')),
  sort int not null default 0,
  timehut_baby_id bigint unique,                   -- 從時光小屋搬來的對照
  created_at timestamptz not null default now()
);

-- 成員:管理員(爸媽)或家人(阿公阿嬤…)
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'family' check (role in ('admin', 'family')),
  line_user_id text unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

-- 邀請連結:同一個連結同一個人可以在手機、平板各開一次(7 天內)
create table if not exists invites (
  token text primary key,
  name text not null,
  role text not null default 'family' check (role in ('admin', 'family')),
  member_id uuid references members(id) on delete set null,
  created_by uuid references members(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

-- 登入狀態:cookie 裡放原始 token,表裡只存 sha256
create table if not exists sessions (
  token_hash text primary key,
  member_id uuid not null references members(id) on delete cascade,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- 一則時光:某一天、某本相簿、一段話 + 幾張照片/影片
create table if not exists moments (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references albums(id) on delete cascade,
  taken_on date not null,
  caption text not null default '',
  author_id uuid references members(id) on delete set null,
  author_name text,                                -- 時光小屋搬來的:當時誰傳的
  source text not null default 'upload' check (source in ('upload', 'timehut')),
  source_id text unique,                           -- 時光小屋的 event id,避免重複搬
  created_at timestamptz not null default now()
);
create index if not exists moments_album_taken_idx on moments (album_id, taken_on desc, created_at desc);

-- 照片/影片本身:檔案放 Storage 的 media bucket
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references moments(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  storage_path text not null,
  thumb_path text,
  width int,
  height int,
  duration_sec numeric,
  bytes bigint,
  taken_at timestamptz,
  sort int not null default 0,
  source_id text unique,                           -- 時光小屋的 moment id
  created_at timestamptz not null default now()
);
create index if not exists media_moment_idx on media (moment_id, sort);

create table if not exists likes (
  moment_id uuid not null references moments(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id, member_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references moments(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  author_name text,                                -- 時光小屋搬來的留言
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_moment_idx on comments (moment_id, created_at);

-- 分享連結:把一則時光分享到 LINE,不用登入也看得到,30 天後失效
create table if not exists share_links (
  token text primary key,
  moment_id uuid not null references moments(id) on delete cascade,
  created_by uuid references members(id) on delete set null,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);

alter table albums enable row level security;
alter table members enable row level security;
alter table invites enable row level security;
alter table sessions enable row level security;
alter table moments enable row level security;
alter table media enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;
alter table share_links enable row level security;

-- 檔案桶:私人,只能用伺服器簽的網址看
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- 預設相簿:夫妻那本;小孩的相簿由搬家程式照時光小屋的寶寶建,或在設定頁自己加
insert into albums (slug, name, visibility, sort)
values ('us', '我們倆', 'admins', 9)
on conflict (slug) do nothing;

-- 第一組邀請:Eric 和老婆,都是管理員;開 /join/<token> 就進得去(7 天內)
insert into invites (token, name, role, expires_at)
values
  ('WCt9ipAkunrWBm0P', 'Eric', 'admin', now() + interval '7 days'),
  ('AbiLEUDCM2EDHEff', '老婆', 'admin', now() + interval '7 days')
on conflict (token) do nothing;
