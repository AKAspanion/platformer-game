export const uid = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

export const prefetch = () => {
  const items = {
    sprites: [
      { key: "world-1", objects: 11, tiles: 18 },
      { key: "world-2", objects: 10, tiles: 18 },
      { key: "world-3", objects: 15, tiles: 16 },
      { key: "world-4", objects: 14, tiles: 16 },
      { key: "world-5", objects: 12, tiles: 25 },
    ],
  };

  const body = document.getElementsByTagName("body")[0];

  const append = (href) => {
    const item = document.createElement("link");
    item.rel = "prefetch";
    item.href = href;
    body.appendChild(item);
  };

  items.sprites.forEach(({ key, objects, tiles }) => {
    for (let index = 1; index <= objects; index++) {
      append(`./assets/sprites/${key}/objects/${index}.png`);
    }
    for (let index = 1; index <= tiles; index++) {
      append(`./assets/sprites/${key}/tiles/${index}.png`);
    }

    append(`./assets/sprites/${key}/bg.png`);
  });

  const audioFiles = [
    { file: "coin", ext: "wav" },
    { file: "desert" },
    { file: "dungeon" },
    { file: "fall" },
    { file: "grasslands" },
    { file: "iceland" },
  ];

  audioFiles.forEach(({ file, ext = "mp3" }) => {
    append(`./assets/audio/${file}.${ext}`);
  });
};
