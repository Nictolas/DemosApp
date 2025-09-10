export const useOpinionId = () => {
  // Estrai l'ID dell'opinione dall'URL
  const pathParts = window.location.pathname.split('/');
  let opinionId = pathParts[pathParts.length - 1];
  
  console.log('🔍 DEBUG StatisticheOpinione - URL completo:', window.location.pathname);
  console.log('🔍 DEBUG StatisticheOpinione - Path parts:', pathParts);
  
  // Se siamo in una pagina regionale, l'opinionId è prima di "regione"
  if (pathParts.includes('regione')) {
    const regioneIndex = pathParts.indexOf('regione');
    opinionId = pathParts[regioneIndex - 1];
    console.log('🔍 DEBUG StatisticheOpinione - Pagina regionale rilevata, opinionId:', opinionId);
  }
  
  console.log('🔍 DEBUG StatisticheOpinione - OpinionId finale estratto:', opinionId);
  
  return opinionId;
};
