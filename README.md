# Tank Flow Simulator for WordPress

Two pieces, for a private WordPress site:

- **`tank-flow-sim`**: a plugin with a 3D water-flow simulator for aquariums.
- **`tank-tools`**: a block theme around it (dark ocean header, "What do you keep?" cards).
  The layout is modelled on tanksense.app. All the text, images and code are new.

## What the simulator does

Set your tank's size and sand depth. Add powerheads, filter/return outlets, airstones, rock and boxes, then
point and size each one with sliders. Thousands of streaks follow the water: blue is moving, pale is fast, red is
slower than your "dead zone" limit. The panel shows:

- how much of the water is slower than that limit,
- the average and fast-area speeds,
- the tank's water volume and pump turnover.

You can also show the dead zones as red blocks, or switch to Front, Top, Side or 3D views. Click any piece in the
3D view to edit it.

Under the hood is a real incompressible fluid solver (stable-fluids on a staggered grid, about 12,000 cells). It
runs in a background thread. Jets keep their nozzle speed for about six nozzle-widths, then slow and spread like
real turbulent jets. Water pushed out has to come back, so you get return currents and suction behind pumps.
Rock and sand block the flow. It is a planning tool, not lab-grade CFD: trust the patterns more than the exact
numbers.

The default dead-zone limit is 5 cm/s for reef, 2 cm/s for freshwater and 3 cm/s for coldwater. You can change
it, and it is saved with each setup.

Setups save to your WordPress user account when you're logged in, so they follow you between computers.
Otherwise they save in the browser. Units switch between cm · L/h and in · US gal/h.

## Install (WP-CLI)

```
./build.sh
wp plugin install dist/tank-flow-sim.zip --activate      # also creates the /flow/ page
wp theme install dist/tank-tools.zip --activate
wp rewrite structure '/%postname%/' --hard
```

Then go to **Appearance → Tank Tools setup**, tick *Publish it and make it the site's front page*, and press
**Create the home page**.

The plugin also works on its own with any theme: put `[tank_flow_sim]` on a page. Use
`[tank_flow_sim kind="fresh"]` to start from a freshwater template, or `height="80vh"` to make the 3D view taller.

Everything is bundled, including three.js, so the site works with no internet access.

## Make it yours

| What | Where |
| --- | --- |
| Site name | Settings → General → Site Title |
| Logo (the wave icon until you set one) | Appearance → Editor → Patterns → Header → Logo |
| Big title and intro in the dark header | Edit the page: title = page title, intro = page **Excerpt** |
| Card pictures | Edit the Home page, click a picture → Replace |
| Colours and fonts | Appearance → Editor → Styles |

The theme also keeps some extra block patterns (tool cards with *Pro* / *Coming soon* badges, a maker's note, a
sign-up box) in the editor under **+ → Patterns → Tank Tools**, in case you want them later.
