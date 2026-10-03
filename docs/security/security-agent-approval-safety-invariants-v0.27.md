# CP-027 – Approval Safety Invariants v0.27

Rafforza l'Approval Gate con invarianti fail-closed: una richiesta scaduta non può essere approvata in seguito, una decisione terminale non può essere sovrascritta, decisioni non supportate vengono rifiutate, gli identificativi restano univoci anche nello stesso millisecondo e un clock invalido blocca la creazione.

Il gate resta esclusivamente simulato e non abilita alcuna modifica reale. Nessuna nuova route HTTP viene aggiunta.
