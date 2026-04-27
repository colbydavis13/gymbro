import cron from "node-cron";
import { Resend } from "resend";
import { supabase } from "@workspace/db";
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

  const appUrl = process.env.GYM_BRO_URL || "https://gym-bro.replit.app";

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
    <a href="${appUrl}"
       style="display: block; background: #7BC47F; color: #fff; font-weight: 700; font-size: 16px; text-align: center; padding: 14px 0; border-radius: 999px; text-decoration: none; margin-bottom: 16px;">
      Open Gym Bro and record your decision
    </a>
    <p style="color: #9CA3AF; font-size: 12px; margin: 24px 0 0;">You're receiving this because you set up a daily reminder in Gym Bro.</p>
  </div>
</body>
</html>
  `.trim();
}

type RunStatus = "success" | "failed" | "skipped";

interface RunRecord {
  push_status: RunStatus;
  push_error: string | null;
  push_sent: number;
  push_failed: number;
  email_status: RunStatus;
  email_error: string | null;
}

async function recordRun(record: RunRecord): Promise<void> {
  const { error } = await supabase.from("scheduler_runs").insert(record);
  if (error) {
    logger.error({ error }, "Failed to write scheduler run record");
  }
}

export async function startScheduler(): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

  if (!resend) {
    logger.warn("RESEND_API_KEY not set — daily emails will not be sent");
  }

  async function checkAndSendReminders(): Promise<void> {
    try {
      const { data: schedule, error: scheduleErr } = await supabase
        .from("schedule")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (scheduleErr) {
        throw new Error(`Database error fetching schedule: ${scheduleErr.message}`);
      }

      if (!schedule) return;

      const now = new Date();
      const [scheduledHour, scheduledMin] = schedule.daily_time.split(":").map(Number);
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      if (currentHour !== scheduledHour || currentMin !== scheduledMin) return;

      logger.info({ dailyTime: schedule.daily_time }, "Sending daily gym reminders");

      const run: RunRecord = {
        push_status: "skipped",
        push_error: null,
        push_sent: 0,
        push_failed: 0,
        email_status: "skipped",
        email_error: null,
      };

      try {
        const pushResult = await sendPushNotificationToAll({
          title: "Gym Bro",
          body: "Time to decide — will you go to the gym today?",
        });
        run.push_status = "success";
        run.push_sent = pushResult.sent;
        run.push_failed = pushResult.failed;
        if (pushResult.failed > 0) {
          run.push_status = pushResult.sent > 0 ? "success" : "failed";
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err }, "Push notification run failed");
        run.push_status = "failed";
        run.push_error = message;
      }

      if (resend && schedule.target_email) {
        try {
          const { error } = await resend.emails.send({
            from: "Gym Bro <noreply@resend.dev>",
            to: [schedule.target_email],
            subject: "Your daily gym reminder",
            html: buildEmailHtml(schedule.daily_time),
          });
          if (error) {
            logger.error({ error }, "Failed to send daily email");
            run.email_status = "failed";
            run.email_error = typeof error === "object" && error !== null && "message" in error
              ? String((error as { message: unknown }).message)
              : JSON.stringify(error);
          } else {
            logger.info({ to: schedule.target_email }, "Daily reminder email sent");
            run.email_status = "success";
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error({ err }, "Email send threw unexpectedly");
          run.email_status = "failed";
          run.email_error = message;
        }
      }

      await recordRun(run);

      const overallOk = run.push_status !== "failed" && run.email_status !== "failed";
      if (overallOk) {
        logger.info({ run }, "Daily reminder run completed successfully");
      } else {
        logger.error({ run }, "Daily reminder run finished with failures");
      }
    } catch (err) {
      logger.error({ err }, "Error in reminder scheduler");
      await recordRun({
        push_status: "failed",
        push_error: err instanceof Error ? err.message : String(err),
        push_sent: 0,
        push_failed: 0,
        email_status: "failed",
        email_error: "Scheduler crashed before email step",
      }).catch(() => {});
    }
  }

  if (scheduledTask) {
    scheduledTask.stop();
  }

  scheduledTask = cron.schedule("* * * * *", checkAndSendReminders);
  logger.info("Reminder scheduler started (checks every minute)");
}
