import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scheduleRouter from "./schedule";
import attendanceRouter from "./attendance";
import notificationsRouter from "./notifications";
import schedulerRunsRouter from "./schedulerRuns";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scheduleRouter);
router.use(attendanceRouter);
router.use(notificationsRouter);
router.use(schedulerRunsRouter);

export default router;
