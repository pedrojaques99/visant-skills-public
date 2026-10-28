---
name: visant-mcp-connect
description: 'Conecta e opera o MCP do Visant Labs: brand, mockup, creative studio, canvas, orçamento, moodboard, extração de PDF. Use em "conecta o visant", "usar as tools do visant", "setup visant mcp", "extrair PDF pelo visant".'
tags:
  - mcp
  - visant
  - brand
  - ai-tools
---

# Visant Labs MCP

**API:** `https://api.visantlabs.com`
**MCP:** `https://api.visantlabs.com/api/mcp`
**Auth:** OAuth 2.1 + PKCE (dynamic client registration) or API Key (`visant_sk_...`)

---

## Conectar (fluxo Claude-first)

### Passo 1 — Verificar se já tem credenciais

```bash
cat ~/.visant/credentials.json
```

Se existir e tiver `apiKey`, pule para o Passo 3.

### Passo 2 — Autenticar

Peça o email e senha ao usuário, depois rode:

```bash
npx visantlabs login -e EMAIL -p SENHA
```

Isso salva `~/.visant/credentials.json` com o `apiKey` permanente (`visant_sk_...`).

### Passo 3 — Configurar o MCP (global, qualquer diretório)

```bash
claude mcp add --transport http \
  --header "Authorization: Bearer <apiKey>" \
  --scope user \
  visant https://api.visantlabs.com/api/mcp
```

> **Não use** `mcpServers` no `settings.json` nem `mcp-remote` — o servidor suporta Streamable HTTP direto.

### Passo 4 — Verificar

```bash
claude mcp list
# deve mostrar: visant: https://api.visantlabs.com/api/mcp (HTTP) - ✓ Connected
```

As tools aparecem com o prefixo `mcp__visant__` na próxima sessão.

---

## Tools disponíveis (~50 tools)

### Account & Auth
| Tool | O que faz |
|------|-----------|
| `account-profile` | Perfil do user (nome, email, plano) |
| `account-usage` | Créditos restantes, limites, ciclo billing |
| `auth-login` | Login email/senha → JWT |
| `auth-register` | Criar conta → JWT |
| `api-key-create` | Gerar API key `visant_sk_xxx` |
| `api-key-list` | Listar API keys existentes |

### Brand Guidelines (16 tools)
| Tool | O que faz |
|------|-----------|
| `brand-guidelines-list` | Lista todas as brand guidelines |
| `brand-guidelines-get` | Dados completos (JSON ou `format:"prompt"` para LLM-ready) |
| `brand-guidelines-create` | Criar nova guideline |
| `brand-guidelines-update` | Patch parcial (cores, tipografia, strategy, tokens) |
| `brand-guidelines-delete` | Deletar (requer `confirm: true`) |
| `brand-guidelines-duplicate` | Duplicar guideline |
| `brand-guidelines-share` | Gerar/revogar link público |
| `brand-guidelines-public` | Acessar por slug (sem auth) |
| `brand-guidelines-ingest` | Extrair de URL/texto e mergear na guideline |
| `brand-guidelines-compliance-check` | Auditoria AI (contraste, tipografia, voz, completude) |
| `brand-guidelines-versions` | Histórico de versões |
| `brand-guidelines-restore-version` | Restaurar versão anterior |
| `brand-guidelines-upload-logo` | Upload logo (base64/URL, variants: primary/dark/light/icon) |
| `brand-guidelines-upload-media` | Upload media kit (imagem/PDF) |
| `brand-guidelines-delete-logo` | Deletar logo por ID |
| `brand-guidelines-delete-media` | Deletar media por ID |

### Branding Machine (5 tools)
| Tool | O que faz |
|------|-----------|
| `branding-generate` | Gerar identidade visual por prompt (steps: full/market-research/swot/persona/archetype/concept-ideas/color-palettes/moodboard) |
| `branding-list` | Listar projetos de branding |
| `branding-get` | Detalhar projeto |
| `branding-save` | Salvar/atualizar projeto |
| `branding-delete` | Deletar projeto |

### Mockup Machine (5 tools)
| Tool | O que faz |
|------|-----------|
| `mockup-generate` | Gerar mockup AI. Models: `gpt-image-2` (best), `gemini-3.1-flash-image-preview`, `seedream-3-0`. Resolutions: 1K/2K/4K. Aspect ratios: 1:1/16:9/9:16/4:5. Auto-injeta brand context via `brandGuidelineId`. |
| `mockup-list` | Listar mockups |
| `mockup-get` | Detalhar mockup |
| `mockup-update` | Atualizar metadata |
| `mockup-delete` | Deletar |
| `mockup-presets` | Presets por categoria (business-card, social-media, packaging, apparel, etc.) |

### Creative Studio (8 tools)
| Tool | O que faz |
|------|-----------|
| `creative-full` | Pipeline completo: plan → background → render PNG → save. One-shot. |
| `creative-generate` | Gerar layout estruturado (layers, overlay, background prompt) |
| `creative-render` | Renderizar plan em PNG server-side |
| `creative-projects-create` | Salvar projeto creative |
| `creative-projects-list` | Listar projetos |
| `creative-projects-get` | Detalhar projeto |
| `creative-projects-update` | Atualizar projeto |
| `creative-projects-delete` | Deletar projeto |

### Canvas / Whiteboard (8 tools)
| Tool | O que faz |
|------|-----------|
| `canvas-create` | Criar whiteboard |
| `canvas-list` | Listar projetos |
| `canvas-list-projects` | Listar com summary de node types |
| `canvas-get` | Detalhar (nodes, edges, drawings) |
| `canvas-update` | Atualizar nodes/edges/linkedGuideline |
| `canvas-delete` | Deletar |
| `canvas-share` | Compartilhar (canEdit/canView por email) |
| `canvas-parse-csv` | Preview CSV → DataNode rows |
| `canvas-resolve-variables` | Resolver `{{placeholders}}` em prompt |

