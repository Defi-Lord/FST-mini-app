// src/main.tsx
import { Buffer } from "buffer";
(window as any).Buffer ??= Buffer;

import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider, useApp, type ContestRealm } from "./state";

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

import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

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

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://fst-backend-z7bc.onrender.com";
const SOLANA_RPC =
  import.meta.env.VITE_SOLANA_RPC || "https://api.devnet.solana.com";

const getToken = () => localStorage.getItem("fst_token") || "";
const setToken = (token: string) => localStorage.setItem("fst_token", token);

function AppInner() {
  const [route, setRoute] = useState<Route>("landing");
  const stackRef = useRef<Route[]>(["landing"]);
  const { setRealm, setWalletAddress } = useApp();
  const wallet = useWallet();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const resp = await fetch(`${API_BASE}/auth/introspect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const j = await resp.json();
        const role = String(j?.payload?.role || "").toUpperCase();
        setIsAdmin(role === "ADMIN");
        go(role === "ADMIN" ? "admin" : "home");
      } catch {
        console.warn("Auth restore failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleConnected = (addr: string) => {
    setWalletAddress(addr);
    localStorage.setItem("sol_wallet", addr);
    setRealm("free");
    go("home");
  };

  const onLaunch = () => {
    const token = getToken();
    if (token) {
      go(isAdmin ? "admin" : "home");
      return;
    }
    go("connect");
  };

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <>
      {route === "landing" && (
        <Landing onGetStarted={onLaunch} onRewards={() => go("rewards")} />
      )}

      {route === "connect" && (
        <div style={{ display: "grid", gap: 12, padding: 16 }}>
          <SignInWithWallet
            onConnected={handleConnected}
            onToken={(t) => setToken(t)}
          />
          <small>
            If you don’t see the wallet popup, click the Phantom icon in your
            browser toolbar.
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
          onAdmin={() => go("admin")}
          onHistory={() => go("history")}
          onProfile={() => go("profile")}
        />
      )}

      {route === "contestTypes" && (
        <ContestTypes onBack={back} onJoined={(r) => go("teamSelect")} />
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

const endpoint = SOLANA_RPC;
const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
  new BackpackWalletAdapter(),
];

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

export default true;
