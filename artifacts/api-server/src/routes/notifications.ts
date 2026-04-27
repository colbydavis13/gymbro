import { Router, type IRouter } from "express";
import webpush from "web-push";
import { supabase } from "@workspace/db";
import { SubscribeNotificationsBody, SubscribeNotificationsResponse, GetVapidPublicKeyResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL = process.env.VAPID_EMAIL ?? "mailto:gymbro@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  logger.info("Web push VAPID details configured");
} else {
  logger.warn("VAPID keys not set — push notifications will not work");
}

router.get("/notifications/vapid-public-key", (req, res): void => {
  req.log.info("Returning VAPID public key");
  res.json(GetVapidPublicKeyResponse.parse({ publicKey: VAPID_PUBLIC_KEY }));
});

router.post("/notifications/subscribe", async (req, res): Promise<void> => {
  const parsed = SubscribeNotificationsBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid push subscription body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { endpoint, p256dh, auth } = parsed.data;

  const { data: existing } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    await supabase
      .from("push_subscriptions")
      .insert({ endpoint, p256dh, auth });
  } else {
    await supabase
      .from("push_subscriptions")
      .update({ p256dh, auth })
      .eq("endpoint", endpoint);
  }

  req.log.info("Push subscription stored");
  res.json(SubscribeNotificationsResponse.parse({ success: true }));
});

const RETRY_DELAY_MS = 2_000;
const RETRY_ATTEMPTS = 1;

function getStatusCode(err: unknown): number | undefined {
  if (err && typeof err === "object" && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return undefined;
}

function isTransient(statusCode: number | undefined): boolean {
  if (statusCode === undefined) return true;
  if (statusCode === 429) return true;
  if (statusCode >= 500 && statusCode <= 599) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function trySendNotification(
  sub: { endpoint: string; p256dh: string; auth: string },
  payloadStr: string,
): Promise<void> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payloadStr,
      );
      return;
    } catch (err: unknown) {
      lastErr = err;
      const statusCode = getStatusCode(err);

      if (!isTransient(statusCode)) {
        throw err;
      }

      if (attempt < RETRY_ATTEMPTS) {
        logger.warn(
          { endpoint: sub.endpoint, statusCode, attempt: attempt + 1 },
          "Transient push notification error — retrying",
        );
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastErr;
}

export interface PushResult {
  sent: number;
  failed: number;
}

export async function sendPushNotificationToAll(payload: {
  title: string;
  body: string;
}): Promise<PushResult> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.warn("VAPID keys not configured, skipping push notifications");
    return { sent: 0, failed: 0 };
  }

  const { data: subscriptions, error: subsError } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (subsError) {
    logger.error({ error: subsError }, "Failed to fetch push subscriptions from database");
    throw new Error(`Database error fetching push subscriptions: ${subsError.message}`);
  }

  const subs = subscriptions ?? [];
  logger.info({ count: subs.length }, "Sending push notifications");

  const payloadStr = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await trySendNotification(sub, payloadStr);
      sent++;
    } catch (err: unknown) {
      const statusCode = getStatusCode(err);

      if (statusCode === 410) {
        logger.info(
          { endpoint: sub.endpoint, statusCode },
          "Removing expired push subscription",
        );
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
      } else {
        failed++;
        logger.error(
          { endpoint: sub.endpoint, statusCode, err },
          "Failed to send push notification after retries",
        );
      }
    }
  }

  return { sent, failed };
}

export default router;
