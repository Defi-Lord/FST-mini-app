import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import adminActivities from "./routes/admin.activities";

dotenv.config(); // Load env vars from .env

const app = express();

// ---------- Security ----------
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src-attr": ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  })
);

app.use(cookieParser());
app.use(express.json());

// ---------- CORS ----------
const parseOrigins = (s?: string) =>
  (s || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const allowedOrigins = [
  ...parseOrigins(process.env.CORS_ALLOW_ORIGINS),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const corsOptions = {
  origin(origin: string | undefined, cb: any) {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));

// ---------- Health ----------
app.get("/public/healthz", (_req, res) => res.json({ ok: true }));

// ---------- Routes ----------
app.use("/auth", authRoutes);
app.use("/admin", adminActivities);

// Compatibility aliases for /auth/me
const meHandler =
  authRoutes._router?.stack?.find?.((r: any) => r?.route?.path === "/me")
    ?.route?.stack?.[0]?.handle;
const callMe = (req: any, res: any, next: any) => {
  if (meHandler) return meHandler(req, res, next);
  return res.status(404).json({ error: "me_not_available" });
};

app.get(
  ["/me", "/api/me", "/users/me", "/auth/me", "/whoami", "/session", "/auth/session"],
  callMe
);

// ---------- Start ----------
const PORT = parseInt(process.env.PORT || "10000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server is listening on http://0.0.0.0:${PORT}`);
});
