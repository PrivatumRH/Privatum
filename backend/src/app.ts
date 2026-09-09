import express, { type Express } from "express";
import cors from "cors";
import { healthRouter } from "./routes/health";
import { walletsRouter } from "./routes/wallets";
import { cosignRouter } from "./routes/cosign";
import { recoveryRouter } from "./routes/recovery";
import { bundlerRouter } from "./routes/bundler";

export function createApp(): Express {
  const app = express();

  const rawCors = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (rawCors && rawCors !== "None" && rawCors !== "*") {
    const origins = rawCors.split(",").map((o) => o.trim());
    app.use(cors({ origin: origins }));
  } else {
    // Default open CORS for development & desktop WebView
    app.use(cors());
  }

  app.use(express.json());

  // Mount routes
  app.use(healthRouter);
  app.use(walletsRouter);
  app.use(cosignRouter);
  app.use(recoveryRouter);
  app.use(bundlerRouter);

  return app;
}

export const app = createApp();
