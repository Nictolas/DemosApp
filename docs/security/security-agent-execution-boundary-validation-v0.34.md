# CP-034 – Execution Boundary Validation & Observability v0.34

Aggiunge validazione deterministica e stato osservabile per l'Execution Boundary. Il validatore controlla versione, azione allowlistata, approvalId, scadenza e soprattutto gli invarianti authorized=false, executable=false e actionRunnerAvailable=false.

Qualunque violazione fallisce chiusa come issue generica. Nessuna esecuzione, rete, remediation o side effect.
