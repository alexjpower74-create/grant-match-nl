# Deploying Grant Match NL (NOT done — waiting on Alexander's review)

Nothing here has been run. Everything on 2026-09-14 ran locally with `wrangler dev --local`. These are the steps for
when Alexander says "deploy". Read `DECISIONS.md` #12 (quoting official pages on a commercial site) first.

## 1. What it needs

| Thing | Name | Notes |
|---|---|---|
| Data bundle | `data/build/programs.json` | `npm run build:data` (fails if any quote is not on its saved page). The Worker imports it, so rebuild before every deploy. |
| D1 database | `grant-match-nl` | `wrangler d1 create grant-match-nl`, then put the printed id into `worker/wrangler.toml` (`database_id`, currently `LOCAL-ONLY-set-at-deploy`). Holds live-check runs only, never profiles. |
| Migrations | `worker/migrations/` | `wrangler d1 migrations apply grant-match-nl --remote`. Deploy does not migrate. |
| Worker | `grant-match-nl` | `cd worker && wrangler deploy`. |
| Secret | `ADMIN_TOKEN` | `wrangler secret put ADMIN_TOKEN`, a long random string. Guards `/api/admin/checks` and `/api/admin/scan`. |
| Vars | `DATA_SET = "real"`, `ALLOW_NOW = "0"`, `SOURCE_ORIGIN_MAP = ""` | Already the defaults in `wrangler.toml`. `ALLOW_NOW` must stay `0` in production. |
| Cron | `15 10 * * 1` | Already in `wrangler.toml`: Mondays 07:45 NDT, re-checks every source page politely. |
| App | static files in `app/` | Cloudflare Pages or a static-assets Worker. Set `<meta name="api-base">` to the Worker URL. Mock mode needs `core/` and `data/build/` next to it; production doesn't. |
| Domain | none yet | e.g. `grants.apcosoftwaretools.ca` (DNS already on Cloudflare). |

## 2. Order
1. `npm run build:data`.
2. `wrangler d1 create grant-match-nl` → paste the id into `worker/wrangler.toml`.
3. `wrangler d1 migrations apply grant-match-nl --remote`.
4. `wrangler secret put ADMIN_TOKEN`.
5. `wrangler deploy` (from `worker/`).
6. Point `api-base` at the Worker URL, deploy the app.
7. First live check: `curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://<worker>/api/admin/scan`, then open the
   app, fill the profile, and check results, one program page, the printout and the About page.

## 3. Keeping the programs true
- Program facts change only when someone re-researches a program (`PLAN.md`, "How to research a program") and
  `npm run check:data` passes. The cron doesn't rewrite programs; it flags a page whose quotes disappeared
  ("The page has changed since we checked it") and stops that program showing "Looks like a fit".
- Anything verified more than 60 days ago is flagged on screen. Plan a re-research pass every two months.
