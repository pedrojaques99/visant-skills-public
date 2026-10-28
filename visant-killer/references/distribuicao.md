# Distribuição — a página existe fora dela mesma?

A casa tinha régua rigorosa pra pixel, motion e acabamento, e nada pra metadata,
card de compartilhamento, evento de conversão, sitemap e robots. Numa sessão
real esse foi o P0 que separou "bonita na landing" de "encontrável", e quem
chegou nele chegou **por fora** das skills.

A assimetria é o argumento inteiro. Um erro de token custa um pixel. Um
`og:image` faltando custa a taxa de clique de **todo link compartilhado** — e
não aparece em nenhuma tela que você abra, em nenhum linter que você rode, em
nenhuma screenshot que você tire.

## O portão

```bash
node ~/.claude/skills/visant-killer/scripts/dist-scan.mjs <raiz-do-app>
node ~/.claude/skills/visant-killer/scripts/dist-scan.mjs --self-test
```

Exit 1 em qualquer HIGH. Roda em superfície de aquisição (A) sempre; em B e C só
o bloco de identidade (`title`, `lang`, favicon), porque tela atrás de login não
é indexada e cobrar SEO dela é ruído.

## O que cada achado custa

| Regra | Nível | O que se perde |
|---|---|---|
| `sem-metadata` | HIGH | busca e compartilhamento leem o nome do arquivo |
| `title-placeholder` | HIGH | "Create Next App" já foi pro ar mais de uma vez |
| `sem-og-image` | HIGH | link compartilhado sem card: metade do clique |
| `og-relativo-sem-metadataBase` | HIGH | a URL do card aponta pra `localhost` em produção. O build só avisa |
| `sem-description` | HIGH | o texto do resultado de busca vira o primeiro parágrafo que o Google achar |
| `conversao-nao-medida` | HIGH | a tela converte e ninguém sabe quanto |
| `rota-sem-titulo-proprio` | MEDIUM | rotas públicas com o mesmo `title` competem entre si |
| `sem-sitemap` / `sem-robots` | MEDIUM | descoberta depende só de link externo |
| `sem-lang` | MEDIUM | leitor de tela e tradutor erram o idioma |
| `sem-favicon` | LOW | sem marca na aba e no bookmark |

## O que o detector NÃO pega, e você precisa ver

1. **O card renderizado.** `og:image` existir não é `og:image` bonito. Abra
   `https://www.opengraph.xyz` ou cole o link num rascunho de WhatsApp. Texto
   cortado e logo esmagado passam por qualquer script.
2. **O título lido em voz alta.** 60 chars é o corte do Google. `description`
   entre 120 e 160. Fora disso trunca com reticências no meio da frase.
3. **O evento na ferramenta.** O detector vê a *chamada*; só o painel prova que
   o evento **chega**. Dispare uma vez de verdade e confira.
4. **O que o evento nomeia.** `click_button` não responde nada. `lead_enviado`,
   `checkout_iniciado`, `plano_escolhido` respondem — o nome do evento é a
   pergunta de negócio que você vai poder fazer daqui a um mês.

## A ordem certa

Distribuição entra **antes** do burilamento, não depois. É a inversão que a
sessão real acertou tarde: passar uma tarde em token de cor numa página que
compartilha sem card é otimizar o interior de uma casa sem porta.

Na prática, para superfície de aquisição:

1. `dist-scan` limpo de HIGH
2. card visto renderizado, título e description lidos
3. um evento disparado de verdade e conferido no painel
4. **só então** `killer-scan`, `motion-lint` e o resto
