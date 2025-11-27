// src/api.ts

/** ================= Type Definitions (UPDATED) ================= */
export interface Contest {
  id: string
  name: string
  title?: string           // added to match code usage
  type: string
  realm?: string
  open?: boolean
  startAt?: string | null
  endAt?: string | null
  createdAt?: string       // added for Admin page
  active?: boolean         // added for HomeHub and Admin
  entryFee?: number        // added for HomeHub
}

export interface AdminUser {
  id: string
  wallet: string
  role: string
  displayName?: string     // added for Admin page
  createdAt?: string       // added for Admin page
  updatedAt?: string       // added for Admin page
}

export interface LeaderboardEntry {
  id: string
  userId: string
  username?: string
  displayName?: string     // added for Admin/HomeHub usage
  points?: number
  rank?: number
}

/** ================= Base Config ================= */
export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  'https://fst-backend-z7bc.onrender.com'

/** Read / Write Token */
export function getToken() {
  try {
    return localStorage.getItem('auth_token') || ''
  } catch {
    return ''
  }
}

export function setToken(token: string) {
  try {
    if (!token) localStorage.removeItem('auth_token')
    else localStorage.setItem('auth_token', token)
  } catch {}
}

/** Headers builder */
function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers || {})
  const token = getToken()

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  return headers
}

/** Safe request wrapper */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: buildHeaders(init),
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

  throw new Error(message)
}

/** Convenience methods */
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
   AUTH
======================================================= */
export type IntrospectResponse = {
  ok?: boolean
  role?: string
  wallet?: string
  error?: string
}

export async function authVerify(address: string, signature: string, message: string) {
  const res = await api.post<{ ok: boolean; token: string; role: string }>(
    '/auth/verify',
    { address, signature, message }
  )

  if (res.ok && res.token) {
    setToken(res.token)
  }

  return res
}

export function authIntrospect() {
  return api.post<IntrospectResponse>('/auth/introspect')
}

export async function getMe() {
  const res = await authIntrospect()
  if (!res.ok) throw new Error(res.error || 'Unauthorized')

  return { user: { id: res.wallet, role: res.role } }
}

/* =======================================================
   ADMIN REQUESTS
======================================================= */
async function adminRequest<T>(path: string, init: RequestInit = {}) {
  const token = getToken()

  if (!token) throw new Error('Unauthorized: No admin token found')

  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${token}`)

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }

  return request<T>(path, {
    ...init,
    headers,
  })
}

/* Admin endpoints */
export function adminHealth() {
  return adminRequest<{ ok: boolean; status?: string }>('/health')
}

export function listContests() {
  return adminRequest<{ ok?: boolean; contests: Contest[] }>('/admin/contests')
}

export function createContest(data: any) {
  const payload = {
    ...data,
    name: data.name ?? data.title ?? '',
    title: data.title ?? data.name ?? '',
    type: data.type ?? 'general',
    realm: data.realm ?? 'WEEKLY',
    startAt: data.startAt ?? null,
    endAt: data.endAt ?? null,
  }
  return adminRequest<{ ok: boolean; contest: Contest }>('/admin/contests/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function toggleContest(id: string, open: boolean) {
  return adminRequest<{ ok: boolean }>(`/admin/contests/${id}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ open }),
  })
}

export function deleteContest(id: string) {
  return adminRequest<{ ok: boolean }>(`/admin/contests/${id}`, {
    method: 'DELETE',
  })
}

export function listUsers() {
  return adminRequest<{ ok: boolean; users: AdminUser[] }>('/admin/users')
}

export async function getContestLeaderboard(id: string) {
  const res = await adminRequest<{ ok: boolean; leaderboard: LeaderboardEntry[] }>(
    `/admin/contests/${id}/leaderboard`
  )

  const leaderboard = res.leaderboard ?? []
  return { ok: res.ok, leaderboard }
}

/* =======================================================
   USER HISTORY
======================================================= */
export function getUserHistory() {
  return api.get<{ ok: boolean; history: any[] }>('/user/history')
}

/* =======================================================
   CONTEST (JOIN)
======================================================= */
export function joinContest(contestId: string, team?: any) {
  return api.post<{ ok: boolean; created?: boolean }>(
    `/contests/${contestId}/join`,
    team
  )
}

export function startPaidJoin(contestId: string) {
  return api.post<any>(`/contests/${contestId}/join/start`)
}

export function verifyPaidJoin(contestId: string, signature: string) {
  return api.post<any>(`/contests/${contestId}/join/verify`, { signature })
}

/* =======================================================
   FPL PROXIES
======================================================= */
export function fetchBootstrap() {
  return api.get<any>('/fpl/api/bootstrap-static/')
}
export function fetchFixtures() {
  return api.get<any>('/fpl/api/fixtures/')
}
export function fetchElementSummary(id: string | number) {
  return api.get<any>(`/fpl/api/element-summary/${id}/`)
}

/* =======================================================
   LOGOUT
======================================================= */
export function signOut() {
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('sol_wallet')
  } catch {}
}
