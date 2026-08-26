# AirPods as a remote control — research and plan

**Written 2026-08-26 on Tim's ask** (*"I'm interested in the motion-features that AirPods have in
order to remote-control the app… explore this and see what the potential is… Don't deploy anything
yet."*). **NOTHING HERE IS BUILT. Plan only,** per that instruction. Research ran against the live
web on 2026-08-26; every claim below carries its source in §5.

## 1. The one-sentence answer

**Head-motion control is impossible for a web app; stem-press control is genuinely buildable.**
AirPods head-tracking (CMHeadphoneMotionManager) is native-iOS-only with no web exposure, no
WebKit flag, and no standards work beyond a dormant 2020 W3C issue. But the stem presses
(single = play/pause, double = next, triple = previous) reach a web page through the MediaSession
API — **if and only if the page is playing audio** and therefore owns the phone's Now Playing
session.

## 2. What is buildable — the stem-press recorder

The session runner plays a **silent looped `<audio>` element**, started by the user's own
"start workout" tap (satisfies iOS autoplay policy). The app then owns Now Playing:

- **Single press** → start/stop the rest timer (`play`/`pause` handlers).
- **Double press** → next set / next exercise (`nexttrack`).
- **Triple press** → back one step (`previoustrack`).
- `mediaSession.metadata` is updated per step — *"Bench Press — set 2 of 4"* — so the **lock
  screen becomes a status display** for free.
- Bonus that needs no input at all: spoken/beeped rest-timer cues through the same audio element.

Verified constraints, from the research:
- Works in iOS Safari AND the installed home-screen PWA (confirmed in the field by a third-party
  podcast PWA). Register `nexttrack`/`previoustrack`, NOT `seekforward`/`seekbackward` — the
  seek pair makes iOS hide the next/previous controls.
- The stem mapping is Apple's and cannot be remapped; the app only chooses what "next track"
  means. AirPods Pro volume-swipe never reaches the page.
- **Locked-screen rule:** keep the silent track playing continuously. Audio that sits paused
  ~30 s while the screen is locked kills the session until the app is foregrounded (open WebKit
  gap, reproduced by others as recently as Safari 26).
- **The product cost, stated plainly: the app occupies Now Playing, so the lifter cannot ALSO be
  running Spotify.** For people who train to music from the same phone this is a dealbreaker, so
  the feature must be an opt-in toggle ("Headphone controls") that is OFF by default, and the
  battery cost of the always-playing silent track (real but modest — comparable to playing
  music) belongs in its help text.

## 2b. ⚠️ "WOULD HEAD MOTION WORK IF IT WERE AN APP STORE APP?" — YES, and that is the only way

**Tim asked on 2026-08-26.** The answer is yes, and it is worth being precise about why, because
"native-only" is exactly the sentence that makes a native app the fix.

- **`CMHeadphoneMotionManager` is a real, public, documented API** — iOS 14+, in Core Motion. It
  hands a native app the AirPods' attitude, rotation rate, gravity and user acceleration. A nod
  really is detectable. This is not a private API or a grey area.
- **It works with AirPods Pro (1st and 2nd gen), AirPods Max, AirPods 3rd gen and Beats Fit Pro** —
  the ones with the motion sensors. ⚠️ **Not AirPods 2nd generation**, so "does it work with
  AirPods" has a per-model answer, and the app would have to say so rather than appear broken for
  somebody on older buds.
- It needs `NSMotionUsageDescription` in the app and the user's permission, like any motion access.

⚠️ **THE CATCH IS NOT THE API, IT IS WHAT "TURN IT INTO AN APP" MEANS.** A `WKWebView` wrapper
around this website does NOT get access — the web layer is still a web layer. It would need a
native bridge: a Swift plugin reading Core Motion and passing events into the page. That is
buildable, and it is a real piece of native engineering plus a $99/year developer account plus
App Store review.

⚠️ **And review is a live risk for exactly this shape of app.** Guideline 4.2 (Minimum
Functionality) rejects apps that are "a repackaged website" and not "app-like". A wrapper whose
only native code is a headphone-motion bridge is precisely the thing reviewers look for. Passing
4.2 means shipping genuine native capability — offline, HealthKit, notifications, native
navigation — which is a project, not a port. **See `docs/integrations-plan.md` §3.2: HealthKit is
the other thing that needs a native app, and it is a much better reason to build one than head
gestures are.**

**Recommendation, unchanged by this:** the stem presses are buildable on the web today and deliver
most of the value. Head motion is a reason to build a native app only if something else already
justifies one.

## 3. What is a dead end for a web app (do not revisit without a native app)

| Idea | Why it is dead |
|---|---|
| Head gestures (nod to log a set) | CMHeadphoneMotionManager is native-only; DeviceMotionEvent never carries headphone data; W3C issue #68 dormant since 2020. ⚠️ **Dead for a WEB app specifically** — §2b is what changes if a native app is ever built |
| iOS 18 nod/shake system gestures | Wired to Siri call/notification interactions only; a PWA cannot produce Siri-announced interactive notifications |
| Web Bluetooth / WebHID | Still unsupported in WebKit on iOS (2026), and AirPods expose no GATT service for buttons anyway |
| Voice logging in the installed PWA | `webkitSpeechRecognition` exists in Safari tabs but silently does nothing in installed home-screen apps (long-standing, still reported) — and the installed app is where training happens |
| Apple Watch companion | Native app territory by definition |

## 4. If Tim says build it

1. **Spike on his phone first** (half a day): silent track + the three handlers + metadata, on the
   live site behind a query flag, tested locked and unlocked in the installed PWA. The 30-s pause
   kill and the metadata refresh cadence are the two things only a real device can confirm.
2. Then: an off-by-default Settings toggle, wiring into the runner's `goToStep`/rest timer, the
   Now-Playing-conflict warning in its help text, and a `sw-update`-style hardware test note in
   progress.md — this is a feature that CANNOT be verified headlessly, and must not be described
   as verified until his AirPods have driven a set.

## 5. Sources

MediaSession in an iOS PWA (field report): dbushell.com/2023/03/20/ios-pwa-media-session-api ·
iOS MediaSession quirks: overdevs.com/ios-mediasession.html · API guide:
web.dev/articles/media-session · Stem mapping: support.apple.com/en-us/102628 · AirPods
gestures: support.apple.com/guide/airpods/devb2c431317 · Locked-PWA audio gap:
developer.apple.com/forums/thread/762582 and /706499 · CMHeadphoneMotionManager (native only):
developer.apple.com/documentation/coremotion/cmheadphonemotionmanager · W3C head-tracking issue:
github.com/w3c/orientation-sensor/issues/68 · Web Bluetooth status: caniuse.com/web-bluetooth,
bugs.webkit.org/show_bug.cgi?id=101034 · PWA speech-recognition gap:
developer.apple.com/forums/thread/748048 · Native rest-timer precedent (media-player mode):
Gym Rest Timer, App Store id1513430678 · **§2b (added 2026-08-26):** CMHeadphoneMotionManager supported models — github.com/emanuelgollob/AirPodsPro-Motion-OSC-Forwarder, research.macpaw.com/publications/headphones-accessibility; App Store guideline 4.2 on repackaged websites — developer.apple.com/app-store/review/guidelines, mobiloud.com/blog/app-store-review-guidelines-webview-wrapper · Silent-audio battery precedent: TechCrunch, Facebook
silent-audio bug, 2015-10-22 · Safari 26 release notes:
developer.apple.com/documentation/safari-release-notes/safari-26-release-notes
