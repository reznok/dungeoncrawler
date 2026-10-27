# The Rising

A roguelike for your phone. Play it at **https://reznok.github.io/dungeoncrawler/**.

Tap to walk, swipe to step, hold to look. Your game saves itself after every move.

> `docs/SPOILERS-design.md` contains spoilers. Do not open it if you want to be surprised.

## Development

```bash
npm install
npm run dev      # local server
npm test         # logic tests, including a bot that plays the game
npm run build    # production build into dist/
```

The tile atlas (`public/atlas.png`, `src/generated/atlas.json`) is generated from the Dungeon Crawl Stone Soup
`rltiles` folder: `node tools/build-atlas.mjs <path to crawl-ref/source/rltiles>`. Re-run it after adding new tile
references in `src/`.

## Credits

Tiles: [Dungeon Crawl Stone Soup](https://github.com/crawl/crawl) tile set (CC0 / public domain RLTiles).
Fonts: Pixelify Sans and Alegreya Sans (Google Fonts, OFL).
