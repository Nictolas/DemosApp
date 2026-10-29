'use strict';

// Inflesse grammaticali soltanto con un dato anagrafico M/F verificato.
// Se il dato manca, la notifica indica il luogo istituzionale, evitando
// l'assegnazione predefinita del maschile a politici senza sesso noto.
function politicalVotingSubject({ tipoNotifica, camera, sesso }) {
  const sex = sesso === 'M' || sesso === 'F' ? sesso : null;
  if (tipoNotifica === 'voto_comune') {
    return sex === 'F' ? 'La consigliera comunale'
      : sex === 'M' ? 'Il consigliere comunale'
        : 'Nel consiglio comunale,';
  }
  if (camera === 'Senato' || camera === 'Senato della Repubblica') {
    return sex === 'F' ? 'La senatrice'
      : sex === 'M' ? 'Il senatore'
        : 'In Senato,';
  }
  if (camera === 'Camera' || camera === 'Camera dei Deputati') {
    return sex === 'F' ? 'La deputata'
      : sex === 'M' ? 'Il deputato'
        : 'Alla Camera,';
  }
  return sex === 'F' ? 'La parlamentare'
    : sex === 'M' ? 'Il parlamentare'
      : 'In Parlamento,';
}

module.exports = { politicalVotingSubject };
