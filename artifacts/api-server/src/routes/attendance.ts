import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db, attendanceTable, scheduleTable } from "@workspace/db";
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
  const [record] = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.date, today))
    .limit(1);

  if (!record) {
    res.json(GetTodayAttendanceResponse.parse({ record: null }));
    return;
  }

  res.json(
    GetTodayAttendanceResponse.parse({
      record: {
        id: record.id,
        date: record.date,
        choice: record.choice,
        hesitationSeconds: record.hesitationSeconds ?? null,
        createdAt: record.createdAt.toISOString(),
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
  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.date, today))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Attendance already recorded for today" });
    return;
  }

  const [record] = await db
    .insert(attendanceTable)
    .values({
      date: today,
      choice: parsed.data.choice,
      hesitationSeconds: parsed.data.hesitationSeconds ?? null,
    })
    .returning();

  res.status(201).json({
    id: record.id,
    date: record.date,
    choice: record.choice,
    hesitationSeconds: record.hesitationSeconds ?? null,
    createdAt: record.createdAt.toISOString(),
  });
});

router.get("/attendance/weekly", async (req, res): Promise<void> => {
  req.log.info("Fetching weekly attendance");
  const { start, end } = getWeekBounds();

  const records = await db
    .select()
    .from(attendanceTable)
    .where(and(gte(attendanceTable.date, start), lte(attendanceTable.date, end)));

  const recordMap = new Map(records.map((r) => [r.date, r]));

  const [schedule] = await db.select().from(scheduleTable).limit(1);
  const weeklyGoal = schedule?.weeklyGoal ?? 3;

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

  const attendCount = records.filter((r) => r.choice === "attend").length;
  const skipCount = records.filter((r) => r.choice === "skip").length;
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
  const allRecords = await db
    .select()
    .from(attendanceTable)
    .orderBy(desc(attendanceTable.date));

  const totalAttended = allRecords.filter((r) => r.choice === "attend").length;
  const totalRecorded = allRecords.length;

  const attendRecords = allRecords.filter((r) => r.choice === "attend");
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
