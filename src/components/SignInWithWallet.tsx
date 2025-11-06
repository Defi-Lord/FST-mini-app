// src/components/SignInWithWallet.tsx
import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { api } from "../api";

type Props = {
  onConnected: (addr: string) => void;
  onToken?: (token: string) => void;
};

export default function SignInWithWallet({ onConnected, onToken }: Props) {
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleConnect = async () => {
    setError(null);
    try {
      await wallet.connect();
      if (!wallet.publicKey) {
        setError("Please select a wallet to continue.");
      }
    } catch (err: any) {
      if (err.name === "WalletNotSelectedError") {
        setError("Please choose a wallet (Phantom, Solflare, or Backpack).");
      } else {
        setError("Failed to connect wallet. Try again.");
      }
      console.warn("Wallet connection error:", err);
    }
  };

  const handleSignIn = async () => {
    if (!wallet.publicKey) {
      setError("Please connect your wallet first.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const challengeRes = await api.post<{ ok: boolean; challenge: string }>(
        "/auth/challenge",
        { address: wallet.publicKey.toBase58() }
      );

      const challenge = challengeRes.challenge;
      if (!challenge) throw new Error("No challenge received from server.");

      const encodedMsg = new TextEncoder().encode(challenge);
      const signature = await wallet.signMessage!(encodedMsg);

      const verifyRes = await api.post<{ ok: boolean; token: string; role: string }>(
        "/auth/verify",
        {
          address: wallet.publicKey.toBase58(),
          signature: Buffer.from(signature).toString("base64"),
          message: challenge,
        }
      );

      const token = verifyRes.token;
      localStorage.setItem("fst_token", token);
      onToken?.(token);
      onConnected(wallet.publicKey.toBase58());
      setSuccess(true);
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setError(err?.message || "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b0f19] via-[#14182b] to-[#1a1f2e] px-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 text-center"
      >
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-semibold text-white mb-4"
        >
          Connect Your Wallet
        </motion.h1>

        <p className="text-gray-300 text-sm mb-8">
          Sign in securely with your Solana wallet to access FST.
        </p>

        {!wallet.connected ? (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition"
          >
            {loading ? "Connecting..." : "Connect Wallet"}
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSignIn}
            disabled={loading}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition"
          >
            {loading ? "Signing In..." : "Sign In"}
          </motion.button>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-400 text-sm mt-4"
          >
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-emerald-400 text-sm mt-4"
          >
            ✅ Successfully signed in!
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
