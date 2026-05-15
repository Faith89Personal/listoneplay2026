import webpush from "web-push";
import { requireSql } from "@/lib/db";

let configured = false;

function configure() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.warn("[push] VAPID env vars not configured");
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

type StoredSubscription = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendPushToUser(
  email: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!configure()) return { sent: 0, removed: 0 };
  let sql;
  try {
    sql = requireSql();
  } catch {
    return { sent: 0, removed: 0 };
  }
  const subs = (await sql`
    SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE email = ${email}
  `) as StoredSubscription[];

  if (subs.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const toDelete: number[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          toDelete.push(s.id);
        } else {
          console.warn("[push] send failed", status, (err as Error)?.message);
        }
      }
    }),
  );

  if (toDelete.length > 0) {
    await sql`DELETE FROM push_subscriptions WHERE id = ANY(${toDelete})`;
  }
  return { sent, removed: toDelete.length };
}
