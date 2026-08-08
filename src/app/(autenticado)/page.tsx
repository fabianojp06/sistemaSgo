/**
 * UC01.03 — Exibir Tela Principal.
 * CA-01.03.01 — exibida imediatamente após o login, sem ação adicional do usuário.
 * CA-01.03.02–04, CA-01.03.05/06, CA-01.03.18/19 — autenticação, menu filtrado
 * por perfil [ADR-001], barra de status e mensagem de menu vazio agora vivem
 * em `layout.tsx` (casca comum de toda tela autenticada, não só esta). Esta
 * página é hoje só a área de conteúdo da Tela Principal, ainda sem dashboard
 * próprio.
 */
export default function TelaPrincipal() {
  return <div className="h-full bg-[#F7F8FA] p-6 dark:bg-[#12151C]" />;
}
