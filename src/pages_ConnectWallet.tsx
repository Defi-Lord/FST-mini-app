// src/pages_ConnectWallet.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { FC } from 'react'
import { API_BASE as API_BASE_CONFIG, setToken } from '../api' // keep path as requested

type Props = {
  onBack?: () => void
  onConnected: (address: string) => void
}

const SIGN_ON_CONNECT = true

declare global {
  interface Window {
    solana?: any
    phantom?: { solana?: any }
    backpack?: any
    solflare?: any
    exodus?: { solana?: any }
    wallets?: { get(): any[] }
  }
}

type WalletId = 'phantom' | 'backpack' | 'solflare' | 'exodus' | 'other'

type WalletItem = {
  id: WalletId
  name: string
  icon: React.ReactNode
  installed: boolean
  connect: (opts?: any) => Promise<{ address: string; provider?: any }>
  installUrl?: string
  on?: ((ev: string, fn: (...args: any[]) => void) => void) | undefined
  off?: ((ev: string, fn: (...args: any[]) => void) => void) | undefined
}

const safeGetSaved = (): string | null => {
  try {
    return localStorage.getItem('sol_wallet')
  } catch {
    return null
  }
}

const safeSetSaved = (addr: string | null) => {
  try {
    if (!addr) localStorage.removeItem('sol_wallet')
    else localStorage.setItem('sol_wallet', addr)
  } catch {}
}

function toB58(pk: any): string | null {
  try {
    if (!pk) return null
    return pk?.toBase58?.() ?? pk?.toString?.() ?? null
  } catch {
    return null
  }
}

function u8ToBase64(u8: Uint8Array) {
  let binary = ''
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i])
  return btoa(binary)
}

const isiOS = () => (typeof navigator !== 'undefined' ? /iPhone|iPad|iPod/i.test(navigator.userAgent) : false)
const isPhantomInApp = () => typeof window !== 'undefined' && !!(window.solana && (window.solana.isPhantom || window.phantom?.solana))
const phantomBrowseLink = () => {
  const url = typeof window !== 'undefined' ? window.location.href : ''
  return `https://phantom.app/ul/browse/${encodeURIComponent(url)}`
}

// Backend calls
async function fetchNonce(walletAddress: string) {
  const res = await fetch(`${API_BASE_CONFIG}/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  })
  if (!res.ok) throw new Error(`Nonce error: ${res.status}`)
  return res.json() as Promise<{ nonce: string; message: string }>
}

async function verifySignature(payload: { walletAddress: string; nonce: string; signature: string }) {
  const res = await fetch(`${API_BASE_CONFIG}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let err = ''
    try {
      err = (await res.json()).error
    } catch {}
    throw new Error(`Verify failed: ${res.status} ${err}`)
  }
  return res.json() as Promise<{ token: string }>
}

async function signAndVerify(provider: any, walletAddress: string) {
  const { nonce, message } = await fetchNonce(walletAddress)

  const enc = new TextEncoder()
  if (!provider?.signMessage) throw new Error('Wallet cannot sign messages')

  const signed = await provider.signMessage(enc.encode(message), 'utf8').catch(async () => {
    return await provider.signMessage(enc.encode(message)).catch(err => { throw err })
  })

  let signatureBase64: string | null = null

  if (!signed) throw new Error('Empty signature from wallet')

  if (typeof signed === 'string') signatureBase64 = signed
  else if (signed instanceof Uint8Array) signatureBase64 = u8ToBase64(signed)
  else if (typeof signed === 'object') {
    const sig = signed.signature ?? signed.sig ?? signed?.data
    if (!sig) signatureBase64 = u8ToBase64(new Uint8Array(signed as any))
    else if (typeof sig === 'string') signatureBase64 = sig
    else signatureBase64 = u8ToBase64(new Uint8Array(sig))
  } else signatureBase64 = u8ToBase64(new Uint8Array(signed as any))

  if (!signatureBase64) throw new Error('Failed to obtain normalized signature')

  const { token } = await verifySignature({ walletAddress, nonce, signature: signatureBase64 })
  setToken(token)
  return token
}

