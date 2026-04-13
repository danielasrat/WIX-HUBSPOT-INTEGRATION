import express from "express";
import authRoutes from "./routes/auth";
import mappingsRoutes from "./routes/mappings";
import webhookRoutes from "./routes/webhooks";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("API running");
});

app.use("/api/auth", authRoutes);
app.use("/api", mappingsRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/webhooks", webhookRoutes);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error", error);
  res.status(500).json({ error: "Internal server error" });
});

export default app;