// src/components/SignInWithWallet.tsx
import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { api } from "../api";

type Props = {
  onConnected: (addr: string) => void;
  onToken?: (token: string) => void;
};

type ChallengeResponse = { ok: boolean; challenge: string };
type VerifyResponse = { ok: boolean; token: string; role: string };

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
      // 1️⃣ Request challenge message
      const challengeRes = await api.post<ChallengeResponse>("/auth/challenge", {
        address: wallet.publicKey.toBase58(),
      });

      const message = challengeRes.challenge;
      if (!message) throw new Error("Failed to get challenge");

      // 2️⃣ Sign the challenge
      const encoded = new TextEncoder().encode(message);
      const signature = await wallet.signMessage!(encoded);

      // 3️⃣ Verify + issue token
      const verifyRes = await api.post<VerifyResponse>("/auth/verify", {
        address: wallet.publicKey.toBase58(),
        signature: Buffer.from(signature).toString("base64"),
        message,
      });

      const token = verifyRes.token;
      localStorage.setItem("auth_token", token);
      onToken?.(token);
      onConnected(wallet.publicKey.toBase58());
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setError(err?.message || "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-4 bg-gray-900/70 rounded-2xl p-8 shadow-xl border border-gray-700 max-w-sm mx-auto"
    >
      <h2 className="text-xl font-semibold text-white">
        🔐 Sign In with Your Wallet
      </h2>
      <p className="text-gray-400 text-center text-sm">
        Connect your Solana wallet to securely access your fantasy contests.
      </p>

      {!wallet.connected ? (
        <button
          onClick={wallet.connect}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 w-full"
        >
          {loading ? "Connecting..." : "Connect Wallet"}
        </button>
      ) : (
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 w-full"
        >
          {loading ? "Verifying..." : "Sign In with Wallet"}
        </button>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-400 text-sm text-center"
        >
          {error}
        </motion.div>
      )}

      {wallet.publicKey && (
        <div className="text-xs text-gray-500 text-center mt-2">
          Connected: {wallet.publicKey.toBase58().slice(0, 6)}...
          {wallet.publicKey.toBase58().slice(-6)}
        </div>
      )}
    </motion.div>
  );
}
