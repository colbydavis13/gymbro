import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
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

  const existing = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(pushSubscriptionsTable).values({ endpoint, p256dh, auth });
  } else {
    await db
      .update(pushSubscriptionsTable)
      .set({ p256dh, auth })
      .where(eq(pushSubscriptionsTable.endpoint, endpoint));
  }

  req.log.info("Push subscription stored");
  res.json(SubscribeNotificationsResponse.parse({ success: true }));
});

export async function sendPushNotificationToAll(payload: {
  title: string;
  body: string;
}): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.warn("VAPID keys not configured, skipping push notifications");
    return;
  }

  const subscriptions = await db.select().from(pushSubscriptionsTable);
  logger.info({ count: subscriptions.length }, "Sending push notifications");

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "statusCode" in err &&
        (err as { statusCode: number }).statusCode === 410
      ) {
        logger.info({ endpoint: sub.endpoint }, "Removing expired push subscription");
        await db
          .delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
      } else {
        logger.error({ err }, "Failed to send push notification");
      }
    }
  }
}

export default router;
