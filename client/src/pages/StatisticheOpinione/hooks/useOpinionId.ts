export const useOpinionId = () => {
  // Estrai l'ID dell'opinione dall'URL
  const pathParts = window.location.pathname.split('/');
  let opinionId = pathParts[pathParts.length - 1];
  
  // Se siamo in una pagina regionale, l'opinionId è prima di "regione"
  if (pathParts.includes('regione')) {
    const regioneIndex = pathParts.indexOf('regione');
    opinionId = pathParts[regioneIndex - 1];
  }
  
  console.log('🔍 DEBUG StatisticheOpinione - OpinionId estratto:', opinionId);
  
  return opinionId;
};
