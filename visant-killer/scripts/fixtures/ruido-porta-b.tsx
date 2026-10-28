/**
 * The SECOND END of R9 (`repeated-door`), which only exists outside the first
 * file: that is the point of the rule. The defect does not fit in one file, and
 * that is why it got past seven detectors.
 *
 * This file is as small as possible on purpose. Everything here also goes into
 * the self-test of the other rules, and a fixture that grows for no reason makes
 * the expected count of all of them change together.
 */
export function PortaDaCaixa() {
  return <input type="text" placeholder="endereço da faixa" />;
}
