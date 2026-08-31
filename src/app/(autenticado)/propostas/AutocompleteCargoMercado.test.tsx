import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

// Mocka a Server Action: o componente não deve depender do backend real nem do
// Prisma/Clerk para estes testes de comportamento de UI. Cada teste controla o
// que a busca resolve.
const buscarMock = vi.fn();
vi.mock('./estrutura-actions', () => ({
  buscarCargoMercadoCatalogo: (termo: string) => buscarMock(termo),
}));

import { AutocompleteCargoMercado } from './AutocompleteCargoMercado';

/**
 * Wrapper controlado que espelha o uso real no CargoPanel: mantém o valor do
 * campo em estado e o expõe, para que os testes possam afirmar exatamente o que
 * seria persistido (o que o onChange propagou), não só o que está no input.
 */
function Harness({ inicial = '' }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial);
  return (
    <div>
      <AutocompleteCargoMercado value={valor} onChange={setValor} />
      <output data-testid="valor-persistido">{valor}</output>
    </div>
  );
}

function ok(dados: Array<{ codigoOrigem: string; nome: string }>) {
  return { sucesso: true as const, dados };
}

beforeEach(() => {
  buscarMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('AutocompleteCargoMercado [ADR-047/US-139]', () => {
  it('CT-139-06 — sugere do catálogo e, no clique, preenche o campo com o nome exato do candidato', async () => {
    const user = userEvent.setup();
    buscarMock.mockResolvedValue(
      ok([
        { codigoOrigem: '001', nome: 'Analista de Sistemas' },
        { codigoOrigem: '002', nome: 'Analista Contábil' },
      ]),
    );

    render(<Harness />);
    await user.type(screen.getByRole('textbox'), 'ana');

    const opcao = await screen.findByRole('button', { name: 'Analista de Sistemas' });
    await user.click(opcao);

    expect(screen.getByRole('textbox')).toHaveValue('Analista de Sistemas');
    expect(screen.getByTestId('valor-persistido')).toHaveTextContent('Analista de Sistemas');
    // Dropdown fecha após a seleção.
    expect(screen.queryByRole('button', { name: 'Analista Contábil' })).not.toBeInTheDocument();
  });

  it('CT-139-07 — NUNCA sobrescreve a digitação manual: sem clique, o valor persistido é exatamente o texto digitado', async () => {
    const user = userEvent.setup();
    // Mesmo havendo candidatos parecidos, nenhum clique acontece.
    buscarMock.mockResolvedValue(ok([{ codigoOrigem: '001', nome: 'Analista de Sistemas' }]));

    render(<Harness />);
    const input = screen.getByRole('textbox');
    const digitado = 'Cargo Interno XPTO';
    await user.type(input, digitado);

    // Deixa as sugestões chegarem e a lista abrir...
    await screen.findByRole('button', { name: 'Analista de Sistemas' });
    // ...e então sai do campo (blur) sem selecionar nada.
    await user.tab();

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Analista de Sistemas' })).not.toBeInTheDocument(),
    );
    expect(input).toHaveValue(digitado);
    expect(screen.getByTestId('valor-persistido')).toHaveTextContent(digitado);
  });

  it('CT-139-08 — não busca com menos de 2 caracteres e mantém o dropdown fechado', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole('textbox'), 'a');
    // 1 caractere cai no early-return (< TAMANHO_MINIMO_TERMO): o debounce nem
    // chega a ser agendado. A espera (bem acima dos 300ms de debounce) garante
    // que, se a busca fosse agendada, ela já teria disparado — e não disparou.
    await new Promise((r) => setTimeout(r, 500));
    expect(buscarMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/nenhum cargo|buscando/i)).not.toBeInTheDocument();
  });

  it('CT-139-09 — termo sem correspondência exibe "Nenhum cargo encontrado" e o campo segue livre', async () => {
    const user = userEvent.setup();
    buscarMock.mockResolvedValue(ok([]));

    render(<Harness />);
    await user.type(screen.getByRole('textbox'), 'zzz');

    expect(await screen.findByText('Nenhum cargo encontrado no catálogo.')).toBeInTheDocument();
    expect(screen.getByTestId('valor-persistido')).toHaveTextContent('zzz');
  });

  it('CT-139-11 — resposta de busca fora de ordem (debounce) não sobrescreve o resultado do termo atual', async () => {
    // Cenário do achado de code-review: a busca do termo antigo resolve DEPOIS
    // da busca do termo atual; a resposta obsoleta deve ser descartada.
    let resolveAntigo: (v: unknown) => void = () => {};
    const respostaAntiga = new Promise((r) => {
      resolveAntigo = r;
    });

    buscarMock.mockImplementation((termo: string) => {
      if (termo === 'ana') return respostaAntiga; // fica pendente de propósito
      return Promise.resolve(ok([{ codigoOrigem: '900', nome: 'Analista Pleno' }])); // "analista"
    });

    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('textbox');

    // Digita "ana" e ESPERA o debounce disparar de fato a busca (senão o timer de
    // "ana" seria cancelado pela digitação seguinte e o cenário nunca ocorreria).
    await user.type(input, 'ana');
    await waitFor(() => expect(buscarMock).toHaveBeenCalledWith('ana'));

    // Agora a busca de "ana" está pendente (respostaAntiga). Continua até
    // "analista", cuja busca resolve na hora.
    await user.type(input, 'lista');
    await waitFor(() => expect(buscarMock).toHaveBeenCalledWith('analista'));

    const opcaoAtual = await screen.findByRole('button', { name: 'Analista Pleno' });
    expect(opcaoAtual).toBeInTheDocument();

    // Só agora a busca antiga ("ana") resolve, com resultado obsoleto e diferente.
    resolveAntigo(ok([{ codigoOrigem: '001', nome: 'Auxiliar Administrativo' }]));

    // A resposta obsoleta é descartada: a lista continua a do termo atual.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Auxiliar Administrativo' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Analista Pleno' })).toBeInTheDocument();
  });
});
