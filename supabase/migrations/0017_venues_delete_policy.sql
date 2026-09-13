-- NOT YET APPLIED — Lok needs to run this in the Supabase SQL editor.
--
-- 0008_venues.sql deliberately shipped without a delete policy (comment: "this
-- is a shared, permanent resource, not a personal post, so unlike availability
-- there's no 'own delete' policy"). In practice that means a bad/duplicate/test
-- entry can only ever be removed by a manual SQL delete, as just happened
-- (see DEVLOG 2026-08-03). Lok asked for a delete policy so that stops being
-- manual work going forward.
--
-- Scoped to the same "own delete" shape as availability (0007): only the
-- venue's own adder can remove it, using the added_by column that already
-- exists for this purpose. Not opened up to any signed-in user — that would
-- let anyone delete anyone else's venue.

create policy "own delete" on venues for delete using (auth.uid() = added_by);
