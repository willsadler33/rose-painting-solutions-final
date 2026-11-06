# Owner dashboard — technical setup & maintenance

For the developer delivering the site. The owner's guide is in [OWNER-GUIDE.md](OWNER-GUIDE.md).

## Architecture

```
Browser ─┬─ /            public site (React, static, CDN)
         │                 └─ fetches /api/content once at startup (preloaded, CDN-cached)
         ├─ /admin/      owner dashboard (separate bundle, plain CSS — never loaded by visitors)
         └─ /api/*, /media/*  →  netlify/functions/api.mjs  →  server/app.mjs
                                        │
                                        └─ Netlify Blobs (durable, independent of deploys)
                                             LIVE WEBSITE (production deploy only)
                                               rps-content  draft, published, history/<ts>
                                               rps-auth     password hash, sessions/<id>, rl/<hash>
                                               rps-media    m/<id>/<rev>/{master,lg,md,thumb}
                                             TEST COPY (Deploy Previews, branch deploys, anything else)
                                               preview-rps-content, preview-rps-auth, preview-rps-media
```

### Production and Deploy Previews never share data

Netlify's site-wide Blobs stores (`getStore`) are shared by **every** deploy of the site: production, Deploy Previews and branch deploys. Left alone, testing a preview would edit, publish or delete the live website's photos, projects, settings and password.

So the function picks its stores per request (`netlify/functions/api.mjs` → `resolveDataEnv` in `server/stores.mjs`):

| Netlify deploy context | Data used | Stores |
|---|---|---|
| `production` | live website | `rps-content`, `rps-auth`, `rps-media` |
| `deploy-preview`, `branch-deploy`, `dev`, anything else, or no context | test copy | `preview-rps-*` |

