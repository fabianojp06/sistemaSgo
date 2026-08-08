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
import { RestaurarVersaoPropostaUseCase } from './RestaurarVersaoPropostaUseCase';
import { ConfigurarSemaforoContaUseCase } from './ConfigurarSemaforoContaUseCase';
import { CalcularValorRealizadoUseCase } from './CalcularValorRealizadoUseCase';
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
import { CadastrarEmpregadosEmLoteUseCase } from './CadastrarEmpregadosEmLoteUseCase';
import { EditarEmpregadoUseCase } from './EditarEmpregadoUseCase';
import { ExcluirEmpregadoUseCase } from './ExcluirEmpregadoUseCase';
import { ConfigurarBeneficiosCargoUseCase } from './ConfigurarBeneficiosCargoUseCase';
import { RessincronizarSnapshotEmpregadosCargoUseCase } from './RessincronizarSnapshotEmpregadosCargoUseCase';
import { ExcluirCargoUseCase } from './ExcluirCargoUseCase';
import { ExcluirCargosEmLoteUseCase } from './ExcluirCargosEmLoteUseCase';
import { ConfigurarElegibilidadeBeneficioUseCase } from './ConfigurarElegibilidadeBeneficioUseCase';
import { CadastrarViagemUseCase } from './CadastrarViagemUseCase';
import { EditarViagemUseCase } from './EditarViagemUseCase';
import { ExcluirViagemUseCase } from './ExcluirViagemUseCase';
import { CadastrarItemPatrimonialUseCase } from './CadastrarItemPatrimonialUseCase';
import { EditarItemPatrimonialUseCase } from './EditarItemPatrimonialUseCase';
import { ExcluirItemPatrimonialUseCase } from './ExcluirItemPatrimonialUseCase';
import { CadastrarQtdeEmpregadoUseCase } from './CadastrarQtdeEmpregadoUseCase';
import { EditarQtdeEmpregadoUseCase } from './EditarQtdeEmpregadoUseCase';
import { ExcluirQtdeEmpregadoUseCase } from './ExcluirQtdeEmpregadoUseCase';
import { SolicitarTermoAjusteUseCase } from './SolicitarTermoAjusteUseCase';
import { AprovarTermoAjusteN1UseCase } from './AprovarTermoAjusteN1UseCase';
import { HomologarTermoAjusteUseCase } from './HomologarTermoAjusteUseCase';
import { RejeitarTermoAjusteUseCase } from './RejeitarTermoAjusteUseCase';
import { ListarTermosAjusteUseCase } from './ListarTermosAjusteUseCase';
import { ListarAliquotasImpostoUseCase } from './ListarAliquotasImpostoUseCase';
import { CadastrarAliquotaImpostoUseCase } from './CadastrarAliquotaImpostoUseCase';
import { EditarAliquotaImpostoUseCase } from './EditarAliquotaImpostoUseCase';
import { ExcluirAliquotaImpostoUseCase } from './ExcluirAliquotaImpostoUseCase';

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

export function getRestaurarVersaoPropostaUseCase(): RestaurarVersaoPropostaUseCase {
  return new RestaurarVersaoPropostaUseCase(prisma);
}

export function getConfigurarSemaforoContaUseCase(): ConfigurarSemaforoContaUseCase {
  return new ConfigurarSemaforoContaUseCase(prisma);
}

export function getCalcularValorRealizadoUseCase(): CalcularValorRealizadoUseCase {
  return new CalcularValorRealizadoUseCase(prisma);
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

export function getCadastrarEmpregadosEmLoteUseCase(): CadastrarEmpregadosEmLoteUseCase {
  return new CadastrarEmpregadosEmLoteUseCase(prisma);
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

export function getRessincronizarSnapshotEmpregadosCargoUseCase(): RessincronizarSnapshotEmpregadosCargoUseCase {
  return new RessincronizarSnapshotEmpregadosCargoUseCase(prisma);
}

export function getExcluirCargoUseCase(): ExcluirCargoUseCase {
  return new ExcluirCargoUseCase(prisma);
}

export function getExcluirCargosEmLoteUseCase(): ExcluirCargosEmLoteUseCase {
  return new ExcluirCargosEmLoteUseCase(prisma);
}

export function getConfigurarElegibilidadeBeneficioUseCase(): ConfigurarElegibilidadeBeneficioUseCase {
  return new ConfigurarElegibilidadeBeneficioUseCase(prisma);
}

export function getCadastrarViagemUseCase(): CadastrarViagemUseCase {
  return new CadastrarViagemUseCase(prisma);
}

export function getEditarViagemUseCase(): EditarViagemUseCase {
  return new EditarViagemUseCase(prisma);
}

export function getExcluirViagemUseCase(): ExcluirViagemUseCase {
  return new ExcluirViagemUseCase(prisma);
}

export function getCadastrarItemPatrimonialUseCase(): CadastrarItemPatrimonialUseCase {
  return new CadastrarItemPatrimonialUseCase(prisma);
}

export function getEditarItemPatrimonialUseCase(): EditarItemPatrimonialUseCase {
  return new EditarItemPatrimonialUseCase(prisma);
}

export function getExcluirItemPatrimonialUseCase(): ExcluirItemPatrimonialUseCase {
  return new ExcluirItemPatrimonialUseCase(prisma);
}

export function getCadastrarQtdeEmpregadoUseCase(): CadastrarQtdeEmpregadoUseCase {
  return new CadastrarQtdeEmpregadoUseCase(prisma);
}

export function getEditarQtdeEmpregadoUseCase(): EditarQtdeEmpregadoUseCase {
  return new EditarQtdeEmpregadoUseCase(prisma);
}

export function getExcluirQtdeEmpregadoUseCase(): ExcluirQtdeEmpregadoUseCase {
  return new ExcluirQtdeEmpregadoUseCase(prisma);
}

export function getSolicitarTermoAjusteUseCase(): SolicitarTermoAjusteUseCase {
  return new SolicitarTermoAjusteUseCase(prisma);
}

export function getAprovarTermoAjusteN1UseCase(): AprovarTermoAjusteN1UseCase {
  return new AprovarTermoAjusteN1UseCase(prisma);
}

export function getHomologarTermoAjusteUseCase(): HomologarTermoAjusteUseCase {
  return new HomologarTermoAjusteUseCase(prisma);
}

export function getRejeitarTermoAjusteUseCase(): RejeitarTermoAjusteUseCase {
  return new RejeitarTermoAjusteUseCase(prisma);
}

export function getListarTermosAjusteUseCase(): ListarTermosAjusteUseCase {
  return new ListarTermosAjusteUseCase(prisma);
}

export function getListarAliquotasImpostoUseCase(): ListarAliquotasImpostoUseCase {
  return new ListarAliquotasImpostoUseCase(prisma);
}

export function getCadastrarAliquotaImpostoUseCase(): CadastrarAliquotaImpostoUseCase {
  return new CadastrarAliquotaImpostoUseCase(prisma);
}

export function getEditarAliquotaImpostoUseCase(): EditarAliquotaImpostoUseCase {
  return new EditarAliquotaImpostoUseCase(prisma);
}

export function getExcluirAliquotaImpostoUseCase(): ExcluirAliquotaImpostoUseCase {
  return new ExcluirAliquotaImpostoUseCase(prisma);
}
