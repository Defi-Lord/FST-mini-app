// src/pages_ViewTeam.tsx
import React, { useEffect, useMemo, useState } from 'react';
import TopBar from './components_TopBar';
import { useApp } from './state';
import { fetchBootstrap } from './api';

type Props = { onBack?: () => void; onCreateTeam?: () => void };

type Group = 'GK' | 'DEF' | 'MID' | 'FWD';
type Formation =
  | '3-4-3' | '3-5-2'
  | '4-4-2' | '4-3-3' | '4-5-1'
  | '5-3-2' | '5-4-1';

const FORMATIONS: Formation[] = ['3-4-3','3-5-2','4-4-2','4-3-3','4-5-1','5-3-2','5-4-1'];
const parseFormation = (f: Formation) => f.split('-').map(n => Number(n)) as [number, number, number];

function detectGroup(p: any): Group | null {
  const et = Number(p?.element_type ?? p?.type);
  if (et === 1) return 'GK';
  if (et === 2) return 'DEF';
  if (et === 3) return 'MID';
  if (et === 4) return 'FWD';
  const s = String(p?.position ?? p?.pos ?? '').toUpperCase();
  if (!s) return null;
  if (s.startsWith('GK') || s === 'G' || s.includes('KEEP')) return 'GK';
  if (s.includes('DEF') || s === 'D' || s.startsWith('B')) return 'DEF';
  if (s.includes('MID') || s === 'M') return 'MID';
  if (s.includes('FWD') || s === 'F' || s.includes('STRIK') || s.includes('ATT')) return 'FWD';
  return null;
}

type ElementLite = { id: number; team: number; form: string; ict_index: string };
type TeamMeta = { id: number; name: string; short_name: string };

const keyOf = (p: any) => String(p?.id ?? p?.code ?? p?.name ?? p?.web_name ?? p?.player_name ?? Math.random());
const fullNameOf = (p: any) => String(p?.name ?? p?.web_name ?? p?.fullName ?? p?.player_name ?? p?.short_name ?? 'Player');

function shortName(full: string): string {
  const clean = String(full || '').trim().replace(/\s+/g, ' ');
  if (!clean) return full;
  const parts = clean.split(' ');
  const last = parts[parts.length - 1];
  const first = parts[0];
  const initial = first ? (first[0].toUpperCase() + '.') : '';
  if (last.length <= 2 && parts.length >= 2) return `${initial} ${parts[parts.length - 2]}`;
  return `${initial} ${last}`;
}

function hashHue(key: string) { let h = 0; for (let i=0;i<key.length;i++) h = (h*31 + key.charCodeAt(i))>>>0; return h%360; }
function kitColors(short: string) {
  const hue = hashHue(short || 'TEAM');
  return { primary: `hsl(${hue},70%,45%)`, secondary: `hsl(${(hue+40)%360},65%,55%)`, accent: '#fff' };
}

function Jersey({ code }: { code: string }) {
  const { primary, secondary, accent } = kitColors(code || 'TEAM');
  const pid = `stripes-${code}`;
  return (
    <svg width="40" height="38" viewBox="0 0 52 50" aria-hidden>
      <path d="M8,10 L16,4 L26,10 L36,4 L44,10 L41,44 Q26,50 11,44 Z"
        fill={primary} stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <defs>
        <pattern id={pid} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="skewX(-20)">
          <rect width="6" height="6" fill="transparent" />
          <rect width="3" height="6" fill={secondary} opacity="0.22" />
        </pattern>
      </defs>
      <path d="M8,10 L16,4 L26,10 L36,4 L44,10 L41,44 Q26,50 11,44 Z" fill={`url(#${pid})`} />
      <text x="26" y="31" textAnchor="middle" fontFamily="system-ui,sans-serif" fontWeight="900" fontSize="10" fill={accent}>
        {code || 'FC'}
      </text>
    </svg>
  );
}

