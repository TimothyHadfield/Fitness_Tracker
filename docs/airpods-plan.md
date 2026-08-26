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

## 3. What is a dead end for a web app (do not revisit without a native app)

| Idea | Why it is dead |
|---|---|
| Head gestures (nod to log a set) | CMHeadphoneMotionManager is native-only; DeviceMotionEvent never carries headphone data; W3C issue #68 dormant since 2020 |
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
Gym Rest Timer, App Store id1513430678 · Silent-audio battery precedent: TechCrunch, Facebook
silent-audio bug, 2015-10-22 · Safari 26 release notes:
developer.apple.com/documentation/safari-release-notes/safari-26-release-notes
