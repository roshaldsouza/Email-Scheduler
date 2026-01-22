import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { emailRoutes } from "./routes/emailRoutes";
import { authRoutes } from "./routes/authRoutes";

dotenv.config();

// start worker
import "./workers/emailWorker";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json()); // ✅ must be before routes

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Backend + Worker running ✅" });
});

app.use("/auth", authRoutes);   // ✅ move here
app.use("/emails", emailRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
