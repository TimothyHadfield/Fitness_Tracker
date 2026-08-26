# Pulling data in from other apps — research

**Written 2026-08-26 on Tim's ask:** *"I'm curious what other fitness/calorie tracking apps my
website could pull data off of if we turned it into an app (or if we can do it now and leave it as
a website). I'm thinking Strava, Cronometer, Apple Fitness, MacroFactor, or anything else… Just
explore this and see what the possibilities might be. Don't build anything yet."*

**NOTHING HERE IS BUILT. Research only,** per that instruction. Every claim carries its source in
§7. Researched against the live web on 2026-08-26.

---

## 1. The one-page answer

**Yes, today, as a website — but through FILE IMPORT, not through live sync.** Every service Tim
named lets its own user export their data, and reading a file the user chose needs no OAuth, no
secret, no server, no partner approval and no app store. It is the only path that works with this
app's actual architecture, and it works this week.

**Live sync (log a run in Strava, watch it appear here) needs a server this app does not have.**
Not an app-store app — a *server*. That is the finding that reorders the whole question, and §2 is
why.

⚠️ **And one integration is barred by its own rules even if we build everything: a friend's Strava
run may not appear in your feed.** Strava's 2026 API agreement forbids showing one user's Strava
data to another user. That does not block importing your own; it blocks the Home feed from
carrying it. §3.1.

---

## 2. ⚠️ THE REAL CONSTRAINT IS THE MISSING SERVER, NOT THE MISSING APP

Tim's question assumes the blocker might be "it is a website, not an app". It is not. The blocker
is that **OAuth's token exchange needs a client secret, and a static site cannot keep one.**

The app is served from GitHub Pages as plain files. Anything shipped to the browser is readable by
anybody who opens developer tools, so a Strava client secret in `js/` is a published secret —
which is how somebody else's app gets to act as ours, and how Strava revokes our key.

- **Strava does not support PKCE or the implicit flow**, the two OAuth variants designed for
  browser-only clients. Its token exchange requires `client_secret` outright.
- Turning the site into an App Store app **does not fix this**. A native app is also a public
  client; its bundle can be unpacked. Every serious mobile integration still exchanges tokens
  through a server the developer controls.

**So the real question is not "app or website" — it is "do we stand up a small backend".**

### What we already have that could be one

**Firebase, which this project already uses.** A Cloud Function is the natural home for the token
exchange: the secret lives in server config, the browser never sees it, and the app keeps working
exactly as it does now.

⚠️ **The cost, stated: Cloud Functions require the Blaze (pay-as-you-go) plan.** Firebase's free
Spark plan cannot deploy functions at all. Blaze has a free monthly allowance that a handful of
users would never exhaust, but it **requires a card on file**, and this project has been free to
run so far. That is a decision for Tim, not a technical detail — and it is the single gate in
front of every live integration below.

---

## 3. What each service actually allows

### 3.1 Strava — the best fit, and the one with a rule that bites

The closest match to what this app now records: runs, rides, swims, hikes, climbs.

- **API**: public, documented, OAuth 2.0, free for personal-scale use. Read a user's own
  activities including type, distance, moving time, date and heart rate.
- **Needs a server** (§2). Rate-limited.
- ⚠️ **THE 2026 AGREEMENT CHANGE, AND IT LANDS ON OUR NEWEST FEATURE.** Third-party apps may now
  display a user's Strava data **only to that user**. Sharing it with other users of the app is
  prohibited without explicit consent, and routing it through intermediary platforms is banned
  outright.
  **What that means here concretely:** an imported Strava run may appear on *your* calendar, *your*
  charts and *your* history — and **must not appear in a friend's Home feed**. The feed is the
  screen Tim asked for most recently, so this is worth knowing before anybody builds toward it.
  It is a rule, not a technical limit, so "it would work" is not an argument.
- ⚠️ **Also prohibited: using Strava data in AI models.** Nothing here does that today; it would
  bar feeding imported runs into the estimator or any future model.

