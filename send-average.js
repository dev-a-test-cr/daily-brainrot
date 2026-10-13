// Envoie la note moyenne du jour sur Discord (Node 20+, aucune dépendance).
// Variables d'environnement : FIREBASE_URL, DISCORD_WEBHOOK
const fs = require("fs");

const FIREBASE_URL = (process.env.FIREBASE_URL || "").replace(/\/$/, "");
const WEBHOOK = process.env.DISCORD_WEBHOOK;
const manual = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";

if (!FIREBASE_URL || !WEBHOOK) {
  console.error("FIREBASE_URL ou DISCORD_WEBHOOK manquant.");
  process.exit(1);
}

// Date et heure à Paris
const parts = {};
new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", year: "numeric", month: "numeric", day: "numeric",
  hour: "numeric", hourCycle: "h23"
}).formatToParts(new Date()).forEach(p => { if (p.type !== "literal") parts[p.type] = parseInt(p.value, 10); });

// Le workflow se lance à 18 h et 19 h UTC pour gérer l'heure d'été / d'hiver :
// on n'envoie que lorsqu'il est réellement 20 h à Paris.
if (!manual && parts.hour !== 20) {
  console.log("Il est " + parts.hour + " h à Paris, rien à envoyer.");
  process.exit(0);
}

const day = Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86400000);
const list = JSON.parse(fs.readFileSync("brainrots.json", "utf8"));
const b = list[((day % list.length) + list.length) % list.length];

(async () => {
  const res = await fetch(`${FIREBASE_URL}/ratings/${day}.json`);
  const data = (await res.json()) || {};
  const vals = Object.values(data).filter(v => Number.isInteger(v) && v >= 1 && v <= 5);
  const avg = vals.length ? (vals.reduce((a, c) => a + c, 0) / vals.length).toFixed(1).replace(".", ",") : null;

  const content = avg
    ? `⭐ **${b.name}** : note moyenne du jour **${avg} / 5** (${vals.length} vote${vals.length > 1 ? "s" : ""})`
    : `😴 **${b.name}** : personne n'a voté aujourd'hui.`;

  const post = await fetch(WEBHOOK, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content })
  });
  if (!post.ok) { console.error("Échec Discord :", post.status); process.exit(1); }
  console.log("Envoyé :", content);
})();
