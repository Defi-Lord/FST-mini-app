import React, { useState } from 'react'
import TopBar from './components_TopBar'
import { useWallet } from '@solana/wallet-adapter-react'
import { Connection, clusterApiUrl, SystemProgram, Transaction } from '@solana/web3.js'

type Contest = { _id?: string; name: string; entryFee?: number; active?: boolean }
const contests: Contest[] = [
  { name: 'Premier League', entryFee: 0.1, active: true, _id: '6738abf9...' },
  { name: 'Champions League' },
  { name: 'Spanish League' },
  { name: 'Turkish League' },
  { name: 'French League' }
]

export default function JoinContest({ onSelect, onBack }: { onSelect: () => void; onBack: () => void }) {
  const [loading, setLoading] = useState(false)
  const [coming, setComing] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const wallet = useWallet()
  const connection = new Connection(clusterApiUrl('mainnet-beta'))

  const handleJoin = async (contest: Contest) => {
    if (!wallet.publicKey) return alert('Connect your wallet first')
    try {
      setLoading(true)
      const recipient = new window.solanaWeb3.PublicKey(process.env.NEXT_PUBLIC_RECEIVER_WALLET!)
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: recipient,
          lamports: (contest.entryFee ?? 0) * 1e9,
        })
      )

      const sig = await wallet.sendTransaction(tx, connection)
      await connection.confirmTransaction(sig, 'confirmed')

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contests/${contest._id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ txSignature: sig }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage('Successfully joined contest!')
        onSelect()
      } else {
        alert(data.error || 'Join failed')
      }
    } catch (err: any) {
      console.error(err)
      alert('Transaction or join failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen">
      <div className="bg bg-field"/><div className="scrim"/>
      <div className="container">
        <TopBar title="Join Contest" onBack={onBack} />
        <div className="list">
          {contests.map((c, i) => {
            const active = !!c.active
            return (
              <button
                key={i}
                className="row card"
                style={{ textAlign: 'left', opacity: active ? 1 : 0.6 }}
                disabled={loading}
                onClick={() => active ? handleJoin(c) : setComing(c.name)}
              >
                <div style={{ fontWeight: 800 }}>
                  <div>{c.name}</div>
                  <div className="subtle">{active ? `${c.entryFee} SOL entry` : 'League'}</div>
                </div>
                <div style={{ fontWeight: 800 }}>
                  {active ? (loading ? 'Processing...' : 'Enter') : 'Coming soon'}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {message && (
        <div className="modal">
          <div className="modal-card">
            <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Success 🎉</div>
            <div className="subtle" style={{ marginBottom: 14 }}>{message}</div>
            <button className="cta" onClick={() => setMessage(null)}>Okay</button>
          </div>
        </div>
      )}

      {coming && (
        <div className="modal">
          <div className="modal-card">
            <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 8 }}>Coming soon</div>
            <div className="subtle" style={{ marginBottom: 14 }}>
              {coming} contests are not open yet.
            </div>
            <button className="cta" onClick={() => setComing(null)}>Okay</button>
          </div>
        </div>
      )}
    </div>
  )
}
