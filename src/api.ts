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
  createdAt?: string
  updatedAt?: string
}

export interface LeaderboardEntry {
  id: string
  userId: string
  username?: string
  displayName?: string
  points?: number
  rank?: number
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
    credentials: 'include', // REQUIRED for cookies / CORS
  })

  if (res.ok) {
    if (res.status === 204) return undefined as unknown as T
    return (await res.json()) as T
  }

  let message = `HTTP ${res.status}`
  try {
    const txt = await res.text()
    if (txt) {
      try {
        const j = JSON.parse(txt)
        message = j?.error || txt
      } catch {
        message = txt
      }
    }
  } catch {}

  if (res.status === 401) {
    signOut()
    message = 'Unauthorized: Token invalid or expired'
  }

  throw new Error(message)
}

/** ================= API WRAPPERS ================= */
export const api = {
  get: <T>(p: string, init?: RequestInit) =>
    request<T>(p, { ...(init || {}), method: 'GET' }),

  post: <T>(p: string, body?: unknown, init?: RequestInit) =>
    request<T>(p, {
      ...(init || {}),
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(p: string, body?: unknown, init?: RequestInit) =>
    request<T>(p, {
      ...(init || {}),
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(p: string, init?: RequestInit) =>
    request<T>(p, { ...(init || {}), method: 'DELETE' }),
}

/* =======================================================
   AUTH (✅ MATCHES BACKEND EXACTLY)
======================================================= */

/** ✅ Request challenge */
export async function authChallenge(address: string) {
  if (!address) throw new Error('Wallet address required')

  return api.post<{ ok: boolean; challenge: string }>('/auth/challenge', {
    address,
  })
}

/** ✅ Verify signed challenge */
export async function authVerify(address: string, signature: string) {
  const res = await api.post<{ ok: boolean; token: string }>(
    '/auth/verify',
    {
      address,
      signature,
    }
  )

  if (res?.token) {
    setToken(res.token)
  }

  return res
}

/* =======================================================
   ADMIN
======================================================= */
async function adminRequest<T>(path: string, init: RequestInit = {}) {
  const token = getToken()
  if (!token) throw new Error('Unauthorized: No admin token found')

  const headers = toHeaders(init.headers)
  headers.set('Authorization', `Bearer ${token}`)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return request<T>(path, { ...init, headers })
}

export function adminHealth() {
  return adminRequest<{ ok: boolean }>('/health')
}

export function listContests() {
  return adminRequest<{ ok?: boolean; contests: Contest[] }>('/admin/contests')
}

export function createContest(data: any) {
  return adminRequest('/admin/contests/create', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      name: data.name ?? data.title ?? '',
      title: data.title ?? data.name ?? '',
      type: data.type ?? 'general',
      realm: data.realm ?? 'WEEKLY',
      startAt: data.startAt ?? null,
      endAt: data.endAt ?? null,
    }),
  })
}

export function toggleContest(id: string, open: boolean) {
  return adminRequest(`/admin/contests/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ open }),
  })
}

export function deleteContest(id: string) {
  return adminRequest(`/admin/contests/${id}`, { method: 'DELETE' })
}

export function listUsers() {
  return adminRequest<{ ok: boolean; users: AdminUser[] }>('/admin/users')
}

export async function getContestLeaderboard(id: string) {
  const res = await adminRequest<{ ok: boolean; leaderboard: LeaderboardEntry[] }>(
    `/admin/contests/${id}/leaderboard`
  )
  return { ok: res.ok, leaderboard: res.leaderboard ?? [] }
}

/* =======================================================
   USER
======================================================= */
export function getUserHistory() {
  return api.get<{ ok: boolean; history: any[] }>('/user/history')
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
