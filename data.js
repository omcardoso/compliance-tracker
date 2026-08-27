export const config = { runtime: "edge" };

export default async function handler(req) {
  const SCRIPT_URL = process.env.VITE_SCRIPT_URL;
  if (!SCRIPT_URL) {
    return new Response(JSON.stringify({ error: "VITE_SCRIPT_URL not set" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  const VALID = [
    "getCompanies", "getUsers", "getFilings", "getSteps",
    "sendComplianceEmail"
  ];
  if (!action || !VALID.includes(action)) {
    return new Response(JSON.stringify({ error: "Invalid action: " + action }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  }

  const year = searchParams.get("year") || "";
  let url = SCRIPT_URL + "?action=" + action;
  if (year) url += "&year=" + year;

  try {
    const upstream = await fetch(url);
    const data = await upstream.text();
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
