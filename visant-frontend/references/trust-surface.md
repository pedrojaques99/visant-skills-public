# Trust surfaces

Billing, destructive actions, data writes, settings, confirmations. Revenue
variable: **retention and money not lost**.

Density is irrelevant here. Persuasion is inappropriate. What matters is that the
user's mental model matches what actually happens, and that mistakes are
survivable.

- [The UI must not lie to the database](#the-ui-must-not-lie-to-the-database)
- [Confirmations](#confirmations)
- [Destructive actions](#destructive-actions)
- [Reversibility buys aggression](#reversibility-buys-aggression)
- [Gates live on the server](#gates-live-on-the-server)

## The UI must not lie to the database

This is principle 9, and it is the reason trust surfaces are a revenue class
rather than a correctness footnote.

Observed failure: a "contact via WhatsApp and mark as contacted" action ran its
`markAsContacted()` write unconditionally, including when the record had no
WhatsApp link and the window never opened. The button was disabled in that case —
but the keyboard shortcut bypassed the disabled state and called the handler
anyway.

The consequence is not a broken button. It is a **conversion rate computed from
contacts that never happened** — the number used to judge every other decision in
the product. You cannot optimize a metric you are falsifying.

Rules:

- A write that represents a real-world side effect must be guarded by the same
  condition as the side effect, **in the handler**, not only in the disabled
  state of a control.
- Shortcuts and menu items are separate entry points to the same handler. Guard
  the handler, never the entry points.
- Optimistic UI is fine for *display*. It is not fine for a write that feeds a
  business metric — reconcile before counting.
- When an action is impossible, remove the primary affordance entirely and offer
  what is possible (copy the phone number) rather than presenting a disabled
  promise.

## Confirmations

A confirmation that describes the wrong consequence is worse than no
confirmation: it trains the user to click through, and it lies at the exact
moment they were trying to be careful.

Observed failure: a delete dialog written for a *lead* was reused to delete a
*post*, so it read *"this deletes the lead permanently… it may come back as a new
lead"* while actually deleting the post **and every lead the post produced**.

Rules:

- The description must name **what is deleted, what goes with it, and what it
  takes to get back**.
- A reusable confirmation component needs an overridable description. If a caller
  cannot state the true consequence, the component is being reused wrongly.
- Name the scale. "Delete all 280 leads" beats "Delete all". Read the count from
  the authoritative source, not the paginated view — a paginated count promises a
  smaller number than what is actually destroyed.
- State where the backup went, if there is one.

## Destructive actions

- Never adjacent to an innocuous action. Export and "delete everything" side by
  side on a toolbar is a mis-click waiting to happen; the destructive one belongs
  behind `⋯`, marked destructive.
- Never bound to a reflex key. See the keyboard section in
  [work-surface.md](work-surface.md) — `Backspace` collides with delete-word
  combos.
- Always labelled with its shortcut if it has one. An unannounced destructive
  shortcut is a trap.

## Reversibility buys aggression

Undo is what makes fast, aggressive interaction ethical. A queue that archives on
a single keypress is acceptable **because** the toast offers undo; without it,
the same interaction is reckless.

When adding a fast destructive path, add the undo in the same change. They are
one feature, not two.

## Gates live on the server

Entitlement, quota, and permission checks belong in the backend. The frontend
mirrors them for clarity; it never owns them.

Every entry point must pass the same gate — UI, API, MCP, background job. A real
review of this shape found billing bypassed through the API/MCP creation and
invitation paths while the UI enforced it correctly: the rule existed, one door
did not check it.

When adding a surface that touches a gated resource, enumerate the doors before
enumerating the screens.
