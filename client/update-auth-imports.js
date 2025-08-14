const fs = require('fs');
const path = require('path');

// Lista dei file che devono essere aggiornati
const filesToUpdate = [
  'pages/Opinioni.tsx',
  'pages/Rappresentanti.tsx', 
  'pages/Gestisci.tsx',
  'pages/Vota.tsx',
  'pages/VotaICE.tsx',
  'pages/Governo.tsx',
  'pages/CapodiStato.tsx',
  'pages/Grazia.tsx',
  'pages/Amnistia.tsx',
  'pages/IniziativePopolare.tsx',
  'pages/ReferendumAbrogativi.tsx',
  'pages/ICE.tsx',
  'pages/Notifiche.tsx',
  'pages/Comunica.tsx',
  'pages/Eventi.tsx',
  'pages/Evento.tsx',
  'pages/Proponi.tsx',
  'pages/ProponiOpinione.tsx',
  'pages/Sostenitori.tsx',
  'pages/Sondaggi.tsx',
  'pages/StatisticheUtenti.tsx',
  'pages/ReclamaProfilo.tsx',
  'pages/LandingPage.tsx',
  'pages/Limiti.tsx',
  'pages/ModificaImmagine.tsx',
  'pages/Programma.tsx',
  'pages/Riscontro.tsx',
  'pages/Votazione.tsx',
  'pages/ScegliCandidato.tsx',
  'pages/ScegliRappresentante.tsx',
  'pages/ScegliAccount.tsx',
  'pages/RegistrazioneWizard.tsx',
  'pages/RegistrazioneElezione.tsx',
  'pages/RegistrazioneElezioneCandidatura.tsx',
  'pages/RegistrazioneCandidatura.tsx',
  'pages/GestisciGrazia.tsx',
  'pages/GestisciICE.tsx',
  'pages/GestisciIniziativePopolari.tsx',
  'pages/GestisciReferendumAbrogativi.tsx',
  'pages/opinioni/Caccia.tsx',
  'pages/opinioni/EnergiaNucleare.tsx',
  'pages/opinioni/LegalizzazioneCanapa.tsx',
  'pages/opinioni/SperimentazioneAnimale.tsx',
  'pages/opinioni/DettaglioOpinione.tsx',
  'components/ViewOpinioniDialog.tsx',
  'components/EditOpinioniDialog.tsx'
];

const srcDir = path.join(__dirname, 'src');

filesToUpdate.forEach(file => {
  const filePath = path.join(srcDir, file);
  
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Sostituisci l'import di use-auth
      const oldImport = 'import { useAuth } from "@/hooks/use-auth";';
      const newImport = 'import { useAuth } from "@/hooks/use-auth-neon";';
      
      if (content.includes(oldImport)) {
        content = content.replace(oldImport, newImport);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Aggiornato: ${file}`);
      } else {
        console.log(`⚠️  Non necessario: ${file}`);
      }
    } catch (error) {
      console.error(`❌ Errore in ${file}:`, error.message);
    }
  } else {
    console.log(`📁 File non trovato: ${file}`);
  }
});

console.log('\n🎉 Aggiornamento completato!');
