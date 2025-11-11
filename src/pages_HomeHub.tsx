// src/pages_HomeHub.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from './state'
import TopBar from './components_TopBar'
import MenuDrawer from './components/menu-drawer'
import {
  fetchFixtures,
  fetchBootstrap,
  fetchElementSummary,
  listContests,
  joinContest,
  startPaidJoin,
  verifyPaidJoin,
  authIntrospect, // ✅ added
  type Contest,
} from './api'
import JoinContestBar from './components_JoinContestBar'

type Props = {
  onViewTeam?: () => void
  onCreateTeam?: () => void
  onJoinContest?: () => void
  onLeaderboard?: () => void
  onTransfers?: () => void
  onFixtures?: () => void
  onStats?: () => void
  onBack?: () => void
  onTop10?: () => void
  onHowToPlay?: () => void
  onAboutUs?: () => void
  onContactUs?: () => void
  isAdmin?: boolean
  onAdmin?: () => void
  onHistory?: () => void
  onProfile?: () => void
}

type LbEntry = { name: string; points: number }

class AbortSignalController {
  private controller = new AbortController()
  private timer: any
  constructor(ms: number) {
    this.timer = setTimeout(() => this.controller.abort('timeout'), ms)
  }
  get signal() {
    return this.controller.signal
  }
  clear() {
    clearTimeout(this.timer)
  }
}

async function loadLeaderboardPreview(timeoutMs = 7000): Promise<LbEntry[] | null> {
  const ctrl = new AbortSignalController(timeoutMs)
  try {
    const r = await fetch('/leaderboard.json', { cache: 'no-store', signal: ctrl.signal })
    if (!r.ok) return null
    const arr = await r.json()
    return Array.isArray(arr) ? arr.slice(0, 3) : null
  } catch {
    return null
  } finally {
    ctrl.clear()
  }
}

function formatLocal(dtIso: string) {
  try {
    const d = new Date(dtIso)
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dtIso
  }
}

type FixtureView = { id: string; home: string; away: string; kickoff_utc: string }

async function loadGameweekFixtures(): Promise<FixtureView[]> {
  const [fixtures, bootstrap] = await Promise.all([fetchFixtures(), fetchBootstrap()])

  const teamNameById = new Map<number, string>()
  if (bootstrap?.teams) for (const t of bootstrap.teams) teamNameById.set(t.id, t.name)

  const events = Array.isArray(bootstrap?.events) ? bootstrap.events : []
  const upcoming =
    events.find((e: any) => !e.finished && !e.data_checked) ||
    events.find((e: any) => !e.finished) ||
    events[0]
  const targetEventId = upcoming?.id

  let fx: any[] = []
  if (targetEventId) {
    fx = (fixtures || []).filter((f: any) => Number(f.event) === Number(targetEventId))
  } else {
    fx = (fixtures || [])
      .filter((f: any) => !!f.kickoff_time)
      .sort((a: any, b: any) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime())
      .slice(0, 8)
  }

  return fx.map((f: any, idx: number) => ({
    id: `gwfx-${idx}-${f.id ?? Math.random()}`,
    home: teamNameById.get(f.team_h) || `Team ${f.team_h}`,
    away: teamNameById.get(f.team_a) || `Team ${f.team_a}`,
    kickoff_utc: f.kickoff_time || f.kickoff_utc || '',
  }))
}

/* ===== Weekly points helpers ===== */
type FplEvent = { id: number; name: string; finished: boolean; data_checked: boolean }

function resolveLatestFinishedRound(events: FplEvent[]): { round: number | null; label: string } {
  if (!Array.isArray(events) || events.length === 0) return { round: null, label: '—' }
  const finished = events.filter((e) => e.finished || e.data_checked)
  if (finished.length > 0) {
    const r = finished[finished.length - 1]
    return { round: r.id, label: r.name || `GW ${r.id}` }
  }
  return { round: events[0].id, label: events[0].name || `GW ${events[0].id}` }
}

