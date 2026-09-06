# Being Strong Tracked Cancer Mortality; Reporting That You Lift Did Not — One NHANES Analysis

**Source:** Barbell Medicine, "Strength & Cancer-related Mortality: Is it enough to exercise, or do you actually need to get strong?" ([read](https://www.barbellmedicine.com/blog/strength-cancer-related-mortality-is-it-enough-to-exercise-or-do-you-actually-need-to-get-strong/)) · Austin Baraki · 2021-07-23 · 2,078 words
**Topic:** Health & medicine

## Bottom line
- **This is a review of one observational paper**: Dankel et al. 2018, an analysis of **2,773 NHANES participants aged ≥50** (50.4% female, 58% non-Hispanic white) from the 1999–2002 cycles, followed for cancer-specific mortality via the National Death Index.
- **The headline contrast.** Top quartile of **knee extensor strength** vs the rest: 32/699 (4.5%) cancer deaths against 130/1,944 (6.6%) — a **53% risk reduction** minimally adjusted and **50%** fully adjusted. Self-reported **muscle-strengthening activity** gave 6% and 8% reductions, **neither statistically significant**.
- **Per-unit effect:** for every 15 N of knee extension strength, HR 0.95 (95% CI 0.91–0.99) in men and HR 0.92 in women.
- **Population attributable fraction: 20.9%** — on the paper's assumptions, about one in five cancer deaths is attributable to *not* being in the top quartile for strength. This is a causal counterfactual computed from observational hazard ratios.
- **The article's thesis — "it is not enough to exercise, you must actually get strong" — is not established by this design.** The strength exposure was measured with a dynamometer; the activity exposure was a two-question self-report about the previous 30 days. Comparing a precise measurement against a crude one systematically favours the precise one, and the article does not draw that inference.
- **The background sarcopenia material is the solid part.** Muscle loss is present at *all* stages of cancer, not just end-stage cachexia, and it is under-recognised early.

## The study, in its own terms

**Exposures.** Lower-extremity strength came from an isokinetic dynamometer: three warm-up reps, then three maximal isokinetic contractions at 60°/s, with the gravity-corrected peak taken. Engagement in strengthening activity came from two NHANES questions — whether, in the past 30 days, the respondent did "any physical activities specifically designed to strengthen your muscles, such as weight lifting, push-ups, or sit-ups," and how many times. **Eight or more sessions in the month** (about twice weekly) counted as engaged. Only **382 people (13.8%)** cleared that bar; 1,009 (36.4%) met aerobic guidelines.

**Adjustment** was extensive: age, race, sex, self-reported aerobic activity, total cholesterol, mean arterial pressure, BMI, C-reactive protein, smoking, use of ambulatory aids, statins, arthritis, congestive heart failure, coronary artery disease, prior cancer, diabetes and stroke.

**Robustness checks the paper ran.** No interaction was found between strength and age, sex, baseline cancer history, body mass or aerobic activity. Excluding the 394 participants ever diagnosed with cancer, the association held: **HR 0.43 (95% CI 0.22–0.84)**. Flipping the analysis to compare the *bottom* quartile against the upper three quartiles, the result was **no longer significant**.

## Where the interpretation outruns the design

**The measurement asymmetry is the central problem, and it is unaddressed.** A once-measured continuous physiological variable will beat a 30-day binary self-report on almost any outcome, purely through differential measurement error and the resulting attenuation of the self-reported exposure toward the null. That mechanism alone can generate the article's headline contrast without any of the biology it claims. Baraki lists self-report as a limitation but does not connect it to the conclusion built on top of it. With only 13.8% of the sample classified as engaged, the null on activity is also badly underpowered.

**A non-significant flipped analysis is not evidence of no effect.** The bottom-quartile-versus-rest comparison uses a smaller contrast and fewer events; failing to reach significance there does not establish that "simply avoiding the bottom quartile is not enough," which is how the article reads it. That is interpreting a null as a finding.

**The PAF assumes what the design cannot show.** "One out of every five cancer deaths could have been averted" is stated as theoretical, and the word is doing a lot of work: population attributable fractions computed from observational hazard ratios inherit every unmeasured confounder in the model. Strength at age 50+ is a good marker of general physiological robustness, and reverse causation from subclinical disease is only partly handled by excluding people with a prior diagnosis.

**Confidence interval typo.** The women's per-15 N result is printed as "HR 0.92, 95% CI 0.86-0.91" — an interval that excludes its own point estimate and cannot be right. Treat the upper bound as a transcription error; the direction and the men's figures are internally consistent.

**A citation with no home.** The opening claim about new cancer therapies delivering "small, incremental survival benefits… at great cost" links to Prasad 2015 in *Blood*, which does not appear in the article's reference list at all. And Ruiz et al. is labelled "Ruiz 2010" in the prose while the paper is *BMJ* **2008** — a mislabel, not a mis-attribution; the paper does report cancer mortality alongside all-cause mortality in men, so it supports the sentence it sits on.

## What the article gets right

The clinical framing is genuinely useful and better sourced than the headline. **Cachexia is well recognised by oncologists; sarcopenia in earlier-stage disease is not** — and the numbers he brings are concrete: Burden 2010 found **54% of newly diagnosed early-stage colorectal cancer patients** had handgrip strength below 85% of the age-matched reference; Cao 2010 found **714 newly diagnosed patients carried on average 0.9 kg less muscle** than healthy controls *before* any treatment began. The mechanism offered — tumour-derived inflammation, drug effects, inactivity and malnutrition combining into **anabolic resistance**, a blunted response to a given dose of protein or exercise — is standard and correctly labelled as complex.

He is also explicit about what is unknown: the mechanisms linking strength to cancer outcomes "remain poorly understood," and **"exactly how strong is strong enough… remains unknown"** and may be individual. That is the right confidence level for the practical question a reader actually has.

**Recommendation versus evidence.** The recommendation — start resistance training and nutrition support **early**, before anabolic resistance progresses to refractory cachexia, and titrate the dose over time — is clinical judgement. Its supporting citations are a narrative review of resistance exercise reversing cancer-induced anabolic resistance (Montalvo 2018) and a supplement review on protein and activity in advanced cancer (Antoun 2018), not trials with mortality endpoints. The closing line, "we can still feel confident in recommending strength training interventions to patients with cancer to reduce their risk of mortality," is a stronger claim than one observational analysis supports, and it is offered as clinical confidence rather than as a finding.

He also flags a real complication most such articles skip: **response to training varies widely between people** (Ahtiainen 2016), so someone starting weak and responding poorly could remain in the high-risk group despite doing everything asked of them.

**Sells:** nothing. No product, template or consultation is pitched.

**Related in this library:** `sarcopenia-symptoms-prevent.md`.

## References

**No numbering to repair — there was none.** The article carries a nine-entry reference list at the bottom with no in-text numbered markers pointing into it. However, it cites by **named inline link in the prose** throughout ("Burden 2010", "Cao 2010", "Montalvo 2018"), so claim-level attribution is available by name, and the groupings below use those named links rather than any numbering.

**The paper under review**
- Dankel SJ, Loenneke JP, Loprinzi PD. Cancer-Specific Mortality Relative to Engagement in Muscle-Strengthening Activities and Lower Extremity Strength. *J Phys Act Health* 2018;15:144-149. [PMID 28872397](https://pubmed.ncbi.nlm.nih.gov/28872397/)

**Sarcopenia and muscle dysfunction are present early, not just at end stage**
- Burden ST, Hill J, Shaffer JL, Todd C. Nutritional status of preoperative colorectal cancer patients. *J Hum Nutr Diet* 2010;23:402-7. [PMID 20487172](https://pubmed.ncbi.nlm.nih.gov/20487172/) — *the 54% low-handgrip figure*
- Cao DX, Wu GH, Zhang B, et al. Resting energy expenditure and body composition in patients with newly detected cancer. *Clin Nutr* 2010;29:72-7. [PMID 19647909](https://pubmed.ncbi.nlm.nih.gov/19647909/) — *the 714 patients, 0.9 kg muscle deficit*
- Christensen JF, Jones LW, Andersen JL, Daugaard G, Rorth M, Hojman P. Muscle dysfunction in cancer patients. *Ann Oncol* 2014;25:947-58. [PMID 24401927](https://pubmed.ncbi.nlm.nih.gov/24401927/)
- Tisdale MJ. Cachexia in cancer patients. *Nat Rev Cancer* 2002;2:862-71. [PMID 12415256](https://pubmed.ncbi.nlm.nih.gov/12415256/) — *cited for end-stage cachexia specifically*

**Strength as an independent predictor of mortality**
- Ruiz JR, Sui X, Lobelo F, et al. Association between muscular strength and mortality in men: prospective cohort study. *BMJ* 2008;337:a439. doi:[10.1136/bmj.a439](https://doi.org/10.1136/bmj.a439) — *labelled "Ruiz 2010" in the article*

**Resistance training against anabolic resistance, and its limits**
- Montalvo RN, Hardee JP, VanderVeen BN, Carson JA. Resistance Exercise's Ability to Reverse Cancer-Induced Anabolic Resistance. *Exerc Sport Sci Rev* 2018;46:247-253. [PMID 30001273](https://pubmed.ncbi.nlm.nih.gov/30001273/) — *a review, not a trial*
- Antoun S, Raynard B. Muscle protein anabolism in advanced cancer patients: response to protein and amino acids support, and to physical activity. *Ann Oncol* 2018;29:ii10-ii17. [PMID 29506227](https://pubmed.ncbi.nlm.nih.gov/29506227/)

**Between-person variability in training response**
- Ahtiainen JP, Walker S, Peltonen H, et al. Heterogeneity in resistance training-induced muscle strength and mass responses in men and women of different ages. *Age (Dordr)* 2016;38:10. [PMID 26767377](https://pubmed.ncbi.nlm.nih.gov/26767377/)

Cited in the prose but absent from the article's own list: Prasad 2015 (*Blood*, on the cost-effectiveness of new cancer therapies), plus CDC and WHO mortality statistics pages.
