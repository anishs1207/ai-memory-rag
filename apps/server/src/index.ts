import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { generalLimiter } from "./middleware/rateLimit.middleware.js";
import "@/workers/documentWorker.js";
import { startSmolLMServer, stopSmolLMServer } from "./utils/smollm.js";


dotenv.config({
  path: "./.env",
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(generalLimiter);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));

app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

import messageRouter from "./routes/message.routes.js";
import panelRouter from "./routes/panel.routes.js";
import memoryRouter from "./routes/memoryFramework.routes.js";

app.use("/api/v1/message", messageRouter);
app.use("/api/v1/panel", panelRouter);
app.use("/api/v1/memory", memoryRouter);

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
  // Rule 3: Log each major step
  console.log("[LOG] Express server is listening. Initializing local model service...");
  startSmolLMServer();
});

// Clean up child process on exit signal
process.on("SIGINT", () => {
  console.log("[LOG] SIGINT received. Shutting down...");
  stopSmolLMServer();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[LOG] SIGTERM received. Shutting down...");
  stopSmolLMServer();
  process.exit(0);
});

export { app };
