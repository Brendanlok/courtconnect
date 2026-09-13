-- APPLIED 2026-07-27 by Lok in the Supabase SQL editor.
-- Creates the `avatars` and `clips` Storage buckets that SettingsModal.tsx and
-- ClipRecorder.tsx already upload to (supabase.storage.from('avatars'/'clips')).
-- These were previously documented as "create manually in the dashboard" (see
-- DEVLOG.md) with no migration behind them — this makes bucket creation
-- repeatable/reviewable like every other schema change, one paste instead of
-- manual dashboard clicks. If the buckets already exist (created manually
-- earlier), this is a no-op — every statement is idempotent.

-- avatars: public bucket, profile photos, path is `${uid}/${filename}`.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar owner can upload" on storage.objects;
create policy "Avatar owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatar owner can update" on storage.objects;
create policy "Avatar owner can update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatar public read" on storage.objects;
create policy "Avatar public read" on storage.objects
  for select
  using (bucket_id = 'avatars');

-- clips: private bucket, match recordings, path is `${matchId}/recording.ext`,
-- read via signed URL (not getPublicUrl) so no public read policy here.
-- Not scoped to uid — either player in a match can upload/view its clip.
insert into storage.buckets (id, name, public)
values ('clips', 'clips', false)
on conflict (id) do nothing;

drop policy if exists "Clips authenticated upload" on storage.objects;
create policy "Clips authenticated upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'clips');

drop policy if exists "Clips authenticated read" on storage.objects;
create policy "Clips authenticated read" on storage.objects
  for select to authenticated
  using (bucket_id = 'clips');
