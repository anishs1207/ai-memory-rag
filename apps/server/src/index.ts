import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";

dotenv.config({
  path: "./.env",
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json({ limit: "16kb" }));

app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));

// ── Routes ─────────────────────────────────────────────────
import messageRouter from "./routes/message.routes.js";
import panelRouter from "./routes/panel.routes.js";

app.use("/api/v1/message", messageRouter);
app.use("/api/v1/panel", panelRouter);

// ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});

export { app };
