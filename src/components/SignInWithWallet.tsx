// src/components/SignInWithWallet.tsx
import React, { useCallback, useState } from "react";
import { useWallet, WalletNotSelectedError } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const API_BASE = import.meta.env.VITE_API_BASE || "https://fst-backend-z7bc.onrender.com";

type Props = {
  onConnected?: (address: string) => void;
};

export default function SignInWithWallet({ onConnected }: Props) {
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // wait until wallet.connected becomes true or timeout (ms)
  const waitForConnected = async (timeoutMs = 10000) => {
    const start = Date.now();
    if (wallet.connected) return true;
    return new Promise<boolean>((resolve, reject) => {
      const interval = setInterval(() => {
        if (wallet.connected) {
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          resolve(false);
        }
      }, 200);
    });
  };

  const connectWallet = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      // Step A: If wallet not selected, attempt to open/connect. This may throw WalletNotSelectedError.
      if (!wallet.connected) {
        try {
          await wallet.connect();
        } catch (err: any) {
          // If the adapter throws the WalletNotSelectedError, show friendly message
          if (err instanceof WalletNotSelectedError || err?.name === "WalletNotSelectedError") {
            throw new WalletNotSelectedError();
          }
          // otherwise rethrow to be handled below
          throw err;
        }

        // Wait until wallet.connected becomes true (or timeout)
        const ok = await waitForConnected(10000); // 10s
        if (!ok) throw new Error("Wallet did not connect. Please open your wallet and approve the connection.");
      }

      const address = wallet.publicKey?.toBase58();
      if (!address) throw new Error("No wallet address available after connect.");

      // Step B: request nonce from backend
      const nonceRes = await fetch(`${API_BASE}/auth/nonce?address=${encodeURIComponent(address)}`);
      if (!nonceRes.ok) {
        const txt = await nonceRes.text().catch(() => "");
        throw new Error(`Failed to fetch nonce: ${nonceRes.status} ${txt}`);
      }
      const nonceJson = await nonceRes.json().catch(() => ({}));
      const nonce = nonceJson?.nonce || nonceJson?.value;
      if (!nonce) throw new Error("Nonce not returned by server.");

      const message = `Sign this message to verify ownership.\nNonce: ${nonce}`;
      const messageBytes = new TextEncoder().encode(message);

      // Step C: sign message
      if (!wallet.signMessage) throw new Error("This wallet does not support message signing.");
      const signature = await wallet.signMessage(messageBytes);
      if (!signature) throw new Error("No signature returned from wallet.");

      // Step D: verify on backend
      const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          message,
          signature: Array.from(signature),
        }),
      });

      if (!verifyRes.ok) {
        const txt = await verifyRes.text().catch(() => "");
        throw new Error(`Server verification failed: ${verifyRes.status} ${txt}`);
      }

      const data = await verifyRes.json().catch(() => ({}));
      if (!data?.token) throw new Error("No token received from server.");

      try {
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("sol_wallet", address);
      } catch {}

      onConnected?.(address);
    } catch (err: any) {
      console.error("❌ Wallet connection failed:", err);

      if (err instanceof WalletNotSelectedError || err?.name === "WalletNotSelectedError") {
        setError("Please open a Solana wallet (e.g. Phantom) and select it from the browser extension or wallet modal.");
      } else if (err?.message?.includes("Signature")) {
        setError("Signature request failed or was rejected. Please approve the signature in your wallet.");
      } else {
        setError(err?.message || "Wallet connection failed.");
      }
    } finally {
      setLoading(false);
    }
  }, [wallet, onConnected]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* WalletMultiButton renders the wallet selector button/modal */}
      <WalletMultiButton />

      <button
        className="cta"
        onClick={connectWallet}
        disabled={loading}
        style={{
          padding: "12px 20px",
          fontSize: 16,
          borderRadius: 12,
          cursor: "pointer",
          background: "#512da8",
          color: "white",
          fontWeight: 600,
          border: "none",
        }}
      >
        {loading ? "Connecting..." : "Sign in with Wallet"}
      </button>

      {error && (
        <div style={{ color: "red", fontSize: 14, background: "rgba(255,0,0,0.06)", padding: 8, borderRadius: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}
