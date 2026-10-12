'use strict';

// Capacitor 6 transpila `tar` come default import. L'override di sicurezza usa tar 7,
// che espone le API nominate ma non `default` quando __esModule=true.
// Aggiungiamo un alias runtime senza modificare node_modules né ridurre la versione di tar.
const tar = require('tar');
if (!tar.default) {
  tar.default = tar;
}
