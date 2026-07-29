export type NoContaContabil = {
  id: string;
  codigoErp: string;
  nomeConta: string;
  idPai: string | null;
  isAnalitica: boolean;
  statusSync: string;
  filhas: NoContaContabil[];
};

function No({ no }: { no: NoContaContabil }) {
  return (
    <li>
      <div className="flex items-center gap-2 py-0.5">
        <span className="font-mono text-xs text-gray-500">{no.codigoErp}</span>
        <span className={no.isAnalitica ? 'text-gray-900' : 'font-medium text-gray-700'}>{no.nomeConta}</span>
        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
          {no.statusSync}
        </span>
      </div>
      {no.filhas.length > 0 && (
        <ul className="ml-4 border-l pl-3">
          {no.filhas.map((filha) => (
            <No key={filha.id} no={filha} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** RF_PLA_REQ_004 — árvore multinível, read-only (sem botões de escrita, RF_PLA_REQ_002). */
export function ArvoreContas({ nos }: { nos: NoContaContabil[] }) {
  return (
    <ul>
      {nos.map((no) => (
        <No key={no.id} no={no} />
      ))}
    </ul>
  );
}
