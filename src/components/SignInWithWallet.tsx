// src/components/SignInWithWallet.tsx
import React, { useCallback, useState } from "react";
import { useWallet, WalletNotConnectedError } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const API_BASE = import.meta.env.VITE_API_BASE || "https://fst-backend-z7bc.onrender.com";

export default function SignInWithWallet({ onConnected }: { onConnected: (addr: string) => void }) {
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      // ✅ Wait for the wallet to actually connect
      if (!wallet.connected) {
        throw new WalletNotConnectedError();
      }

      const address = wallet.publicKey?.toBase58();
      if (!address) throw new Error("No wallet address found");

      // ✅ Step 1: Get nonce from backend
      const nonceRes = await fetch(`${API_BASE}/auth/nonce?address=${address}`);
      if (!nonceRes.ok) throw new Error("Failed to fetch nonce");
      const { nonce } = await nonceRes.json();

      const message = `Sign this message to verify your wallet ownership.\nNonce: ${nonce}`;
      const encodedMessage = new TextEncoder().encode(message);

      // ✅ Step 2: Request wallet signature
      const signature = await wallet.signMessage?.(encodedMessage);
      if (!signature) throw new Error("No signature returned");

      // ✅ Step 3: Verify on backend
      const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          message,
          signature: Array.from(signature),
        }),
      });

      const data = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(data?.error || "Verification failed");

      localStorage.setItem("auth_token", data.token);
      onConnected(address);
    } catch (err: any) {
      console.error("❌ Wallet connection failed:", err);
      if (err.name === "WalletNotSelectedError") {
        setError("Please open Phantom or Solflare and select your wallet.");
      } else if (err.name === "WalletSignTransactionError") {
        setError("Signature rejected. Please approve the request in your wallet.");
      } else {
        setError(err.message || "Wallet connection failed.");
      }
    } finally {
      setLoading(false);
    }
  }, [wallet, onConnected]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <WalletMultiButton />
      <button
        onClick={handleConnect}
        disabled={loading}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          background: "#512da8",
          color: "white",
          border: "none",
          cursor: "pointer",
        }}
      >
        {loading ? "Connecting..." : "Sign in with Wallet"}
      </button>

      {error && <div style={{ color: "red", fontSize: 14 }}>{error}</div>}
    </div>
  );
}
