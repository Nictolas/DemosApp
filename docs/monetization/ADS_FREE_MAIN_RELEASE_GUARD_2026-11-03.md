# Guardrail per la prima release Android senza annunci

Data: 03/11/2026 — PR indipendente dalla prototipazione pubblicitaria #558.

**Problema risolto:** in `main` l'Android Alpha Validation generava e archiviava un AAB unsigned senza controllare nel **binario** la presenza di ID pubblicitari o classi AdMob/UMP. I test esistevano solo nella PR #558, che contiene SDK pubblicitari esclusivamente in debug e non va integrata per sbloccare la release Ads-free.

**Intervento:** copia del controllo `scripts/check-ads-free-aab.py` già superato dalla CI della PR #558, aggiunto a `main` attraverso una PR separata. Il workflow Android Alpha Validation ora esegue **9 test unitari sintetici** per il gate e, dopo `:app:bundleRelease`, ispeziona `app-release.aab` prima dell'archiviazione.

Il gate fallisce se non trova la struttura minima AAB, se il package non è `community.demos`, se compaiono `AD_ID` o metadati ID AdMob nel manifest, oppure marcatori SDK Google Ads/UMP nel DEX e nella dependency metadata. La build rimane **non firmata**, senza credenziali Play e senza modifiche a Gradle o al runtime Android.

**Ambito limitato:** controllo conservativo di firme note e di un AAB unsigned generato in CI. Non è prova di assenza assoluta di qualsiasi tecnologia pubblicitaria, né del bundle **firmato** effettivamente presente su Google Play, né di conformità Data Safety. Ogni futuro rilascio monetizzato richiederà una modifica deliberata del gate, con nuova revisione DPO, Play e QA.

**Stato:** PR da approvare prima dell'eventuale merge. Nessuna distribuzione, modifica a staging o attivazione Ads.