- **Fail-safe:** only a request Netlify reports as running on the production deploy gets live data. `RPS_DATA_ENV=production` can't promote a preview; `RPS_DATA_ENV=preview` forces the test copy everywhere (useful if you ever need to freeze the live data).
- **A preview starts from the original website**, has its own password (first sign-in uses the preview's `ADMIN_INITIAL_PASSWORD`), and can only purge its own CDN cache tag (`preview-rps-content`).
- **All previews share one test copy.** That's fine for one developer; just don't expect a fresh copy per pull request.
- **Production stays on site-wide stores**, not `getDeployStore`, because deploy stores are removed with their deploy. Site-wide stores persist across every redeploy.
- **Check which data a deploy uses:** `GET /api/health` returns `"dataEnv": "production"` or `"preview"`, and the dashboard shows a yellow **Test copy** notice on previews.
- Proven by `server/tests/netlify-function.test.mjs`, which runs the real function with the real `@netlify/blobs` and `@netlify/functions` packages against Netlify's local Blobs server.

**Why this design (and not Cloudinary / R2):**

| Option | Verdict |
|---|---|
| **Netlify Blobs** (chosen) | Already part of the Netlify hosting the site uses. Durable, per-site, survives every redeploy, no extra account, keys or bill. Works directly from Netlify Functions. |
| Cloudinary | Great transformations, but a second vendor and account for the owner, and free-tier credit limits to watch. Not needed: images are optimised in the browser (below). |
| Cloudflare R2 | Cheap and S3-compatible, but needs an extra account, keys and signed-URL plumbing. Worth it only if the photo library grows into many GB. |
| Files in the repo / deploy folder | Rejected: every upload would need a commit and redeploy, and the deploy folder is read-only at runtime. |

**Image pipeline:**

- **Where it happens:** photos are decoded, resized and re-encoded **in the owner's browser** (`src/admin/images.js`), never on the server.
  - Every upload stays under ~4.5 MB (the private master is capped at 4.2 MB), safely below the 6 MB Netlify Functions request limit even if the body is base64-encoded, so signed direct uploads aren't needed.
  - No server image processing means no server image-processing abuse.
  - Re-encoding drops **all EXIF/GPS metadata**.
- **Sizes stored:**
  - `master`: ≤3200 px, private, for re-editing.
  - `lg`: ≤2000 px.
  - `md`: ≤1000 px.
  - `thumb`: ≤480 px.
- **Format:** WebP, falling back to JPEG where a browser can't encode WebP.
- **Edits** (crop, 90° rotation, brightness/contrast ±15%) are stored as settings and re-rendered from the master. That makes them non-destructive: each edit is a new **revision**, and the URLs are `/media/<id>/<rev>/<size>.webp`, so they're immutable and cached for a year.
- **Server checks:** the server validates every upload by its **actual bytes** (JPEG/WebP signatures and dimensions, not names or headers), plus per-size byte and pixel limits (`server/images.mjs`).

**Content model:**

- **One validated JSON document** (`src/content/schema.js`) holds business details, website text, services, categories, the photo library, the gallery order and before & after projects.
- **Every save runs `sanitizeDoc`:**
  - text is cleaned and length-limited;
  - ids, colours and focus values must match strict patterns;
  - links must be https only;
  - photos that shipped with the site must match exact path patterns;
  - uploads are referenced by id, never by URL.
- **Draft and published copies:**
  - The owner edits the **draft**.
  - **Publish** copies it to **published** and keeps the previous version in `history/` (the last 20; the first entry is always the original website).
  - **Publish** also removes photo files that no stored version references.

**Public site integration:**

- **What changed:** `src/content/load.js` fetches `/api/content` before the first render and fills the existing data modules (`data/site.js`, `text.js`, `services.js`, `portfolio.js`, `projects.js`). Components changed only where hard-coded wording became editable.
- **Fallback:** if the API is unreachable or takes over 2.5 s, the built-in content (today's site) is used.
- **Preview:** `/?preview` loads the draft, and only with an owner session.

## Requirements

- **Hosting:** Netlify. The site deploys anywhere static, but the dashboard and API are a Netlify Function using Netlify Blobs.
  - `vercel.json` remains for the static site only. On Vercel the dashboard would not work.
- **Node:** 20.19+ (Netlify uses Node 22, set in `netlify.toml`).
- **Packages:** `npm install` adds `@netlify/blobs` and `@netlify/functions`. Netlify installs them during the build.

## Environment variables (Netlify › Site configuration › Environment variables)

| Name | Required | Value |
|---|---|---|
| `SESSION_SECRET` | yes | 32+ random characters. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Changing it signs everyone out. |
| `ADMIN_INITIAL_PASSWORD` | yes, for first sign-in | 12+ characters, random. The owner must replace it at first sign-in; after that it stops working. |
| `ADMIN_PASSWORD_RESET` | no | `yes` lets `ADMIN_INITIAL_PASSWORD` work again (forgotten password). **Remove after use.** |
| `RPS_DATA_ENV` | no | Leave unset. `preview` forces every deploy onto the test copy. |
| `VITE_FORM_ENDPOINT` | as before | Contact form endpoint (public). Unrelated to the dashboard. |

Mark `SESSION_SECRET` and `ADMIN_INITIAL_PASSWORD` as **secret** in Netlify, and scope them to **Functions** only, not Builds. Never commit real values; `.env.example` lists the names only.

**Use different values per deploy context.** In Netlify, each variable can have a value per context ("Different value for each deploy context"). Give **Production** its own `SESSION_SECRET` and `ADMIN_INITIAL_PASSWORD`, and give **Deploy Previews** (and **Branch deploys**, if you use them) different ones. Then a preview cookie can never be valid on production, and the preview's initial password is useless on the live site. (The data is already separate; this keeps the secrets separate too.)

Without `SESSION_SECRET`, the dashboard stays switched off (it shows a friendly message), and the public site keeps working.

## Deploying

**Preview first.**

1. In Netlify, add the **Deploy Previews** values for `SESSION_SECRET` and `ADMIN_INITIAL_PASSWORD` (see above). Production values can wait.
2. Push the branch and open a pull request against `main`. Netlify builds a Deploy Preview: `npm run build` (Vite builds `index.html` and `admin/index.html` into `dist/`) plus `netlify/functions/api.mjs`.
3. Check it: `npm run smoke -- https://deploy-preview-<n>--<site>.netlify.app preview`. It's read-only; `/api/health` must say `"dataEnv":"preview"`.
4. Try the dashboard on the preview (yellow **Test copy** notice): sign in, upload, edit, publish, remove. Nothing reaches the live site.

**Then production.**

5. Add the **Production** values for both variables.
6. Merge the pull request. Netlify deploys production.
7. `npm run smoke -- https://<your-domain> production` (`"dataEnv":"production"`).
8. Open `https://<site>/admin/`, sign in with the production initial password, choose a password, then sign out. Hand over access (below).

**No deploys are needed for content changes.** The owner's publishing doesn't trigger builds, so it uses no build minutes or deploy credits.

## Local development

```bash
npm install
npm run build                  # builds dist/ (site + dashboard)
SESSION_SECRET=dev-only-secret-at-least-32-characters-long \
ADMIN_INITIAL_PASSWORD=dev-initial-password npm run serve   # http://localhost:8888, data in ./.data
npm test                       # backend tests + the real Netlify Function against Netlify's local Blobs server (no network, no real photos)
```

`npm run serve` runs the same API against a local folder instead of Blobs, and applies `public/_headers`, so the security headers match production. `.data/` is git-ignored.

## Expected monthly cost

What can create ongoing charges, and what's in place:

| Risk | Mitigation |
|---|---|
| Photo bandwidth (the largest cost) | Browser-made WebP in three sizes with `srcset`; public photo URLs are immutable and cached for a year at Netlify's edge (`durable`) and in browsers. |
| Function runs from visitors | `/api/content` and photos are served from the CDN cache; the function runs about once per edge location after each publish. Random query strings (`?x=1`) can't bypass the cache (`Netlify-Vary: query=v`). |
| Storage growth | Unused photo files are deleted on publish; history keeps 20 versions; expired sessions and old sign-in records are tidied on each sign-in. The preview test copy keeps whatever you upload while testing (small); delete it with `npx netlify blobs:delete preview-rps-media <key>` if needed. |
| Production deploys (15 credits each) | Owner edits never deploy. Only code changes merged to `main` do. Deploy Previews don't use production-deploy credits. |
| Running out of credits | On the Free plan Netlify pauses the site's usage rather than billing. On paid plans, check **Auto recharge** and usage alerts in the team's billing settings so extra credits aren't bought without you knowing. |
| Bots requesting missing URLs under `/api` or `/media` | Each one is a short function run (2 credits per 10,000 requests). Not cacheable; if it ever becomes noticeable, add a Netlify firewall/rate-limit rule. |


Netlify bills in credits: Free is 300 credits/month, Personal $9 for 1,000, Pro $20 for 3,000+. Bandwidth is 20 credits/GB, functions 10 credits/GB-hour, requests 2 credits per 10k, and production deploys 15 credits each ([netlify.com/pricing](https://netlify.com/pricing)).

Rough estimate for a local painting business (about 2,000 visits a month):

| Item | Credits |
|---|---|
| Bandwidth: ~2,000 × ~1.4 MB first load, with CDN and browser caching | ~55 |
| Requests | ~15 |
| Functions: owner editing plus CDN-cached content and photos | <5 |
| Deploys: only when you change code (not when the owner publishes) | 15 each |
| **Typical total** | **~75–120** |

That fits the **Free plan**. If traffic grows several-fold, Personal ($9/month) covers it. Photos use about 1–3 MB of Blob storage each (all sizes). Netlify lists Blobs as included on the Free plan; check the current limits on the pricing page if the library grows into many GB. No other subscriptions are involved.

## Backups & restore

- **Built-in history:** the last 20 published versions, plus the original site, can be restored from the dashboard (Account & security).
- **Bin:** projects and photos go to a bin before permanent deletion. A photo's files are deleted only once nothing (draft, published or history) refers to it any more.
- **Full backup:** export the Blobs stores periodically. With the Netlify CLI linked to the site:

  ```bash
  npx netlify blobs:list rps-content
  npx netlify blobs:get rps-content published > backup/published.json
  npx netlify blobs:get rps-content draft > backup/draft.json
  # photos: list rps-media and fetch each key (m/<id>/<rev>/<size>)
  ```

  Restore with `npx netlify blobs:set <store> <key> --input <file>`.

**Recovering an accidentally deleted photo:**

1. If it's in the bin, restore it from the dashboard.
2. If it was deleted for good but an earlier published version used it, bring that version back from the history. Its files are kept for as long as that history entry exists.
3. Otherwise, use your backups.

## Handing over owner access

1. Set a random `ADMIN_INITIAL_PASSWORD` in Netlify.
2. Give it to the owner **in person or by phone**, not in the same email as the site address.
3. The owner signs in and must choose their own password immediately. From then on only they know it; it's stored as a scrypt hash.
4. Clear `ADMIN_INITIAL_PASSWORD` from Netlify after handover. Set it again only together with `ADMIN_PASSWORD_RESET=yes` if they ever forget their password.
5. To end every session at once (for example on a lost phone), change `SESSION_SECRET`, or change the password from the dashboard.

## Security summary

- **Sign-in:** one owner account. Passwords are hashed with scrypt; the minimum is 10 characters, and common or repeated passwords are refused.
- **Sessions:**
  - The session id is random and stored server-side; the cookie is signed with HMAC.
  - The cookie is `__Host-`, `HttpOnly`, `Secure` and `SameSite=Strict`.
  - Sessions expire after 3 days idle or 14 days at most; logout deletes the session.
  - A password change ends every other session.
- **Brute force:** 5 failures per connection per 15 minutes triggers a 15-minute lock, plus a site-wide limit (40 per 15 minutes, which locks for 10 minutes).
  - That site-wide limit could be used to delay the owner's sign-in briefly; it can't be used to get in.
- **CSRF:** every change requires a per-session token header and a same-origin request.
- **Uploads:**
  - Only an owner session can upload.
  - Files are checked by content and capped in bytes and pixels.
  - Photos are served with `nosniff` and a sandbox CSP.
  - A live photo's files can't be overwritten.
- **Private photos:**
  - Photos not live on the published site, and every `master` original, are only served to the owner session.
  - Photos that were once live remain at their (unguessable, immutable) URLs in CDN caches.
- **Content and headers:**
  - All stored text is plain text; React escapes it, and links are https-only.
  - `/admin` and `/api` are `noindex` and disallowed in `robots.txt`.
  - The site-wide CSP applies to the dashboard too (no inline scripts).

## Maintaining

| What | Where |
|---|---|
| Editable fields | `src/content/schema.js` (validation), `src/content/seed.js` (defaults from the data files) |
| New editable text | Add to `src/data/text.js` with a limit in `TEXT_LIMITS`, use `text.yourKey` in the component, and list it in `src/admin/pages/Content.jsx` |
| API | `server/app.mjs`; tests in `server/tests/api.test.mjs` |
| Dashboard pages | `src/admin/pages/` |

Run `npm test` after any server change.
