<div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 1000px; margin: auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden;">

  <!-- 1. HERO HEADER -->
  <div style="background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%); padding: 40px 35px; color: white;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <span style="background: #e74c3c; color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; letter-spacing: 1px; border: 1px solid #ff7979; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        🔴 ALTA PRIORIDADE
      </span>
      <span style="font-size: 13px; color: #94a3b8; font-family: monospace;">ID: US-001</span>
    </div>
    
    <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
      Sincronizar Plano de Contas com ERP Senior
    </h1>
    
    <p style="margin: 0; font-size: 16px; color: #cbd5e1;">
      <strong>Épico:</strong> EP118/24 &nbsp;|&nbsp; <strong>Módulo:</strong> Cadastros — Plano de Contas
    </p>
  </div>

  <!-- 2. PAINEL DE METADADOS -->
  <div style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 20px 35px;">
    <table width="100%" style="border-collapse: collapse; text-align: left;">
      <tr>
        <td width="33%" style="padding-right: 15px;">
          <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">👥 Perfil de Acesso</div>
          <div style="font-size: 15px; color: #0f172a; font-weight: 600; margin-top: 4px;">Administrador / Orçamentista</div>
        </td>
        <td width="33%" style="padding-right: 15px; border-left: 1px solid #cbd5e1; padding-left: 20px;">
          <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">⏱️ Estimativa</div>
          <div style="font-size: 15px; color: #0f172a; font-weight: 600; margin-top: 4px;">Tamanho G</div>
          <div style="font-size: 12px; color: #64748b;">(Complexidade de integração)</div>
        </td>
        <td width="33%" style="border-left: 1px solid #cbd5e1; padding-left: 20px;">
          <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">🔗 Dependências</div>
          <div style="font-size: 14px; color: #0f172a; margin-top: 4px;">Gateway ERP operacional; Perfil administrativo configurado.</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- 3. HISTÓRIA E CONTEXTO -->
  <div style="padding: 35px;">
    
    <!-- User Story -->
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 5px solid #22c55e; border-radius: 6px; padding: 20px; margin-bottom: 25px; color: #166534; font-size: 16px; line-height: 1.6;">
      <strong>Como</strong> Administrador do SGO ou Orçamentista com perfil administrativo,<br>
      <strong>Quero</strong> disparar a sincronização do Plano de Contas Único com o ERP Senior clicando em <em>[Sincronizar com ERP Senior]</em>,<br>
      <strong>Para</strong> manter a árvore contábil do SGO atualizada com a estrutura oficial, garantindo que novos níveis e contas analíticas fiquem disponíveis imediatamente nos formulários de Propostas e Dimensionamento.<br>
      <div style="margin-top: 10px; font-size: 12px; font-family: monospace; background: #dcfce7; padding: 4px 8px; border-radius: 4px; display: inline-block;">[RF_PLA_REQ_001]</div>
    </div>

    <!-- Regras de Negócio -->
    <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 18px; margin-top: 0;">📚 Contexto e Regras de Negócio</h3>
    <p style="color: #475569; font-size: 15px; line-height: 1.7; text-align: justify;">
      O Plano de Contas Único do SGO 2.0 é alimentado exclusivamente via integração com o ERP Senior (<code>SeniorIntegrationController</code>). Nenhuma conta pode ser inserida, renomeada ou excluída manualmente no SGO — qualquer alteração estrutural deve ocorrer primeiro no ERP e ser trazida pelo sincronismo. A operação é <strong>atômica (ACID)</strong>: ou todo o lote é importado com sucesso, ou nada é alterado. Após o sincronismo, as contas N7 (analíticas) ficam disponíveis como opções de vínculo nos formulários de Propostas, Metas e Viagens. Toda operação gera trilha de auditoria obrigatória.
    </p>
    <div style="font-size: 12px; color: #64748b; font-family: monospace;">Ref: [RN_PLA_001, RN_PLA_003, RN_PLA_004, RNF_PLA_REQ_001, RNF_PLA_REQ_004]</div>

    <br><br>

    <!-- 4. CENÁRIOS DE ACEITE -->
    <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 18px; margin-bottom: 20px;">✅ Cenários de Aceite</h3>

    <!-- Cenário 1 -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 15px 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
      <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">Cenário 1 — Sincronismo bem-sucedido com atualização da árvore</h4>
      <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
        <li><strong>Dado que</strong> o usuário possui perfil administrativo e está autenticado no SGO, e que o SeniorIntegrationController está operacional, e o Plano de Contas está homologado ativo no ERP;</li>
        <li><strong>Quando</strong> o usuário clica em [Sincronizar com ERP Senior];</li>
        <li><strong>Então</strong> o sistema aciona o controller e consome os endpoints do ERP;</li>
        <li><strong>E</strong> a árvore contábil é atualizada com as contas síncronas (Níveis 1 a 7) via commit atômico;</li>
        <li><strong>E</strong> todas as contas exibem o badge de status 'Sincronizado';</li>
        <li><strong>E</strong> as contas analíticas N7 ficam disponíveis imediatamente nos lookups;</li>
        <li><strong>E</strong> o tempo total não ultrapassa 5,0s para lotes de até 5.000 contas;</li>
        <li><strong>E</strong> um log de auditoria é gravado (tipo='SYNC_ERP', id, ip, timestamp).</li>
      </ul>
    </div>

    <!-- Cenário 2 -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 15px 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
      <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">Cenário 2 — Detecta novas contas e preserva parametrizações</h4>
      <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
        <li><strong>Dado que</strong> o SGO já possui o plano sincronizado, o usuário adicionou Tags (OPEX/CAPEX) nas contas, e o ERP publicou 3 novas analíticas e renomeou 1 sintética;</li>
        <li><strong>Quando</strong> o usuário clica em [Sincronizar com ERP Senior];</li>
        <li><strong>Então</strong> as 3 novas contas são inseridas e a renomeada reflete o novo nome;</li>
        <li><strong>E</strong> as Tags de Natureza configuradas pelo usuário são preservadas;</li>
        <li><strong>E</strong> o log registra o delta com estado anterior e posterior.</li>
      </ul>
    </div>

    <!-- Cenário 3 -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #64748b; border-radius: 6px; padding: 15px 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
      <h4 style="margin: 0 0 10px 0; color: #475569;">Cenário 3 — Cancelamento antes do disparo</h4>
      <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
        <li><strong>Dado que</strong> o usuário está na tela de Plano de Contas;</li>
        <li><strong>Quando</strong> o usuário clica em [Cancelar] antes de confirmar;</li>
        <li><strong>Então</strong> o sistema aborta o fluxo sem disparar requisição;</li>
        <li><strong>E</strong> a árvore permanece intacta, sem gravação de log.</li>
      </ul>
    </div>

    <!-- Cenários de Falha (Grid de 2 colunas para economizar espaço e agrupar erros) -->
    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
      
      <!-- Cenário 4 -->
      <div style="flex: 1; min-width: 300px; background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 6px; padding: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #b91c1c;">❌ Cenário 4 — Timeout / Falha (ERP)</h4>
        <div style="font-size: 13px; color: #7f1d1d; line-height: 1.5;">
          <strong>Dado:</strong> Tentativa de conexão sem resposta em 10s.<br>
          <strong>Quando:</strong> O timer de segurança aciona.<br>
          <strong>Então:</strong> Aborta com rollback atômico. Alerta: <em>"Erro de Comunicação [TRAVA O ERRO]..."</em> gravando log de falha técnica.
        </div>
      </div>

      <!-- Cenário 5 -->
      <div style="flex: 1; min-width: 300px; background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 6px; padding: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #b91c1c;">❌ Cenário 5 — Contas Órfãs no Lote</h4>
        <div style="font-size: 13px; color: #7f1d1d; line-height: 1.5;">
          <strong>Dado:</strong> ERP envia conta N7 sem conta pai.<br>
          <strong>Quando:</strong> O validador detecta inconsistência.<br>
          <strong>Então:</strong> Aborta a ingestão (rollback total). Alerta: <em>"Erro de Sincronismo [TRAVA O ERRO]: Ingestão abortada..."</em>.
        </div>
      </div>

      <!-- Cenário 6 -->
      <div style="flex: 1; min-width: 300px; background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 6px; padding: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #b91c1c;">❌ Cenário 6 — Acesso Negado (RBAC)</h4>
        <div style="font-size: 13px; color: #7f1d1d; line-height: 1.5;">
          <strong>Dado:</strong> Usuário comum (sem perfil adm).<br>
          <strong>Quando:</strong> Tenta acionar o endpoint (API/UI).<br>
          <strong>Então:</strong> Rejeição HTTP 403. O botão [Sincronizar] não é renderizado.
        </div>
      </div>

    </div>

    <br><br>

    <!-- 5. DETALHES TÉCNICOS & ARQUITETURA -->
    <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 18px; margin-bottom: 20px;">⚙️ Impacto Técnico e Arquitetura</h3>
    
    <table width="100%" style="border-collapse: collapse; font-size: 14px; text-align: left; border: 1px solid #e2e8f0;">
      <thead>
        <tr style="background-color: #f1f5f9; color: #334155;">
          <th style="padding: 12px; border: 1px solid #e2e8f0; width: 20%;">Aspecto</th>
          <th style="padding: 12px; border: 1px solid #e2e8f0;">Detalhe Técnico</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Tabelas Afetadas</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;"><code>tb_conta_contabil</code> (INSERT/UPDATE via upsert ON CONFLICT DO UPDATE)<br><code>tb_historico_operacoes</code> (INSERT)</td>
        </tr>
        <tr style="background-color: #fafbfc;">
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Campos Alterados</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 13px;">codigo_erp, nome_conta, nivel, id_pai, is_analitica, status_sync, synced_at, erp_updated_at</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Transação & Lock</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Sim.</strong> Operação ACID (Rollback total na falha). <strong>Pessimistic Lock</strong> ativo durante a carga (evita duplicação).</td>
        </tr>
        <tr style="background-color: #fafbfc;">
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Auditoria (Payload)</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;"><code>tipo_operacao: SYNC_ERP</code> | Campos: usuario_id, ip_acesso, timestamp_op, payload_delta (JSON).</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Prisma vs SQL</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">O <code>PlanoContasBulkLoader</code> usa <code>$executeRaw</code> com INSERT ... ON CONFLICT em lote único para performance.</td>
        </tr>
      </tbody>
    </table>

    <!-- Diagrama de Fluxo (Mermaid) -->
    <div style="margin-top: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center;">
      <h4 style="margin: 0 0 15px 0; color: #334155;">🔄 Diagrama do Fluxo de Sincronismo (Happy Path)</h4>
