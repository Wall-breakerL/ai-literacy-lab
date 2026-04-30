# AI-MBTI Avatar Generation Prompt

This prompt is for generating the 16 AI collaboration personality portraits as original raster assets.

## Reference Direction

Use the official MBTI / 16Personalities avatar system as the primary visual reference for product feel and recognizability:
- the avatars should immediately read as the same category of result artwork as official MBTI-style personality portraits
- a highly consistent family of illustrated character cards
- clean mascot-like people with simplified faces and iconic silhouettes
- clear type grouping through color families and archetypal props
- friendly, polished, high-recognition personality-test result art

Important originality boundary: strongly reference the official MBTI / 16Personalities visual language, but do not duplicate any exact official character. Do not copy the same costume, pose, face, prop combination, background composition, or exact palette from a specific official avatar. Create a parallel original set for AI collaboration types.

## Batch Guidance

`gpt-image-2` can generate at most 10 images per request. Generate the 16 avatars in two batches:

- Batch A: `IFAG`, `IFAL`, `IFTG`, `IFTL`, `IEAG`, `IEAL`, `IETG`, `IETL`
- Batch B: `CFAG`, `CFAL`, `CFTG`, `CFTL`, `CEAG`, `CEAL`, `CETG`, `CETL`

Recommended output:
- Source: square PNG
- Frontend asset: final selected PNG copied to the public asset directory
- Save paths:
  - selected source: `avatars/avatar-choices/{{code}}.png`
  - frontend asset: `public/avatars/ai-mbti/{{code}}.png`

## Master Prompt

```text
Create one original avatar portrait for an AI collaboration personality test.

Visual style:
- strongly reference the official 16Personalities / MBTI avatar look and product language
- clean 2D vector cartoon result avatar, polished and approachable
- simplified mascot-like human figure with big readable silhouette, minimal facial detail, friendly expression
- non-gendered or gender-ambiguous character design; avoid gender-coded clothing, makeup, facial hair, body proportions, or hairstyle stereotypes
- full-body or near full-body character inside a square result-card composition, centered with generous padding
- bright personality-test color grouping, soft gradients, subtle shadows, flat-vector clarity
- one symbolic handheld prop that represents the type's AI collaboration style
- crisp edges, clean shapes, no sketchiness, not anime, not photorealistic, not 3D
- no text, no logo, no watermark

Consistency rules:
- all 16 avatars must look like one official-style personality test family
- same camera angle, same full-body / near full-body crop, same line weight, same lighting, same facial simplicity, same card framing
- type differences should come mainly from palette, prop, background motif, posture energy, and small costume/accessory details
- keep faces simple enough to be gender-neutral and legible at small sizes
- avoid highly detailed backgrounds; keep the character dominant and iconic

Originality constraints:
- do not copy, trace, or reproduce any specific MBTI / 16Personalities avatar
- do not recreate an official character with swapped colors
- do not use the same exact costume, pose, face, prop, or background composition from any existing personality-test brand
- the result should be "highly MBTI-style" in system language, but original in character identity

Type details:
- Type code: {{code}}
- Type name: {{name}}
- Personality tagline: {{tagline}}
- Palette: primary {{primary}}, secondary {{secondary}}, accent {{accent}}
- Symbolic prop: {{prop}}
- Background motif: {{motif}}

Output:
- square 1024x1024 image
- character must be legible at 160px in a web report card
```

## Batch Prompt Template

Use this when generating up to 10 images at once with `gpt-image-2`. Replace the list with Batch A or Batch B.

```text
Generate 8 separate square avatar images for an original AI collaboration personality test.

Use the Master Prompt style exactly. The output should strongly resemble official MBTI / 16Personalities result-avatar quality and layout, while staying original. Keep all images highly consistent: same full-body or near full-body crop, same non-gendered mascot design language, same lighting, same rounded card composition, same vector-like polish. Vary only the palette, symbolic prop, background motif, and posture energy for each type.

Important: gpt-image-2 supports no more than 10 images per request, so this batch contains 8 avatars.

Types to generate:
1. {{code}} — {{name}} — prop {{prop}} — motif {{motif}} — palette {{primary}}, {{secondary}}, {{accent}} — tagline {{tagline}}
2. ...

No text, no code letters rendered inside the image, no logo, no watermark.
Strongly reference official MBTI / 16Personalities avatar system aesthetics, but do not recreate any exact official character. Create an original but immediately familiar personality-test avatar family.
```