export default function ViewTeam({ onBack, onCreateTeam }: Props) {
  const { team } = useApp();
  const [byElementId, setByElementId] = useState<Map<number, ElementLite>>(new Map());
  const [teamMeta, setTeamMeta] = useState<Map<number, TeamMeta>>(new Map());
  const [formation, setFormation] = useState<Formation>(() => {
    const saved = (localStorage.getItem('formation') || '') as Formation;
    return FORMATIONS.includes(saved) ? saved : '4-4-2';
  });
  useEffect(() => { localStorage.setItem('formation', formation); }, [formation]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const boot = await fetchBootstrap();
        const eMap = new Map<number, ElementLite>();
        const tMap = new Map<number, TeamMeta>();

        for (const e of boot?.elements ?? []) {
          eMap.set(Number(e.id), {
            id: Number(e.id),
            team: Number(e.team),
            form: String(e.form ?? '0'),
            ict_index: String(e.ict_index ?? '0'),
          });
        }

        for (const t of boot?.teams ?? []) {
          tMap.set(Number(t.id), {
            id: Number(t.id),
            name: String(t.name),
            short_name: String((t.short_name ?? t.name) || '').toUpperCase(),
          });
        }

        setByElementId(eMap);
        setTeamMeta(tMap);
      } catch (err) {
        console.error('Error fetching bootstrap:', err);
      }
    };

    fetchData();
  }, []);

  const roster = useMemo(() => {
    const by: Record<Group, any[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of team) (by[detectGroup(p) ?? 'MID']).push(p);
    (Object.keys(by) as Group[]).forEach(k => by[k].sort((a,b) => fullNameOf(a).localeCompare(fullNameOf(b))));
    const [needD, needM, needF] = parseFormation(formation);
    const xi: any[] = [];
    const bench: any[] = [];

    const take = (bucket: any[], n: number) => bucket.splice(0, n);

    const gkStart = by.GK.shift() || by.DEF.shift() || by.MID.shift() || by.FWD.shift();
    if (gkStart) xi.push(gkStart);

    const fillN = (primary: Group, n: number) => {
      const out = take(by[primary], n);
      const pools: Group[] = (['DEF','MID','FWD','GK'] as Group[]).filter(g => g !== primary);
      while (out.length < n) {
        const fill = pools.reduce<any | undefined>((acc, g) => acc ?? by[g].shift(), undefined);
        if (!fill) break;
        out.push(fill);
      }
      return out;
    };

    xi.push(...fillN('DEF', needD));
    xi.push(...fillN('MID', needM));
    xi.push(...fillN('FWD', needF));

    const poolsInOrder = [...by.DEF, ...by.MID, ...by.FWD, ...by.GK];
    while (xi.length < 11 && poolsInOrder.length > 0) xi.push(poolsInOrder.shift());

    const benchGK = by.GK.shift(); if (benchGK) bench.push(benchGK);
    const rest = [...by.DEF, ...by.MID, ...by.FWD, ...by.GK];
    bench.push(...rest.slice(0, 3));

    return { xi, bench };
  }, [team, formation]);

  const [xiKeys, setXiKeys] = useState<string[]>([]);
  const [benchKeys, setBenchKeys] = useState<string[]>([]);

  useEffect(() => {
    setXiKeys(roster.xi.map(p => keyOf(p)));
    setBenchKeys(roster.bench.map(p => keyOf(p)));
  }, [roster.xi, roster.bench]);

  const [pending, setPending] = useState<string | null>(null);

  const byKey = useMemo(() => {
    const map = new Map<string, any>();
    team.forEach(p => map.set(keyOf(p), p));
    return map;
  }, [team]);

  const isGK = (k: string) => detectGroup(byKey.get(k)) === 'GK';
  const isOutfield = (k: string) => {
    const g = detectGroup(byKey.get(k));
    return g === 'DEF' || g === 'MID' || g === 'FWD';
  };

  function onCardClick(k: string, _zone: 'XI'|'BENCH') {
    if (!byKey.get(k)) return;
    if (pending === null) { setPending(k); return; }
    if (pending === k)   { setPending(null); return; }

    const aInXi = xiKeys.includes(pending);
    const bInXi = xiKeys.includes(k);
    if (aInXi === bInXi) { setPending(null); return; }
    if (isGK(pending) !== isGK(k)) { setPending(null); return; }
    if (isOutfield(pending) !== isOutfield(k)) { setPending(null); return; }

    const newXi = [...xiKeys];
    const newBench = [...benchKeys];
    if (aInXi) {
      const xiIdx = newXi.indexOf(pending);
      const bIdx  = newBench.indexOf(k);
      if (xiIdx >= 0 && bIdx >= 0) { newXi[xiIdx] = k; newBench[bIdx] = pending; }
    } else {
      const xiIdx = newXi.indexOf(k);
      const bIdx  = newBench.indexOf(pending);
      if (xiIdx >= 0 && bIdx >= 0) { newXi[xiIdx] = pending; newBench[bIdx] = k; }
    }
    setXiKeys(newXi); setBenchKeys(newBench); setPending(null);
  }

  const PlayerCard = ({ k, zone }: { k: string; zone: 'XI'|'BENCH' }) => {
    const p = byKey.get(k);
    if (!p) return null;
    const full = fullNameOf(p);
    const name = shortName(full);
    const g = detectGroup(p) ?? 'MID';
    const selected = pending === k;
    return (
      <button
        key={k}
        onClick={() => onCardClick(k, zone)}
        className="card"
        title={full}
        style={{
          borderRadius: 12,
          border: selected ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.12)',
          background: selected
            ? 'linear-gradient(135deg, rgba(168,85,247,0.26), rgba(99,102,241,0.18))'
            : 'rgba(0,0,0,0.20)',
        }}
      >
        <div className="pc-grid">
          <Jersey code={g} />
          <div className="pc-text">
            <div className="pc-name" title={full}>{name}</div>
          </div>
        </div>
      </button>
    );
  };

  const FormationRow = ({ items }: { items: any[] }) => {
    const cols = Math.max(items.length, 1);
    return (
      <div className="FormationRows" style={{ ['--cols' as any]: cols } as any}>
        {items.map((p, i) =>
          p ? <PlayerCard key={keyOf(p)} k={keyOf(p)} zone="XI" /> : <div key={i} style={{ height: 60 }} />
        )}
      </div>
    );
  };

  return (
    <div className="screen" style={{ overflow: 'hidden' }}>
      <TopBar title="Your Team" onBack={onBack} />
      <div style={{ padding: 12 }}>
        <FormationRow items={roster.xi.filter(p => detectGroup(p) === 'GK')} />
        <FormationRow items={roster.xi.filter(p => detectGroup(p) === 'DEF')} />
        <FormationRow items={roster.xi.filter(p => detectGroup(p) === 'MID')} />
        <FormationRow items={roster.xi.filter(p => detectGroup(p) === 'FWD')} />
      </div>
    </div>
  );
}
