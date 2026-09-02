# Direction — what Tim wants this to be

> 🚨 **READ THIS BEFORE PROPOSING ANYTHING, AND BEFORE APPLYING A RULE FROM `docs/handbook.md` THAT
> PREDATES IT.** It is the record of a long interview on **2026-09-04** in which Tim was asked, and
> answered, what this project is for. **Several answers reverse standing rules that had been
> enforced hard for weeks** — they are marked 🔄 below and the old rule is quoted beside the new one
> so nobody re-applies it from memory.
>
> `docs/vision.md` is his running list of **features** he wants. **This is the frame around it**: who
> it is for, what it competes on, what may be loosened, and how he wants to be worked with.
>
> ⚠️ **EVERY QUOTE HERE IS HIS, VERBATIM.** Where he did not say something, this file says so rather
> than filling the gap. Three topics he explicitly deferred are listed at the bottom as **open
> threads** — do not guess at them.

---

## 1. The one-paragraph version

**This is a real product for strangers, not a personal tool, and he means it.** He and his girlfriend
use it as their main strength tracker today; in the next few months he intends to put it on the
**Apple App Store** and get people he knows, then strangers, onto it. *"The long-term goal is to get
it as big as the biggest lifting apps or even bigger."* He is realistic rather than deluded about
that — *"If I don't make it big at all then that's fine, but I'm just saying that the dream is
actually realistic."* **He is absorbing the cost and the time himself and does not want to profit
from it.** He works on it **most days**, and there is **no deadline**.

---

## 2. What it is, and what it competes on

| | |
|---|---|
| **Who for** | Strangers, eventually. Design for people who have never met him. |
| **The core** | ⚠️ He rejected the framing of "pick one": **"tracking your self progress is most important, and then interactions with others is also a main feature."** Both. Self-progress leads. |
| **The edge** | **Quality, and being free.** *"I think I can make the quality better, and having it be virtually or completely free is motivating."* **Not** a single killer feature. |
| **Scope order** | 🔒 **Weightlifting → other exercise (swim, run, etc.) → diet → others.** *"I'm not against going extreamly broad, but for now we'll stay close to weightlifting."* |
| **Name** | ⚠️ **"Fitness Tracker" is a placeholder. A rename is coming and he will bring it.** 🛑 **Do not push him on it.** Keep renaming cheap — do not scatter the string. |
| **Platforms** | The **website stays** for anyone who wants it. The iOS app is an addition, not a replacement. |

**On money.** He wants an **in-depth cost analysis eventually** — developer account plus server fees
against user numbers — and believes per-user cost is close to nothing. The ceiling he set is the
important part: **donations or slight ad revenue, and never more than it costs to run.** *"I don't
want to make the cost or ad revenue higher than the cost to maintain the servers and other
base-costs."* ~~🛑 **He asked for the analysis ONLY IF HE ASKS.** Do not spend a session on it.~~

✅ **HE ASKED, AND IT WAS DELIVERED 2026-09-06** — published as an artifact, with the full write-up in
`docs/history.md`. **His instinct that per-user cost is near nothing was right, with one exception
that matters more than the rest of the analysis combined** (the read pattern, §A of that section).
The answer in one line: **$110/year today, free servers to ~94 users, and the ceiling he set is a
real number rather than a principle.** 🛑 **Do not re-run it unprompted**; prices were confirmed on
2026-09-01 and will drift.

---

## 3. 🔄 THE FOUR REVERSALS — old rule, new rule

### 🔄 3.1 "Something is always better than nothing" — the honesty rule is recalibrated

> **Was:** the app refuses to state anything it cannot back up. Blank states, permanent refusals, no
> on-track verdict, no rating for anything without published standards.
>
> **Now, Tim:** *"It's about getting the BEST numbers we can, not necessarily having it perfect or
> held to an extreamly high standard. When our numbers aren't as perfect, have a way to be upfront
> about it but something is always better than nothing."*

**What survives, and it is the half he explicitly kept: *"have a way to be upfront about it."*** A
best-effort number, clearly labelled, beats a blank. **A number presented as something it is not is
still wrong** — that is Rule 5, and he endorsed the labelling rather than waiving it.

⚠️ **HE DOES NOT WANT A SWEEP.** *"I think I'll notice the places that show blanks and I'll manually
tell you to fix them if I want."* **He did ask for a list** of where the app currently refuses or
shows a blank, so he can pick from it — that list is owed to him and is the one deliverable this
interview created besides this file.

### 🔄 3.2 The discovery feed is no longer refused

> **Was:** 🛑 refused **twice, in writing** — `docs/social-plan.md` §12.11 and Open work 18: "not a
> feature this app is missing, a product this app decided twice, in writing, not to be."
>
> **Now, Tim:** **"It has to go eventually."**

**That refusal was made when the app was for him and Autumn, and the premise has changed.** A public
app needs people to find each other. 🛑 **Nothing is built and no plan was asked for** — the
reversal is recorded so a future session does not quote the old refusal at him as settled law.
⚠️ **It carries the moderation work with it** (§3.4 below).

