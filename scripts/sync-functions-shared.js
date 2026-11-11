/**
 * Copies the game code the server shares (world validation, the community
 * rules, the daily and reminder rules and the level generator they use) into functions/shared/, because a
 * functions deploy only uploads functions/.
 *
 *   node scripts/sync-functions-shared.js          copy
 *   node scripts/sync-functions-shared.js --check  fail if any copy is stale
 *
 * Runs before every functions deploy (firebase.json predeploy); CI runs the
 * check so the server never validates differently from the game. Keep each
 * file's relative imports valid under functions/shared/ (daily/rules.js
 * imports ../pcg/generator.js, which lands next to it).
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
/** [source under app/, target under functions/shared/] */
const FILES = [
  ["worlds/spec.js", "spec.js"],
  ["daily/rules.js", "daily/rules.js"],
  ["pcg/generator.js", "pcg/generator.js"],
  ["worlds/community.js", "worlds/community.js"],
  ["reminders/rules.js", "reminders/rules.js"],
];

const jobs = FILES.map(([from, to]) => {
  const source = path.join(root, "app", from);
  const header = `// GENERATED from app/${from} by scripts/sync-functions-shared.js. Do not edit.\n`;
  return {
    target: path.join(root, "functions", "shared", to),
    label: `functions/shared/${to}`,
    wanted: header + fs.readFileSync(source, "utf8"),
  };
});

if (process.argv.includes("--check")) {
  const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
  const stale = jobs.filter((job) => read(job.target) !== job.wanted);
  stale.forEach((job) =>
    console.error(`${job.label} is stale: run node scripts/sync-functions-shared.js`),
  );
  if (stale.length) process.exit(1);
  jobs.forEach((job) => console.log(`${job.label} is up to date`));
} else {
  jobs.forEach((job) => {
    fs.mkdirSync(path.dirname(job.target), { recursive: true });
    fs.writeFileSync(job.target, job.wanted);
    console.log(`synced ${job.label}`);
  });
}
