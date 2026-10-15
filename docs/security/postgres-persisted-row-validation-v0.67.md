# CP-067 - PostgreSQL Persisted Row Validation v0.67

PostgreSQL read mappers now fail closed when durable rows violate the security-store domain contract.

Incident rows reject missing identifiers, unknown severity/status, negative/non-finite/non-integer counts, and invalid required timestamps. Source-state rows reject corrupt timestamps and negative/non-finite/non-integer counters. Optional source timestamps remain nullable. Mapper errors are stable generic errors (`invalid persisted incident` / `invalid persisted source state`) and never include row contents.

This prevents corrupted or manually altered durable data from silently entering the Security Center read model or surfacing uncontrolled Date/Range errors. Validation is exercised entirely through mock pools; no database connection, migration, provider, deployment or production write occurs.
