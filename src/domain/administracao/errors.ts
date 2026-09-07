// EP085 / UC02.12 — erros de domínio do cadastro de usuários (US-201..205).

export class NaoAutorizadoError extends Error {
  constructor(mensagem = 'Você não tem permissão para esta operação.') {
    super(mensagem);
    this.name = 'NaoAutorizadoError';
  }
}

export class CamposObrigatoriosUsuarioError extends Error {
  constructor() {
    super('Os campos Nome Completo, E-mail, Login e Status são obrigatórios.');
    this.name = 'CamposObrigatoriosUsuarioError';
  }
}

export class EmailInvalidoError extends Error {
  constructor() {
    super('Informe um e-mail válido.');
    this.name = 'EmailInvalidoError';
  }
}

export class LoginJaExisteError extends Error {
  constructor() {
    super('O login informado já está em uso. Escolha outro login.');
    this.name = 'LoginJaExisteError';
  }
}

export class EmailJaExisteError extends Error {
  constructor() {
    super('O e-mail informado já está associado a outro usuário.');
    this.name = 'EmailJaExisteError';
  }
}

export class UsuarioSemPerfilError extends Error {
  constructor() {
    super('O usuário deve estar associado a pelo menos um perfil de acesso.');
    this.name = 'UsuarioSemPerfilError';
  }
}

export class PerfilInvalidoError extends Error {
  constructor() {
    super('Um ou mais perfis selecionados são inválidos, estão inativos ou pertencem a outro tenant.');
    this.name = 'PerfilInvalidoError';
  }
}

export class ConviteIdentidadeError extends Error {
  constructor(mensagem = 'Não foi possível criar a conta de acesso no momento. Tente novamente.') {
    super(mensagem);
    this.name = 'ConviteIdentidadeError';
  }
}

export class ReenvioConviteInvalidoError extends Error {
  constructor(mensagem = 'Este usuário já realizou o primeiro acesso.') {
    super(mensagem);
    this.name = 'ReenvioConviteInvalidoError';
  }
}
