# CP-033 – Execution Boundary Contract v0.33

Definisce un envelope formale tra approval approvato e un eventuale futuro Action Runner. Il contratto accetta solo azioni allowlistate e approval nello stato approved, usa TTL e chiave di idempotenza, minimizza i dati e resta esplicitamente non autorizzato e non eseguibile.

authorized=false, executable=false e actionRunnerAvailable=false sono invarianti di questo checkpoint. Non esistono runner, chiamate di rete o side effect.
