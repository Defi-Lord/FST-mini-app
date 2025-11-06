// src/components/SignInWithWallet.tsx
import React, { useState } from "react";
import {
  useWallet,
  WalletNotSelectedError,
} from "@solana/wallet-adapter-react";
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

  const handleConnect = async () => {
    try {
      setError(null);
      await wallet.connect();
    } catch (err) {
      if (err instanceof WalletNotSelectedError) {
        setError("Please select a wallet to continue.");
      } else {
        setError("Wallet connection failed. Try again.");
      }
    }
  };

  const handleSignIn = async () => {
    if (!wallet.publicKey) {
      setError("Please connect your wallet first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // ✅ Step 1: Request challenge
      const challengeRes = await api.post<{ ok: boolean; challenge: string }>(
        "/auth/challenge",
        { address: wallet.publicKey.toBase58() }
      );

      if (!challengeRes.ok || !challengeRes.challenge)
        throw new Error("Invalid challenge response.");

      const message = challengeRes.challenge;
      const encodedMessage = new TextEncoder().encode(message);

      // ✅ Step 2: Sign challenge
      const signature = await wallet.signMessage!(encodedMessage);

      // ✅ Step 3: Verify on backend
      const verifyRes = await api.post<{ ok: boolean; token: string; role: string }>(
        "/auth/verify",
        {
          address: wallet.publicKey.toBase58(),
          signature: Buffer.from(signature).toString("base64"),
          message,
        }
      );

      if (!verifyRes.ok || !verifyRes.token)
        throw new Error("Verification failed.");

      const token = verifyRes.token;
      localStorage.setItem("auth_token", token);
      onToken?.(token);
      onConnected(wallet.publicKey.toBase58());
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setError(err?.message || "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-700 px-4">
      <motion.div
        className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-8 w-full max-w-md text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.h1
          className="text-2xl font-bold text-white mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Sign In to Fantasy Street Traders
        </motion.h1>
        <p className="text-sm text-indigo-100 mb-6">
          Connect your Solana wallet to continue
        </p>

        {!wallet.connected ? (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect Wallet"}
          </button>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-green-400 to-emerald-500 text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In with Wallet"}
          </button>
        )}

        {error && (
          <motion.div
            className="mt-4 text-sm text-red-300 bg-red-900/40 rounded-lg px-3 py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.div>
        )}

        {wallet.connected && (
          <p className="text-xs text-indigo-200 mt-4">
            Connected: {wallet.publicKey?.toBase58().slice(0, 6)}...
            {wallet.publicKey?.toBase58().slice(-4)}
          </p>
        )}
      </motion.div>
    </div>
  );
}
