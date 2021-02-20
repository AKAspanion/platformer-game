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

  const audioFiles = [
    { rel: "preload", file: "grasslands" },
    { rel: "preload", file: "coin", ext: "wav" },
    { rel: "preload", file: "jump", ext: "wav" },
    { rel: "preload", file: "fall", ext: "mp3" },
    { rel: "preload", file: "iceland" },
    { rel: "preload", file: "desert" },
    { rel: "preload", file: "dungeon" },
  ];

  audioFiles.forEach(({ rel, file, ext = "mp3" }) => {
    if (rel === "preload") {
      const audio = new Audio();
      audio.url = `./assets/audio/${file}.${ext}`;
    } else {
      append(`./assets/audio/${file}.${ext}`, rel, "audio");
    }
  });
};
