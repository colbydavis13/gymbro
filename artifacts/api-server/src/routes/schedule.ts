import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, scheduleTable } from "@workspace/db";
import { UpdateScheduleBody, GetScheduleResponse, UpdateScheduleResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/schedule", async (req, res): Promise<void> => {
  req.log.info("Fetching schedule");
  let [schedule] = await db.select().from(scheduleTable).limit(1);
  if (!schedule) {
    const [created] = await db
      .insert(scheduleTable)
      .values({ dailyTime: "09:00", weeklyGoal: 3, targetEmail: null })
      .returning();
    schedule = created;
  }
  res.json(
    GetScheduleResponse.parse({
      id: schedule.id,
      dailyTime: schedule.dailyTime,
      targetEmail: schedule.targetEmail ?? null,
      weeklyGoal: schedule.weeklyGoal,
      updatedAt: schedule.updatedAt.toISOString(),
    }),
  );
});

router.put("/schedule", async (req, res): Promise<void> => {
  const parsed = UpdateScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid schedule update body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let [existing] = await db.select().from(scheduleTable).limit(1);

  if (!existing) {
    const [created] = await db
      .insert(scheduleTable)
      .values({
        dailyTime: parsed.data.dailyTime,
        weeklyGoal: parsed.data.weeklyGoal,
        targetEmail: parsed.data.targetEmail ?? null,
      })
      .returning();
    existing = created;
  } else {
    const [updated] = await db
      .update(scheduleTable)
      .set({
        dailyTime: parsed.data.dailyTime,
        weeklyGoal: parsed.data.weeklyGoal,
        targetEmail: parsed.data.targetEmail ?? null,
      })
      .where(eq(scheduleTable.id, existing.id))
      .returning();
    existing = updated;
  }

  res.json(
    UpdateScheduleResponse.parse({
      id: existing.id,
      dailyTime: existing.dailyTime,
      targetEmail: existing.targetEmail ?? null,
      weeklyGoal: existing.weeklyGoal,
      updatedAt: existing.updatedAt.toISOString(),
    }),
  );
});

export default router;
