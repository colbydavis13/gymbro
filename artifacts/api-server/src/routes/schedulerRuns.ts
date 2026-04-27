import { Router, type IRouter } from "express";
import { supabase } from "@workspace/db";

const router: IRouter = Router();

router.get("/scheduler-runs", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const { data, error } = await supabase
    .from("scheduler_runs")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(limit);

  if (error) {
    req.log.error({ error }, "Failed to fetch scheduler runs");
    res.status(500).json({ error: "Failed to fetch scheduler runs" });
    return;
  }

  const runs = data ?? [];
  const latest = runs[0] ?? null;

  res.json({
    status: latest
      ? latest.push_status === "failed" || latest.email_status === "failed"
        ? "failed"
        : "ok"
      : "no_runs",
    latest,
    runs,
  });
});

export default router;
