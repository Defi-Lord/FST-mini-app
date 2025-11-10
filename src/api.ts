// src/api.ts
export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  'https://fst-backend-z7bc.onrender.com'

export function getToken() {
  try {
    return localStorage.getItem('auth_token') || ''
  } catch {
    return ''
  }
}
export function setToken(token: string) {
  try {
    localStorage.setItem('auth_token', token)
  } catch {}
}
function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers || {})
  const token = getToken()
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Content-Type') && init?.body) headers.set('Content-Type', 'application/json')
  return headers
}
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

export const api = {
  get: <T>(p: string, init?: RequestInit) => request<T>(p, { ...(init || {}), method: 'GET' }),
  post: <T>(p: string, body?: unknown, init?: RequestInit) =>
    request<T>(p, { ...(init || {}), method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: unknown, init?: RequestInit) =>
    request<T>(p, { ...(init || {}), method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(p: string, init?: RequestInit) => request<T>(p, { ...(init || {}), method: 'DELETE' }),
}

/* ================= AUTH ================= */
export type IntrospectResponse = { ok?: boolean; role?: string; wallet?: string; error?: string }

export async function authVerify(address: string, signature: string, message: string) {
  const res = await api.post<{ ok: boolean; token: string; role: string }>('/auth/verify', {
    address,
    signature,
    message,
  })
  if (res.ok && res.token) setToken(res.token)
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

/* ============= Admin ============= */
export function listContests() {
  return api.get<{ contests: Contest[] }>('/admin/contests')
}
export type Contest = {
  id: string
  title?: string
  realm?: string
  entryFee?: number
  active?: boolean
  createdAt?: string
}

/* ============= User History ============= */
export function getUserHistory() {
  return api.get<{ ok: boolean; history: any[] }>('/user/history')
}

/* ============= Contests Join ============= */
export function joinContest(contestId: string, team?: any) {
  return api.post<{ ok: boolean; created?: boolean }>(`/contests/${contestId}/join`, team)
}
export function startPaidJoin(contestId: string) {
  return api.post<{ to: string; amountLamports: number; memo?: string }>(
    `/contests/${contestId}/join/start`
  )
}
export function verifyPaidJoin(contestId: string, signature: string) {
  return api.post<{ ok: boolean; created?: boolean }>(`/contests/${contestId}/join/verify`, {
    signature,
  })
}

/* ============= FPL ============= */
export function fetchBootstrap() {
  return api.get<any>('/fpl/api/bootstrap-static/')
}
export function fetchFixtures() {
  return api.get<any>('/fpl/api/fixtures/')
}
export function fetchElementSummary(id: string | number) {
  return api.get<any>(`/fpl/api/element-summary/${id}/`)
}

/* ============= Utils ============= */
export function signOut() {
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('sol_wallet')
  } catch {}
}
