// src/api.ts

/** ================= Type Definitions (UNCHANGED) ================= */
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
/**
 * Read token from any of the storage keys your app or other examples use.
 * This makes the client robust to mismatched key names.
 */
export function getToken() {
  try {
    // try several common keys (backwards/forwards compatibility)
    return (
      localStorage.getItem('auth_token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('fst_jwt') ||
      ''
    )
  } catch {
    return ''
  }
}

/** set token — we write to auth_token (canonical) */
export function setToken(token: string) {
  try {
    if (!token) localStorage.removeItem('auth_token')
    else localStorage.setItem('auth_token', token)
  } catch {}
}

/** ================= ALWAYS BUILD CORRECT HEADERS ================= */
function toHeaders(initHeaders?: RequestInit['headers']): Headers {
  const headers = new Headers()
  if (!initHeaders) return headers

  // handle Headers | Record<string,string> | Array entries
  if (initHeaders instanceof Headers) {
    initHeaders.forEach((v, k) => headers.set(k, v))
  } else if (Array.isArray(initHeaders)) {
    for (const [k, v] of initHeaders) headers.set(k, v)
  } else {
    // assume object
    for (const k of Object.keys(initHeaders as Record<string, string>)) {
      const v = (initHeaders as Record<string, string>)[k]
      if (typeof v !== 'undefined') headers.set(k, v as string)
    }
  }
  return headers
}

function buildHeaders(init?: RequestInit): Headers {
  const headers = toHeaders(init?.headers)

  // if there's already an Authorization header, keep it
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
    // token invalid or expired — clear stored token and help caller handle redirect
    signOut()
    message = 'Unauthorized: Token invalid or expired'
  }

  throw new Error(message)
}

/** ================= CONVENIENCE METHODS ================= */
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

/** LOGIN VERIFY */
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

/** INTROSPECT — will include Authorization automatically using buildHeaders() */
export async function authIntrospect(): Promise<IntrospectResponse> {
  const token = getToken()

  if (!token) {
    return { ok: false, error: 'No auth token found' }
  }

  try {
    // call without manually passing headers; buildHeaders will attach token
    return await api.post<IntrospectResponse>('/auth/introspect')
  } catch (err: any) {
    if (err.message?.includes('Unauthorized')) signOut()
    return { ok: false, error: err.message }
  }
}

/** GET LOGGED-IN USER INFO & OPTIONAL ADMIN CHECK */
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
   ADMIN
======================================================= */
async function adminRequest<T>(path: string, init: RequestInit = {}) {
  const token = getToken()
  if (!token) throw new Error('Unauthorized: No admin token found')

  // merge incoming headers but ensure Authorization present
  const headers = toHeaders(init.headers)
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  return request<T>(path, { ...init, headers })
}

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
  return { ok: res.ok, leaderboard: res.leaderboard ?? [] }
}

/* =======================================================
   USER + FPL
======================================================= */
export function getUserHistory() {
  return api.get<{ ok: boolean; history: any[] }>('/user/history')
}

export function joinContest(contestId: string, team?: any) {
  return api.post<{ ok: boolean; created?: boolean }>(`/contests/${contestId}/join`, team)
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
