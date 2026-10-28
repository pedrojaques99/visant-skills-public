---
name: visant-mcp-connect
description: 'Connects and operates the Visant Labs MCP (requires a Visant Labs account): brand guidelines, mockups, creative studio, canvas, budgets, moodboard, PDF extraction. Use on "connect visant", "use the visant tools", "setup visant mcp", "conecta o visant", "usar as tools do visant", "extrair PDF pelo visant".'
tags:
  - mcp
  - visant
  - brand
  - ai-tools
---

# Visant Labs MCP

> **Requires a Visant Labs account** (visantlabs.com). Without one, none of these
> tools work: there is no anonymous mode. Generation tools also spend the
> account's credits.

**API:** `https://api.visantlabs.com`
**MCP:** `https://api.visantlabs.com/api/mcp`
**Auth:** OAuth 2.1 + PKCE (dynamic client registration) or API key (`visant_sk_...`)

---

## Connect (Claude-first flow)

### Step 1: check for existing credentials

```bash
cat ~/.visant/credentials.json
```

If it exists and has `apiKey`, skip to Step 3.

### Step 2: authenticate

Ask the user for their Visant Labs email and password, then run:

```bash
npx visantlabs login -e EMAIL -p PASSWORD
```

This saves `~/.visant/credentials.json` with the permanent `apiKey`
(`visant_sk_...`).

### Step 3: configure the MCP (global, any directory)

```bash
claude mcp add --transport http \
  --header "Authorization: Bearer <apiKey>" \
  --scope user \
  visant https://api.visantlabs.com/api/mcp
```

> **Do not use** `mcpServers` in `settings.json` or `mcp-remote`: the server
> speaks Streamable HTTP directly.

### Step 4: verify

```bash
claude mcp list
# should show: visant: https://api.visantlabs.com/api/mcp (HTTP) - ✓ Connected
```

The tools show up with the `mcp__visant__` prefix in the next session.

---

## Available tools (~50)

### Account & Auth
| Tool | What it does |
|------|-----------|
| `account-profile` | User profile (name, email, plan) |
| `account-usage` | Remaining credits, limits, billing cycle |
| `auth-login` | Email/password login → JWT |
| `auth-register` | Create account → JWT |
| `api-key-create` | Generate a `visant_sk_xxx` API key |
| `api-key-list` | List existing API keys |

### Brand Guidelines (16 tools)
| Tool | What it does |
|------|-----------|
| `brand-guidelines-list` | List all brand guidelines |
| `brand-guidelines-get` | Full data (JSON, or `format:"prompt"` for LLM-ready text) |
| `brand-guidelines-create` | Create a new guideline |
| `brand-guidelines-update` | Partial patch (colors, typography, strategy, tokens) |
| `brand-guidelines-delete` | Delete (requires `confirm: true`) |
| `brand-guidelines-duplicate` | Duplicate a guideline |
| `brand-guidelines-share` | Create/revoke a public link |
| `brand-guidelines-public` | Access by slug (no auth) |
| `brand-guidelines-ingest` | Extract from URL/text and merge into the guideline |
| `brand-guidelines-compliance-check` | AI audit (contrast, typography, voice, completeness) |
| `brand-guidelines-versions` | Version history |
| `brand-guidelines-restore-version` | Restore a previous version |
| `brand-guidelines-upload-logo` | Upload logo (base64/URL, variants: primary/dark/light/icon) |
| `brand-guidelines-upload-media` | Upload media kit (image/PDF) |
| `brand-guidelines-delete-logo` | Delete logo by ID |
| `brand-guidelines-delete-media` | Delete media by ID |

### Branding Machine (5 tools)
| Tool | What it does |
|------|-----------|
| `branding-generate` | Generate a visual identity from a prompt (steps: full/market-research/swot/persona/archetype/concept-ideas/color-palettes/moodboard). Follows `metodologia-visant` |
| `branding-list` | List branding projects |
| `branding-get` | Project details |
| `branding-save` | Save/update a project |
| `branding-delete` | Delete a project |

### Mockup Machine (5 tools)
| Tool | What it does |
|------|-----------|
| `mockup-generate` | Generate an AI mockup. Models: `gpt-image-2` (best), `gemini-3.1-flash-image-preview`, `seedream-3-0`. Resolutions: 1K/2K/4K. Aspect ratios: 1:1/16:9/9:16/4:5. Auto-injects brand context via `brandGuidelineId`. |
| `mockup-list` | List mockups |
| `mockup-get` | Mockup details |
| `mockup-update` | Update metadata |
| `mockup-delete` | Delete |
| `mockup-presets` | Presets by category (business-card, social-media, packaging, apparel, etc.) |

### Creative Studio (8 tools)
| Tool | What it does |
|------|-----------|
| `creative-full` | Full pipeline: plan → background → render PNG → save. One shot. |
| `creative-generate` | Generate a structured layout (layers, overlay, background prompt) |
| `creative-render` | Render a plan to PNG server-side |
| `creative-projects-create` | Save a creative project |
| `creative-projects-list` | List projects |
| `creative-projects-get` | Project details |
| `creative-projects-update` | Update a project |
| `creative-projects-delete` | Delete a project |

