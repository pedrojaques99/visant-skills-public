# Writing English copy

The same voice, carried into English. The prohibitions are the ones `copy-lint`
enforces with its `en-` rules; the voice notes are what no linter catches.

## The prohibitions

Absolute, in headline, body, CTA, FAQ, email, alt text, error message and meta
description.

1. **Dash (— or –) never.** Period, comma, colon or parentheses. (`em-dash`)
2. **Separator dot (`·`) never.** "34 pages. 9 stages, 1 full case", not
   "34 pages · 9 stages". (`bullet-separator`)
3. **"It's not X, it's Y" never**, split or not ("This isn't a list. It's a
   cascade."). Cut the negative half and say Y. (`en-not-x-but-y`)
4. **"Not just X, but Y" / "more than just" never.** It promises depth and
   delivers none. (`en-not-just`, `en-more-than-just`)
5. **"It's about X" / "isn't about X" never.** Use the verb of what the thing
   does. (`en-all-about`, `en-not-about`)
6. **Hype never**: unlock your potential, unleash, supercharge, revolutionary,
   game-changer, next-level, cutting-edge, seamless experience, elevate your,
   empower you, transform your, in today's fast-paced world. Swap it for a fact
   or a number. (`en-hype`)
7. **Guru openers never**: "Imagine a world", "What if I told you", "Let's dive
   in", "Here's the thing", "Picture this". Start with the fact or the scene.
   (`en-guru-opener`)
8. **Stock connectors never at sentence start**: Moreover, Furthermore,
   Additionally, Ultimately, In conclusion, It's worth noting. Start with the
   subject. (`en-llm-connector`)
9. **Generic urgency never**: limited time only, act now, don't miss out, last
   chance. Scarcity must be countable: "this batch has 30 seats".
   (`en-generic-urgency`)
10. **Credibility seal at most once per piece**: truly, genuinely, authentic,
    honestly, real. An adjective does not prove; numbers and scenes do.
    "Seven years of real projects" becomes "Seven years shipping brands".
    (`credibility-seal`)
11. **Emoji never.** (`emoji`)

**The rule that solves 3 to 5: cut the negative half.** The sentence that
remains is almost always the right one. If the contrast is the argument, show
the consequence: not "It's not a talent problem, it's an order problem" but
"You already have the talent. What's missing is order."

## The voice

1. **Plain spoken English.** Contractions ("you'll", "it's"), short imperatives
   ("Read it and judge"). No slang that dates the page.
2. **Short sentence after short sentence**, around 12 words on average. A
   verbless fragment works as a punch after a long one: "...and the brand
   behaves differently three months later. Every time."
3. **Scene instead of adjective.** Not "brand inconsistency": "One post says one
   thing, support says another, the site looks like a different company."
4. **Blame starts with the author.** Confess before you charge: "We started with
   the logo too. Lost weeks that way, until we flipped the order."
5. **Raw numbers**, not rounded to impress: "$4,500", "160+ live sessions",
   "34 pages", "7 days".
6. **Admit limits.** "If something didn't work for us, the book says so." It is
   what most separates the voice from AI text.
7. **Humor aimed at the practice, never the person**, dry and unsignposted: "No
   40-hour course on centering a rectangle."
8. **Objections in the reader's words.** The FAQ is what the person thinks: "I've
   done branding for years. Is there anything new here?" The answer opens by
   answering ("Yes.", "It is."), never with "Great question".

## The fold names the task

Same rule as in Portuguese (see SKILL.md): the H1, the `<title>` and the social
card say what the reader gets done, not the state of the product. "Turn your
brand into a site in a week", not "The future of brand websites".

## Run the linter

```bash
node ~/.claude/skills/visant-copy/scripts/copy-lint.mjs src/ content/
```

Both rule sets run on every file, so a bilingual site needs one call.
