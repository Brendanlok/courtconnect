-- APPLIED 2026-07-27 by Lok in the Supabase SQL editor.
-- Backs the new full bracket system: host starts a tournament (generates the
-- bracket from participants), reports each live match's result, and once the
-- final match resolves these two columns record who actually won — nothing
-- tracked this before, so the "tournament win" badge and champion banner had
-- no real data to key on.
alter table tournaments add column if not exists champion_username text;
alter table tournaments add column if not exists champion_display_name text;
