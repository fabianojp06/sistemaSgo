import { describe, expect, it, vi } from 'vitest';
import { CadastrarAliquotaImpostoUseCase } from './CadastrarAliquotaImpostoUseCase';
import {
  AliquotaImpostoNomeDuplicadoError,
  AliquotaImpostoForaDaFaixaError,
  AliquotaImpostoIssForaDaFaixaLegalError,
  AliquotaImpostoDataInicioRetroativaError,
  ContaSugeridaAliquotaImpostoNaoEncontradaError,
} from '@/domain/plano-contas/errors';

type AliquotaMock = { tenantId: string; nomeNormalizado: string };
type ContaMock = { id: string; tenantId: string; isAnalitica: boolean };

function criarPrismaMock(existentes: AliquotaMock[] = [], contas: ContaMock[] = []) {
  const criadas: unknown[] = [];
  const base = {
    aliquotaImpostoParametro: {
      findUnique: vi.fn(({ where }: { where: { tenantId_nomeNormalizado: AliquotaMock } }) => {
        const k = where.tenantId_nomeNormalizado;
        return Promise.resolve(
          existentes.find((e) => e.tenantId === k.tenantId && e.nomeNormalizado === k.nomeNormalizado) ?? null,
        );
      }),
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        const criada = { id: 'nova-1', ...data };
        criadas.push(criada);
        return Promise.resolve(criada);
      }),
    },
    contaContabil: {
      findFirst: vi.fn(({ where }: { where: { tenantId: string; id: string } }) => {
        const c = contas.find((c) => c.id === where.id && c.tenantId === where.tenantId);
        return Promise.resolve(c ? { id: c.id } : null);
      }),
    },
    historicoOperacao: { create: vi.fn(() => Promise.resolve({})) },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(base)),
  };
  return { base, criadas };
}

// Simula exatamente como o input chega do formulário: <input type="date"> -> "YYYY-MM-DD" ->
// z.coerce.date() -> Date constructor, que interpreta string date-only como meia-noite UTC.
function dataCalendarioUTC(offsetDias: number): Date {
  const hoje = new Date();
  const isoHoje = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  isoHoje.setUTCDate(isoHoje.getUTCDate() + offsetDias);
  return new Date(isoHoje.toISOString().slice(0, 10));
}

const inputBase = {
  tenantId: 't1',
  usuarioId: 'u1',
  nome: 'COFINS',
  aliquotaPct: '3.00',
  tipoIncidencia: 'AMBOS' as const,
  dataInicioVigencia: dataCalendarioUTC(1),
};

describe('CadastrarAliquotaImpostoUseCase', () => {
  it('cadastra com sucesso e grava auditoria', async () => {
    const { base, criadas } = criarPrismaMock();
    const useCase = new CadastrarAliquotaImpostoUseCase(base as never);

    const resultado = await useCase.execute(inputBase);

    expect(resultado.nome).toBe('COFINS');
    expect(criadas).toHaveLength(1);
    expect(base.historicoOperacao.create).toHaveBeenCalledOnce();
  });

  it('bloqueia nome duplicado case-insensitive', async () => {
    const { base } = criarPrismaMock([{ tenantId: 't1', nomeNormalizado: 'cofins' }]);
    const useCase = new CadastrarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute(inputBase)).rejects.toThrow(AliquotaImpostoNomeDuplicadoError);
  });

  it('bloqueia alíquota fora da faixa 0-100', async () => {
    const { base } = criarPrismaMock();
    const useCase = new CadastrarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, aliquotaPct: '105' })).rejects.toThrow(AliquotaImpostoForaDaFaixaError);
  });

  it('bloqueia ISS fora da faixa legal 2-5%', async () => {
    const { base } = criarPrismaMock();
    const useCase = new CadastrarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, nome: 'ISS', aliquotaPct: '6.5' })).rejects.toThrow(
      AliquotaImpostoIssForaDaFaixaLegalError,
    );
  });

  it('aceita ISS dentro da faixa legal', async () => {
    const { base } = criarPrismaMock();
    const useCase = new CadastrarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, nome: 'iss', aliquotaPct: '3.5' })).resolves.toBeDefined();
  });

  it('bloqueia data de início retroativa', async () => {
    const { base } = criarPrismaMock();
    const useCase = new CadastrarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, dataInicioVigencia: dataCalendarioUTC(-1) })).rejects.toThrow(
      AliquotaImpostoDataInicioRetroativaError,
    );
  });

  // Regressão de bug de QA: data de início = HOJE era rejeitada como retroativa em fusos
  // negativos (ex: UTC-3) porque a comparação usava setHours(0,0,0,0), que opera em hora
  // local — meia-noite UTC do input virava "ontem" no fuso local. Fix: comparar em UTC puro.
  it('aceita data de início = hoje (regressão de bug de fuso horário)', async () => {
    const { base } = criarPrismaMock();
    const useCase = new CadastrarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, dataInicioVigencia: dataCalendarioUTC(0) })).resolves.toBeDefined();
  });

  // ADR-038 revisão 2026-08-13 — deixou de bloquear conta analítica; contaSinteticaId
  // (nome do campo mantido, semântica agora é "conta sugerida de qualquer nível").
  it('aceita contaSinteticaId apontando para conta analítica', async () => {
    const { base } = criarPrismaMock([], [{ id: 'c1', tenantId: 't1', isAnalitica: true }]);
    const useCase = new CadastrarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, contaSinteticaId: 'c1' })).resolves.toBeDefined();
  });

  it('aceita contaSinteticaId apontando para conta sintética', async () => {
    const { base } = criarPrismaMock([], [{ id: 'c1', tenantId: 't1', isAnalitica: false }]);
    const useCase = new CadastrarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, contaSinteticaId: 'c1' })).resolves.toBeDefined();
  });

  it('bloqueia contaSinteticaId que não existe no tenant', async () => {
    const { base } = criarPrismaMock([], []);
    const useCase = new CadastrarAliquotaImpostoUseCase(base as never);

    await expect(useCase.execute({ ...inputBase, contaSinteticaId: 'inexistente' })).rejects.toThrow(
      ContaSugeridaAliquotaImpostoNaoEncontradaError,
    );
  });
});
