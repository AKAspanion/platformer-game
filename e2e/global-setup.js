const { clearEmulators } = require("./emulators");

/** Start every run from empty emulators (a reused local emulator keeps old data). */
module.exports = async () => {
  await clearEmulators();
};
