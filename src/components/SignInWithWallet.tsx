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
      // 1️⃣ Get challenge from backend
      const challengeRes = await api.post<ChallengeResponse>("/auth/challenge", {
        address: wallet.publicKey.toBase58(),
      });

      const message = challengeRes.challenge;
      if (!message) throw new Error("Failed to get challenge");

      // 2️⃣ Sign the challenge
      const encoded = new TextEncoder().encode(message);
      const signature = await wallet.signMessage!(encoded);

      // 3️⃣ Verify with backend
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl shadow-2xl max-w-md w-full p-10 text-center space-y-6"
      >
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-bold text-white tracking-wide"
        >
          Welcome to <span className="text-indigo-400">FST</span>
        </motion.h1>

        <p className="text-gray-300 text-sm">
          Connect your Solana wallet to join contests, track your fantasy
          rankings, and unlock rewards.
        </p>

        {!wallet.connected ? (
          <button
            onClick={wallet.connect}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-semibold w-full transition-all shadow-md hover:shadow-indigo-500/30"
          >
            {loading ? "Connecting..." : "Connect Wallet"}
          </button>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-xl font-semibold w-full transition-all shadow-md hover:shadow-green-500/30"
          >
            {loading ? "Verifying..." : "Sign In with Wallet"}
          </button>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-sm font-medium"
          >
            {error}
          </motion.div>
        )}

        {wallet.publicKey && (
          <div className="text-xs text-gray-400">
            Connected: {wallet.publicKey.toBase58().slice(0, 6)}...
            {wallet.publicKey.toBase58().slice(-6)}
          </div>
        )}

        <p className="text-gray-500 text-xs mt-8">
          Secure sign-in powered by Solana & FST Fantasy Engine ⚡
        </p>
      </motion.div>
    </div>
  );
}
