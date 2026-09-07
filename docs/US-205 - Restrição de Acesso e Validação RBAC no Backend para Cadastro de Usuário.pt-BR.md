## [US-205] — Restrição de Acesso e Validação RBAC no Backend para Cadastro de Usuário

**Módulo:** Administração — Operadores e Permissões
**Épico:** EP085/24 — Módulo de Administração
**Caso de uso:** UC02.12 — Cadastrar Usuários (guarda transversal; base de UC02.10/UC02.11/UC02.13)
**Prioridade:** Alta
**Estimativa:** P

**Como** responsável pela segurança do SGO,
**Quero** que o cadastro de usuários só seja executável por quem tem perfil de Administrador, validado no backend,
**Para** impedir a criação de contas por usuários não autorizados, mesmo via chamada direta à Server Action / API (RNF0004 do EP085, RN0022 do EP083).

### Contexto e Regras de Negócio

O módulo de Administração é acessível **apenas** ao perfil Administrador (RN_SEED_003, considerações gerais do EP085). Ocultar o botão/menu na UI não basta: toda Server Action de escrita e leitura sensível do módulo deve revalidar a autorização no servidor a cada requisição.

O helper `guardAdministrador()` (criado na **fundação** e já chamado por todas as actions de [[US-201]], [[US-202]], [[US-204]]) executa:

1. `auth()` do Clerk — exige sessão válida (`userId`);
2. `ehAdministrador(user)` — `publicMetadata.role === 'ADMIN'` (fonte: `src/infrastructure/auth/clerk.ts`);
3. revalidação no banco: existe `UsuarioPerfil` do `usuarioId` com `Perfil.nome = "Administrador"` no `tenantId` corrente;
4. retorna `{ tenantId, usuarioId, clerkSessionId }` ou lança `NaoAutorizadoError`.

Esta US entrega o **hardening e a cobertura E2E** do guard; o núcleo do helper já entra na fundação para não bloquear as frentes.

### Critérios de Aceite

**Cenário 1 — Usuário sem perfil Administrador não vê a funcionalidade**
```gherkin
Dado que o usuário autenticado possui apenas o perfil "Orçamentista"
Quando ele navega pelo sistema
Então o menu "Administração" não é exibido (ObterMenuUsuarioUseCase não retorna o módulo)
  E a rota /administracao/usuarios não é acessível pela navegação
```

**Cenário 2 — Chamada direta à Server Action por não-Administrador [TRAVA O ERRO]**
```gherkin
Dado que um usuário sem perfil Administrador dispara a Server Action de cadastro com payload válido
Quando o backend processa a requisição
Então guardAdministrador() lança NaoAutorizadoError antes de qualquer efeito
  E a action responde { sucesso: false, mensagem: "Você não tem permissão para esta operação." }
  E nenhuma conta é criada no Clerk nem no banco local
  E a tentativa é registrada (console.error / SysLog — UC02.21)
```

**Cenário 3 — publicMetadata.role adulterado mas sem perfil no banco [TRAVA O ERRO]**
```gherkin
Dado que o token traz publicMetadata.role="ADMIN" porém o usuário não tem UsuarioPerfil "Administrador" no tenant
Quando a action processa
Então a revalidação no banco (passo 3) falha e a operação é bloqueada
```

**Cenário 4 — Sessão expirada / ausente**
```gherkin
Dado que a sessão do Administrador expirou
Quando ele tenta salvar um cadastro
Então guardAdministrador() lança NaoAutorizadoError (auth() sem userId)
  E a UI redireciona para /login
  E nenhum dado é persistido
```

**Cenário 5 — Isolamento de tenant**
```gherkin
Dado que o Administrador do tenant A dispara a action com dados destinados ao tenant B
Quando o backend processa
Então o tenantId usado é sempre o resolvido por getTenantId() da requisição (tenant A)
  E não é possível criar usuário em outro tenant via payload
```

**Cenário 6 — Sistema INATIVO (UC02.01 / RN0060)**
```gherkin
Dado que o SGO está com status INATIVO
Quando o Administrador executor acessa /administracao/usuarios
Então o cadastro permanece acessível a ele (acesso restrito ao módulo de Administração, RN0060)
```

### Impacto Técnico (orientação para dev)

| Aspecto | Detalhe |
|---|---|
| Componente | `guardAdministrador()` em `app/(autenticado)/administracao/usuarios/actions/guard.ts` (ou `lib/auth/` se reaproveitado por outros módulos) |
| Camadas | guard roda no topo de toda action do módulo, antes de use-case/DB. Nunca confiar só em `publicMetadata` — sempre revalidar no banco (passo 3) |
| Multi-tenant | `tenantId` sempre de `getTenantId()`, nunca do payload (Cenário 5) |
| Proteção de rota | `app/(autenticado)/administracao/layout.tsx` (ou o layout existente + checagem) nega render de Server Component para não-Administrador; complementa (não substitui) o guard nas actions |
| Auditoria | tentativa negada ⇒ `console.error` + (quando SysLog/UC02.21 existir) registro com ator, IP, timestamp |
| Regra de negócio | RNF0004 (EP085), RN0022 (EP083), RN_SEED_003, RN0060 |
| Testes | E2E com usuário não-Administrador chamando a action diretamente; unit test do guard com os 4 caminhos de falha |

### Dependências

- **Fundação UC02.12** — núcleo do `guardAdministrador()` + `NaoAutorizadoError` + scaffold de `layout.tsx` da rota `/administracao`
- `ehAdministrador()` e `auth()` já existentes
- Seed já cria o perfil "Administrador" por tenant e o atribui a quem tem `role: 'ADMIN'`

### Definition of Done

- [ ] Cenários 1 a 6 aprovados em homologação
- [ ] Bloqueio validado no backend com teste automatizado de chamada direta à action (Cenário 2 e 3)
- [ ] Revalidação no banco além do `publicMetadata` (Cenário 3)
- [ ] `tenantId` sempre da requisição, nunca do payload (Cenário 5)
- [ ] Menu e rota ocultos/negados para não-Administrador
- [ ] Tentativas negadas registradas
- [ ] Administrador mantém acesso ao módulo com sistema INATIVO (RN0060)