async function sumWeeklyPointsForTeam(playerIds: (string | number)[], round: number): Promise<number> {
  const totals = await Promise.all(
    playerIds.map(async (id) => {
      try {
        const s = await fetchElementSummary(id)
        const row = Array.isArray(s?.history)
          ? s.history.find((h: any) => Number(h.round) === Number(round))
          : null
        const pts = Number(row?.total_points ?? 0)
        return Number.isFinite(pts) ? pts : 0
      } catch {
        return 0
      }
    })
  )
  return totals.reduce((a, b) => a + b, 0)
}

/* ===== Paid join helper (manual signature paste) ===== */
async function doPaidJoinFlow(contest: Contest) {
  const { to, amountLamports, memo } = await startPaidJoin(contest.id)
  const sol = (amountLamports / 1_000_000_000).toFixed(6)

  alert(
    `Paid contest: ${contest.title}\n\n` +
      `1) In Phantom, SEND ${sol} SOL to:\n${to}\n\n` +
      (memo ? `Include Memo:\n${memo}\n\n` : '') +
      `2) After sending, copy the transaction signature and paste it next.`
  )

  const signature = window.prompt('Paste your Solana transaction signature:')
  if (!signature) throw new Error('Signature required to verify join')
  return verifyPaidJoin(contest.id, signature.trim())
}

