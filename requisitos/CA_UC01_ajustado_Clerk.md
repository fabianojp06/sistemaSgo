# Critérios de Aceite Ajustados — UC01.01, UC01.02, UC01.05 (Clerk + Banco Próprio)

**Módulo:** Autenticação e Tela Principal (EP084/24)
**Documento fonte:** CA_UC01_01, CA_UC01_02, CA_UC01_05 (docs/) + [[RN_AUTH_Clerk_BancoProprio]]
**Formato:** BDD — Dado / Quando / Então
**Status:** Proposto — substitui, para fins de implementação, os critérios abaixo listados nos documentos originais em `docs/`. Critérios não listados aqui (ex: fluxo A1 "Esqueci minha senha", troca de senha obrigatória, tela principal) permanecem regidos pelos documentos originais até serem revisados em adendo próprio.
**Elaboração:** Analista de Negócios/PO (SGO 2.0)

---

## UC01.01 — Efetuar Login

### CA-01.01.02-rev — Login com credenciais válidas
```gherkin
Dado que o usuário está na tela de login
Quando preenche Login e Senha com credenciais válidas e clica em Entrar
Então o sistema deve, nesta ordem:
  1. Verificar em nosso banco: flag_manutencao, usuario.bloqueado, usuario.status
  2. Se todas as verificações passarem, delegar a validação de Login/Senha ao Clerk
  3. Se o Clerk confirmar a senha, criar a sessão (Clerk) e redirecionar para a Tela Principal [UC01.03]
E nenhuma chamada ao Clerk deve ocorrer se a etapa 1 falhar
```
**Referência:** REQ0041, RN0012-rev

### CA-01.01.07-rev / CA-01.01.08-rev — Credenciais inválidas (login inexistente ou senha incorreta)
```gherkin
Dado que o usuário informa um login inexistente no banco próprio, OU um login existente com senha incorreta segundo o Clerk
Quando clica em Entrar
Então o sistema deve exibir a mensagem genérica "Login ou senha inválidos"
E a mensagem não deve distinguir os dois cenários
E qualquer mensagem de erro bruta retornada pelo Clerk (ex: "no matching user", "form_password_incorrect") NUNCA deve ser exibida diretamente ao usuário — deve ser normalizada para a mensagem genérica
```
**Referência:** RN0015, RN0018/RN0021-rev

### CA-01.01.09-rev — Conta bloqueada
```gherkin
Dado que o usuário possui usuario.bloqueado = TRUE em nosso banco
Quando informa o login e qualquer senha e clica em Entrar
Então o sistema deve exibir a mensagem "Usuário bloqueado"
E o Clerk NUNCA deve ser chamado para validar a senha nesse caso
```
**Referência:** RN0018, RN0012-rev

### CA-01.01.10-rev — Sistema em manutenção
```gherkin
Dado que flag_manutencao = TRUE em nosso banco de parâmetros
E o usuário não possui role = 'ADMIN' nos metadados do Clerk
Quando tenta realizar login
Então o sistema deve exibir "Sistema está em manutenção"
E o Clerk NUNCA deve ser chamado nesse caso
```
**Referência:** RN0023, RN-NOVO-02

---

## UC01.02 — Autenticar Usuário

### CA-01.02.01-rev — Autenticação bem-sucedida
```gherkin
Dado que o sistema está ativo, sem flag de manutenção pendente para o usuário, com status ATIVO e bloqueado = FALSE em nosso banco
Quando o usuário informa senha correta E o Clerk confirma a autenticação
Então o sistema deve, na sequência:
  1. Zerar contador_falhas em nosso banco
  2. Registrar o evento LOGIN_SUCESSO em historico_operacao (nosso banco), com id_usuario, data_hora_evento (relógio do servidor), ip_estacao e o session id retornado pelo Clerk
  3. Permitir que a sessão do Clerk prossiga normalmente
```
**Referência:** FP passos 1–9, RN0012-rev, RN0024-rev

