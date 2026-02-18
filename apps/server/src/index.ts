import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";

dotenv.config({
  path: "./.env",
});

const app = express();
const PORT = process.env.PORT || 3000;
// const __dirname = path.resolve();
// if (process.env.NODE_ENV === "production") {
//   app.use(express.static(path.join(__dirname, "../frontend/dist")));

//   app.get("*", (req, res) => {
//     res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
//   });
// }

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  }),
);

app.use(express.json({ limit: "16kb" }));

app.use(express.urlencoded({ extended: true }));

app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Server started at localhost:${PORT}`);
});


export {app};