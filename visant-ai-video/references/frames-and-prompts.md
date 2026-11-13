# Frames and prompts that worked

Proven on a Christmas unboxing spot for a sports retailer (sports shoe reveal). Image model:
`gemini-3-pro-image` 2K, 9:16 (`gpt-image-2` silently falls back to it). Video: `kling-v3`,
`klingMode: pro`, `frames_to_video`, 5 s, `sound: off`.

## Frame pair: end first, start derived

1. **End frame = the hero moment** (product revealed, peak emotion). Generate it from scratch with
   references: product photo + cast frame + set/box frame.
2. **Start frame = derived from the end frame.** Pass ONLY the end frame as reference and say
   "Recreate the exact same shot ... only change: <the action before>". Same room, light, grade,
   lens: Kling then only has to animate the action, not invent a camera move.
3. Kling `frames_to_video` with both. Describe the action between them, plus a "subtle slow
   push-in" (it reads as intentional camera work and hides small mismatches).

To chain scenes, scene N's end frame is the reference for scene N+1's start frame.

## Hero frame template

```
Cinematic commercial film still, vertical 9:16, premium <category> <occasion> ad.
The same <person> from reference image <k> (<hair>, <wardrobe>) <pose> in the same <set> (reference <j>: <set details>).
<Shot size>, camera <height>, 50mm lens, shallow depth of field, <background> in creamy bokeh.
<Emotion, concrete: "huge genuine open-mouth smile, eyebrows raised">.
<Action on the product>, product fully visible in <view>: <PRODUCT NAME> — <colour by colour, part by part>, faithful to reference <i>, no other brand logos.
<Packaging with logo as in reference>. <Key light>, <rim light>, catchlights.
Negative space at the top for a title. Rich warm grade, Arri Alexa look, fine film grain, photorealistic, no text other than the box logo.
```

## Kling prompt template

```
<Genre> commercial. <Who> <action 1> <action 2> <final pose>, <emotion>. Natural, lively body movement.
Camera does a subtle slow push-in. <Ambient motion: lights twinkle, fire flickers>.
Shallow depth of field, cinematic warm grade, smooth 24fps motion.
```
negativePrompt: `morphing <product>, changing logos, extra hands, extra fingers, distorted face, face change, two <product>s, <competitor brands>, jitter, camera shake, text flicker`

## Checklist: every frame, before rendering the video

Read the frame image. Re-generate the frame if any check fails; rendering a bad frame wastes a take.

- [ ] Product matches the official photo part by part (colours, stripes, midsole, sole, model name). No other brand's logo.
- [ ] Brand logo on packaging is legible, not covered (a ribbon once covered half the wordmark).
- [ ] Logo shape: AI redraws logos in a generic font. Flag it to the user; the end card carries the official logo.
- [ ] Same person as the cast frame (hair, face, wardrobe). Mixing the person from one version with the person from another broke a cut.
- [ ] Faces and product sit below the title safe zone (top ~25% of a 9:16 frame).
- [ ] Start and end frames share the camera, set and light.

## What failed

| Symptom | Cause | Fix |
|---|---|---|
| Generic product (wrong brand look) | No product reference | Always pass the official product photo |
| Flat, "hunched over the box" shot | Wide shot, no emotion beat | Medium close-up, front-facing, explicit emotion |
| POV hands-only reveal felt cold | No face | User wanted the happy face; put the reaction on camera |
| Logo hidden in end frame | Ribbon over lid | Remove the ribbon in the end frame; the ribbon pull becomes the action |
