# CP-069 - PostgreSQL Result Shape Safety v0.69

PostgreSQL read paths now validate the database-driver result envelope before consuming `rows`.

`listIncidents`, `getSourceState`, and `stats` reject null/missing/non-array `rows` with the stable generic error `invalid postgres result`, instead of leaking accidental JavaScript TypeErrors. Aggregate stats also reject duplicate severity/status keys, preventing malformed grouped results from silently overwriting earlier values.

This is defensive validation of the local store boundary only. Tests use mock pools; no real database, migration, provider, deployment or production write occurs.
