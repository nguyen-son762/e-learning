import express from "express";
import cors from "cors";
import { env } from "./lib/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/authRoutes";
import topicRoutes from "./routes/topicRoutes";
import flashcardRoutes from "./routes/flashcardRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import readingRoutes from "./routes/readingRoutes";
import vocabularyRoutes from "./routes/vocabularyRoutes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin.length ? env.corsOrigin : true,
      credentials: true,
    })
  );
  app.use(express.json());

  // Health check.
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // API routes (all under /api).
  app.use("/api/auth", authRoutes);
  app.use("/api/topics", topicRoutes);
  app.use("/api/flashcards", flashcardRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/reading-exercises", readingRoutes);
  app.use("/api/vocabulary", vocabularyRoutes);

  // 404 + error handling.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
