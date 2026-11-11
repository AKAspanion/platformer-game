export const uid = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const setData = (key, value) => {
  return localStorage.setItem(key, JSON.stringify(value));
};

export const getData = (key) => {
  return JSON.parse(localStorage.getItem(key));
};

export const preLoadAndFetch = () => {
  const items = {
    sprites: [
      { rel: "prefetch", key: "world-1", objects: 11, tiles: 18 },
      { rel: "prefetch", key: "world-2", objects: 10, tiles: 18 },
      { rel: "prefetch", key: "world-3", objects: 15, tiles: 16 },
      { rel: "prefetch", key: "world-4", objects: 14, tiles: 16 },
      { rel: "prefetch", key: "world-5", objects: 12, tiles: 25 },
    ],
    player: [
      { rel: "prefetch", key: "Dead", objects: 8 },
      { rel: "prefetch", key: "Idle", objects: 10 },
      { rel: "prefetch", key: "Jump", objects: 8 },
      { rel: "prefetch", key: "Run", objects: 8 },
    ],
    water: [{ rel: "prefetch", objects: 17 }],
    coin: [{ rel: "prefetch", objects: 16 }],
  };

  const body = document.getElementsByTagName("head")[0];

  const append = (href, rel, as = "image") => {
    const item = document.createElement("link");

    item.as = as;
    item.rel = rel;
    item.href = href;
    body.prepend(item);
  };

  items.sprites.forEach(({ rel, key, objects, tiles }) => {
    for (let index = 1; index <= objects; index++) {
      append(`./assets/sprites/${key}/objects/${index}.png`, rel);
    }
    for (let index = 1; index <= tiles; index++) {
      append(`./assets/sprites/${key}/tiles/${index}.png`, rel);
    }

    append(`./assets/sprites/${key}/bg.png`, rel);
  });

  items.player.forEach(({ rel, key, objects }) => {
    for (let index = 1; index <= objects; index++) {
      append(`./assets/sprites/player/left/${key} (${index}).webp`, rel);
      append(`./assets/sprites/player/right/${key} (${index}).webp`, rel);
    }
  });

  items.water.forEach(({ rel, objects }) => {
    for (let index = 1; index <= objects; index++) {
      append(`./assets/sprites/water/image ${index}.webp`, rel);
    }
  });

  items.coin.forEach(({ rel, objects }) => {
    for (let index = 1; index <= objects; index++) {
      append(`./assets/sprites/coin/image ${index}.webp`, rel);
    }
  });
};

// Campaign levels in play order: 5 worlds x 6 levels, level 6 is the boss.
// `areaNum` is the position in the campaign; `ss` the level-select thumbnail.
export const WORLDS = ["Grasslands", "Iceland", "Desert", "Graveyard", "Factory"];
export const LEVELS = [
  { name: "Grassland 1", id: 1, world: "Grasslands", left: 40, top: 100 },
  { name: "Grassland 2", id: 2, world: "Grasslands", left: 40, top: 100 },
  { name: "Grassland 3", id: 7, world: "Grasslands", left: 40, top: 120 },
  { name: "Grassland 4", id: 9, world: "Grasslands", left: 40, top: 124 },
  { name: "Grassland 5", id: 10, world: "Grasslands", left: 40, top: 124 },
  { name: "Grassland 6", id: 25, world: "Grasslands", left: 40, top: 124, boss: true },
  { name: "Iceland 1", id: 3, world: "Iceland", left: 48, top: 100 },
  { name: "Iceland 2", id: 8, world: "Iceland", left: 32, top: 20 },
  { name: "Iceland 3", id: 11, world: "Iceland", left: 40, top: 124 },
  { name: "Iceland 4", id: 12, world: "Iceland", left: 40, top: 140 },
  { name: "Iceland 5", id: 26, world: "Iceland", left: 40, top: 124 },
  { name: "Iceland 6", id: 27, world: "Iceland", left: 40, top: 124, boss: true },
  { name: "Desert 1", id: 13, world: "Desert", left: 40, top: 124 },
  { name: "Desert 2", id: 14, world: "Desert", left: 40, top: 124 },
  { name: "Desert 3", id: 15, world: "Desert", left: 40, top: 140 },
  { name: "Desert 4", id: 16, world: "Desert", left: 40, top: 124 },
  { name: "Desert 5", id: 28, world: "Desert", left: 40, top: 124 },
  { name: "Desert 6", id: 29, world: "Desert", left: 40, top: 124, boss: true },
  { name: "Graveyard 1", id: 17, world: "Graveyard", left: 40, top: 124 },
  { name: "Graveyard 2", id: 18, world: "Graveyard", left: 40, top: 124 },
  { name: "Graveyard 3", id: 19, world: "Graveyard", left: 40, top: 124 },
  { name: "Graveyard 4", id: 20, world: "Graveyard", left: 40, top: 124 },
  { name: "Graveyard 5", id: 30, world: "Graveyard", left: 40, top: 124 },
  { name: "Graveyard 6", id: 31, world: "Graveyard", left: 40, top: 124, boss: true },
  { name: "Factory 1", id: 21, world: "Factory", left: 40, top: 124 },
  { name: "Factory 2", id: 22, world: "Factory", left: 40, top: 124 },
  { name: "Factory 3", id: 23, world: "Factory", left: 40, top: 124 },
  { name: "Factory 4", id: 24, world: "Factory", left: 40, top: 124 },
  { name: "Factory 5", id: 32, world: "Factory", left: 40, top: 124 },
  { name: "Factory 6", id: 33, world: "Factory", left: 40, top: 124, boss: true },
].map((level, index) => ({
  ...level,
  areaNum: index + 1,
  ss: `images/levels/area-${level.id}.webp`,
}));

