-- US-103 (Excluir Versão da Proposta) e US-104 (Duplicar Proposta).
ALTER TYPE "TipoOperacao" ADD VALUE 'VERSAO_PROPOSTA_EXCLUIDA';
ALTER TYPE "TipoOperacao" ADD VALUE 'PROPOSTA_DUPLICADA';
