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

  const handleSignIn = async () => {
    try {
      if (!wallet.wallet) {
        setError("Please select a wallet first.");
        await wallet.connect(); // triggers wallet modal
        return;
      }

      if (!wallet.connected) {
        await wallet.connect();
      }

      if (!wallet.publicKey) {
        setError("Wallet not connected.");
        return;
      }

      setLoading(true);
      setError(null);

      // Step 1: Get challenge
      const res = await api.post<{ ok: true; challenge: string }>(
        "/auth/challenge",
        { address: wallet.publicKey.toBase58() }
      );

      const encodedMessage = new TextEncoder().encode(res.challenge);
      const signature = await wallet.signMessage!(encodedMessage);

      // Step 2: Verify + get JWT
      const verify = await api.post<{ ok: true; token: string }>(
        "/auth/verify",
        {
          address: wallet.publicKey.toBase58(),
          signature: Buffer.from(signature).toString("base64"),
          message: res.challenge,
        }
      );

      const token = verify.token;
      localStorage.setItem("auth_token", token);
      onToken?.(token);
      onConnected(wallet.publicKey.toBase58());
    } catch (err: any) {
      console.error("❌ Sign-in failed:", err);
      setError(err?.message || "Sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md p-8 rounded-2xl bg-white/10 backdrop-blur-md shadow-2xl border border-white/20 text-center"
      >
        <motion.h1
          className="text-3xl font-bold text-white mb-4"
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          🔐 Sign In with Wallet
        </motion.h1>

        <p className="text-gray-300 text-sm mb-8">
          Connect your Solana wallet securely to continue.
        </p>

        {!wallet.connected ? (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => wallet.connect()}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg hover:shadow-indigo-700/40 transition-all"
          >
            {loading ? "Connecting..." : "🔗 Connect Wallet"}
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSignIn}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold shadow-lg hover:shadow-green-700/40 transition-all"
          >
            {loading ? "Verifying..." : "✅ Sign In with Wallet"}
          </motion.button>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-red-400 text-sm font-medium"
          >
            {error}
          </motion.div>
        )}

        {wallet.connected && wallet.publicKey && (
          <motion.p
            className="mt-6 text-xs text-gray-400 break-all"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Connected: {wallet.publicKey.toBase58()}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
