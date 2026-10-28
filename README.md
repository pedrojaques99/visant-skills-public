# visant-skills-public

Skills de [Claude Code](https://docs.claude.com/en/docs/claude-code/skills) da
[Visant](https://visantlabs.com): o sistema de decisão de interface, motion e
copy da casa, com os detectores executáveis que a gente roda antes de qualquer PR.

Este repo é um **espelho gerado**. A fonte é um repo privado que também tem
skill operacional (comercial, demanda de cliente, marca de cliente); o que chega
aqui passa por allowlist, redação de nome de cliente e scanner de segredo
(gitleaks). PR é bem-vindo; a mudança é portada pra fonte e volta no próximo export.

## O que tem aqui

| Skill | Pra quê |
|---|---|
| [`visant-killer`](visant-killer/SKILL.md) | auditoria de UI anti-slop: detectores como portão duro, julgamento, interrogatório adversarial e nota |
| [`visant-frontend`](visant-frontend/SKILL.md) | decisão de interface: cada escolha nomeia a variável de negócio que move |
| [`visant-motion`](visant-motion/SKILL.md) | tokens de easing/duração em CSS e framer-motion, `motion-lint`, medição de URL |
| [`visant-refine`](visant-refine/SKILL.md) | gráfico, gauge, sparkline, slider e tile de métrica com anatomia própria |
| [`visant-copy`](visant-copy/SKILL.md) | copy na voz falada brasileira, com `copy-lint` contra vício de IA |
| [`metodologia-visant`](metodologia-visant/SKILL.md) | as 9 etapas de construção de marca e a cascata de dependências |
| [`visant-preflight`](visant-preflight/SKILL.md) | pré-voo de projeto grande: perguntas ao dono + cinco checagens de premissa |
| [`visant-mcp-connect`](visant-mcp-connect/SKILL.md) | conectar e operar o MCP do Visant Labs |

As skills estão em português. Algumas citam skills da casa que não são
públicas (ex.: `visant-registry`, `visant-comercial`); dá pra ignorar a menção.

## Instalar

```bash
git clone https://github.com/pedrojaques99/visant-skills-public.git
# copie (ou faça link) das pastas que quiser pra ~/.claude/skills/
cp -r visant-skills-public/visant-killer ~/.claude/skills/
```

No Windows, `mklink /J %USERPROFILE%\.claude\skills\visant-killer <repo>\visant-killer`
mantém uma cópia só.

## Rodar os detectores

Node 20+. Sem build.

```bash
npm install
npm test                                              # self-tests de todos os detectores
node visant-killer/scripts/killer-scan.mjs <pasta-do-app>
node visant-motion/scripts/motion-lint.mjs <pasta-do-app>
node visant-copy/scripts/copy-lint.mjs <arquivo>
```

## Licença

MIT. Ver [LICENSE](LICENSE).
