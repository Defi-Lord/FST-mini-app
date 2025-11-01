// src/main.tsx
import { Buffer } from "buffer";
(window as any).Buffer ??= Buffer;

import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, useApp, type ContestRealm } from "./state";

// --- Pages ---
import Landing from "./pages_Landing";
import HomeHub from "./pages_HomeHub";
import ContestTypes from "./pages_ContestTypes";
import TeamSelection from "./pages_TeamSelection";
import JoinContest from "./pages_JoinContest";
import CreateTeam from "./pages_CreateTeam";
import Leaderboard from "./pages_Leaderboard";
import Rewards from "./pages_Rewards";
import ViewTeam from "./pages_ViewTeam";
import Top10 from "./pages_Top10";
import Fixtures from "./pages_Fixtures";
import Stats from "./pages_Stats";
import HowToPlay from "./pages_HowToPlay";
import AboutUs from "./pages_AboutUs";
import ContactUs from "./pages_ContactUs";
import AdminPage from "./pages_Admin";
import SignInWithWallet from "./components/SignInWithWallet";
import HistoryPage from "./pages_History";
import Transfers from "./pages_Transfers";
import Profile from "./pages_Profile";
import "./styles/menu-drawer.css";

// --- Wallet setup ---
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

// ---------- TYPES ----------
type Route =
  | "landing"
  | "connect"
  | "home"
  | "contestTypes"
  | "teamSelect"
  | "joinContest"
  | "create"
  | "leaderboard"
  | "rewards"
  | "viewteam"
  | "top10"
  | "fixtures"
  | "stats"
  | "howToPlay"
  | "about"
  | "contact"
  | "admin"
  | "history"
  | "transfers"
  | "profile";

// ---------- CONFIG ----------
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3300";
const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC || "https://api.devnet.solana.com";

const getToken = () => {
  try {
    return localStorage.getItem("auth_token") || "";
  } catch {
    return "";
  }
};

