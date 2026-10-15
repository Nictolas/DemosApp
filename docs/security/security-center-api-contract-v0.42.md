# CP-042 – Security Center API Contract Hardening v0.42
Contratto esplicito e immutabile: nove route Security Center, solo GET, tutte admin-only, read-only e non eseguibili. Test di regressione verificano corrispondenza contratto/router, ordine verifyToken -> requireAdmin, assenza di route extra e assenza di POST/PUT/PATCH/DELETE. Nessun Action Runner.
