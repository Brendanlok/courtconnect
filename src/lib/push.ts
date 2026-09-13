// Real Web Push subscription — lets a notification reach the user even when
// the app/tab is fully closed, unlike the existing showNotification() call in
// AppContext's addNotification (that one only fires while the tab is still
// open in the background). Sending the actual push message happens server-side
// (supabase/functions/send-push), triggered by a DB webhook on notifications
// insert — this file only manages the subscription record.
import { supabase } from '@/lib/supabase';

// The public half of a VAPID keypair is not sensitive (it's sent to browsers
// on every subscribe call) — safe to commit directly, unlike the private half
// which only ever lives as a Supabase Edge Function secret (never in git).
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  || 'BBWzyYmp3NvPZfr3nodMRvLFXwkClLRuqaktY2lM3a_LcIFpefYHt1J4xWapVjjlAVfLjjJmIA61gx_yTOokwGw';

// Web Push wants the VAPID key as a raw Uint8Array, browsers only give you base64url.
function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      });
    }
    const json = sub.toJSON();
    // Degrades to a silent no-op if push_subscriptions doesn't exist yet
    // (0010_push_subscriptions.sql not applied) — same pattern as every
    // other not-yet-applied migration in this app.
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }, { onConflict: 'endpoint' });
    return !error;
  } catch {
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  } catch { /* ignore */ }
}
