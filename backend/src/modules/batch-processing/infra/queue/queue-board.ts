import type { INestApplication } from "@nestjs/common";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import type { NextFunction, Request, Response } from "express";
import { EnrichmentQueue } from "./enrichment.queue";

export const QUEUE_BOARD_PATH = "queues";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function configureQueueBoard(app: INestApplication): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(`/${QUEUE_BOARD_PATH}`);

  createBullBoard({
    queues: [new BullMQAdapter(app.get(EnrichmentQueue))],
    serverAdapter,
  });

  app.use(`/${QUEUE_BOARD_PATH}`, localOnly, serverAdapter.getRouter());
}

export function localOnly(req: Request, res: Response, next: NextFunction): void {
  const forwarded = req.headers["x-forwarded-for"] !== undefined;
  const hostname = (req.headers.host ?? "").replace(/:\d+$/, "");

  if (forwarded || !LOCAL_HOSTNAMES.has(hostname)) {
    res.status(404).end();
    return;
  }
  next();
}
