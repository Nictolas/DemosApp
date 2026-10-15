# CP-024 – Approval Gate Integration v0.24

Le sole azioni classificate `escalate` dal Policy Engine generano richieste pending nel SecurityApprovalGate. `allow` e `deny` non creano richieste.

Security Center espone GET admin `/approvals` con stato e record minimizzati. Non esistono endpoint POST/PATCH/PUT/DELETE per approvare, rifiutare o eseguire.

Anche una richiesta eventualmente marcata approved a livello di dominio rimane `executable=false`: Action Runner assente, executionEnabled=false. Nessuna azione reale, deploy, migration, notifica o provider esterno.
