# Fitness Tracker — chat log (for Claude)

_One entry per session, newest at the bottom, capped at 60 KB. The current state is in `progress.md`;
full session write-ups are in `docs/history.md` (search by date)._

⚠️ **THIS FILE STARTS AT 2026-09-15.** Everything from **2026-08-14 to 2026-09-14** is in
`docs/chat-archive.md`, oldest first. The 08-29..09-14 block moved there on 2026-09-27; like the two
earlier moves it was cut on RAW BYTES at an entry boundary and verified to reassemble exactly — a
split that never decodes cannot damage an em dash (§0.11). Entries before 2026-09-27 are prose; from
2026-09-27 they use the short form: Asked · Decided · Built · Verified how · Open.

---

## 2026-09-15 — what the interrupted agents left, then the ratio table

**You asked** whether last session's interrupted agents had left anything to finish, and they had —
more than the notes admitted.

**The accessibility audit had already run.** The notes said it produced nothing; in fact 4.5 MB of
its output was sitting in the dead session's scratchpad, unread, because the agent was killed between
writing the results and reading them. Clean sweep: 272 screens, no contrast failures, no overflow, no
unnamed controls, at four widths. I re-ran it against the current code too, since the original run
predated the last commit.

**A comment in the ranking code said the opposite of what the code does.** The typo screen claims it
only ever compares a lift against its own past. It doesn't — it compares every exercise for a muscle
in one series. So a genuine heavy bench test, logged among light flies, gets set aside. I fixed the
comment rather than the code, because on real training the safety margin is wide (the widest
disagreement between two exercises of one muscle is 1.12×, and it takes 2× to trigger). The
alternative fix would let a mistyped number on a brand-new exercise straight through, so which error
you prefer is your call.

**A tool had been reporting "22 figures outside tolerance" through a green suite** since the rebuild,
and the obvious reading of that was wrong: 16 of the 22 were checking sentences that had been
reworded away. Behind them were four places still claiming the estimator's constants were chosen to
minimise one thing when the measurements say another.

**Then you picked the ratio work.** Re-deriving the whole table found the *check* was broken before
the table was — it couldn't read the sex-specific ratios we added last session, so it reported 18
entries badly wrong when the real number was 10. Eight of those ten were the same fault: the male
figure right and the female figure 8–15 % out, on entries that never got a sex pair. Agreement with
the published source went from 38 entries to 85 out of 105.

**And then σ.** Every ratio now carries a measured uncertainty — how much it drifts between the
novice and advanced rows of the published table — and readings are blended by how precisely each one
pins the answer, instead of by a judgement. Your muscle map moved between −2.3 % and +2.8 %. One
side-effect worth knowing: your old back-session complaint (the tired third exercise dragging Back
from 212 to 145) now reads 199.8, because the assisted pull-up — the least trustworthy conversion in
the file — carries a fifth of the weight it used to.

**Six things are waiting on you**, three of which put a new sentence on a screen: the quarantine
trade-off above, the fall limit, a freshness note that has never rendered at all, a dead line on the
Data tab, Goals printing a percentage that can disagree with itself, and one measurement that
contradicts a claim in two places. They are listed at the top of `progress.md`.

**Not started, and ranked first if you want it:** nobody has ever walked this app with a keyboard,
run a screen reader against it, or tested it at larger text.

## 2026-09-16 — a friend's page became their profile, and what that made every account share

**You asked for three things and said to use sub-agents.** Three ran at once on separate files.

**The friends list showing blank faces.** It never could have worked: the row was asking for a photo
from your own friends list, and a photo lives in the other person's published copy, not in yours. It
reads that now, after the list paints, and falls back to the grey figure if their account can't be
reached.

**A friend's page is their profile now.** Their picture at the top, workouts and friends, their core
lifts and the rest, their calendar — no goals, and their body row shows sex and age only, as you
asked. "View data" in the top right pulls their data screen up the way Record comes up, with the
muscle map, volume, graph and bars but no research, and the arrow puts it back down. You can open
their workouts and their friends and keep walking from there; going back from a friend's friend
takes you to your own profile, not to the person in between.

**The part that wasn't small.** None of that could be shown, because accounts don't publish any of
it. Your app has never shared your sex, your age or your friends list — so all three now go into
what people can read of you. Two things worth knowing about that. Your friends list is readable by
anyone who can read your account, which on a public account means anyone signed in; it's the first
thing we publish that names other people, and it's one line to reverse if you'd rather it didn't.
And your body weight did **not** join them — it stays friends-only and off by default, as before.

**One thing that would have broken quietly.** The security rules pin exactly which fields a shared
copy may contain, so adding a field without updating them would have made every publish fail —
silently, with no error on any screen. It would have looked like everyone's page freezing. The rules
went out with it, and the test that should have caught it was itself using a fake document thinner
than the real one, which is now fixed.

**Systems fold open and closed** in both the Workouts and Record lists. They start open, remember
what you closed, and remember it separately per screen. Tapping the system name opens and closes it
rather than going in — "Open this system" is the last row inside each one.

**Expect one oddity:** a friend's age and friends list only show up after *they* next open the app,
because only their app can publish their own details. Until then their page says so rather than
pretending they have no friends.

**Three things you asked for are queued and not started** — the weekly/cycle schedule boxes on a
system, months with nothing in them collapsing to a line, and the bar chart of months once there are
more than five. All three land in files that were being rewritten while you asked, so I left them.

**And the two you added while that was running, both done.**

