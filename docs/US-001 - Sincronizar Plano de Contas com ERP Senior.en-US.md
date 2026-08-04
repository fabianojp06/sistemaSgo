<div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 1000px; margin: auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden;">

  <!-- 1. HERO HEADER -->
  <div style="background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%); padding: 40px 35px; color: white;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <span style="background: #e74c3c; color: white; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; letter-spacing: 1px; border: 1px solid #ff7979; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
        🔴 HIGH PRIORITY
      </span>
      <span style="font-size: 13px; color: #94a3b8; font-family: monospace;">ID: US-001</span>
    </div>
    
    <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">
      Synchronize Chart of Accounts with Senior ERP
    </h1>
    
    <p style="margin: 0; font-size: 16px; color: #cbd5e1;">
      <strong>Epic:</strong> EP118/24 &nbsp;|&nbsp; <strong>Module:</strong> Registrations — Chart of Accounts
    </p>
  </div>

  <!-- 2. METADATA PANEL -->
  <div style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 20px 35px;">
    <table width="100%" style="border-collapse: collapse; text-align: left;">
      <tr>
        <td width="33%" style="padding-right: 15px;">
          <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">👥 Access Profile</div>
          <div style="font-size: 15px; color: #0f172a; font-weight: 600; margin-top: 4px;">Administrator / Budget Analyst</div>
        </td>
        <td width="33%" style="padding-right: 15px; border-left: 1px solid #cbd5e1; padding-left: 20px;">
          <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">⏱️ Estimate</div>
          <div style="font-size: 15px; color: #0f172a; font-weight: 600; margin-top: 4px;">Size G</div>
          <div style="font-size: 12px; color: #64748b;">(Integration complexity)</div>
        </td>
        <td width="33%" style="border-left: 1px solid #cbd5e1; padding-left: 20px;">
          <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">🔗 Dependencies</div>
          <div style="font-size: 14px; color: #0f172a; margin-top: 4px;">Operational ERP gateway; Administrative profile configured.</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- 3. STORY AND CONTEXT -->
  <div style="padding: 35px;">
    
    <!-- User Story -->
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 5px solid #22c55e; border-radius: 6px; padding: 20px; margin-bottom: 25px; color: #166534; font-size: 16px; line-height: 1.6;">
      <strong>As</strong> an SGO Administrator or Budget Analyst with an administrative profile,<br>
      <strong>I want</strong> to trigger synchronization of the Unified Chart of Accounts with the Senior ERP by clicking <em>[Synchronize with Senior ERP]</em>,<br>
      <strong>So that</strong> the SGO accounting tree stays up to date with the official structure, ensuring that new levels and analytical accounts are immediately available in Proposal and Sizing forms.<br>
      <div style="margin-top: 10px; font-size: 12px; font-family: monospace; background: #dcfce7; padding: 4px 8px; border-radius: 4px; display: inline-block;">[RF_PLA_REQ_001]</div>
    </div>

    <!-- Business Rules -->
    <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 18px; margin-top: 0;">📚 Context and Business Rules</h3>
    <p style="color: #475569; font-size: 15px; line-height: 1.7; text-align: justify;">
      The SGO 2.0 Unified Chart of Accounts is fed exclusively via integration with the Senior ERP (<code>SeniorIntegrationController</code>). No account can be manually inserted, renamed, or deleted in the SGO — any structural change must occur first in the ERP and be brought in via synchronization. The operation is <strong>atomic (ACID)</strong>: either the entire batch is imported successfully, or nothing is changed. After synchronization, N7 (analytical) accounts become available as linking options in Proposal, Goal, and Travel forms. Every operation generates a mandatory audit trail.
    </p>
    <div style="font-size: 12px; color: #64748b; font-family: monospace;">Ref: [RN_PLA_001, RN_PLA_003, RN_PLA_004, RNF_PLA_REQ_001, RNF_PLA_REQ_004]</div>

    <br><br>

    <!-- 4. ACCEPTANCE SCENARIOS -->
    <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 18px; margin-bottom: 20px;">✅ Acceptance Scenarios</h3>

    <!-- Scenario 1 -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 15px 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
      <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">Scenario 1 — Successful synchronization with tree update</h4>
      <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
        <li><strong>Given</strong> the user has an administrative profile and is authenticated in the SGO, the SeniorIntegrationController is operational, and the Chart of Accounts is approved and active in the ERP;</li>
        <li><strong>When</strong> the user clicks [Synchronize with Senior ERP];</li>
        <li><strong>Then</strong> the system triggers the controller and consumes the ERP endpoints;</li>
        <li><strong>And</strong> the accounting tree is updated with the synchronized accounts (Levels 1 to 7) via atomic commit;</li>
        <li><strong>And</strong> all accounts display the 'Synchronized' status badge;</li>
        <li><strong>And</strong> N7 analytical accounts become immediately available in lookups;</li>
        <li><strong>And</strong> the total time does not exceed 5.0s for batches of up to 5,000 accounts;</li>
        <li><strong>And</strong> an audit log is recorded (type='SYNC_ERP', id, ip, timestamp).</li>
      </ul>
    </div>

    <!-- Scenario 2 -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 15px 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
      <h4 style="margin: 0 0 10px 0; color: #1d4ed8;">Scenario 2 — Detects new accounts and preserves parameterizations</h4>
      <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
        <li><strong>Given</strong> the SGO already has the chart synchronized, the user has added Tags (OPEX/CAPEX) to accounts, and the ERP has published 3 new analytical accounts and renamed 1 synthetic account;</li>
        <li><strong>When</strong> the user clicks [Synchronize with Senior ERP];</li>
        <li><strong>Then</strong> the 3 new accounts are inserted and the renamed one reflects the new name;</li>
        <li><strong>And</strong> the Nature Tags configured by the user are preserved;</li>
        <li><strong>And</strong> the log records the delta with previous and subsequent state.</li>
      </ul>
    </div>

    <!-- Scenario 3 -->
    <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #64748b; border-radius: 6px; padding: 15px 20px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
      <h4 style="margin: 0 0 10px 0; color: #475569;">Scenario 3 — Cancellation before triggering</h4>
      <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
        <li><strong>Given</strong> the user is on the Chart of Accounts screen;</li>
        <li><strong>When</strong> the user clicks [Cancel] before confirming;</li>
        <li><strong>Then</strong> the system aborts the flow without triggering a request;</li>
        <li><strong>And</strong> the tree remains intact, with no log written.</li>
      </ul>
    </div>

    <!-- Failure Scenarios (2-column grid to save space and group errors) -->
    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
      
      <!-- Scenario 4 -->
      <div style="flex: 1; min-width: 300px; background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 6px; padding: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #b91c1c;">❌ Scenario 4 — Timeout / Failure (ERP)</h4>
        <div style="font-size: 13px; color: #7f1d1d; line-height: 1.5;">
          <strong>Given:</strong> Connection attempt with no response within 10s.<br>
          <strong>When:</strong> The safety timer triggers.<br>
          <strong>Then:</strong> Aborts with atomic rollback. Alert: <em>"Communication Error [ERROR LOCK]..."</em> writing a technical failure log.
        </div>
      </div>

      <!-- Scenario 5 -->
      <div style="flex: 1; min-width: 300px; background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 6px; padding: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #b91c1c;">❌ Scenario 5 — Orphan Accounts in the Batch</h4>
        <div style="font-size: 13px; color: #7f1d1d; line-height: 1.5;">
          <strong>Given:</strong> ERP sends an N7 account with no parent account.<br>
          <strong>When:</strong> The validator detects the inconsistency.<br>
          <strong>Then:</strong> Aborts the ingestion (full rollback). Alert: <em>"Synchronization Error [ERROR LOCK]: Ingestion aborted..."</em>.
        </div>
      </div>

      <!-- Scenario 6 -->
      <div style="flex: 1; min-width: 300px; background-color: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #ef4444; border-radius: 6px; padding: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #b91c1c;">❌ Scenario 6 — Access Denied (RBAC)</h4>
        <div style="font-size: 13px; color: #7f1d1d; line-height: 1.5;">
          <strong>Given:</strong> Common user (no admin profile).<br>
          <strong>When:</strong> Attempts to trigger the endpoint (API/UI).<br>
          <strong>Then:</strong> HTTP 403 rejection. The [Synchronize] button is not rendered.
        </div>
      </div>

    </div>

    <br><br>

    <!-- 5. TECHNICAL DETAILS & ARCHITECTURE -->
    <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-size: 18px; margin-bottom: 20px;">⚙️ Technical Impact and Architecture</h3>
    
    <table width="100%" style="border-collapse: collapse; font-size: 14px; text-align: left; border: 1px solid #e2e8f0;">
      <thead>
        <tr style="background-color: #f1f5f9; color: #334155;">
          <th style="padding: 12px; border: 1px solid #e2e8f0; width: 20%;">Aspect</th>
          <th style="padding: 12px; border: 1px solid #e2e8f0;">Technical Detail</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Affected Tables</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;"><code>tb_conta_contabil</code> (INSERT/UPDATE via upsert ON CONFLICT DO UPDATE)<br><code>tb_historico_operacoes</code> (INSERT)</td>
        </tr>
        <tr style="background-color: #fafbfc;">
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Changed Fields</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 13px;">codigo_erp, nome_conta, nivel, id_pai, is_analitica, status_sync, synced_at, erp_updated_at</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Transaction & Lock</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;"><strong>Yes.</strong> ACID operation (full rollback on failure). <strong>Pessimistic Lock</strong> active during the load (avoids duplication).</td>
        </tr>
        <tr style="background-color: #fafbfc;">
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Audit (Payload)</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;"><code>tipo_operacao: SYNC_ERP</code> | Fields: usuario_id, ip_acesso, timestamp_op, payload_delta (JSON).</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: #475569;">Prisma vs SQL</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">The <code>PlanoContasBulkLoader</code> uses <code>$executeRaw</code> with a single-batch INSERT ... ON CONFLICT for performance.</td>
        </tr>
      </tbody>
    </table>

    <!-- Flow Diagram (Mermaid) -->
    <div style="margin-top: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center;">
      <h4 style="margin: 0 0 15px 0; color: #334155;">🔄 Synchronization Flow Diagram (Happy Path)</h4>