// ---------- MAIN APP INNER ----------
function AppInner() {
  const [route, setRoute] = useState<Route>("landing");
  const stackRef = useRef<Route[]>(["landing"]);
  const { setRealm, setWalletAddress } = useApp();
  const wallet = useWallet();
  const [authed, setAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Telegram helpers
  const getTG = () => (window as any)?.Telegram?.WebApp;
  const supports = (min: string) => {
    try {
      return getTG()?.isVersionAtLeast?.(min) === true;
    } catch {
      return false;
    }
  };

  // Telegram setup
  useEffect(() => {
    const tg = getTG();
    try {
      tg?.ready?.();
      tg?.expand?.();
      if (supports("6.1")) {
        tg.setHeaderColor?.("secondary_bg_color");
        tg.setBackgroundColor?.("#0b0c10");
      }
    } catch {}
  }, []);

  // Back button control
  useEffect(() => {
    const tg = getTG();
    const showBack = !["landing", "home"].includes(route);
    if (supports("6.1")) {
      try {
        showBack ? tg?.BackButton?.show?.() : tg?.BackButton?.hide?.();
      } catch {}
    }
  }, [route]);

  // Telegram back button handler
  useEffect(() => {
    const tg = getTG();
    if (!supports("6.1")) return;
    const onBack = () => {
      const stack = stackRef.current;
      if (stack.length > 1) {
        stack.pop();
        setRoute(stack[stack.length - 1]);
      }
    };
    try {
      tg?.BackButton?.onClick?.(onBack);
      return () => tg?.BackButton?.offClick?.(onBack);
    } catch {
      return;
    }
  }, []);

  // Navigation helpers
  const go = (next: Route) => {
    stackRef.current.push(next);
    setRoute(next);
  };
  const back = () => {
    const stack = stackRef.current;
    if (stack.length > 1) {
      stack.pop();
      setRoute(stack[stack.length - 1]);
    }
  };

  // Handle verified wallet
  const handleConnected = (addr: string) => {
    try {
      localStorage.setItem("sol_wallet", addr);
    } catch {}
    setWalletAddress(addr);
    setRealm("free");
    go("home");
  };

  // Auth + auto connect
  useEffect(() => {
    (async () => {
      setAuthed(false);
      setIsAdmin(false);
      const addr = wallet?.publicKey?.toBase58() || "";
      const token = getToken();
      if (!token) return;

      try {
        const me = await fetch(`${API_BASE}/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (me.ok) {
          const j = await me.json().catch(() => null);
          const effectiveAddr = j?.user?.id || addr || "";
          if (effectiveAddr) handleConnected(effectiveAddr);
          setAuthed(true);
        }
      } catch {}

      try {
        const r = await fetch(`${API_BASE}/auth/introspect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          credentials: "include",
        });
        if (r.ok) {
          const j = await r.json();
          setIsAdmin(String(j?.payload?.role || "").toUpperCase() === "ADMIN");
        } else setIsAdmin(false);
      } catch {
        setIsAdmin(false);
      }
    })();
  }, [wallet.connected, wallet.publicKey?.toBase58()]);

  // Launch
  const onLaunch = () => {
    const token = getToken();
    if (token) {
      setRealm("free");
      go("home");
      return;
    }
    go("connect");
  };

  const onContestJoined = (realm?: ContestRealm) => {
    setRealm(realm || "weekly");
    go("teamSelect");
  };

  const handleAdminNav = () => {
    if (!isAdmin) return alert("Admin only");
    go("admin");
  };

  // ---------- RENDER ROUTES ----------
  return (
    <>
      {route === "landing" && (
        <Landing onGetStarted={onLaunch} onRewards={() => go("rewards")} />
      )}

      {route === "connect" && (
        <div style={{ display: "grid", gap: 12, padding: 16 }}>
          <SignInWithWallet onConnected={handleConnected} />
          <small>
            Tip: If you don’t see the wallet popup, click the Phantom icon in your browser toolbar.
          </small>
        </div>
      )}

      {route === "home" && (
        <HomeHub
          onViewTeam={() => go("viewteam")}
          onCreateTeam={() => go("create")}
          onJoinContest={() => go("contestTypes")}
          onLeaderboard={() => go("leaderboard")}
          onTop10={() => go("top10")}
          onTransfers={() => go("transfers")}
          onFixtures={() => go("fixtures")}
          onStats={() => go("stats")}
          onBack={back}
          onHowToPlay={() => go("howToPlay")}
          onAboutUs={() => go("about")}
          onContactUs={() => go("contact")}
          isAdmin={isAdmin}
          onAdmin={handleAdminNav}
          onHistory={() => go("history")}
          onProfile={() => go("profile")}
        />
      )}

      {route === "contestTypes" && (
        <ContestTypes onBack={back} onJoined={onContestJoined as any} />
      )}
      {route === "teamSelect" && (
        <TeamSelection onBack={back} onNext={() => go("leaderboard")} />
      )}
      {route === "joinContest" && (
        <JoinContest onSelect={() => go("create")} onBack={back} />
      )}
      {route === "create" && (
        <CreateTeam onNext={() => go("leaderboard")} onBack={back} />
      )}
      {route === "leaderboard" && (
        <Leaderboard onNext={() => go("rewards")} onBack={back} />
      )}
      {route === "rewards" && (
        <Rewards onBack={back} onEnterApp={() => go("home")} />
      )}
      {route === "viewteam" && <ViewTeam onBack={back} />}
      {route === "top10" && <Top10 onBack={back} />}
      {route === "fixtures" && <Fixtures onBack={back} />}
      {route === "stats" && <Stats onBack={back} />}
      {route === "howToPlay" && <HowToPlay onBack={back} />}
      {route === "about" && <AboutUs onBack={back} />}
      {route === "contact" && <ContactUs onBack={back} />}
      {route === "admin" && <AdminPage onBack={back} />}
      {route === "history" && <HistoryPage onBack={back} />}
      {route === "transfers" && <Transfers onBack={back} />}
      {route === "profile" && <Profile onBack={back} />}
    </>
  );
}

// ---------- ROOT RENDER ----------
const endpoint = SOLANA_RPC;
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AppProvider>
            <AppInner />
          </AppProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>
);

export default true; // ✅ prevents Vite Fast Refresh warnings
