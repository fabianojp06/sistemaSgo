import { describe, expect, it, vi } from 'vitest';
import { CriarUsuarioUseCase } from './CriarUsuarioUseCase';
import { LoginJaExisteError } from '@/domain/administracao/errors';
import type { CriarUsuarioInput } from './dtos';

function criarDeps(opts: { loginEmUso?: boolean; emailEmUso?: boolean } = {}) {
  const tx = {
    usuario: { upsert: vi.fn(() => Promise.resolve({ id: 'u1' })) },
    historicoOperacao: { create: vi.fn(() => Promise.resolve({})) },
  };
  const prisma = {
    usuario: {
      findFirst: vi.fn(({ where }: { where: { login?: string; email?: string } }) => {
        if (where.login) return Promise.resolve(opts.loginEmUso ? { id: 'x' } : null);
        if (where.email) return Promise.resolve(opts.emailEmUso ? { id: 'y' } : null);
        return Promise.resolve(null);
      }),
    },
    $transaction: vi.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };
  const identidade = {
    criarIdentidade: vi.fn(() => Promise.resolve({ clerkUserId: 'ck1' })),
    excluirIdentidade: vi.fn(() => Promise.resolve()),
  };
  const associarPerfis = { execute: vi.fn(() => Promise.resolve()) };
  const definirExcecoes = { execute: vi.fn(() => Promise.resolve()) };
  const gerarAcessoInicial = { execute: vi.fn(() => Promise.resolve({ situacaoAcesso: 'CONVITE_PENDENTE' })) };
  return { prisma, identidade, associarPerfis, definirExcecoes, gerarAcessoInicial, tx };
}

const input: CriarUsuarioInput = {
  tenantId: 't1',
  executorId: 'exec',
  clerkSessionId: 'sess',
  ipEstacao: '1.2.3.4',
  nomeCompleto: 'João da Silva',
  email: 'j.silva@fsg.org.br',
  login: 'j.silva',
  status: 'ATIVO',
  perfis: ['p1'],
  excecoes: [],
};

function montar(d: ReturnType<typeof criarDeps>) {
  return new CriarUsuarioUseCase(
    d.prisma as never,
    d.identidade as never,
    d.associarPerfis as never,
    d.definirExcecoes as never,
    d.gerarAcessoInicial as never,
  );
}

describe('CriarUsuarioUseCase [US-201]', () => {
  it('cadastro válido: cria identidade, persiste na transação e retorna a situação', async () => {
    const d = criarDeps();
    const resultado = await montar(d).execute(input);

    expect(d.identidade.criarIdentidade).toHaveBeenCalledOnce();
    expect(d.tx.usuario.upsert).toHaveBeenCalledOnce();
    expect(d.associarPerfis.execute).toHaveBeenCalledOnce();
    expect(d.gerarAcessoInicial.execute).toHaveBeenCalledOnce();
    expect(resultado).toEqual({ usuarioId: 'u1', situacaoAcesso: 'CONVITE_PENDENTE' });
    expect(d.identidade.excluirIdentidade).not.toHaveBeenCalled();
  });

  it('login já existente: bloqueia antes de tocar o Clerk (RN0065)', async () => {
    const d = criarDeps({ loginEmUso: true });
    await expect(montar(d).execute(input)).rejects.toBeInstanceOf(LoginJaExisteError);
    expect(d.identidade.criarIdentidade).not.toHaveBeenCalled();
  });

  it('falha na persistência após criar identidade: executa a compensação (excluirIdentidade)', async () => {
    const d = criarDeps();
    d.associarPerfis.execute.mockRejectedValueOnce(new Error('falha no banco'));

    await expect(montar(d).execute(input)).rejects.toThrow('falha no banco');
    expect(d.identidade.criarIdentidade).toHaveBeenCalledOnce();
    expect(d.identidade.excluirIdentidade).toHaveBeenCalledWith('ck1');
  });
});
