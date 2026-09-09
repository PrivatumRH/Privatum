import { Router, type Request, type Response } from "express";
import { query } from "../db/index";

export const healthRouter = Router();

healthRouter.get("/health", async (_req: Request, res: Response) => {
  let dbStatus = "up";
  try {
    await query("SELECT 1");
  } catch {
    dbStatus = "down";
  }

  res.status(dbStatus === "up" ? 200 : 503).json({
    status: dbStatus === "up" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    service: "privatum-cosigner-backend",
    network: "Robinhood Chain",
    chainId: 4663,
    database: dbStatus,
  });
});
