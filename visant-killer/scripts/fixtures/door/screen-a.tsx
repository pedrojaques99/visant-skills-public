/* repeated-door NEGATIVE: the same label on TWO SCREENS with no import
 * relation (the other end is screen-b.tsx). Real case from round 1: the category
 * field of the canvas and the Mockup Machine one. EXPECTED: zero. */
export function TelaA() {
  return <input placeholder="nome do preset" />;
}
