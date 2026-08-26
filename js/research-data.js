// Research — the published data behind the Research tab (Tim, 2026-08-28:
// "I'm really curious about where some of our information is coming from and
// how the site does its calculations, as well as displaying just useful
// research on these topics.")
//
// Pure: no DOM, no store. Same reason as e1rm.js.
//
// ── AGE vs STRENGTH, PER MUSCLE GROUP ────────────────────────────────────────
//
// ⚠️ WHY THIS IS NOT DRAWN FROM STRENGTH LEVEL, though everything else in the
// app's standards is. SL publishes by-age tables for every lift — and they are
// ONE shared age model applied to every exercise. Checked 2026-08-28 across
// three lifts as different as bench press, deadlift and wrist curl: normalised
// to their peak, the three "curves" agree to within rounding at every age
// (85.4/85.3/85.6 % at 15; 39.2/39.1/38.9 % at 90). Drawing eleven lines from
// that source would be drawing the same line eleven times and labelling the
// copies as if they were findings. The app's own age grading
// (strength-standards.js ageCoefficient — McCulloch/Foster) is the same kind
// of thing: one curve for all lifts, from powerlifting age-grading tables.
//
// So the per-group curves come from the one study that measured every major
// muscle group in the same people on the same machine:
//
//   Harbo T, Brincks J, Andersen H. "Maximal isokinetic and isometric muscle
//   strength of major muscle groups related to age, body mass, height, and
//   sex in 178 healthy subjects." Eur J Appl Physiol 112:267–275 (2012).
//   DOI 10.1007/s00421-011-1975-3. 93 men and 85 women, ages 15–83, Danish,
//   non-athletic, Biodex System 3 dynamometer.
//
// ⚠️ THE NUMBERS BELOW ARE THE STUDY'S TABLE 5 — measured MEANS by age band,
// not its regression models. The regressions are straight lines by
// construction; the bands are what the people in each decade actually
// produced, which is the thing worth showing. Each band is plotted at the mean
// age of its members (given in Table 5's footnote), which is also what bounds
// the x axis: the youngest male band averages 24 and the oldest 74, so the
// male lines span 24–74 and NOT the 15–83 of the most extreme individuals —
// "only display data from people it has solid evidence from" (Tim's spec).
//
// ⚠️ ISOKINETIC PEAK TORQUE (60–90°/s), NOT 1RM. A dynamometer measures the
// joint's maximal turning force; nobody has measured 1RM bench press in a
// random population across six decades. Normalised to % of the strongest
// band, torque is the honest available proxy for how strength moves with age.
//
// Test-to-muscle-group mapping, stated because two are not obvious:
//   "Ankle flexion" is PLANTAR flexion (pushing down — the calf): its male
//   mean is 112 Nm against dorsiflexion's 33, and only calves produce that.
//   "Hip extension" carries Glutes, the same call MUSCLE_LIFTS makes for the
//   deadlift and for the same reason.
//
// ⚠️ THREE RANKABLE GROUPS ARE NOT HERE — Chest, Back, Traps — because the
// study has no pressing, rowing or shrugging movement, and no other study
// measures those in a general population across ages. They are listed in
// NOT_COVERED so the screen says so; inventing curves for them is exactly
// what this tab exists not to do.

// Mean age of each band's members, from Table 5's footnote.
export const AGE_BANDS = {
  male: [24, 34, 45, 55, 64, 74],
  female: [25, 35, 44, 56, 63, 73],
};

// Measured mean peak torque (Nm), isokinetic, by band — Table 5.
export const HARBO_TORQUE = {
  male: {
    Quads:      [215, 212, 192, 179, 166, 146],   // knee extension
    Hamstrings: [106, 96, 94, 106, 91, 72],       // knee flexion
    Glutes:     [197, 202, 175, 192, 172, 128],   // hip extension
    Calves:     [128, 118, 112, 120, 105, 83],    // ankle (plantar) flexion
    Shoulders:  [57, 67, 63, 62, 57, 49],         // shoulder abduction
    Biceps:     [52, 55, 54, 56, 50, 39],         // elbow flexion
    Triceps:    [43, 52, 49, 49, 46, 40],         // elbow extension
    Forearms:   [21, 24, 24, 24, 22, 17],         // wrist flexion
  },
  female: {
    Quads:      [138, 145, 127, 118, 101, 92],
    Hamstrings: [76, 67, 58, 60, 49, 48],
    Glutes:     [151, 149, 125, 121, 126, 101],
    Calves:     [89, 89, 74, 77, 67, 52],
    Shoulders:  [42, 40, 37, 39, 32, 31],
    Biceps:     [30, 30, 28, 28, 24, 23],
    Triceps:    [28, 30, 27, 26, 26, 27],
    Forearms:   [13, 14, 14, 13, 12, 14],
  },
};

export const NOT_COVERED = ['Chest', 'Back', 'Traps'];

export const AGE_SOURCE = {
  title: 'Harbo, Brincks & Andersen (2012), Eur J Appl Physiol 112:267–275',
  url: 'https://doi.org/10.1007/s00421-011-1975-3',
  what: 'Measured means by age group (their Table 5), isokinetic peak torque',
  n: { male: 93, female: 85 },
};

/**
 * The chart's series: one per covered muscle group, each point a band's mean
 * expressed as % of that group's own strongest band.
 *
 * ⚠️ NORMALISED WITHIN THE GROUP, which is the whole trick of the chart: it
 * removes "quads are stronger than forearms" (true, enormous, and not the
 * question) and leaves "how does each group's strength move with age", which
 * is the question. 100 % always means "this group's best decade", so the
 * lines are comparable even though newtons of knee torque and wrist torque
 * are not.
 */
export function ageStrengthSeries(gender = 'male') {
  const g = gender === 'female' ? 'female' : 'male';
  const ages = AGE_BANDS[g];
  return Object.entries(HARBO_TORQUE[g]).map(([muscle, values]) => {
    const peak = Math.max(...values);
    return {
      muscle,
      points: values.map((v, i) => ({
        age: ages[i],
        pct: Math.round((v / peak) * 1000) / 10,
        nm: v,
      })),
    };
  });
}

/**
 * The app's own grading curve, over the same x range, for the reference line:
 * relative strength is 1/ageCoefficient, normalised so the 23–40 plateau is
 * 100 %. Drawn dashed and grey because it is not a data series — it is what
 * the app ASSUMES, shown against what one study MEASURED.
 */
export function appGradingCurve(ageCoefficient, fromAge, toAge) {
  const out = [];
  for (let age = fromAge; age <= toAge; age += 1) {
    out.push({ age, pct: Math.round((100 / ageCoefficient(age)) * 10) / 10 });
  }
  return out;
}
