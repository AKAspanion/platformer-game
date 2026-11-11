import Game from "./game";
import { drawHat, SKIN_PALETTES, FIREBALL_PALETTES, tintFrames, hatImage } from "./game/cosmetics";
import Screen from "./screen";
import GameEngine from "./engine";
import Controller from "./controller";
import MouseInput from "./controller/mouse-input";
import { controlOpacity } from "./controller/opacity";
import { MAX_HEARTS, POWERUP_TICKS } from "./game/player";
import { loadIcons } from "./game/powerups";

import {
  uid,
  getData,
  setData,
  LEVELS,
  populateHelp,
  loadHelpIcons,
  populateLinks,
  populatePortals,
  preLoadAndFetch,
} from "./util";
import { settings, vibrate } from "./util/settings";
import { COMBO_WINDOW } from "./game/combo";
import { track, armAnalytics, setAnalyticsEnabled, appOpenParams } from "./analytics";
import { isPremium, setPremium, readPremiumFromUrl, canToggleLocally } from "./util/premium";
import {
  FINISH,
  records,
  dailySeed,
  createDailySession,
  createEndlessSession,
  createCustomSession,
} from "./modes";
import { requestSpec, worlds } from "./creator";
import { auth } from "./auth";
import { reminders } from "./reminders/push.js";
import { createPrompt as createReminderPrompt } from "./reminders/prompt.js";
import { leaderboard } from "./daily/leaderboard";
import { boardView, BOARD_FAILED } from "./daily/board-view";
import { createStreak } from "./daily/streak";
import { createPending, errorCode, isFinalRefusal } from "./daily/pending";
import { shareText, shareRun } from "./daily/share";
import { DAILY_LEVELS } from "./daily/rules.js";
import { friendlyError } from "./firebase";
import { endlessBoard } from "./modes/endless-board";
import { createEndlessPending } from "./modes/endless-pending";
import { createRunTickets } from "./modes/run-ticket";
import { firestoreEndless } from "./firebase/endless";
import { MIN_LEVEL } from "./modes/endless-rules";
import { firebaseAuthBackend } from "./firebase/auth";
import { firestoreWorlds } from "./firebase/worlds";
import { FirestoreRepository, mergeWorlds, starterWorlds } from "./worlds/repository";
import { newWorld, matchWorlds, searchTerms, sanitizeWorld, ANONYMOUS } from "./worlds/spec";
import { community as social } from "./worlds/community-client";
import { formatCount, weekNote, isBuiltIn, worldLink, linkedWorldId } from "./worlds/community";
import { publishThumb } from "./worlds/thumb";
import { createPlayed } from "./worlds/played.js";
import { previewImage } from "./gen";
import { getSkin } from "./util/registry";
import {
  createRecorder,
  createGhostStore,
  ghostAt,
  SAMPLE_EVERY,
  GHOST_ALPHA,
} from "./ghosts/ghost";
import { createOnboarding } from "./onboarding/onboarding";
import { createCampaign, starsFor, targetTime, starCount, STAR } from "./campaign";
import { createWallet } from "./progress/wallet";
import { createLastSeen } from "./progress/last-seen";
import { createStats } from "./progress/stats";
import { featsFrom } from "./rewards/feed";
import { createNest, hatchLabel, DUPLICATE_COINS } from "./rewards/eggs";
import {
  createQuests,
  claimChest,
  payFinished,
  metEnemies,
  unlockedModes,
  CHEST_KEYS,
  CHEST_COINS,
} from "./rewards/quests";
import { createFollower, companionFrames, COMPANION_SIZE } from "./game/companion";
import { createEarnings } from "./progress/earn";
import { readLocal, writeLocal, resetLocal } from "./progress/save";
import { createCloudSave } from "./progress/cloud";
import { firestoreSaves } from "./firebase/saves";
import { profiles } from "./profiles";
import { createProfileGate } from "./profiles/gate";
import { avatarCanvas, rowLooks, loadProfiles } from "./profiles/avatar";
import { dayNumber } from "./profiles/rules";
import {
  SECRET_STARS,
  campaignStars,
  secretWorldOpen,
  bossRushOpen,
  bossesBeaten,
} from "./progress/unlocks";
import { CATALOG, FREE, itemOf, isHatchOnly } from "./shop/catalog";
import { ACHIEVEMENTS } from "./achievements/catalog";
import { newlyEarned, progressToward } from "./achievements/check";
import { createSecretSession } from "./modes/secret";
import { createBossRushSession, bossLevels } from "./modes/bossrush";
import { SPIT_COLORS } from "./game/projectile-look";
import { drawShieldGlow, glowFlickers } from "./game/shield-fx";

import areas from "./areas";

readPremiumFromUrl();
preLoadAndFetch();
populateLinks();
const isTouchesEnabled = "ontouchstart" in document.documentElement;
// the pause button is a touch button only on a touch device (see app/index.css)
document.documentElement.classList.toggle("no-touch", !isTouchesEnabled);
populateHelp(isTouchesEnabled);

// Firebase loads only for players who signed in before, or when they open Worlds
auth.use(firebaseAuthBackend());
auth.resume();

let loadingActive = false;
let controllerActive = false;

const $ = (id) => document.getElementById(id);
const homeScreen = $("homeScreen");
const pauseScreen = $("pauseScreen");
const pauseTitle = $("pauseTitle");
const pauseScore = $("pauseScore");
const pauseBest = $("pauseBest");
const resumeBtn = $("resumeBtn");
const retryBtn = $("retryBtn");
const homeBtn = $("homeBtn");
const playBtn = $("playBtn");
const pauseBtn = $("pauseBtn");
const helpScreen = $("helpScreen");
const infoScreen = $("infoScreen");
const portalScreen = $("portalScreen");
const settingsScreen = $("settingsScreen");
const premiumScreen = $("premiumScreen");
const createScreen = $("createScreen");
const loginScreen = $("loginScreen");
const verifyScreen = $("verifyScreen");
const leaderboardScreen = $("leaderboardScreen");
const deleteScreen = $("deleteScreen");
const controllers = document.querySelectorAll(".controller");
const loadingScreen = $("loadingScreen");
const progressValue = $("progressValue");
const persistentControllers = document.querySelectorAll(".persistent-controller");

const show = (el, value) => (el.style.visibility = value ? "visible" : "hidden");
const isVisible = (el) => getComputedStyle(el).visibility === "visible";

const toggleControllers = (value) => {
  controllerActive = value;
  controllers.forEach((c) => show(c, isTouchesEnabled && value));
  persistentControllers.forEach((c) => show(c, value));
};

const toggleLoadingScreen = (value) => {
  loadingActive = value;
  show(loadingScreen, value);
};

const setProgressValue = (value) => {
  progressValue.style.width = `${value}%`;
};

/** Touch button size from the screen: bigger on tablets, Settings can scale it. */
const sizeControls = () => {
  const base = Math.min(window.innerWidth, window.innerHeight);
  const medium = Math.max(56, Math.min(112, base * 0.16));
  const scale = { s: 0.8, m: 1, l: 1.25 }[settings.get("controlSize")] || 1;
  document.documentElement.style.setProperty("--ctrl", `${Math.round(medium * scale)}px`);
};

/** Touch button opacity from Settings, as the --ctrl-idle and --ctrl-pressed CSS variables. */
const applyControlOpacity = () => {
  const { idle, pressed } = controlOpacity(settings.get("controlOpacity"));
  const style = document.documentElement.style;
  style.setProperty("--ctrl-idle", idle);
  style.setProperty("--ctrl-pressed", pressed);
};
applyControlOpacity();

/** Safe-area insets in px (notches, gesture bar), measured with a probe. */
const probe = document.createElement("div");
probe.style.cssText =
  "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
document.body.appendChild(probe);
const safeArea = () => {
  const s = getComputedStyle(probe);
  return {
    top: parseFloat(s.paddingTop) || 0,
    right: parseFloat(s.paddingRight) || 0,
    bottom: parseFloat(s.paddingBottom) || 0,
    left: parseFloat(s.paddingLeft) || 0,
  };
};

/** Landscape lock: the manifest asks for it; fullscreen + lock helps in a browser. */
const lockLandscape = () => {
  if (!isTouchesEnabled) return;
  try {
    const root = document.documentElement;
    const full = document.fullscreenElement
      ? Promise.resolve()
      : root.requestFullscreen
        ? root.requestFullscreen({ navigationUI: "hide" })
        : Promise.resolve();
    full
      .then(
        () => screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape"),
      )
      .catch(() => {});
  } catch (error) {
    // not supported: the rotate prompt covers portrait
  }
};

