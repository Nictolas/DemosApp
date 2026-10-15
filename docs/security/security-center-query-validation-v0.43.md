# CP-043 – Security Center Query Validation Hardening v0.43
Policy unica per query read-only: chiavi non dichiarate respinte, valori array/object respinti, scalari max 64 caratteri, limiti interi 1-200 senza coercizioni ambigue. Health non accetta query; Overview, Incidents e tutte le viste limit-only usano la stessa policy. Errori restano generici. Nessuna capacità di scrittura.
