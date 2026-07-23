import React, { useMemo, useState } from "react";
import { Empty, Icon, Modal } from "../components/ui.jsx";
import { fmtDate, fmtDateTime, money, num } from "../lib/calc.js";
import { deleteExpense, deleteIncome } from "../lib/store.js";

const CAT_LABEL = {
  fuel: "Fuel", toll: "Tolls", repairs: "Repairs & auto parts", wash: "Truck wash",
  weighing: "Weighing fees", penalty: "Penalties", insurance: "Insurance", escrow: "Escrow",
};

const PERIODS = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "3 months" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

function periodStart(key) {
  const now = new Date();
  if (key === "all") return new Date(0);
  if (key === "week") {
    // Monday 00:00 in local time (matches the UT LLC Monday–Sunday week)
    const d = new Date(now);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0);
    return d;
  }
  if (key === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (key === "quarter") { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d; }
  return new Date(now.getFullYear(), 0, 1);
}

export default function Summaries({ trips, expenses, incomes, refresh, onOpenTrip }) {
  const [period, setPeriod] = useState("month");
  const [drill, setDrill] = useState(null); // 'income' | 'expenses' | category key | income kind

  const start = periodStart(period).getTime();
  const data = useMemo(() => {
    const inRange = (d) => new Date(d).getTime() >= start;
    const pTrips = trips.filter((t) => t.first_pickup && inRange(t.first_pickup));
    const pExp = expenses.filter((e) => inRange(e.at));
    const pInc = incomes.filter((i) => inRange(i.on_date));
    const tripPay = pTrips.reduce((s, t) => s + Number(t.net_pay), 0);
    const extraInc = pInc.reduce((s, i) => s + Number(i.amount), 0);
    const spent = pExp.reduce((s, e) => s + Number(e.amount), 0);
    return { pTrips, pExp, pInc, tripPay, extraInc, income: tripPay + extraInc, spent, profit: tripPay + extraInc - spent };
  }, [trips, expenses, incomes, start]);

  const byCat = useMemo(() => {
    const m = {};
    for (const e of data.pExp) m[e.category] = (m[e.category] || 0) + Number(e.amount);
    return m;
  }, [data]);

  return (
    <div>
      <h2 className="page-title">Summaries</h2>
      <p className="page-sub">Pick a period, then tap any number to open the full list behind it.</p>

      <div className="row" style={{ overflowX: "auto", paddingBottom: 6 }}>
        {PERIODS.map((p) => (
          <button key={p.key} className={`pill ${period === p.key ? "dark" : ""}`}
            style={{ whiteSpace: "nowrap", border: "none", cursor: "pointer" }}
            onClick={() => setPeriod(p.key)}>{p.label}</button>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 10 }}>
        <button className="card clickable" onClick={() => setDrill("trips")}>
          <div className="muted">Trips</div><div className="kpi">{data.pTrips.length}</div>
        </button>
        <button className="card clickable" onClick={() => setDrill("income")}>
          <div className="muted">Total income</div><div className="kpi">{money(data.income)}</div>
        </button>
        <button className="card clickable" onClick={() => setDrill("expenses")}>
          <div className="muted">Total expenses</div><div className="kpi">{money(data.spent)}</div>
        </button>
        <div className="card">
          <div className="muted">Profit</div>
          <div className="kpi" style={{ color: data.profit >= 0 ? "var(--gold-3)" : "#a11616" }}>{money(data.profit)}</div>
        </div>
      </div>

      {/* trips drill */}
      {drill === "trips" && (
        <Modal title="Trips in this period" onClose={() => setDrill(null)} wide>
          {data.pTrips.length === 0 ? <Empty text="No trips in this period." /> : (
            <div className="list-wrap">
              {data.pTrips.map((t) => {
                const from = t.stops?.find((s) => s.kind === "pickup");
                const to = [...(t.stops || [])].reverse().find((s) => s.kind === "delivery");
                return (
                  <button key={t.id} className="list-item" onClick={() => { setDrill(null); onOpenTrip(t); }}>
                    <div>
                      <b>{from?.state || "?"} → {to?.state || "?"}</b> <span className="muted">· {t.broker}</span>
                      <div className="muted">
                      {fmtDate(t.first_pickup)} → {t.last_delivery ? fmtDate(t.last_delivery) : "?"}
                    </div>
                    <div className="muted">
                      {num(t.loaded_miles)} loaded mi{t.empty_miles > 0 && <> · {num(t.empty_miles)} empty mi</>}
                    </div>
                    </div>
                    <b>{money(t.net_pay)}</b>
                  </button>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {/* income drill */}
      {drill === "income" && (
        <Modal title="Income in this period" onClose={() => setDrill(null)} wide>
          <div className="list-wrap" style={{ marginBottom: 12 }}>
            <button className="list-item" onClick={() => setDrill("trip_pay")}>
              <span>Trip pay after the 20% cut</span><b>{money(data.tripPay)}</b>
            </button>
            <button className="list-item" onClick={() => setDrill("fuel_discount")}>
              <span>Fuel discounts</span>
              <b>{money(data.pInc.filter((i) => i.kind === "fuel_discount").reduce((s, i) => s + Number(i.amount), 0))}</b>
            </button>
            <button className="list-item" onClick={() => setDrill("refund")}>
              <span>Refunds</span>
              <b>{money(data.pInc.filter((i) => i.kind === "refund").reduce((s, i) => s + Number(i.amount), 0))}</b>
            </button>
          </div>
        </Modal>
      )}
      {drill === "trip_pay" && (
        <Modal title="Trip pay" onClose={() => setDrill("income")} wide>
          <ListRows rows={data.pTrips.map((t) => ({
            id: t.id, top: `${t.broker}`, sub: fmtDate(t.first_pickup), amt: `+ ${money(t.net_pay)}`,
          }))} empty="No trip pay in this period." />
        </Modal>
      )}
      {(drill === "fuel_discount" || drill === "refund") && (
        <Modal title={drill === "refund" ? "Refunds" : "Fuel discounts"} onClose={() => setDrill("income")} wide>
          <ListRows
            rows={data.pInc.filter((i) => i.kind === drill).map((i) => ({
              id: i.id, top: i.note || (i.load_number ? `Load ${i.load_number}` : "—"),
              sub: fmtDate(i.on_date), amt: `+ ${money(i.amount)}`,
              del: async () => { await deleteIncome(i.id); refresh(); },
            }))}
            empty="Nothing recorded here for this period."
          />
        </Modal>
      )}

      {/* expenses drill */}
      {drill === "expenses" && (
        <Modal title="Expenses in this period" onClose={() => setDrill(null)} wide>
          <div className="list-wrap">
            {Object.keys(CAT_LABEL).map((k) => (
              <button key={k} className="list-item" onClick={() => setDrill("cat:" + k)}>
                <span>{CAT_LABEL[k]}</span><b>{money(byCat[k] || 0)}</b>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {drill?.startsWith?.("cat:") && (
        <Modal title={CAT_LABEL[drill.slice(4)]} onClose={() => setDrill("expenses")} wide>
          <ListRows
            rows={data.pExp.filter((e) => e.category === drill.slice(4)).map((e) => ({
              id: e.id,
              top: (e.location || "—") + (e.fuel_type ? ` · ${e.fuel_type}` : "") + (e.paid_with === "own" ? " · own money" : ""),
              sub: fmtDateTime(e.at), amt: `− ${money(e.amount)}`,
              del: async () => { await deleteExpense(e.id); refresh(); },
            }))}
            empty="No entries in this category for this period."
          />
        </Modal>
      )}
    </div>
  );
}

function ListRows({ rows, empty }) {
  if (!rows.length) return <Empty text={empty} />;
  return (
    <div className="list-wrap">
      {rows.map((r) => (
        <div key={r.id} className="list-item">
          <div><div style={{ fontWeight: 600 }}>{r.top}</div><div className="muted">{r.sub}</div></div>
          <div className="row">
            <b>{r.amt}</b>
            {r.del && (
              <button className="modal-close" aria-label="Delete entry"
                onClick={() => confirm("Delete this entry?") && r.del()}>{Icon.trash(16)}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
