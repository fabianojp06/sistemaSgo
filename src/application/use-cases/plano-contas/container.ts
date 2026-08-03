import { prisma } from '@/infrastructure/db/prisma';
import { PlanoContasArquivoProvider } from '@/infrastructure/integrations/senior/PlanoContasArquivoProvider';
import { PlanoContasBulkLoader } from '@/infrastructure/plano-contas/PlanoContasBulkLoader';
import { SincronismoLockRepository } from '@/infrastructure/plano-contas/SincronismoLockRepository';
import { SincronizarPlanoContasUseCase } from './SincronizarPlanoContasUseCase';
import { CriarAgrupadorUseCase } from './CriarAgrupadorUseCase';
import { EditarAgrupadorUseCase } from './EditarAgrupadorUseCase';
import { ExcluirAgrupadorUseCase } from './ExcluirAgrupadorUseCase';
import { ListarAgrupadoresUseCase } from './ListarAgrupadoresUseCase';
import { AtribuirNaturezaContaUseCase } from './AtribuirNaturezaContaUseCase';
import { ConfigurarValorOrcadoContaUseCase } from './ConfigurarValorOrcadoContaUseCase';
import { CriarVersaoPropostaUseCase } from './CriarVersaoPropostaUseCase';
import { ConfigurarSemaforoContaUseCase } from './ConfigurarSemaforoContaUseCase';
import { ConfigurarRateioImpostoUseCase } from './ConfigurarRateioImpostoUseCase';
import { DesativarTributoRateioUseCase } from './DesativarTributoRateioUseCase';
import { CadastrarPropostaUseCase } from './CadastrarPropostaUseCase';
import { ExcluirVersaoPropostaUseCase } from './ExcluirVersaoPropostaUseCase';
import { DuplicarPropostaUseCase } from './DuplicarPropostaUseCase';
import { CriarUnidadeFuncionalUseCase } from './CriarUnidadeFuncionalUseCase';
import { InativarUnidadeFuncionalUseCase } from './InativarUnidadeFuncionalUseCase';
import { CargoRubiFixtureProvider } from '@/infrastructure/integrations/rubi/CargoRubiFixtureProvider';
import { CadastrarCargoUseCase } from './CadastrarCargoUseCase';
import { EditarCargoUseCase } from './EditarCargoUseCase';
import { CadastrarMetaUseCase } from './CadastrarMetaUseCase';
import { EditarMetaUseCase } from './EditarMetaUseCase';
import { ExcluirMetaUseCase } from './ExcluirMetaUseCase';
import { CadastrarEmpregadoUseCase } from './CadastrarEmpregadoUseCase';
import { EditarEmpregadoUseCase } from './EditarEmpregadoUseCase';
import { ExcluirEmpregadoUseCase } from './ExcluirEmpregadoUseCase';
import { ConfigurarBeneficiosCargoUseCase } from './ConfigurarBeneficiosCargoUseCase';
import { ConfigurarElegibilidadeBeneficioUseCase } from './ConfigurarElegibilidadeBeneficioUseCase';

export function getSincronizarPlanoContasUseCase(): SincronizarPlanoContasUseCase {
  return new SincronizarPlanoContasUseCase(
    prisma,
    new PlanoContasArquivoProvider(),
    new PlanoContasBulkLoader(prisma),
    new SincronismoLockRepository(prisma),
  );
}

export function getCriarAgrupadorUseCase(): CriarAgrupadorUseCase {
  return new CriarAgrupadorUseCase(prisma);
}

export function getEditarAgrupadorUseCase(): EditarAgrupadorUseCase {
  return new EditarAgrupadorUseCase(prisma);
}

export function getExcluirAgrupadorUseCase(): ExcluirAgrupadorUseCase {
  return new ExcluirAgrupadorUseCase(prisma);
}

export function getListarAgrupadoresUseCase(): ListarAgrupadoresUseCase {
  return new ListarAgrupadoresUseCase(prisma);
}

export function getAtribuirNaturezaContaUseCase(): AtribuirNaturezaContaUseCase {
  return new AtribuirNaturezaContaUseCase(prisma);
}

export function getConfigurarValorOrcadoContaUseCase(): ConfigurarValorOrcadoContaUseCase {
  return new ConfigurarValorOrcadoContaUseCase(prisma);
}

export function getCriarVersaoPropostaUseCase(): CriarVersaoPropostaUseCase {
  return new CriarVersaoPropostaUseCase(prisma);
}

export function getConfigurarSemaforoContaUseCase(): ConfigurarSemaforoContaUseCase {
  return new ConfigurarSemaforoContaUseCase(prisma);
}

export function getConfigurarRateioImpostoUseCase(): ConfigurarRateioImpostoUseCase {
  return new ConfigurarRateioImpostoUseCase(prisma);
}

export function getDesativarTributoRateioUseCase(): DesativarTributoRateioUseCase {
  return new DesativarTributoRateioUseCase(prisma);
}

export function getCadastrarPropostaUseCase(): CadastrarPropostaUseCase {
  return new CadastrarPropostaUseCase(prisma);
}

export function getExcluirVersaoPropostaUseCase(): ExcluirVersaoPropostaUseCase {
  return new ExcluirVersaoPropostaUseCase(prisma);
}

export function getDuplicarPropostaUseCase(): DuplicarPropostaUseCase {
  return new DuplicarPropostaUseCase(prisma);
}

export function getCriarUnidadeFuncionalUseCase(): CriarUnidadeFuncionalUseCase {
  return new CriarUnidadeFuncionalUseCase(prisma);
}

export function getInativarUnidadeFuncionalUseCase(): InativarUnidadeFuncionalUseCase {
  return new InativarUnidadeFuncionalUseCase(prisma);
}

export function getCadastrarCargoUseCase(): CadastrarCargoUseCase {
  return new CadastrarCargoUseCase(prisma, new CargoRubiFixtureProvider());
}

export function getEditarCargoUseCase(): EditarCargoUseCase {
  return new EditarCargoUseCase(prisma);
}

export function getCadastrarMetaUseCase(): CadastrarMetaUseCase {
  return new CadastrarMetaUseCase(prisma);
}

export function getEditarMetaUseCase(): EditarMetaUseCase {
  return new EditarMetaUseCase(prisma);
}

export function getExcluirMetaUseCase(): ExcluirMetaUseCase {
  return new ExcluirMetaUseCase(prisma);
}

export function getCadastrarEmpregadoUseCase(): CadastrarEmpregadoUseCase {
  return new CadastrarEmpregadoUseCase(prisma);
}

export function getEditarEmpregadoUseCase(): EditarEmpregadoUseCase {
  return new EditarEmpregadoUseCase(prisma);
}

export function getExcluirEmpregadoUseCase(): ExcluirEmpregadoUseCase {
  return new ExcluirEmpregadoUseCase(prisma);
}

export function getConfigurarBeneficiosCargoUseCase(): ConfigurarBeneficiosCargoUseCase {
  return new ConfigurarBeneficiosCargoUseCase(prisma);
}

export function getConfigurarElegibilidadeBeneficioUseCase(): ConfigurarElegibilidadeBeneficioUseCase {
  return new ConfigurarElegibilidadeBeneficioUseCase(prisma);
}
