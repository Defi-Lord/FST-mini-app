// src/components/SignInWithWallet.tsx
import React from "react";

/** Resolve API base from Vite env */
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/+$/, "") || "";

/** Helpers */
const toBytes = (s: string) => new TextEncoder().encode(s);
function base58Encode(bytes: Uint8Array): string {
  const A =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
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

/** Phantom provider (subset) */
type Phantom = {
  isPhantom?: boolean;
  publicKey?: { toBase58?: () => string; toString?: () => string };
  connect: (opts?: any) => Promise<{ publicKey: any }>;
  disconnect?: () => Promise<void>;
  signMessage?: (
    message: Uint8Array,
    display?: string
  ) => Promise<{ signature: Uint8Array }>;
};

function detectPhantom(): Phantom | undefined {
  const w = window as any;
  return w?.solana?.isPhantom
    ? (w.solana as Phantom)
    : w?.phantom?.solana?.isPhantom
    ? (w.phantom.solana as Phantom)
    : undefined;
}

type Status =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "gettingNonce" }
  | { kind: "signing" }
  | { kind: "verifying" }
  | { kind: "error"; message: string; hint?: string }
  | { kind: "ok"; address: string };

export default function SignInWithWallet({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [addr, setAddr] = React.useState("");
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });

  const connect = React.useCallback(async (): Promise<string> => {
    const phantom = detectPhantom();
    if (!phantom) {
      throw Object.assign(new Error("Phantom wallet not detected."), {
        hint: "Install Phantom and refresh the page.",
      });
    }
    setStatus({ kind: "connecting" });
    const res = await phantom.connect({ onlyIfTrusted: false });
    const pk: any = res?.publicKey;
    const base58 =
      pk?.toBase58?.() ??
      pk?.toString?.() ??
      (() => {
        throw new Error("Could not read wallet address.");
      })();
    setAddr(base58);
    return base58;
  }, []);

  const signIn = React.useCallback(async () => {
    try {
      if (!API_BASE) {
        throw Object.assign(
          new Error(
            "Missing VITE_API_BASE. Set it in Vercel env and redeploy."
          ),
          { hint: "VITE_API_BASE=https://fst-api.onrender.com" }
        );
      }
      const wallet = addr || (await connect());

      // 1) Get nonce message (cookie-based on server)
      setStatus({ kind: "gettingNonce" });
      const nRes = await fetch(
        `${API_BASE}/auth/nonce?wallet=${encodeURIComponent(wallet)}`,
        { method: "GET", credentials: "include" }
      );
      if (!nRes.ok) {
        const txt = await nRes.text();
        throw Object.assign(
          new Error(`Nonce failed (${nRes.status})`),
          { hint: txt || "Check CORS_ORIGIN and cookies on the API." }
        );
      }
      const { message } = (await nRes.json()) as { message: string };
      if (!message) {
        throw new Error("Nonce response missing 'message'.");
      }

      // 2) Sign the exact message
      const phantom = detectPhantom();
      if (!phantom?.signMessage) {
        throw Object.assign(
          new Error("Phantom signMessage unavailable."),
          {
            hint:
              "Enable Message Signing: Phantom → Settings → Developer → Message Signing.",
          }
        );
      }
      setStatus({ kind: "signing" });
      const { signature } = await phantom.signMessage(toBytes(message), "utf8");
      const signatureBase58 = base58Encode(signature);

      // 3) Verify
      setStatus({ kind: "verifying" });
      const vRes = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: wallet,
          signatureBase58,
          // (Optional) if your API supports it, pass the message back:
          // message,
        }),
      });
      const vText = await vRes.text();
      if (!vRes.ok) {
        throw Object.assign(
          new Error(`Verify failed (${vRes.status})`),
          {
            hint:
              vText ||
              "If it says 'Missing nonce cookie', allow your Vercel domain in CORS_ORIGIN and set cookies with SameSite=None; Secure.",
          }
        );
      }
      // If API returns a token, store it for programmatic calls:
      try {
        const data = JSON.parse(vText) as { token?: string };
        if (data?.token) localStorage.setItem("auth_token", data.token);
      } catch {
        /* ignore */
      }

      setStatus({ kind: "ok", address: wallet });
      // navigate the app after a short tick
      setTimeout(() => {
        onSuccess?.();
        try {
          window.location.assign("/home");
        } catch {}
      }, 250);
    } catch (e: any) {
      setStatus({
        kind: "error",
        message: e?.message || String(e),
        hint: e?.hint,
      });
    }
  }, [addr, connect]);

  const busy =
    status.kind === "connecting" ||
    status.kind === "gettingNonce" ||
    status.kind === "signing" ||
    status.kind === "verifying";

  return (
    <div className="signin-wrap">
      <style>{css}</style>
      <div className="card">
        <div className="logo">FST</div>
        <h1>Sign in with Solana</h1>
        <p className="sub">Secure sign in using your Phantom wallet.</p>

        <div className="pill">
          <div className="label">Wallet</div>
          <div className="value">
            {addr ? addr : "Not connected"}
          </div>
        </div>

        <div className="row">
          {!addr ? (
            <button className="btn muted" onClick={connect} disabled={busy}>
              {status.kind === "connecting" ? "Connecting…" : "Connect Phantom"}
            </button>
          ) : (
            <button className="btn primary" onClick={signIn} disabled={busy}>
              {status.kind === "gettingNonce"
                ? "Getting nonce…"
                : status.kind === "signing"
                ? "Signing…"
                : status.kind === "verifying"
                ? "Verifying…"
                : "Sign In"}
            </button>
          )}
        </div>

        {status.kind === "error" && (
          <div className="alert">
            <div><strong>Auth error:</strong> {status.message}</div>
            {status.hint && <div className="hint">{status.hint}</div>}
          </div>
        )}

        <div className="note">
          Tip: If you don’t see the wallet popup, click the Phantom icon in your browser toolbar.
        </div>
      </div>

      <div className="bg" />
    </div>
  );
}