## Current Type Concepts

The current app stores per-type prompts in `src/lib/personalityProfiles.ts` and renders deterministic vector placeholders in `src/app/report/page.tsx`. If raster generation is needed, use the master prompt plus the profile's `avatarPrompt` and `avatarArtwork` values.

## AI-MBTI Dimension Visual Grammar

Use the four letters as the underlying visual grammar for the full 16-avatar family. Each avatar should read as one coherent character first, but its pose, prop, motif, and energy should quietly encode the four AI collaboration dimensions.

| Dimension | Low Pole | High Pole | Visual Rule |
|---|---|---|---|
| Relation | `I` Instrumental / 工具型 | `C` Collaborative / 伙伴型 | `I` avatars feel precise, self-contained, and command-oriented: direct stance, clear tool, sharper silhouette. `C` avatars feel co-creative and relational: open stance, shared canvas/object, inviting gesture. |
| Workflow | `F` Framed / 框架型 | `E` Exploratory / 探索型 | `F` avatars show structure before action: grid, blueprint, checklist, organized panels. `E` avatars show discovery and branching: stars, rings, paths, orbiting ideas, more dynamic posture. |
| Epistemic | `A` Auditing / 审计型 | `T` Trusting / 信任型 | `A` avatars show verification: magnifier, clipboard, map, careful gaze, grounded color balance. `T` avatars show confident adoption: spark, bolt, prism, wand, forward motion, warmer accent. |
| RepairScope | `G` Global / 全局重评型 | `L` Local / 局部调整型 | `G` avatars show reset or re-architecture: compass, blocks, map, large directional gesture. `L` avatars show refinement: wrench, brush, loop, seedling, small precise adjustment. |

Palette grouping follows the current app:
- Blue primary `#55b3ff` usually signals careful / auditing / structured cognition.
- Red primary `#ff6363` usually signals speed, action, trust, and high execution energy.
- Yellow accent `#ffbc33` usually signals global reset, big-picture judgment, or decisive reframing.
- Green accent `#5fc992` usually signals local iteration, repair, continuity, and growth.
- Dark secondary tones keep the whole set aligned with the Raycast-style product theme.

## 16 Type Meanings And Artwork Specs

Use these notes as the type-specific layer on top of the Master Prompt. Do not render the code letters inside the image. The letters are semantic guidance for character design, not visible text.

