export const uid = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
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

  const append = (href, rel) => {
    const item = document.createElement("link");
    item.as = "image";
    item.href = href;
    item.rel = rel;
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
      append(`./assets/sprites/player/left/${key} (${index}).png`, rel);
      append(`./assets/sprites/player/right/${key} (${index}).png`, rel);
    }
  });

  items.water.forEach(({ rel, key, objects }) => {
    for (let index = 1; index <= objects; index++) {
      append(`./assets/sprites/water/image ${index}.png`, rel);
      append(`./assets/sprites/water/image ${index}.png`, rel);
    }
  });

  const audioFiles = [
    { rel: "prefetch", file: "coin", ext: "wav" },
    { rel: "prefetch", file: "desert" },
    { rel: "prefetch", file: "dungeon" },
    { rel: "prefetch", file: "fall" },
    { rel: "prefetch", file: "grasslands" },
    { rel: "prefetch", file: "iceland" },
  ];

  // audioFiles.forEach(({ rel, file, ext = "mp3" }) => {
  //   append(`./assets/audio/${file}.${ext}`, rel);
  // });
};
