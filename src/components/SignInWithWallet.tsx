// src/components/SignInWithWallet.tsx
import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

const API_BASE = import.meta.env.VITE_API_BASE || "https://fst-backend-z7bc.onrender.com";

interface Props {
  onConnected: (address: string) => void;
}

const SignInWithWallet: React.FC<Props> = ({ onConnected }) => {
  const { publicKey, signMessage, connect, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setError("");
    setLoading(true);
    try {
      if (!connected) await connect();
      if (!publicKey) throw new Error("Wallet not found");

      const address = publicKey.toBase58();
      console.log("🔑 Wallet address:", address);

      // Step 1: Fetch nonce
      const nonceRes = await fetch(`${API_BASE}/auth/nonce?address=${address}`);
      if (!nonceRes.ok) throw new Error("Failed to get nonce");
      const { nonce } = await nonceRes.json();

      const message = `Please sign this message to verify your wallet.\nNonce: ${nonce}`;

      // Step 2: Sign message
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);
      const signatureArray = Array.from(signature);

      // Step 3: Verify
      const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          signature: signatureArray,
          message,
        }),
      });

      if (!verifyRes.ok) throw new Error("Wallet verification failed");
      const data = await verifyRes.json();

      localStorage.setItem("auth_token", data.token);
      onConnected(address);

      console.log("✅ Wallet verified successfully:", address);
    } catch (err: any) {
      console.error("❌ Wallet connection failed:", err);
      setError(err.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <button
        disabled={loading}
        onClick={handleConnect}
        style={{
          background: "#512da8",
          color: "white",
          padding: "10px 16px",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        {loading ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <small style={{ color: "red" }}>{error}</small>}
    </div>
  );
};

export default SignInWithWallet;
