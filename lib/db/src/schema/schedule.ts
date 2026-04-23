import { pgTable, text, integer, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scheduleTable = pgTable("schedule", {
  id: serial("id").primaryKey(),
  dailyTime: text("daily_time").notNull().default("09:00"),
  targetEmail: text("target_email"),
  weeklyGoal: integer("weekly_goal").notNull().default(3),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertScheduleSchema = createInsertSchema(scheduleTable).omit({ id: true, updatedAt: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof scheduleTable.$inferSelect;
