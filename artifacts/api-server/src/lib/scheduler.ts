import cron from "node-cron";
import { Resend } from "resend";
import { db, scheduleTable } from "@workspace/db";
import { logger } from "./logger";
import { sendPushNotificationToAll } from "../routes/notifications";

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

function buildEmailHtml(dailyTime: string): string {
  const timeDisplay = (() => {
    const [h, m] = dailyTime.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
  })();

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Gym Bro Daily Prompt</title></head>
<body style="font-family: 'Nunito', Arial, sans-serif; background: #FAF7F2; margin: 0; padding: 20px;">
  <div style="max-width: 400px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h1 style="color: #2D2D2D; font-size: 24px; margin: 0 0 8px;">Gym Bro</h1>
    <p style="color: #6B7280; font-size: 14px; margin: 0 0 24px;">Your daily gym reminder</p>
    <div style="background: #E8F5E9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h2 style="color: #2D2D2D; font-size: 18px; margin: 0 0 8px;">Time to decide</h2>
      <p style="color: #4B5563; margin: 0;">Your gym time is scheduled for <strong>${timeDisplay}</strong>.</p>
      <p style="color: #4B5563; margin: 8px 0 0;">Will you go to the gym today?</p>
    </div>
    <p style="color: #7BC47F; font-weight: 600; margin: 0 0 8px;">Open Gym Bro to record your decision.</p>
    <p style="color: #9CA3AF; font-size: 12px; margin: 24px 0 0;">You're receiving this because you set up a daily reminder in Gym Bro.</p>
  </div>
</body>
</html>
  `.trim();
}

export async function startScheduler(): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

  if (!resend) {
    logger.warn("RESEND_API_KEY not set — daily emails will not be sent");
  }

  async function checkAndSendReminders(): Promise<void> {
    try {
      const [schedule] = await db.select().from(scheduleTable).limit(1);
      if (!schedule) return;

      const now = new Date();
      const [scheduledHour, scheduledMin] = schedule.dailyTime.split(":").map(Number);
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      if (currentHour !== scheduledHour || currentMin !== scheduledMin) return;

      logger.info({ dailyTime: schedule.dailyTime }, "Sending daily gym reminders");

      await sendPushNotificationToAll({
        title: "Gym Bro",
        body: "Time to decide — will you go to the gym today?",
      });

      if (resend && schedule.targetEmail) {
        const { error } = await resend.emails.send({
          from: "Gym Bro <noreply@resend.dev>",
          to: [schedule.targetEmail],
          subject: "Your daily gym reminder",
          html: buildEmailHtml(schedule.dailyTime),
        });
        if (error) {
          logger.error({ error }, "Failed to send daily email");
        } else {
          logger.info({ to: schedule.targetEmail }, "Daily reminder email sent");
        }
      }
    } catch (err) {
      logger.error({ err }, "Error in reminder scheduler");
    }
  }

  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule("* * * * *", checkAndSendReminders);
  logger.info("Reminder scheduler started (checks every minute)");
}
