import React from 'react';
import { listContests, createContest as createContestAPI, toggleContest as toggleContestAPI, deleteContest as deleteContestAPI, Contest as APIContest } from '../api';

export default function AdminContests() {
  const [list, setList] = React.useState<APIContest[]>([]);
  const [title, setTitle] = React.useState('');
  const [realm, setRealm] = React.useState('FREE');
  const [entryFee, setEntryFee] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setErr(null);
    try {
      const data = await listContests();
      setList(data.contests || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const createContest = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await createContestAPI({ title, realm, entryFee: Number(entryFee) });
      setTitle('');
      setEntryFee(0);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    setErr(null);
    try {
      await toggleContestAPI(id, active);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this contest?')) return;
    setErr(null);
    try {
      await deleteContestAPI(id);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  };

  return (
    <div style={{ maxWidth: 680, margin: '20px auto', padding: 16 }}>
      <h2>Admin · Contests</h2>
      {err && <p style={{ color: 'crimson' }}>{err}</p>}

      <div style={{ display: 'grid', gap: 8, border: '1px solid #ddd', padding: 12, borderRadius: 8 }}>
        <input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <select value={realm} onChange={e => setRealm(e.target.value)}>
          <option>FREE</option>
          <option>WEEKLY</option>
          <option>MONTHLY</option>
          <option>SEASONAL</option>
        </select>
        <input
          type="number"
          placeholder="Entry fee (lamports or integer)"
          value={entryFee}
          onChange={e => setEntryFee(Number(e.target.value))}
        />
        <button disabled={busy || !title} onClick={createContest}>
          {busy ? 'Creating…' : 'Create contest'}
        </button>
      </div>

      <h3 style={{ marginTop: 20 }}>Existing</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {list.map(c => (
          <div key={c.id} style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
            <div><b>{c.title ?? c.name}</b></div>
            <div>Realm: {c.realm ?? c.type} · Fee: {c.entryFee ?? 0} · Active: {String(c.active ?? false)}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => toggleActive(c.id, !(c.active ?? false))}>
                {(c.active ?? false) ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => remove(c.id)} style={{ color: 'crimson' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {!list.length && <p style={{ opacity: 0.6 }}>No contests yet.</p>}
      </div>
    </div>
  );
}
