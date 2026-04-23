import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scheduleRouter from "./schedule";
import attendanceRouter from "./attendance";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scheduleRouter);
router.use(attendanceRouter);
router.use(notificationsRouter);

export default router;
