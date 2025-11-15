import WebSocket from "ws";

type LatLng = { lat: number; lng: number };

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return undefined;
}

function parseLatLng(input?: string): LatLng | null {
  if (!input) return null;
  const parts = input.split(",").map((s) => s.trim());
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function usage(): never {
  console.log(
    [
      'Usage: npx tsx client.ts --from "lat,lng" --to "lat,lng" [--url ws://localhost:8080]',
      "",
      "Examples:",
      '  npx tsx client.ts --from "23.7809,90.2792" --to "23.7510,90.3940"',
      '  npx tsx client.ts --from "40.7128,-74.0060" --to "40.7306,-73.9866" --url ws://localhost:8080',
    ].join("\n")
  );
  process.exit(1);
}

async function main() {
  const url = getArg("--url") || process.env.WS_URL || "ws://localhost:8080";
  const from = parseLatLng(getArg("--from"));
  const to = parseLatLng(getArg("--to"));

  if (!from || !to) usage();

  const payload = {
    location: from,
    destination: to,
  };

  console.log("[client] Connecting to", url);
  const ws = new WebSocket(url);

  ws.on("open", () => {
    console.log("[client] Connected. Sending ride request...");
    ws.send(JSON.stringify(payload));
  });

  ws.on("message", (data) => {
    try {
      const text = typeof data === "string" ? data : data.toString("utf8");
      const parsed = JSON.parse(text);
      console.log("[client] Response:", parsed);
    } catch (e) {
      console.log("[client] Raw response:", data.toString());
    } finally {
      ws.close();
    }
  });

  ws.on("error", (err) => {
    console.error("[client] error:", err);
    process.exitCode = 1;
  });

  ws.on("close", () => {
    console.log("[client] Connection closed.");
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