window.addEventListener("load", function () {
  "use strict";

  let areaId = 1;
  let loaded = false;
  let paused = false;
  let worldChanged = false;
  let session = null; // null = story; otherwise a mode from app/modes
  let retry = null; // () => void, restarts after Game Over

  clearInterval(loadInterval); // the loading bar's timer, from index.html's inline script
  toggleLoadingScreen(false);
  setProgressValue(0);
  sizeControls();

  const controller = new Controller();
  const icons = loadIcons();
  let campaign = createCampaign();
  const wallet = createWallet();
  const lastSeen = createLastSeen(); // "Show when I was last online": the account's, via cloud save
  const stats = createStats();
  const nest = createNest();
  const quests = createQuests(undefined, undefined, () => {
    const saved = readLocal().campaign;
    return { unlocked: unlockedModes(saved), metEnemies: metEnemies(saved) };
  });
  const eggsFoundNow = new Set(); // found this session: gone even when the save can't be written
  const follower = createFollower();
  let wornCompanion = "none"; // the companion drawn in this level
  let bossBounced = false; // a fireball bounced off a boss shield in this level
  const earnings = createEarnings();
  const isCampaignLevel = (id) => !session && LEVELS.some((l) => l.id === id);

  // ghosts: the fastest finish of each campaign level, kept on this device
  const recorder = createRecorder();
  const ghostStore = createGhostStore();
  const onboarding = createOnboarding();
  let keptGhost = null; // the ghost replayed in the level being played
  let ghostOn = settings.get("ghost") !== false;
  const classicFrames = () => game.world.player.skinCache.classic; // untinted: no skin
  /** The name of the player's current animation (its key in the frame sets). */
  const animName = (player) => {
    for (const key in player.frameSets) {
      if (player.frameSets[key] === player.animator.frameSet) return key;
    }
    return "idleRight";
  };
  let cameFrom = null; // the area the player just walked out of (portal)
  // dev mode (localhost or ?debug): every level open for testing, without
  // touching the saved progress; Settings has a switch to turn it off
  const devUnlock = () => canToggleLocally() && settings.get("devUnlockAll") !== false;
  const isOpen = (id) => devUnlock() || campaign.isUnlocked(id);

  // ------------------------------------------------------------- toast
  const toast = $("toast");
  let toastTimer = null;
  const showToast = (html, ms = 3200, kind = "") => {
    toast.innerHTML = html;
    toast.dataset.kind = kind;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), ms);
  };
  const clock = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // ------------------------------------------------- coins, achievements, save

  const COIN = '<span class="coin-icon" aria-hidden="true"></span>';
  const coinText = (n) => `${COIN}${n.toLocaleString("en-US")}`;
  const renderBalance = () => {
    $("walletBalance").innerHTML = coinText(wallet.balance());
    $("shopBalance").innerHTML = coinText(wallet.balance());
  };

  // The player's look (and last-online day) follows the account: written each time cloud save
  // has merged the account's save (onMerge), so never with a switch another device has since
  // turned off. Wearing an item or flipping the switch sends the save now, and the profile
  // follows that merge. No account, no profile, and nothing loads. Never shows an error.
  const profileGate = createProfileGate({
    sync: profiles.sync,
    read: () => ({ worn: wallet.worn(), showLastSeen: lastSeen.on() }),
  });
  const syncProfile = () => {
    cloud.changed();
    cloud.flush();
  };

  // The account's save is merged in, then kept in step; it never shows an error.
  const cloud = createCloudSave({
    onMerge: (uid) => profileGate.merged(uid),
    backend: firestoreSaves,
    local: {
      read: () => readLocal(),
      write: (progress) => {
        writeLocal(progress);
        campaign = createCampaign(); // the merged save is on the device now: read it
        renderBalance();
        refreshHome();
      },
    },
  });

  // achievement toasts wait for each other (and for a level toast): 3 s each
  const achievementQueue = [];
  let achievementBusy = false;
  const pumpAchievements = () => {
    if (achievementBusy || !achievementQueue.length) return;
    achievementBusy = true;
    const next = () => {
      if (toast.classList.contains("show")) {
        setTimeout(next, 300);
        return;
      }
      showToast(achievementQueue.shift(), 3000, "achievement");
      setTimeout(() => {
        achievementBusy = false;
        pumpAchievements();
      }, 3300);
    };
    next();
  };

  /** Unlocks what the saved progress has earned: pays it once, toasts it, tracks it. */
  const checkAchievements = () => {
    const progress = readLocal();
    const earned = newlyEarned(progress, LEVELS);
    if (!earned.length) return;
    const now = Date.now();
    earned.forEach((id) => (progress.achievements[id] = now));
    writeLocal(progress); // before the rewards: they change the wallet
    earned.forEach((id) => {
      const { name, coins } = ACHIEVEMENTS.find((a) => a.id === id);
      wallet.reward(id, coins);
      achievementQueue.push(`<b>🏆 ${name} · +${coins} coins</b>`);
      track("achievement", { id });
    });
    renderBalance();
    pumpAchievements();
    cloud.changed(); // the unlocks and their coins go to the account too
  };

  /** Call after any change to the wallet, stats, achievements, campaign, records or streak. */
  const progressChanged = () => {
    checkAchievements();
    cloud.changed();
  };

  // ------------------------------------------------------ eggs and quests

  /** The quest mode of what is being played; Starfall Peaks counts as community. */
  const questMode = () => {
    const kind = session ? session.kind : "story";
    return ["story", "daily", "endless", "bossrush"].includes(kind) ? kind : "community";
  };

  const queueToast = (html) => {
    achievementQueue.push(html);
    pumpAchievements();
  };

  /** Opens the week's chest when it is due and unpaid, whatever brought the keys to 12: true when it paid. */
  const openChest = (chest) => {
    if (!claimChest(chest, wallet, nest)) return false;
    queueToast(`<b>🎁 Weekly chest · +${coinText(CHEST_COINS)} and an egg</b>`);
    track("chest_open", {});
    return true;
  };

  /** One thing the player did: advances the day's quests, pays and toasts what it finished. */
  const recordFeat = (feat) => {
    const { finished, chest } = quests.record(feat, questMode());
    const paid = payFinished(finished, wallet);
    paid.forEach(({ pick }) => {
      queueToast(`<b>✅ ${esc(pick.text)} · +${coinText(pick.coins)}</b>`);
      track("quest_complete", { quest: pick.id });
    });
    return openChest(chest) || finished.length > 0; // finished quests changed the save, paid or not
  };

  /** This frame's events, the world's feats and coins: stats, eggs and quests. */
  const feedRewards = (events, coinsGained) => {
    const { world } = game;
    const out = featsFrom(events, world.feats.splice(0), coinsGained);
    let changed = false;
    if (out.shieldBounced) bossBounced = true;
    if (events.includes("boss")) {
      if (!bossBounced) stats.markShieldlessBoss();
      out.feats.push({ type: "boss" });
      changed = true;
    }
    if (events.includes("combo-up")) out.feats.push({ type: "combo", value: world.combo.count });
    if (out.burned) {
      stats.addBurned(out.burned);
      changed = true;
    }
    out.eggs.forEach((id) => {
      eggsFoundNow.add(id);
      nest.find(id, id.startsWith("d") ? "daily" : "story");
      track("egg_found", { source: id.startsWith("d") ? "daily" : "story" });
      queueToast("<b>🥚 Egg found! It hatches in 24 hours.</b>");
      changed = true;
    });
    out.feats.forEach((feat) => {
      if (recordFeat(feat)) changed = true;
    });
    if (changed) {
      renderBalance();
      progressChanged();
    }
  };

  // analytics: the mode being played and how long the player has been in this area
  const modeName = () => (session ? session.kind : "story");
  const areaSeconds = () => Math.round(game.world.areaTicks / 30);
  const countBits = (mask) => [1, 2, 4].filter((bit) => mask & bit).length;
  // hearts lost in the level being played (a boss beaten with none lost is "untouchable")
  let hurtInLevel = false;
  let heartsSeen = MAX_HEARTS;

  /** Leaving a campaign level forward finishes it: award its stars. */
  const finishLevel = (id) => {
    const area = areas[id];
    const { world } = game;
    const seconds = world.areaTicks / 30;
    const mask = starsFor(area, {
      collectedCoins: world.collectedCoins,
      killedEnemies: world.killedEnemies,
      seconds,
    });
    const { added } = campaign.finish(id, mask, seconds);
    const ghost = recorder.finish(id, seconds);
    if (ghost && ghostStore.offer(ghost)) {
      track("ghost_saved", { level_id: id, seconds: Math.round(seconds) });
    }
    const level = LEVELS.find((l) => l.id === id);
    if (level && level.boss && !hurtInLevel) stats.markFlawlessBoss();
    const star = (bit, label) =>
      `<span class="toast-star${mask & bit ? " on" : ""}${added & bit ? " new" : ""}" title="${label}">★</span>`;
    showToast(
      `<b>${levelName(id)} complete</b>` +
        `<span class="toast-stars">${star(STAR.COINS, "All coins")}${star(STAR.ENEMIES, "All enemies")}${star(STAR.TIME, "Target time")}</span>` +
        `<span class="toast-time">${clock(seconds)} / ${clock(targetTime(area))}</span>`,
    );
    if (added) vibrate("powerup");
    track("level_complete", {
      mode: "story",
      level_id: id,
      seconds: Math.round(seconds),
      stars_added: countBits(added),
    });
    progressChanged();
    if (onboarding.takeWorld1Offer(id)) openWorld1Card();
  };

  const levelName = (id) => {
    if (session) return session.label(id);
    const level = LEVELS.find((l) => l.id === id);
    return level ? level.name : `Area ${id}`;
  };

  // ------------------------------------------------------------------ results

  // the result panel's rank line, streak, a note, and the Share button
  let panelToken = 0;
  const setPanelDaily = ({ rank, streak, note, share }) => {
    if (rank !== undefined) $("pauseRank").textContent = rank;
    if (streak !== undefined) $("pauseStreak").textContent = streak;
    if (note !== undefined) $("pauseNote").textContent = note;
    if (share !== undefined) $("shareBtn").style.display = share ? "block" : "none";
  };

  const showPanel = ({
    title,
    tone = "",
    score = "",
    best = "",
    resume,
    retryLabel,
    homeLabel = "Home",
    daily = false,
  }) => {
    panelToken += 1; // a result still arriving for the last panel must not write into this one
    $("reminderPrompt").hidden = true;
    setPanelDaily({ rank: "", streak: "", note: "", share: daily });
    pauseTitle.textContent = title;
    pauseTitle.className = `panel-title ${tone}`;
    pauseScore.textContent = score;
    pauseBest.textContent = best;
    resumeBtn.style.display = resume ? "block" : "none";
    retryBtn.style.display = retryLabel ? "block" : "none";
    retryBtn.textContent = retryLabel || "Retry";
    homeBtn.textContent = homeLabel;
    show(pauseScreen, true);
    if (daily) askForReminder(panelToken);
  };

  // ---------------------------------------------------------- daily reminders

  const reminderPrompt = createReminderPrompt();
  const reminderButtons = [$("reminderYesBtn"), $("reminderNoBtn")];
  const BLOCKED_TEXT = "Notifications are blocked in your browser settings.";
  const UNSUPPORTED_TEXT = "Reminders aren't available in this browser.";
  const REMINDER_FAILED = "Couldn't turn on reminders. Try again later.";

  /** Under the first daily result: asks once, and only when the player could say yes. */
  const askForReminder = async (token) => {
    if (!reminderPrompt.shouldAsk()) return;
    let current;
    try {
      current = await reminders.state();
    } catch (error) {
      return;
    }
    // blocked, unsupported or already on: nothing to ask, and it isn't marked answered
    if (current !== "off" || token !== panelToken || !reminderPrompt.shouldAsk()) return;
    $("reminderPrompt").hidden = false;
  };

  const answerReminder = (yes) => {
    reminderPrompt.answer(yes);
    $("reminderPrompt").hidden = true;
    track("reminder_prompt", { answer: yes ? "yes" : "no" });
  };

  $("reminderNoBtn").onclick = () => answerReminder(false);
  $("reminderYesBtn").onclick = async () => {
    reminderButtons.forEach((b) => (b.disabled = true));
    try {
      const result = await reminders.turnOn();
      answerReminder(true);
      if (result === "on") track("reminder_toggle", { on: true });
      else showToast(result === "blocked" ? BLOCKED_TEXT : UNSUPPORTED_TEXT);
      refreshReminderRow();
    } catch (error) {
      showToast(REMINDER_FAILED); // the prompt stays, so the player can try again
    } finally {
      reminderButtons.forEach((b) => (b.disabled = false));
    }
  };

  const recordRun = (score) => {
    const saved = getData("high_score") || 0;
    if (!session && score > saved) setData("high_score", score);
    cloud.changed();
    if (!session)
      return score > saved && score > 0
        ? "New best!"
        : saved
          ? `Best ${Math.max(saved, score)}`
          : "";
    const extra = session.kind === "endless" ? { level: session.level(areaId) } : {};
    const best = records.submit(session.kind, session.key, score, extra);
    if (session.kind === "endless") return `Reached level ${extra.level} · Best ${best.score}`;
    return `Best ${best.score}`;
  };

  // ------------------------------------------------------------ daily run

  const streak = createStreak();
  const played = createPlayed(); // community worlds started on this device
  const pending = createPending();
  /** One daily attempt: how each level went, and the ticks played (30 a second). */
  const daily = {
    seed: 0,
    ticks: 0,
    ticket: null, // Promise<{ ticket, seed } | null>: this attempt's ticket (startDaily)
    levels: [],
    hurt: [],
    hearts: MAX_HEARTS,
    streakGrew: 0, // the seed whose first level grew the streak
    result: null, // { score, seconds, rank, total } of the run on the panel
    index: () => areaId - (session ? session.startId : 0),
    seconds: () => Math.round(daily.ticks / 30),
    start() {
      Object.assign(daily, {
        seed: Number(session.key),
        ticks: 0,
        levels: [],
        hurt: [],
        result: null,
      });
    },
    /** Called each tick of a daily run: a lost heart marks the level "hurt". */
    watchHearts() {
      const { hearts } = game.world.player;
      if (hearts < daily.hearts) daily.hurt[daily.index()] = true;
      daily.hearts = hearts;
    },
    /** The player walked through the exit of the current level. */
    levelDone() {
      const index = daily.index();
      daily.levels[index] = daily.hurt[index] ? "hurt" : "clean";
      const result = streak.record(daily.seed);
      if (result.grew) daily.streakGrew = daily.seed;
      progressChanged();
    },
    squares: () => Array.from({ length: DAILY_LEVELS }, (_, i) => daily.levels[i] || "unreached"),
    streakDays() {
      const now = streak.current(dailySeed());
      return now.alive ? now.days : 0;
    },
  };

  /** The endless run's clock: ticks played, 30 a second. */
  const endless = {
    ticks: 0,
    ticket: null, // this run's ticket id; null: unranked
    seconds: () => Math.round(endless.ticks / 30),
  };
  const endlessPending = createEndlessPending();
  // a ranked run starts on the server (functions/src/runs.js); without a ticket it plays unranked
  const runTickets = createRunTickets({
    call: (name, data) => firestoreEndless.call(name, data),
    ensurePlayer: () => auth.ensurePlayer(),
  });

  /** The boss rush run's clock: ticks played, 30 a second. */
  const rush = {
    ticks: 0,
    seconds: () => Math.round(rush.ticks / 30),
  };

  const OFFLINE = "You're offline. Your score will be sent later.";
  const UNRANKED = "This run started offline, so it isn't ranked.";
  const REFUSED = {
    "invalid-argument": "That run can't be ranked.",
    "failed-precondition": "That daily challenge has closed.",
    "resource-exhausted": "Too many scores, try again in a minute.",
  };

  /** Sends the finished daily run: shows the rank, or keeps the run for the next home screen. */
  const submitDaily = async (score) => {
    const token = panelToken;
    const run = { seed: daily.seed, score, seconds: daily.seconds() };
    daily.result = { ...run, rank: null, total: null };
    const days = daily.streakDays();
    setPanelDaily({
      rank: "Sending your score…",
      streak: daily.streakGrew === run.seed && days >= 2 ? `🔥 ${days}-day streak!` : "",
    });
    const ticket = await daily.ticket;
    if (!ticket || ticket.seed !== run.seed) {
      track("daily_complete", { score, seconds: run.seconds });
      if (token === panelToken) setPanelDaily({ rank: UNRANKED });
      return;
    }
    run.ticket = ticket.ticket;
    try {
      await auth.ensurePlayer();
      const sent = await leaderboard.submit(run);
      daily.result = { ...run, rank: sent.rank, total: sent.total };
      track("daily_complete", { score, seconds: run.seconds, rank: sent.rank });
      if (token === panelToken) setPanelDaily({ rank: `#${sent.rank} of ${sent.total}` });
    } catch (error) {
      const code = errorCode(error);
      // refused runs can't be ranked later; a busy server (resource-exhausted) can take it later
      if (!isFinalRefusal(error)) pending.save(run);
      track("daily_complete", { score, seconds: run.seconds });
      if (token === panelToken) setPanelDaily({ rank: REFUSED[code] || OFFLINE });
    }
  };

  /** Sends a finished endless run; shows "#12 of 340 all time", or keeps the run for the home screen. */
  const submitEndless = async (run) => {
    const token = panelToken;
    if (!run.ticket) {
      setPanelDaily({ rank: UNRANKED });
      return;
    }
    setPanelDaily({ rank: "Sending your score…" });
    try {
      await auth.ensurePlayer();
      const sent = await endlessBoard.submit(run);
      track("endless_ranked", { level: run.level, score: run.score, rank: sent.rank });
      if (token === panelToken) setPanelDaily({ rank: `#${sent.rank} of ${sent.total} all time` });
    } catch (error) {
      const code = errorCode(error);
      if (!isFinalRefusal(error)) endlessPending.save(run);
      if (token === panelToken) {
        setPanelDaily({
          rank:
            code === "failed-precondition" ? REFUSED["invalid-argument"] : REFUSED[code] || OFFLINE,
        });
      }
    }
  };

  let flushing = false;
  /** Sends the runs that couldn't be sent before; called when the home screen opens. */
  const flushPending = async () => {
    if (flushing) return;
    flushing = true;
    try {
      await pending.flush(async (run) => {
        await auth.ensurePlayer();
        await leaderboard.submit(run);
      });
      await endlessPending.flush(async (run) => {
        await auth.ensurePlayer();
        await endlessBoard.submit(run);
      });
    } finally {
      flushing = false;
    }
  };

  /** What Retry does: start the mode (or the campaign level) that was being played again. */
  const restarter = (inSession, level) => () => {
    if (!inSession) {
      if (level) loadWorld(level.id, level.left, level.top);
      else startStory();
    } else if (inSession.kind === "daily") startDaily();
    else if (inSession.kind === "endless") startEndless();
    else if (inSession.kind === "secret") startSecret();
    else if (inSession.kind === "bossrush") startBossRush();
    else startCustom(inSession.world);
  };

  // GAME
  const game = new Game((score) => {
    reportCombo();
    track("level_fail", { mode: modeName(), level_id: areaId, seconds: areaSeconds() });
    const best = recordRun(score);
    const inDaily = !!session && session.kind === "daily";
    if (inDaily) daily.levels[daily.index()] = "lost";
    const current = areaId;
    // an endless run is ranked when it ends, from level 2 on
    const endlessRun =
      session && session.kind === "endless" && session.level(current) >= MIN_LEVEL
        ? {
            seed: Number(session.key),
            level: session.level(current),
            score,
            seconds: endless.seconds(),
            ticket: endless.ticket || undefined,
          }
        : null;
    const inSession = session;
    const level = LEVELS.find(({ id }) => id === current);
    retry = restarter(inSession, level);
    setTimeout(() => {
      showPanel({
        title: "Game Over",
        tone: "bad",
        score: `Score ${score} · ${levelName(current)}`,
        best,
        retryLabel: inSession && inSession.kind !== "custom" ? "Try again" : "Retry",
        daily: inDaily,
      });
      if (inDaily) {
        setPanelDaily({ note: "Finish all 5 levels to get on the leaderboard." });
        daily.result = { score, seconds: daily.seconds(), rank: null, total: null };
      }
      if (endlessRun) submitEndless(endlessRun);
    }, 1400);
  });

  // an egg found before (or this session) isn't placed again
  game.world.eggFound = (id) => eggsFoundNow.has(id) || nest.has(id);

  /** A level is over: its best combo is reported once if it reached 5. */
  const reportCombo = () => {
    const { combo } = game.world;
    stats.bestCombo(combo.best);
    if (combo.best >= 5) track("combo_best", { mode: modeName(), combo: combo.best });
    combo.resetLevel();
  };

  const finishRun = () => {
    paused = true;
    toggleControllers(false);
    game.world.pauseThemeMusic();
    const score = game.world.score;
    const best = recordRun(score);
    const titles = {
      daily: "Daily complete!",
      custom: "World complete!",
      secret: "Starfall Peaks complete!",
      bossrush: "Boss Rush complete!",
    };
    retry = session ? restarter(session) : startStory;
    if (!session) {
      const stars = campaign.totalStars(LEVELS.map((l) => l.id));
      showPanel({
        title: "Campaign complete!",
        tone: "good",
        score: `Score ${score} · ★ ${stars}/${LEVELS.length * 3}`,
        best,
        retryLabel: "Play again",
      });
      vibrate("powerup");
      return;
    }
    vibrate("powerup");
    const inDaily = session.kind === "daily";
    let panelScore = `Score ${score}`;
    let panelBest = best;
    if (session.kind === "custom") {
      stats.finishWorld(session.world.id);
      social.recordPlay(session.world.id, "finish");
    }
    if (session.kind === "secret") stats.markSecretBoss();
    if (session.kind === "bossrush") {
      const seconds = rush.seconds();
      const fastest = stats.bossRushTime(seconds);
      recordFeat({ type: "bossrush-finished" });
      track("boss_rush_complete", { seconds });
      panelScore = `Time ${clock(seconds)} · Score ${score}`;
      panelBest = `Best ${clock(fastest)}`;
    }
    showPanel({
      title: titles[session.kind] || "Complete!",
      tone: "good",
      score: panelScore,
      best: panelBest,
      retryLabel: "Play again",
      daily: inDaily,
    });
    progressChanged();
    if (inDaily) submitDaily(score);
  };

  /** Wearing an item takes effect in the next level: apply what is worn as each one starts. */
  const applyWornLook = () => {
    const worn = wallet.worn();
    game.world.player.setLook({ skin: worn.skin, hat: worn.hat });
    game.world.fireballs.setColour(worn.fireball);
  };

  const setupWorld = () => {
    if (session) session.ensure(areaId);
    game.world.setup(areas[areaId]);
    // walking into a campaign level unlocks it in the level select
    // (dev mode opens every level for testing; only real progress is saved:
    // a level you walked into from one you had really reached)
    if (isCampaignLevel(areaId)) {
      const walkedIn = cameFrom != null && campaign.isUnlocked(cameFrom);
      if (campaign.isUnlocked(areaId) || walkedIn) {
        campaign.reach(areaId);
        cloud.changed();
      }
    }
    cameFrom = null;
    daily.hearts = game.world.player.hearts;
    hurtInLevel = false;
    heartsSeen = game.world.player.hearts;
    applyWornLook();
    bossBounced = false;
    follower.reset();
    wornCompanion = wallet.worn().companion || "none";
    companionFrames(wornCompanion); // asks again for a sprite that failed to load
    if (session && session.kind === "endless") {
      const reached = session.level(areaId);
      stats.endlessDeepest(reached);
      recordFeat({ type: "endless-level", level: reached });
      progressChanged();
    }
    recorder.reset();
    keptGhost = isCampaignLevel(areaId) ? ghostStore.get(areaId) : null;
    ghostOn = settings.get("ghost") !== false;
    track("level_start", { mode: modeName(), level_id: areaId });
  };

  // SCREEN
  let screen;

  const resize = () => {
    sizeControls();
    const inset = safeArea();
    const width = document.documentElement.clientWidth - inset.left - inset.right;
    const height = document.documentElement.clientHeight - inset.top - inset.bottom;
    const container = document.querySelector(".container");
    container.style.marginLeft = `${inset.left}px`;
    container.style.marginRight = `${inset.right}px`;
    screen.resize(width, height, game.world.width, game.world.height);
    screen.render();
  };

  const setupScreen = () => {
    const area = areas[areaId];
    screen = new Screen(document.querySelector("canvas"), area.world, getSkin(area.skin));

    screen.buffer.canvas.height = game.world.height;
    screen.buffer.canvas.width = game.world.width;
    resize();
  };

  setupScreen();

  // GAME ENGINE

  const loadPercent = () => {
    const totalAssets = (worldChanged ? 0 : game.world.assetCount) + screen.assetCount;
    const totalLoaded = (worldChanged ? 0 : game.world.loadCount) + screen.loadCount;

    return Math.round((totalLoaded / totalAssets) * 100);
  };

  const isLoaded = () => game.isLoaded() && screen.isLoaded();

  const update = () => {
    loaded = isLoaded();
    const loadValue = loadPercent();

    const { player, portal } = game.world;
    let coinsGained = 0;

    if (loadValue < 100) {
      setProgressValue(loadValue == 99 ? 100 : loadValue);
    }

    if (!loaded) {
      if (controllerActive) toggleControllers(false);
      if (!loadingActive) toggleLoadingScreen(true);
    } else {
      if (loadingActive) {
        toggleLoadingScreen(false);
        setProgressValue(0);
      }
      if (hintPending) beginHint();
      if (!controllerActive && !paused) toggleControllers(true);
    }

    if (!game.over && loaded && !paused) {
      if (controller.left.active) player.moveLeft();
      if (controller.right.active) player.moveRight();
      if (hint && (controller.left.active || controller.right.active)) hint.run.moved();
      if (controller.up.active) {
        if (player.jump()) {
          if (hint) hint.run.jumped();
          game.world.playJumpSound();
          game.world.playerJumped();
        }
        controller.up.active = false;
      }
      if (controller.fire.active && !player.firing) {
        game.world.shootFireball(uid());
        controller.fire.active = false;
      }
    }

    if (portal) {
      reportCombo();
      if (portal.direction > 0) {
        recordFeat({ type: "level", flawless: !hurtInLevel });
        progressChanged();
      }
      if (session && session.kind === "daily" && portal.direction > 0) daily.levelDone();
      if (session && portal.direction > 0) {
        track("level_complete", {
          mode: session.kind,
          level_id: areaId,
          seconds: areaSeconds(),
          stars_added: 0,
        });
      }
      if (isCampaignLevel(areaId) && portal.direction > 0 && campaign.isUnlocked(areaId)) {
        finishLevel(areaId);
      }
      if (portal.destinationArea === FINISH) {
        game.world.portal = null;
        finishRun();
      } else {
        worldChanged = true;
        engine.hold();
        cameFrom = areaId;
        const rushHearts =
          session && session.kind === "bossrush" && portal.direction > 0
            ? session.heartsAfterBoss(game.world.player.hearts)
            : null;
        areaId = portal.destinationArea;
        setupWorld();
        if (rushHearts !== null) {
          game.world.player.hearts = rushHearts;
          heartsSeen = rushHearts;
          daily.hearts = rushHearts;
        }
        setupScreen();
        engine.resume();
      }
    }

    // Pause freezes the world too, not just input: otherwise a player paused
    // mid-jump keeps falling (and can die) behind the pause menu.
    if (!paused) {
      if (loaded && !game.over && isCampaignLevel(areaId)) {
        const tick = game.world.areaTicks;
        if (tick % SAMPLE_EVERY === 0) {
          recorder.sample(tick, {
            x: player.x,
            y: player.y,
            anim: animName(player),
            frame: player.animator.frameIndex,
          });
        }
      }
      game.update();
      if (loaded) {
        follower.push(
          { x: player.x, y: player.y, direction: player.direction },
          game.world.respawns,
        );
      }
      if (session && session.kind === "daily" && loaded && !game.over) {
        daily.ticks += 1;
        daily.watchHearts();
      }
      if (session && session.kind === "endless" && loaded && !game.over) endless.ticks += 1;
      if (session && session.kind === "bossrush" && loaded && !game.over) rush.ticks += 1;
      if (loaded) {
        const { hearts } = game.world.player;
        if (hearts < heartsSeen) hurtInLevel = true;
        heartsSeen = hearts;
        // every coin and kill counts at once; dying or quitting never takes them back
        const gained = earnings.tick(game.world);
        coinsGained = gained.coins;
        if (gained.coins) wallet.earn(gained.coins);
        if (gained.kills) stats.addKills(gained.kills);
        if (gained.coins || gained.kills) {
          renderBalance();
          progressChanged();
        }
      }
    }

    tickHint();

    // shell feedback for what happened this tick
    const { events } = game.world;
    if (events.length || game.world.feats.length || coinsGained) feedRewards(events, coinsGained);
    while (events.length) vibrate(events.shift());
  };

  // ------------------------------------------------------------------ drawing

  /** The kept run, see-through, in the classic look: no skin, no hat, never collides. */
  const drawGhost = (ctx, player) => {
    if (!ghostOn || !keptGhost || !isCampaignLevel(areaId)) return;
    const at = ghostAt(keptGhost, game.world.areaTicks);
    if (!at) return;
    const frames = classicFrames()[at.anim];
    const frame = frames && (frames[at.frame] || frames[0]);
    if (!frame) return;
    const left = at.anim.endsWith("Left");
    const deadOffset = at.anim.startsWith("dead") ? (left ? 12 : -12) : 0;
    const xOffset = (left ? -36 : -12) + deadOffset;
    ctx.save();
    ctx.globalAlpha = GHOST_ALPHA;
    ctx.translate(at.x + player.width * 0.5, at.y + player.height);
    ctx.drawImage(frame, -6 + xOffset, -35, 60, 40);
    ctx.restore();
  };

  /** The level's hidden egg: bobbing, with a soft glow. */
  const drawEgg = (ctx, egg) => {
    const image = egg.image;
    if (!image || !image.complete || !image.naturalWidth) return;
    const cx = egg.getCenterX();
    const cy = egg.getCenterY();
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, egg.glow + 3);
    glow.addColorStop(0, "rgba(255, 244, 180, 0.55)");
    glow.addColorStop(1, "rgba(255, 244, 180, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 14, cy - 14, 28, 28);
    ctx.drawImage(image, egg.x, egg.y, egg.width, egg.height);
  };

  /** The worn companion: where the dino stood 10 ticks ago, behind it, facing the way it ran. Only drawn. */
  const drawCompanion = (ctx, player) => {
    if (wornCompanion === "none") return;
    const at = follower.at();
    const frames = companionFrames(wornCompanion);
    if (!at || !frames.length) return;
    const frame = frames[at.moving ? Math.floor(game.world.areaTicks / 6) % 2 : 0];
    if (!frame || !frame.complete || !frame.naturalWidth) return;
    ctx.save();
    ctx.translate(at.x + player.width / 2 - at.direction * 14, at.y + player.height);
    if (at.direction < 0) ctx.scale(-1, 1);
    ctx.drawImage(
      frame,
      -COMPANION_SIZE.width / 2,
      -COMPANION_SIZE.height,
      COMPANION_SIZE.width,
      COMPANION_SIZE.height,
    );
    ctx.restore();
  };

  const drawPlayer = (ctx, player, dead) => {
    const frame = player.animator.frameValue;
    const deadOffset = dead ? (player.direction < 0 ? 12 : -12) : 0;
    const xOffset = (player.direction < 0 ? -36 : -12) + deadOffset;
    const feetX = player.getCenterX();
    const feetY = player.getBottom();

    ctx.save();
    ctx.globalAlpha = player.alpha;
    // squash & stretch around the feet
    ctx.translate(feetX, feetY);
    ctx.scale(player.scaleX, player.scaleY);
    ctx.drawImage(frame, -6 + xOffset, -35, 60, 40);
    if (!dead) drawHat(ctx, player.hatImage, player.direction, frame);
    ctx.restore();

    if (player.shield && !dead) {
      const pulse = 0.55 + Math.sin(Date.now() / 160) * 0.15;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#9fd0ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(feetX, feetY - 9, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = pulse * 0.25;
      ctx.fillStyle = "#9fd0ff";
      ctx.fill();
      ctx.restore();
    }
  };

  /** Boss: afterimages, enraged glow, then the sprite squashed/tilted at its feet. */
  const drawBoss = (ctx, boss) => {
    const rect = boss.drawRect();
    if (boss.dying) {
      screen.drawObject(boss.animator.frameValue, rect.x, rect.y, rect.width, rect.height);
      return;
    }
    boss.trail.forEach((t) => {
      ctx.globalAlpha = (t.life / 8) * 0.28 * boss.alpha;
      ctx.drawImage(t.frame, t.x, t.y - boss.crown + 1, rect.width, rect.height);
    });
    ctx.globalAlpha = 1;

    const feetX = rect.x + rect.width / 2;
    const feetY = rect.y + rect.height;
    if (boss.enraged) {
      const pulse = 0.35 + Math.sin(Date.now() / 120) * 0.15;
      const glow = ctx.createRadialGradient(
        feetX,
        feetY - boss.height / 2,
        4,
        feetX,
        feetY - boss.height / 2,
        boss.width * 0.8,
      );
      glow.addColorStop(0, `rgba(255, 60, 40, ${pulse * boss.alpha})`);
      glow.addColorStop(1, "rgba(255, 60, 40, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(feetX - boss.width, feetY - boss.height * 1.6, boss.width * 2, boss.height * 2);
    }

    // the shield: a ring pulsing round the boss while it is up
    const centreY = feetY - boss.height / 2;
    if (boss.shield === "up") {
      const pulse = 0.5 + Math.sin(Date.now() / 90) * 0.5;
      const radius = Math.max(boss.width, boss.height) * 0.75 + pulse * 3;
      const fade = boss.shieldTimer < 15 && Math.floor(Date.now() / 60) % 2 === 0 ? 0.5 : 1;
      ctx.save();
      ctx.globalAlpha = fade * (0.7 + pulse * 0.3);
      ctx.fillStyle = "rgba(124, 200, 245, 0.18)";
      ctx.strokeStyle = "#bfe8ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(feetX, centreY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = boss.alpha * (boss.flash > 0 && boss.flash % 2 === 0 ? 0.45 : 1);
    ctx.translate(feetX, feetY);
    ctx.rotate(boss.tilt);
    ctx.scale(boss.scaleX, boss.scaleY);
    ctx.drawImage(boss.animator.frameValue, -rect.width / 2, -rect.height, rect.width, rect.height);
    // glowing before the shield rises: the sprite flickers brighter (drawn again, added on top)
    if (glowFlickers(boss)) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= 0.7;
      ctx.drawImage(
        boss.animator.frameValue,
        -rect.width / 2,
        -rect.height,
        rect.width,
        rect.height,
      );
    }
    ctx.restore();
    drawShieldGlow(ctx, boss, feetX, centreY);
  };

  const drawProjectile = (ctx, p) => {
    const cx = p.getCenterX();
    const cy = p.getCenterY();
    switch (p.kind) {
      case "icicle": {
        ctx.fillStyle = "#e6f6ff";
        ctx.beginPath();
        ctx.moveTo(cx - 3.5, cy - 7);
        ctx.lineTo(cx + 3.5, cy - 7);
        ctx.lineTo(cx, cy + 6);
        ctx.fill();
        ctx.fillStyle = "#7cc8f5";
        ctx.fillRect(cx, cy - 7, 1.5, 10);
        return;
      }
      case "shard":
        ctx.fillStyle = "#bfe8ff";
        ctx.beginPath();
        ctx.moveTo(cx, cy - 4);
        ctx.lineTo(cx + 3, cy);
        ctx.lineTo(cx, cy + 4);
        ctx.lineTo(cx - 3, cy);
        ctx.fill();
        return;
      case "orb": {
        const glow = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, 6);
        glow.addColorStop(0, "rgba(255, 230, 255, 1)");
        glow.addColorStop(0.4, "rgba(176, 120, 240, 0.9)");
        glow.addColorStop(1, "rgba(120, 60, 200, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(cx - 6, cy - 6, 12, 12);
        return;
      }
      case "missile": {
        const angle = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 80}, 40, 0.9)`;
        ctx.beginPath();
        ctx.moveTo(-4, -2);
        ctx.lineTo(-9 - Math.random() * 3, 0);
        ctx.lineTo(-4, 2);
        ctx.fill();
        ctx.fillStyle = "#5a5560";
        ctx.fillRect(-4, -2.5, 8, 5);
        ctx.fillStyle = "#e8344a";
        ctx.fillRect(3, -2.5, 2, 5);
        ctx.restore();
        return;
      }
      case "mud":
        ctx.fillStyle = "#4a3220";
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8f6a42";
        ctx.fillRect(cx - 2.5, cy - 2.5, 2, 2);
        ctx.fillRect(cx + 1, cy + 0.5, 1.5, 1.5);
        return;
      case "glob": {
        // a wobbling blob, in its creature's colours when it has them
        const [body = "#6fcf5f", edge = "#3f9a3a"] = p.colors || [];
        const wobble = Math.sin(Date.now() / 70) * 0.8;
        ctx.fillStyle = edge;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 4.2 + wobble, 3.6 - wobble, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 3 + wobble * 0.6, 2.4 - wobble * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - 1.5, cy - 1.5, 1.2, 1.2);
        return;
      }
      case "spit": {
        // a fast streak of sand with a trail
        const dir = Math.sign(p.vx) || 1;
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = SPIT_COLORS.trail;
        ctx.fillRect(dir > 0 ? cx - 9 : cx + 1, cy - 1, 8, 2);
        ctx.restore();
        ctx.fillStyle = SPIT_COLORS.body;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = SPIT_COLORS.glint;
        ctx.fillRect(cx - 1, cy - 1, 1.5, 1.5);
        return;
      }
      case "pebble": {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(p.life * 0.4);
        ctx.fillStyle = "#8a847a";
        ctx.fillRect(-3, -3, 6, 6);
        ctx.fillStyle = "#c4beb2";
        ctx.fillRect(-3, -3, 3, 3);
        ctx.restore();
        return;
      }
      case "sand":
        ctx.fillStyle = "#e2b860";
        ctx.beginPath();
        ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff0c0";
        ctx.fillRect(cx - 1.5, cy - 1.5, 1, 1);
        return;
      default:
        screen.drawObject(p.animator.frameValue, p.x, p.y, p.width, p.height);
    }
  };

  /** Telegraphs and active boss attacks on the ground. */
  const drawHazards = (ctx, hazards) => {
    const blink = Math.floor(Date.now() / 90) % 2 === 0;
    hazards.forEach((h) => {
      const warning = h.warn > 0;
      switch (h.kind) {
        case "mark": {
          // a target that tightens as the hit gets close
          const t = h.maxWarn ? 1 - h.warn / h.maxWarn : 1;
          ctx.globalAlpha = 0.45 + t * 0.5;
          ctx.strokeStyle = blink ? "#ff5a5a" : "#ffffff";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(
            h.x + h.width / 2,
            h.y + 1.5,
            (h.width / 2) * (1.6 - t * 0.6),
            2,
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
          ctx.globalAlpha = 1;
          return;
        }
        case "tongue": {
          const y = h.y + h.height / 2;
          const from = h.direction > 0 ? h.x : h.x + h.width;
          const to = h.direction > 0 ? h.x + h.width : h.x;
          if (warning) {
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = "#ff8ab0";
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(from, y);
            ctx.lineTo(to, y);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = "#e85a8a";
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(from, y);
            ctx.lineTo(to, y);
            ctx.stroke();
            ctx.fillStyle = "#ff8ab0";
            ctx.beginPath();
            ctx.arc(to, y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineCap = "butt";
          }
          ctx.globalAlpha = 1;
          return;
        }
        case "laser": {
          const y = h.y + h.height / 2;
          if (warning) {
            ctx.globalAlpha = blink ? 0.9 : 0.4;
            ctx.strokeStyle = "#ff3030";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(h.x, y);
            ctx.lineTo(h.x + h.width, y);
            ctx.stroke();
            ctx.setLineDash([]);
          } else {
            ctx.globalAlpha = 1;
            ctx.fillStyle = "rgba(255, 40, 40, 0.45)";
            ctx.fillRect(h.x, h.y - 2, h.width, h.height + 4);
            ctx.fillStyle = "#ff5050";
            ctx.fillRect(h.x, h.y, h.width, h.height);
            ctx.fillStyle = "#fff2f2";
            ctx.fillRect(h.x, y - 1.5, h.width, 3);
          }
          ctx.globalAlpha = 1;
          return;
        }
        case "blast": {
          const r = 6 + (6 - h.active) * 2;
          const g = ctx.createRadialGradient(
            h.x + h.width / 2,
            h.y + h.height,
            1,
            h.x + h.width / 2,
            h.y + h.height,
            r,
          );
          g.addColorStop(0, "rgba(255, 250, 200, 0.95)");
          g.addColorStop(0.5, "rgba(255, 140, 40, 0.8)");
          g.addColorStop(1, "rgba(255, 80, 20, 0)");
          ctx.fillStyle = g;
          ctx.fillRect(h.x + h.width / 2 - r, h.y + h.height - r, r * 2, r * 2);
          return;
        }
        default:
      }
    });
  };

  /** Boss arena portcullises: they drop from above to the floor. */
  const drawGates = (ctx) => {
    const { gate, gateWidth, gateBottom, width } = game.world;
    if (gate <= 0) return;
    const bottom = gateBottom * gate;
    const top = bottom - gateBottom;
    [0, width - gateWidth].forEach((x) => {
      // dark backing so the gate reads on any background
      ctx.fillStyle = "rgba(14, 10, 18, 0.55)";
      ctx.fillRect(x, top, gateWidth, gateBottom);
      // three iron bars with a light edge and spiked tips
      for (let bar = 0; bar < 3; bar++) {
        const bx = x + 1 + bar * 3.5;
        ctx.fillStyle = "#2a2430";
        ctx.fillRect(bx, top, 2.5, gateBottom);
        ctx.fillStyle = "#a59cb2";
        ctx.fillRect(bx, top, 1, gateBottom);
        ctx.fillStyle = "#2a2430";
        ctx.beginPath();
        ctx.moveTo(bx - 0.5, bottom - 1);
        ctx.lineTo(bx + 1.25, bottom + 4);
        ctx.lineTo(bx + 3, bottom - 1);
        ctx.fill();
      }
      // riveted cross beams
      for (let y = bottom - 12; y > top; y -= 18) {
        ctx.fillStyle = "#2a2430";
        ctx.fillRect(x, y, gateWidth, 3);
        ctx.fillStyle = "#a59cb2";
        ctx.fillRect(x, y, gateWidth, 1);
        ctx.fillStyle = "#e0b33a";
        ctx.fillRect(x + 1, y + 1, 1, 1);
        ctx.fillRect(x + gateWidth - 2, y + 1, 1, 1);
      }
    });
  };

  const drawBossBar = (ctx, width) => {
    const { boss } = game.world;
    const barWidth = 120;
    const x = (width - barWidth) / 2;
    const y = 22;
    ctx.font = "bold 7px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillText(boss.name, width / 2 + 1, y - 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(boss.name, width / 2, y - 3);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x - 1, y - 1, barWidth + 2, 6);
    const left = Math.max(0, boss.hp) / boss.maxHp;
    ctx.fillStyle = boss.enraged ? "#ff5a3a" : "#e8344a";
    ctx.fillRect(x, y, barWidth * left, 4);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x, y, barWidth * left, 1);
    ctx.textAlign = "start";
  };

  const drawHud = (ctx) => {
    const { player, columns, totalCoins, coins } = game.world;
    const width = columns * 16;

    // hearts
    for (let i = 0; i < MAX_HEARTS; i++) {
      const icon = i < player.hearts ? icons["hud-heart"] : icons["hud-heart-empty"];
      ctx.drawImage(icon, 6 + i * 12, 5, 11, 10);
    }

    // active power-ups with a draining bar
    let x = 6 + MAX_HEARTS * 12 + 4;
    const timed = [
      ["shield", player.shield ? 1 : 0],
      ["triple", player.triple / POWERUP_TICKS.triple],
      ["wings", player.wings / POWERUP_TICKS.wings],
    ];
    timed.forEach(([key, left]) => {
      if (left <= 0) return;
      ctx.drawImage(icons[key], x, 4, 11, 11);
      if (key !== "shield") {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x, 16, 11, 2);
        ctx.fillStyle = left < 0.25 ? "#ff6b66" : "#ffd84d";
        ctx.fillRect(x, 16, Math.max(1, 11 * left), 2);
      }
      x += 14;
    });

    // level name
    ctx.font = "bold 7px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(levelName(areaId), 7, 26);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(levelName(areaId), 6, 25);

    if (game.world.boss) drawBossBar(ctx, width);

    // score (centre-right) and coins (right)
    ctx.textAlign = "right";
    ctx.font = "bold 9px Arial";
    const score = String(game.world.score);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(score, width - 49, 15);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(score, width - 50, 14);

    // the combo, left of the score, with a bar that drains as the window closes
    const { combo } = game.world;
    if (combo.count >= 2) {
      const scoreWidth = ctx.measureText(score).width;
      const text = `${combo.count} \u00b7 x${combo.multiplier}`;
      const right = width - 50 - scoreWidth - 8;
      const textWidth = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillText(text, right + 1, 15);
      ctx.fillStyle = combo.multiplier > 1 ? "#ffd84d" : "#ffffff";
      ctx.fillText(text, right, 14);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(right - textWidth, 17, textWidth, 2);
      ctx.fillStyle = combo.multiplier > 1 ? "#ffd84d" : "#ffffff";
      ctx.fillRect(right - textWidth, 17, Math.max(1, (textWidth * combo.left) / COMBO_WINDOW), 2);
    }

    ctx.drawImage(coins.frameSets.coin[0], width - 17, 5, 10, 10);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(String(totalCoins), width - 19, 15);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(totalCoins), width - 20, 14);
    ctx.textAlign = "start";
  };

  const render = () => {
    screen.drawBackground();
    const ctx = screen.buffer;
    // the world shakes, the HUD doesn't; with the setting off nothing moves
    const shake = settings.get("shake") ? game.world.effects.shakeOffset() : { x: 0, y: 0 };
    ctx.save();
    ctx.translate(shake.x, shake.y);

    const {
      map,
      backdrop,
      coins,
      water,
      player,
      objects,
      enemies,
      powerups,
      fireballs,
      projectiles,
    } = game.world;

    if (backdrop) screen.drawMap(backdrop);

    if (water) {
      for (let index = 0; index < water.items.length; index++) {
        const w = water.items[index];
        screen.drawObject(w.animator.frameValue, w.x, w.y, w.width, w.height, w.offsetX, w.offsetY);
      }
    }

    screen.drawMap(map);
    screen.drawMapObjects(objects);

    for (let index = 0; index < coins.items.length; index++) {
      const coin = coins.items[index];
      screen.drawObject(
        coin.animator.frameValue,
        coin.x,
        coin.y,
        coin.width,
        coin.height,
        coin.offsetX,
        coin.offsetY,
      );
    }

    // power-ups: soft glow behind the icon
    for (let index = 0; index < powerups.items.length; index++) {
      const item = powerups.items[index];
      const cx = item.getCenterX();
      const cy = item.getCenterY();
      const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, item.glow + 3);
      glow.addColorStop(0, "rgba(255, 244, 180, 0.65)");
      glow.addColorStop(1, "rgba(255, 244, 180, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 12, cy - 12, 24, 24);
      ctx.drawImage(icons[item.type], item.x, item.y, item.width, item.height);
    }

    if (game.world.egg) drawEgg(ctx, game.world.egg);

    for (let index = 0; index < fireballs.items.length; index++) {
      const f = fireballs.items[index];
      screen.drawObject(f.animator.frameValue, f.x, f.y, f.width, f.height);
    }

    for (let index = 0; index < projectiles.items.length; index++) {
      drawProjectile(ctx, projectiles.items[index]);
    }
    drawHazards(ctx, game.world.hazards);

    for (let index = 0; index < enemies.items.length; index++) {
      const enemy = enemies.items[index];
      const rect = enemy.drawRect();
      // armour flash after a hit
      if (enemy.flash > 0 && enemy.flash % 2 === 0) ctx.globalAlpha = 0.45;
      screen.drawObject(enemy.animator.frameValue, rect.x, rect.y, rect.width, rect.height);
      ctx.globalAlpha = 1;
    }

    if (game.world.boss) drawBoss(ctx, game.world.boss);

    drawGhost(ctx, player);
    drawCompanion(ctx, player);
    drawPlayer(ctx, player, game.world.isPlayerDead);
    if (game.world.bossArea) drawGates(ctx);

    game.world.effects.draw(ctx);
    ctx.restore();
    drawHud(ctx);

    screen.render();
  };

  resize();

  var engine = new GameEngine(1000 / 30, update, render);

  // ?debug exposes the game for manual testing from the console (test hosts only)
  if (canToggleLocally() && new URLSearchParams(window.location.search).has("debug")) {
    window.debugGame = {
      game,
      engine,
      controller,
      areas,
      loadWorld: (...args) => loadWorld(...args),
      startEndless: () => startEndless(),
      startDaily: () => startDaily(),
      get campaign() {
        return campaign;
      },
      wallet,
      stats,
      nest,
      quests,
      cloud,
      unlockAll: () => {
        campaign.unlockAll(LEVELS.map((l) => l.id));
        refreshHome();
      },
    };
  }

  // -------------------------------------------------------------- game flow

  const clearMouse = () => {
    [upMouse, fireMouse, leftMouse, rightMouse].forEach((m) => m && m.actions.clear());
  };

  /** Start (or restart) play in area `id`, standing at left/top. */
  const loadWorld = (id = 1, left = 40, top = 100) => {
    clearMouse();
    controller.releaseAll();
    show(pauseScreen, false);
    show(homeScreen, false);
    lockLandscape();

    game.world.reset();
    game.over = false;
    paused = false;
    retry = null;

    engine.hold();
    game.world.player.setLeft(left);
    game.world.player.setTop(top);
    areaId = id;
    setupWorld();
    setupScreen();
    resize();
    engine.resume();
    // the level's music starts from the world's update, once it has loaded

    if (!engine.started) engine.start();
  };

  const startStory = (level = LEVELS[0]) => {
    session = null;
    quests.played("story");
    track("mode_start", { mode: "story" });
    loadWorld(level.id, level.left, level.top);
  };

  const startDaily = () => {
    session = createDailySession();
    daily.start();
    quests.played("daily");
    // asked in the background: the daily seed is the day's, so play starts at once
    daily.ticket = runTickets.start("daily", daily.seed, { wait: Infinity });
    track("mode_start", { mode: "daily" });
    loadWorld(session.startId, session.left, session.top);
  };

  let endlessStarts = 0;
  /** The server picks a ranked run's seed: wait for it briefly, else play an unranked run. */
  const startEndless = async () => {
    const start = ++endlessStarts;
    show(homeScreen, false);
    show(pauseScreen, false);
    toggleLoadingScreen(true);
    const ticket = await runTickets.start("endless");
    if (start !== endlessStarts) return; // started again meanwhile
    toggleLoadingScreen(false);
    session = createEndlessSession(ticket ? ticket.seed : undefined);
    endless.ticks = 0;
    quests.played("endless");
    endless.ticket = ticket ? ticket.ticket : null;
    track("mode_start", { mode: "endless", ranked: !!ticket });
    loadWorld(session.startId, session.left, session.top);
  };

  const startSecret = () => {
    session = createSecretSession();
    show(portalScreen, false);
    quests.played("community");
    track("mode_start", { mode: "secret" });
    track("secret_world_start", {});
    loadWorld(session.startId, session.left, session.top);
  };

  const startBossRush = () => {
    session = createBossRushSession();
    rush.ticks = 0;
    show(portalScreen, false);
    quests.played("bossrush");
    track("mode_start", { mode: "bossrush" });
    track("boss_rush_start", {});
    loadWorld(session.startId, session.left, session.top);
  };

  const startCustom = (world) => {
    try {
      session = createCustomSession(world);
    } catch (error) {
      setCreateStatus(`Couldn't build that world: ${friendlyError(error)}`);
      showToast(`Couldn't build that world`);
      return;
    }
    show(createScreen, false);
    quests.played("community");
    track("mode_start", { mode: "custom" });
    played.mark(world.id);
    social.recordPlay(world.id, "play");
    loadWorld(session.startId, session.left, session.top);
  };

  const pause = () => {
    if (!engine.started || game.over || paused) return;
    clearMouse();
    controller.releaseAll();
    paused = true;
    toggleControllers(false);
    game.world.pauseThemeMusic();
    retry = restarter(
      session,
      LEVELS.find(({ id }) => id === areaId),
    );
    showPanel({
      title: "Paused",
      score: `${levelName(areaId)} · Score ${game.world.score}`,
      resume: true,
      retryLabel: "Restart",
    });
  };

  const resume = () => {
    if (!paused || game.over) return;
    show(pauseScreen, false);
    paused = false;
    toggleControllers(true);
    if (!settings.musicMuted) game.world.playThemeMusic();
  };

  const goHome = () => {
    reportCombo();
    clearMouse();
    controller.releaseAll();
    paused = true;
    game.over = true;
    game.world.stopThemeMusic();
    toggleControllers(false);
    show(pauseScreen, false);
    refreshHome();
    show(homeScreen, true);
    hatchNext();
    flushPending();
  };

  // ------------------------------------------------------------------ home

  // browsing, playing, liking and sharing worlds are free: only creating and remixing are premium
  const modes = {
    daily: startDaily,
    endless: startEndless,
    create: () => openCreator(),
  };

  const NEST_ROWS = 3; // rows the Nest card shows before "+n more"

  /** The Nest card: one row per unhatched egg, or a hint to go find some. */
  const renderNest = () => {
    const list = $("nestList");
    list.innerHTML = "";
    const eggs = nest.list();
    if (!eggs.length) {
      const hint = document.createElement("div");
      hint.className = "card-note";
      hint.textContent = "Find eggs in story levels and the daily challenge.";
      list.appendChild(hint);
      return;
    }
    const now = Date.now();
    eggs.slice(0, NEST_ROWS).forEach((egg) => {
      const row = document.createElement("div");
      row.className = `nest-row${egg.ready ? " ready" : ""}`;
      row.dataset.id = egg.id;
      const icon = document.createElement("span");
      icon.className = "nest-egg";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "🥚";
      const label = document.createElement("span");
      label.textContent = hatchLabel(egg, now);
      row.append(icon, label);
      list.appendChild(row);
    });
    if (eggs.length > NEST_ROWS) {
      const more = document.createElement("div");
      more.className = "card-note";
      more.textContent = `+${eggs.length - NEST_ROWS} more`;
      list.appendChild(more);
    }
  };

  /** The Quests card: today's three quests with their progress, and the chest's keys. */
  const renderQuests = () => {
    const list = $("questList");
    list.innerHTML = "";
    quests.today().forEach((quest) => {
      const row = document.createElement("div");
      row.className = `quest-row${quest.done ? " done" : ""}`;
      const text = document.createElement("span");
      text.className = "quest-text";
      text.textContent = quest.text;
      const bar = document.createElement("span");
      bar.className = "quest-bar";
      const fill = document.createElement("span");
      fill.className = "quest-fill";
      fill.style.width = `${Math.round((quest.have / quest.target) * 100)}%`;
      bar.appendChild(fill);
      const count = document.createElement("span");
      count.className = "quest-count";
      count.textContent = quest.done ? "Done" : `${quest.have} / ${quest.target}`;
      const coins = document.createElement("span");
      coins.className = "quest-coins";
      coins.innerHTML = coinText(quest.coins);
      row.append(text, bar, count, coins);
      list.appendChild(row);
    });
    $("questKeys").textContent = `🔑 ${quests.keys()} / ${CHEST_KEYS}`;
  };

  // ---------------------------------------------------- the hatch card

  const hatchScreen = $("hatchScreen");
  let hatching = null; // { companion } while the card is up

  /** Hatches the oldest due egg and shows its card; the next one follows when it closes. */
  const hatchNext = () => {
    if (hatching || !isVisible($("homeScreen"))) return;
    const egg = nest.due()[0];
    if (!egg) return;
    const result = nest.hatch(egg.id, wallet);
    if (!result) return;
    const item = itemOf("companion", result.companion);
    const name = item ? item.name : "a new friend";
    hatching = { companion: result.companion };
    track("egg_hatched", { companion: result.companion, duplicate: result.duplicate });
    $("hatchTitle").textContent = `Your egg hatched! Meet ${name}.`;
    $("hatchImage").src = `./assets/sprites/companions/${result.companion}-1.png`;
    $("hatchImage").alt = name;
    const note = $("hatchNote");
    note.innerHTML = result.duplicate
      ? `You already have ${esc(name)} · +${coinText(DUPLICATE_COINS)}`
      : "";
    note.hidden = !result.duplicate;
    $("hatchWearBtn").hidden = result.duplicate && wallet.worn().companion === result.companion;
    renderBalance();
    progressChanged();
    refreshHome();
    show(hatchScreen, true);
  };
  const closeHatch = (wear) => {
    if (wear && hatching && wallet.wear("companion", hatching.companion)) {
      progressChanged();
      syncProfile();
    }
    hatching = null;
    show(hatchScreen, false);
    refreshHome();
    hatchNext();
  };
  $("hatchWearBtn").onclick = () => closeHatch(true);
  $("hatchLaterBtn").onclick = () => closeHatch(false);

  const refreshHome = () => {
    // keys that a cloud merge brought to 12 open the chest here
    if (openChest(quests.chest())) progressChanged();
    renderBalance();
    renderNest();
    renderQuests();
    const premium = isPremium();
    document.querySelectorAll(".mode-card.premium").forEach((card) => {
      card.classList.toggle("locked", !premium);
    });
    const today = records.best("daily", String(dailySeed()));
    $("dailyInfo").textContent = today ? `Today's best ${today.score}` : "5 new levels a day";
    // a streak that would reset today doesn't show, and a streak of 1 isn't one yet
    const run = streak.current(dailySeed());
    $("dailyStreak").textContent = run.alive && run.days >= 2 ? `🔥 ${run.days}` : "";
    const endless = records.read()["endless:best"];
    $("endlessInfo").textContent = endless ? `Best: level ${endless.level}` : "How far can you go?";
    const last = LEVELS.find((l) => l.id === campaign.last) || LEVELS[0];
    const stars = campaign.totalStars(LEVELS.map((l) => l.id));
    $("playInfo").textContent =
      last.id === LEVELS[0].id && !stars
        ? "Start your adventure"
        : `Continue · ${last.name} · ★ ${stars}/${LEVELS.length * 3}`;
  };

  // the daily levels change at local midnight (dailySeed): count down to it
  const dailyTimer = $("dailyTimer");
  let dailyDay = dailySeed();
  const two = (n) => String(n).padStart(2, "0");
  const tickDaily = () => {
    const now = new Date();
    if (dailySeed(now) !== dailyDay) {
      dailyDay = dailySeed(now);
      refreshHome(); // today's best starts over
    }
    if (!isVisible(homeScreen)) return;
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const left = Math.max(0, Math.ceil((midnight - now) / 1000));
    const h = Math.floor(left / 3600);
    const m = Math.floor((left % 3600) / 60);
    dailyTimer.textContent = `New levels in ${h}:${two(m)}:${two(left % 60)}`;
  };
  tickDaily();
  setInterval(tickDaily, 1000);

  const openLevels = () => {
    populatePortals(
      (level) => {
        show(portalScreen, false);
        startStory(level);
      },
      {
        isUnlocked: isOpen,
        stars: (id) => starCount(campaign.stars(id)),
        // what each star asks for, and what has been earned
        details: (id) => {
          const area = areas[id];
          return {
            mask: campaign.stars(id),
            coins: area.coins.length,
            enemies: area.enemies.length,
            boss: area.boss ? area.boss.kind : null,
            target: clock(targetTime(area)),
            best: campaign.bestTime(id) == null ? null : clock(campaign.bestTime(id)),
          };
        },
      },
    );
    appendExtraCards();
    show(portalScreen, true);
  };

  /** Starfall Peaks and Boss Rush at the end of the level select: locked until earned. */
  const extraCard = ({ id, name, info, open, onOpen }) => {
    const card = document.createElement("button");
    card.id = id;
    card.className = `extra-card${open ? "" : " locked"}`;
    card.setAttribute("aria-disabled", String(!open));
    const title = document.createElement("span");
    title.className = "extra-card-name";
    title.textContent = open ? name : `${name} · ${info}`;
    card.appendChild(title);
    if (open && info) {
      const sub = document.createElement("span");
      sub.className = "extra-card-info";
      sub.textContent = info;
      card.appendChild(sub);
    }
    if (open) card.onclick = onOpen;
    return card;
  };

  const appendExtraCards = () => {
    const saved = { campaign: { stars: {}, best: {} } };
    LEVELS.forEach(({ id }) => {
      saved.campaign.stars[id] = campaign.stars(id);
      if (campaign.bestTime(id) !== null) saved.campaign.best[id] = campaign.bestTime(id);
    });
    const stars = campaignStars(saved.campaign, LEVELS);
    const beaten = bossesBeaten(saved.campaign, LEVELS);
    const bosses = bossLevels(LEVELS).length;
    const bestRush = stats.read().bossRushBest;
    const section = document.createElement("div");
    section.className = "world-section";
    section.id = "extraModes";
    const head = document.createElement("div");
    head.className = "world-head";
    head.textContent = "Bonus";
    section.append(
      head,
      extraCard({
        id: "starfallCard",
        name: "Starfall Peaks",
        open: secretWorldOpen(saved.campaign, LEVELS),
        info: secretWorldOpen(saved.campaign, LEVELS)
          ? "The secret world"
          : `★ ${SECRET_STARS} to open (you have ${stars})`,
        onOpen: startSecret,
      }),
      extraCard({
        id: "bossRushCard",
        name: "Boss Rush",
        open: bossRushOpen(saved.campaign, LEVELS),
        info: bossRushOpen(saved.campaign, LEVELS)
          ? bestRush === null
            ? `All ${bosses} bosses, back to back`
            : `Best ${clock(bestRush)}`
          : `beat all ${bosses} bosses to open (${beaten}/${bosses})`,
        onOpen: startBossRush,
      }),
    );
    $("portalsWrapper").appendChild(section);
  };

  // Play continues from the last campaign level reached
  playBtn.onclick = () => startStory(LEVELS.find((l) => l.id === campaign.last) || LEVELS[0]);

  document.querySelectorAll(".mode-card").forEach((card) => {
    card.onclick = () => {
      const mode = card.dataset.mode;
      if (mode === "levels") return openLevels();
      modes[mode]();
    };
  });

  resumeBtn.onclick = resume;
  retryBtn.onclick = () => retry && retry();
  homeBtn.onclick = goHome;
  pauseBtn.onclick = pause;

  $("helpBtn").onclick = () => {
    loadHelpIcons();
    show(helpScreen, true);
  };
  $("infoBtn").onclick = () => show(infoScreen, true);
  $("helpCloseBtn").onclick = () => show(helpScreen, false);
  $("infoCloseBtn").onclick = () => show(infoScreen, false);
  $("portalCloseBtn").onclick = () => show(portalScreen, false);

  // -------------------------------------------------------------- settings

  const setMusic = $("setMusic");
  const setSound = $("setSound");
  const setVibration = $("setVibration");
  const setAnalytics = $("setAnalytics");
  const setGhost = $("setGhost");
  const setShake = $("setShake");
  const setLastSeen = $("setLastSeen");
  const setControls = $("setControls");
  const setOpacity = $("setOpacity");
  const setPremiumDev = $("setPremiumDev");

  const refreshSettings = () => {
    setMusic.checked = !settings.musicMuted;
    setSound.checked = !settings.soundMuted;
    setVibration.checked = !!settings.get("vibration");
    setAnalytics.checked = settings.get("analytics") !== false;
    setGhost.checked = settings.get("ghost") !== false;
    setShake.checked = settings.get("shake") !== false;
    setLastSeen.checked = lastSeen.on();
    $("vibrationRow").style.display = navigator.vibrate ? "flex" : "none";
    setControls.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.value === settings.get("controlSize"));
    });
    setOpacity.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.value === settings.get("controlOpacity"));
    });
    const premium = isPremium();
    $("premiumStatus").textContent = premium ? "Active ★" : "Locked";
    $("premiumBtn").style.display = premium ? "none" : "inline-block";
    $("premiumDevRow").style.display = canToggleLocally() ? "flex" : "none";
    setPremiumDev.checked = premium;
    $("unlockDevRow").style.display = canToggleLocally() ? "flex" : "none";
    $("setUnlockDev").checked = devUnlock();
    // an anonymous player (daily leaderboard) is signed out here
    const user = auth.signedIn ? auth.currentUser : null;
    $("accountStatus").textContent = user ? user.displayName : "Not signed in";
    $("accountBtn").textContent = user ? "Sign out" : "Sign in";
    $("deleteAccountRow").style.display = user ? "flex" : "none";
    refreshSaveStatus();
    refreshReminderRow();
  };

  $("settingsBtn").onclick = () => {
    refreshSettings();
    show(settingsScreen, true);
  };
  $("settingsCloseBtn").onclick = () => {
    show(settingsScreen, false);
    refreshHome();
  };
  setMusic.onchange = () => {
    settings.musicMuted = !setMusic.checked;
    if (settings.musicMuted) game.world.pauseThemeMusic();
  };
  setSound.onchange = () => (settings.soundMuted = !setSound.checked);
  setAnalytics.onchange = () => setAnalyticsEnabled(setAnalytics.checked);
  setShake.onchange = () => settings.set("shake", setShake.checked);
  setLastSeen.onchange = () => {
    // the account's setting: the save goes now, so the other devices take it at their next merge
    lastSeen.set(setLastSeen.checked);
    syncProfile();
  };
  setGhost.onchange = () => {
    settings.set("ghost", setGhost.checked);
    ghostOn = setGhost.checked;
  };

  const setReminder = $("setReminder");
  let reminderRefresh = 0;
  /** The reminder switch and its note, from what the device says now. */
  const refreshReminderRow = async () => {
    const run = ++reminderRefresh;
    let current = "off";
    try {
      current = await reminders.state();
    } catch (error) {
      current = "off";
    }
    if (run !== reminderRefresh) return; // a newer refresh is on its way
    const note = { blocked: BLOCKED_TEXT, unsupported: UNSUPPORTED_TEXT }[current] || "";
    setReminder.checked = current === "on";
    setReminder.disabled = current === "blocked" || current === "unsupported";
    $("reminderStatus").textContent = note;
    $("reminderNoteRow").hidden = !note;
  };
  setReminder.onchange = async () => {
    const wantOn = setReminder.checked;
    setReminder.disabled = true;
    try {
      if (wantOn) {
        const result = await reminders.turnOn();
        if (result === "on") track("reminder_toggle", { on: true });
      } else {
        await reminders.turnOff();
        track("reminder_toggle", { on: false });
      }
    } catch (error) {
      showToast(REMINDER_FAILED);
    }
    setReminder.disabled = false;
    refreshReminderRow(); // also puts the switch back to off after a failure
  };
  setVibration.onchange = () => {
    settings.set("vibration", setVibration.checked);
    if (setVibration.checked) vibrate("kill");
  };
  setControls.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      settings.set("controlSize", b.dataset.value);
      sizeControls();
      refreshSettings();
    };
  });
  setOpacity.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      settings.set("controlOpacity", b.dataset.value);
      applyControlOpacity();
      refreshSettings();
    };
  });
  $("accountBtn").onclick = async () => {
    if (auth.signedIn) await auth.signOut().catch(() => {});
    else openLogin(() => refreshSettings(), "settings");
    refreshSettings();
  };
  setPremiumDev.onchange = () => {
    setPremium(setPremiumDev.checked);
    refreshSettings();
    refreshHome();
  };
  $("premiumBtn").onclick = () => openPremium();
  $("setUnlockDev").onchange = () => settings.set("devUnlockAll", $("setUnlockDev").checked);

  let resetArmed = false;
  $("resetBtn").onclick = () => {
    const btn = $("resetBtn");
    if (!resetArmed) {
      resetArmed = true;
      btn.textContent = "Tap again to erase";
      setTimeout(() => {
        resetArmed = false;
        btn.textContent = "Reset progress";
      }, 3000);
      return;
    }
    resetArmed = false;
    btn.textContent = "Progress erased";
    // Everything cloud save carries goes, with the reset stamped so no device or
    // account save from before it merges back; created worlds are not part of it.
    resetLocal();
    ghostStore.clearAll();
    keptGhost = null;
    try {
      localStorage.removeItem("my_worlds");
    } catch (error) {
      // blocked storage: nothing to erase
    }
    // The game's modules read their storage once, so start fresh from the reset
    // device once the account has it (or after 4 s: an unsent reset goes with the next sync).
    const reload = () => window.location.reload();
    Promise.race([cloud.reset(), new Promise((resolve) => setTimeout(resolve, 4000))]).then(
      reload,
      reload,
    );
  };

  // ----------------------------------------------- first open and the world 1 card

  const hintEl = $("hint");
  let hint = null; // { run } while the controls hint is showing
  let hintPending = false; // first open: the hint starts when Grassland 1 has loaded

  const beginHint = () => {
    hintPending = false;
    hintEl.textContent = onboarding.hintText(isTouchesEnabled);
    hintEl.classList.add("show");
    hint = { run: onboarding.startHint(Date.now()) };
  };

  /** Fades the hint out once the player has moved and jumped, or after 15 s. */
  const tickHint = () => {
    if (!hint) return;
    const result = hint.run.tick(Date.now());
    if (!result) return;
    hint = null;
    onboarding.hintDone();
    hintEl.classList.remove("show");
    track("onboarding_hint_done", result);
  };

  /** A device with no progress starts in Grassland 1, with no home screen. */
  const firstOpen = () => {
    const ids = LEVELS.map((l) => l.id);
    const state = {
      reached: ids.filter((id) => campaign.isUnlocked(id)),
      stars: Object.fromEntries(ids.map((id) => [id, campaign.stars(id)])),
    };
    if (!onboarding.takeFirstOpen(state)) return;
    track("onboarding_start", {});
    hintPending = true;
    startStory(LEVELS[0]);
  };

  const world1Screen = $("world1Screen");
  const openWorld1Card = () => {
    clearMouse();
    controller.releaseAll();
    paused = true;
    toggleControllers(false);
    game.world.pauseThemeMusic();
    show(world1Screen, true);
  };
  const closeWorld1Card = (choice) => {
    show(world1Screen, false);
    track("world1_offer", { choice });
    if (choice === "later") {
      paused = false;
      toggleControllers(true);
      if (!settings.musicMuted) game.world.playThemeMusic();
      return;
    }
    goHome();
    if (choice === "community") openCreator("community");
    else {
      openCreator("create");
      if (!isPremium()) openPremium();
    }
  };
  $("world1CommunityBtn").onclick = () => closeWorld1Card("community");
  $("world1CreateBtn").onclick = () => closeWorld1Card("create");
  $("world1LaterBtn").onclick = () => closeWorld1Card("later");

  // ------------------------------------------------------------------ shop

  const shopScreen = $("shopScreen");
  const shopActionBtn = $("shopActionBtn");
  const previewCanvas = $("shopPreview");
  let shopSlot = "skin";
  let shopPick = { ...FREE }; // the item of each slot the preview shows
  const preview = { dino: [], fire: null, tinted: new Map(), index: 0, timer: null };
  const IDLE_FRAMES = 10;
  // the game's idle delay is 4 ticks (a frame every 5 ticks of 1/30 s)
  const IDLE_MS = (5 * 1000) / 30;
  const num = (n) => n.toLocaleString("en-US");

  const loadSprite = (src) => {
    const image = new Image();
    image.onload = () => drawPreview();
    image.src = src;
    return image;
  };

  // a sprite in its colours, once it has loaded (tinted once per colour, then kept)
  const spriteReady = (image) => image && image.complete && image.naturalWidth;
  const tinted = (image, key, palette) => {
    if (!spriteReady(image)) return null;
    if (!palette || !palette.length) return image;
    if (!preview.tinted.has(key)) preview.tinted.set(key, tintFrames([image], palette)[0]);
    return preview.tinted.get(key);
  };
  const idleFrame = (skin) => {
    const image = preview.dino[preview.index % IDLE_FRAMES];
    return tinted(image, `skin:${skin}:${preview.index % IDLE_FRAMES}`, SKIN_PALETTES[skin]);
  };

  /** The dino with the picked skin, hat and fireball: drawn like the game draws it. */
  const drawPreview = () => {
    const ctx = previewCanvas.getContext("2d");
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.imageSmoothingEnabled = false;
    const dino = idleFrame(shopPick.skin);
    const fire = tinted(
      preview.fire,
      `fireball:${shopPick.fireball}`,
      FIREBALL_PALETTES[shopPick.fireball],
    );
    const pals = shopPick.companion !== "none" ? companionFrames(shopPick.companion) : [];
    const palFrame = pals[Math.floor(preview.index / 4) % 2];
    ctx.save();
    // the dino's visible body spans x -17..15 and y -33..1 (game units), the tallest
    // hat reaches y -41 and the flame ends near x 31: all inside 240x140 with a margin;
    // with a companion beside it, the pair moves right to make room
    ctx.translate(pals.length ? 144 : 100, 125);
    ctx.scale(2.8, 2.8);
    if (palFrame && spriteReady(palFrame)) {
      ctx.drawImage(
        palFrame,
        -48,
        -COMPANION_SIZE.height,
        COMPANION_SIZE.width,
        COMPANION_SIZE.height,
      );
    }
    if (dino) ctx.drawImage(dino, -18, -35, 60, 40);
    const hat = hatImage(shopPick.hat);
    if (hat && hat.naturalWidth) drawHat(ctx, hat, 1, dino);
    if (fire) {
      const ratio = (fire.naturalWidth || fire.width) / (fire.naturalHeight || fire.height) || 1;
      ctx.drawImage(fire, 8, -20, 14 * ratio, 14); // its visible tip just past the snout
    }
    ctx.restore();
  };

  const renderShop = () => {
    renderBalance();
    document.querySelectorAll("#shopTabs .tab").forEach((tab) => {
      const on = tab.dataset.slot === shopSlot;
      tab.classList.toggle("active", on);
      tab.setAttribute("aria-selected", String(on));
    });
    const worn = wallet.worn();
    const list = $("shopItems");
    list.innerHTML = "";
    CATALOG[shopSlot].forEach((item) => {
      const button = document.createElement("button");
      const isWorn = worn[shopSlot] === item.id;
      const owned = wallet.owns(shopSlot, item.id);
      button.className = `shop-item${shopPick[shopSlot] === item.id ? " selected" : ""}${
        isWorn ? " worn" : ""
      }`;
      button.dataset.id = item.id;
      const name = document.createElement("span");
      name.className = "shop-item-name";
      name.textContent = item.name;
      const state = document.createElement("span");
      state.className = "shop-item-state";
      if (isWorn || owned) state.textContent = isWorn ? "Worn" : "Owned";
      else if (isHatchOnly(shopSlot, item.id)) state.textContent = "From an egg";
      else state.innerHTML = coinText(item.price);
      button.append(name, state);
      button.onclick = () => {
        shopPick[shopSlot] = item.id;
        renderShop();
      };
      list.appendChild(button);
    });

    const picked = itemOf(shopSlot, shopPick[shopSlot]);
    $("shopSelected").textContent = picked ? picked.name : "";
    let label = "";
    let can = false;
    if (picked) {
      const balance = wallet.balance();
      if (worn[shopSlot] === picked.id) label = "Worn";
      else if (wallet.owns(shopSlot, picked.id)) ((label = "Wear"), (can = true));
      else if (isHatchOnly(shopSlot, picked.id)) label = "From an egg";
      else if (balance >= picked.price) ((label = `Buy · ${coinText(picked.price)}`), (can = true));
      else label = `Need ${coinText(picked.price - balance)} more`;
    }
    shopActionBtn.innerHTML = label;
    shopActionBtn.classList.toggle("cant", !can);
    shopActionBtn.setAttribute("aria-disabled", String(!can));
    drawPreview();
  };

  shopActionBtn.onclick = () => {
    const slot = shopSlot;
    const picked = itemOf(slot, shopPick[slot]);
    if (!picked) return;
    if (wallet.owns(slot, picked.id)) {
      if (wallet.worn()[slot] !== picked.id && wallet.wear(slot, picked.id)) {
        progressChanged();
        syncProfile();
      }
    } else if (wallet.buy(slot, picked.id).ok) {
      track("shop_buy", { item: `${slot}:${picked.id}`, price: picked.price });
      progressChanged();
    }
    renderShop();
  };
  document.querySelectorAll("#shopTabs .tab").forEach((tab) => {
    tab.onclick = () => {
      shopSlot = tab.dataset.slot;
      renderShop();
    };
  });
  const openShop = () => {
    if (!preview.dino.length) {
      for (let i = 1; i <= IDLE_FRAMES; i++) {
        preview.dino.push(loadSprite(`./assets/sprites/player/right/Idle (${i}).webp`));
      }
      preview.fire = loadSprite("./assets/sprites/fireball/right/image 1.webp");
    }
    shopPick = { ...FREE, ...wallet.worn() }; // opens on what is worn now
    renderShop();
    show(shopScreen, true);
    // breathe at the game's idle rate while the shop is open
    clearInterval(preview.timer);
    preview.timer = setInterval(() => {
      preview.index = (preview.index + 1) % IDLE_FRAMES;
      drawPreview();
    }, IDLE_MS);
  };
  $("shopBtn").onclick = openShop;
  $("shopCloseBtn").onclick = () => {
    clearInterval(preview.timer);
    preview.timer = null;
    show(shopScreen, false);
    refreshHome();
  };

  // ---------------------------------------------------------- achievements

  const openAchievements = () => {
    const progress = readLocal();
    const list = $("achievementsList");
    list.innerHTML = "";
    let unlocked = 0;
    ACHIEVEMENTS.forEach(({ id, name, how, coins }) => {
      const at = Object.hasOwn(progress.achievements, id) ? progress.achievements[id] : null;
      if (at !== null) unlocked += 1;
      const row = document.createElement("div");
      row.className = `ach-row${at === null ? " locked" : ""}`;
      row.dataset.id = id;
      const icon = document.createElement("span");
      icon.className = "ach-icon";
      icon.textContent = "🏆";
      const text = document.createElement("div");
      text.className = "ach-text";
      const title = document.createElement("span");
      title.className = "ach-name";
      title.textContent = name;
      const hint = document.createElement("span");
      hint.className = "ach-how";
      hint.textContent = how;
      text.append(title, hint);
      const side = document.createElement("div");
      side.className = "ach-side";
      if (at !== null) {
        const reward = document.createElement("span");
        reward.className = "ach-coins";
        reward.textContent = `+${num(coins)}`;
        const date = document.createElement("span");
        date.className = "ach-date";
        date.textContent = new Date(at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
        side.append(reward, date);
      } else {
        const toward = progressToward(id, progress, LEVELS);
        if (toward) {
          side.textContent = `${num(toward.have)} / ${num(toward.need)}${
            toward.unit ? ` ${toward.unit}` : ""
          }`;
        }
      }
      row.append(icon, text, side);
      list.appendChild(row);
    });
    $("achievementsCount").textContent = `${unlocked} / ${ACHIEVEMENTS.length}`;
    show($("achievementsScreen"), true);
  };
  $("achievementsBtn").onclick = openAchievements;
  $("achievementsCloseBtn").onclick = () => show($("achievementsScreen"), false);

  // ---------------------------------------------------------- cloud save

  // The account's save starts after the first input (Firebase stays unloaded until then),
  // for any player with an account: signed in or anonymous. Signing out only stops it.
  let cloudUid = null;
  let playerActed = false;
  const syncCloud = () => {
    if (!playerActed) return;
    const user = auth.currentUser;
    if (user && user.uid !== cloudUid) {
      cloudUid = user.uid;
      // the profile waits for this account's save to merge (onMerge), so it carries the
      // account's look and switch, not this device's; the save may also earn something
      profileGate.start(user.uid);
      cloud.start(user.uid).then(checkAchievements);
    } else if (!user && cloudUid) {
      cloudUid = null;
      profileGate.stop();
      cloud.stop();
    }
  };
  auth.onAuthStateChanged(syncCloud);
  const armCloud = () => {
    ["pointerdown", "keydown"].forEach((name) => window.removeEventListener(name, armCloud));
    playerActed = true;
    syncCloud();
  };
  ["pointerdown", "keydown"].forEach((name) => window.addEventListener(name, armCloud));

  const refreshSaveStatus = () => {
    $("saveStatus").textContent =
      cloud.status() === "saved"
        ? "Progress saved to your account"
        : "Progress saved on this device";
  };
  setInterval(() => isVisible(settingsScreen) && refreshSaveStatus(), 1000);

  // --------------------------------------------------------------- premium

  const openPremium = () => {
    const local = canToggleLocally();
    $("premiumNote").textContent = local
      ? "Testing locally: this unlocks Premium on this device."
      : "Coming soon on Google Play.";
    $("premiumUnlockBtn").style.display = local ? "block" : "none";
    show(premiumScreen, true);
  };
  $("premiumCloseBtn").onclick = () => show(premiumScreen, false);
  $("premiumUnlockBtn").onclick = () => {
    setPremium(true);
    show(premiumScreen, false);
    refreshHome();
  };

  // ------------------------------------------------------------- sign-in

  const esc = (text) =>
    String(text).replace(
      /[&<>"']/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
    );

  /** A button that is working: disabled, with its spinner turning. */
  const setBusy = (button, busy) => {
    button.disabled = busy;
    button.classList.toggle("busy", busy);
  };

  // Google sign-in leaves the page: what to open when the player comes back
  const LOGIN_NEXT = "login_next";
  const tabStore = {
    get: (key) => {
      try {
        return sessionStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    set: (key, value) => {
      try {
        if (value == null) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, value);
      } catch (error) {
        // private mode: the player lands on the home screen, signed in
      }
    },
  };
  const loginIntents = {
    worlds: () => openCreator("create"),
    settings: () => {
      refreshSettings();
      show(settingsScreen, true);
    },
  };

  let afterLogin = null;
  let loginIntent = null;
  const loginName = $("loginName");
  const loginEmail = $("loginEmail");
  const loginPassword = $("loginPassword");
  const loginError = $("loginError");
  const loginButtons = ["loginGoogleBtn", "loginEmailBtn", "loginCreateBtn", "loginResetBtn"];

  const loginMessage = (text, ok = false) => {
    loginError.textContent = text;
    loginError.classList.toggle("ok", ok);
  };

  /** `then` runs after sign-in; `intent` (loginIntents) replaces it after a Google redirect. */
  const openLogin = (then, intent = null) => {
    afterLogin = then || null;
    loginIntent = intent;
    loginMessage("");
    show(loginScreen, true);
    // start downloading sign-in while the player types
    auth.start();
  };
  const busyLogin = (busy) => loginButtons.forEach((id) => ($(id).disabled = busy));

  /** Run `then` signed in: straight away, or after the sign-in screen. */
  const requireLogin = async (then, intent = null) => {
    if (!auth.currentUser && !auth.known) {
      showToast("<b>Checking your account…</b>");
      await auth.ready();
    }
    // an anonymous player (daily leaderboard) counts as signed out here
    return auth.signedIn ? then() : openLogin(then, intent);
  };

  const signIn = async (method) => {
    loginMessage("");
    busyLogin(true);
    try {
      if (method === "reset") {
        await auth.resetPassword(loginEmail.value);
        loginMessage(
          "Check your email for a link to reset your password. It brings you back here.",
          true,
        );
        return;
      }
      if (method === "google") {
        tabStore.set(LOGIN_NEXT, loginIntent || "home");
        loginMessage("Taking you to Google…", true);
        await auth.signInWithGoogle(); // the page leaves for Google
        return;
      }
      await auth.signInWithEmail({
        email: loginEmail.value,
        password: loginPassword.value,
        name: loginName.value,
        create: method === "create",
      });
    } catch (error) {
      if (method === "google") tabStore.set(LOGIN_NEXT, null);
      loginMessage(friendlyError(error));
      return;
    } finally {
      busyLogin(false);
    }
    loginPassword.value = "";
    show(loginScreen, false);
    const next = afterLogin;
    afterLogin = null;
    loginIntent = null;
    // a new email account: verify the address first, then carry on
    if (method === "create") openVerify(next, { thenOnClose: true });
    else if (next) next();
  };
  $("loginGoogleBtn").onclick = () => signIn("google");
  $("loginEmailBtn").onclick = () => signIn("email");
  $("loginCreateBtn").onclick = () => signIn("create");
  $("loginResetBtn").onclick = () => signIn("reset");
  [loginEmail, loginPassword].forEach((input) =>
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") signIn("email");
    }),
  );
  $("loginCloseBtn").onclick = () => {
    afterLogin = null;
    loginIntent = null;
    show(loginScreen, false);
  };

  // back from Google: finish what the player was doing
  const pendingLogin = tabStore.get(LOGIN_NEXT);
  if (pendingLogin) {
    tabStore.set(LOGIN_NEXT, null);
    auth.start();
    let done = false;
    const stopWaiting = auth.onAuthStateChanged((user) => {
      if (!user || done) return;
      done = true;
      setTimeout(() => stopWaiting()); // not inside its own first call
      showToast(`<b>Signed in as ${esc(user.displayName)}</b>`);
      if (loginIntents[pendingLogin]) loginIntents[pendingLogin]();
    });
    setTimeout(() => !done && stopWaiting(), 30000);
  }
  // a Google sign-in that came back with an error
  auth.onError((error) => {
    openLogin(null, pendingLogin);
    loginMessage(friendlyError(error));
  });

  // ---------------------------------------------------------- verify email

  const verifyStatus = $("verifyStatus");
  const verifyDoneBtn = $("verifyDoneBtn");
  let afterVerify = null;
  let verifyThenOnClose = false;
  const verifyMessage = (text, ok = false) => {
    verifyStatus.textContent = text;
    verifyStatus.classList.toggle("ok", ok);
  };

  /** Ask an email account to verify; `then` runs once verified (or on close, if asked). */
  const openVerify = (then = null, { thenOnClose = false } = {}) => {
    afterVerify = then;
    verifyThenOnClose = thenOnClose;
    $("verifyEmail").textContent = (auth.currentUser && auth.currentUser.email) || "your email";
    verifyMessage("");
    show(verifyScreen, true);
  };
  const closeVerify = (verified) => {
    show(verifyScreen, false);
    const next = afterVerify;
    afterVerify = null;
    if (next && (verified || verifyThenOnClose)) next();
  };

  /** Run `then` with a verified account (creating worlds needs one). */
  const requireVerified = (then) =>
    requireLogin(() => (auth.needsVerification() ? openVerify(then) : then()), "worlds");

  const checkVerified = async ({ quiet = false } = {}) => {
    if (!quiet) {
      setBusy(verifyDoneBtn, true);
      verifyMessage("");
    }
    try {
      const user = await auth.reload();
      if (user && !auth.needsVerification(user)) {
        showToast("<b>Email verified</b><span>You can create worlds now</span>");
        closeVerify(true);
      } else if (!quiet) {
        verifyMessage("Not verified yet. Open the link in the email, then try again.");
      }
    } catch (error) {
      if (!quiet) verifyMessage(friendlyError(error));
    } finally {
      if (!quiet) setBusy(verifyDoneBtn, false);
    }
  };
  verifyDoneBtn.onclick = () => checkVerified();
  $("verifyResendBtn").onclick = async () => {
    const button = $("verifyResendBtn");
    button.disabled = true;
    try {
      await auth.sendVerification();
      verifyMessage("Sent. Check your inbox.", true);
    } catch (error) {
      verifyMessage(friendlyError(error));
    } finally {
      button.disabled = false;
    }
  };
  $("verifySwitchBtn").onclick = async () => {
    afterVerify = null;
    show(verifyScreen, false);
    show(createScreen, false);
    await auth.signOut().catch(() => {});
    openLogin(() => openCreator("create"), "worlds");
  };
  $("verifyCloseBtn").onclick = () => closeVerify(false);
  // verified in another tab or the mail app: notice it on coming back
  window.addEventListener("focus", () => {
    if (isVisible(verifyScreen)) checkVerified({ quiet: true });
  });

  // ------------------------------------------------- links in our emails

  // Firebase's emails link back here: ?verified=1 after verifying, ?reset=1 after a new password
  const arrivedFrom = new URLSearchParams(location.search);
  if (arrivedFrom.has("verified") || arrivedFrom.has("reset")) {
    arrivedFrom.delete("verified");
    arrivedFrom.delete("reset");
    const rest = arrivedFrom.toString();
    const verifiedLink = /[?&]verified=/.test(location.search);
    history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);
    if (verifiedLink) {
      auth.ready().then(async () => {
        if (!auth.signedIn) {
          showToast("<b>Email verified</b><span>Sign in to create worlds</span>");
          return;
        }
        const user = await auth.reload().catch(() => auth.currentUser);
        if (user && !auth.needsVerification(user)) {
          showToast("<b>Email verified</b><span>You can create worlds now</span>");
        }
      });
    } else {
      openLogin(() => openCreator("create"), "worlds");
      loginMessage("Password changed. Sign in with your new password.", true);
    }
  }

  // --------------------------------------------------------- delete account

  const deleteConfirmBtn = $("deleteConfirmBtn");
  const deleteStatus = $("deleteStatus");
  const deleteInput = $("deleteConfirmInput");
  // the Delete button waits for DELETE, exactly as typed (capitals, no spaces)
  const syncDeleteConfirm = () => {
    deleteConfirmBtn.disabled = deleteInput.value !== "DELETE";
  };
  deleteInput.addEventListener("input", syncDeleteConfirm);
  /** Opens the flow for a real account; an anonymous player is never offered it. */
  const openDelete = () => {
    if (!auth.signedIn) return;
    $("deleteAccountName").textContent = auth.currentUser.displayName;
    deleteStatus.textContent = "";
    deleteInput.value = "";
    syncDeleteConfirm();
    show(deleteScreen, true);
  };
  $("deleteAccountBtn").onclick = openDelete;
  loginIntents["delete-account"] = openDelete;
  let deleting = false;
  const closeDelete = () => {
    if (!deleting) show(deleteScreen, false);
  };
  $("deleteCloseBtn").onclick = closeDelete;
  $("deleteCancelBtn").onclick = closeDelete;
  deleteConfirmBtn.onclick = async () => {
    const user = auth.signedIn ? auth.currentUser : null;
    if (!user || deleteInput.value !== "DELETE") return;
    deleteStatus.textContent = "";
    deleting = true;
    setBusy(deleteConfirmBtn, true);
    $("deleteCancelBtn").disabled = true;
    try {
      await auth.deleteAccount();
    } catch (error) {
      deleteStatus.textContent = friendlyError(error);
      return;
    } finally {
      deleting = false;
      setBusy(deleteConfirmBtn, false);
      $("deleteCancelBtn").disabled = false;
      syncDeleteConfirm();
    }
    // ?account=delete has done its job
    const rest = new URLSearchParams(location.search);
    if (rest.get("account") === "delete") {
      rest.delete("account");
      const query = rest.toString();
      history.replaceState(
        null,
        "",
        location.pathname + (query ? `?${query}` : "") + location.hash,
      );
    }
    deleteInput.value = "";
    // the copies on this device show the new author too
    const anonymous = (world) =>
      world.author.uid === user.uid ? { ...world, author: { uid: "", name: ANONYMOUS } } : world;
    worlds.save(worlds.list().map(anonymous));
    community = community.map(anonymous);
    loginName.value = "";
    show(deleteScreen, false);
    refreshSettings();
    showToast("<b>Account deleted</b><span>Your worlds stay, by Anonymous</span>");
  };

  // account chip in the Worlds header: tap to arm, tap again to sign out
  const accountChip = $("accountChip");
  let signOutArmed = null;
  const renderAccount = () => {
    const user = auth.signedIn ? auth.currentUser : null;
    accountChip.style.display = user ? "flex" : "none";
    if (!user) return;
    $("accountAvatar").textContent = user.displayName.slice(0, 1).toUpperCase();
    $("accountName").textContent = signOutArmed ? "Sign out?" : user.displayName;
  };
  accountChip.onclick = () => {
    if (signOutArmed) {
      clearTimeout(signOutArmed);
      signOutArmed = null;
      auth.signOut().catch(() => {});
      show(createScreen, false);
      return;
    }
    signOutArmed = setTimeout(() => {
      signOutArmed = null;
      renderAccount();
    }, 3000);
    renderAccount();
  };
  let nameOwner = null; // the account whose name is in loginName
  auth.onAuthStateChanged((user) => {
    renderAccount();
    const real = auth.signedIn ? user : null;
    const owner = real ? real.uid : null;
    if (owner !== nameOwner) {
      // a different account (or none): the field never keeps someone else's
      // name, which a later email sign-in would otherwise rename the account to
      loginName.value = (real && real.displayName) || "";
      nameOwner = owner;
    }
    if (real) watchCommunity();
  });

  // ------------------------------------------------------------ repository

  const repo = new FirestoreRepository(firestoreWorlds);
  let unwatch = null;
  // the Dino Team's starter worlds are always there, even offline
  let community = starterWorlds();
  const freshIds = new Set();

  /** New worlds from anyone, as they are published. */
  const watchCommunity = () => {
    if (unwatch) return;
    unwatch = repo.subscribe((world) => {
      community = mergeWorlds(community, [world]);
      freshIds.add(world.id);
      if (isVisible(createScreen)) renderCommunity();
      const mine = auth.currentUser && world.author.uid === auth.currentUser.uid;
      if (!mine && !isPlaying()) {
        showToast(`<b>New world: ${esc(world.name)}</b><span>by ${esc(world.author.name)}</span>`);
      }
    });
  };

  // Trending (the default list), the world of the week, and each world's counts and likes
  let listMode = "trending"; // trending | new
  const trending = { status: "loading", error: "", worlds: [] }; // status: loading | ok | error
  let featuredWorld = null;
  let linkedWorld = null; // the world a shared link opened, shown first
  const statsMap = new Map(); // world id -> { plays, finishes, likes }
  const likedSet = new Set();
  const seenForStats = new Set();
  let likesOwner = auth.currentUser ? auth.currentUser.uid : null;
  auth.onAuthStateChanged((user) => {
    const owner = user ? user.uid : null;
    if (owner === likesOwner) return;
    likesOwner = owner;
    // the hearts were the previous account's: ask again for this one
    likedSet.clear();
    seenForStats.clear();
  });

  /** Worlds by id: from the loaded lists first, the rest from the repository. */
  const worldsById = async (ids) => {
    const have = new Map([...community, ...trending.worlds].map((w) => [w.id, w]));
    const missing = ids.filter((id) => !have.has(id));
    if (missing.length) (await repo.byIds(missing)).forEach((w) => have.set(w.id, w));
    return ids.map((id) => have.get(id)).filter(Boolean);
  };

  /** Counts and likes for the community worlds in `list`, once each. */
  const hydrate = async (list) => {
    const ids = list.map((w) => w.id).filter((id) => !isBuiltIn(id) && !seenForStats.has(id));
    if (!ids.length) return;
    ids.forEach((id) => seenForStats.add(id));
    try {
      const found = await social.stats(ids);
      Object.entries(found).forEach(([id, counts]) => statsMap.set(id, counts));
    } catch (error) {
      // no counts this time: the cards show without them, and the next load asks again
      ids.forEach((id) => seenForStats.delete(id));
    }
    try {
      (await social.liked(ids)).forEach((id) => likedSet.add(id));
    } catch (error) {
      // hearts stay empty; the counts above still show
    }
    if (isVisible(createScreen)) renderCommunity();
  };

  let trendingRun = 0;
  const loadTrending = async () => {
    const run = ++trendingRun;
    trending.status = "loading";
    renderCommunity();
    try {
      const ids = await social.trending();
      const found = await worldsById(ids);
      if (run !== trendingRun) return;
      trending.worlds = found;
      trending.status = "ok";
    } catch (error) {
      if (run !== trendingRun) return;
      trending.status = "error";
      trending.error = friendlyError(error);
    }
    renderCommunity();
    hydrate(trending.worlds);
  };

  const loadFeatured = async () => {
    try {
      const id = await social.featured();
      const [found] = id ? await worldsById([id]) : [];
      featuredWorld = found || null;
    } catch (error) {
      featuredWorld = null; // no banner when it can't be read
    }
    renderCommunity();
  };

  const communityStatus = $("communityStatus");
  let connection = "loading"; // loading | live | local | stale | error
  let connectionError = "";
  const plural = (n) => `${n} world${n === 1 ? "" : "s"}`;
  const renderStatus = () => {
    if (searchHits) {
      communityStatus.className = "live-status";
      communityStatus.textContent = {
        searching: `Searching all worlds… ${plural(searchHits.length)} so far`,
        short: "Type at least 2 letters",
        done: `${plural(searchHits.length)} found`,
        error: `Couldn't search all worlds, showing loaded ones · ${plural(searchHits.length)}`,
      }[searchState];
      return;
    }
    const trendingShown = listMode === "trending" && trending.status !== "ok";
    const state = trendingShown ? trending.status : connection;
    const message = trendingShown ? trending.error : connectionError;
    const count = plural(
      trendingShown ? 0 : listMode === "trending" ? trending.worlds.length : community.length,
    );
    communityStatus.className =
      state === "live" || state === "ok" ? "live-status on" : "live-status";
    communityStatus.textContent = {
      loading: "Loading worlds…",
      ok: `Live · ${count}`,
      live: `Live · ${count}`,
      stale: `Offline · saved list · ${count}`,
      error: `Offline (${message}) · ${count}`,
    }[state];
  };
  const loadCommunity = async () => {
    connection = "loading";
    renderStatus();
    try {
      const list = await repo.list({ limit: 60 });
      community = mergeWorlds(community, list);
      connection = list.stale ? "stale" : "live";
    } catch (error) {
      connection = "error";
      connectionError = friendlyError(error);
    }
    if (searchHits) runSearch();
    else renderCommunity();
    hydrate(community);
  };
  $("communityRefresh").onclick = () => {
    loadCommunity();
    loadTrending();
    loadFeatured();
  };

  // ---------------------------------------------------------------- search

  // the loaded worlds filter at once; the searchWorlds function adds every older match
  const worldSearch = $("worldSearch");
  let searchHits = null; // null: not searching
  let searchState = "done"; // searching | short | done | error
  let searchRun = 0;
  let searchTimer = null;
  const runSearch = async () => {
    clearTimeout(searchTimer);
    const query = worldSearch.value.trim();
    const run = ++searchRun;
    if (!searchTerms(query).length) {
      searchHits = null;
      renderCommunity();
      return;
    }
    searchHits = matchWorlds(community, query);
    searchState = searchTerms(query).join("").length < 2 ? "short" : "searching";
    renderCommunity();
    if (searchState === "short") return;
    try {
      const found = await repo.search(query);
      if (run !== searchRun) return;
      searchHits = matchWorlds(mergeWorlds(searchHits, found), query);
      searchState = "done";
    } catch (error) {
      if (run !== searchRun) return;
      searchState = "error";
    }
    renderCommunity();
  };
  worldSearch.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 350);
  });
  worldSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearch();
  });

  // ---------------------------------------------------------- world cards

  // previews are painted one at a time so a long list doesn't freeze the menu
  const thumbs = new Map();
  const thumbQueue = [];
  const drainThumbs = () => {
    const job = thumbQueue.shift();
    if (!job) return;
    const [img, world, key] = job;
    if (!thumbs.has(key)) {
      try {
        const canvas = previewImage(world);
        thumbs.set(key, canvas.toDataURL ? canvas.toDataURL() : "");
      } catch (error) {
        thumbs.set(key, "");
      }
    }
    if (thumbs.get(key)) img.src = thumbs.get(key);
    if (thumbQueue.length) setTimeout(drainThumbs, 16);
  };
  const queueThumb = (img, world) => {
    const key = `${world.id}:${world.seed}`;
    if (thumbs.has(key)) {
      if (thumbs.get(key)) img.src = thumbs.get(key);
      return;
    }
    thumbQueue.push([img, world, key]);
    if (thumbQueue.length === 1) setTimeout(drainThumbs, 0);
  };

  const ago = (time) => {
    const s = Math.max(0, (Date.now() - time) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  };

  const remixNames = new Map(); // world id -> name, "" when it can't be found
  const remixName = async (id) => {
    if (!remixNames.has(id)) {
      const known = community.find((w) => w.id === id);
      try {
        remixNames.set(id, known ? known.name : (await repo.byIds([id]))[0]?.name || "");
      } catch (error) {
        return ""; // offline: asked again with the next card
      }
    }
    return remixNames.get(id);
  };

  const worldCard = (world, { fresh = false, linked = false, onRemove = null } = {}) => {
    const { spec } = world;
    const shareable = !isBuiltIn(world.id);
    const card = document.createElement("div");
    const wasPlayed = played.has(world.id);
    card.className = `world-card${fresh ? " fresh" : ""}${linked ? " linked" : ""}${wasPlayed ? " played" : ""}`;
    const info = document.createElement("div");
    info.className = "world-info";
    const img = document.createElement("img");
    img.className = "world-thumb";
    img.alt = "";
    queueThumb(img, world);
    const text = document.createElement("div");
    text.className = "world-text";
    const name = document.createElement("div");
    name.className = "world-name";
    name.textContent = world.name;
    if (fresh) {
      const badge = document.createElement("span");
      badge.className = "world-badge";
      badge.textContent = "NEW";
      name.appendChild(badge);
    }
    if (wasPlayed) {
      const badge = document.createElement("span");
      badge.className = "world-badge played-badge";
      badge.textContent = "PLAYED";
      name.appendChild(badge);
    }
    const meta = document.createElement("div");
    meta.className = "world-meta";
    meta.textContent = `by ${world.author.name} · ${ago(world.createdAt)} · ${"★".repeat(
      spec.difficulty,
    )} · Boss: ${spec.boss.name}`;
    const best = records.best("custom", world.id);
    if (best) meta.textContent += ` · best ${best.score}`;
    text.append(name, meta);
    if (world.tagline) {
      const tagline = document.createElement("div");
      tagline.className = "world-tagline";
      tagline.textContent = world.tagline;
      text.appendChild(tagline);
    }
    if (world.remixOf) {
      const remixed = document.createElement("div");
      remixed.className = "world-remix";
      remixed.hidden = true;
      remixName(world.remixOf).then((original) => {
        if (!original) return;
        remixed.textContent = `Remix of ${original}`;
        remixed.hidden = false;
      });
      text.appendChild(remixed);
    }
    const stat = document.createElement("div");
    stat.className = "world-stats";
    stat.hidden = true;
    const week = document.createElement("div");
    week.className = "world-week";
    week.hidden = true;
    week.dataset.world = world.id;
    text.append(stat, week);
    info.append(img, text);
    const actions = document.createElement("div");
    actions.className = "world-actions";
    const play = document.createElement("button");
    play.className = "btn btn-small";
    play.textContent = "Play";
    play.onclick = () => startCustom(world);
    if (shareable) {
      const heart = document.createElement("button");
      heart.className = "like-btn";
      heart.textContent = "❤";
      const share = document.createElement("button");
      share.className = "btn btn-small";
      share.textContent = "Share";
      const remix = document.createElement("button");
      remix.className = "btn btn-small";
      remix.textContent = "Remix";
      const refresh = () => {
        const counts = statsMap.get(world.id);
        stat.hidden = !counts;
        if (counts)
          stat.textContent = `▶ ${formatCount(counts.plays)} · ❤ ${formatCount(counts.likes)}`;
        const liked = likedSet.has(world.id);
        heart.classList.toggle("liked", liked);
        heart.setAttribute("aria-pressed", String(liked));
        heart.setAttribute("aria-label", liked ? `Unlike ${world.name}` : `Like ${world.name}`);
      };
      refresh();
      heart.onclick = async () => {
        if (heart.disabled) return;
        heart.disabled = true;
        try {
          const { liked, likes } = await social.toggleLike(world.id);
          if (liked) likedSet.add(world.id);
          else likedSet.delete(world.id);
          const counts = statsMap.get(world.id) || { plays: 0, finishes: 0, likes: 0 };
          statsMap.set(world.id, { ...counts, likes });
          refresh();
          track("world_like", { liked });
        } catch (error) {
          showToast(esc(friendlyError(error)));
        } finally {
          heart.disabled = false;
        }
      };
      share.onclick = async () => {
        const method = await shareRun(worldLink(world.id));
        if (method === "failed") return showToast("Couldn't share. Try again.");
        if (method === "copy") showToast("Link copied");
        track("world_share", { method });
      };
      remix.onclick = () => startRemix(world);
      actions.append(play, heart, share, remix);
    } else {
      actions.appendChild(play);
    }
    if (onRemove) {
      const remove = document.createElement("button");
      remove.className = "delete-btn";
      remove.setAttribute("aria-label", `Remove ${world.name} from this list`);
      remove.onclick = onRemove;
      actions.appendChild(remove);
    }
    card.append(info, actions);
    return card;
  };

  const emptyNote = (text) => {
    const empty = document.createElement("div");
    empty.className = "world-empty";
    empty.textContent = text;
    return empty;
  };

  const renderCommunity = () => {
    renderStatus();
    const list = $("communityList");
    list.innerHTML = "";
    renderBanner();
    $("listTrendingBtn").classList.toggle("active", listMode === "trending");
    $("listNewBtn").classList.toggle("active", listMode === "new");
    $("communityLists").hidden = Boolean(searchHits);
    const base = listMode === "trending" ? trending.worlds : community;
    if (!searchHits && listMode === "trending" && trending.status !== "ok") {
      if (trending.status === "error") {
        const note = emptyNote("Couldn't load Trending.");
        const retry = document.createElement("button");
        retry.id = "trendingRetryBtn";
        retry.className = "btn btn-small";
        retry.textContent = "Try again";
        retry.onclick = loadTrending;
        note.appendChild(document.createElement("br"));
        note.appendChild(retry);
        list.appendChild(note);
      } else list.appendChild(emptyNote("Loading worlds…"));
      return;
    }
    if (linkedWorld && !searchHits) {
      list.appendChild(worldCard(linkedWorld, { linked: true }));
      hydrate([linkedWorld]);
    }
    const shown = searchHits || base.filter((w) => !linkedWorld || w.id !== linkedWorld.id);
    if (!shown.length && !(linkedWorld && !searchHits)) {
      list.appendChild(
        emptyNote(
          searchHits
            ? searchState === "searching"
              ? "Searching…"
              : `No worlds match "${worldSearch.value.trim()}".`
            : listMode === "trending"
              ? "No world has been played lately. Look in New!"
              : "No worlds yet. Make the first one in Create!",
        ),
      );
      return;
    }
    shown.forEach((world) => list.appendChild(worldCard(world, { fresh: freshIds.has(world.id) })));
    if (searchHits) hydrate(shown);
  };

  const renderBanner = () => {
    const banner = $("featuredBanner");
    banner.hidden = !featuredWorld;
    if (!featuredWorld) return;
    $("featuredText").textContent =
      `★ World of the week: ${featuredWorld.name} by ${featuredWorld.author.name}`;
    const world = featuredWorld;
    $("featuredPlayBtn").onclick = () => startCustom(world);
  };
  document.querySelectorAll("#communityLists .seg-btn").forEach((button) => {
    button.onclick = () => {
      listMode = button.dataset.list;
      renderCommunity();
    };
  });

  const myWorlds = () => {
    const user = auth.currentUser;
    const shared = user ? community.filter((w) => w.author.uid === user.uid) : [];
    return mergeWorlds(shared, worlds.list());
  };

  const renderWorlds = (freshId) => {
    const list = $("worldList");
    list.innerHTML = "";
    const mine = myWorlds();
    if (!mine.length) {
      list.appendChild(emptyNote("Worlds you create show up here."));
      return;
    }
    mine.forEach((world) =>
      list.appendChild(
        worldCard(world, {
          fresh: world.id === freshId,
          onRemove: () => {
            worlds.remove(world.id);
            renderWorlds();
          },
        }),
      ),
    );
    showWeekNotes(mine);
    hydrate(mine);
  };

  /** "120 plays · 37 beat the boss · 15 ❤ this week" under each of the player's published worlds. */
  let weekRun = 0;
  const showWeekNotes = async (mine) => {
    const run = ++weekRun;
    const ids = mine.map((w) => w.id).filter((id) => !isBuiltIn(id));
    if (!ids.length) return;
    try {
      const { perWorld } = await social.myWeek(ids);
      if (run !== weekRun) return;
      document.querySelectorAll("#worldList .world-week").forEach((el) => {
        const counts = perWorld[el.dataset.world];
        if (!counts) return;
        el.textContent = weekNote(counts);
        el.hidden = false;
      });
    } catch (error) {
      // no note this time
    }
  };

  // ------------------------------------------------------ links and the week

  /** A shared link (/w/<id> redirects to /?world=<id>): its world's card opens first in Community. */
  const openLinkedWorld = async (id) => {
    const rest = new URLSearchParams(location.search);
    rest.delete("world");
    const query = rest.toString();
    history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
    openCreator("community");
    try {
      const [found] = await worldsById([id]);
      track("world_link_open", { found: Boolean(found) });
      if (!found) return showToast("That world doesn't exist anymore.");
      linkedWorld = found;
      community = mergeWorlds(community, [found]);
      renderCommunity();
    } catch (error) {
      // offline: the list shows its own error state
      if (connection !== "live") {
        connection = "error";
        connectionError = friendlyError(error);
      }
      renderCommunity();
    }
  };

  const isoWeek = (ms) => {
    const day = new Date(ms);
    const thursday = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
    const first = Date.UTC(thursday.getUTCFullYear(), 0, 1);
    const week = Math.ceil(((thursday - first) / 86400000 + 1) / 7);
    return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  };

  /** Once a week, how the player's worlds did: after the first input, when they had plays. */
  const WEEK_KEY = "worlds_week_note";
  const weeklyNote = async () => {
    const week = isoWeek(Date.now());
    try {
      if (getData(WEEK_KEY) === week) return;
      await auth.ready();
      if (!auth.signedIn) return;
      const uid = auth.currentUser.uid;
      const ids = worlds
        .list()
        .filter((w) => w.author.uid === uid && !isBuiltIn(w.id))
        .map((w) => w.id);
      if (!ids.length) return;
      const { plays, finishes } = await social.myWeek(ids);
      if (!plays) return;
      setData(WEEK_KEY, week);
      showToast(`<b>🎉 Your worlds: ${plays} plays and ${finishes} boss wins this week</b>`, 6000);
    } catch (error) {
      // offline: try again next time the game opens
    }
  };
  const weeklyOnInput = () => {
    ["pointerdown", "keydown"].forEach((name) => window.removeEventListener(name, weeklyOnInput));
    weeklyNote();
  };
  ["pointerdown", "keydown"].forEach((name) => window.addEventListener(name, weeklyOnInput));

  // --------------------------------------------------------------- tabs

  const selectTab = (name) => {
    document.querySelectorAll("#createScreen .tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.tab === name);
      tab.setAttribute("aria-selected", tab.dataset.tab === name);
    });
    document.querySelectorAll("#createScreen .tab-panel").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
    if (name === "community") renderCommunity();
    if (name === "mine") renderWorlds();
  };
  document.querySelectorAll("#createScreen .tab").forEach((tab) => {
    tab.onclick = () => selectTab(tab.dataset.tab);
  });

  const openCreator = (tab = "community") => {
    setCreateStatus("");
    worldSearch.value = "";
    searchHits = null;
    renderAccount();
    watchCommunity();
    linkedWorld = null;
    selectTab(tab);
    show(createScreen, true);
    loadCommunity();
    loadTrending();
    loadFeatured();
  };
  $("createCloseBtn").onclick = () => show(createScreen, false);

  // --------------------------------------------------------------- create

  const createPrompt = $("createPrompt");
  const createBtn = $("createBtn");
  const createStatus = $("createStatus");
  const createSteps = $("createSteps");
  const setCreateStatus = (text) => (createStatus.textContent = text);
  const EXAMPLES = [
    "A haunted candy factory run by a gummy ghost king",
    "Frozen fortress with armoured beetles and an ice dragon, really hard",
    "Sunny coral reef with bubble crabs, easy for kids",
    "Volcano of lava pits and fire bats ruled by a magma titan",
    "Neon robot city with laser turrets",
  ];
  EXAMPLES.forEach((text) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = text;
    chip.onclick = () => (createPrompt.value = text);
    $("createExamples").appendChild(chip);
  });

  const STEPS = ["Designing", "Painting & composing", "Building 6 levels", "Sharing"];
  const setStep = (index) => {
    createSteps.hidden = false;
    createSteps.innerHTML = "";
    STEPS.forEach((label, i) => {
      const li = document.createElement("li");
      li.textContent = label;
      li.className = i < index ? "done" : i === index ? "doing" : "";
      createSteps.appendChild(li);
    });
  };
  const paint = () => new Promise((resolve) => setTimeout(resolve, 30));

  // while a world builds: the button spins, and the prompt and examples wait
  const busyCreate = (busy) => {
    setBusy(createBtn, busy);
    $("createBtnLabel").textContent = busy ? "Building your world…" : "Build my world";
    createPrompt.disabled = busy;
    $("createExamples")
      .querySelectorAll("button")
      .forEach((chip) => (chip.disabled = busy));
  };

  // a remix: the world the next build is based on (cleared when the description is emptied)
  let remixOf = null;
  createPrompt.addEventListener("input", () => {
    if (!createPrompt.value.trim()) remixOf = null;
  });
  const startRemix = (world) => {
    if (!isPremium()) return openPremium();
    requireLogin(() => {
      remixOf = world.id;
      createPrompt.value = `A remix of ${world.name}: ${world.tagline}`
        .replace(/:\s*$/, "")
        .slice(0, 400);
      selectTab("create");
      createPrompt.focus();
      track("world_remix", {});
    }, "worlds");
  };

  createBtn.onclick = () => {
    if (!isPremium()) return openPremium();
    requireVerified(async () => {
      const prompt = createPrompt.value.trim();
      if (prompt.length < 3) {
        setCreateStatus("Describe your world first.");
        return;
      }
      if (createBtn.disabled) return;
      busyCreate(true);
      $("createResult").innerHTML = "";
      setCreateStatus("");
      try {
        setStep(0);
        const { spec, source, error } = await requestSpec(prompt, (text) =>
          firestoreWorlds.design(text),
        );
        const made = newWorld(spec, auth.currentUser);
        const world = (remixOf && sanitizeWorld({ ...made, remixOf })) || made;

        setStep(1);
        await paint();
        setStep(2);
        await paint();
        // builds the art, music and all 6 levels (checks they are playable)
        createCustomSession(world);

        setStep(3);
        await paint();
        let shared = "";
        let saved = world;
        try {
          saved = await repo.publish(world, { thumb: publishThumb(previewImage(world)) });
          remixOf = null;
          shared = "Shared with everyone.";
          community = mergeWorlds(community, [saved]);
        } catch (publishError) {
          shared = `Saved on this device, not shared: ${friendlyError(publishError)}`;
        }
        worlds.add(saved);
        setStep(STEPS.length);
        const how =
          source === "ai"
            ? "Designed with AI."
            : `AI designer unavailable (${friendlyError({ message: error })}), designed offline.`;
        setCreateStatus(`"${world.name}" is ready. ${how} ${shared}`);
        $("createResult").appendChild(worldCard(saved, { fresh: true }));
      } catch (buildError) {
        setCreateStatus(`Couldn't build that world: ${friendlyError(buildError)}`);
        createSteps.hidden = true;
      } finally {
        busyCreate(false);
      }
    });
  };

  // ------------------------------------------------------ share and leaderboard

  $("shareBtn").onclick = async () => {
    const result = daily.result;
    if (!result) return;
    const text = shareText({
      seed: daily.seed,
      levels: daily.squares(),
      score: result.score,
      seconds: result.seconds,
      rank: result.rank,
      total: result.total,
      streak: daily.streakDays(),
    });
    const method = await shareRun(text);
    if (method === "failed") {
      setPanelDaily({ note: "Couldn't share. Try again." });
      return;
    }
    track("share", { method });
    if (method === "copy") setPanelDaily({ note: "Copied to clipboard" });
  };

  const board = {
    status: $("leaderboardStatus"),
    list: $("leaderboardList"),
    retry: $("leaderboardRetryBtn"),
    tab: "today",
    load: 0,
  };

  const boardRow = (entry, { me = false, pinned = false, endless: ranked = false } = {}) => {
    const row = document.createElement("li");
    row.className = `lb-row${ranked ? " endless" : ""}${me ? " me" : ""}${pinned ? " pinned" : ""}`;
    // names come from other players: text only, never HTML
    [
      ["lb-rank", typeof entry.rank === "number" ? `#${entry.rank}` : entry.rank],
      ["lb-avatar", ""],
      ["lb-name", entry.name],
      ...(ranked ? [["lb-level", `Lv ${entry.level}`]] : []),
      ["lb-score", String(entry.score)],
      ["lb-time", clock(entry.seconds)],
      ["lb-seen", ""],
    ].forEach(([cls, text]) => {
      const cell = document.createElement("span");
      cell.className = cls;
      cell.textContent = text;
      if (cls === "lb-avatar") cell.appendChild(avatarCanvas(null)); // the classic dino until profiles arrive
      row.appendChild(cell);
    });
    return row;
  };

  /** The tab's board: load() -> { rows, mine }, one function call (spec 4.4). */
  const boardSource = (tab) => {
    if (tab === "endless") return { load: () => endlessBoard.load() };
    const seed = dailySeed();
    return { load: () => leaderboard.load(seed) };
  };

  /** Dinos and last-online on the rows already showing: one read for the whole board, never blocking it. */
  const paintLooks = async (load, shown) => {
    const found = await loadProfiles([...new Set(shown.map((row) => row.uid))], {
      fetch: (list) => profiles.fetch(list),
      isCurrent: () => load === board.load,
    });
    if (!found) return;
    const looks = rowLooks(shown, found, dayNumber(Date.now()));
    looks.forEach((look, i) => {
      const { el } = shown[i];
      el.querySelector(".lb-avatar").replaceChildren(avatarCanvas(look.profile));
      el.querySelector(".lb-seen").textContent = look.seen;
    });
  };

  const loadLeaderboard = async () => {
    const load = ++board.load;
    const { tab } = board;
    const source = boardSource(tab);
    board.list.replaceChildren();
    board.retry.style.display = "none";
    board.status.textContent = "Loading leaderboard…";
    try {
      const { uid } = await auth.ensurePlayer();
      const view = boardView(await source.load(), uid);
      if (load !== board.load) return;
      board.status.textContent = view.status;
      if (!view.rows.length) return;
      const endlessTab = tab === "endless";
      const shown = view.rows.map(({ entry, me, pinned }) => ({
        uid: entry.uid,
        el: boardRow(entry, { me, pinned, endless: endlessTab }),
      }));
      shown.forEach(({ el }) => board.list.appendChild(el));
      // never blocks the board: a drawing that throws leaves the classic dinos, and a log line
      paintLooks(load, shown).catch((error) =>
        console.warn("Profiles failed:", error && error.name),
      );
    } catch (error) {
      if (load !== board.load) return;
      console.warn("Leaderboard failed:", friendlyError(error));
      board.status.textContent = BOARD_FAILED;
      board.retry.style.display = "inline-block";
    }
  };

  const selectBoard = (tab) => {
    board.tab = tab;
    document.querySelectorAll("#leaderboardTabs .tab").forEach((el) => {
      el.classList.toggle("active", el.dataset.board === tab);
      el.setAttribute("aria-selected", el.dataset.board === tab);
    });
    loadLeaderboard();
  };
  document.querySelectorAll("#leaderboardTabs .tab").forEach((el) => {
    el.onclick = () => selectBoard(el.dataset.board);
  });

  $("leaderboardsBtn").onclick = () => {
    track("leaderboard_open", {});
    show(leaderboardScreen, true);
    selectBoard("today");
  };
  board.retry.onclick = loadLeaderboard;
  $("leaderboardCloseBtn").onclick = () => {
    board.load += 1;
    show(leaderboardScreen, false);
  };

  // --------------------------------------------------------------- input

  const isPlaying = () => engine.started && !game.over && !paused;
  const isMenuOpen = () =>
    [
      helpScreen,
      infoScreen,
      portalScreen,
      shopScreen,
      $("achievementsScreen"),
      settingsScreen,
      premiumScreen,
      world1Screen,
      createScreen,
      loginScreen,
      verifyScreen,
      deleteScreen,
      leaderboardScreen,
    ].some(isVisible);

  const keyDownUp = (event) => {
    const { type, keyCode } = event;
    // typing in the creator / settings shouldn't move the dino
    if (event.target && /INPUT|TEXTAREA/.test(event.target.tagName)) return;
    if (type === "keydown") {
      if (keyCode === 27 || keyCode === 80) {
        if (isMenuOpen()) return;
        if (isPlaying()) pause();
        else if (
          paused &&
          !game.over &&
          isVisible(pauseScreen) &&
          resumeBtn.style.display !== "none"
        )
          resume();
        return;
      }
      if (keyCode === 13 && !isMenuOpen()) {
        if (isVisible(pauseScreen)) {
          (resumeBtn.style.display !== "none" ? resumeBtn : retryBtn).click();
          return;
        }
        if (isVisible(homeScreen)) {
          playBtn.click();
          return;
        }
      }
    }
    controller.keyDownUp(type, keyCode);
  };

  window.addEventListener("keydown", keyDownUp);
  window.addEventListener("keyup", keyDownUp);
  // a key released while the window is unfocused never sends keyup
  window.addEventListener("blur", () => controller.releaseAll());
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 150));

  const touch = (id, keyCode) => {
    const el = $(id);
    return new MouseInput(id, (e) => {
      el.classList.toggle("pressed", e === "keydown");
      controller.keyDownUp(e, keyCode);
    });
  };
  const leftMouse = touch("leftBtn", 37);
  const rightMouse = touch("rightBtn", 39);
  const upMouse = touch("jumpBtn", 32);
  const fireMouse = touch("fireBtn", 13);

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") cloud.flush();
    if (document.visibilityState === "visible") {
      if (!paused && !game.over) game.world.playThemeMusic();
    } else if (isPlaying()) {
      pause();
    } else {
      game.world.pauseThemeMusic();
    }
  });

  refreshHome();
  // progress already on the device may have earned something (no Firebase needed)
  checkAchievements();
  hatchNext(); // an egg that came due while the game was closed

  // a run that couldn't be sent goes out with the first input (Firebase stays unloaded until then)
  const flushOnInput = () => {
    ["pointerdown", "keydown"].forEach((name) => window.removeEventListener(name, flushOnInput));
    flushPending();
    reminders.refresh(); // loads Firebase Messaging only when reminders are already on
  };
  ["pointerdown", "keydown"].forEach((name) => window.addEventListener(name, flushOnInput));

  // analytics never delays the game: it loads after the first input, or 3 s from now
  track("app_open", appOpenParams({ get: getData, set: setData }));
  armAnalytics();

  // a reminder's link: count the open once, and keep ?from out of the address
  const arrivedBy = new URLSearchParams(location.search);
  if (arrivedBy.has("from")) {
    if (arrivedBy.get("from") === "reminder") track("reminder_open");
    arrivedBy.delete("from");
    const left = arrivedBy.toString();
    history.replaceState(null, "", location.pathname + (left ? `?${left}` : "") + location.hash);
  }

  // a shared world link opens last, when every screen's code is ready
  const linked = linkedWorldId(location);
  // ?account=delete opens the delete-account flow, after signing in when needed
  const deleteLink = new URLSearchParams(location.search).get("account") === "delete";
  // a link (a world, or the delete flow) wins over the first-open start
  if (linked) openLinkedWorld(linked);
  else if (!deleteLink) firstOpen();
  if (deleteLink) requireLogin(openDelete, "delete-account");
});
