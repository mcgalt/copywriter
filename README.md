# Tank Tools: WordPress block theme

A WordPress block theme modelled on the layout of tanksense.app: a dark ocean header, "What do you keep?" photo cards,
per-kind pages with a grid of tool cards (with **Pro** and **Coming soon** badges), a sign-up box and a personal
"Who's behind this?" note. All the text and images are new: no copy, logos, photos or code from the original site.

## Install

1. Download `dist/tank-tools.zip` from this repository.
2. In WordPress: **Appearance → Themes → Add New → Upload Theme**, choose the zip, then **Activate**.
   Activating a theme changes how your whole site looks, so try it on a staging copy first if your site is live.
3. Go to **Appearance → Tank Tools setup** and press **Create starter pages**. This makes four pages
   (Home, Marine, Freshwater, Coldwater) as drafts. Tick the box to publish them and make Home the front page.
4. Set **Settings → Permalinks** to *Post name* so `/marine/`, `/freshwater/` and `/coldwater/` work.

## Make it yours

| What | Where |
| --- | --- |
| Site name in the header and footer | Settings → General → Site Title |
| Logo (the wave icon until you set one) | Appearance → Editor → Patterns → Header → Logo |
| Big title and intro in the dark header | Edit the page: the title is the page title, the intro is the page **Excerpt** (sidebar) |
| Green / orange colour for a page | Page sidebar → Template → *Freshwater page (green)* or *Coldwater page (orange)* |
| Cards, text, pictures, links | Edit the page. Click any picture → Replace to use your own photos/screenshots |
| "Who's behind this?" note | Appearance → Editor → Patterns, or edit it on a page. It has `[your name]` placeholders |
| Colours and fonts site-wide | Appearance → Editor → Styles |
| Add more cards | In the editor, + → Patterns → **Tank Tools**: *Tool card*, *Tool card with Pro badge*, *Tool card: coming soon* |

Dark mode follows each visitor's device setting automatically.

## The tools themselves

The tool cards link to `/tools/flow/`, `/tools/tests/`, `/tools/light/`, `/tools/health/`, `/tools/calendar/` and
`/tools/photos/`. Those pages don't exist yet: on tanksense.app each one is a separate web app (3D flow simulation,
test logging, light maths, accounts and payments). Each one is its own project. A good order is to start with the
simpler tools (Water Tests, Calendar) as small WordPress plugins and work up to the 3D Flow Planner.

## Develop

```
./build.sh          # writes dist/tank-tools.zip
```
