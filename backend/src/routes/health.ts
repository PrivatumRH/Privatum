import { Router, type Request, type Response } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    service: "privatum-cosigner-backend",
    network: "Robinhood Chain",
    chainId: 4663,
  });
});
