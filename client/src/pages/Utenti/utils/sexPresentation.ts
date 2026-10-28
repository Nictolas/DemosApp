/**
 * Presentazione separata delle informazioni CIE e dei valori legacy.
 * Il genere storico non viene mai scritto in users.sesso né dichiarato CIE.
 */
export type SexPresentation = {
  label: 'Maschile' | 'Femminile' | 'Non disponibile' | 'Non applicabile';
  source: 'CIE' | 'STORICO' | 'NESSUNA' | 'NON_APPLICABILE';
  chartCategory: string | null;
  tooltip: string;
};

type SexFields = {
  account_type?: string | null;
  sesso?: string | null;
  genere?: string | null;
};

export function getSexPresentation(user: SexFields | null | undefined): SexPresentation {
  if (user?.account_type !== 'PERSON') {
    return {
      label: 'Non applicabile',
      source: 'NON_APPLICABILE',
      chartCategory: null,
      tooltip: 'Il dato si riferisce soltanto alle persone.'
    };
  }

  if (user.sesso === 'M' || user.sesso === 'F') {
    const label = user.sesso === 'M' ? 'Maschile' : 'Femminile';
    return {
      label,
      source: 'CIE',
      chartCategory: `${label} · CIE`,
      tooltip: 'Sesso anagrafico verificato tramite CIE.'
    };
  }

  const legacy = typeof user.genere === 'string'
    ? user.genere.trim().toLocaleLowerCase('it')
    : '';
  const isMaschile = ['u', 'uomo', 'maschio'].includes(legacy);
  const isFemminile = ['d', 'donna', 'femmina'].includes(legacy);

  if (isMaschile || isFemminile) {
    const label = isMaschile ? 'Maschile' : 'Femminile';
    return {
      label,
      source: 'STORICO',
      chartCategory: `${label} · storico`,
      tooltip: 'Valore recuperato dal vecchio campo genere; non certificato dalla CIE.'
    };
  }

  return {
    label: 'Non disponibile',
    source: 'NESSUNA',
    chartCategory: 'Non disponibile',
    tooltip: 'Nessun dato M/F CIE o valore storico Uomo/Donna disponibile.'
  };
}