### 🔄 3.3 Stop recording "not verified on a phone"

> **Was:** every session's write-up ended with a loud ⚠️ NOT VERIFIED block — nothing has been on a
> phone, no two real accounts, the field-check list has not moved.
>
> **Now, Tim:** *"Don't record the 'not verified on iphone' warnings at all. I'm constantly testing
> almost every part of the cite so when something has a problem, I'll come to you."* And earlier:
> *"there is a lot of behind-the-scenes testing going on that I'm not telling you about. Assume if I
> havn't told you that something isn't working, then it is."*

🔒 **THE OPERATING RULE: SHIPPED IS WORKING UNLESS TIM SAYS OTHERWISE.** Do not write the caveat, do
not open a session by listing it, do not treat it as blocking.

⚠️ **This is about DEVICE verification, not about arithmetic.** A screen he has looked at is
verified by him looking at it. **A predicted number is not**, because a wrong estimate looks exactly
like a right one — that is a different claim and it is still true that no prediction has been checked
against a real attempt. State that where it is relevant to a number; never as a standing warning
about a screen.

### 🔄 3.4 Safety and moderation — real, but explicitly not now

> **Tim:** *"I'm not concerned about saftey whatsoever as of right now, but as we get more users and
> start preparing for full deployment for maximum users, then it will become more of an issue. I
> don't think you should worry about it at all right now **unless you think it will drastically
> change how we build knowing we'll change it in the future**."*

And on reporting/blocking specifically: *"That is something we'll need to do, but just put it in the
notes. no plan or work building yet."*

🛑 **NO PLAN, NO BUILD.** ✅ **The one live clause is his own**: if a decision being made now would be
expensive to undo once moderation exists, **say so at the time**. That is the only circumstance in
which safety may be raised unprompted.

---

## 4. How he wants to be worked with

| Rule | His words |
|---|---|
| 🛑 **Never touch visuals unprompted** | The app *"looks very AI-generated and not very professional… I don't want you to automatically go fixing things yourself, I think it needs a human perspective."* **Wait for him, screen by screen.** He will point; you execute. |
| 🛑 **Do not ask about other people's opinions** | *"I don't want you to ask me about other's oppinions."* Autumn is not a design input to be polled. |
| ✅ **Recommend only when asked** | And when asked, give a **real ranked answer**, not a shrug. Between jobs: report what is done and stop. |
| ✅ **Speak up about nothing else** | The single exception is §3.4's clause — a decision now that would be expensive to reverse later. |
| 📄 **The docs are for you, not him** | *"Purely for you."* He does not read `progress.md` or the handbook. Write them for whatever makes a fresh session effective; do not optimise them for a human reader. |
| 👤 **It is only ever you and him** | *"Just us."* No second contributor to write for. |
| ⏱️ **Steady, most days. No deadline.** | Nothing needs to be sequenced backwards from a date. |
| 🟢 **Deploy sub-agents** | *"I'm giving you some more assignments so you really should deploy many sub-agents to help you out."* (2026-09-08 — the third time he has asked.) **One named file each**; see `progress.md`'s standing-instructions entry for the rules that make it work. |

## 4a. 🆕 WHAT HOME IS FOR — 2026-09-08, and it is a brief rather than a feature

> **Tim:** *"I want to change some things with the layout of the cite, especially the home page. Any
> details that don't go in any of the other main sections (data, workouts, etc) go into the home
> page, so we want to make it really nice. **It's going to be the hub of all basic interaction.**
> Side features or anything like that should be placed there."*

🚨 **THIS IS A PLACEMENT RULE, NOT A REQUEST.** It answers "where does this go?" for everything
built from here on: if a thing does not belong to Data, Workouts, Record or Profile, **it belongs on
Home**. It is not an instruction to put something there now.

🛑 **NOTHING WAS ADDED TO HOME ON THE DAY HE SAID IT**, deliberately. The same message removed the
You / Friends switch from it, so Home is currently the friends' feed and nothing else — and a screen
described as *"going to be"* the hub is a screen waiting for him to name what goes on it. **Resist
filling it.**

⚠️ **AND HE DREW A LINE THROUGH THE TWO PROFILE SCREENS IN THE SAME MESSAGE**, which is worth
keeping because it generalises: *"that section is mostly used to make setting adjustments and do
logistics, where this new section is broad information and view of your account."* **Settings and
logistics behind the top-left icon; a view of what your account amounts to in the tab bar.**

**Three topics he deferred with "I'll talk about it later" — 🛑 do not pre-empt any of them:**

