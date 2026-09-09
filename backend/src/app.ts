import express, { type Express } from "express";
import cors from "cors";
import { healthRouter } from "./routes/health";
import { cosignRouter } from "./routes/cosign";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Mount routes
  app.use(healthRouter);
  app.use(cosignRouter);

  return app;
}

export const app = createApp();
