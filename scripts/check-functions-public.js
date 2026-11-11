/**
 * Calls every callable function without signing in and fails if any answers
 * 403, which is what a lost "public invoker" permission looks like. A public
 * function answers an unauthenticated call with a JSON error (400 or 401).
 *
 *   node scripts/check-functions-public.js [baseUrl]
 *
 * The callables are the `export const <name> = callable(` / `onCall(` exports
 * of functions/index.js (read as text: importing it would start firebase-admin);
 * onRequest and onSchedule exports are skipped.
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_BASE = "https://asia-south1-dinos-adventure.cloudfunctions.net";
const INDEX = path.join(__dirname, "..", "functions", "index.js");

/** Names of the callable functions exported from functions/index.js's source. */
function callableNames(source) {
  const names = [];
  const pattern = /^export const (\w+)\s*=\s*(?:callable|onCall)\(/gm;
  let match;
  while ((match = pattern.exec(source))) names.push(match[1]);
  return names;
}

/** The functions that don't answer publicly: [{ name, problem }]. */
async function findClosed(base, names) {
  const closed = [];
  for (const name of names) {
    try {
      const response = await fetch(`${base.replace(/\/+$/, "")}/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {} }),
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 403) closed.push({ name, problem: "answered 403" });
    } catch (error) {
      closed.push({ name, problem: `no answer (${error.name})` });
    }
  }
  return closed;
}

async function main(base = DEFAULT_BASE) {
  const names = callableNames(fs.readFileSync(INDEX, "utf8"));
  if (!names.length) {
    console.error("No callable functions found in functions/index.js.");
    return 1;
  }
  const closed = await findClosed(base, names);
  for (const { name, problem } of closed) console.error(`${name}: ${problem}`);
  if (closed.length) {
    console.error(`${closed.length} of ${names.length} functions are not public.`);
    return 1;
  }
  console.log(`All ${names.length} callable functions answer without signing in.`);
  return 0;
}

module.exports = { callableNames, findClosed };

if (require.main === module) {
  main(process.argv[2]).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
