# Taste: rules from owner reviews

Each rule here came from an owner pointing at a real screen and saying what was wrong. They are house preferences, each backed by a reason you can test on the screen in front of you. They are generic on purpose: they hold for any product. Read this before cutting (Clean step 4) and before building a screen (End to end step 6). When a new review teaches something this file does not say, add it here in the same shape: the rule, the tell that breaks it, and what replaces it.

## 1. A sentence that explains the screen is a defect

**Exception first:** first use and onboarding may carry help. It is visual and inline (an example, a drawn hint), dismissible, and never a paragraph before the content.

**Tell:** a paragraph that teaches the user how to read the interface ("what has no lock is yours, what has a lock is…"). If the screen needs a manual, the screen is wrong.

**Instead:** say the state on the object itself. The lock, the price, the check, the dimmed thumb carry the meaning; the copy is gone. If one line survives, it is about the user's outcome, not about the UI's mechanics. The form of address can move between registers the way people talk; that is voice, not confusion. Confusion is the line about mechanics.

## 2. Counts and offers become objects

**Tell:** "5 tools, free, with the account you already have" as a line of text over a list.

**Instead:** show the five things. Each is a small object the user can touch (a thumb, ideally drawn in the product's idiom, 3D or physical if that is the brand's language), and the count is what the eye counts, not what it reads. Interactive beats descriptive: hover previews what the click opens. Minimal means fewer words, not fewer things.

## 3. One row, one frame

**Tell:** a single rail mixing product kinds (a course, an e-book, a video, a tool) with different aspect ratios, crops, borders and art styles, so the row reads as a pile. The same card shown at three widths across three screens.

**Instead:** within a row, every item shares the same frame: aspect ratio, crop, radius, border, shadow, the same empty-art state and the same hover. Different kinds either get one shared frame or their own rows. Pick one card width and keep it across screens; let the grid add columns instead of stretching the card.

## 4. Utility links are marks, not words

**Tell:** a footer or sidebar ending in a run of labels ("Credits Privacy Terms Newsletter").

**Instead:** social and external destinations are their logos; utility actions are icons with an accessible name and a tooltip. Legal links stay as text, small and last: people look for those words, not for a shape. The eye finds the rest by shape.

## 5. Empty is the biggest picture on the screen

**Tell:** an empty state that is a sentence explaining why it is empty, sitting in a box sized for content that is not there; a profile showing "0 / 0 / 0" in display weight.

**Instead:** the rule is [foundations §12](foundations.md#12-states), and here the object is the largest visual on the screen, drawn in the idiom. An empty social space is also a content problem: seed it before launch, the UI cannot fix a room nobody is in.

## 6. The real frame beats the drawn placeholder

**Tell:** a sales or feature page illustrated with abstract art, eyebrows in caps over every section ([limit](../../visant-frontend/references/acquisition-surface.md#the-micro-label-tax-eyebrows-and-letterspaced-mono)), numbered markers that are not a sequence, "before / after" labels on every row. The owner's word for it: generic.

**Instead:** frames taken from the product itself (a still from the lesson, a screenshot of the tool doing its job, the real file it outputs), each with a name and at most one line. Section titles only where the reader needs a handle. Text is the minimum that the frame cannot say. Reason: a frame from the product proves the claim, a drawing only asserts it.

## 7. A list that claims to be live is live

**Tell:** a members or activity list that claims to be live but someone has to update, or that shows only the owner's own test accounts. A stale list tells the visitor nobody is here. A curated page (team, about, credits) is allowed: it does not pretend to be live.

**Instead:** the list derives from real activity (who joined, who posted, who is in) and updates by itself. If people must opt in to be shown, the empty list says so with the invitation from rule 5, and the opt-in lives where people already are, not in a settings page they will never open.

## 8. A count peeks before it navigates

**Tell:** a badge (a bell, an inbox, a cart) whose click leaves for a full page, so checking what is new costs the work the user was in the middle of.

**Instead:** the click opens a small surface beside the badge with the latest few items, each opening where it happened, and the full page is one explicit action at its end ("See all"). It is the page, smaller: the same rows, the same order, the same "opening marks it read" ([foundations](foundations.md) §3, similarity). Its items load when it opens, not with the screen behind it.

## 9. What waits on the user shows what it asks

**Tell:** a question or an approval that blocks someone, listed like any message, with the context around it as its line and nothing saying it waits.

**Instead:** its line is the question itself, in full ink, with one state mark said once (a chip, a waiting face). Plain unread stays weight and a small mark, so the item that waits is the one the eye finds.

## 10. Navigation learns which, never where

**Tell:** a sidebar listing every tool in the same order for everyone, the five a person uses buried among ten they never open. The opposite failure: a menu that reorders itself by use, so the item is never where the hand remembers it.

**Instead:** a lean default (what waits on the user, plus the few they use most, learned from their own visits with recent use weighing more), everything else one click away in a "More". Learning decides which items are in sight, never their order. The set changes rarely (between sessions, and only when a newcomer clearly beats the weakest), never under the pointer. A place the person chose by hand always wins. With no history yet, start from the product's defaults.
