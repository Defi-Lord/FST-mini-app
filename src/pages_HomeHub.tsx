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
  authIntrospect,
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

export default function HomeHub({
  onViewTeam,
  onCreateTeam,
  onJoinContest,
  onLeaderboard,
  onTransfers,
  onFixtures,
  onStats,
  onBack,
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

  const [fixtures, setFixtures] = useState<FixtureView[] | 'error' | null>(null)
  const [fxIdx, setFxIdx] = useState(0)
  const fxWrapRef = useRef<HTMLDivElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [contests, setContests] = useState<Contest[]>([])
  const [activeContest, setActiveContest] = useState<Contest | null>(null)
  const [adminMode, setAdminMode] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const me = await authIntrospect()
        if (me?.ok && me.role === 'ADMIN') setAdminMode(true)
      } catch {
        setAdminMode(false)
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      const [f] = await Promise.all([loadGameweekFixtures().catch(() => 'error' as const)])
      setFixtures(f === 'error' ? 'error' : f)
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await listContests()
        setContests(res.contests || [])
        const pick = res.contests[0] || null
        setActiveContest(pick)
      } catch {}
    })()
  }, [])

  async function handleJoinUnified() {
    try {
      if (onJoinContest) return onJoinContest()
      if (!activeContest) return alert('No contest available yet.')
      if (picked < totalNeeded) return alert(`Finish your squad first — you need ${totalNeeded - picked} more.`)
      if (activeContest.entryFee && activeContest.entryFee > 0) {
        const { created } = await startPaidJoin(activeContest.id)
        alert(created ? 'Joined paid contest!' : 'Already joined.')
      } else {
        const { created } = await joinContest(activeContest.id, {
          picks: team.map((p) => ({ elementId: Number(p.id) })),
        })
        alert(created ? 'Joined free contest!' : 'Already joined.')
      }
    } catch (err: any) {
      alert(String(err?.message || err))
    }
  }

  return (
    <div className="screen">
      <style>{styles}</style>
      <div className="container" style={{ paddingTop: 8, paddingBottom: 110 }}>
        <TopBar
          title="Home"
          onBack={onBack}
          leftSlot={
            <button className="hamburger-btn" onClick={() => setMenuOpen(true)}>
              <div className="hamburger-lines">
                <div />
                <div />
                <div />
              </div>
            </button>
          }
          rightSlot={<div className="balance-chip">£{budget.toFixed(1)}m</div>}
        />

        <div style={{ margin: '6px 0 10px' }}>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Welcome</div>
          <div className="subtle">{fullName}</div>
        </div>

        {realm === 'free' && (
          <div style={{ margin: '10px 0 14px' }}>
            <JoinContestBar onClick={handleJoinUnified} />
          </div>
        )}

        <div className="title-xl" style={{ margin: '18px 0 8px' }}>
          This Week’s Fixtures
        </div>
        <div className="carousel" ref={fxWrapRef}>
          {fixtures === 'error' && <div className="subtle">Couldn’t load fixtures.</div>}
          {Array.isArray(fixtures) && fixtures.length > 0 && (
            <div className="track" style={{ transform: `translateX(-${fxIdx * 100}%)` }}>
              {fixtures.map((f) => (
                <div className="slide" key={f.id}>
                  <div className="card fx-card">
                    <div className="row">
                      <div>
                        <div style={{ fontWeight: 900 }}>
                          {f.home} vs {f.away}
                        </div>
                        <div className="subtle">{formatLocal(f.kickoff_utc)}</div>
                      </div>
                      <button className="btn-ghost" onClick={onFixtures}>
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="title-xl" style={{ margin: '18px 0 12px' }}>
          Quick Actions
        </div>
        <div className="qa-grid">
          <button className="qa-card qa-green" onClick={onViewTeam}>
            👥 View Team
          </button>
          <button className="qa-card qa-blue" onClick={onTransfers}>
            🔁 Transfers
          </button>
          <button className="qa-card qa-purple" onClick={onFixtures}>
            📅 Fixtures
          </button>
          <button className="qa-card qa-orange" onClick={onStats}>
            📊 Stats
          </button>
          {adminMode && (
            <button className="qa-card" onClick={onAdmin}>
              🛡️ Admin Panel
            </button>
          )}
        </div>
      </div>

      <nav className="tabbar">
        <button className="tab active">Home</button>
        <button className="tab" onClick={handleJoinUnified}>
          Leagues
        </button>
        <button className="tab" onClick={onHistory}>
          History
        </button>
        <button className="tab" onClick={onProfile}>
          Profile
        </button>
      </nav>

      <MenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}

const styles = String.raw`
.carousel { position: relative; overflow: hidden; border-radius: 14px; border: 1px solid rgba(255,255,255,0.12); }
.track { display: flex; transition: transform .5s ease; width: 100%; }
.slide { min-width: 100%; }
.card { background: rgba(255,255,255,0.04); border-radius: 14px; padding: 12px; }
.title-xl { font-weight:900; letter-spacing:.2px; }
.subtle { opacity:.75; }
.qa-grid { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; }
.qa-card { background: rgba(255,255,255,0.04); border-radius: 14px; padding: 12px; display:flex; gap:10px; align-items:center; border:1px solid rgba(255,255,255,0.12);}
.tabbar { position: fixed; left:0; right:0; bottom:0; height: 64px; background: rgba(0,0,0,.6); border-top: 1px solid rgba(255,255,255,.12); display:flex; }
.tab { flex:1; background:transparent; border:none; color:#fff; font-weight:800; }
.hamburger-btn { background:transparent; border:none; cursor:pointer; }
.hamburger-lines { display:grid; gap:3px; }
.hamburger-lines div { width:18px; height:2px; background:#fff; }
`