```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrator
    participant UI as SGO Frontend
    participant API as SGO Backend
    participant ERP as Senior ERP (Gateway)
    participant DB as Database

    Admin->>UI: Clicks [Synchronize]
    UI->>API: POST /api/v1/plano-contas/sync
    activate API
    API->>API: Validates Profile and Timeout (10s)
    API->>ERP: GET /contas-contabeis/ativas
    ERP-->>API: 200 OK (JSON Batch)
    
    API->>DB: Starts Atomic Transaction + Lock
    API->>API: Validates Integrity (Parents/Children)
    API->>DB: Batch Upsert (ON CONFLICT DO UPDATE)
    API->>DB: Writes tb_historico_operacoes
    DB-->>API: Transaction Commit OK
    
    API-->>UI: 200 OK (Synchronized Status)
    deactivate API
    UI-->>Admin: Shows Success & Updates Tree

</div>

<br><br>

<!-- 6. DEFINITION OF DONE -->
<div style="background-color: #1e293b; color: #f8fafc; border-radius: 8px; padding: 25px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
  <h3 style="margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px; color: #38bdf8;">🏁 Definition of Done (DoD)</h3>
  <ul style="list-style: none; padding-left: 0; margin-bottom: 0; line-height: 1.8; font-size: 14px;">
    <li><input type="checkbox" disabled> Scenarios 1 through 6 implemented and approved in UAT with André (SCOR).</li>
    <li><input type="checkbox" disabled> Hierarchical tree rendered correctly after synchronization (N1 to N7 expandable).</li>
    <li><input type="checkbox" disabled> N7 accounts available in Proposal and Goal lookups immediately after synchronization.</li>
    <li><input type="checkbox" disabled> Pre-existing Nature Tags preserved after a new synchronization.</li>
    <li><input type="checkbox" disabled> Synchronization time ≤ 5.0s validated with a 5,000-account load in staging.</li>
    <li><input type="checkbox" disabled> Audit log generated with all required fields.</li>
    <li><input type="checkbox" disabled> Rollback validated in a communication failure scenario (simulated timeout).</li>
    <li><input type="checkbox" disabled> Common profile does not see the [Synchronize] button (RBAC tested).</li>
  </ul>
</div>