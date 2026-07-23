import React, { useCallback, useEffect, useState } from "react";
import { Icon, InstallPrompt } from "./components/ui.jsx";
import Landing from "./pages/Landing.jsx";
import Trips from "./pages/Trips.jsx";
import Money from "./pages/Money.jsx";
import Summaries from "./pages/Summaries.jsx";
import Analytics from "./pages/Analytics.jsx";
import Documents from "./pages/Documents.jsx";
import { listDocuments, listExpenses, listIncomes, listTrips } from "./lib/store.js";
import { configured } from "./lib/supabase.js";

const TABS = [
  { key: "trips", label: "Trips", icon: "truck" },
  { key: "money", label: "Money", icon: "wallet" },
  { key: "summary", label: "Summary", icon: "chart" },
  { key: "analytics", label: "Analytics", icon: "gauge" },
  { key: "docs", label: "Docs", icon: "folder" },
];

export default function App() {
  const [signedIn, setSignedIn] = useState(() => sessionStorage.getItem("jamka-auth") === "1");
  const [tab, setTab] = useState("trips");
  const [trips, setTrips] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [incomes, setIncomes] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loadErr, setLoadErr] = useState("");

  const refresh = useCallback(async () => {
    if (!configured) return;
    try {
      const [t, e, i, d] = await Promise.all([listTrips(), listExpenses(), listIncomes(), listDocuments()]);
      setTrips(t); setExpenses(e); setIncomes(i); setDocs(d); setLoadErr("");
    } catch {
      setLoadErr("Could not load your data. Check your internet connection, then pull to refresh or reopen the app.");
    }
  }, []);

  useEffect(() => { if (signedIn) refresh(); }, [signedIn, refresh]);

  if (!signedIn) {
    return (
      <>
        <Landing onSignedIn={() => { sessionStorage.setItem("jamka-auth", "1"); setSignedIn(true); }} />
        <InstallPrompt />
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="./icons/icon.svg" alt="" width="34" height="34" style={{ borderRadius: 9 }} />
          <div>
            <div className="brand-name">JAMKA LLC</div>
            <div className="brand-sub">Trip &amp; Money Books</div>
          </div>
        </div>
        <button className="modal-close" aria-label="Sign out"
          onClick={() => { sessionStorage.removeItem("jamka-auth"); setSignedIn(false); }}>
          {Icon.logout(20)}
        </button>
      </header>

      {loadErr && <p className="error-text" style={{ margin: "12px 2px" }}>{loadErr}</p>}

      <main>
        {tab === "trips" && <Trips trips={trips} expenses={expenses} incomes={incomes} refresh={refresh} />}
        {tab === "money" && <Money trips={trips} refresh={refresh} />}
        {tab === "summary" && (
          <Summaries trips={trips} expenses={expenses} incomes={incomes} refresh={refresh}
            onOpenTrip={() => setTab("trips")} />
        )}
        {tab === "analytics" && <Analytics trips={trips} expenses={expenses} incomes={incomes} />}
        {tab === "docs" && <Documents docs={docs} refresh={refresh} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            <span className="tab-ic">{Icon[t.icon](21)}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
