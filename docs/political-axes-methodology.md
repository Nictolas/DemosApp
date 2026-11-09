# DEMOS — Five thematic axes: exploratory methodology

**Status:** draft, not scientifically validated, not a political identity classifier. The original two-dimensional compass is unchanged. This document is internal; it is **not** a user-facing panel.

## Scope

The five indicators are derived exclusively from answers already obtained in the protected personal profile. They do not collect religion or any additional profile attribute, issue new API requests, persist inferred scores, or assign political party preferences. The existing consent gate for the compass must remain active.

| Axis | Left | Right | Questions | Minimum net answers (left/right) | Qualifier |
|---|---|---|---:|---|---|
| Economy | Uguaglianza | Mercato | 15 | 5 (2/2) | Exploratory |
| State | Libertà | Autorità | 14 | 5 (2/2) | Exploratory |
| Customs | Progresso | Tradizione | 7 | 4 (4/0) | **Experimental, one-sided** |
| Environment | Ecologia | Crescita | 12 | 5 (3/2) | **Experimental, imperfect opposite pole** |
| Immigration | Accoglienza | Controllo | 4 | 3 (2/1) | **Experimental, very small and mixed construct** |

The precise question IDs and directional signs are maintained in `client/src/lib/politicalCompassModel.ts`, in `POLITICAL_AXES`. Tests validate every ID against the versioned catalog of 94 Opinions.

## Calculation

For each clearly expressed answer, map Favorable to +1 and Against to -1. For a question mapped toward the left pole, reverse the sign; for right-mapped questions, preserve it. Ignore unanswered and 'Non lo so' for scoring; count the latter separately for transparent coverage.

For two-pole axes, the displayed signed score is `round(50 * (mean(left-mapped signed responses) + mean(right-mapped signed responses)))`. This prevents more numerous questions from automatically outweighing the other polarity. The resulting score is in [-100,100]. Display `leftPercent = round((100 - score)/2)`; `rightPercent = 100 - leftPercent`.

For the **one-sided** customs axis, the signed score is `round(100 * mean(left-mapped signed responses))`. This is *not* a validated Tradizione–Progresso dimension; it only describes agreement with the selected rights-expansion questions. Do not infer political traditionalism from this score.

The conservative `score` remains `null` until the original per-axis minimum and per-pole thresholds are met. The UI additionally offers a clearly marked **provisional draft** (`previewScore`) after **at least one definite response to a mapped question**, using only the groups actually answered. When both groups have answers, they have equal weight; when only one group has answers, no missing opposite group is imputed as neutral. This may yield an extreme-looking provisional value from only one answer: the UI marks it **Bozza provvisoria**, uses `≈` on percentages and attenuates the bar. Such values are highly unstable and must never be interpreted as a measured ideology.

For the two-dimensional graph: one answered dimension renders a dashed guide spanning the entire unanswered dimension (not a fabricated point at zero); two answered dimensions render a hollow dashed draft point; both fully qualified dimensions preserve the previous solid marker. With **no definite relevant answer**, display **Dati insufficienti** without scores. An indecisive response is not a middle position. Not every question in the catalog maps to a compass/theme axis: an unrelated answer does not provide a coordinate.

Percentages represent transformed question scores, **not** probabilities, population percentages or confidence measures. A 50/50 result may reflect competing positions rather than neutrality.

## Known methodological limitations

1. **Customs**: all seven questions are rights-expansion propositions; dissent cannot by itself justify a general label of 'traditionalist'. The UI marks it Experimental, but the axis requires symmetric questions and external validation for robust interpretation.
2. **Environment**: positions on incinerators, landfills and infrastructure do not necessarily indicate opposition to ecology or support for growth. The axis needs better-discriminating policy questions.
3. **Immigration**: Ius Soli, Ius Scholae and municipal reception are distinct from border and asylum policy; one foreign asylum-processing-centre item cannot fully measure 'Control'. A result is only a fragile description of these four proposals.
4. **State**: some included civil-rights questions overlap with the customs axis. High correlations between both scores can arise from question reuse, not two independent dimensions.
5. **Economy**: funding private or accredited services is not equivalent to a free-market ideology; cross-group signs should be reassessed.
6. **Small and self-selected response sets**: thresholds are UX guardrails, not statistical validation. No measures of reliability, construct validity, differential item functioning, or representative sampling are currently available.

## Privacy / publication gates

- Keep computation on the device, without new logging, score storage, tracking, network calls or public disclosure.
- Preserve the consent check and protected personal page: do not show or calculate before authorized disclosure of private opinions.
- Never use these scores to rank parties/candidates, infer voting intentions, or grant access or rights. The existing DEMOS candidate compatibility feature remains separate.
- Review the privacy notice and DPIA before production activation: these are derived political-opinion indicators.
- Conduct qualified methodological review, including question direction audit and sensitivity analysis, before removing Experimental tags or making claims of scientific accuracy.
- Verify mobile rendering, keyboard/screen-reader accessibility and Chrome/Chromium regression on the merged commit.

## Regression tests

`api/tests/politicalCompassPrototype.smoke.test.js` covers exact IDs, score extremes, polarity balance, indecision and missing data, null display gates and UI privacy contracts. The dedicated CI workflow builds the frontend and runs the actual compiled TypeScript model. This is necessary but not sufficient for methodological validation.
