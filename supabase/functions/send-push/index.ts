// Deploy: supabase functions deploy send-push
// Then wire a Database Webhook (Dashboard → Database → Webhooks) on
// `notifications` INSERT → HTTP POST to this function's URL, and set these
// function secrets first: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
//
// Receives the Supabase webhook payload for a newly-inserted notifications
// row, looks up every push_subscriptions row for that user, and sends a real
// Web Push message to each (reaches the user even with the app fully closed).
// Uses the service-role key so it reads across all users, bypassing the
// owner-only RLS policy on push_subscriptions by design.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

webpush.setVapidDetails(
  'mailto:chanlokk97@gmail.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

Deno.serve(async req => {
  const payload = await req.json();
  const row = payload.record as { user_id: string; title: string; body: string; link_to?: string } | undefined;
  if (!row) return new Response('no record', { status: 400 });

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', row.user_id);

  await Promise.all((subs ?? []).map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: row.title, body: row.body, linkTo: row.link_to }),
      );
    } catch (err) {
      // 410/404 = subscription is dead (user revoked permission, uninstalled, etc.) — clean it up
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      }
    }
  }));

  return new Response('ok');
});
