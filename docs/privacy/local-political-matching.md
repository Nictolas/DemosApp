# Privacy-first local political matching (shadow contract)

Status: non-live scaffold.

## Invariant
The identified Demos backend must not receive the citizen political opinion vector in order to compute candidate/representative compatibility.

## Target flow
1. The citizen device holds or obtains its own opinion vector locally.
2. A separate Research/public-data boundary exposes only the eligible politician/candidate vectors needed for the requested election scope.
3. The device computes compatibility with `localPoliticalMatcher`.
4. Only the selected politician/candidate identifier may later be sent to the identified backend when the citizen explicitly chooses a representative.
5. No request for matching contains the citizen opinion vector, a user/account id paired with that vector, or a server-side comparison request.

The current legacy `/api/rappresentanti/disponibili` path still performs identified server-side matching and therefore remains migration debt. This scaffold does not switch production behavior yet.