const ConnectWallet: FC<Props> = ({ onBack, onConnected }) => {
  const [error, setError] = useState<string | null>(null)
  const [connectingId, setConnectingId] = useState<WalletId | null>(null)
  const [detectedNote, setDetectedNote] = useState<string | null>(null)

  const [connectedAddr, setConnectedAddr] = useState<string | null>(safeGetSaved())
  const [connectedId, setConnectedId] = useState<WalletId | null>(null)
  const currentProviderRef = useRef<any>(null)
  const [status, setStatus] = useState<string>('')

  const didAuto = useRef(false)
  const listenersRef = useRef<{ [k: string]: (...args: any[]) => void }>({})

  const providers = useMemo<WalletItem[]>(() => {
    if (typeof window === 'undefined') return []

    const list: WalletItem[] = []

    // Phantom
    const phantom = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null)
    list.push({
      id: 'phantom',
      name: 'Phantom',
      installed: !!phantom,
      icon: <IconPhantom />,
      installUrl: 'https://phantom.app/download',
      on: phantom?.on?.bind(phantom),
      off: phantom?.off?.bind(phantom),
      connect: async (opts?: any) => {
        const prov = window.phantom?.solana || window.solana
        if (!prov) throw new Error('Phantom not found')
        const res = await prov.connect(opts)
        const addr = toB58(res?.publicKey) || toB58(prov?.publicKey)
        if (!addr) throw new Error('No public key from Phantom')
        return { address: addr, provider: prov }
      },
    })

    // Backpack
    const backpack = window.backpack
    list.push({
      id: 'backpack',
      name: 'Backpack',
      installed: !!backpack,
      icon: <IconBackpack />,
      installUrl: 'https://www.backpack.app/download',
      on: backpack?.on?.bind(backpack),
      off: backpack?.off?.bind(backpack),
      connect: async (opts?: any) => {
        const prov = window.backpack
        if (!prov) throw new Error('Backpack not found')
        const res = await prov.connect(opts)
        const addr = toB58(res?.publicKey) || toB58(prov?.publicKey)
        if (!addr) throw new Error('No public key from Backpack')
        return { address: addr, provider: prov }
      },
    })

    // Solflare
    const solflare = window.solflare
    list.push({
      id: 'solflare',
      name: 'Solflare',
      installed: !!solflare,
      icon: <IconSolflare />,
      installUrl: 'https://solflare.com/download',
      on: solflare?.on?.bind(solflare),
      off: solflare?.off?.bind(solflare),
      connect: async (opts?: any) => {
        const prov = window.solflare
        if (!prov) throw new Error('Solflare not found')
        const res = await prov.connect(opts)
        const addr = toB58(res?.publicKey) || toB58(prov?.publicKey)
        if (!addr) throw new Error('No public key from Solflare')
        return { address: addr, provider: prov }
      },
    })

    // Exodus
    const exodus = window.exodus?.solana
    list.push({
      id: 'exodus',
      name: 'Exodus',
      installed: !!exodus,
      icon: <IconExodus />,
      installUrl: 'https://www.exodus.com/download/',
      on: exodus?.on?.bind(exodus),
      off: exodus?.off?.bind(exodus),
      connect: async (opts?: any) => {
        const prov = window.exodus?.solana
        if (!prov) throw new Error('Exodus not found')
        const res = await prov.connect(opts)
        const addr = toB58(res?.publicKey) || toB58(prov?.publicKey)
        if (!addr) throw new Error('No public key from Exodus')
        return { address: addr, provider: prov }
      },
    })

    // Wallet Standard “other”
    try {
      const std = window.wallets?.get?.() || []
      const other = std.find((w: any) =>
        !['phantom', 'backpack', 'solflare', 'exodus'].some(k => (w.name || '').toLowerCase().includes(k))
      )
      if (other) {
        list.push({
          id: 'other',
          name: other.name || 'Solana Wallet',
          installed: true,
          icon: <IconGeneric />,
          on: other?.on?.bind(other),
          off: other?.off?.bind(other),
          connect: async (opts?: any) => {
            const r = await (other as any).connect(opts)
            const addr = toB58(r?.publicKey) || toB58((other as any)?.publicKey)
            if (!addr) throw new Error('No public key from wallet')
            return { address: addr, provider: other }
          },
        })
      }
    } catch {}

    return list
  }, [])

  useEffect(() => {
    const installed = providers.filter(p => p.installed).map(p => p.name)
    setDetectedNote(installed.length ? `Detected: ${installed.join(' • ')}` : 'No wallet detected yet on this device.')
  }, [providers])

  const attachProviderEvents = (prov: any, walletId: WalletId) => {
    detachProviderEvents()
    currentProviderRef.current = prov

    const onAccount = (pk: any) => {
      const addr = toB58(pk)
      if (!addr) {
        setToken('')
        safeSetSaved(null)
        setConnectedAddr(null)
        setConnectedId(null)
        return
      }
      safeSetSaved(addr)
      setConnectedAddr(addr)
      setConnectedId(walletId)
      onConnected(addr)
    }
    const onDisconnect = () => {
      setToken('')
      safeSetSaved(null)
      setConnectedAddr(null)
      setConnectedId(null)
    }
    const onConnect = (args?: any) => {
      const addr = toB58(args?.publicKey) || toB58(prov?.publicKey)
      if (addr) {
        safeSetSaved(addr)
        setConnectedAddr(addr)
        setConnectedId(walletId)
        onConnected(addr)
      }
    }

    listenersRef.current = { onAccount, onDisconnect, onConnect }
    prov?.on?.('accountChanged', onAccount)
    prov?.on?.('disconnect', onDisconnect)
    prov?.on?.('connect', onConnect)
  }

  const detachProviderEvents = () => {
    const prov = currentProviderRef.current
    if (!prov) return
    try {
      const L = listenersRef.current
      prov?.off?.('accountChanged', L.onAccount)
      prov?.off?.('disconnect', L.onDisconnect)
      prov?.off?.('connect', L.onConnect)
    } catch {}
    listenersRef.current = {}
    currentProviderRef.current = null
  }

  useEffect(() => {
    if (didAuto.current) return
    didAuto.current = true

    const saved = safeGetSaved()
    if (saved) {
      setConnectedAddr(saved)
      onConnected(saved)
    }

    ;(async () => {
      for (const w of providers) {
        if (!w.installed) continue
        try {
          const { address, provider } = await w.connect({ onlyIfTrusted: true })
          if (address) {
            attachProviderEvents(provider, w.id)
            safeSetSaved(address)
            setConnectedAddr(address)
            setConnectedId(w.id)
            if (SIGN_ON_CONNECT) {
              try {
                setStatus('Refreshing session…')
                await signAndVerify(provider, address)
              } catch {}
              finally { setStatus('') }
            }
            onConnected(address)
            return
          }
        } catch {}
      }
    })()
  }, [providers])

  const onPick = async (w: WalletItem) => {
    setError(null)
    setConnectingId(w.id)
    setStatus('')
    try {
      if (w.id === 'phantom' && isiOS() && !isPhantomInApp()) {
        window.location.href = phantomBrowseLink()
        return
      }

      if (!w.installed) {
        if (w.installUrl) window.open(w.installUrl, '_blank', 'noopener,noreferrer')
        setError(`${w.name} is not installed on this device.`)
        return
      }

      setStatus(`Connecting ${w.name}…`)
      const { address, provider } = await w.connect()
      if (!address || address.length < 32 || address.length > 60) throw new Error('Invalid address returned')

      if (SIGN_ON_CONNECT) {
        setStatus('Verifying ownership…')
        try { await signAndVerify(provider, address) }
        catch (e: any) { throw new Error(e?.message || 'Signature was rejected') }
      } else setToken('')

      attachProviderEvents(provider, w.id)
      safeSetSaved(address)
      setConnectedAddr(address)
      setConnectedId(w.id)
      setStatus('Connected!')
      onConnected(address)
    } catch (e: any) {
      setError(e?.message || `Failed to connect with ${w.name}`)
    } finally {
      setConnectingId(null)
      setTimeout(() => setStatus(''), 1200)
    }
  }

  const onDisconnectClick = async () => {
    try { await currentProviderRef.current?.disconnect?.() } catch {}
    detachProviderEvents()
    setToken('')
    safeSetSaved(null)
    setConnectedAddr(null)
    setConnectedId(null)
  }

  return (
    <div className="screen">
      <Style />
      <div className="cw-wrap">
        <div className="cw-top">
          {onBack && <button className="cw-back" onClick={onBack} aria-label="Back">←</button>}
          <h2 className="cw-title">Connect Wallet</h2>
          <div style={{ width: 36 }} />
        </div>

        <div className="cw-card cw-hero">
          <h1>Connect your Solana wallet</h1>
          <p>Securely link your wallet to join contests, receive rewards, and save your progress.</p>
          <div className="cw-bullets">
            <div>✓ Non-custodial — you keep your keys</div>
            <div>✓ Works with Phantom, Backpack, Solflare, Exodus</div>
            <div>✓ One-tap reconnect next time</div>
          </div>

          {connectedAddr && (
            <div className="cw-connected">
              <div className="addr-tag">
                Connected as <strong>{connectedAddr.slice(0, 6)}…{connectedAddr.slice(-4)}</strong>
              </div>
              <div className="connected-actions">
                <button onClick={() => navigator.clipboard?.writeText(connectedAddr)}>Copy Address</button>
                <button onClick={onDisconnectClick}>Disconnect</button>
              </div>
            </div>
          )}
        </div>

        {isiOS() && !isPhantomInApp() && (
          <div className="cw-card" style={{ margin: '8px 0', textAlign: 'center' }}>
            <p style={{ margin: 0, opacity: 0.9 }}>On iPhone, connecting works best inside the Phantom app.</p>
            <a href={phantomBrowseLink()} className="btn" style={{ display: 'inline-block', marginTop: 8, padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)' }}>Open this page in Phantom</a>
          </div>
        )}

        {detectedNote && <div className="cw-note subtle">{detectedNote}</div>}

        <div className="cw-grid">
          {providers.map(w => (
            <button key={w.id} className={`cw-wallet ${w.installed ? 'is-live' : 'is-ghost'} ${connectingId === w.id ? 'is-loading' : ''}`} onClick={() => onPick(w)}>
              <span className="cw-icon">{w.icon}</span>
              <span className="cw-meta">
                <span className="cw-name">{w.name}</span>
                <span className="cw-sub">{w.installed ? 'Connect' : 'Get'}</span>
              </span>
              <span className="cw-chevron">→</span>
            </button>
          ))}
        </div>

        {status && <div className="cw-note subtle">{status}</div>}
        {error && <div className="cw-error">{error}</div>}

        <div className="cw-secure subtle">
          We store only your public wallet address. We never request your seed phrase or private key.
        </div>
      </div>
    </div>
  )
}

export default ConnectWallet
