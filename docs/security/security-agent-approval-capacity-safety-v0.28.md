# CP-028 – Approval Capacity Safety v0.28

Rende fail-closed la saturazione dello store in-memory dell'Approval Gate.

A capacità massima, un record terminale può essere riciclato. Se tutti i record sono ancora pending, una nuova richiesta viene rifiutata: nessun approval pendente viene eliminato silenziosamente. I contatori storici restano separati dalla retention dei record.

Lo stato espone capacityFailClosed=true e maxRecords. Restano invariati executionEnabled=false e actionRunnerAvailable=false; nessuna nuova route write e nessuna azione reale.