### 3.2 Apple Health / Apple Fitness — needs a native app, full stop

- ⚠️ **There is no web API and no server API. None.** HealthKit data lives on the device and is
  reachable only by a native iOS app the user installs and grants permission to. This is Apple's
  privacy architecture, not an oversight, and it has not moved.
- **This is the one case where "turn it into an App Store app" is the actual answer** — and it is
  a real answer, because Apple Health is also the *hub*: MacroFactor, Strava and most trackers
  already write into it, so one HealthKit integration would reach several sources at once.
- The cost is the whole native-app project: a Swift companion app, a developer account
  (~$99/year), App Store review, and — per the AirPods research — **guideline 4.2 rejects apps
  that are merely a repackaged website**, so it would have to be a genuine app rather than a
  wrapper.
- A cheaper middle path exists and should be named honestly: **Apple Health exports its whole
  archive as XML from the Health app** (Profile → Export All Health Data). That is a file import,
  it works today, and it is a manual one-off rather than a sync.

### 3.3 Cronometer — no public API; export only

- ⚠️ **No self-service public API.** Cronometer has repeatedly declined to publish one; access
  exists only via enterprise/partner arrangements and via aggregators.
- **CSV export is a first-class user feature**, and it carries the things this app would want:
  daily energy, protein, and body weight.
- The community Go module and MCP servers that "provide API access" drive the **unpublished**
  endpoints the web app itself uses. Fine for one person exporting their own data, **not a
  foundation to build a product feature on** — it can change without notice and is outside the
  terms.
- **Verdict: file import or nothing.** Which is fine, because file import is the recommended path
  anyway.

### 3.4 MacroFactor — export is the path; its API is unofficial

- **Integrations it has**: Apple Health, Google Health Connect, and a deprecated Fitbit link. So
  it is a *writer* into Apple Health, which matters for §3.2.
- **No public developer API.** The "MacroFactor API client" projects are unofficial, built on the
  app's own endpoints — same caveat as Cronometer.
- **Data Export is built in**, both a quick spreadsheet (weight trend, calories, macros,
  expenditure) and a granular per-table export. That is exactly the shape a body-weight and
  protein import would need.

### 3.5 The wearables, for completeness

| Service | Public API | Notes |
|---|---|---|
| **Fitbit** | Yes, OAuth 2.0, quick self-serve onboarding | Historically the friendliest; the older Web API is being sunset, so check what replaces it before relying on it |
| **Garmin** | Yes, but **approval required** | Developer-program application, can take weeks, access is not guaranteed |
| **Oura** | Yes, OAuth 2.0, straightforward | Sleep and readiness — interesting for the "why progress stalls" screen, which currently admits sleep is invisible to it |
| **Withings** | Yes, OAuth 2.0 | Scales — the cleanest possible source for the body-weight series |
| **Google Health Connect** | Android's equivalent of HealthKit; on-device, needs a native Android app | Same shape as Apple's |
| **Aggregators** (Terra, Vital, Thryve) | One API covering 300+ sources including Cronometer | **Removes the per-service work and adds a per-month bill and a third party holding Tim's users' health data.** Worth knowing about; hard to justify at this size |

---

## 4. What this app would actually do with the data

Worth settling before any of it is built, because **D27 already decided most of it**: activities
are recorded first-class and modelled not at all.

- **Runs, rides, swims, climbs → sessions**, exactly as the quick activity log writes them today.
  The machinery exists; an import is a different door into `saveSession()`.
- **Body weight → the dated weigh-in series.** The highest-value import in the list and the most
  boring: body weight already gates the muscle map for bodyweight lifts, a stale weigh-in is a
  known gap (§9 of progress.md), and Withings/MacroFactor/Apple Health all carry it.
- **Protein and calories → nothing, today.** ⚠️ D1 and D26 say this app may *recommend* a protein
  number with a citation and may never track food. Importing what somebody ate is tracking food.
  **This collides with a locked decision and must be taken to Tim as a narrowing, the way D21, D26
  and D27 were** — not resolved quietly by whoever builds the importer. The honest version might
  be: import the daily protein *total* to answer "is the Goals screen's protein line being met",
  and never a food, a meal or an ingredient.
