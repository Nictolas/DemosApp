# CP-023 – Approval Gate Foundation v0.23

Modella approvazioni umane per proposte già classificate dalla policy. Stati: pending, approved, rejected, expired.

L'approvazione è deliberatamente **non esecutiva**: ogni record mantiene `executable=false`, lo status dichiara `actionRunnerAvailable=false` e `executionEnabled=false`.

Sono ammessi solo i tipi di proposta già presenti nell'allowlist AI che richiedono revisione. Nessun payload arbitrario, raw log, identità, IP, token o secret viene conservato. Le richieste scadono automaticamente e non possono essere approvate dopo la scadenza.

Nessun endpoint di scrittura, deploy, provider, migration o Action Runner viene introdotto in CP-023.
