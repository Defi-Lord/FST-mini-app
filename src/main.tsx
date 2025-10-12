// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  Link,
  Navigate,
} from "react-router-dom";
import SignInWithWallet from "./components/SignInWithWallet";

/** Resolve API base from Vite env (no trailing slash) */
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/+$/, "") || "";

/** Simple "is signed in" check (cookie JWT may exist; also support localStorage token) */
function useAuthState() {
  const [authed, setAuthed] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    // very light heuristic — if token present we consider authed; cookie is server-side
    const t = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    setAuthed(!!t);
  }, []);
  return authed;
}

function Landing() {
  const nav = useNavigate();
  return (
    <div style={wrap}>
      <div style={card}>
        <div style={logo}>FST</div>
        <h1 style={{ margin: "6px 0 6px" }}>Welcome to FST</h1>
        <p style={{ opacity: 0.85, marginTop: 0 }}>Sign in to continue.</p>
        <SignInWithWallet onSuccess={() => nav("/home", { replace: true })} />
        <div style={{ marginTop: 12, opacity: 0.75, fontSize: 12 }}>
          API: <code>{API_BASE || "(missing VITE_API_BASE)"}</code>
        </div>
      </div>
      <div style={bg} />
    </div>
  );
}

function Home() {
  return (
    <div style={wrap}>
      <div style={card}>
        <div style={logo}>FST</div>
        <h1 style={{ margin: "6px 0 6px" }}>Home</h1>
        <p style={{ opacity: 0.8, margin: "0 0 12px" }}>
          Quick links:
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <Link to="/profile" style={btnMuted}>Profile</Link>
          <Link to="/history" style={btnMuted}>History</Link>
          <Link to="/admin" style={btnMuted}>Admin</Link>
        </div>
      </div>
      <div style={bg} />
    </div>
  );
}

/** Guarded route: if not "authed", show sign-in */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const authed = useAuthState();
  if (authed === null) return null; // initial read; very brief
  return authed ? <>{children}</> : <Navigate to="/" replace />;
}

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/home"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/history"
        element={
          <RequireAuth>
            <HistoryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

/** ====== inline styles shared with other pages for cohesive look ====== */
const wrap: React.CSSProperties = {
  minHeight: "100dvh",
  display: "grid",
  placeItems: "center",
  position: "relative",
  overflow: "hidden",
  background: "#0b1020",
};
const bg: React.CSSProperties = {
  position: "absolute",
  inset: "-20%",
  background:
    "radial-gradient(60% 40% at 20% 10%, rgba(124,58,237,.25), transparent 60%)," +
    "radial-gradient(50% 40% at 80% 20%, rgba(236,72,153,.25), transparent 60%)," +
    "radial-gradient(40% 30% at 40% 80%, rgba(16,185,129,.25), transparent 60%)",
  filter: "blur(80px)",
};
const card: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "min(92vw, 560px)",
  color: "#e7e9ee",
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 10px 50px rgba(0,0,0,.35)",
  textAlign: "center",
  backdropFilter: "blur(8px)",
};
const logo: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 14,
  margin: "0 auto 12px",
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #7c3aed, #ec4899)",
  color: "#fff",
  fontWeight: 900,
  letterSpacing: ".5px",
};
const btnMuted: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.25)",
  background: "transparent",
  color: "#e7e9ee",
  textDecoration: "none",
  fontWeight: 700,
};

/** ====== lightweight pages (imported below to keep single-file) ====== */
import ProfilePage from "./pages_Profile";
import HistoryPage from "./pages_History";
import AdminPage from "./pages_Admin";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