export const getAreaNumber = (areaId) => {
  const level = LEVELS.find(({ id }) => id === areaId);
  return level ? level.areaNum : 1;
};

/**
 * Level select, grouped by world. `progress` tells which levels are unlocked
 * and their stars: { isUnlocked(id), stars(id) -> 0..3, details(id) } where
 * details is { mask, coins, enemies, boss, target, best } (see app/campaign).
 * Called each time the screen opens so it shows current progress.
 */
export const populatePortals = (onPortalClick, progress) => {
  const portalsWrapper = document.getElementById("portalsWrapper");
  portalsWrapper.className = "modal-content-wrapper";
  portalsWrapper.innerHTML = "";

  WORLDS.forEach((world) => {
    const levels = LEVELS.filter((l) => l.world === world);
    const earned = levels.reduce((sum, l) => sum + progress.stars(l.id), 0);

    const section = document.createElement("div");
    section.className = "world-section";
    const head = document.createElement("div");
    head.className = "world-head";
    const title = document.createElement("span");
    title.textContent = world;
    const total = document.createElement("span");
    total.className = "world-stars";
    total.textContent = `★ ${earned}/${levels.length * 3}`;
    head.append(title, total);

    const grid = document.createElement("div");
    grid.className = "portal-item-wrapper";

    levels.forEach((level) => {
      const unlocked = progress.isUnlocked(level.id);
      const tile = document.createElement("button");
      tile.className = `portal-item${unlocked ? "" : " locked"}${level.boss ? " boss" : ""}`;
      tile.disabled = !unlocked;
      tile.setAttribute("aria-label", unlocked ? level.name : `${level.name} (locked)`);

      const picture = document.createElement("div");
      picture.className = "portal-picture";
      const img = document.createElement("img");
      img.src = level.ss;
      img.alt = "";
      img.className = "portal-img";
      picture.appendChild(img);
      if (level.boss) {
        const tag = document.createElement("span");
        tag.className = "portal-tag";
        tag.textContent = "Boss";
        picture.appendChild(tag);
      }

      const info = document.createElement("div");
      info.className = "portal-info";
      const name = document.createElement("div");
      name.className = "portal-name";
      name.textContent = level.name;
      info.appendChild(name);

      if (unlocked) {
        const d = progress.details(level.id);
        const stats = document.createElement("div");
        stats.className = "portal-stats";
        // one chip per star: what it asks for, gold once earned
        [
          [1, `${d.coins} coins`, "Collect every coin"],
          [2, d.boss ? "Boss" : `${d.enemies} foes`, "Defeat every enemy"],
          [4, d.target, "Finish under the target time"],
        ].forEach(([bit, text, title]) => {
          const chip = document.createElement("span");
          chip.className = d.mask & bit ? "stat on" : "stat";
          chip.title = title;
          const star = document.createElement("b");
          star.textContent = "★";
          chip.append(star, document.createTextNode(text));
          stats.appendChild(chip);
        });
        info.appendChild(stats);
        const best = document.createElement("div");
        best.className = "portal-best";
        best.textContent = d.best ? `Best ${d.best}` : "Not finished yet";
        info.appendChild(best);
        tile.addEventListener("click", () => onPortalClick(level));
      } else {
        const lock = document.createElement("div");
        lock.className = "portal-lock";
        picture.appendChild(lock);
        const hint = document.createElement("div");
        hint.className = "portal-best";
        hint.textContent = "Reach it to unlock";
        info.appendChild(hint);
      }

      tile.append(picture, info);
      grid.appendChild(tile);
    });

    section.append(head, grid);
    portalsWrapper.appendChild(section);
  });
};