### Budget (6 tools)
| Tool | O que faz |
|------|-----------|
| `budget-create` | Criar orçamento (clientName, projectDescription) |
| `budget-list` | Listar orçamentos |
| `budget-get` | Detalhar com line items |
| `budget-update` | Atualizar campos |
| `budget-delete` | Deletar |
| `budget-duplicate` | Duplicar |

### AI Utilities (grátis)
| Tool | O que faz |
|------|-----------|
| `ai-describe-image` | Descrever imagem (URL ou base64). 0 créditos. |
| `ai-improve-prompt` | Melhorar prompt text. 0 créditos. |

> **Lei da casa — prompt gerado, prompt salvo.** Toda chamada de
> `ai-generate-image` / `creative-generate` / `mockup-generate` / `video-generate`
> vai pro ledger `prompts.jsonl` do projeto: uma linha por chamada, com
> modelo/params, refs **com o papel de cada uma**, `sha256` da saída, status
> (aprovado/descartado), custo, e a nota do que deu errado nas descartadas.
> Registrar na hora — depois não é recuperável. Contrato em
> `visant-mockup-creator/references/prompt-ledger.md`; implementação pronta pra
> copiar em `projeto-cliente/tools/registrar-prompt.py`.

### Document & Image Extraction
| Tool | O que faz |
|------|-----------|
| `document-extract` | **Dual-mode:** (1) URL mode — extrai imagens HD de qualquer URL pública (Behance, Pinterest, Dribbble, portfolios). Params: `url` + `limit` (max 200). Retorna lista de image URLs com metadata. Suporta lazy-load, srcset, background images. (2) PDF mode — extrai PDF → markdown + brand tokens (2-phase: algorithmic + Gemini). Params: `pdf_path` ou `pdf_base64` + `output` (disk/inline). |

### Moodboard (3 tools)
| Tool | O que faz |
|------|-----------|
| `moodboard-detect-grid` | Detectar bounding boxes em moodboard grid |
| `moodboard-suggest` | Sugerir animações/vídeo para cada cell |
| `moodboard-upscale` | Upscale imagem para 1K/2K/4K. **⚠ Instável — devolveu `INTERNAL_ERROR` em 3/3 chamadas em ago/2026.** Ver "Quando a ferramenta cai" abaixo. |

### Quando a ferramenta cai

Ferramenta de MCP quebra, e a resposta certa nunca é insistir nem fingir que o
resultado saiu. Regra da casa:

1. **Duas tentativas, não mais.** `INTERNAL_ERROR` repetido é servidor, não
   payload — tentar uma terceira só queima tempo.
2. **Use a alternativa e diga qual usou.** Nunca troque em silêncio: quem lê o
   resultado precisa saber por qual caminho ele veio.
3. **Reporte a quebra** no `.md` do trabalho, com a data e a mensagem exata.

| Se cair | Alternativa |
|---|---|
| `moodboard-upscale` | Procure o ORIGINAL em alta antes de ampliar — quase sempre existe e ninguém olhou (rode [[visant-preflight]]). Só depois considere ampliação. Ampliar já é o plano B; ampliar sem ter procurado o original é plano C disfarçado de A. |
| `ai-generate-image` cai no modelo errado | O retorno traz `fellBack: true` e o `model` real. **Leia o retorno** — pedir gemini e receber gpt-image-1 muda o resultado e o custo. |
| `brand-guidelines-health-check` | Não confie nele; confira com `brand-guidelines-get`. Ele já reportou vault vazio com vault cheio. |
| Upload de arquivo local | `visant upload <file> --json` pelo CLI, ou presigned URL (`media-upload-urls` + `curl -X PUT` + `media-commit`). Base64 inline trunca e sobe imagem corrompida. |

### Community (2 tools)
| Tool | O que faz |
|------|-----------|
| `community-presets` | Browse presets públicos de mockup |
| `community-profiles` | Browse perfis da comunidade |

---

## Document Extract (dual-mode)

### Mode 1 — Image extraction from URL
```json
{ "url": "https://www.behance.net/gallery/...", "limit": 80 }
```
Retorna lista de image URLs com width, height, alt text. Funciona com Behance, Pinterest, Dribbble, portfolios, blogs. Suporta lazy-loaded images, srcset, e background images. Scope: `read`.

### Mode 2 — PDF extraction
```json
{ "pdf_base64": "<base64>", "output": "inline", "include_brand_tokens": true }
```
Também aceita `pdf_path` para arquivos no servidor. `output: "disk"` salva `.md`, `"inline"` retorna texto. `include_brand_tokens: true` extrai cores, tipografia, estratégia.

---

## Token expirado / 401

```bash
cat ~/.visant/credentials.json   # extrai .apiKey
```

Atualize o Bearer no MCP config e reinicie a sessão. Se não existir: `npx visantlabs login`.

---

## Dicas de uso

- **Brand context em geração**: passe `brandGuidelineId` em mockup-generate, creative-full, creative-generate para injetar cores/tipografia/voz automaticamente.
- **format: "prompt"** no `brand-guidelines-get` retorna texto otimizado para LLM context, não JSON.
- **creative-full** é o atalho — evita encadear generate + mockup-generate + render manualmente.
- **Créditos**: `account-usage` mostra saldo. AI utilities (describe-image, improve-prompt) são grátis.
- **Scope enforcement**: tokens OAuth respeitam scopes `read`, `write`, `generate` — tools de geração requerem scope `generate`.
