# Exercise Demo Stills — generation recipe

> **Status:** 61/62 exercises covered · generated 2026-08-10 · ~57 credits
> **Shipped assets:** `public/exercise-demos/<exercise_id>.jpg` (720px, ~56 KB each, 4 MB total)
> **Lookup:** `src/data/exercise-demos.ts` — filename must equal the exercise id

## What these are

Two-panel start/end position diagrams, rendered as a featureless amber artist's
mannequin on the app's navy background. Generated with Higgsfield → **GPT Image 2**
at 0.5 credits each.

**They are demos, not coaching.** They were reviewed by eye, not by a coach. AI
image models get joint angles approximately right at best — squat depth lands at
parallel when asked for below, bar paths drift. Good enough to answer *"which
movement is this again?"* at the rack. Not good enough to learn a lift from. The
UI caption (`reference only, not a form guide`) is load-bearing; keep it.

## Source files

The 1k source PNGs (~130 MB) are **local-only** and gitignored at
`docs/03-workout-tracker/exercise-demo-refs/`. The committed 720px JPEGs are the
deliverable. If the sources are lost, regenerate from the recipe below rather
than upscaling the JPEGs.

## The recipe

Three things had to be discovered the hard way. All three are in every prompt.

### 1. Camera — off-axis, never pure lateral

A true 90° side view makes the barbell point at the camera, so the model drops
the bar entirely and leaves a floating plate with nothing gripping it. A pure
front view loses the hip/knee angles that make the diagram useful.

The working angle is **~20° off lateral**:

| Exercise class | Camera |
|---|---|
| Standing barbell/dumbbell | chest height, level, rotated ~20° toward the front |
| Lying (bench, floor press) | raised ~20° **above** bench height, rotated ~25° toward the head |
| Seated machine | chest height, rotated ~25-30° |
| Bent-over / hinged | rotated ~30-35° so both arms clear the torso |

### 2. Camera consistency between panels

Without an explicit instruction the model renders panel 1 from the side and
panel 2 from the front. Every prompt carries:

> CAMERA — IDENTICAL IN BOTH PANELS (same angle, distance, figure size) … A
> viewpoint change between panels is a failure.

### 3. Equipment rules

Stated as hard constraints, because each was a real failure:

- **Depth:** weights sit entirely in front of / clear of the body, never intersecting it
- **Plate size:** ~45 cm, explicitly *smaller than the torso length* (otherwise comically oversized)
- **Grip:** fingers visibly wrapped, knuckles readable — arms must never merge into the plate
- **Bar readability:** straight shaft visible, near plate larger and closer, far plate smaller behind the body

### 4. Short-range movements need exaggeration

Shrugs, calf raises, hanging leg raises render as two identical-looking panels
unless the contrast is spelled out:

> THE ONLY DIFFERENCE BETWEEN THE PANELS IS HEEL HEIGHT, AND IT MUST BE OBVIOUS
> AT A GLANCE.

This fixed calf raises. It did **not** fix shrugs — those still read flat and are
the weakest asset in the set.

## Prompt skeleton

```
Instructional exercise diagram, two panels side by side, flat dark navy (#0F172A).
Featureless genderless wooden artist mannequin, matte amber-gold (#F59E0B), ball
joints, no face, no clothing.

CAMERA IDENTICAL IN BOTH PANELS (same angle, distance, figure size): <per class
above>. A viewpoint change between panels is a failure.

EQUIPMENT: <depth / plate size / grip rules>.

MOVEMENT — <name>. LEFT PANEL, <position>: <joint angles>. RIGHT PANEL,
<position>: <joint angles, with the critical cue in CAPS>.

Even studio lighting, matte finish, clean diagram style, no text, no logos.
```

## Known gaps

| Item | Status |
|---|---|
| `cable_crunch` | **Missing.** Refused by the content filter across three rewrites (kneeling + rope + cable phrasing). `getExerciseDemoUri` returns null; the UI renders nothing. |
| `shrugs`, `db_shrugs` | Weak — both panels look near-identical despite exaggeration language |
| `overhead_db_tricep_ext`, `one_arm_db_row`, `prone_incline_reverse_fly` | Marginal — movement reads but the two positions are close |
| `db_good_morning` | Weight is at the chest, not across the upper back |
| Offline | Served from `public/`, so unavailable until the browser caches them. No service worker yet. |
| Native | Web-only — `ExerciseDemo` returns null off web. A native build would need bundled `require()` assets. |

## Video

One 5s Seedance clip was piloted (`squat-mannequin-video-v1.mp4`, 22.5 cr, local
only). Verdict: one clean continuous rep, but the camera drifts, heels lift, and
depth is ambiguous. At 22.5 cr and ~1.5 MB per clip, full coverage would be
~1,395 cr and ~93 MB — over the 400/mo ceiling and the whole grant. Stills won.