export const populateLinks = () => {
  const links = [
    {
      className: "btn gh-btn social-btn btn-tut",
      style: "margin-left: 0px",
      link: "https://github.com/AKAspanion",
    },
    {
      className: "btn li-btn social-btn btn-tut",
      style: "",
      link: "https://www.linkedin.com/in/spanion/",
    },
    {
      className: "btn in-btn social-btn btn-tut",
      style: "",
      link: "https://www.instagram.com/spanionkumar/",
    },
    {
      className: "btn fb-btn social-btn btn-tut",
      style: "",
      link: "https://www.facebook.com/AKAspanion/",
    },
  ];

  const linksWrapper = document.getElementById("linksWrapper");
  linksWrapper.className += "flex-item";

  links.forEach(({ link, style, className }) => {
    const a = document.createElement("a");
    a.className += className;
    a.target = "_blank";
    a.style = style;
    a.href = link;

    linksWrapper.appendChild(a);
  });
};

export const populateHelp = () => {
  const helpItems = [
    {
      name: "Mobile",
      content: [
        {
          items: [
            { className: "btn left-btn btn-tut", text: "to run left" },
            { className: "btn right-btn btn-tut", text: "to run right", notap: true },
          ],
        },
        {
          items: [{ className: "btn fire-btn btn-tut flex-item", text: "to spit fire", dot: true }],
        },
        {
          items: [{ className: "btn jump-btn btn-tut", text: "to jump" }],
        },
      ],
    },
    {
      name: "Desktop",
      content: [
        {
          items: [
            { className: "btn left-key-btn btn-tut key-btn", text: "to run left" },
            { className: "btn right-key-btn btn-tut key-btn", text: "to run right", notap: true },
          ],
        },
        {
          items: [
            { className: "btn fire-key-btn btn-tut flex-item key-btn", text: "to spit fire" },
          ],
        },
        {
          items: [{ className: "btn jump-key-btn btn-tut key-btn", text: "to jump" }],
        },
      ],
    },
  ];

  const helpWrapper = document.getElementById("helpWrapper");
  helpWrapper.className += "modal-content-wrapper";

  // Hearts and power-ups
  const tips = [
    [
      "items/hud-heart.png",
      "3 hearts: a hit costs one. Falling in a pit sends you back to safe ground.",
    ],
    ["items/heart.png", "Heart: +1 heart"],
    ["items/shield.png", "Shield: blocks the next hit"],
    ["items/triple.png", "Triple fire: three fireballs per shot for 15s"],
    ["items/wings.png", "Wings: double jump for 20s"],
    ["enemies/beetle/right/image_part_01.png", "Beetles are armoured: two fireballs"],
    ["enemies/pig/attack/right/image_part_02.png", "A flashing enemy is about to lunge!"],
  ];
  const tipsSection = document.createElement("div");
  tipsSection.className = "flex-item modal-content";
  const tipsHead = document.createElement("div");
  tipsHead.className = "modal-content-head";
  tipsHead.textContent = "Tips";
  const tipsList = document.createElement("div");
  tipsList.className = "flex-item modal-content-desc";
  tips.forEach(([icon, text]) => {
    const row = document.createElement("div");
    row.className = "flex-item help-item";
    const img = document.createElement("img");
    img.src = `./assets/sprites/${icon}`;
    img.alt = "";
    row.appendChild(img);
    row.appendChild(document.createTextNode(text));
    tipsList.appendChild(row);
  });
  tipsSection.append(tipsHead, tipsList);

  helpItems.forEach(({ name, content }) => {
    const modalContent = document.createElement("div");
    modalContent.className += "flex-item modal-content";

    const modalhead = document.createElement("div");
    modalhead.className += "modal-content-head";
    modalhead.textContent = name;

    const modalContentDesc = document.createElement("div");
    modalContentDesc.className += "flex-item modal-content-desc";

    content.forEach(({ items }) => {
      const flexItem = document.createElement("div");
      flexItem.className += "flex-item";

      items.forEach(({ className, text, dot, notap }) => {
        if (!notap) {
          flexItem.innerHTML += "Tap";
        }

        const btn = document.createElement("div");
        btn.className = className;

        if (dot) {
          const fire = document.createElement("span");
          fire.className = "fire-dot";
          btn.appendChild(fire);
        }

        flexItem.appendChild(btn);

        flexItem.innerHTML += text;
      });

      modalContentDesc.appendChild(flexItem);
    });

    modalContent.appendChild(modalhead);
    modalContent.appendChild(modalContentDesc);

    helpWrapper.appendChild(modalContent);
  });

  helpWrapper.appendChild(tipsSection);
};
