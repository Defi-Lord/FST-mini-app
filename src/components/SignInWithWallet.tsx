// src/components/SignInWithWallet.tsx
import React, { useState } from "react";
import {
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";

type Props = {
  onConnected?: (address: string) => void;
};

// Adjust based on your backend endpoint
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3300";

export default function SignInWithWallet({ onConnected }: Props) {
  const { publicKey, signMessage, connect, connected, wallet } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Fetch nonce from backend ----
  async function getNonce(address: string): Promise<string> {
    const res = await fetch(`${API_BASE}/auth/nonce?address=${address}`);
    if (!res.ok) throw new Error(`Nonce fetch failed: ${res.statusText}`);
    const data = await res.json();
    return data?.nonce || data?.value || "";
  }

  // ---- Verify signature with backend ----
  async function verifyWallet(address: string, signature: Uint8Array, message: string) {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        address,
        signature: Array.from(signature),
        message,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Verification failed: ${err}`);
    }

    const data = await res.json();
    if (!data?.token) throw new Error("No token received");

    localStorage.setItem("auth_token", data.token);
    return data;
  }

  // ---- Main connect handler ----
  const connectWallet = async () => {
    setError(null);
    setLoading(true);

    try {
      // 1️⃣ Check wallet selection
      if (!wallet) {
        alert("Please select a wallet first (e.g., Phantom).");
        throw new Error("Wallet not selected");
      }

      // 2️⃣ Connect to wallet
      if (!connected) {
        await connect();
      }

      if (!publicKey) throw new Error("Wallet not connected properly");
      const address = publicKey.toBase58();

      // 3️⃣ Request nonce from backend
      const nonce = await getNonce(address);
      if (!nonce) throw new Error("Failed to get nonce from backend");

      const messageStr = `Sign this message to verify: ${nonce}`;
      const message = new TextEncoder().encode(messageStr);

      // 4️⃣ Sign the message
      if (!signMessage) throw new Error("Wallet does not support message signing");
      const signature = await signMessage(message);

      // 5️⃣ Verify on backend
      const verified = await verifyWallet(address, signature, messageStr);
      console.log("✅ Wallet verified:", address);

      // 6️⃣ Store wallet + navigate
      localStorage.setItem("sol_wallet", address);
      onConnected?.(address);
    } catch (e: any) {
      console.error("⚠️ Wallet connect error:", e);

      if (e.name === "WalletNotSelectedError") {
        setError("No wallet selected. Please open Phantom or another wallet extension.");
      } else if (e.message.includes("User denied")) {
        setError("You denied the signature request. Please approve it in your wallet popup.");
      } else {
        setError(e.message || "Wallet connection failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
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
