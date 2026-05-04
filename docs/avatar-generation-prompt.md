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
| `IFAG` | 系统架构师 | `I` treats AI as an execution tool; `F` starts from a clear frame; `A` verifies carefully; `G` resets globally when the output is wrong. Tagline: 全局规划，滴水不漏. | System diagram prop, grid motif, cap-like simple hair. Stance should feel like someone planning a complete architecture, with linked nodes and modules. Blue + yellow palette. Energy: rigorous, global, complete. |
| `IFAL` | 建筑师 | `I` gives direct instructions; `F` works inside a defined frame; `A` checks details; `L` repairs locally instead of restarting. Tagline: 精心设计，严谨落地. | Blueprint prop, grid motif, bob-like simple hair. Character studies a precise plan and turns it into a stable structure. Blue + green palette. Energy: designed, careful, hands-on. |
| `IFTG` | 完美主义者 | `I` delegates directly; `F` defines the task; `T` trusts AI output more readily; `G` restarts or redirects when needed. Tagline: 追求极致，不留遗憾. | Diamond prop, paths motif, tuft-like hair. Character should feel polished and exacting, refining a high-standard result. Red + yellow palette. Energy: uncompromising, decisive, high-standard. |
| `IFTL` | 实干家 | `I` uses AI as a practical tool; `F` gives clear constraints; `T` accepts useful output quickly; `L` tweaks small parts. Tagline: 定好规则，高效执行. | Toolbox prop, paths motif, sweep hair. Compact, efficient pose; character carries practical tools and moves a task forward. Red + green palette. Energy: direct, useful, execution-oriented. |
| `IEAG` | 发明家 | `I` still keeps tool-user distance; `E` lets AI explore options; `A` audits results; `G` is willing to restart the whole direction. Tagline: 不断试验，追求突破. | Lightbulb prop, stars motif, cap hair. Character experiments with a breakthrough idea, with sparks and possible routes around it. Blue + yellow palette. Energy: inventive, experimental, bold. |
| `IEAL` | 作家 | `I` uses AI as an experimental tool; `E` tries multiple directions; `A` checks what works; `L` salvages and improves useful pieces. Tagline: 边写边改，字斟句酌. | Pen prop, rings motif, bob hair. Character edits a draft with care, keeping visible iteration loops around the writing surface. Blue + green palette. Energy: reflective, precise, craft-focused. |
| `IETG` | 厨师 | `I` directs AI from the outside; `E` rapidly tests options; `T` trusts quick prototypes; `G` can pivot or restart boldly. Tagline: 即兴发挥，成就佳作. | Chef-pan prop, stars motif, tuft hair. Character improvises with ingredients or sparks, turning a quick idea into a complete result. Red + yellow palette. Energy: playful, decisive, creative. |
| `IETL` | 画家 | `I` uses AI pragmatically; `E` opens with exploration; `T` accepts quick starts; `L` improves through small edits. Tagline: 自由创作，涂涂画画. | Palette prop, rings motif, sweep hair. Character freely paints or adjusts a colorful draft, with small local improvements. Red + green palette. Energy: loose, expressive, iterative. |
| `CFAG` | 董事长 | `C` treats AI as a partner; `F` starts with a shared blueprint; `A` reviews rigorously; `G` can redesign the whole plan. Tagline: 掌控全局，追求卓越. | Crown prop, grid motif, cap hair. Character should feel high-level and composed, overseeing a complete system from the top. Blue + yellow palette. Energy: authoritative, exacting, global. |
| `CFAL` | 执行官 | `C` co-creates with AI; `F` works in a stable frame; `A` checks quality; `L` polishes locally. Tagline: 思路清晰，执行到位. | Briefcase prop, grid motif, bob hair. Character works through a clear plan with crisp execution and quality checks. Blue + green palette. Energy: organized, reliable, precise. |
| `CFTG` | 指挥官 | `C` collaborates with AI; `F` keeps structure; `T` moves confidently with AI output; `G` can rebuild larger blocks when the structure fails. Tagline: 统筹全局，果断决策. | Flag prop, paths motif, tuft hair. Character signals direction across a larger route or operation. Red + yellow palette. Energy: decisive, coordinated, command-ready. |
| `CFTL` | 合伙人 | `C` sees AI as a steady collaborator; `F` prefers clear roles and plans; `T` trusts the working process; `L` improves continuously. Tagline: 稳扎稳打，并肩前行. | Handshake prop, paths motif, sweep hair. Character should suggest dependable partnership and shared progress. Red + green palette. Energy: steady, warm, practical. |
| `CEAG` | 战略家 | `C` explores with AI as a thinking partner; `E` opens many possibilities; `A` audits before accepting; `G` can re-map the whole direction. Tagline: 共谋大局，深谋远虑. | Chess-board prop, stars motif, cap hair. Character studies a strategic field and considers several long-range moves. Blue + yellow palette. Energy: expansive, analytical, strategic. |
| `CEAL` | 外交官 | `C` treats AI as an idea partner; `E` experiments openly; `A` keeps a critical eye; `L` preserves and refines what works. Tagline: 理性协商，探讨策略. | Scales prop, rings motif, bob hair. Character balances options through discussion and careful judgment. Blue + green palette. Energy: diplomatic, balanced, thoughtful. |
| `CETG` | 领航员 | `C` co-creates with AI; `E` expands possibilities; `T` is comfortable riding AI momentum; `G` curates by reorganizing the whole direction. Tagline: 带领团队，探索未知. | Compass prop, stars motif, tuft hair. Character points toward an unexplored route and leads through uncertainty. Red + yellow palette. Energy: adventurous, directional, confident. |
| `CETL` | 研究搭档 | `C` collaborates with AI naturally; `E` explores ideas; `T` trusts generative momentum; `L` turns inspiration into results through local iteration. Tagline: 一起探索，快速迭代. | Research orbit prop, rings motif, sweep hair. Character stands near linked research nodes, adjusting one idea inside a collaborative orbit. Red + green palette. Energy: curious, fluid, iterative. |

## Per-Type Prompt Add-On Template

Append this after the Master Prompt when generating a specific avatar:

```text
Type meaning:
{{code}} combines {{dimension_meaning}}.

Artwork direction:
{{artwork_characteristics}}

Make the character visually communicate this collaboration style through posture, prop use, background motif, and energy level. Keep the image original, gender-neutral, and consistent with the full 16-avatar family.
```
