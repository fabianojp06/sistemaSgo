import { describe, expect, it } from 'vitest';
import { parsePlanoContas } from './PlanoContasArquivoProvider';

describe('parsePlanoContas', () => {
  it('ignora linhas de ruído de cabeçalho/rodapé', () => {
    const conteudo = [
      'DSMP301.GER - Assuntos/Modelos de Planos - 16/07/2026 - 08:56 Usuário: carmenclo',
      '0303Plano Financeiro CTCEA Plano  Financeiro - CTCEA Pág.:   5',
      'Classificação Reduzida Descrição Tipo Nível NaturezaContabil',
      '1.9    1.692   DESPESAS ORÇAMENTÁRIAS S 2 D      870',
    ].join('\n');

    const contas = parsePlanoContas(conteudo);

    expect(contas).toHaveLength(1);
    expect(contas[0].codigoErp).toBe('1.9');
  });

  it('marca isAnalitica corretamente por tipo S/A', () => {
    const conteudo = [
      '1.9    1.692   DESPESAS ORÇAMENTÁRIAS S 2 D      870',
      '1.9.11    1.702      DESPESAS DE PESSOAL S 3 D      890',
      '1.9.11.001    1.712         Salários A 4 D      900',
    ].join('\n');

    const contas = parsePlanoContas(conteudo);

    expect(contas.find((c) => c.codigoErp === '1.9')?.isAnalitica).toBe(false);
    expect(contas.find((c) => c.codigoErp === '1.9.11')?.isAnalitica).toBe(false);
    expect(contas.find((c) => c.codigoErp === '1.9.11.001')?.isAnalitica).toBe(true);
  });

  it('derives codigoPaiErp removendo o último segmento', () => {
    const conteudo = [
      '1.9    1.692   DESPESAS ORÇAMENTÁRIAS S 2 D      870',
      '1.9.11    1.702      DESPESAS DE PESSOAL S 3 D      890',
      '1.9.11.001    1.712         Salários A 4 D      900',
    ].join('\n');

    const contas = parsePlanoContas(conteudo);

    expect(contas.find((c) => c.codigoErp === '1.9.11')?.codigoPaiErp).toBe('1.9');
    expect(contas.find((c) => c.codigoErp === '1.9.11.001')?.codigoPaiErp).toBe('1.9.11');
  });

  it('define codigoPaiErp como null quando o pai não existe na lista carregada', () => {
    const conteudo = '1.9.11    1.702      DESPESAS DE PESSOAL S 3 D      890';

    const contas = parsePlanoContas(conteudo);

    expect(contas[0].codigoPaiErp).toBeNull();
  });

  it('preserva descrições com múltiplos tokens e espaços internos', () => {
    const conteudo = '1.9.11.009    1.792         Vale-Refeição / Alimentação A 4 D      971';

    const contas = parsePlanoContas(conteudo);

    expect(contas[0].nomeConta).toBe('Vale-Refeição / Alimentação');
  });

  it('preserva descrições que começam com número', () => {
    const conteudo = '1.9.11.005    1.752         13 Salário A 4 D      940';

    const contas = parsePlanoContas(conteudo);

    expect(contas[0].nomeConta).toBe('13 Salário');
  });
});