1. 🔄 ~~**The app's voice and wordiness.**~~ **HE OPENED IT ON 2026-09-07 — the deferral is over and
   "do not shorten copy globally" is lifted BY HIM, on this topic.** *"analyze everywhere in the cite
   where it has sentences longer than maybe 10-15 words and really think about if every single word
   in that sentence is important … With paragraphs, if it's explaining something, I think it's best
   to have a little question mark somewhere near the thing that it's explaining … when you touch it
   it opens a mini box that shares what it's trying to say."*
   ⚠️ **IT IS STILL NOT A SWEEP.** He asked for the ANALYSIS first, and it is done: **18,631
   user-facing words, 304 sentences over 15 words, 63 blocks of 40+**, ranked by file in
   `progress.md`. Seven places converted, ~300 left, and **he points**.
   🆕 **AND HE POINTED, 2026-09-08 — THE PROFILE MENU, WITH A SCREENSHOT OF HEVY'S.** *"right now
   the profile menu is really wordy and complex, when it really should be quite simple … all details
   like the 'view demo account' descriptions should be held in a question mark that pops up when you
   click on it to learn more, don't display it on the main screen."* **That is the working shape of
   this topic**: he names a screen, it gets done whole, and nothing else is touched.
   ⚠️ **He also sent a SCREENSHOT OF ANOTHER APP'S UI, which does not go in the repo** — the
   standing rule from `docs/social-plan.md` §12.12. What it showed is written down in
   `docs/history.md`, 2026-09-08.
   🆕 **AND HE POINTED AGAIN, 2026-09-09 — THE "COMPARED TO" SHEET.** *"Right now the 'compared to'
   (like me, everyone) menu is pretty wordy and it really doesn't need any words at all. I think it
   could do with some question marks or extream cuts to descriptions."* **Both halves of that were
   taken literally**: four axis paragraphs went behind four dots, and the preset hints were *deleted*,
   because the chips below and the live line at the foot already say what a preset means.
   ⚠️ **"Extreme cuts" is not licence to drop a caveat** — the untrained-adult sentence (D21, the
   weakest number in the file) was shortened and is asserted by **opening** its dot.
   🆕 **Design Rule 9 came out of it — the ? holds WHY, never WHAT** (`docs/handbook.md` §5).
   🛑 **AND ONE CARVE-OUT IS HIS, VERBATIM**: *"the research section is extreamly wordy and while I
   do think we need to make the descriptions in that section more clear, we should allow it to
   describe that section sufficiently."* **Research's framing may shrink; its teaching content may
   not.**
2. **What "quality" means concretely** — his stated competitive edge, undefined on purpose for now.
3. **The abs ranking.** Still open from 2026-09-03. *"I'll talk to you about it after questioning.
   don't do anything now."* ⚠️ Note that §3.1 makes his own first idea (rate weighted core work
   through the normal machinery) sit much better than it did under the old rule.

---

## 5. The App Store, as he described it

- **Timing:** *"in the next few months"*, via his own developer account, someone else's, or one
  shared with his brother. **Convert the current version** once it is *"very good"*.
- **The website stays.** The app is an addition.
- ⚠️ **He was told, and accepted, that this is not a small step**: Apple rejects thin website
  wrappers (guideline 4.2), so the listing has to be earned with a shell that adds real native
  value, plus a $99/yr account and review.
- 🔄 ~~**Sign in with Apple will be required.** Guideline 4.8: an app offering Google sign-in must
  offer Apple's too.~~ 🚨 **CORRECTED 2026-09-06, reading the live guideline rather than memory.**
  **4.8 is now called "Login Services" and names no Apple product.** It is a capability spec: an app
  whose primary account uses a third-party login must ALSO offer a login service that limits
  collection to name and email, lets the user keep their email private, and does not use in-app
  activity for advertising without consent. **Sign in with Apple satisfies it and is not mandated by
  name.** ⚠️ **The trigger is offering GOOGLE SIGN-IN at all** — anonymous accounts (D12, the default
  path here) and the app's own email accounts trigger nothing. **His call stands: "Note it, deal with
  it then."**
- ⚠️ **A free app with no in-app purchase pays Apple NO commission at any revenue level** — the
  $99/yr is the whole Apple bill. The uncosted item is a **Mac**, which is a hard requirement:
  every Xcode version lists a macOS minimum and Xcode Cloud does not remove it.
- 🛑 **No App Store work has been started and none was asked for.**

---

## 6. What this interview queued

Neither of these was invented — both are things he asked for during it.

1. **A list of every place the app refuses or shows a blank**, so he can choose which ones get a
   best-effort number instead. *"if you want to give me a list of the places this does already
   happen, it could help me with this. Do this after we're done questioning."*
2. **A note-to-the-developer feature.** *"adding a temporary section to the app that allows the user
   to write a note or idea straight to the developer (me) would be nice to have. Then, make my
   account (timhadfield7@gmail.com) a developer account where I can read all these notes or ideas
   straight on the app. I might have you do most of the reading, but just in case, I'll have it there
   aswell."* **He asked to build it after questioning finished**, and it is deliberately
   **temporary** — for the next couple of months, while early users have fresh opinions.
   ⚠️ **The developer role has to be a rule-enforced read**, not a hidden screen: notes are other
   people's words about their own training and only he may read them.

**He also said, of the four standing open-work items he was shown** (handles instead of the
enumerable directory, checking the estimator against a real attempt, a two-account round trip,
warm-up set typing): *"All of these are things I want to work on, but I'll let you know about them."*
🛑 **All four are wanted. None is authorised. Do not surface them as "the next thing to do."**
