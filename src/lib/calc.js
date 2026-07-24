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
 * Work out every leg of a trip from its stops, chained onto the prior
 * trip's last delivery (if any).
 *
 * The rule: a leg is EMPTY only when driving straight from a delivery to
 * a pickup — that's the one moment the truck has genuinely dropped
 * everything it was carrying and is running to collect new freight.
 * Every other transition is LOADED:
 *   pickup  -> pickup   loaded (already carrying, going to add more)
 *   pickup  -> delivery loaded (carrying it there)
 *   delivery-> delivery loaded (multi-drop: partial unload, rest still on board)
 *   delivery-> pickup   EMPTY  (fully unloaded, driving to the next load)
 * This one rule correctly covers 2 pickups + 1 delivery, 1 pickup + several
 * deliveries (each delivery-to-delivery leg stays loaded), and genuine
 * deliver-then-repickup gaps inside a single rate con.
 *
 * prevDelivery = last drop-off stop of the trip that most recently ended
 * before this one — chained in as the first entry so the exact same rule
 * measures the empty run into this trip's first pickup.
 * priorTripLabel = short text naming that prior trip, so the leg note is
 * specific ("Empty drive from the XYZ Co. trip delivered Jul 10...")
 * instead of a generic phrase — makes it easy to verify which trip's
 * delivery address was actually used.
 */
export async function computeLegs(stops, prevDelivery, priorTripLabel) {
  const ordered = [...stops].sort((a, b) => new Date(a.at) - new Date(b.at));
  const chain = prevDelivery ? [{ ...prevDelivery, __prior: true }, ...ordered] : ordered;

  const legs = [];
  let loadedTotal = 0;
  let emptyTotal = 0;

  for (let i = 0; i < chain.length - 1; i++) {
    const from = chain[i];
    const to = chain[i + 1];
    const miles = await drivingMiles(from, to);
    if (miles == null) continue;

    const isEmpty = from.kind === "delivery" && to.kind === "pickup";
    if (isEmpty) {
      const note = from.__prior
        ? `Empty drive from the ${priorTripLabel || "previous"} trip's last delivery to this pickup`
        : "Empty drive inside this trip — fully dropped off, heading to the next pickup";
      legs.push(leg("empty", from, to, miles, note));
      emptyTotal += miles;
    } else {
      legs.push(leg("loaded", from, to, miles, "Carrying freight"));
      loadedTotal += miles;
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

/**
 * The trip that most recently ended before the given pickup time — its last
 * delivery address is where the empty miles to the new trip start from.
 */
export function findPriorTrip(trips, beforeTime) {
  const t = new Date(beforeTime).getTime();
  return trips
    .filter((tr) => tr.last_delivery && new Date(tr.last_delivery).getTime() <= t)
    .sort((a, b) => new Date(b.last_delivery) - new Date(a.last_delivery))[0] || null;
}

/** Short "Broker (delivered <date>)" text used to name the prior trip in leg notes. */
export function priorTripLabel(trip) {
  if (!trip) return null;
  return `${trip.broker}${trip.last_delivery ? ` — delivered ${fmtDate(trip.last_delivery)}` : ""}`;
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
