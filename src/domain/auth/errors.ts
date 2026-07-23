export abstract class AuthDomainError extends Error {
  abstract readonly code: string;
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** RN0015 — mensagem genérica: nunca revela se o login existe ou se a senha está errada. */
export class CredenciaisInvalidasError extends AuthDomainError {
  readonly code = 'CREDENCIAIS_INVALIDAS';
  constructor() {
    super('Login ou senha inválidos');
  }
}

/** RN0018 — conta com bloqueado = TRUE; a senha nunca é verificada nesse caso. */
export class UsuarioBloqueadoError extends AuthDomainError {
  readonly code = 'USUARIO_BLOQUEADO';
  constructor() {
    super('Usuário bloqueado');
  }
}

/** RN0023 — sistema em manutenção para usuários sem perfil de Administrador. */
export class SistemaEmManutencaoError extends AuthDomainError {
  readonly code = 'SISTEMA_EM_MANUTENCAO';
  constructor() {
    super('Sistema está em manutenção');
  }
}
