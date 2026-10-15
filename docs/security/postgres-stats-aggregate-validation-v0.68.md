# CP-068 - PostgreSQL Stats Aggregate Validation v0.68

PostgreSQL aggregate statistics now fail closed when persisted/aggregate results violate the read-model contract.

All summary and grouped counts must be non-negative safe integers. This rejects NaN, fractional/negative values and bigint values above JavaScript `Number.MAX_SAFE_INTEGER`, avoiding silent precision loss. Grouped severity/status keys must belong to the existing allowlists; unexpected database categories are rejected rather than added dynamically to the API response.

Valid aggregates retain the existing `incidentCount`, `sourceCount`, `bySeverity`, `byStatus` shape. Errors are generic (`invalid persisted stats`) and expose no database row content. Tests use mock pools only; no database, migration, provider, deployment or production write occurs.
