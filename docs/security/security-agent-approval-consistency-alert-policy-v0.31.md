# CP-031 – Approval Consistency Alert Policy v0.31

Converte le anomalie di consistenza dell'Approval Gate in segnali deterministici read-only per il Security Center.

Le anomalie strutturali e i contatori incoerenti producono P1; il solo superamento del limite audit produce P2. Codici sconosciuti falliscono in modo conservativo come P1. I segnali sono deduplicati, minimizzati e sempre executable=false.

Nessuna remediation automatica, Action Runner o nuova route write.
