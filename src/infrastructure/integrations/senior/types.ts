export type ContaContabilPayload = {
  codigoErp: string;
  nomeConta: string;
  nivel: number;
  codigoPaiErp: string | null;
  isAnalitica: boolean;
};

export interface PlanoContasProvider {
  buscarContasAtivas(): Promise<ContaContabilPayload[]>;
}