- **Heart rate, sleep, readiness → nothing yet**, and probably a stated caveat rather than a
  number. The Goals screen currently names sleep as one of four causes of a stall it cannot see;
  a sleep figure would let it stop saying that, but only if a dose-response exists, and
  `docs/research.md` §6.10 says it does not.
- ⚠️ **Nothing imported may reach the muscle map, ratings, volume or progression** — D27 and D2.
  An imported run is a record, not evidence of strength.

---

## 5. The recommendation

**Phase 1 — file import, and it needs nothing from anybody.** One screen: pick a file, say what
was found, confirm, write. It reuses `inspectBackup()`'s established shape — check everything
before writing anything, name what is in the file, confirm before replacing. Start with the two
highest-value and lowest-risk: **a body-weight series** and **Strava's activity export**.
No secret, no server, no Blaze plan, no partner approval, no app store, no terms to breach —
a user exporting their own data and handing it to an app they chose is the one path nobody
restricts. ⚠️ **The de-duplication rule is the real work**, not the parsing: importing the same
file twice must not double somebody's training history. Sessions carry ids; an import needs a
deterministic id derived from the source so a re-import is an upsert. That is the same argument
the guest-workout save already makes.

**Phase 2 — live Strava sync, if and only if Tim wants to turn Blaze on.** A Cloud Function for
the token exchange, refresh tokens in the user's own Firestore document, a webhook for new
activities. Real work, and it buys "it just appears" over "export and drag a file in once a
month". ⚠️ **Build the feed exclusion first**, or the first sync breaks Strava's terms on the
screen Tim most recently asked for.

**Phase 3 — a native companion app, only if Apple Health is the actual goal.** It is the only way
in, it reaches many sources at once, and it is a different project with a yearly fee and a review
queue rather than a feature.

**Not recommended: an aggregator.** A monthly bill and a third party holding health data, to save
work on integrations we would otherwise do two of.

---

## 6. What is deliberately NOT proposed

- **Scraping, or building on unpublished endpoints.** Cronometer's and MacroFactor's community
  "APIs" work today and are outside both services' terms; a product feature resting on one breaks
  without warning and cannot be defended.
- **Storing anybody's credentials for another service.** An import reads a file; a sync uses
  OAuth. Neither ever asks for somebody's Cronometer password, and no version of this should.
- **Writing back out to these services.** Every integration here is read-only. Publishing this
  app's workouts into somebody's Strava is a separate decision with a separate blast radius.
- **Importing food.** See §4 — it needs Tim to narrow D1/D26 first, and that is his call.

---

## 7. Sources

Strava API agreement 2026 and the display restriction: strava.com/legal/api ·
press.strava.com/articles/updates-to-stravas-api-agreement ·
support.strava.com/en-us/articles/15401608 · Strava OAuth requires the client secret, no PKCE or
implicit flow: developers.strava.com/docs/authentication ·
communityhub.strava.com/developers-api-7/how-to-keep-client-secret-secure-in-public-app-1598 ·
HealthKit is native-only with no web or server API:
developer.apple.com/documentation/healthkit · themomentum.ai/blog/do-you-need-a-mobile-app-to-access-apple-health-data ·
App Store guideline 4.2 on repackaged websites: developer.apple.com/app-store/review/guidelines
(§4.2) · Cronometer has no public API, export only:
forums.cronometer.com/discussion/3809 · github.com/jrmycanady/gocronometer ·
MacroFactor integrations and data export: help.macrofactorapp.com/en/articles/102-integrations ·
help.macrofactorapp.com/en/articles/68-export-your-data · Wearable APIs and onboarding:
developer.garmin.com/gc-developer-program/program-faq · openwearables.io/integrations/fitbit ·
Aggregators: tryterra.co/integrations/cronometer
