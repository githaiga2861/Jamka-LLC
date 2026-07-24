import { supabase, sha256 } from "./supabase.js";
import { computeLegs, findPriorTrip, priorTripLabel } from "./calc.js";

// ---------- PIN ----------
export async function checkPin(pin) {
  const { data, error } = await supabase.from("settings").select("pin_hash").eq("id", 1).single();
  if (error) throw error;
  return data.pin_hash === (await sha256(pin));
}
export async function changePin(pin) {
  const { error } = await supabase.from("settings").upsert({ id: 1, pin_hash: await sha256(pin) });
  if (error) throw error;
}

// ---------- Trips ----------
export async function listTrips() {
  const { data, error } = await supabase
    .from("trips")
    .select("*, stops(*)")
    .order("first_pickup", { ascending: false });
  if (error) throw error;
  for (const t of data) t.stops?.sort((a, b) => new Date(a.at) - new Date(b.at));
  return data;
}

export async function saveTrip(trip, stops) {
  const { data, error } = await supabase.from("trips").insert(trip).select().single();
  if (error) throw error;
  const rows = stops.map((s, i) => ({ ...s, trip_id: data.id, position: i }));
  const { error: e2 } = await supabase.from("stops").insert(rows);
  if (e2) throw e2;
  return data;
}

export async function deleteTrip(id) {
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Re-measures loaded and empty miles for every saved trip, oldest first, so
 * each trip's empty miles correctly start from the delivery address of the
 * trip that most recently ended before it — even trips saved before this
 * chain existed or before a trip that now sits earlier in time was added.
 */
export async function recomputeAllMileage(trips) {
  const ordered = [...trips]
    .filter((t) => t.first_pickup)
    .sort((a, b) => new Date(a.first_pickup) - new Date(b.first_pickup));

  const done = [];
  for (const trip of ordered) {
    const stops = (trip.stops || [])
      .filter((s) => s.lat != null)
      .sort((a, b) => new Date(a.at) - new Date(b.at));
    if (!stops.length) { done.push(trip); continue; }

    const prior = findPriorTrip(done, stops[0].at);
    const prevDelivery = prior
      ? [...(prior.stops || [])].filter((s) => s.kind === "delivery" && s.lat != null)
          .sort((a, b) => new Date(a.at) - new Date(b.at)).slice(-1)[0]
      : null;

    const { legs, loadedMiles, emptyMiles } = await computeLegs(stops, prevDelivery, priorTripLabel(prior));
    const { error } = await supabase
      .from("trips")
      .update({ loaded_miles: loadedMiles, empty_miles: emptyMiles, legs })
      .eq("id", trip.id);
    if (error) throw error;

    done.push({ ...trip, loaded_miles: loadedMiles, empty_miles: emptyMiles, legs });
  }
  return done;
}

// ---------- Expenses ----------
export async function listExpenses() {
  const { data, error } = await supabase.from("expenses").select("*").order("at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function addExpense(row) {
  const { error } = await supabase.from("expenses").insert(row);
  if (error) throw error;
}
export async function deleteExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Incomes (fuel discounts + refunds) ----------
export async function listIncomes() {
  const { data, error } = await supabase.from("incomes").select("*").order("on_date", { ascending: false });
  if (error) throw error;
  return data;
}
export async function addIncome(row) {
  const { error } = await supabase.from("incomes").insert(row);
  if (error) throw error;
}
export async function deleteIncome(id) {
  const { error } = await supabase.from("incomes").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Documents ----------
export async function listDocuments() {
  const { data, error } = await supabase.from("documents").select("*").order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function uploadDocument(section, file) {
  const path = `${section}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("jamka-docs").upload(path, file);
  if (error) throw error;
  const { error: e2 } = await supabase.from("documents").insert({ section, name: file.name, path });
  if (e2) throw e2;
}
export async function documentUrl(path) {
  const { data, error } = await supabase.storage.from("jamka-docs").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function deleteDocument(doc) {
  await supabase.storage.from("jamka-docs").remove([doc.path]);
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw error;
}
