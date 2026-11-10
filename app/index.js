import Game from "./game";
import Screen from "./screen";
import GameEngine from "./engine";
import Controller from "./controller";
import MouseInput from "./controller/mouse-input";
import { MAX_HEARTS, POWERUP_TICKS } from "./game/player";
import { loadIcons } from "./game/powerups";

import {
  uid,
  getData,
  setData,
  LEVELS,
  populateHelp,
  populateLinks,
  populatePortals,
  preLoadAndFetch,
} from "./util";
import { settings, vibrate } from "./util/settings";
import { isPremium, setPremium, readPremiumFromUrl, canToggleLocally } from "./util/premium";
import {
  FINISH,
  records,
  dailySeed,
  createDailySession,
  createEndlessSession,
  createCustomSession,
} from "./modes";
import { levelsFromSpec, requestSpec, worlds } from "./creator";
import { createCampaign, starsFor, targetTime, starCount, STAR } from "./campaign";

import areas from "./areas";

readPremiumFromUrl();
preLoadAndFetch();
populateLinks();
populateHelp();

const BUILD_WORLD_API = typeof WORLD_API_URL !== "undefined" ? WORLD_API_URL : "";

let loadingActive = false;
let controllerActive = false;
const isTouchesEnabled = "ontouchstart" in document.documentElement;

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

  clearInterval(loadInterval);
  toggleLoadingScreen(false);
  setProgressValue(0);
  sizeControls();

  const controller = new Controller();
  const icons = loadIcons();
  const campaign = createCampaign();
  const isCampaignLevel = (id) => !session && LEVELS.some((l) => l.id === id);
  let cameFrom = null; // the area the player just walked out of (portal)
  // dev mode (localhost or ?debug): every level open for testing, without
  // touching the saved progress; Settings has a switch to turn it off
  const devUnlock = () => canToggleLocally() && settings.get("devUnlockAll") !== false;
  const isOpen = (id) => devUnlock() || campaign.isUnlocked(id);

  // ------------------------------------------------------------- toast
  const toast = $("toast");
  let toastTimer = null;
  const showToast = (html) => {
    toast.innerHTML = html;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  };
  const clock = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

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
    const star = (bit, label) =>
      `<span class="toast-star${mask & bit ? " on" : ""}${added & bit ? " new" : ""}" title="${label}">★</span>`;
    showToast(
      `<b>${levelName(id)} complete</b>` +
        `<span class="toast-stars">${star(STAR.COINS, "All coins")}${star(STAR.ENEMIES, "All enemies")}${star(STAR.TIME, "Target time")}</span>` +
        `<span class="toast-time">${clock(seconds)} / ${clock(targetTime(area))}</span>`,
    );
    if (added) vibrate("powerup");
  };

  const levelName = (id) => {
    if (session) return session.label(id);
    const level = LEVELS.find((l) => l.id === id);
    return level ? level.name : `Area ${id}`;
  };

  const updateHighScore = () => {
    const best = getData("high_score");
    $("highScore").textContent = best ? `Best ${best}` : "";
  };

  // ------------------------------------------------------------------ results

  const showPanel = ({
    title,
    tone = "",
    score = "",
    best = "",
    resume,
    retryLabel,
    homeLabel = "Home",
  }) => {
    pauseTitle.textContent = title;
    pauseTitle.className = `panel-title ${tone}`;
    pauseScore.textContent = score;
    pauseBest.textContent = best;
    resumeBtn.style.display = resume ? "block" : "none";
    retryBtn.style.display = retryLabel ? "block" : "none";
    retryBtn.textContent = retryLabel || "Retry";
    homeBtn.textContent = homeLabel;
    show(pauseScreen, true);
  };

  const recordRun = (score) => {
    const saved = getData("high_score") || 0;
    if (!session && score > saved) setData("high_score", score);
    updateHighScore();
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

  // GAME
  const game = new Game((score) => {
    const best = recordRun(score);
    const current = areaId;
    const inSession = session;
    const level = LEVELS.find(({ id }) => id === current);
    retry = () => {
      if (!inSession) {
        if (level) loadWorld(level.id, level.left, level.top);
        else startStory();
      } else if (inSession.kind === "daily") startDaily();
      else if (inSession.kind === "endless") startEndless();
      else startCustom(inSession.world);
    };
    setTimeout(() => {
      showPanel({
        title: "Game Over",
        tone: "bad",
        score: `Score ${score} · ${levelName(current)}`,
        best,
        retryLabel: inSession && inSession.kind !== "custom" ? "Try again" : "Retry",
      });
    }, 1400);
  });

  const finishRun = () => {
    paused = true;
    toggleControllers(false);
    game.world.pauseThemeMusic();
    const score = game.world.score;
    const best = recordRun(score);
    const titles = { daily: "Daily complete!", custom: "World complete!" };
    const again = session ? session.kind : "story";
    const world = session && session.world;
    retry = () =>
      again === "daily" ? startDaily() : again === "custom" ? startCustom(world) : startStory();
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
    showPanel({
      title: titles[session.kind] || "Complete!",
      tone: "good",
      score: `Score ${score}`,
      best,
      retryLabel: "Play again",
    });
  };

  const setupWorld = () => {
    if (session) session.ensure(areaId);
    game.world.setup(areas[areaId]);
    // walking into a campaign level unlocks it in the level select
    // (dev mode opens every level for testing; only real progress is saved:
    // a level you walked into from one you had really reached)
    if (isCampaignLevel(areaId)) {
      const walkedIn = cameFrom != null && campaign.isUnlocked(cameFrom);
      if (campaign.isUnlocked(areaId) || walkedIn) campaign.reach(areaId);
    }
    cameFrom = null;
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
    screen = new Screen(document.querySelector("canvas"), areas[areaId].world);

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
      if (!controllerActive && !paused) toggleControllers(true);
    }

    if (!game.over && loaded && !paused) {
      if (controller.left.active) player.moveLeft();
      if (controller.right.active) player.moveRight();
      if (controller.up.active) {
        if (player.jump()) {
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
        areaId = portal.destinationArea;
        setupWorld();
        setupScreen();
        engine.resume();
      }
    }

    // Pause freezes the world too, not just input: otherwise a player paused
    // mid-jump keeps falling (and can die) behind the pause menu.
    if (!paused) {
      game.update();
    }

    // shell feedback for what happened this tick
    const { events } = game.world;
    while (events.length) vibrate(events.shift());
  };

  // ------------------------------------------------------------------ drawing

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

    ctx.save();
    ctx.globalAlpha = boss.alpha * (boss.flash > 0 && boss.flash % 2 === 0 ? 0.45 : 1);
    ctx.translate(feetX, feetY);
    ctx.rotate(boss.tilt);
    ctx.scale(boss.scaleX, boss.scaleY);
    ctx.drawImage(boss.animator.frameValue, -rect.width / 2, -rect.height, rect.width, rect.height);
    ctx.restore();
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

    drawPlayer(ctx, player, game.world.isPlayerDead);
    if (game.world.bossArea) drawGates(ctx);

    game.world.effects.draw(ctx);
    drawHud(ctx);

    screen.render();
  };

  resize();

  var engine = new GameEngine(1000 / 30, update, render);

  // ?debug exposes the game for manual testing from the console
  if (new URLSearchParams(window.location.search).has("debug")) {
    window.debugGame = {
      game,
      engine,
      controller,
      areas,
      loadWorld: (...args) => loadWorld(...args),
      startEndless: () => startEndless(),
      startDaily: () => startDaily(),
      campaign,
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
    game.world.playThemeMusic();

    if (!engine.started) engine.start();
  };

  const startStory = (level = LEVELS[0]) => {
    session = null;
    loadWorld(level.id, level.left, level.top);
  };

  const startDaily = () => {
    session = createDailySession();
    loadWorld(session.startId, session.left, session.top);
  };

  const startEndless = () => {
    session = createEndlessSession();
    loadWorld(session.startId, session.left, session.top);
  };

  const startCustom = (world) => {
    try {
      session = { ...createCustomSession(world, levelsFromSpec), world };
    } catch (error) {
      setCreateStatus(`Couldn't build that world: ${error.message}`);
      return;
    }
    show(createScreen, false);
    loadWorld(session.startId, session.left, session.top);
  };

  const pause = () => {
    if (!engine.started || game.over || paused) return;
    clearMouse();
    controller.releaseAll();
    paused = true;
    toggleControllers(false);
    game.world.pauseThemeMusic();
    retry = () => {
      if (!session) {
        const level = LEVELS.find(({ id }) => id === areaId);
        if (level) loadWorld(level.id, level.left, level.top);
        else startStory();
      } else if (session.kind === "daily") startDaily();
      else if (session.kind === "endless") startEndless();
      else startCustom(session.world);
    };
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
    clearMouse();
    controller.releaseAll();
    paused = true;
    game.over = true;
    game.world.stopThemeMusic();
    toggleControllers(false);
    show(pauseScreen, false);
    refreshHome();
    show(homeScreen, true);
  };

  // ------------------------------------------------------------------ home

  const premiumModes = { daily: startDaily, endless: startEndless, create: () => openCreator() };

  const refreshHome = () => {
    updateHighScore();
    const premium = isPremium();
    document.querySelectorAll(".mode-card.premium").forEach((card) => {
      card.classList.toggle("locked", !premium);
    });
    const today = records.best("daily", String(dailySeed()));
    $("dailyInfo").textContent = today ? `Today's best ${today.score}` : "5 new levels a day";
    const endless = records.read()["endless:best"];
    $("endlessInfo").textContent = endless ? `Best: level ${endless.level}` : "How far can you go?";
    const last = LEVELS.find((l) => l.id === campaign.last) || LEVELS[0];
    const stars = campaign.totalStars(LEVELS.map((l) => l.id));
    $("playInfo").textContent =
      last.id === LEVELS[0].id && !stars
        ? "Start your adventure"
        : `Continue · ${last.name} · ★ ${stars}/${LEVELS.length * 3}`;
  };

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
    show(portalScreen, true);
  };

  // Play continues from the last campaign level reached
  playBtn.onclick = () => startStory(LEVELS.find((l) => l.id === campaign.last) || LEVELS[0]);

  document.querySelectorAll(".mode-card").forEach((card) => {
    card.onclick = () => {
      const mode = card.dataset.mode;
      if (mode === "levels") return openLevels();
      if (!isPremium()) return openPremium();
      premiumModes[mode]();
    };
  });

  resumeBtn.onclick = resume;
  retryBtn.onclick = () => retry && retry();
  homeBtn.onclick = goHome;
  pauseBtn.onclick = pause;

  $("helpBtn").onclick = () => show(helpScreen, true);
  $("infoBtn").onclick = () => show(infoScreen, true);
  $("helpCloseBtn").onclick = () => show(helpScreen, false);
  $("infoCloseBtn").onclick = () => show(infoScreen, false);
  $("portalCloseBtn").onclick = () => show(portalScreen, false);

  // -------------------------------------------------------------- settings

  const setMusic = $("setMusic");
  const setSound = $("setSound");
  const setVibration = $("setVibration");
  const setControls = $("setControls");
  const setWorldApi = $("setWorldApi");
  const setPremiumDev = $("setPremiumDev");

  const refreshSettings = () => {
    setMusic.checked = !settings.musicMuted;
    setSound.checked = !settings.soundMuted;
    setVibration.checked = !!settings.get("vibration");
    $("vibrationRow").style.display = navigator.vibrate ? "flex" : "none";
    setControls.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.dataset.value === settings.get("controlSize"));
    });
    setWorldApi.value = settings.get("worldApiUrl") || "";
    const premium = isPremium();
    $("premiumStatus").textContent = premium ? "Active ★" : "Locked";
    $("premiumBtn").style.display = premium ? "none" : "inline-block";
    $("premiumDevRow").style.display = canToggleLocally() ? "flex" : "none";
    setPremiumDev.checked = premium;
    $("unlockDevRow").style.display = canToggleLocally() ? "flex" : "none";
    $("setUnlockDev").checked = devUnlock();
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
  setWorldApi.onchange = () => settings.set("worldApiUrl", setWorldApi.value.trim());
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
    ["high_score", "mode_records", "my_worlds"].forEach((key) => localStorage.removeItem(key));
    campaign.reset();
    resetArmed = false;
    btn.textContent = "Progress erased";
    refreshHome();
  };

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

  // --------------------------------------------------------------- creator

  const createPrompt = $("createPrompt");
  const createBtn = $("createBtn");
  const createStatus = $("createStatus");
  const setCreateStatus = (text) => (createStatus.textContent = text);
  const EXAMPLES = [
    "A spooky graveyard full of bats, 3 levels",
    "Easy sunny meadow for kids",
    "Frozen fortress with beetles, really hard",
    "Desert canyon full of spitters and spike traps",
    "A factory of armoured beetles, 4 levels",
  ];
  EXAMPLES.forEach((text) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = text;
    chip.onclick = () => (createPrompt.value = text);
    $("createExamples").appendChild(chip);
  });

  const THEME_NAMES = {
    grasslands: "Grasslands",
    iceland: "Iceland",
    desert: "Desert",
    graveyard: "Graveyard",
    factory: "Factory",
  };

  const renderWorlds = (freshId) => {
    const list = $("worldList");
    list.innerHTML = "";
    const saved = worlds.list();
    if (!saved.length) {
      const empty = document.createElement("div");
      empty.className = "world-empty";
      empty.textContent = "Worlds you create show up here.";
      list.appendChild(empty);
      return;
    }
    saved.forEach((world) => {
      const { spec } = world;
      const card = document.createElement("div");
      card.className = `world-card${world.id === freshId ? " fresh" : ""}`;
      const info = document.createElement("div");
      const name = document.createElement("div");
      name.className = "world-name";
      name.textContent = world.name;
      const meta = document.createElement("div");
      meta.className = "world-meta";
      meta.textContent = `${THEME_NAMES[spec.theme] || spec.theme} · ${spec.levels} level${
        spec.levels > 1 ? "s" : ""
      } · ${"★".repeat(spec.difficulty)} · ${spec.enemies.join(", ")}`;
      info.append(name, meta);
      if (spec.tagline) {
        const tagline = document.createElement("div");
        tagline.className = "world-tagline";
        tagline.textContent = spec.tagline;
        info.appendChild(tagline);
      }
      const best = records.best("custom", world.id);
      if (best) meta.textContent += ` · best ${best.score}`;
      const actions = document.createElement("div");
      actions.className = "world-actions";
      const play = document.createElement("button");
      play.className = "btn btn-small";
      play.textContent = "Play";
      play.onclick = () => startCustom(world);
      const remove = document.createElement("button");
      remove.className = "delete-btn";
      remove.setAttribute("aria-label", `Delete ${world.name}`);
      remove.onclick = () => {
        worlds.remove(world.id);
        renderWorlds();
      };
      actions.append(play, remove);
      card.append(info, actions);
      list.appendChild(card);
    });
  };

  const openCreator = () => {
    setCreateStatus("");
    renderWorlds();
    show(createScreen, true);
  };
  $("createCloseBtn").onclick = () => show(createScreen, false);

  createBtn.onclick = async () => {
    const prompt = createPrompt.value.trim();
    if (prompt.length < 3) {
      setCreateStatus("Describe your world first.");
      return;
    }
    createBtn.disabled = true;
    setCreateStatus("Designing your world…");
    const server = settings.get("worldApiUrl") || BUILD_WORLD_API;
    const { spec, source, error } = await requestSpec(prompt, server);
    const world = worlds.add(prompt, spec);
    createBtn.disabled = false;
    setCreateStatus(
      source === "ai"
        ? `Built "${world.name}" with AI.`
        : server
          ? `Server unavailable (${error}), built "${world.name}" offline.`
          : `Built "${world.name}". (Offline builder: add a server in Settings for AI.)`,
    );
    renderWorlds(world.id);
  };

  // --------------------------------------------------------------- input

  const isPlaying = () => engine.started && !game.over && !paused;
  const isMenuOpen = () =>
    [helpScreen, infoScreen, portalScreen, settingsScreen, premiumScreen, createScreen].some(
      isVisible,
    );

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
    if (document.visibilityState === "visible") {
      if (!paused && !game.over) game.world.playThemeMusic();
    } else if (isPlaying()) {
      pause();
    } else {
      game.world.pauseThemeMusic();
    }
  });

  refreshHome();
});
