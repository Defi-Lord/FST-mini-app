// src/components/SignInWithWallet.tsx
import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../api";

type Props = {
  onConnected: (addr: string) => void;
  onToken?: (token: string) => void; // ✅ new prop
};

export default function SignInWithWallet({ onConnected, onToken }: Props) {
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!wallet.publicKey) {
      setError("Please connect your wallet first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Request a challenge from backend
      const res = await api.post<{ ok: true; challenge: string }>(
        "/auth/challenge",
        { address: wallet.publicKey.toBase58() }
      );

      // Sign the challenge with wallet
      const encodedMessage = new TextEncoder().encode(res.challenge);
      const signature = await wallet.signMessage!(encodedMessage);

      // Send signed message back to verify + get JWT
      const verify = await api.post<{ ok: true; token: string }>(
        "/auth/verify",
        {
          address: wallet.publicKey.toBase58(),
          signature: Buffer.from(signature).toString("base64"),
        }
      );

      const token = verify.token;
      localStorage.setItem("auth_token", token);
      onToken?.(token); // ✅ notify parent (main.tsx)
      onConnected(wallet.publicKey.toBase58());
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setError(err?.message || "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {!wallet.connected ? (
        <button
          onClick={wallet.connect}
          className="btn-primary"
          disabled={loading}
        >
          Connect Wallet
        </button>
      ) : (
        <button
          onClick={handleSignIn}
          className="btn-primary"
          disabled={loading}
        >
          {loading ? "Signing In..." : "Sign In with Wallet"}
        </button>
      )}
      {error && <div style={{ color: "tomato", fontSize: 12 }}>{error}</div>}
    </div>
  );
}
