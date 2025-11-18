// src/components/SignInWithWallet.tsx
import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { motion } from "framer-motion";
import { api } from "../api";

type Props = {
  onConnected: (addr: string) => void;
  onToken?: (token: string) => void;
};

function u8ToBase64(u8: Uint8Array) {
  // browser-friendly base64 for Uint8Array
  let binary = "";
  const len = u8.length;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

export default function SignInWithWallet({ onConnected, onToken }: Props) {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleConnect = async () => {
    setError(null);
    try {
      // If the adapter requires selection, connect() will open the injected prompt or fail.
      await wallet.connect();
    } catch (err: any) {
      const name = err?.name || err?.constructor?.name || "";
      if (name.includes("WalletNotSelected")) {
        // open the modal so user can pick a wallet
        setVisible(true);
        setError("Please select a wallet from the modal.");
      } else {
        setError("Failed to connect wallet. Try again.");
      }
      console.warn("Wallet connection error:", err);
    }
  };

  const getChallenge = async (address: string) => {
    // Try the common endpoints your backend might expose: /auth/challenge or /auth/nonce
    try {
      const res = await api.post<{ ok: boolean; challenge: string }>("/auth/challenge", {
        address,
      });
      if (res && (res as any).challenge) return (res as any).challenge;
    } catch (e) {
      // fallthrough to try /auth/nonce
    }
    // fallback
    const fallback = await api.post<{ nonce: string; message: string }>("/auth/nonce", {
      walletAddress: address,
    });
    return (fallback as any).message || (fallback as any).nonce;
  };

  const handleSignIn = async () => {
    setError(null);
    if (!wallet.publicKey) {
      setError("Please connect your wallet first.");
      return;
    }
    if (!wallet.signMessage && !wallet.signTransaction) {
      setError("Your wallet does not support message signing. Use Phantom or a compatible wallet.");
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      // 1️⃣ Get challenge message from backend (supports both /auth/challenge and /auth/nonce)
      const challenge = await getChallenge(wallet.publicKey.toBase58());
      if (!challenge) throw new Error("No challenge received from server.");

      // 2️⃣ Sign challenge
      const encodedMsg = new TextEncoder().encode(challenge);

      // Many adapters return either Uint8Array, { signature: Uint8Array }, or a string
      const rawSig = await (wallet.signMessage as any)(encodedMsg);
      let signatureBase64: string;
      if (!rawSig && typeof rawSig !== "string") {
        throw new Error("Signature failed or returned empty value.");
      }
      if (typeof rawSig === "string") {
        // If wallet returned a base64/string signature already
        signatureBase64 = rawSig;
      } else if (rawSig instanceof Uint8Array) {
        signatureBase64 = u8ToBase64(rawSig);
      } else if (typeof rawSig === "object" && (rawSig as any).signature) {
        const sig = (rawSig as any).signature;
        if (sig instanceof Uint8Array) signatureBase64 = u8ToBase64(sig);
        else if (typeof sig === "string") signatureBase64 = sig;
        else signatureBase64 = u8ToBase64(new Uint8Array(sig));
      } else {
        // Try to coerce
        try {
          signatureBase64 = u8ToBase64(new Uint8Array(rawSig));
        } catch {
          throw new Error("Unable to normalize wallet signature.");
        }
      }

      // 3️⃣ Verify signature with backend
      // Try both possible verify shapes if your backend expects different fields
      try {
        const verifyRes = await api.post<{ ok: boolean; token: string }>("/auth/verify", {
          address: wallet.publicKey.toBase58(),
          signature: signatureBase64,
          message: challenge,
        });

        const token = (verifyRes as any).token;
        if (!token) throw new Error("No token from server");
        localStorage.setItem("auth_token", token);
        onToken?.(token);
        onConnected(wallet.publicKey.toBase58());
        setSuccess(true);
      } catch (e) {
        // If /auth/verify fails, try the alternative shape the backend might expect:
        const verifyRes = await api.post<{ ok: boolean; token: string }>("/auth/verify", {
          walletAddress: wallet.publicKey.toBase58(),
          signature: signatureBase64,
          nonce: challenge,
        });
        const token = (verifyRes as any).token;
        if (!token) throw new Error("No token from server (alt)");
        localStorage.setItem("auth_token", token);
        onToken?.(token);
        onConnected(wallet.publicKey.toBase58());
        setSuccess(true);
      }
    } catch (err: any) {
      console.error("Sign-in failed:", err);
      setError(err?.message || "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b0f19] to-[#1a1f2e] px-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-xl p-8 text-center"
      >
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-semibold text-white mb-4"
        >
          Sign In with Solana Wallet
        </motion.h1>

        <p className="text-gray-300 text-sm mb-8">
          Securely authenticate using your Solana wallet. We’ll never request private keys or sensitive info.
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
            {loading ? "Signing In..." : "Sign In with Wallet"}
          </motion.button>
        )}

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-sm mt-4">
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-400 text-sm mt-4">
            ✅ Successfully signed in!
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