export default function HomeHub({
  onViewTeam,
  onCreateTeam,
  onJoinContest,
  onLeaderboard,
  onTransfers,
  onFixtures,
  onStats,
  onBack,
  onTop10,
  onHowToPlay,
  onAboutUs,
  onContactUs,
  isAdmin,
  onAdmin,
  onHistory,
  onProfile,
}: Props) {
  const { fullName, budget, team, realm, setRealm, rules } = useApp()
  const picked = team.length
  const totalNeeded = rules.players
  const progressPct = useMemo(() => Math.min(100, Math.round((picked / totalNeeded) * 100)), [picked, totalNeeded])

  const [lb, setLb] = useState<LbEntry[] | null | 'error'>(null)
  const [fixtures, setFixtures] = useState<FixtureView[] | 'error' | null>(null)
  const [fxIdx, setFxIdx] = useState(0)
  const fxTimerRef = useRef<number | null>(null)
  const fxWrapRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [contests, setContests] = useState<Contest[]>([])
  const [activeContest, setActiveContest] = useState<Contest | null>(null)
  const [adminMode, setAdminMode] = useState<boolean>(!!isAdmin) // ✅ detect admin automatically

  // ✅ Auto-detect admin mode from backend token
  useEffect(() => {
    (async () => {
      try {
        const res = await authIntrospect()
        if (res?.ok && res.role === 'ADMIN') setAdminMode(true)
      } catch {
        setAdminMode(false)
      }
    })()
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [a, f] = await Promise.all([
        loadLeaderboardPreview().catch(() => 'error' as const),
        loadGameweekFixtures().catch(() => 'error' as const),
      ])
      if (!mounted) return
      setLb(a === 'error' ? 'error' : a)
      setFixtures(f === 'error' ? 'error' : f.length ? f : 'error')
      setFxIdx(0)
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!Array.isArray(fixtures) || fixtures.length <= 1) return
    const tick = () => setFxIdx((i) => (i + 1) % fixtures.length)
    fxTimerRef.current = window.setInterval(tick, 4000) as unknown as number
    return () => {
      if (fxTimerRef.current) window.clearInterval(fxTimerRef.current)
    }
  }, [fixtures])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await listContests()
        if (!mounted) return
        setContests(res.contests)
        const active = res.contests.filter((c) => c.active)
        const pick = active.find((c) => c.realm === 'WEEKLY') || active[0] || res.contests[0] || null
        setActiveContest(pick || null)
      } catch {}
    })()
    return () => {
      mounted = false
    }
  }, [])

  const handleViewTeam = onViewTeam ?? (() => onProfile?.())
  const handleCreateTeam = onCreateTeam ?? (() => onProfile?.())
  const handleTransfers = onTransfers ?? (() => onProfile?.())
  const handleFixtures = onFixtures ?? (() => {})
  const handleStats = onStats ?? (() => {})
  const handleLb = onLeaderboard ?? (() => {})
  const handleTop10 = onTop10 ?? (() => {})
  const goHowToPlay = onHowToPlay ?? (() => {})
  const goAboutUs = onAboutUs ?? (() => {})
  const goContact = onContactUs ?? (() => {})
  const goAdmin = onAdmin ?? (() => {})
  const goHistory = onHistory ?? (() => {})
  const goProfile = onProfile ?? (() => {})

  const primaryAction =
    picked < totalNeeded
      ? { label: `Pick ${totalNeeded - picked} more`, onClick: handleCreateTeam }
      : { label: 'View Team', onClick: handleViewTeam }

  const [loadingGW, setLoadingGW] = useState(true)
  const [round, setRound] = useState<number | null>(null)
  const [roundLabel, setRoundLabel] = useState<string>('—')
  const [weeklyPoints, setWeeklyPoints] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoadingGW(true)
        const data = await fetchBootstrap()
        const events = data?.events ?? []
        const { round: r, label } = resolveLatestFinishedRound(events)
        if (!mounted) return
        setRound(r)
        setRoundLabel(label)
      } finally {
        if (mounted) setLoadingGW(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!round) return
      setWeeklyPoints(null)
      try {
        const total = await sumWeeklyPointsForTeam(team.map((p) => p.id), round)
        if (!mounted) return
        setWeeklyPoints(total)
      } catch {
        if (!mounted) return
        setWeeklyPoints(0)
      }
    })()
    return () => {
      mounted = false
    }
  }, [round, team])

  async function handleJoinUnified() {
    try {
      if (onJoinContest) return onJoinContest()
      if (!activeContest) return alert('No contest available yet.')
      if (picked < totalNeeded)
        return alert(`Finish your squad first — you need ${totalNeeded - picked} more player${totalNeeded - picked === 1 ? '' : 's'}.`)
      if (activeContest.entryFee > 0) {
        const { created } = await doPaidJoinFlow(activeContest)
        alert(created ? 'Joined paid contest!' : 'Already joined this contest.')
      } else {
        const { created } = await joinContest(activeContest.id, {
          picks: team.map((p) => ({ elementId: Number(p.id) })),
        })
        alert(created ? 'Joined free contest!' : 'You already joined this contest.')
      }
    } catch (e: any) {
      alert(String(e?.message || e))
    }
  }

  const prevFx = () => {
    if (Array.isArray(fixtures) && fixtures.length > 1)
      setFxIdx((i) => (i - 1 + fixtures.length) % fixtures.length)
  }
  const nextFx = () => {
    if (Array.isArray(fixtures) && fixtures.length > 1) setFxIdx((i) => (i + 1) % fixtures.length)
  }

  return (
    <div className="screen">
      <style>{styles}</style>
      {/* Rest of your UI unchanged */}

      {/* ... existing code here ... */}

      <div className="title-xl" style={{ margin: '18px 0 12px' }}>
        Quick Actions
      </div>
      <div className="qa-grid">
        <button className="qa-card qa-green" onClick={handleViewTeam}>
          <div className="qa-icon">👥</div>
          <div className="qa-text">
            <div className="qa-title">View Team</div>
            <div className="subtle">Your current XI</div>
          </div>
        </button>

        <button className="qa-card qa-blue" onClick={onTransfers}>
          <div className="qa-icon">🔁</div>
          <div className="qa-text">
            <div className="qa-title">Transfers</div>
            <div className="subtle">Swap players weekly</div>
          </div>
        </button>

        <button className="qa-card qa-purple" onClick={onFixtures}>
          <div className="qa-icon">📅</div>
          <div className="qa-text">
            <div className="qa-title">Fixtures</div>
            <div className="subtle">This week’s matches</div>
          </div>
        </button>

        <button className="qa-card qa-orange" onClick={onStats}>
          <div className="qa-icon">📊</div>
          <div className="qa-text">
            <div className="qa-title">Stats</div>
            <div className="subtle">Form & price</div>
          </div>
        </button>

        {(isAdmin || adminMode) && (
          <button className="qa-card" onClick={goAdmin} style={{ border: '1px solid rgba(255,255,255,0.18)' }}>
            <div className="qa-icon">🛡️</div>
            <div className="qa-text">
              <div className="qa-title">Admin</div>
              <div className="subtle">Manage users & contests</div>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

const styles = String.raw`
.carousel { position: relative; overflow: hidden; border-radius: 14px; border: 1px solid rgba(255,255,255,0.12); }
/* rest of your styles unchanged */
`
