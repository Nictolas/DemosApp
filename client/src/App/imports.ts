// Import delle pagine principali
import Home from "@/pages/Home";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/auth-page";
import Menu from "@/pages/Menu";
import Profilo from "@/pages/Profilo";
import GestisciUtenti from "@/pages/GestisciUtenti";
import GestisciElezioni from "@/pages/GestisciElezioni";
import Opinioni from "@/pages/Opinioni";
import OpinioniEuropee from "@/pages/OpinioniEuropee";
import OpinioniNazionali from "@/pages/OpinioniNazionali";
import OpinioniRegionali from "@/pages/OpinioniRegionali";
import OpinioniComunali from "@/pages/OpinioniComunali";
import Rappresentanti from "@/pages/Rappresentanti";
import Elezioni from "@/pages/Elezioni";
import ScegliRappresentante from "@/pages/ScegliRappresentante";
import ScegliCandidato from "@/pages/ScegliCandidato";
import StatisticheUtenti from "@/pages/StatisticheUtenti";
import RegistrazioneCandidatura from "@/pages/RegistrazioneCandidatura";
import RegistrazioneElezione from "@/pages/RegistrazioneElezione";

// Import pagine di registrazione
import RegistrazioneNome from "@/pages/registrazione-nome";
import RegistrazioneGenere from "@/pages/registrazione-genere";
import RegistrazioneCittadinanza from "@/pages/registrazione-cittadinanza";
import RegistrazioneDataNascita from "@/pages/registrazione-data-nascita";
import RegistrazioneCodiceFiscale from "@/pages/registrazione-codice-fiscale";
import RegistrazioneDati from "@/pages/registrazione-2-dati";
import RegistrazioneResidenza from "@/pages/registrazione-3-residenza";

// Import pagine funzionali
import Strumenti from "@/pages/Comunica";
import PodioTrasparenza from "@/pages/PodioTrasparenza";
import Notifiche from "@/pages/Notifiche";
import ModificaImmagine from "@/pages/ModificaImmagine";
import CapodiStato from "@/pages/CapodiStato";
import Governo from "@/pages/Governo";
import Grazia from "@/pages/Grazia";
import Amnistia from "@/pages/Amnistia";
import Vota from "@/pages/Vota";
import Eventi from "@/pages/Eventi";
import Proponi from "@/pages/Proponi";
import IniziativePopolare from "@/pages/IniziativePopolare";
import ReferendumAbrogativi from "@/pages/ReferendumAbrogativi";
import Sostenitori from "@/pages/Sostenitori";
import Gestisci from "@/pages/Gestisci";
import Impostazioni from "@/pages/Impostazioni";
import ReclamaProfilo from "@/pages/ReclamaProfilo";
import DettaglioOpinione from "@/pages/opinioni/DettaglioOpinione";

// Import pagine di gestione
import GestisciGrazia from "@/pages/GestisciGrazia";
import GestisciOpinioni from "@/pages/GestisciOpinioni";
import GestisciIniziativePopolari from "@/pages/GestisciIniziativePopolari";
import GestisciReferendumAbrogativi from "@/pages/GestisciReferendumAbrogativi";
import GestisciGoverno from "@/pages/GestisciGoverno";
import VotaIniziativaPopolare from "@/pages/VotaIniziativaPopolare";
import VotaReferendumAbrogativo from "@/pages/VotaReferendumAbrogativo";
import Votazione from "@/pages/Votazione";
import Evento from "@/pages/Evento";
import Programma from "@/pages/Programma";
import Dona from "@/pages/Dona";
import ProponiOpinione from "@/pages/ProponiOpinione";
import ICE from "@/pages/ICE";
import GestisciICE from "@/pages/GestisciICE";
import VotaICE from "@/pages/VotaICE";
import DebugAuth from "@/pages/debug-auth";
import Riscontro from "@/pages/Riscontro";

// Import pagine sondaggi
import Sondaggi from "@/pages/Sondaggi";
import SondaggiRegione from "@/pages/SondaggiRegione";
import SondaggiProvincia from "@/pages/SondaggiProvincia";
import SondaggiComune from "@/pages/SondaggiComune";
import StatisticheOpinione from "@/pages/StatisticheOpinione";

// Import pagine auth e utility
import ResetPasswordPage from "@/pages/reset-password";
import ResetPasswordConfirmPage from "@/pages/reset-password-confirm";
import VerifyEmail from "@/pages/verify-email";
import Informazioni from "@/pages/Informazioni";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import NotFound from "@/pages/not-found";

// Import componenti
import Navbar from "@/components/Navbar";
import DatabaseTest from "@/components/DatabaseTest";

// Export di tutti i componenti per facilitare l'import
export const pageComponents = {
  // Pagine principali
  Home,
  LandingPage,
  AuthPage,
  Menu,
  Profilo,
  GestisciUtenti,
  GestisciElezioni,
  Opinioni,
  OpinioniEuropee,
  OpinioniNazionali,
  OpinioniRegionali,
  OpinioniComunali,
  Rappresentanti,
  Elezioni,
  ScegliRappresentante,
  ScegliCandidato,
  StatisticheUtenti,
  RegistrazioneCandidatura,
  RegistrazioneElezione,
  
  // Pagine di registrazione
  RegistrazioneNome,
  RegistrazioneGenere,
  RegistrazioneCittadinanza,
  RegistrazioneDataNascita,
  RegistrazioneCodiceFiscale,
  RegistrazioneDati,
  RegistrazioneResidenza,
  
  // Pagine funzionali
  Strumenti,
  PodioTrasparenza,
  Notifiche,
  ModificaImmagine,
  CapodiStato,
  Governo,
  Grazia,
  Amnistia,
  Vota,
  Eventi,
  Proponi,
  IniziativePopolare,
  ReferendumAbrogativi,
  Sostenitori,
  Gestisci,
  Impostazioni,
  ReclamaProfilo,
  DettaglioOpinione,
  
  // Pagine di gestione
  GestisciGrazia,
  GestisciOpinioni,
  GestisciIniziativePopolari,
  GestisciReferendumAbrogativi,
  GestisciGoverno,
  VotaIniziativaPopolare,
  VotaReferendumAbrogativo,
  Votazione,
  Evento,
  Programma,
  Dona,
  ProponiOpinione,
  ICE,
  GestisciICE,
  VotaICE,
  DebugAuth,
  Riscontro,
  
  // Pagine sondaggi
  Sondaggi,
  SondaggiRegione,
  SondaggiProvincia,
  SondaggiComune,
  StatisticheOpinione,
  
  // Pagine auth e utility
  ResetPasswordPage,
  ResetPasswordConfirmPage,
  VerifyEmail,
  Informazioni,
  PrivacyPolicy,
  NotFound,
  
  // Componenti
  Navbar,
  DatabaseTest,
};
