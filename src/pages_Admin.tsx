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
} from "./api";

type Tab = "overview" | "contests" | "users" | "leaderboard";

export default function AdminPage({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [health, setHealth] = React.useState<"loading" | "ok" | "bad">("loading");
  const [err, setErr] = React.useState<string | null>(null);

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
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [lbBusy, setLbBusy] = React.useState(false);

  const loadHealth = React.useCallback(async () => {
    setErr(null);
    try {
      await adminHealth();
      setHealth("ok");
    } catch (e: any) {
      setHealth("bad");
      setErr(String(e?.message || e));
    }
  }, []);

  const loadContests = React.useCallback(async () => {
    try {
      const res = await listContests();
      const sorted = res.contests.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setContests(sorted);
      if (!selectedContest && res.contests.length) {
        setSelectedContest(res.contests[0].id);
      }
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }, [selectedContest]);

  const loadUsers = React.useCallback(async () => {
    try {
      const res = await listUsers();
      setUsers(res.users);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }, []);

  React.useEffect(() => {
    loadHealth();
    loadContests();
    loadUsers();
  }, [loadHealth, loadContests, loadUsers]);

  const filteredUsers = React.useMemo(() => {
    if (!userSearch.trim()) return users;
    const q = userSearch.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.id.toLowerCase().includes(q) ||
        (u.displayName || "").toLowerCase().includes(q)
    );
  }, [users, userSearch]);

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
        realm,
        entryFee: Number(fee),
        startAt: startAt ? new Date(startAt).toISOString() : undefined,
        endAt: endAt ? new Date(endAt).toISOString() : undefined,
      });
      setTitle("");
      setFee(0);
      setStartAt("");
      setEndAt("");
      await loadContests();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const toggleOne = async (id: string, active: boolean) => {
    setErr(null);
    try {
      await toggleContest(id, active);
      await loadContests();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  };

  const removeOne = async (id: string) => {
    if (!confirm("Delete this contest?")) return;
    setErr(null);
    try {
      await deleteContest(id);
      await loadContests();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  };

  const loadLeaderboard = async () => {
    if (!selectedContest) return;
    setLbBusy(true);
    setErr(null);
    try {
      const res = await getContestLeaderboard(selectedContest);
      setLeaderboard(res.leaderboard);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setLeaderboard([]);
    } finally {
      setLbBusy(false);
    }
  };

  React.useEffect(() => {
    if (tab === "leaderboard") loadLeaderboard();
  }, [tab, selectedContest]);

  const now = Date.now();
  const contestStatus = (c: Contest) => {
    const start = c.startAt ? new Date(c.startAt).getTime() : 0;
    const end = c.endAt ? new Date(c.endAt).getTime() : 0;
    if (now < start) return "Scheduled";
    if (now >= start && now <= end) return "Open";
    if (now > end) return "Closed";
    return "Inactive";
  };

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

      <nav className="tabs">
        <button
          className={`tab ${tab === "overview" ? "active" : ""}`}
          onClick={() => setTab("overview")}
        >
          Overview
        </button>
        <button
          className={`tab ${tab === "contests" ? "active" : ""}`}
          onClick={() => setTab("contests")}
        >
          Contests
        </button>
        <button
          className={`tab ${tab === "users" ? "active" : ""}`}
          onClick={() => setTab("users")}
        >
          Users
        </button>
        <button
          className={`tab ${tab === "leaderboard" ? "active" : ""}`}
          onClick={() => setTab("leaderboard")}
        >
          Leaderboard
        </button>
      </nav>

      {tab === "overview" && (
        <section className="grid">
          <div className="card kpi">
            <div className="kpi-label">Total Users</div>
            <div className="kpi-value">{users.length}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Contests</div>
            <div className="kpi-value">{contests.length}</div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Active</div>
            <div className="kpi-value">
              {contests.filter((c) => c.active).length}
            </div>
          </div>
          <div className="card kpi">
            <div className="kpi-label">Closed</div>
            <div className="kpi-value">
              {contests.filter((c) => contestStatus(c) === "Closed").length}
            </div>
          </div>
        </section>
      )}

      {tab === "contests" && (
        <>
          <section className="card">
            <h3>Create Contest</h3>
            <div className="form-row">
              <input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <select
                value={realm}
                onChange={(e) =>
                  setRealm(e.target.value as Contest["realm"])
                }
              >
                <option value="FREE">FREE</option>
                <option value="WEEKLY">WEEKLY</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="SEASONAL">SEASONAL</option>
              </select>
              <input
                type="number"
                placeholder="Entry fee"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
              />
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
              <button
                className="btn"
                onClick={createOne}
                disabled={busy || !title}
              >
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </section>

          <section className="card">
            <h3>Existing Contests</h3>
            {!contests.length ? (
              <div className="muted">No contests yet.</div>
            ) : (
              <div className="list">
                {contests.map((c) => (
                  <div key={c.id} className="row">
                    <div className="title">
                      <div className="name">{c.title}</div>
                      <div className="meta">
                        #{c.id.slice(0, 8)} • {c.realm} • Fee: <b>{c.entryFee}</b>
                      </div>
                      {c.startAt && (
                        <div className="meta small">
                          {new Date(c.startAt).toLocaleString()} →{" "}
                          {new Date(c.endAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="status">
                      <span className={`dot ${c.active ? "on" : "off"}`} />
                      {contestStatus(c)}
                    </div>
                    <div className="actions">
                      <button
                        className="btn ghost"
                        onClick={() => toggleOne(c.id, !c.active)}
                      >
                        {c.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        className="btn danger"
                        onClick={() => removeOne(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "users" && (
        <section className="card">
          <h3>Users</h3>
          <div className="toolbar">
            <input
              className="search"
              placeholder="Search by id or display name…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>
          {!filteredUsers.length ? (
            <div className="muted">No users found.</div>
          ) : (
            <div className="table">
              <div className="thead">
                <div>User ID</div>
                <div>Display</div>
                <div>Created</div>
                <div>Updated</div>
              </div>
              {filteredUsers.map((u) => (
                <div className="trow" key={u.id}>
                  <div className="mono">{u.id}</div>
                  <div>{u.displayName || "—"}</div>
                  <div>{new Date(u.createdAt).toLocaleString()}</div>
                  <div>{new Date(u.updatedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "leaderboard" && (
        <section className="card">
          <h3>Leaderboard</h3>
          <div className="form-row">
            <select
              value={selectedContest}
              onChange={(e) => setSelectedContest(e.target.value)}
            >
              {contests.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.realm})
                </option>
              ))}
            </select>
            <button
              className="btn"
              onClick={loadLeaderboard}
              disabled={!selectedContest || lbBusy}
            >
              {lbBusy ? "Loading…" : "Refresh"}
            </button>
          </div>
          {!leaderboard.length ? (
            <div className="muted">No leaderboard entries yet.</div>
          ) : (
            <div className="table">
              <div className="thead">
                <div>Rank</div>
                <div>User</div>
                <div>Display</div>
                <div>Points</div>
              </div>
              {leaderboard.map((e, i) => (
                <div className="trow" key={`${e.userId}-${i}`}>
                  <div>{e.rank}</div>
                  <div className="mono">{e.userId}</div>
                  <div>{e.displayName || "—"}</div>
                  <div>
                    <b>{e.points}</b>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

const css = String.raw`
// your CSS remains unchanged
`;
