// Supabase Edge Function: read-document
// Receives a base64 file, asks Claude to read it, returns structured JSON.
// The Anthropic API key lives ONLY here as a Supabase secret — never in the app.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `You read trucking paperwork for a one-truck company and return ONLY a JSON object, no markdown, no backticks, no commentary.

First decide what the document is, then use the matching shape:

1. A rate confirmation (load offer with pickup/delivery and pay):
{"type":"ratecon","broker":"company offering the load","load_number":"reference/load number or null","ratecon_date":"YYYY-MM-DD date of the document or null","gross_pay":number (total rate before any deductions),"stops":[{"kind":"pickup" or "delivery","datetime":"YYYY-MM-DDTHH:MM" (use 09:00 if no time given),"address":"full street address, city, state, zip as written"}]}
List every pickup and every delivery as its own stop, in the order they happen.

2. A fuel receipt:
{"type":"fuel","amount":number (total paid),"datetime":"YYYY-MM-DDTHH:MM","location":"station name, city, state","fuel_type":"diesel" or "reefer"}
If the receipt shows both diesel and reefer, use the larger amount's type and the grand total.

3. Any other expense receipt (toll, repair, parts, truck wash, scale/weighing, fine, insurance, escrow):
{"type":"expense","category":"toll"|"repairs"|"wash"|"weighing"|"penalty"|"insurance"|"escrow","amount":number,"datetime":"YYYY-MM-DDTHH:MM","location":"where, city, state","note":"one short line saying what it was"}

Rules: numbers are plain numbers with no $ or commas. Dates in ISO format. If a field truly cannot be read, use null. If the image is unreadable or not one of these documents, return {"type":"unknown","reason":"one short sentence why"}.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const key = Deno.env.get("ANTHROPIC_API_KEY");
    if (!key) throw new Error("ANTHROPIC_API_KEY secret is not set on this Supabase project.");

    const { media_type, data } = await req.json();
    if (!media_type || !data) throw new Error("media_type and data (base64) are required.");

    const block = media_type === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type, data } }
      : { type: "image", source: { type: "base64", media_type, data } };

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{ role: "user", content: [block, { type: "text", text: PROMPT }] }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${t.slice(0, 300)}`);
    }

    const out = await res.json();
    const text = (out.content || []).map((c) => c.text || "").join("").trim()
      .replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(text);

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ type: "error", reason: String(e.message || e) }), {
      status: 400,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
