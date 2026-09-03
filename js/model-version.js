// The version of the strength MODEL a stored number was computed under.
//
// Written 2026-09-13 (docs/strength-accuracy-plan.md §2.9). A goal freezes a target weight in
// pounds, computed from that day's ratio table, medians and spreads. When any of those change —
// and on 2026-09-13 all three did — a frozen weight no longer means the level it was named for,
// and the progress screen would report the revision as training. So a goal is stamped with this
// string when it is set; on mismatch the Goals screen says so and offers to re-freeze
// (js/goals.js, js/views-goals.js).
//
// BUMP THIS whenever js/muscle-evidence.js's RATIOS, js/strength-standards.js's medians or
// spreads, or js/e1rm.js's curve change in a way that moves a number. A date plus a letter.
export const MODEL_VERSION = '2026-09-13a';
