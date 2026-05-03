import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware.js";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./db/migrate.js";

const app = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/healthz", (_req, res) => res.json({ status: "ok" }));

const clerkPK = process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkSK = process.env.CLERK_SECRET_KEY;
if (clerkSK) {
  app.use(clerkMiddleware({ publishableKey: clerkPK, secretKey: clerkSK }));
} else {
  app.use(clerkMiddleware());
}

app.use("/api", router);

runMigrations().catch((err) => logger.error({ err }, "Startup migration failed"));

export default app;