### CA-01.02.02-rev — Campos obrigatórios do registro de auditoria
```gherkin
Dado que uma autenticação foi concluída (sucesso ou falha)
Quando o sistema registra o evento em historico_operacao
Então o registro deve conter: id_usuario (nullable apenas se login não existir em nosso banco), data_hora_evento, ip_estacao, e o identificador de sessão do Clerk quando disponível
E nenhum destes campos, quando obrigatório para o tipo de evento, pode ser nulo
```
**Referência:** REQ0034, RN0102-rev

### CA-01.02.03-rev — Zeragem do contador de falhas
```gherkin
Dado que o usuário havia acumulado tentativas malsucedidas anteriores (contador_falhas > 0 em nosso banco)
Quando o Clerk confirma que a senha está correta
Então o contador_falhas deve ser zerado para 0 em nosso banco, exatamente após a confirmação do Clerk (nunca antes)
```
**Referência:** RN0025, RN0024-rev

### CA-01.02.04-rev / CA-01.02.05-rev — Sistema em manutenção (E1)
```gherkin
Dado que flag_manutencao = TRUE em nosso banco
Quando um usuário sem role = 'ADMIN' (metadado Clerk) tenta autenticar
Então o sistema deve rejeitar e retornar "Sistema está em manutenção" ao UC01.01
E o Clerk não deve ser chamado para validar senha ou status

Dado que flag_manutencao = TRUE em nosso banco
Quando um usuário com role = 'ADMIN' (metadado Clerk) tenta autenticar
Então o sistema deve prosseguir normalmente, delegando ao Clerk a validação de senha
```
**Referência:** RN0023, RN-NOVO-02, E1

### CA-01.02.06-rev — Login inexistente em nosso banco
```gherkin
Dado que o login informado não existe em nosso banco (tabela usuario)
Quando o backend processa a requisição
Então o sistema deve registrar LOGIN_FALHA em historico_operacao (id_usuario nulo, login_tentado em dados_serializados)
E retornar "Login ou senha inválidos"
E o Clerk NÃO deve ser chamado (evita side-effects/rate-limit no Clerk para logins que nem existem em nosso domínio)
```
**Referência:** RN0015, E2, RN0012-rev

### CA-01.02.07-rev — Conta inativa
```gherkin
Dado que o login existe em nosso banco mas usuario.status = 'INATIVO'
Quando o backend processa a requisição
Então o sistema deve registrar LOGIN_FALHA e retornar "Login ou senha inválidos"
E o Clerk NÃO deve ser chamado
```
**Referência:** RN0015, RN0021, E3, RN0012-rev

### CA-01.02.08-rev — Conta bloqueada
```gherkin
Dado que o login existe e usuario.bloqueado = TRUE em nosso banco
Quando o backend processa a requisição
Então o sistema deve rejeitar imediatamente, registrar a tentativa em historico_operacao e retornar "Usuário bloqueado"
E o Clerk NÃO deve ser chamado
```
**Referência:** RN0018, RN0021, E4, RN0012-rev

### CA-01.02.09-rev / CA-01.02.10-rev — Senha incorreta
```gherkin
Dado que o login existe, a conta está ATIVA e não bloqueada em nosso banco
Quando o Clerk informa que a senha está incorreta
Então o sistema deve, na sequência:
  1. Registrar LOGIN_FALHA em historico_operacao
  2. Incrementar contador_falhas em +1 em nosso banco
  3. Verificar se contador_falhas atingiu limite_tentativas_login
  4. Retornar "Login ou senha inválidos" ao UC01.01
E a comparação de senha em si (case sensitivity, hash) é responsabilidade do Clerk — não reimplementamos essa lógica
```
**Referência:** A1 passos 5.1–5.5, RN0024-rev

