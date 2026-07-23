import { drivingMiles } from "./geo.js";

export const UT_CUT = 0.2; // United Transport keeps 20% of gross

export const money = (n) =>
  (n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
export const num = (n) => (n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 1 });

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const fmtDateTime = (d) =>
  new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });

export function splitPay(gross) {
  const g = Number(gross) || 0;
  const cut = Math.round(g * UT_CUT * 100) / 100;
  return { gross: g, cut, net: Math.round((g - cut) * 100) / 100 };
}

/**
 * Work out every leg of a trip from its stops.
 * Stops are sorted by time; a leg is LOADED while at least one load is on
 * the truck (picked up, not yet delivered), and EMPTY otherwise — which
 * covers 2 pickups + 1 delivery, deliver-then-pick-up-again, and so on.
 * prevDelivery = last drop-off of the previous trip, for empty miles to
 * reach this trip's first pickup.
 */
export async function computeLegs(stops, prevDelivery) {
  const ordered = [...stops].sort((a, b) => new Date(a.at) - new Date(b.at));
  const legs = [];
  let loadedTotal = 0;
  let emptyTotal = 0;

  if (prevDelivery && ordered.length) {
    const miles = await drivingMiles(prevDelivery, ordered[0]);
    if (miles != null) {
      legs.push(leg("empty", prevDelivery, ordered[0], miles, "Drive from last trip's drop-off to this pickup"));
      emptyTotal += miles;
    }
  }

  let onBoard = 0;
  for (let i = 0; i < ordered.length - 1; i++) {
    onBoard += ordered[i].kind === "pickup" ? 1 : -1;
    if (onBoard < 0) onBoard = 0;
    const from = ordered[i];
    const to = ordered[i + 1];
    const miles = await drivingMiles(from, to);
    if (miles == null) continue;
    if (onBoard > 0) {
      legs.push(leg("loaded", from, to, miles, "Carrying freight"));
      loadedTotal += miles;
    } else {
      legs.push(leg("empty", from, to, miles, "Empty drive inside this trip (dropped off, heading to next pickup)"));
      emptyTotal += miles;
    }
  }

  return {
    legs,
    loadedMiles: Math.round(loadedTotal * 10) / 10,
    emptyMiles: Math.round(emptyTotal * 10) / 10,
  };
}

function leg(type, from, to, miles, note) {
  return {
    type,
    miles,
    note,
    from: shortPlace(from),
    to: shortPlace(to),
  };
}
function shortPlace(p) {
  const label = p.resolved || p.address || p.label || "";
  return label.split(",").slice(0, 2).join(",") + (p.state ? `, ${p.state}` : "");
}

/** Find the trip whose window (first pickup .. last delivery, padded 1 day) contains a moment. */
export function matchTripByDate(trips, when) {
  const t = new Date(when).getTime();
  const DAY = 86400000;
  let best = null;
  let bestGap = Infinity;
  for (const trip of trips) {
    if (!trip.first_pickup || !trip.last_delivery) continue;
    const a = new Date(trip.first_pickup).getTime() - DAY;
    const b = new Date(trip.last_delivery).getTime() + DAY;
    if (t >= a && t <= b) return trip;
    const gap = Math.min(Math.abs(t - a), Math.abs(t - b));
    if (gap < bestGap) { bestGap = gap; best = trip; }
  }
  return bestGap <= 3 * DAY ? best : null;
}

/** Match a fuel discount to a trip by load number first, then by date. */
export function matchDiscount(trips, loadNumber, onDate) {
  if (loadNumber) {
    const byLoad = trips.find(
      (t) => (t.load_number || "").trim().toLowerCase() === loadNumber.trim().toLowerCase()
    );
    if (byLoad) return byLoad;
  }
  return onDate ? matchTripByDate(trips, onDate) : null;
}
