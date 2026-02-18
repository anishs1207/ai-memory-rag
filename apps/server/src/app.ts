// import panelRouter from "./routes/panel.routes.js";
import messageRouter from "./routes/message.routes.js";
import {app} from "./index.js";

// app.use("/api/v1/panel", panelRouter);
app.use("/api/v1/message", messageRouter)

