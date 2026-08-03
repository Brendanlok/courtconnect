-- Club Pro Phase 1: a manually-granted flag (no billing yet) that unlocks a
-- higher member cap and an Analytics tab for the club owner. Lok grants it by
-- hand per club (`update clubs set is_pro = true where id = '...'`) until a
-- real subscription flow exists.
alter table clubs add column if not exists is_pro boolean not null default false;
