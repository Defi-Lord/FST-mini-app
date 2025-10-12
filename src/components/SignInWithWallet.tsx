// src/components/SignInWithWallet.tsx
import React from "react";

/** Resolve API base from Vite env (no trailing slash) */
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/+$/, "") || "";

type Phantom = {
  isPhantom?: boolean;
  publicKey?: { toBase58?: () => string; toString?: () => string };
  connect: (opts?: any) => Promise<{ publicKey: { toBase58?: () => string; toString?: () => string } }>;
  disconnect?: () => Promise<void>;
  signMessage?: (msg: Uint8Array, enc?: string) => Promise<{ signature: Uint8Array }>;
};

function toBytes(s: string) {
  return new TextEncoder().encode(s);
}

function base58Encode(bytes: Uint8Array): string {
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  if (!bytes.length) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const input = bytes.slice();
  const digits: number[] = [];
  for (let i = zeros; i < input.length; i++) {
    let carry = input[i];
    for (let j = 0; j < digits.length; j++) {
      const x = digits[j] * 256 + carry;
      digits[j] = Math.floor(x / 58);
      carry = x % 58;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  for (let k = 0; k < zeros; k++) digits.push(0);
  return digits.reverse().map((d) => A[d]).join("");
}

const detectPhantom = (): Phantom | undefined => {
  const w = window as any;
  return w?.solana?.isPhantom
    ? (w.solana as Phantom)
    : w?.phantom?.solana?.isPhantom
    ? (w.phantom.solana as Phantom)
    : undefined;
};

type Status =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "gettingNonce" }
  | { kind: "signing" }
  | { kind: "verifying" }
  | { kind: "success"; userId?: string; token?: string }
  | { kind: "error"; message: string; hint?: string };

export default function SignInWithWallet({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [address, setAddress] = React.useState("");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });

  const connect = React.useCallback(async () => {
    const p = detectPhantom();
    if (!p?.connect) throw new Error("Phantom wallet not found.");
    setStatus({ kind: "connecting" });
    const res = await p.connect({ onlyIfTrusted: false });
    const pkAny: any = res?.publicKey;
    const addr =
      pkAny?.toBase58?.() ?? pkAny?.toString?.() ?? String(pkAny ?? "");
    if (!addr) throw new Error("Could not read wallet address.");
    setAddress(addr);
    return addr;
  }, []);

  const signIn = React.useCallback(async () => {
    try {
      if (!API_BASE) {
        throw new Error(
          "Missing VITE_API_BASE. Set it in Vercel Project → Environment Variables."
        );
      }
      const p = detectPhantom();
      if (!p) throw new Error("Phantom wallet not found.");

      const wallet = address || (await connect());

      // 1) Get nonce + message (sets nonce cookie; also returns message)
      setStatus({ kind: "gettingNonce" });
      const nonceRes = await fetch(
        `${API_BASE}/auth/nonce?wallet=${encodeURIComponent(wallet)}`,
        { method: "GET", credentials: "include" }
      );
      const nonceTxt = await nonceRes.text();
      if (!nonceRes.ok) {
        throw new Error(nonceTxt || `Nonce failed (HTTP ${nonceRes.status})`);
      }
      const { message } = JSON.parse(nonceTxt) as { message: string };
      if (!message) throw new Error("Nonce response missing message.");

      // 2) Sign message
      if (!p.signMessage) {
        throw new Error(
          "Phantom cannot sign messages. Enable Message Signing in Phantom → Settings → Developer."
        );
      }
      setStatus({ kind: "signing" });
      const { signature } = await p.signMessage(toBytes(message), "utf8");
      const sig58 = base58Encode(signature);

      // 3) Verify (server reads nonce from cookie; body includes sig + wallet)
      setStatus({ kind: "verifying" });
      const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: wallet,
          signatureBase58: sig58,
        }),
      });
      const verifyTxt = await verifyRes.text();
      if (!verifyRes.ok) throw new Error(verifyTxt || `HTTP ${verifyRes.status}`);
      const data = JSON.parse(verifyTxt) as {
        ok: boolean;
        token?: string;
        userId?: string;
      };

      if (data.token) {
        try {
          localStorage.setItem("auth_token", data.token);
        } catch {}
      }

      setStatus({ kind: "success", userId: data.userId, token: data.token });
      onSuccess?.();
    } catch (e: any) {
      const msg = e?.message || String(e);
      const hint =
        /nonce/i.test(msg)
          ? "If this is a preview domain, add https://*.vercel.app to CORS_ORIGIN on Render and ensure cookies use SameSite=None; Secure."
          : /Failed to fetch|CORS/i.test(msg)
          ? "Check CORS_ORIGIN on Render to include your exact Vercel domain. Clear Render cache and redeploy."
          : undefined;
      setStatus({ kind: "error", message: msg, hint });
    }
  }, [address, connect, onSuccess]);

  const busy =
    status.kind === "connecting" ||
    status.kind === "gettingNonce" ||
    status.kind === "signing" ||
    status.kind === "verifying";

  return (
    <div style={box}>
      <div style={row}>
        <div style={{ opacity: 0.85, fontSize: 12, marginBottom: 6 }}>
          Wallet
        </div>
        <div style={pill}>
          {address ? address : "No wallet connected"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {!address ? (
          <button style={btnPrimary} disabled={busy} onClick={connect}>
            {status.kind === "connecting" ? "Connecting…" : "Connect Phantom"}
          </button>
        ) : (
          <>
            <button
              style={btnMuted}
              disabled={busy}
              onClick={async () => {
                try {
                  await detectPhantom()?.disconnect?.();
                } catch {}
                setAddress("");
                setStatus({ kind: "idle" });
              }}
            >
              Disconnect
            </button>
            <button style={btnPrimary} disabled={busy} onClick={signIn}>
              {status.kind === "gettingNonce"
                ? "Getting nonce…"
                : status.kind === "signing"
                ? "Signing…"
                : status.kind === "verifying"
                ? "Verifying…"
                : "Sign In"}
            </button>
          </>
        )}
      </div>

      {status.kind === "error" && (
        <div style={errBox}>
          <div>
            <strong>Auth error:</strong> {status.message}
          </div>
          {status.hint && <div style={{ marginTop: 6 }}>{status.hint}</div>}
        </div>
      )}
      {busy && (
        <div style={ghost}>
          Working… ({status.kind})
        </div>
      )}
    </div>
  );
}

/** styles */
const box: React.CSSProperties = {
  marginTop: 8,
  textAlign: "left",
};
const row: React.CSSProperties = {};
const pill: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.22)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  color: "#e7e9ee",
  background: "rgba(255,255,255,.06)",
  wordBreak: "break-all",
};
const btnPrimary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #6b46c1",
  background: "linear-gradient(180deg,#7c3aed,#5b21b6)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
  boxShadow: "0 6px 20px rgba(124,58,237,.35)",
};
const btnMuted: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.25)",
  background: "transparent",
  color: "#e7e9ee",
  cursor: "pointer",
};
const errBox: React.CSSProperties = {
  background: "rgba(255,0,0,0.08)",
  border: "1px solid rgba(255,0,0,0.3)",
  color: "#ffd5d5",
  padding: 10,
  borderRadius: 10,
  marginTop: 12,
};
const ghost: React.CSSProperties = {
  marginTop: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,.2)",
  opacity: 0.8,
};