### CA-01.02.11-rev — Contador global de falhas
```gherkin
Dado que o usuário realizou tentativas malsucedidas em diferentes IPs, navegadores e horários
Quando o Clerk rejeita cada tentativa
Então nosso backend deve acumular todas as falhas em uma única contagem global vinculada ao usuário em nosso banco — IP, navegador e horário são irrelevantes para o cálculo
```
**Referência:** RN0026 (inalterada)

### CA-01.02.14-rev / CA-01.02.15-rev — Bloqueio automático ao atingir o limite
```gherkin
Dado que limite_tentativas_login está configurado (ex: 5)
Quando contador_falhas (em nosso banco) atinge exatamente esse valor após uma nova falha confirmada pelo Clerk
Então o sistema deve acionar o UC01.05, gravar usuario.bloqueado = TRUE de forma atômica e síncrona em nosso banco, e retornar a mensagem de acesso negado ao UC01.01

Dado que o bloqueio automático foi acionado
Quando o mesmo usuário tenta autenticar novamente
Então o sistema deve recusar em nosso banco (RN0012-rev, passo 2) sem sequer chamar o Clerk — "Usuário bloqueado" é imediato e persistente
```
**Referência:** RN0024, A4, RN0018

### CA-01.02.17-rev — Acesso simultâneo
```gherkin
Dado que o usuário já possui uma sessão ATIVA no Clerk
Quando realiza um novo login com as mesmas credenciais em outra estação
Então o sistema deve: (1) revogar a sessão anterior via API de sessões do Clerk, (2) notificar a estação anterior, (3) registrar ACESSO_SIMULTANEO em historico_operacao (nosso banco) e (4) prosseguir criando a nova sessão no Clerk
```
**Referência:** A2 passos 6.1–6.4, RN-NOVO-01
**Gap aberto:** confirmar suporte a revogação de sessão via API no plano gratuito do Clerk antes de implementar este critério como bloqueante.

### CA-01.02.19-rev — Falha no registro de auditoria pós-login
```gherkin
Dado que o Clerk já criou a sessão com sucesso
Quando a gravação de LOGIN_SUCESSO em historico_operacao (nosso banco) falha
Então o sistema deve manter a sessão do Clerk ativa e permitir o acesso do usuário
E o erro deve ser registrado internamente para revisão do Administrador
E a falha de auditoria NÃO deve desfazer a sessão já criada no Clerk (não há como "desautenticar" retroativamente sem prejudicar a UX)
```
**Referência:** E6, RNF0006

### CA-01.02.20/21-rev — Hash e comparação de senha (delegado ao Clerk)
```gherkin
Dado que o sistema processa qualquer autenticação
Quando a senha é comparada
Então essa comparação (hash Argon2id/PBKDF2/BCrypt, constant-time) é executada inteiramente pelo Clerk
E nosso código NUNCA recebe, armazena ou compara a senha em texto claro ou hash — apenas delega ao SDK do Clerk e trata o resultado booleano de sucesso/falha
```
**Referência:** RN0019, RN0020, RNF0004, RNF0005 (responsabilidade transferida ao Clerk)

---

## UC01.05 — Bloquear Usuário

Nenhuma mudança de comportamento em relação ao original — o bloqueio continua sendo uma operação 100% em nosso banco, disparada pelo nosso backend após receber o veredito do Clerk (ver CA-01.02.14-rev acima). Todos os critérios originais (CA-01.05.01 a CA-01.05.15) permanecem válidos como estão em `docs/CA_UC01_05_Bloquear_Usuario.docx`, com a única ressalva:

### Nota de adendo — CA-01.05.01
```gherkin
Dado que o parâmetro limite_tentativas_login está configurado e contador_falhas atingiu esse valor
Quando o UC01.02 aciona o UC01.05
Então a gravação atômica e síncrona de bloqueado = TRUE ocorre inteiramente em nosso banco (Prisma + transação),
  independente do Clerk — o Clerk não participa desta operação
```
**Referência:** RN0024, RNF0011 (inalteradas)
