/**
 * Talking to the Firebase emulators from a test: clearing them, seeding
 * Firestore past the rules, and reading the auth emulator's outbox.
 * Uses the emulators' own REST endpoints, so it needs no SDK.
 */
const { PROJECT_ID, AUTH_EMULATOR, FIRESTORE_EMULATOR } = require("./env");

const DOCUMENTS = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
// "owner" is the Firestore emulator's admin token: it skips the security rules
const OWNER = { Authorization: "Bearer owner" };

async function call(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok)
    throw new Error(`${options.method || "GET"} ${url} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** Every account and document gone (once per run: both browsers share the emulators). */
async function clearEmulators() {
  await call(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });
  await call(
    `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
}

/** A plain JSON value as a Firestore REST value. */
function toValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toValue(v)])),
      },
    };
  }
  return { stringValue: String(value) };
}

/** Write `data` to collection/id as an admin (the rules forbid client writes to worlds). */
async function seedDoc(collection, id, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)]));
  await call(`${DOCUMENTS}/${collection}/${id}`, {
    method: "PATCH",
    headers: { ...OWNER, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
}

/** The verification link the auth emulator "sent" to `email`. */
async function verifyLinkFor(email) {
  const { oobCodes } = await call(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const code = oobCodes.filter((c) => c.email === email && c.requestType === "VERIFY_EMAIL").pop();
  if (!code) throw new Error(`No verification email for ${email}`);
  return code.oobLink;
}

module.exports = { clearEmulators, seedDoc, verifyLinkFor };
