// src/components/SignInWithWallet.tsx
import React, { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";

type Props = {
  onConnected?: (address: string) => void;
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3300";

export default function SignInWithWallet({ onConnected }: Props) {
  const { publicKey, signMessage, connect, connected, select } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal(); // controls wallet modal
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Automatically select Phantom or Solflare if none chosen
  useEffect(() => {
    try {
      const preferred = localStorage.getItem("preferred_wallet") || "Phantom";
      select?.(preferred);
    } catch {}
  }, [select]);

  async function getNonce(address: string): Promise<string> {
    const res = await fetch(`${API_BASE}/auth/nonce?address=${address}`);
    if (!res.ok) throw new Error(`Nonce fetch failed: ${res.statusText}`);
    const data = await res.json();
    return data?.nonce || data?.value || "";
  }

  async function verifyWallet(address: string, signature: Uint8Array, message: string) {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature: Array.from(signature), message }),
    });

    if (!res.ok) throw new Error(`Verification failed: ${await res.text()}`);
    const data = await res.json();
    if (!data?.token) throw new Error("No token received");

    localStorage.setItem("auth_token", data.token);
    return data;
  }

  const connectWallet = async () => {
    setError(null);
    setLoading(true);
    try {
      // 1️⃣ If no wallet is selected, open modal automatically
      if (!publicKey && !connected) {
        setVisible(true); // opens the wallet selector popup
        return;
      }

      if (!connected) await connect();
      if (!publicKey) throw new Error("Wallet not connected");

      const address = publicKey.toBase58();

      // 2️⃣ Get nonce and sign
      const nonce = await getNonce(address);
      const message = new TextEncoder().encode(`Sign this message to verify: ${nonce}`);
      if (!signMessage) throw new Error("Wallet does not support message signing");
      const signature = await signMessage(message);

      // 3️⃣ Verify on backend
      await verifyWallet(address, signature, `Sign this message to verify: ${nonce}`);
      console.log("✅ Wallet verified:", address);

      localStorage.setItem("sol_wallet", address);
      onConnected?.(address);
    } catch (e: any) {
      console.error("⚠️ Wallet connect error:", e);
      setError(e.message || "Wallet connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <button
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
        }}
      >
        {loading ? "Connecting..." : "Connect Wallet"}
      </button>

      {error && (
        <div
          style={{
            color: "red",
            fontSize: 14,
            background: "rgba(255,0,0,0.1)",
            padding: 6,
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
