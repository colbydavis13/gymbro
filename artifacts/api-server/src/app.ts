import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
let corsOptions: Parameters<typeof cors>[0];
if (process.env.NODE_ENV === "production") {
  if (process.env.ALLOWED_ORIGIN) {
    corsOptions = { origin: process.env.ALLOWED_ORIGIN };
  } else {
    logger.warn(
      "ALLOWED_ORIGIN is not set in production — cross-origin requests will be denied",
    );
    corsOptions = { origin: false };
  }
} else {
  corsOptions = {};
}
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