### Canvas / Whiteboard (8 tools)
| Tool | What it does |
|------|-----------|
| `canvas-create` | Create a whiteboard |
| `canvas-list` | List projects |
| `canvas-list-projects` | List with a summary of node types |
| `canvas-get` | Details (nodes, edges, drawings) |
| `canvas-update` | Update nodes/edges/linkedGuideline |
| `canvas-delete` | Delete |
| `canvas-share` | Share (canEdit/canView by email) |
| `canvas-parse-csv` | Preview CSV → DataNode rows |
| `canvas-resolve-variables` | Resolve `{{placeholders}}` in a prompt |

### Budget (6 tools)
| Tool | What it does |
|------|-----------|
| `budget-create` | Create a budget (clientName, projectDescription) |
| `budget-list` | List budgets |
| `budget-get` | Details with line items |
| `budget-update` | Update fields |
| `budget-delete` | Delete |
| `budget-duplicate` | Duplicate |

### AI Utilities (free)
| Tool | What it does |
|------|-----------|
| `ai-describe-image` | Describe an image (URL or base64). 0 credits. |
| `ai-improve-prompt` | Improve prompt text. 0 credits. |

> **House rule: a generated prompt is a saved prompt.** Every call to
> `ai-generate-image` / `creative-generate` / `mockup-generate` / `video-generate`
> goes to the project's `prompts.jsonl` ledger: one line per call, with
> model/params, refs **with each one's role**, `sha256` of the output, status
> (approved/discarded), cost, and a note on what went wrong for discarded ones.
> Record it on the spot: it cannot be recovered later. If `visant-mockup-creator`
> is installed, the contract is in its `references/prompt-ledger.md`.

### Document & Image Extraction
| Tool | What it does |
|------|-----------|
| `document-extract` | **Dual mode**, see "Document Extract" below. URL mode pulls HD images from any public page; PDF mode turns a PDF into markdown + brand tokens. |

### Moodboard (3 tools)
| Tool | What it does |
|------|-----------|
| `moodboard-detect-grid` | Detect bounding boxes in a moodboard grid |
| `moodboard-suggest` | Suggest animations/video for each cell |
| `moodboard-upscale` | Upscale an image to 1K/2K/4K. **⚠ Unstable: returned `INTERNAL_ERROR` on 3/3 calls in Aug 2026.** See "When a tool goes down". |

### Community (2 tools)
| Tool | What it does |
|------|-----------|
| `community-presets` | Browse public mockup presets |
| `community-profiles` | Browse community profiles |

---

## When a tool goes down

MCP tools break, and the right response is never to insist or to pretend the
result came out:

1. **Two attempts, no more.** Repeated `INTERNAL_ERROR` is the server, not the
   payload; a third try only burns time.
2. **Use the alternative and say which one.** Never swap silently: whoever reads
   the result needs to know which path it came through.
3. **Report the breakage** in the work's `.md`, with the date and the exact
   message.

| If it fails | Alternative |
|---|---|
| `moodboard-upscale` | Look for the high-res ORIGINAL before upscaling: it almost always exists and nobody looked (run [[visant-preflight]]). Upscaling is plan B; upscaling without searching for the original is plan C dressed as plan A. |
| `ai-generate-image` falls back to the wrong model | The response carries `fellBack: true` and the real `model`. **Read the response**: asking for gemini and getting gpt-image-1 changes the result and the cost. |
| `brand-guidelines-health-check` | Do not trust it; confirm with `brand-guidelines-get`. It has reported an empty vault on a full one. |
| Local file upload | `visant upload <file> --json` via the CLI, or a presigned URL (`media-upload-urls` + `curl -X PUT` + `media-commit`). Inline base64 truncates and uploads a corrupted image. |

---

## Document Extract (dual mode)

### Mode 1: image extraction from a URL
```json
{ "url": "https://www.behance.net/gallery/...", "limit": 80 }
```
Returns image URLs with width, height and alt text (`limit` max 200). Works with
Behance, Pinterest, Dribbble, portfolios, blogs. Handles lazy-loaded images,
srcset and background images. Scope: `read`.

### Mode 2: PDF extraction
```json
{ "pdf_base64": "<base64>", "output": "inline", "include_brand_tokens": true }
```
Also accepts `pdf_path` for files on the server. `output: "disk"` saves a `.md`,
`"inline"` returns text. `include_brand_tokens: true` extracts colors, typography
and strategy (two phases: algorithmic + Gemini).

---

## Expired token / 401

```bash
cat ~/.visant/credentials.json   # take .apiKey
```

Update the Bearer in the MCP config and restart the session. If the file does not
exist: `npx visantlabs login`.

---

## Usage tips

- **Brand context in generation:** pass `brandGuidelineId` to mockup-generate,
  creative-full and creative-generate to inject colors/typography/voice.
- **`format: "prompt"`** on `brand-guidelines-get` returns text optimized for LLM
  context, not JSON.
- **creative-full** is the shortcut: it avoids chaining generate + mockup-generate
  + render by hand.
- **Credits:** `account-usage` shows the balance. AI utilities (describe-image,
  improve-prompt) are free.
- **Scopes:** OAuth tokens enforce `read`, `write`, `generate`; generation tools
  need `generate`.
