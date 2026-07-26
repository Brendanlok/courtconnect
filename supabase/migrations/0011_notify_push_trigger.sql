-- Run manually by Lok in the Supabase SQL editor — replace the placeholder
-- below with the real service_role key (Settings -> API) before running.
-- Never commit the filled-in key to this file.
--
-- The dashboard's "Create a new database trigger" flow only lists plain
-- Postgres functions in its function picker (no separate Webhooks UI surfaced
-- on this project), so this function IS the webhook: it calls the deployed
-- send-push Edge Function directly via pg_net whenever a notifications row
-- is inserted. Once this runs, it shows up in that same function picker —
-- select it as the trigger's "Function to trigger".
create or replace function notify_push_fn() returns trigger as $$
begin
  perform net.http_post(
    url := 'https://lzwalydwpruhldydgjjc.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REPLACE_WITH_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  );
  return new;
end;
$$ language plpgsql security definer;
