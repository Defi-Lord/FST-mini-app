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

/** Convert Uint8Array → Base64 safely */
function u8ToBase64(u8: Uint8Array) {
  let binary = "";
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
  return btoa(binary);
}

export default function SignInWithWallet({ onConnected, onToken }: Props) {
  const wallet = useWallet();
  const { setVisible } = useWalletModal();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /** Get challenge from backend (supports /auth/challenge or /auth/nonce) */
  const getChallenge = async (address: string): Promise<string> => {
    try {
      const res = await api.post("/auth/challenge", { address });
      if (res && (res as any).challenge) {
        return (res as any).challenge;
      }
    } catch {
      /* will fallback to /auth/nonce */
    }

    // fallback route your backend supports
    const fallback = await api.post("/auth/nonce", { walletAddress: address });
    return (
      (fallback as any).message ||
      (fallback as any).nonce ||
      ""
    );
  };

  /** Normalize signature returns from various wallets */
  const normalizeSignature = (raw: any): string => {
    if (!raw) throw new Error("Empty signature returned.");

    if (typeof raw === "string") return raw; // already base64 or string

    if (raw instanceof Uint8Array) return u8ToBase64(raw);

    if (raw.signature) {
      const sig = raw.signature;
      if (sig instanceof Uint8Array) return u8ToBase64(sig);
      if (typeof sig === "string") return sig;
      return u8ToBase64(new Uint8Array(sig));
    }

    // fallback coercion attempt
    try {
      return u8ToBase64(new Uint8Array(raw));
    } catch {
      throw new Error("Unable to normalize wallet signature.");
    }
  };

  /** Connect Wallet button */
  const handleConnect = async () => {
    setError(null);

    try {
      await wallet.connect();
    } catch (err: any) {
      const name = err?.name || err?.constructor?.name || "";

      if (name.includes("WalletNotSelected")) {
        setVisible(true);
        setError("Please select a wallet from the modal.");
      } else {
        setError("Failed to connect wallet. Try again.");
      }
      return;
    }
  };

  /** Sign-in flow */
  const handleSignIn = async () => {
    setError(null);

    if (!wallet.publicKey) {
      setError("Please connect your wallet first.");
      return;
    }
    if (!wallet.signMessage) {
      setError("This wallet cannot sign messages. Use Phantom or a compatible wallet.");
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      const address = wallet.publicKey.toBase58();

      // 1) fetch challenge
      const challenge = await getChallenge(address);
      if (!challenge) throw new Error("No challenge received from server.");

      // 2) sign challenge
      const encoded = new TextEncoder().encode(challenge);
      const rawSig = await wallet.signMessage(encoded);
      const signatureBase64 = normalizeSignature(rawSig);

      // 3) verify on backend
      let verifyToken: string | undefined;

      try {
        const res = await api.post("/auth/verify", {
          address,
          signature: signatureBase64,
          message: challenge,
        });
        verifyToken = (res as any).token;
      } catch {
        // fallback shape
        const res = await api.post("/auth/verify", {
          walletAddress: address,
          signature: signatureBase64,
          nonce: challenge,
        });
        verifyToken = (res as any).token;
      }

      if (!verifyToken) throw new Error("Server did not return a token.");

      // save token
      localStorage.setItem("auth_token", verifyToken);
      onToken?.(verifyToken);

      // notify parent
      onConnected(address);

      setSuccess(true);
    } catch (err: any) {
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
          Securely authenticate using your Solana wallet. We never request private keys.
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
