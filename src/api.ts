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
  "https://fst-backend-z7bc.onrender.com"

/** ================= TOKEN HELPERS ================= */
/**
 * getToken() now checks multiple possible localStorage keys for the JWT
 * to remain compatible with different parts of your app (fst_jwt, auth_token).
 */
export function getToken() {
  try {
    // priority: auth_token (legacy in some places) -> fst_jwt (ConnectWallet) -> null
    const a = localStorage.getItem("auth_token")
    if (a && a.trim()) return a
    const b = localStorage.getItem("fst_jwt")
    if (b && b.trim()) return b
    return ""
  } catch {
    return ""
  }
}

/**
 * setToken() writes the token to both keys so other modules expecting either key stay working.
 */
export function setToken(token: string) {
  try {
    if (!token) {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("fst_jwt")
    } else {
      localStorage.setItem("auth_token", token)
      localStorage.setItem("fst_jwt", token)
    }
  } catch {}
}

/** ================= ALWAYS BUILD HEADERS ================= */
function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers()

  if (init?.headers) {
    const incoming = new Headers(init.headers)
    incoming.forEach((v, k) => headers.set(k, v))
  }

  // only add Authorization if not already present
  if (!headers.has("Authorization")) {
    const token = getToken()
    if (token) headers.set("Authorization", `Bearer ${token}`)
  }

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  return headers
}

/** ================= SAFE REQUEST WRAPPER ================= */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = buildHeaders(init)

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
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
    message = "Unauthorized: Token invalid or expired"
  }

  throw new Error(message)
}

/** ================= API SHORTCUTS ================= */
export const api = {
  get: <T>(p: string, init?: RequestInit) =>
    request<T>(p, { ...(init || {}), method: "GET" }),

  post: <T>(p: string, body?: unknown, init?: RequestInit) =>
    request<T>(p, {
      ...(init || {}),
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(p: string, body?: unknown, init?: RequestInit) =>
    request<T>(p, {
      ...(init || {}),
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(p: string, init?: RequestInit) =>
    request<T>(p, { ...(init || {}), method: "DELETE" }),
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
    "/auth/verify",
    { address, signature, message }
  )

  if (res.ok && res.token) {
    setToken(res.token)
  }

  return res
}

/** INTROSPECT — always send token */
export async function authIntrospect(): Promise<IntrospectResponse> {
  const token = getToken()

  if (!token) return { ok: false, error: "No auth token found" }

  try {
    return await api.post<IntrospectResponse>(
      "/auth/introspect",
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
  } catch (err: any) {
    if (err.message.includes("Unauthorized")) signOut()
    return { ok: false, error: err.message }
  }
}

export async function getMe(adminOnly = false) {
  const res = await authIntrospect()
  if (!res.ok) throw new Error(res.error || "Unauthorized")

  if (adminOnly && res.role !== "ADMIN") {
    signOut()
    throw new Error("Access denied: Admins only")
  }

  return { user: { id: res.wallet!, role: res.role! } }
}

/** =======================================================
    ADMIN REQUEST (FIXED — NO MORE 401)
======================================================= */
async function adminRequest<T>(path: string, init: RequestInit = {}) {
  const token = getToken()
  if (!token) throw new Error("Unauthorized: No admin token found")

  return request<T>(path, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  })
}

export function adminHealth() {
  return adminRequest<{ ok: boolean; status?: string }>("/health")
}

export function listContests() {
  return adminRequest<{ ok?: boolean; contests: Contest[] }>("/admin/contests")
}

export function createContest(data: any) {
  const payload = {
    ...data,
    name: data.name ?? data.title ?? "",
    title: data.title ?? data.name ?? "",
    type: data.type ?? "general",
    realm: data.realm ?? "WEEKLY",
    startAt: data.startAt ?? null,
    endAt: data.endAt ?? null,
  }

  return adminRequest<{ ok: boolean; contest: Contest }>("/admin/contests/create", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function toggleContest(id: string, open: boolean) {
  return adminRequest<{ ok: boolean }>(`/admin/contests/${id}/toggle`, {
    method: "PATCH",
    body: JSON.stringify({ open }),
  })
}

export function deleteContest(id: string) {
  return adminRequest<{ ok: boolean }>(`/admin/contests/${id}`, {
    method: "DELETE",
  })
}

export function listUsers() {
  return adminRequest<{ ok: boolean; users: AdminUser[] }>("/admin/users")
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
  return api.get<{ ok: boolean; history: any[] }>("/user/history")
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
  return api.get<any>("/fpl/api/bootstrap-static/")
}

export function fetchFixtures() {
  return api.get<any>("/fpl/api/fixtures/")
}

export function fetchElementSummary(id: string | number) {
  return api.get<any>(`/fpl/api/element-summary/${id}/`)
}

/* =======================================================
   LOGOUT
======================================================= */
export function signOut() {
  try {
    // remove both keys for compatibility
    localStorage.removeItem("auth_token")
    localStorage.removeItem("fst_jwt")
    localStorage.removeItem("sol_wallet")
  } catch {}
}
