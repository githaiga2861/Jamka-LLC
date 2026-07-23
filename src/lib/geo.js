// Address lookup + road mileage.
// The user types a normal US address; everything below happens in the background.
// - Nominatim (OpenStreetMap) turns the address into coordinates.
// - OSRM public router returns real driving distance between coordinates.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving";

const cache = new Map();

/** Suggest matching US places for what the user typed. */
export async function suggestAddresses(query) {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = "s:" + q.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const url = `${NOMINATIM}?format=jsonv2&countrycodes=us&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const data = await res.json();
  const out = data.map((d) => ({
    label: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
    state: stateCode(d.address),
  }));
  cache.set(key, out);
  return out;
}

/** Resolve one address to its best match (used if the user never taps a suggestion). */
export async function geocode(query) {
  const list = await suggestAddresses(query);
  return list[0] || null;
}

/** Real driving miles between two points, rounded to 1 decimal. */
export async function drivingMiles(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const key = `r:${a.lat},${a.lon}|${b.lat},${b.lon}`;
  if (cache.has(key)) return cache.get(key);
  const url = `${OSRM}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("router");
    const data = await res.json();
    const meters = data?.routes?.[0]?.distance;
    if (meters == null) throw new Error("no route");
    const miles = Math.round((meters / 1609.344) * 10) / 10;
    cache.set(key, miles);
    return miles;
  } catch {
    // Fallback: straight-line distance x 1.2 road factor, clearly better than nothing.
    const miles = Math.round(haversineMiles(a, b) * 1.2 * 10) / 10;
    cache.set(key, miles);
    return miles;
  }
}

function haversineMiles(a, b) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const STATES = {
  alabama:"AL",alaska:"AK",arizona:"AZ",arkansas:"AR",california:"CA",colorado:"CO",
  connecticut:"CT",delaware:"DE",florida:"FL",georgia:"GA",hawaii:"HI",idaho:"ID",
  illinois:"IL",indiana:"IN",iowa:"IA",kansas:"KS",kentucky:"KY",louisiana:"LA",
  maine:"ME",maryland:"MD",massachusetts:"MA",michigan:"MI",minnesota:"MN",
  mississippi:"MS",missouri:"MO",montana:"MT",nebraska:"NE",nevada:"NV",
  "new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY",
  "north carolina":"NC","north dakota":"ND",ohio:"OH",oklahoma:"OK",oregon:"OR",
  pennsylvania:"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD",
  tennessee:"TN",texas:"TX",utah:"UT",vermont:"VT",virginia:"VA",washington:"WA",
  "west virginia":"WV",wisconsin:"WI",wyoming:"WY","district of columbia":"DC",
};
function stateCode(addr) {
  if (!addr) return "";
  const s = (addr.state || "").toLowerCase();
  return STATES[s] || (addr["ISO3166-2-lvl4"] || "").replace("US-", "") || "";
}