**A system can have a plan.** Optional, on any system: either seven weekdays or an N-day repeating
cycle up to 14, each day holding one of that system's workouts or Rest. It shows as boxes at the top
of the system's own screen, and you build it on the edit form behind the pencil. As you decided, it
only displays — Home and Record still suggest whichever workout you've gone longest without doing,
and the "?" on the screen says so outright. Two details worth knowing: "Rest" and "nothing planned"
are deliberately different, and if you delete a workout the day that named it goes back to empty
rather than turning into a rest day you never chose.

**Empty months collapse, and there's a bar chart.** A month with nothing in it is now one line saying
the month and "No recordings". Once you have more than five months with recordings, a bar chart sits
above the months — one bar per month, height = days trained. A month with nothing *between* two months
that have something still gets a column at zero, so a gap in your training reads as a gap; months
before you ever recorded anything aren't drawn at all. On a friend's calendar it says days
*published*, not days trained, because you only ever see the sessions they've shared.

One thing I left for you: on the 1st of a month with nothing in it yet, the months view lands on that
one-line row with a screen of empty space under it. That space is the "open on the current month" fix
you asked for doing its job — capping it would stop it landing — so I didn't touch it.

**Three fixes off your reports, minutes after that went up.**

**A friend's "view data" lost its Calendar tab** — four tabs now, since their calendar is on their
profile. Along the way: `#/friend/<id>/calendar` had never actually worked (it read "that workout is
not here"); it opens their profile now.

**The months view stops at your first and last recording.** No more empty months before you started.
One consequence you should know: if your last workout was months ago, the current month isn't drawn
at all, so the calendar opens on the most recent month you actually trained in. Say the word if
you'd rather it always ran through to today.

**Back from someone's profile always goes to your own profile now**, whatever you were on before —
which is what fixes the thing you hit, where closing their data panel and pressing back put you
straight back into the panel. The earlier version of that rule only applied when you were inside a
friend's friend, and it could never have caught your case: the app was correctly going back to the
screen you were on, and the screen you were on was the panel you'd just closed. Their workouts and
friends lists still go back to that person; only their profile jumps home.

One thing I fixed in my own notes while doing it: the docs claimed the Data tab has six segments
including Calendar. That's been wrong since the calendar moved to Profile on the 10th.

## 2026-09-17 — the two things that were only ever "reviewed", run for real

**You asked what was worth doing that I didn't need instructions for.** I gave you three: prove the
sharing and sync code against the real database, the accessibility work, and pointing the automated
screen audit at a friend's pages. You picked the first and said to leave accessibility alone for a
while.

**Here's what that was about.** Everything the app does over the network has been checked against a
fake database or a local simulator. Both are honest tests of what they test, and neither one is the
real Google server. Two pieces of the app have therefore only ever been read rather than run, and
both of them fail *quietly* if they're wrong:

- **What your app publishes for friends to see.** Last session added your gender, age and friends
  list to that. The database has a rule listing exactly which fields it will accept, and if that rule
  hadn't updated properly, every publish would be rejected *silently* — nobody's page would ever
  update again and nothing anywhere would say so.
- **How the app loads your training when you open it.** That was rewritten a while back to only
  fetch what changed, which is what keeps the running cost near zero. Nothing had ever measured it
  against a real server.

**Both work.** 39 checks, no failures, run as two throwaway accounts that I deleted afterwards. Two
numbers worth having:

**Opening the app when nothing has changed now costs zero.** Not "cheap" — zero records fetched. And
when something has changed it fetches only that: two records out of four, in the test. That's the
whole cost saving, measured rather than estimated.

**Your published profile is accepted, and the wrong things are refused.** Gender, age and friends
list all land correctly. I also deliberately tried four things that *should* fail — an extra field,
body weight in the public copy, an oversized friends list, an old-format publish — and the database
refused all four. That last part matters more than the first: anyone can show you a write that
succeeded, but the refusals are what prove the new rules are actually live.

I also checked it from the other side with a second account: it can read a public profile, can read a
friends-only one while it's on the list, and stops being able to the moment it's taken off.

**One thing I kept rather than threw away.** There was a note in the docs saying this same check had
been done back in August with a script that was then deleted — so I had to rebuild the whole
technique from one sentence. This one lives in the project now and can be re-run any time the
database rules change.

**Nothing in the app itself changed** — no screens, no behaviour. This was verification.

## 2026-09-18 — a leg day, two questions, and two things built

**Machine weight: no, and I'd keep logging 270.** The app has no idea machines weigh anything — it
stores exactly what you type. For progression, personal bests, your graph and volume that's fine,
because those only ever compare you to you; what would break them is switching convention halfway,
which would put a 118 lb jump in your own graph that you didn't earn.

The one place the absolute number matters is the muscle map, and that's the argument for leaving it
alone. Your leg press calf raise gets converted by a ratio the app has at 1.47× a standing calf
raise, and that ratio came from Strength Level's page for that exercise — people self-reporting what
they loaded, where almost nobody adds the sled. Add 118 and you'd read stronger than you are against
a population that didn't. Worth a note on the exercise so you remember which way you chose.

**Walking lunges: one rep is one step, and you count one leg.** So 20 steps is 10 reps. The app
doesn't say this anywhere, which is the real answer — but it's already the convention everywhere
else in it: the ready-made programmes say "10 reps per leg" for walking lunges and "12 per leg" for
Bulgarian split squats, and the lunge conversion came from a page that counts per leg.

Both of your questions are the same gap: the app never says what it means by a rep or by a machine
number on the screen where you're logging. I've written that down as something to fix, not fixed it —
it's words on screens, which is yours.

**Weights as a percentage of your max — built.** Each exercise in the builder has a `% of max` chip.
Set one number for every set or a different one per set (70/80/90), in 5% steps. Start the workout
and the weights are already in.

Four things worth knowing, because they change what it does:

- The percentage is of **your own best recorded set on that lift**, not the estimate the muscle map
  makes from your other lifts. A lift you've never done here gets no weight and a line saying why —
  that estimate is deliberately fenced off everywhere else because it's a number you'd load a bar to,
  and a percentage of a guess is two guesses.
- It **rounds down**, never up.
- It **overrides** the normal suggestion, and says so: *"Plan: 70/80/90% of your 205 × 5"*, naming
  the set so you can check it.
- **Refused on pull-ups, dips and anything assisted.** Their max includes your body weight; the field
  doesn't. Different numbers.

One thing I want your call on: a set with a prescribed weight counts as "not done yet" until you
touch something. So if the weight and reps are both right and you tap nothing, that set won't save.
That's the app's existing rule for numbers it filled in itself, but targets make it much easier to
hit. Leave it, warn on the screen, or count moving on from a set as doing it — your pick.

**The plate label — built.** The line under the weight now reads *"bar + 45, 45, 25 each side"* for
275, and it re-does itself every time you tap ± . A leg press says the plates with no bar. A T-bar
says "on one end", because everything goes on one post. Dumbbells, cables and pin-loaded machines
keep the old label.

Two deliberate refusals in it: a weight no plates can make shows nothing rather than a nearly-right
list, and specialty bars (EZ, trap, safety squat, Smith) get nothing rather than a guessed bar
weight — they're unmarked and vary by make.

One small surprise from building it: I told the agent doing this job *why* greedy plate-picking is
optimal, and my reason was wrong. It checked instead of taking my word, found that a 35 lb plate
breaks it (60 a side comes out as 45+10+5 when 35+25 is two plates), and dropped 35s from the list —
which is also the set every gym actually has.

## 2026-09-18 (same session) — your research folder, and Nippard's percentages

**`Fitness_Research/` is yours and your research agent's.** I've written that into the notes as a
standing rule: I don't go in it, I don't read it, I don't tidy it, and I ignore whatever changes in
there. The practical half is the bit that would actually have gone wrong — I now stage my own files
by name every time instead of committing everything at once, so its half-finished work can never end
up in one of my commits.

**Nippard's percentages: I could ship one of them, and the app already said why.** The systems file
has drawn this line since August — what ships is transcribed from his free YouTube series, and his
paid 12-week ebook's prescriptions can't go into a public repo, because that's redistributing
something he sells. A percentage table out of the ebook is exactly that.

What did go in is the one figure the free write-ups state as a percentage of a max: Legs 1's back
squat, planned at 85% for the top set and 65% for the two back-offs. Copy the system fresh to see it
— percentages arrive on a new copy, not into the one already in your account.

**The more useful thing is what trying it on your actual programme showed.** Of the four percentages
in his two leg days, the feature I built can express one:

- back squat top set, 85–90% — works, it's a percentage of a max
- back squat back-offs, 75% *of that top set* — I derived it, it isn't quite the same thing
- stiff-leg deadlift, 50–60% *of the deadlift's top set* — that's a different lift entirely
- lat pulldown, about 30% — that's a drop set, not a target

So what I built means "percent of your own max on this lift", and real programmes mostly prescribe
off a top set or off another lift. I've left the other three alone rather than force them in, because
each would put a badly wrong weight on the bar. Extending it to "% of today's top set" and "% of
another lift" is buildable — say the word if you want it.

One thing worth telling you: the test caught me getting the squat wrong a minute after I wrote it. I
put 88, the middle of 85–90, and percentages snap to a 5% grid, so 90 reached the account — the top
of his range rather than the middle. It plans 85 now, the bottom. Erring light is the direction the
whole feature errs in.

---

## 2026-09-19

**You asked whether the % feature had really deployed onto the Ultimate Push Pull Legs system.**

The deploy was fine — I checked the live site before reading any code. What you were seeing was one
of two things, and probably both.

Your copy of the system predates the feature. Adding a ready-made programme makes a copy, and a copy
can't change under you, so the percentages only arrive on a fresh one. And even a fresh copy has just
one percentage in six workouts — the back squat in Legs 1 — which is the limit I hit last time and
described in that leg-day write-up. So "it didn't fully deploy" and "it expresses one of his four
numbers" look identical from a phone. They're different things and it's the second one.

**Then you asked whether a pre-built system could stop being a copy and update when the original
changes.** I looked at it properly and said no, with three reasons:

- you couldn't edit it any more, and editing a ready-made programme is most of the value
- your recorded sessions point at a workout id, so a deploy that renamed or dropped a preset workout
  would strand workouts you'd already logged
- it would change prescribed weights under you with no warning — deploys are silent, there's no
  server to announce one, and that's the exact failure the % feature was built to avoid

What I'd do instead: keep the copy, give each programme a version, and show you a "the original
changed — review" notice you can take or ignore. Not started.

**Then you brought the current system idea, and I built it.**

The Workouts tab is one programme now — its plan, its workouts, New workout, its notes and its
rating — with the programme's name at the top as a switcher that also holds New system and Explore.
Record's weightlifting screen shows only that programme's workouts. Both screens are drawn by the
same code as the individual system screen, so they can't drift apart.

Two things worth telling you.

**The folding systems you asked for two sessions ago are gone.** Not broken — replaced. Folding
existed so you could hide the four programmes you weren't running; picking a current one answers that
properly instead of hiding things. With one programme on screen there was nothing left to fold, so I
deleted the code rather than leave it sitting there doing nothing.

**Nothing switches your programme without you saying so.** Copying something out of Explore doesn't
make it current — you'd be moved off the plan you're running mid-week. The system's own screen has a
"Make this my current programme" button instead. The one exception is accounts that have never
picked: rather than making you choose before showing you anything, the app works it out from your
most recent recorded session, and doesn't save that guess.

One side effect I didn't expect: Record used to refuse to suggest anything on a fresh account with
more than one programme, because it couldn't know which you meant. Now it can. That case just works.

Nineteen suites green, 5,303 assertions. I drove both screens in a browser at phone size to check the
layout.

One thing worth mentioning: writing the tests, I found that the empty-account version of both screens
had never been tested at all — not by this change, ever. It's the first thing a stranger sees. It
works, but it was one wrong line away from a blank Workouts tab, so there are tests on it now.

## 2026-09-20 — updating a programme you copied

You asked what the next steps were, I gave you a ranked four, and you said to build whatever I
thought should be built. So I built the top item — the one that came out of your own question last
session, about a pre-built system following its original.

**The copy is still a copy.** I'm not walking back the three reasons a live link was wrong: you
couldn't edit it, your recorded history would point at workouts that no longer exist, and it would
change a prescribed weight under you without saying so. What's new is that the app can now *tell* you
the original moved on, and take the part of it that's safe.

**How it knows.** When you add a ready-made programme now, the copy quietly records three things:
which version of the original you took, which workout of the original each of your workouts is, and
what every exercise looked like the moment it arrived. That last one is the whole trick. Without it,
"your copy says 3 sets and the original says 4" could mean the original changed or it could mean you
changed it, and there's no way to tell those apart — so the only safe thing to do would be nothing.

**What you'll see.** If the original has moved on, a line appears above the programme: *the original
of this programme changed in 2 places*. Tap it and you get every difference in plain words, each one
labelled with what will happen to it — will be added, you changed this so it's left alone, or yours
to do. One button takes the safe ones.

Three things it will never do: delete anything, overwrite something you edited, or slot a new
exercise into the middle of a workout (that would change what the sets around it mean).

**The part that affects you directly.** Your copy of Nippard's PPL was made before any of this
existed, so the app has no record of what it looked like when you took it. That means it can show you
the difference — your Back Squat has no percentage and the original now does — but it can't offer to
fix it, because it genuinely cannot tell whether that's a change I made or one you made. You'll see
it listed as yours to do. Adding another copy still gives you one with the percentage in it.

**One thing I did to protect this later.** Every ready-made programme now has a version number, and
there's a test that fails if I change one of them and forget to bump it. That matters more than it
sounds: a version I forget to update means every copy of that programme in the world thinks it's
up to date, and the notice never fires again.

I haven't driven this in a browser yet, and no programme has actually been changed for real since —
so the first time I edit a preset will be the first time the full path runs outside a test.

## 2026-09-20 (third pass) — the 1RM problem you spotted

You were right, and it was worse than you thought. Your 85×12 lat pulldown wasn't being hidden from
the "from:" list — it was contributing **nothing at all**. I traced it with a control: the rating
came out identical whether that set existed or not.

**Why.** Each exercise gets one seat on a muscle rating, and the seat goes to the most *believable*
set. Believability was reps, recency and fatigue — and **weight wasn't in the formula anywhere**. So
your 50×6 held the seat against an 85×12 that implied nearly twice the max. Exactly as you put it:
had you racked the bar at six reps it would have counted, and carrying on to twelve made it stop.

**Your rule is what shipped.** A set heavier *and* longer than another now replaces it, read at the
lower rep count. Your Back goes from **70 to 114 lbs** on that fixture, seated at "85×6". And your
caveat is in there too: heavier but *shorter* doesn't supersede, because that genuinely isn't
something you can assume.

**Your version beat mine.** I'd proposed reading everything at 8 reps. Yours reads it at the rival's
rep count, which gets a higher number *without* costing confidence — and on your own 80×15 example
mine gave 110 where yours gives 124. Mine was throwing away real information.

**Three attempts failed before one worked, and the third failure is the one worth knowing.** I first
put the rule where sets become evidence, which is before the safety checks. That version **disabled
the typo protection**: a mistyped 2050 lb bench dominates every real set, drags them all up to its
weight, and then nothing disagrees with it — so a single typo read as Elite. Moving the rule to run
*after* the screening fixed it. There's now a test that logs a fake 2,050 lb set specifically to keep
that from coming back.

**What moved:** four of twelve muscles on the demo year, all upward, between +10% and +17%. Two
confidence figures drop slightly, because the sets it now seats sit further apart — less agreement is
less confidence, and I'd rather it said so.

**Still not done, and it's the bigger one:** your whole Back number rests on three sets. Using every
set you've logged, weighted by how believable each is, is the real accuracy work.

## 2026-09-20 (fourth pass) — "it still says 55x6", and you were right again

The fix I shipped was half a fix.

I checked the live site first, and the code really was deployed — which ruled out a stale cache and
pointed at your data instead. So I rebuilt your case properly, and the detail that mattered was one
you'd already told me and I hadn't used: **"my third set"**.

The app collapses each exercise-day down to one set *before* the rule I added ever runs — and it
picks that one set using the same formula, which still ignores weight. On the day you pulled 85×12
you opened with 65×8. The 8-rep set won the day on rep count, and your heavy set was thrown away one
step earlier than I was looking. My "fix" moved your fixture from 122 to **96 lbs** — it made it
worse, and passed every test I had.

The rule now runs in both places. Your case comes out at **122.5 lbs, from 85×8** — your 85×12 read
back at 8 reps, which is the rep count of the set it beat.

**Two things I'd want you to know:**

The demo data never produces this shape — a heavier set with *more* reps later in the same session —
which is exactly why the half-fix looked green. There was no test covering your situation until I
wrote one from your own description. That's on me: you told me it was your third set in the first
message, and I tested it as a single set.

And the thing that found it both times was you looking at your own screen. The tests agreed with me
twice while the app was wrong.

## 2026-09-20 (fifth pass) — where the 45% came from

Nowhere. That's the answer.

I traced it: the numbers were typed by hand into the code and nothing anywhere justified them. No
tool produced them, the research file doesn't contain them, and the comment above them cites research
only for the general shape — that accuracy gets worse above ten reps. Six numbers deciding which of
your sets speaks for a muscle, none of them measured.

Worse, they were cliffs. Going from ten reps to eleven cost a set 36% of its weight. Nine to ten cost
nothing at all. One rep could matter more than the previous four combined, at boundaries somebody
picked.

**You were wrong about one thing, though.** All rep counts shouldn't be equal — the research is
fairly clear that a 5-rep set predicts a max better than a 12-rep one, across a few studies with real
sample sizes. The preference was right. The sizes of it were invented.

**And what you asked for next has a name.** "Count almost the same, unless there's already good data
that agrees" is inverse-variance weighting, and you described it from scratch. The app already does
exactly that for its conversion ratios. Rep counts were the last input still running on a guess.

**So that's what I built.** The uncertainty of a rep count now comes from measuring how much the
seven published 1RM formulas *disagree* with each other at that rep count — seven authors, not me.
It's 0% at one rep (nothing is being converted), 3% at eight, 6% at twelve, 10% at fifteen. Smooth,
no cliffs.

Then it's combined with the uncertainty already tracked for the exercise itself, and this is where
your rule appears on its own:

- On a **machine**, where converting to a standard lift is already guesswork, a 12-rep set carries
  **86%** of an 8-rep set's weight — almost the same, because reps aren't what the doubt is about.
- On the **key lift**, where the conversion is exact, it carries **57%** — there the rep count *is*
  the doubt, so the low-rep set genuinely adds precision.

The old ladder said 53% for both, blind to which situation you were in.

I also removed the filter that was throwing high-rep sets out before they could compete at all.

**One thing I didn't build, deliberately.** You argued a 12-rep set is good evidence of a *minimum* —
you can't do fewer reps than you did. You're right about the mechanism. But adjusting a recorded set
upward is the exact move this project refused once before, in writing, because it's the only thing
that can make you stronger on paper than what you actually lifted. That one's your call, not mine.

## 2026-09-21 — "85x6 instead of 85x12"

> *"it still says 85x6 instead of 85x12 like we talked about on the muscle group 'from:'"*

**Right again, and it's a mess I made yesterday.**

The number is fine. When a heavier, longer set beats a lighter one, the app deliberately reads it
*short* — your 85×12 counted as 85×6 — because twelve reps at 85 certainly includes six at 85, so
the smaller number is the half it can actually prove. That's what makes it fair rather than
generous, and none of it changed today.

What went wrong is the line underneath. That row ends up carrying the heavy set's **weight** and the
light set's **reps and date**, and the "from" line just printed all three. So it read *85 lbs×6, 24
Aug* — the weight from one set, the reps and the day from another. A set you never did, on the one
line that's supposed to say exactly what you lifted.

It was worse than what you saw, too. On the test data the same line read *"225×1, Aug 15"*.

**Fixed**, and in four more places printing the same splice — the caveat right below it (which had
started disagreeing with the line above it), two lines on the Goals screen, and a friend's best
lifts. Your friends' copies carry it now as well, or their screens would show the fake set while
yours showed the real one.

**One thing worth knowing**, because it's the obvious next question: the line now says 85 × 12, but
the estimate behind it is still the conservative 85 × 6 reading. So if you work out 85 × 12 by hand
you'll get a bigger number than the panel shows. That's the rule doing its job. I haven't put
anything on screen saying so — that's your call.

Everything green, 5,693 checks. Pushed.

## 2026-09-21 (second pass) — the "from:" columns, and two things I found instead

**The table is in.** Three columns normally — exercise, weight×reps, date — and a **More details**
button that adds two more: what that one set alone would call the muscle, and how much of the final
number it's responsible for. Each column its own colour.

**Your example doesn't come out where you expected, and that turned out to be the best argument for
the feature.** Contributions of 130, 140 and 155 don't average to 138 — they come out at **133.9**,
because the shares are 67% / 29% / 4%. The blend leans hard on whichever reading it trusts most, so
the answer sits near the *lowest* number, not the middle. Without that column it looks broken.

Two small calls I made inside your ask, both easy to reverse:

- I called the last column **Influence** rather than Confidence. The panel already has a confidence
  line three rows up measuring something different, and two things called confidence that disagree
  is worse than a new word.
- The **More details** button is its own thing, not the More details switch in Settings. That one is
  your call about the percentile being harsh; wiring them together would mean hiding percentiles
  also hides the working.

**On the calves.** The two sentences contradicted each other because one is simply wrong — calves
has had a published standard all along. What actually happened: your sets were over 15 reps, and the
app throws those away *before* it records that it threw anything away. So the volume counter sees
them and the rating doesn't, and the panel falls back to the wording written for the neck.

It's not a calves problem. All twelve muscles do it, and lateral raises at 15–20 are the most common
way anyone trains shoulders. There's also a live bug next to it: a friend's page offers you a
"Benchmark Standing Calf Raise" button, which is *your* benchmark screen, on their body.

**On the neck** — the app has been saying something untrue. It claims in four places that nobody
publishes neck standards. They exist. But the women's data is 16 and 55 people and says heavier
women should lift *less*, so I'm not recommending we build on it. Correcting the false sentences is
free and worth doing.

Neither of those is built — you said plan only. Both are written up.

Everything green, 5,730 checks. Pushed.

## 2026-09-22 — the female muscle map

**Tim:** *"I just created 2 new images for the muscle maps… If the user puts their gender as female
instead of male, I want you to display their muscle groups with this new image rather than the
current male image. Make them function identically to the male display. Remember the outlines of the
muslce groups laste time had issues with how smooth they were and stuff like that so make sure that
doesn't happen when you outline it this time."*

Done and pushed. Set your profile to female and the map draws your figure instead — same thirteen
muscles, same tapping, same colours, same everything.

**On the outlines** — they came out clean first try, and there's a reason beyond luck. The bumpiness
last time came from reading a JPEG, where the edge between two colours wobbles a pixel or two on
every row. Your new images are PNGs with clean white lines, so there was much less to iron out. I
reused the exact same smoothing and tracing code rather than writing new code for the new figure,
which is the other half of it.

**Two things your new drawing does that the old one doesn't**, both of which I had to handle:

The back figure's feet have a tiny gap in the outline, and the app fills the body by "pouring paint
in from outside and seeing where it can't reach". Paint got into both feet through the gap. That
doesn't show up as a hole — it shows up as *a figure with no feet*, looking completely deliberate.
Sealed, and there's now a check that shouts if it ever comes back.

And on the front, there's no line where the shin meets the foot, so they're one region as far as the
app is concerned. The old drawing didn't need this because you simply didn't colour the feet in. I
put a cut at the ankle by hand. At the size the map actually draws, you can't see it.

**One thing worth knowing:** a friend's map uses *their* sex, not yours. So does their volume figure,
and each side of the compare screen — which now shows a woman and a man side by side as two different
bodies. That felt like what "function identically" meant.

Two things I'd expect you to notice: the female figure fills the whole shin where the male one only
colours the muscle bellies, and its hands sit further out from the body. Both are the drawings, not
the code.

Everything green, 6,239 checks, and I drove it in Chrome across six screens.

**Tim:** *"prepare md files for chat reset."*

Done. Most of it was already written as I went, but two things needed doing.

**The other agent shipped a Research rewrite and updated none of the notes.** Nineteen topics in five
sections with facets, where every file said eleven flat topics. I corrected the counts and pointed at
their own write-up, but I didn't document their feature — it isn't mine and I'd only be guessing at
what they meant. Their code comments still say eleven too; I left those and wrote down that I left
them. The wider lesson is now at the top of progress.md: checking `git log` since the last session is
part of catching up, because the repo moves while nobody's here and the notes don't move with it.

**And progress.md was 936 bytes from full**, which is where the last few resets have started and why
the previous one kept tripping the size check. I collapsed three days and cut the render-test row
from 8 KB down to the part that's actually a lesson, moving that into the handbook where someone
would look for it. There's about 7 KB free now — a session or two of room.

Everything still green, 6,239 checks.

---

## 2026-09-23 — calves and neck join the rankings

**Tim:** *"okay seems like youre ready to make calves and neck join the muscle group rankings just
like all the other muscles. Just do it no matter what. I know the research isn't great, but do
whatever you can to make it work with what you have."*

Two different problems wearing one complaint.

**Calves already had a standard.** What was wrong is that any set over 15 reps got thrown away as
evidence and left no record that anything had been refused — so the panel saw nothing and printed
the sentence written for a muscle nobody publishes standards for. The muscle map now reads up to 25
reps and prices what it admits: a 25-rep set counts for about a tenth of a 15-rep one, and the
discount comes from the measured disagreement between the seven published formulas rather than from
a number I picked. Everywhere else — his charts, his best lifts, the progression advice, the
comparison screen — still stops at 15, because those print one number and have nothing to pay for a
long set with. Above 25 the refusal finally says so, and the hatch now tells him which kind of
refusal it was: "no set we can read a max from" is cleared by one heavier set, where an unmeasured
body-weight fraction is cleared by nobody.

**The neck had a published page the whole time** — Strength Level publish neck curl and neck
extension, just not linked from their index — and this app had "nobody publishes neck norms" written
into four places as a permanent fact. The men's numbers are theirs as published. The women's are
not: their women's table is 55 people and asks a heavier woman to lift less in every column, so the
women's row is the men's scaled by the male/female ratio a 2017 clinical study measured on 157
people, and every neck rating says on screen that it was scaled rather than published.

**What he should expect to see, and he was told all of it before authorising it:** the neck reading
is flat — almost everyone lands near Intermediate, because that page's Elite is 38.8× its Beginner —
and his calves will read a bit higher than before if he trains them in the 16–25 range.

Two things I found and did not build: the demo now has no hatched muscle at all (its neck curl was
the only one), and a lifter with *nothing* rated who only does long sets still sees "Nothing to rank
yet" with no figure at all.

I also broke the project's own no-scripted-edits rule once, on a test file, and had to put the line
endings back.

All 23 suites green, 6,303 checks, driven in Chrome at phone and desktop widths.

---

## 2026-09-24 — the detail panel gets its five columns on a laptop

**Tim:** *"On the laptop/computer, the muslce groups section allows for a little more space. Could
you make the details on the right side a little wider so that you don't need to click 'more details'
to see the other things? Keep the version the same on the phone to conserve space."*

Done. On a laptop the two extra columns — the estimate each lift alone would give, and how much of
the final number it bought — are just there, with their headings, no click. The button stays so you
can still collapse them. The phone is exactly as it was.

The interesting part is what the first attempt did. The obvious version widens the panel at the same
860px where the panel moves beside the figure, and when I measured it at an 880px window the body
had shrunk to 298px wide against a 320px panel — narrower than the panel next to it — with the
exercise column squeezed so hard that "Barbell Bench Press" was wrapping inside 59 pixels. The rule
this project already had for that is that content doesn't shrink because you asked it a question,
and on that screen the body is the content. So the extra width and the extra columns now both start
at 1024px instead, and nothing at all changes between 860 and 1023. Across the breakpoint the figure
does step down once, 501px to 422px, to pay for the panel — still bigger than it is at any narrower
window.

One thing that fell out of it: a test in the suite had been passing for the wrong reason. A block
taps that button twice to check it opens and closes, and its comment said it was putting the state
back where the rest of the suite expected it — but two taps leave an explicit "no", not "nobody has
chosen", and the whole file shares one copy of that state. It never mattered until the default
started depending on the window width. Fixed, and the default is genuinely tested now.

23 suites green, 6,315 checks, driven in Chrome at six widths with no sideways overflow at any of
them.

---

## 2026-09-25 — a set was losing its seat to a truncated copy of itself

**Tim:** *"I have some concerns with the 1RM estimation. For example, I did 55x9 on the machine
shoulder press, but it estimates (just from that set) that my overhead press 1RM is 57 … Does this
concern you or do you think that's accurate?"* Then: *"Start the fixing now."*

It concerned me. He'd found two things with one number.

The app was never claiming nine reps equals one. It read 55×9 as an 81 lb max on the machine, then
divided by 1.23 because people press more on that machine than overhead with a bar — which should
give 66, not 57.

The missing 9 lb was a bug, and it was the one he reported in August coming back through its own fix.
When a set beat another on both weight and reps, the app used to rewrite the weaker set into the
stronger one "read at" the weaker set's rep count — and that made-up set then competed against the
real set it came from, and won, because the seat comparison rewards low reps. So 55×9 on its own read
66, but 55×9 followed by 55×5 read 56.6. Doing more work made you look weaker. It was affecting 20 of
the 29 muscle seats in the demo year.

Then, re-baselining, I found the worse half nobody had spotted: that rewrite kept the *weaker* set's
date while taking the *stronger* set's weight. So an old heavy set could wear a recent set's date and
be read as fresh — a stale personal best refreshing its own recency for ever. Three muscles were
being propped up by that, and they go down now.

The fix is that a beaten set is simply dropped instead of being rewritten. Nothing gets invented any
more. Ten muscles went up (calves 14%, neck 25%), three went down, and every observation count stayed
identical, which is what says this dropped duplicates rather than evidence.

**The other half of his question I looked at and did not build.** The machine-to-barbell conversion
uses one number where the published data runs 0.89 for a beginner to 1.44 for an elite, so his
reading lands below the beginner overhead-press standard while his machine number is above the
beginner machine standard. The data to fix it properly is already in the repo — 115 exercises with
full tables — but it's a second re-baseline of every number in the app, and doing two in one commit
means neither can be attributed. That one's his call.

Also fixed the laptop panel from yesterday, which he reported as worse rather than better: it was
sitting 186px off the right edge because of a page-wide reading-width cap, and the table was 12.5px
with a 9.5px header against 15.5px body text. Now flush to the edge and legible, phone untouched.

23 suites green, 6,318 checks.

---

## 2026-09-26 — what other apps have, and Tim sets it aside

Caught up with the notes; nothing had moved since the last session.

Then Tim asked what other workout apps have that his doesn't. That's the one review the notes had
deliberately pinned, because its likely output is a list of things other apps do. I said so in a
sentence and ran it anyway: research agents over Hevy, Strong, Alpha Progression, Boostcamp,
Liftosaur, Jefit, Fitbod, RP, Juggernaut and Caliber, plus a few hundred real App Store reviews.
Reddit was blocked, though two agents got to it through an archive.

The short version of what came back. His app already does several things users are asking the big
apps for — offline logging, per-side weights, assisted lifts charted properly, a volume body map you
can tap into, a chart on a real time axis — and holds the one position nobody else does: showing how
uncertain a strength number is. What it lacks, which he called small or not-yet: stall detection, a
recap, push/pull balance, per-muscle frequency, an LLM export. And bigger: a programme generator,
exercise demonstrations, training blocks, knowing what equipment your gym has, health-app sync, and
a watch app it can't have as a website.

One finding is a firm "don't": volume targets built on MEV/MRV. Those landmarks have no footprint in
the research literature, RP itself calls them averages from coaching experience, and recent trials
found no benefit to ramping volume and no harm from overshooting it. The app's refusal to draw
targets was right.

I corrected myself in front of him several times, mostly by passing on one researcher's finding
before the next one landed. Lesson taken: wait for the lot, then summarise.

He asked for the summary shorter, then plainer. Then: "okay forget the improvements from other apps.
I want to build it myself." Dropped. Then prepared the notes for a reset.

---

## 2026-09-27 · tappable notifications, the Firestore nested-array bug, partner plan, famous lifters
- **Asked:** "Never give me messages that long. Always 2-3 paragraphs max unless I ask for more
  information." · tap a kudos/comment notification to reach the workout, and "make the list of
  workouts look like the same style of the home page" · Explore Add "very unclear when it's
  officially added" + "it says there are no workouts in that system" · after a partner pull day:
  Nippard still empty, "When you swap a workout, it really creates a new one", missing suggested
  weight / % / reps · "compare can be against a friend or an influencer."
- **Decided:** notification → `#/me/workouts/<sessionId>`, no new own-session screen · adding a
  programme still doesn't make it current, but the screen now says so · reps STORED as `{lo, hi}` ·
  swap keeps only `locked || touched` sets (Open work 15 untouched) · famous lifters rated by the same
  `buildStrengthShare()`, each muscle as of its freshest lift.
- **Built:** `js/workout-card.js` (feed + profile share one card; profile list had read "0 sets") ·
  Explore Added/Remove receipt · Restore-its-workouts for empty copies · Firestore fix (`set-reps.js`,
  `preset-updates.js`, `store.js` write-generation + `ensureSystems` re-read) · partner gets the plan in
  `addPerson()` · `js/public-figures.js` (26 people, 76 sourced lifts) + `famous:<id>` compare token.
- **Verified how:** 23 no-Chrome suites, 6,371 assertions, 0 failures; a nested-array guard walks
  every collection; deployed files hash-matched HEAD. 🚨 I first told Tim his copy was fine off a
  LocalBackend repro — the wrong machine; his phone runs Firestore.
- **Open:** Tim to re-test Add + Restore on his phone · the two race fixes are untestable here ·
  Open work 15 still his · partner has no pull-up caption (no bodyweight on this phone) · famous
  lifters' arms/shoulders are converted from bench. Full write-up: `docs/history.md` 2026-09-27.

## 2026-09-21 · famous lifters at their peak
- **Asked:** "some of the influencers I found aren't being measured by the lifts they were lifting in
  their prime … really get the lifts they were doing when they were in the peak of their fitness."
- **Decided:** peak = one window (a meet or ~1–2 years) picked by relative strength; each lift carries
  its own weigh-in; same rules as before (sourced, raw, ≤12 reps, never guessed).
- **Built:** four research agents → `js/public-figures.js` regenerated: 26 people, 76 → 109 lifts, real
  meet dates. Biggest moves: Israetel to 2010–13 (9 lifts), Doucette to 2010–11, Coleman to his
  2000–03 DVDs (14 lifts), Coan's bench to 1991, Stefi/Gasparyan to Kern 2019, Jen Thompson to 2018.
  `figureRows()` reads `lift.bodyweightLb`.
- **Verified how:** 23 no-Chrome suites, 0 failures; old vs new `figureStrength()` run for all 26 —
  Israetel, Coleman, Arnold now rate 10 muscles, Martyn 6.
- **Open (Tim's call if he asks):** peak-by-relative-strength left out heavier all-time bests
  (Haack 2026, Olivares 2025, Doucette's 2017 bench, Jen Thompson's 2022 327 bench); Coan's squat/deadlift
  and Franco's squat/bench stay outside the peak (nothing raw sourced); JJW's 405 gym bench beats his
  336 meet bench.

## 2026-09-21 (second pass) · "Jeff Nippard is strongest right now"
- **Asked:** *"I'm skeptical of these numbers because Jeff Nippard is strongest right now, and the
  durrent dates say 2014-2015 … I also didn't see any other popular lifters like togi, alex eubank,
  tren twins … if you can try to find excersizes they did for muscle groups that don't have any
  recordings on, then do that. Remember our estimation calculator can estimate 1RMs for lifts you
  didn't even do as long as you did something for that muscle group."*
- **Decided:** peak now means STRONGEST IN ABSOLUTE TERMS (a filmed gym PR counts, `reported: true`),
  not strongest for bodyweight; a stated bodyweight from the period is enough (`bodyweightEstimated`);
  hunt one sourced set per muscle group, because the estimator converts within a muscle.
- **Built:** six research agents → 26 → **47 people, 213 lifts**, average 7.1 muscles each. New:
  Sulek, Laid, both Tren Twins (surname **Gaiera**, WRPF meet results), O'Hearn, Heria, Guzman,
  N. Walker, Lunsford, Cutler, Yates, Platz, Hall, Shaw, Hooper, Licis, Toomey, Fisher, Ence,
  MacDonald, Buttermore. Nippard now 2021–2025, Haack/Atwood/Olivares on their heaviest meets,
  Coleman 15 lifts, Larry Wheels 8.
- **Verified how:** 23 suites, 0 failures (render's famous-summary assertion now reads the years off
  `figureSummary()` instead of pinning "2014–2015 · 161 lb").
- **Dropped by hand:** Rich Piana (stat-site numbers only, no video, no year) · carries and holds
  (a distance event has no rep count).
- **Open:** Togi, Alex Eubank, Noel Deyzel, Jeff Seid, Joey Swoll, Whitney Simmons, Krissy Cela,
  Sydney Cummings **still unsourced** — their numbers are spoken in videos and YouTube blocked
  transcript downloads for hours; the existing seven women never got their accessory pass (agent hit
  the weekly usage limit). Traps/Forearms/Calves/Neck are still empty for most people.