```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador
    participant UI as SGO Frontend
    participant API as SGO Backend
    participant ERP as ERP Senior (Gateway)
    participant DB as Banco de Dados

    Admin->>UI: Clica [Sincronizar]
    UI->>API: POST /api/v1/plano-contas/sync
    activate API
    API->>API: Valida Perfil e Timeout (10s)
    API->>ERP: GET /contas-contabeis/ativas
    ERP-->>API: 200 OK (JSON Lote)
    
    API->>DB: Inicia Transação Atômica + Lock
    API->>API: Valida Integridade (Pais/Filhos)
    API->>DB: Upsert em Lote (ON CONFLICT DO UPDATE)
    API->>DB: Grava tb_historico_operacoes
    DB-->>API: Commit Transação OK
    
    API-->>UI: 200 OK (Status Sincronizado)
    deactivate API
    UI-->>Admin: Exibe Sucesso & Atualiza Árvore

</div>

<br><br>

<!-- 6. DEFINITION OF DONE -->
<div style="background-color: #1e293b; color: #f8fafc; border-radius: 8px; padding: 25px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
  <h3 style="margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px; color: #38bdf8;">🏁 Definition of Done (DoD)</h3>
  <ul style="list-style: none; padding-left: 0; margin-bottom: 0; line-height: 1.8; font-size: 14px;">
    <li><input type="checkbox" disabled> Cenários 1 a 6 implementados e aprovados em homologação com André (SCOR).</li>
    <li><input type="checkbox" disabled> Árvore hierárquica renderizada corretamente após sincronismo (N1 a N7 expandíveis).</li>
    <li><input type="checkbox" disabled> Contas N7 disponíveis nos lookups de Propostas e Metas imediatamente após sincronismo.</li>
    <li><input type="checkbox" disabled> Tags de Natureza pré-existentes preservadas após novo sincronismo.</li>
    <li><input type="checkbox" disabled> Tempo de sincronismo ≤ 5,0s validado com carga de 5.000 contas em staging.</li>
    <li><input type="checkbox" disabled> Log de auditoria gerado com todos os campos obrigatórios.</li>
    <li><input type="checkbox" disabled> Rollback validado em cenário de falha de comunicação (timeout simulado).</li>
    <li><input type="checkbox" disabled> Perfil comum não visualiza o botão [Sincronizar] (RBAC testado).</li>
  </ul>
</div>