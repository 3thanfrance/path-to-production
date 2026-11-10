# Path to Production

A single-page Canvas arcade game. Vite builds the HTML, CSS, and JavaScript into `dist/` for Lovable hosting. The game runs in the browser, with synthesized sound and a personal best saved locally.

Run `npm ci`, then `npm run dev` for local play. Use `npm test` to verify game rules and `npm run build` to create the production bundle.

Use arrow keys or WASD to steer, accelerate, and brake. On touchscreens, hold on the road to accelerate and drag sideways to steer or down to brake. Escape pauses the run.

The car color and placeholder booth branding are in `BRAND` in `engine.js`. The original placeholder octopus is drawn in `road.js`.

## Design references

- [JavaScript Racer](https://github.com/jakesgordon/javascript-racer) demonstrates perspective projection and depth-sorted roadside sprites. Its teaching sprites and music are separate from the code license.
- [Cyber Racer 3D Engine](https://github.com/git-hubratlee/cyber-racer-3d-engine) is a useful reference for five-lane Canvas geometry and touch steering.
- [Endless OutRun](https://github.com/urdwyrd/endless-outrun) documents how it budgets reaction time for procedural obstacles.

The art and renderer here were drawn for this game. The first approach pairs a readable blue guide markings with flanking trucks, then gives the player time to steer toward the marked toll lane. Reaching Production at 2,000 meters awards the rank and the road stays open for a personal best.
