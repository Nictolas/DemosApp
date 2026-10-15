# CP-029 – Approval Store Consistency v0.29

Aggiunge un controllo deterministico e read-only di coerenza dello store approval.

Il controllo verifica unicità degli approvalId, allineamento del contatore pending con i record vivi, validità non-negativa dei contatori e rispetto dei limiti di record/audit. Scadenze e recycling vengono valutati prima del controllo.

Il risultato è minimizzato e non operativo: stato ok/issues, conteggi aggregati e executable=false. Nessuna riparazione automatica, route write o Action Runner.
