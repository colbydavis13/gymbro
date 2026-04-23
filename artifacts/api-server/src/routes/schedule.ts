import { Router, type IRouter } from "express";
import { supabase } from "@workspace/db";
import { UpdateScheduleBody, GetScheduleResponse, UpdateScheduleResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/schedule", async (req, res): Promise<void> => {
  req.log.info("Fetching schedule");

  const { data, error } = await supabase
    .from("schedule")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    req.log.error({ error }, "Failed to fetch schedule");
    res.status(500).json({ error: "Failed to fetch schedule" });
    return;
  }

  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from("schedule")
      .insert({ daily_time: "09:00", weekly_goal: 3, target_email: null })
      .select()
      .single();

    if (insertError || !created) {
      req.log.error({ insertError }, "Failed to create default schedule");
      res.status(500).json({ error: "Failed to create schedule" });
      return;
    }

    res.json(
      GetScheduleResponse.parse({
        id: created.id,
        dailyTime: created.daily_time,
        targetEmail: created.target_email ?? null,
        weeklyGoal: created.weekly_goal,
        updatedAt: created.updated_at,
      }),
    );
    return;
  }

  res.json(
    GetScheduleResponse.parse({
      id: data.id,
      dailyTime: data.daily_time,
      targetEmail: data.target_email ?? null,
      weeklyGoal: data.weekly_goal,
      updatedAt: data.updated_at,
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

  const { data: existing } = await supabase
    .from("schedule")
    .select("id")
    .limit(1)
    .maybeSingle();

  const payload = {
    daily_time: parsed.data.dailyTime,
    weekly_goal: parsed.data.weeklyGoal,
    target_email: parsed.data.targetEmail ?? null,
    updated_at: new Date().toISOString(),
  };

  let record;
  if (!existing) {
    const { data: created, error } = await supabase
      .from("schedule")
      .insert(payload)
      .select()
      .single();
    if (error || !created) {
      res.status(500).json({ error: "Failed to create schedule" });
      return;
    }
    record = created;
  } else {
    const { data: updated, error } = await supabase
      .from("schedule")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error || !updated) {
      res.status(500).json({ error: "Failed to update schedule" });
      return;
    }
    record = updated;
  }

  res.json(
    UpdateScheduleResponse.parse({
      id: record.id,
      dailyTime: record.daily_time,
      targetEmail: record.target_email ?? null,
      weeklyGoal: record.weekly_goal,
      updatedAt: record.updated_at,
    }),
  );
});

export default router;
