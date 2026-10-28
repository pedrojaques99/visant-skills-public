/**
 * A SEGUNDA PONTA da R9 (`porta-repetida`), que só existe fora do primeiro
 * arquivo — é o ponto da regra: o defeito não cabe num arquivo, e por isso
 * passou por sete detectores.
 *
 * Este arquivo é de propósito o menor possível. Tudo que entra aqui entra no
 * self-test das outras regras também, e fixture que cresce sem motivo faz o
 * número esperado de todas elas mudar junto.
 */
export function PortaDaCaixa() {
  return <input type="text" placeholder="endereço da faixa" />;
}
