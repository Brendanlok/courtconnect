-- Product idea (logged + built same session): auto-share a tournament's
-- bracket into the host club's chat once it's generated. Turned up a real
-- gap while scoping it — "Host As <club>" (tournaments/page.tsx) only ever
-- stored the club's *name* on `organiser` (a display string), never a real
-- reference, so there was no reliable way to know which club chat to post
-- to (name matching is fragile: renames, duplicates, no FK). Closing that
-- gap properly instead of building the chat-share feature on a shaky lookup.

alter table tournaments add column host_club_id text references clubs(id);
