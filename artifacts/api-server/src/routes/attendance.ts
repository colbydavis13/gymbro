import { Router, type IRouter } from "express";
import { supabase } from "@workspace/db";
import {
  RecordAttendanceBody,
  GetTodayAttendanceResponse,
  GetWeeklyAttendanceResponse,
  GetAttendanceStreakResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getWeekBounds(): { start: string; end: string } {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return {
    start: startOfWeek.toISOString().split("T")[0],
    end: endOfWeek.toISOString().split("T")[0],
  };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

router.get("/attendance/today", async (req, res): Promise<void> => {
  req.log.info("Fetching today's attendance");
  const today = getTodayDate();

  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("date", today)
    .limit(1)
    .maybeSingle();

  if (error) {
    req.log.error({ error }, "Failed to fetch today's attendance");
    res.status(500).json({ error: "Failed to fetch attendance" });
    return;
  }

  if (!data) {
    res.json(GetTodayAttendanceResponse.parse({ record: null }));
    return;
  }

  res.json(
    GetTodayAttendanceResponse.parse({
      record: {
        id: data.id,
        date: data.date,
        choice: data.choice,
        hesitationSeconds: data.hesitation_seconds ?? null,
        createdAt: data.created_at,
      },
    }),
  );
});

router.post("/attendance", async (req, res): Promise<void> => {
  const parsed = RecordAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid attendance body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const today = getTodayDate();

  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("date", today)
    .limit(1)
    .maybeSingle();

  if (existing) {
    res.status(409).json({ error: "Attendance already recorded for today" });
    return;
  }

  const { data: record, error } = await supabase
    .from("attendance")
    .insert({
      date: today,
      choice: parsed.data.choice,
      hesitation_seconds: parsed.data.hesitationSeconds ?? null,
    })
    .select()
    .single();

  if (error || !record) {
    req.log.error({ error }, "Failed to record attendance");
    res.status(500).json({ error: "Failed to record attendance" });
    return;
  }

  res.status(201).json({
    id: record.id,
    date: record.date,
    choice: record.choice,
    hesitationSeconds: record.hesitation_seconds ?? null,
    createdAt: record.created_at,
  });
});

router.get("/attendance/weekly", async (req, res): Promise<void> => {
  req.log.info("Fetching weekly attendance");
  const { start, end } = getWeekBounds();

  const { data: records, error } = await supabase
    .from("attendance")
    .select("*")
    .gte("date", start)
    .lte("date", end);

  if (error) {
    req.log.error({ error }, "Failed to fetch weekly attendance");
    res.status(500).json({ error: "Failed to fetch attendance" });
    return;
  }

  const safeRecords = records ?? [];
  const recordMap = new Map(safeRecords.map((r) => [r.date, r]));

  const { data: scheduleData } = await supabase
    .from("schedule")
    .select("weekly_goal")
    .limit(1)
    .maybeSingle();

  const weeklyGoal = scheduleData?.weekly_goal ?? 3;

  const days = [];
  const startDate = new Date(start + "T00:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const rec = recordMap.get(dateStr);
    days.push({
      date: dateStr,
      dayName: DAY_NAMES[d.getDay()],
      choice: rec?.choice ?? null,
    });
  }

  const attendCount = safeRecords.filter((r) => r.choice === "attend").length;
  const skipCount = safeRecords.filter((r) => r.choice === "skip").length;
  const onTrack = attendCount >= weeklyGoal;

  res.json(
    GetWeeklyAttendanceResponse.parse({
      days,
      attendCount,
      skipCount,
      weeklyGoal,
      onTrack,
    }),
  );
});

router.get("/attendance/streak", async (req, res): Promise<void> => {
  req.log.info("Fetching attendance streak");

  const { data: allRecords, error } = await supabase
    .from("attendance")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    req.log.error({ error }, "Failed to fetch streak data");
    res.status(500).json({ error: "Failed to fetch streak" });
    return;
  }

  const safeRecords = allRecords ?? [];
  const totalAttended = safeRecords.filter((r) => r.choice === "attend").length;
  const totalRecorded = safeRecords.length;

  const attendRecords = safeRecords.filter((r) => r.choice === "attend");
  const lastAttended = attendRecords.length > 0 ? attendRecords[0].date : null;

  let currentStreak = 0;
  if (attendRecords.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < attendRecords.length; i++) {
      const recDate = new Date(attendRecords[i].date + "T00:00:00");
      const diffDays = Math.round((today.getTime() - recDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === i) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  res.json(
    GetAttendanceStreakResponse.parse({
      currentStreak,
      totalAttended,
      totalRecorded,
      lastAttended,
    }),
  );
});

export default router;
