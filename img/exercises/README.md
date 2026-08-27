# Exercise pictures

Empty on purpose. The feature that shows these is built and tested; the art is a
purchase.

## Adding pictures

1. **Name each file for the exercise's ID**, not its name:

   ```
   img/exercises/barbell-bench-press--chest.webp
   img/exercises/leg-press--quads.webp
   ```

   The id is `slugify(name) + '--' + slugify(muscle)` from `js/exercises.js`.
   ⚠️ **The muscle half is not decoration** — `Cable Kickback` exists twice in
   the library, once for Triceps and once for Glutes, and the id is the only
   thing that tells them apart.

   To print every id and its name:

   ```bash
   node --input-type=module -e "const {BUILT_IN_EXERCISES:E}=await import('./js/exercises.js'); \
     for (const e of E) console.log(e.id.padEnd(46), e.name)"
   ```

2. **Run the generator.** It rewrites the manifest in `js/exercise-images.js`
   and the precache list in `sw.js`:

   ```bash
   node tools/build-exercise-images.mjs
   ```

   It refuses a file whose name is not an exercise id rather than skipping it
   quietly — a picture that never appears because the filename was wrong looks
   exactly like a picture that was never bought.

3. **Commit the images and both generated files.**

`webp`, `png`, `jpg`, `svg` and `gif` are accepted. `webp` is the smallest for
this kind of artwork and every browser this app supports reads it.

## Where the art comes from

⚠️ **The style Tim wants is Gym Visual's**, which is a paid stock library —
under $0.75 an illustration in bulk, and the licence permits use in a commercial
app or website with no attribution and no royalties. **It cannot be taken from
sites that re-host it**: the largest public dataset that does says in its own
licence *"obtain your own license there before reusing the media."*

The only openly-licensed set covering a whole library is **Everkinetic**
(CC BY-SA, 289 exercises) — black-and-white line art with no muscle
highlighting. It is a different thing, and using it would need a credit line in
the app.

This is the second licensing wall this project has hit on somebody else's
anatomy art. `docs/research.md` §11 records the first: a watermarked Dreamstime
asset that could not be used, which is why the body map is hand-authored.
