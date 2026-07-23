import React, { useMemo } from "react";
import { Empty } from "../components/ui.jsx";
import { money, num } from "../lib/calc.js";

export default function Analytics({ trips, expenses, incomes }) {
  const m = useMemo(() => {
    const gross = trips.reduce((s, t) => s + Number(t.gross_pay), 0);
    const net = trips.reduce((s, t) => s + Number(t.net_pay), 0);
    const loaded = trips.reduce((s, t) => s + Number(t.loaded_miles), 0);
    const empty = trips.reduce((s, t) => s + Number(t.empty_miles), 0);
    const all = loaded + empty;
    const spent = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const fuel = expenses.filter((e) => e.category === "fuel").reduce((s, e) => s + Number(e.amount), 0);
    const extra = incomes.reduce((s, i) => s + Number(i.amount), 0);
    const profit = net + extra - spent;
    return {
      gross, net, loaded, empty, all, spent, fuel, extra, profit,
      grossPerMile: all ? gross / all : 0,
      netPerMile: all ? net / all : 0,
      costPerMile: all ? spent / all : 0,
      profitPerMile: all ? profit / all : 0,
      fuelPerMile: all ? fuel / all : 0,
      deadheadPct: all ? (empty / all) * 100 : 0,
      profitPerTrip: trips.length ? profit / trips.length : 0,
      avgTripPay: trips.length ? net / trips.length : 0,
    };
  }, [trips, expenses, incomes]);

  if (!trips.length) return (
    <div>
      <h2 className="page-title">Analytics</h2>
      <Empty icon="chart" text="Numbers appear here once you have saved a trip." />
    </div>
  );

  const perMile = [
    { label: "Gross pay per mile", v: m.grossPerMile, hint: "Total gross pay ÷ (loaded + empty miles). The headline rate." },
    { label: "Your pay per mile", v: m.netPerMile, hint: "Pay after the 20% cut ÷ all miles driven." },
    { label: "Cost per mile", v: m.costPerMile, hint: "Everything spent ÷ all miles. Keep it below your pay per mile." },
    { label: "Fuel per mile", v: m.fuelPerMile, hint: "Fuel only ÷ all miles. The biggest cost to watch." },
    { label: "Profit per mile", v: m.profitPerMile, hint: "What actually stays with you for every mile driven." },
  ];
  const max = Math.max(...perMile.map((p) => p.v), 0.01);

  return (
    <div>
      <h2 className="page-title">Analytics</h2>
      <p className="page-sub">All-time numbers across {trips.length} trip{trips.length > 1 ? "s" : ""}.</p>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Per-mile picture</div>
        {perMile.map((p) => (
          <div key={p.label} style={{ marginBottom: 12 }}>
            <div className="between" style={{ fontSize: 13 }}>
              <span>{p.label}</span><b>{money(p.v)}/mi</b>
            </div>
            <svg width="100%" height="10" style={{ display: "block", margin: "4px 0" }}>
              <rect x="0" y="2" width="100%" height="6" rx="3" fill="var(--hairline)" />
              <rect x="0" y="2" width={`${Math.max((p.v / max) * 100, 2)}%`} height="6" rx="3" fill="url(#goldbar)" />
              <defs>
                <linearGradient id="goldbar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#f6e27a" /><stop offset="0.5" stopColor="#d4af37" /><stop offset="1" stopColor="#a87d0a" />
                </linearGradient>
              </defs>
            </svg>
            <div className="hint">{p.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <Stat label="Empty-mile share" value={`${num(m.deadheadPct)}%`} hint="Share of all miles driven with no load. Lower is better." />
        <Stat label="Loaded vs empty" value={`${num(m.loaded)} / ${num(m.empty)}`} hint="Loaded miles vs empty miles, all time." />
        <Stat label="Average trip pay" value={money(m.avgTripPay)} hint="Average amount to you per trip, after the 20% cut." />
        <Stat label="Profit per trip" value={money(m.profitPerTrip)} hint="Average profit per trip once every cost is out." />
        <Stat label="Fuel share of costs" value={m.spent ? `${num((m.fuel / m.spent) * 100)}%` : "—"} hint="How much of all spending is fuel." />
        <Stat label="Kept from gross" value={m.gross ? `${num((m.profit / m.gross) * 100)}%` : "—"} hint="Cents of profit kept from every gross dollar." />
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 19, margin: "2px 0" }}>{value}</div>
      <div className="hint">{hint}</div>
    </div>
  );
}