const css = String.raw`
.signin-wrap { min-height:100dvh; display:grid; place-items:center; position:relative; overflow:hidden; background:#0b1020; }
.bg { position:absolute; inset:-20%; background:
  radial-gradient(60% 40% at 20% 10%, rgba(124,58,237,.25), transparent 60%),
  radial-gradient(50% 40% at 80% 20%, rgba(236,72,153,.25), transparent 60%),
  radial-gradient(40% 30% at 40% 80%, rgba(16,185,129,.25), transparent 60%);
  filter: blur(80px);
}
.card { position:relative; z-index:1; width:min(92vw, 520px); color:#e7e9ee;
  background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14);
  border-radius:16px; padding:28px; box-shadow:0 10px 50px rgba(0,0,0,.35); text-align:center; backdrop-filter: blur(8px);
}
.logo { width:56px; height:56px; border-radius:14px; margin:0 auto 12px; display:grid; place-items:center;
  background: linear-gradient(135deg, #7c3aed, #ec4899); color:#fff; font-weight:900; letter-spacing:.5px; }
h1 { margin:6px 0 4px; font-size:22px; font-weight:900; }
.sub { margin:0 0 16px; opacity:.8; }
.pill { margin:8px 0 16px; border:1px dashed rgba(231,233,238,.25); border-radius:12px; padding:10px 12px; text-align:left; }
.pill .label { font-size:12px; opacity:.75; }
.pill .value { word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
.row { display:flex; gap:12px; justify-content:center; margin-top:8px; }
.btn { appearance:none; border:none; padding:12px 14px; border-radius:12px; cursor:pointer; font-weight:800; }
.btn.primary { border:1px solid #6b46c1; background:linear-gradient(180deg,#7c3aed,#5b21b6); color:#fff; box-shadow:0 6px 20px rgba(124,58,237,.35); }
.btn.muted { border:1px solid rgba(255,255,255,.25); background:transparent; color:#e7e9ee; }
.alert { border:1px solid rgba(255,0,0,.35); background:rgba(255,0,0,.08); color:#ffd5d5; border-radius:10px; padding:10px; margin:12px 0 0; text-align:left; }
.alert .hint { opacity:.9; margin-top:6px; font-size:12px; }
.note { margin-top:10px; opacity:.8; font-size:12px; }
`;
