import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { generalLimiter } from "./middleware/rateLimit.middleware.js";

dotenv.config({
  path: "./.env",
});

const app = express();
const PORT = process.env.PORT || 3001;

// Apply general rate limit globally
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

// ── Routes ─────────────────────────────────────────────────
import messageRouter from "./routes/message.routes.js";
import panelRouter from "./routes/panel.routes.js";
import memoryRouter from "./routes/memoryFramework.routes.js";

app.use("/api/v1/message", messageRouter);
app.use("/api/v1/panel", panelRouter);
app.use("/api/v1/memory", memoryRouter);

// ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});

export { app };
