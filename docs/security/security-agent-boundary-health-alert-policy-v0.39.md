# CP-039 – Boundary Health Alert Policy & Integration v0.39
Checkpoint medio: aggiunge policy deterministica degli alert e la integra nelle tre viste read-only del Security Center.
- green disponibile: nessun alert;
- orange: P1 BOUNDARY_VALIDATION_FAILURES;
- gray/non disponibile: P2 BOUNDARY_AUDIT_UNAVAILABLE;
- stato sconosciuto: P1 fail-closed.
Gli alert sono sintetici, non contengono payload grezzi e restano authorized=false, executable=false, Action Runner assente.