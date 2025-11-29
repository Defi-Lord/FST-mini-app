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

type Tab = "overview" | "contests" | "users" | "leaderboard";

export default function AdminPage({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [health, setHealth] = React.useState<
    "loading" | "ok" | "bad"
  >("loading");
  const [err, setErr] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  // contests
  const [contests, setContests] = React.useState<Contest[]>([]);
  const [title, setTitle] = React.useState("");
  const [realm, setRealm] = React.useState<Contest["realm"]>("FREE");
  const [fee, setFee] = React.useState<number>(0);
  const [startAt, setStartAt] = React.useState<string>("");
  const [endAt, setEndAt] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  // users
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = React.useState("");

  // leaderboard
  const [selectedContest, setSelectedContest] = React.useState<string>("");
  const [leaderboard, setLeaderboard] = React.useState<
    LeaderboardEntry[]
  >([]);
  const [lbBusy, setLbBusy] = React.useState(false);

  /* ============================================================
     1) CHECK TOKEN + VERIFY ADMIN BEFORE ANY API REQUEST
     ============================================================ */
  React.useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem("authToken");
        if (!token) {
          console.warn("⚠️ No token found. Logging out.");
          return signOut();
        }

        await getMe(true); // admin only
        setReady(true);
      } catch (err: any) {
        console.error("Admin validation failed:", err.message);
        signOut();
      }
    };
    init();
  }, []);

  /* ============================================================
     HEALTH CHECK
     ============================================================ */
  const loadHealth = React.useCallback(async () => {
    setErr(null);
    try {
      await adminHealth();
      setHealth("ok");
    } catch (e: any) {
      setHealth("bad");
      if (e.message?.includes("Unauthorized")) signOut();
      setErr(String(e.message || e));
    }
  }, []);

  /* ============================================================
     LOAD CONTESTS
     ============================================================ */
  const loadContests = React.useCallback(
    async () => {
      try {
        const res = await listContests();
        const sorted = (res.contests || []).sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );

        setContests(sorted);

        if (!selectedContest && sorted.length) {
          setSelectedContest(sorted[0].id);
        }
      } catch (e: any) {
        if (e.message?.includes("Unauthorized")) signOut();
        setErr(String(e.message || e));
      }
    },
    [selectedContest]
  );

  /* ============================================================
     LOAD USERS
     ============================================================ */
  const loadUsers = React.useCallback(async () => {
    try {
      const res = await listUsers();
      setUsers(res.users || []);
    } catch (e: any) {
      if (e.message?.includes("Unauthorized")) signOut();
      setErr(String(e.message || e));
    }
  }, []);

  /* = Load everything when ready = */
  React.useEffect(() => {
    if (ready) {
      loadHealth();
      loadContests();
      loadUsers();
    }
  }, [ready, loadHealth, loadContests, loadUsers]);

  /* ============================================================
     FILTER USERS
     ============================================================ */
  const filteredUsers = React.useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.id.toLowerCase().includes(q) ||
        (u.displayName || "").toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  /* ============================================================
     CREATE CONTEST
     ============================================================ */
  const createOne = async () => {
    if (!title) return;

    if (realm !== "FREE" && (!startAt || !endAt)) {
      alert("Please set both start and end dates for paid contests.");
      return;
    }

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
      if (e.message?.includes("Unauthorized")) signOut();
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  /* ============================================================
     TOGGLE CONTEST ACTIVE
     ============================================================ */
  const toggleOne = async (id: string, open: boolean) => {
    setErr(null);
    try {
      await toggleContest(id, open);
      await loadContests();
    } catch (e: any) {
      if (e.message?.includes("Unauthorized")) signOut();
      setErr(String(e.message || e));
    }
  };

  /* ============================================================
     DELETE CONTEST
     ============================================================ */
  const removeOne = async (id: string) => {
    if (!confirm("Delete this contest?")) return;

    setErr(null);
    try {
      await deleteContest(id);
      await loadContests();
    } catch (e: any) {
      if (e.message?.includes("Unauthorized")) signOut();
      setErr(String(e.message || e));
    }
  };

  /* ============================================================
     LOAD LEADERBOARD
     ============================================================ */
  const loadLeaderboard = async () => {
    if (!selectedContest) return;

    setLbBusy(true);
    setErr(null);

    try {
      const res = await getContestLeaderboard(selectedContest);
      setLeaderboard(res.leaderboard || []);
    } catch (e: any) {
      if (e.message?.includes("Unauthorized")) signOut();
      setErr(String(e.message || e));
      setLeaderboard([]);
    } finally {
      setLbBusy(false);
    }
  };

  React.useEffect(() => {
    if (tab === "leaderboard") loadLeaderboard();
  }, [tab, selectedContest]);

  /* ============================================================
     STATUS CALC
     ============================================================ */
  const now = Date.now();
  const contestStatus = (c: Contest) => {
    const start = c.startAt ? new Date(c.startAt).getTime() : 0;
    const end = c.endAt ? new Date(c.endAt).getTime() : 0;

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

        <div
          className={`pill ${
            health === "ok" ? "ok" : health === "bad" ? "bad" : "warn"
          }`}
        >
          {health === "loading"
            ? "Checking…"
            : health === "ok"
            ? "API OK"
            : "API Error"}
        </div>
      </header>

      {err && <div className="alert">{err}</div>}

      {/* TAB CONTENT — your existing JSX stays unchanged */}
    </div>
  );
}

const css = String.raw`
// your CSS unchanged
`;
