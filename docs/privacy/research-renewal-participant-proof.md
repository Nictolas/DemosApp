# Research renewal participant proof — shadow design

Status: **shadow only / not mounted in production**.

## Goal

A valid unlinkable `renew` credential must not be sufficient by itself to extend a pseudonymous Research participant. Renewal also requires proof that the caller currently controls the private key corresponding to `research.participants.participant_public_key`.

## Flow

1. Research issues a short-lived one-time challenge with purpose `renew-participant-v1`.
2. The client signs the existing domain-separated Research proof message with its Ed25519 participant private key.
3. Research verifies the signature against the 32-byte participant public key.
4. The challenge is consumed exactly once and must still be fresh.
5. Only after proof-of-possession succeeds is the unlinkable `renew` credential verified and atomically redeemed.
6. The existing renewal SQL still updates only participants whose status is `active` or `expired`; `revoked` remains terminal.

## Security properties

- A stolen renewal credential cannot renew another participant without that participant's private key.
- A signature for `read-opinions-v1` is not valid for `renew-participant-v1` because the purpose is part of the canonical signed message.
- A valid renewal proof cannot be replayed because its challenge is deleted on first successful verification.
- Research receives no account ID, user ID, email, CIE identifier, JWT, or Identity callback.
- The participant private key never leaves the client.

## Current integration boundary

The reusable service is implemented, but no new public route is mounted by this checkpoint. The existing public proof-challenge endpoint therefore remains read-opinions-only until the renewal redemption API is designed and reviewed as one coherent public surface.

The shadow schema permits both proof purposes so disposable PostgreSQL CI can validate the intended future DDL. No Supabase schema, production service, secret, queue, migration, or Render deployment is changed here.
