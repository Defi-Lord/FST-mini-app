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
      localStorage.getItem('auth_token') ||     // main key
      localStorage.getItem('authToken') ||
      localStorage.getItem('fst_jwt') ||
      ''
    )
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

/** ================= Header Builders ================= */
function toHeaders(raw?: RequestInit['headers']): Headers {
  const headers = new Headers()
  if (!raw) return headers

  if (raw instanceof Headers) {
    raw.forEach((v, k) => headers.set(k, v))
  } else if (Array.isArray(raw)) {
    for (const [k, v] of raw) headers.set(k, v)
  } else {
    for (const k in raw as Record<string, string>) {
      const v = (raw as Record<string, string>)[k]
      if (v !== undefined) headers.set(k, v)
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

/** ================= SAFE REQUEST WRAPPER ================= */

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

  // parse error
  let msg = `HTTP ${res.status}`
  try {
    const text = await res.text()
    if (text) {
      try {
        const json = JSON.parse(text)
        msg = json.error || text
      } catch {
        msg = text
      }
    }
  } catch {}

  if (res.status === 401) {
    signOut()
    msg = 'Unauthorized: Token invalid or expired'
  }

  throw new Error(msg)
}

/** ================= SIMPLE API WRAPPERS ================= */
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

export async function authVerify(walletAddress: string, signature: string, message?: string) {
  const res = await api.post<{ success: boolean; token: string; role: string }>(
    '/auth/verify',
    { walletAddress, signature, message }
  )

  if (res.success && res.token) setToken(res.token)

  return res
}

export async function authIntrospect(): Promise<IntrospectResponse> {
  const token = getToken()
  if (!token) return { ok: false, error: 'No auth token found' }

  try {
    return await api.post<IntrospectResponse>('/auth/introspect')
  } catch (err: any) {
    if (err.message?.includes('Unauthorized')) signOut()
    return { ok: false, error: err.message }
  }
}

export async function getMe(adminOnly = false) {
  const res = await authIntrospect()
  if (!res.ok) throw new Error(res.error || 'Unauthorized')

  if (adminOnly && res.role !== 'ADMIN') {
    signOut()
    throw new Error('Access denied: Admins only')
  }

  return { user: { id: res.wallet!, role: res.role! } }
}

/* =======================================================
   ADMIN (exact backend routes)
======================================================= */

async function adminRequest<T>(path: string, init: RequestInit = {}) {
  const token = getToken()
  if (!token) throw new Error('Unauthorized: No admin token found')

  const headers = toHeaders(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')

  return request<T>(path, { ...init, headers })
}

/** DASHBOARD */
export function adminSummary() {
  return adminRequest<{ ok: boolean; summary?: any }>('/admin/dashboard/summary')
}

/** CONTESTS */
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

  return adminRequest<{ ok: boolean; contest: Contest }>(
    '/admin/contests/create',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  )
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

export function getContestLeaderboard(id: string) {
  return adminRequest<{ ok: boolean; leaderboard: LeaderboardEntry[] }>(
    `/admin/contests/${id}/leaderboard`
  )
}

export function getContestParticipants(id: string) {
  return adminRequest(`/admin/contests/${id}/participants`)
}

/** PRIZE POOL */
export function updatePrizePool(id: string, prizePoolCents: number, payouts: any[]) {
  return adminRequest(`/admin/contests/${id}/prize`, {
    method: 'POST',
    body: JSON.stringify({ prizePoolCents, payouts }),
  })
}

/** USERS */
export function listUsers() {
  return adminRequest<{ ok: boolean; users: AdminUser[] }>('/admin/users')
}

/** AUDIT LOG */
export function adminActions(page = 1) {
  return adminRequest(`/admin/actions?page=${page}`)
}

/* =======================================================
   USER + FPL
======================================================= */

export function getUserHistory() {
  return api.get<{ ok: boolean; history: any[] }>('/user/history')
}

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
    localStorage.removeItem('authToken')
    localStorage.removeItem('fst_jwt')
    localStorage.removeItem('sol_wallet')
  } catch {}
}
