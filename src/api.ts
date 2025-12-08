// src/api.ts

/** ================= Type Definitions ================= */
export interface Contest {
  id: string
  name: string
  title?: string
  type: string
  realm?: string
  open?: boolean
  startAt?: string | null
  endAt?: string | null
  createdAt?: string
  active?: boolean
  entryFee?: number
}

export interface AdminUser {
  id: string
  wallet: string
  role: string
  displayName?: string
}

export interface LeaderboardEntry {
  id: string
  userId: string
  username?: string
  displayName?: string
  points?: number
  rank?: number
}

/** ✅ FIX: Paid join tx typing (HomeHub errors) */
export type PaidJoinTx = {
  to: string
  amountLamports: number
  memo?: string
  created?: boolean
}

/** ================= Base Config ================= */
export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  'https://fst-backend-z7bc.onrender.com'

/** ================= TOKEN HELPERS ================= */
export function getToken() {
  try {
    return (
      localStorage.getItem('auth_token') ||
      localStorage.getItem('fst_token') ||
      ''
    )
  } catch {
    return ''
  }
}

export function setToken(token: string) {
  try {
    if (!token) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('fst_token')
    } else {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('fst_token', token)
    }
  } catch {}
}

/** ================= HEADER HELPERS ================= */
function toHeaders(initHeaders?: RequestInit['headers']): Headers {
  const headers = new Headers()
  if (!initHeaders) return headers

  if (initHeaders instanceof Headers) {
    initHeaders.forEach((v, k) => headers.set(k, v))
  } else if (Array.isArray(initHeaders)) {
    for (const [k, v] of initHeaders) headers.set(k, v)
  } else {
    for (const k of Object.keys(initHeaders as Record<string, string>)) {
      const v = (initHeaders as Record<string, string>)[k]
      if (v !== undefined) headers.set(k, String(v))
    }
  }
  return headers
}

function buildHeaders(init?: RequestInit): Headers {
  const headers = toHeaders(init?.headers)

  if (!headers.has('Authorization')) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

/** ================= SAFE REQUEST ================= */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = buildHeaders(init)

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (res.ok) {
    if (res.status === 204) return undefined as unknown as T
    return (await res.json()) as T
  }

  let message = `HTTP ${res.status}`
  try {
    const text = await res.text()
    if (text) {
      try {
        const json = JSON.parse(text)
        message = json?.error || text
      } catch {
        message = text
      }
    }
  } catch {}

  if (res.status === 401) {
    signOut()
    message = 'Unauthorized'
  }

  throw new Error(message)
}

/** ================= API WRAPPER ================= */
export const api = {
  get: <T>(p: string) => request<T>(p, { method: 'GET' }),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
}

/* =======================================================
   AUTH
======================================================= */

export type IntrospectResponse = {
  ok?: boolean
  role?: string
  wallet?: string
  error?: string
}

export function authChallenge(address: string) {
  return api.post<{ ok: boolean; challenge: string }>('/auth/challenge', {
    address,
  })
}

export async function authVerify(address: string, signature: string) {
  const res = await api.post<{ ok: boolean; token: string }>('/auth/verify', {
    address,
    signature,
  })

  if (res?.token) setToken(res.token)
  return res
}

export async function authIntrospect(): Promise<IntrospectResponse> {
  try {
    const token = getToken()
    if (!token) return { ok: false }

    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      ok: true,
      wallet: payload.id,
      role: payload.role,
    }
  } catch {
    signOut()
    return { ok: false }
  }
}

export async function getMe(adminOnly = false) {
  const res = await authIntrospect()
  if (!res.ok) throw new Error('Unauthorized')

  if (adminOnly && res.role !== 'ADMIN') {
    signOut()
    throw new Error('Admins only')
  }

  return {
    user: {
      id: res.wallet!,
      role: res.role!,
    },
  }
}

/* =======================================================
   ADMIN ✅ (ALL MISSING EXPORTS ADDED)
======================================================= */
async function adminRequest<T>(path: string, init: RequestInit = {}) {
  const token = getToken()
  if (!token) throw new Error('Unauthorized')

  const headers = toHeaders(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')

  return request<T>(path, { ...init, headers })
}

export function adminHealth() {
  return adminRequest<{ ok: boolean }>('/admin/health')
}

export function listContests() {
  return adminRequest<{ contests: Contest[] }>('/admin/contests')
}

export function createContest(payload: Partial<Contest>) {
  return adminRequest('/admin/contests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function toggleContest(contestId: string, active: boolean) {
  return adminRequest(`/admin/contests/${contestId}`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  })
}

export function deleteContest(contestId: string) {
  return adminRequest(`/admin/contests/${contestId}`, {
    method: 'DELETE',
  })
}

export function listUsers() {
  return adminRequest<{ users: AdminUser[] }>('/admin/users')
}

export function getContestLeaderboard(contestId: string) {
  return adminRequest<{ leaderboard: LeaderboardEntry[] }>(
    `/admin/contests/${contestId}/leaderboard`
  )
}

/* =======================================================
   USER / CONTESTS
======================================================= */
export function joinContest(contestId: string, team?: any) {
  return api.post(`/contests/${contestId}/join`, team)
}

export function startPaidJoin(contestId: string) {
  return api.post<PaidJoinTx>(`/contests/${contestId}/join/start`)
}

export function verifyPaidJoin(contestId: string, signature: string) {
  return api.post<{ created: boolean }>(
    `/contests/${contestId}/join/verify`,
    { signature }
  )
}

/* =======================================================
   FPL
======================================================= */
export function fetchBootstrap() {
  return api.get<any>(`/fpl/api/bootstrap-static/?_=${Date.now()}`)
}

export function fetchFixtures() {
  return api.get<any>(`/fpl/api/fixtures/?_=${Date.now()}`)
}

export function fetchElementSummary(id: string | number) {
  return api.get<any>(`/fpl/api/element-summary/${id}/?_=${Date.now()}`)
}

/* =======================================================
   LOGOUT
======================================================= */
export function signOut() {
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('fst_token')
    localStorage.removeItem('sol_wallet')
  } catch {}
}
