# Path to Production

A single-page Canvas arcade game. Vite builds the HTML, CSS, and JavaScript into `dist/` for Lovable hosting. The game runs in the browser, with synthesized sound and a personal best saved locally.

Run `npm ci`, then `npm run dev` for local play. Use `npm test` to verify game rules and `npm run build` to create the production bundle.

Use arrow keys or WASD to steer, accelerate, and brake. Press P or tap the brilliance counter to buy a pass. On touchscreens, hold on the road to accelerate and swipe to steer. Escape pauses the run.

The car color and placeholder booth branding are in `BRAND` in `engine.js`. The placeholder octagon is drawn in `game.js`.
