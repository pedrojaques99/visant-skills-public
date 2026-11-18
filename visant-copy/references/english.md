# Writing English copy

The same voice, carried into English. The punctuation bans (dash, separator dot,
semicolon, emoji) live once, in [SKILL.md](../SKILL.md#the-prohibitions). Below is
only the English wording that `copy-lint` catches with its `en-` rules, and the
voice notes no linter catches.

## English wording

Absolute, in the same places as the Portuguese list.

1. **"It's not X, it's Y" never**, split or not ("This isn't a list. It's a
   cascade."). Cut the negative half and say Y. (`en-not-x-but-y`)
2. **"Not just X, but Y" / "more than just" never.** It promises depth and
   delivers none. (`en-not-just`, `en-more-than-just`)
3. **"It's about X" / "isn't about X" never.** Use the verb of what the thing
   does. (`en-all-about`, `en-not-about`)
4. **Hype never**: unlock your potential, unleash, supercharge, revolutionary,
   game-changer, next-level, cutting-edge, seamless experience, elevate your,
   empower you, transform your, in today's fast-paced world. Swap it for a fact
   or a number. (`en-hype`)
5. **Guru openers never**: "Imagine a world", "What if I told you", "Let's dive
   in", "Here's the thing", "Picture this". Start with the fact or the scene.
   (`en-guru-opener`)
6. **Stock connectors never at sentence start**: Moreover, Furthermore,
   Additionally, Ultimately, In conclusion, It's worth noting. Start with the
   subject. (`en-llm-connector`)
7. **Generic urgency never**: limited time only, act now, don't miss out, last
   chance. Scarcity must be countable: "this batch has 30 seats".
   (`en-generic-urgency`)
8. **Credibility seal at most once per piece**: truly, genuinely, authentic,
    honestly, real. An adjective does not prove; numbers and scenes do.
    "Seven years of real projects" becomes "Seven years shipping brands".
    (`credibility-seal`)

**The rule that solves 1 to 3: cut the negative half.** The sentence that
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

The signed register exists in English too: first person, an opinion with an
owner, a parenthesis that talks back, one long and oddly precise analogy. See
[voice.md, section 8](voice.md#8-signed-register-from-the-originals).

## The fold names the task

Same rule as in Portuguese (see SKILL.md): the H1, the `<title>` and the social
card say what the reader gets done, not the state of the product. "Turn your
brand into a site in a week", not "The future of brand websites".

## Run the linter

```bash
node <skill-dir>/scripts/copy-lint.mjs src/ content/
```

Both rule sets run on every file, so a bilingual site needs one call.
