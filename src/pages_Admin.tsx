// src/pages_Admin.tsx
import React from "react";
import {
  adminHealth,
  listContests,
  createContest,
  toggleContest,
  deleteContest,
  listUsers,
  getContestLeaderboard,
  type Contest,
  type AdminUser,
  type LeaderboardEntry,
  signOut,
  getMe,
} from "./api";

/* ============================================================
   TOKEN HELPER — FIXED (now matches api.ts)
   ============================================================ */
function requireAuth() {
  const token = localStorage.getItem("auth_token"); // FIXED
  if (!token) {
    console.warn("No token found — signing out");
    signOut();
    throw new Error("Unauthorized");
  }
  return token;
}

type Tab = "overview" | "contests" | "users" | "leaderboard";

export default function AdminPage({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [health, setHealth] = React.useState<"loading" | "ok" | "bad">("loading");
  const [err, setErr] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  const [contests, setContests] = React.useState<Contest[]>([]);
  const [title, setTitle] = React.useState("");
  const [realm, setRealm] = React.useState<Contest["realm"]>("FREE");
  const [fee, setFee] = React.useState<number>(0);
  const [startAt, setStartAt] = React.useState<string>("");
  const [endAt, setEndAt] = React.useState<string>("");

  const [busy, setBusy] = React.useState(false);

  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = React.useState("");

  const [selectedContest, setSelectedContest] = React.useState<string>("");
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [lbBusy, setLbBusy] = React.useState(false);

  /* ============================================================
     AUTH VALIDATION — FIXED
     ============================================================ */
  React.useEffect(() => {
    const init = async () => {
      try {
        requireAuth();
        await getMe(true); // FIXED — this function reads token internally
        setReady(true);
      } catch {
        signOut();
      }
    };
    init();
  }, []);

  /* ============================================================
     HEALTH CHECK — FIXED
     ============================================================ */
  const loadHealth = React.useCallback(async () => {
    try {
      requireAuth();
      await adminHealth(); // FIXED — don't pass token manually
      setHealth("ok");
    } catch (e: any) {
      setHealth("bad");
      setErr(String(e.message));
      signOut();
    }
  }, []);

  /* ============================================================
     LOAD CONTESTS — FIXED
     ============================================================ */
  const loadContests = React.useCallback(async () => {
    try {
      requireAuth();
      const res = await listContests(); // FIXED

      const sorted = (res.contests || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setContests(sorted);

      if (!selectedContest && sorted.length) {
        setSelectedContest(sorted[0].id);
      }
    } catch (e: any) {
      setErr(String(e.message));
      signOut();
    }
  }, [selectedContest]);

  /* ============================================================
     LOAD USERS — FIXED
     ============================================================ */
  const loadUsers = React.useCallback(async () => {
    try {
      requireAuth();
      const res = await listUsers(); // FIXED
      setUsers(res.users || []);
    } catch (e: any) {
      setErr(String(e.message));
      signOut();
    }
  }, []);

  /* ============================================================
     RUN AFTER ADMIN VERIFIED
     ============================================================ */
  React.useEffect(() => {
    if (ready) {
      loadHealth();
      loadContests();
      loadUsers();
    }
  }, [ready]);

  /* ============================================================
     FILTER USERS
     ============================================================ */
  const filteredUsers = React.useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.id.toLowerCase().includes(q) ||
        (u.displayName || "").toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  /* ============================================================
     CREATE CONTEST — FIXED
     ============================================================ */
  const createOne = async () => {
    if (!title) return alert("Title is required");

    requireAuth();

    setBusy(true);
    setErr(null);

    try {
      await createContest({
        title,
        name: title,
        realm,
        entryFee: Number(fee),
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
      });

      setTitle("");
      setFee(0);
      setStartAt("");
      setEndAt("");

      await loadContests();
    } catch (e: any) {
      setErr(String(e.message));
    } finally {
      setBusy(false);
    }
  };

  /* ============================================================
     TOGGLE CONTEST — FIXED
     ============================================================ */
  const toggleOne = async (id: string, open: boolean) => {
    try {
      requireAuth();
      await toggleContest(id, open);
      await loadContests();
    } catch (e: any) {
      setErr(String(e.message));
    }
  };

  /* ============================================================
     DELETE CONTEST — FIXED
     ============================================================ */
  const removeOne = async (id: string) => {
    if (!confirm("Delete this contest?")) return;

    try {
      requireAuth();
      await deleteContest(id);
      await loadContests();
    } catch (e: any) {
      setErr(String(e.message));
    }
  };

  /* ============================================================
     LOAD LEADERBOARD — FIXED
     ============================================================ */
  const loadLeaderboard = async () => {
    if (!selectedContest) return;

    requireAuth();

    setLbBusy(true);
    try {
      const res = await getContestLeaderboard(selectedContest);
      setLeaderboard(res.leaderboard || []);
    } catch (e: any) {
      setErr(String(e.message));
      setLeaderboard([]);
    } finally {
      setLbBusy(false);
    }
  };

  React.useEffect(() => {
    if (tab === "leaderboard") loadLeaderboard();
  }, [tab, selectedContest]);

  /* ============================================================
     STATUS FUNCTION
     ============================================================ */
  const now = Date.now();
  const contestStatus = (c: Contest) => {
    const start = new Date(c.startAt || 0).getTime();
    const end = new Date(c.endAt || 0).getTime();

    if (now < start) return "Scheduled";
    if (now >= start && now <= end) return "Running";
    if (now > end) return "Ended";
    return c.open ? "Open" : "Closed";
  };

  if (!ready) return <p>Loading admin panel…</p>;

  return (
    <div className="admin-wrap">
      <style>{css}</style>

      <header className="admin-header">
        <div className="left">
          {onBack && (
            <button className="btn ghost" onClick={onBack}>
              ← Back
            </button>
          )}
          <h2>Admin Dashboard</h2>
        </div>

        <div className={`pill ${health === "ok" ? "ok" : health === "bad" ? "bad" : "warn"}`}>
          {health === "loading" ? "Checking…" : health === "ok" ? "API OK" : "API Error"}
        </div>
      </header>

      {err && <div className="alert">{err}</div>}

      {/* Your UI here */}
    </div>
  );
}

const css = String.raw`
// your CSS unchanged
`;