| Code | Name | Meaning by Dimensions | Artwork Characteristics |
|---|---|---|---|
| `IFAG` | 精准指令官 | `I` treats AI as an execution tool; `F` starts from a clear frame; `A` verifies carefully; `G` resets globally when the output is wrong. | Clipboard prop, grid motif, cap-like simple hair. Stance should be upright and exact, like a task inspector holding a checklist. Use cool blue with yellow audit accent. Silhouette: stable, precise, command-ready. |
| `IFAL` | 细节修补师 | `I` gives direct instructions; `F` works inside a defined frame; `A` checks details; `L` repairs locally instead of restarting. | Wrench prop, grid motif, bob-like simple hair. Character should look focused on a small fix, tightening one component on a clean interface panel. Blue + green palette. Energy: patient, careful, hands-on. |
| `IFTG` | 高效交付官 | `I` delegates directly; `F` defines the task; `T` trusts AI output more readily; `G` restarts or redirects when needed. | Bolt prop, paths motif, tuft-like hair. Strong forward lean, delivery-speed feeling, one hand pointing toward a route. Red + yellow palette. Energy: decisive, fast, production-oriented. |
| `IFTL` | 轻量执行者 | `I` uses AI as a practical tool; `F` gives clear constraints; `T` accepts useful output quickly; `L` tweaks small parts. | Spark prop, paths motif, sweep hair. Compact, efficient pose; character nudges a small glowing result forward. Red + green palette. Energy: light, fast, minimal friction. |
| `IEAG` | 探索审校员 | `I` still keeps tool-user distance; `E` lets AI explore options; `A` audits results; `G` is willing to restart the whole direction. | Magnifier prop, stars motif, cap hair. Character examines floating idea-stars with a magnifier, one foot planted. Blue + yellow palette. Energy: curious but skeptical, discovery followed by review. |
| `IEAL` | 实验修复师 | `I` uses AI as an experimental tool; `E` tries multiple directions; `A` checks what works; `L` salvages and improves useful pieces. | Loop prop, rings motif, bob hair. Character holds or adjusts a circular feedback loop, with small modular pieces returning into place. Blue + green palette. Energy: iterative, experimental, calm. |
| `IETG` | 快速试验导演 | `I` directs AI from the outside; `E` rapidly tests options; `T` trusts quick prototypes; `G` can pivot or restart boldly. | Compass prop, stars motif, tuft hair. Character should look like a director choosing a new direction among several star paths. Red + yellow palette. Energy: high-motion, decisive experimentation. |
| `IETL` | 敏捷迭代者 | `I` uses AI pragmatically; `E` opens with exploration; `T` accepts quick starts; `L` improves through small edits. | Wand prop, rings motif, sweep hair. Character lightly taps a glowing draft, making small sparks and local improvements. Red + green palette. Energy: agile, playful, small-step momentum. |
| `CFAG` | 协作蓝图师 | `C` treats AI as a partner; `F` starts with a shared blueprint; `A` reviews rigorously; `G` can redesign the whole plan. | Blueprint prop, grid motif, cap hair. Character presents a shared plan board, open but structured. Blue + yellow palette. Energy: collaborative architect, composed and high-standards. |
| `CFAL` | 共创打磨师 | `C` co-creates with AI; `F` works in a stable frame; `A` checks quality; `L` polishes locally. | Brush prop, grid motif, bob hair. Character gently refines a shared canvas or interface surface with a brush. Blue + green palette. Energy: warm, careful, craft-focused. |
| `CFTG` | 结构共创者 | `C` collaborates with AI; `F` keeps structure; `T` moves confidently with AI output; `G` can rebuild larger blocks when the structure fails. | Blocks prop, paths motif, tuft hair. Character rearranges large modular blocks with a partner-like gesture. Red + yellow palette. Energy: constructive, bold, structural. |
| `CFTL` | 稳态协作家 | `C` sees AI as a steady collaborator; `F` prefers clear roles and plans; `T` trusts the working process; `L` improves continuously. | Seedling prop, paths motif, sweep hair. Character tends a small growing system or plant-like workflow. Red + green palette. Energy: steady, reliable, nurturing collaboration. |
| `CEAG` | 探索架构师 | `C` explores with AI as a thinking partner; `E` opens many possibilities; `A` audits before accepting; `G` can re-map the whole direction. | Map prop, stars motif, cap hair. Character studies a large constellation-map with one hand inviting another route. Blue + yellow palette. Energy: strategic, expansive, reflective. |
| `CEAL` | 共创实验家 | `C` treats AI as an idea partner; `E` experiments openly; `A` keeps a critical eye; `L` preserves and refines what works. | Flask prop, rings motif, bob hair. Character mixes small idea-samples in a friendly lab-like setup, with circular feedback rings. Blue + green palette. Energy: curious, careful, inventive. |
| `CETG` | 发散策展人 | `C` co-creates with AI; `E` expands possibilities; `T` is comfortable riding AI momentum; `G` curates by reorganizing the whole direction. | Prism prop, stars motif, tuft hair. Character refracts one input into many colored paths, then gestures toward a new arrangement. Red + yellow palette. Energy: expressive, divergent, bold curation. |
| `CETL` | 灵感迭代师 | `C` collaborates with AI naturally; `E` explores ideas; `T` trusts generative momentum; `L` turns inspiration into results through local iteration. | Orbit prop, rings motif, sweep hair. Character stands inside or beside a gentle orbit of small glowing ideas, adjusting one node. Red + green palette. Energy: fluid, imaginative, optimistic, iterative. |

## Per-Type Prompt Add-On Template

Append this after the Master Prompt when generating a specific avatar:

```text
Type meaning:
{{code}} combines {{dimension_meaning}}.

Artwork direction:
{{artwork_characteristics}}

Make the character visually communicate this collaboration style through posture, prop use, background motif, and energy level. Keep the image original, gender-neutral, and consistent with the full 16-avatar family.
```
