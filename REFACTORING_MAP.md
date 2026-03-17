# 🗺️ **MAPPA COMPLETA DEL REFACTORING - DemosApp**

## 📋 **Panoramica**
Questo documento mappa tutti i file creati, modificati o spostati durante i refactoring del progetto DemosApp, con le loro funzioni specifiche.

---

## 🏗️ **STRUTTURA PRINCIPALE**

### **Frontend (client/src/)**

#### **📁 Pages - Pagine Principali**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `pages/auth-page.tsx` | Pagina di autenticazione (login/registrazione) | ✅ Modificato | Controllo email duplicata ripristinato |
| `pages/LandingPage.tsx` | Pagina di benvenuto | ✅ Esistente | - |
| `pages/Menu/index.tsx` | Menu principale dell'app | ✅ Modificato | Layout e padding corretti |
| `pages/Profilo.tsx` | Profilo utente | ✅ Esistente | - |
| `pages/Opinioni.tsx` | Selezione categorie opinioni | ✅ Modificato | Altezza bottoni aumentata |
| `pages/Rappresentanti/index.tsx` | Lista rappresentanti | ✅ Modificato | Layout ottimizzato |
| `pages/Strumenti.tsx` | Strumenti avanzati | ✅ Ripristinato | Contenuto da backup |
| `pages/Elezioni/index.tsx` | Pagina elezioni | ✅ Esistente | - |
| `pages/Eventi.tsx` | Lista eventi | ✅ Modificato | Cards responsive |
| `pages/Evento.tsx` | Form creazione evento | ✅ Modificato | Dropdown sequenziali, auto-organizzatore |
| `pages/CapodiStato.tsx` | Capo di Stato | ✅ Esistente | - |
| `pages/Grazia.tsx` | Richieste grazia | ✅ Esistente | - |
| `pages/Amnistia.tsx` | Amnistia | ✅ Esistente | - |

#### **📁 Pages - Registrazione Multi-Pagina**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `pages/registrazione-1-email.tsx` | Prima fase: Email | ✅ Esistente | Naviga a codice fiscale |
| `pages/registrazione-codice-fiscale.tsx` | Codice fiscale | ✅ Esistente | - |
| `pages/registrazione-nome.tsx` | Nome e cognome | ✅ Esistente | - |
| `pages/registrazione-genere.tsx` | Selezione genere | ✅ Esistente | - |
| `pages/registrazione-cittadinanza.tsx` | Cittadinanza | ✅ Esistente | - |
| `pages/registrazione-data-nascita.tsx` | Data di nascita | ✅ Esistente | - |
| `pages/registrazione-3-residenza.tsx` | Dati residenza | ✅ Modificato | Naviga a /registrazione-2-dati |
| `pages/registrazione-2-dati/index.tsx` | Dati completi | ✅ Esistente | Form modulare |
| `pages/registrazione-ruolo.tsx` | Selezione ruolo e candidature | ✅ Creato | Con campi condizionali |

#### **📁 Pages - Gestione**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `pages/GestisciUtenti/index.tsx` | Gestione utenti | ✅ Modificato | Import corretti |
| `pages/GestisciElezioni.tsx` | Gestione elezioni | ✅ Esistente | - |
| `pages/GestisciGrazia.tsx` | Gestione grazia | ✅ Esistente | - |
| `pages/GestisciOpinioni.tsx` | Gestione opinioni | ✅ Esistente | - |
| `pages/GestisciGoverno.tsx` | Gestione governo | ✅ Modificato | Export corretto |

#### **📁 Pages - Proponi**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `pages/ProponiReferendumAbrogativi.tsx` | Proponi referendum | ✅ Creato | Placeholder |
| `pages/ProponiIniziativaPopolare.tsx` | Proponi iniziativa | ✅ Creato | Placeholder |
| `pages/ProponiICE.tsx` | Proponi ICE | ✅ Creato | Placeholder |

#### **📁 Components**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `components/Navbar.tsx` | Barra navigazione fissa | ✅ Modificato | "Vota" rimosso, "Strumenti" aggiunto |
| `components/PageTransition.tsx` | Transizioni pagine | ✅ Esistente | - |
| `components/ProtectedRoute.tsx` | Route protette | ✅ Esistente | - |

#### **📁 Pages/Rappresentanti/Components**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `components/CategoriaPrincipale.tsx` | Card rappresentante principale | ✅ Modificato | Dimensioni aumentate |
| `components/RappresentanteCard.tsx` | Card rappresentanti secondari | ✅ Modificato | Dimensioni aumentate |

#### **📁 Pages/Menu/Components**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `components/MenuButton.tsx` | Pulsante menu singolo | ✅ Modificato | Altezza aumentata |
| `components/MenuGrid.tsx` | Griglia pulsanti menu | ✅ Modificato | Debug rimosso |
| `constants/menuItems.ts` | Configurazione menu | ✅ Modificato | "Vota" aggiunto, "Strumenti" rimosso |

#### **📁 Pages/registrazione-2-dati/**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `index.tsx` | Componente principale | ✅ Esistente | - |
| `types/index.ts` | Interfacce TypeScript | ✅ Esistente | - |
| `schemas/validationSchema.ts` | Schema validazione Zod | ✅ Esistente | - |
| `hooks/useGeographicData.ts` | Hook dati geografici | ✅ Esistente | - |
| `hooks/useLocalStorage.ts` | Hook localStorage | ✅ Esistente | - |
| `hooks/useRegistrationForm.ts` | Hook form principale | ✅ Esistente | - |
| `components/FormField.tsx` | Campo input | ✅ Esistente | - |
| `components/SelectField.tsx` | Campo select | ✅ Esistente | - |
| `components/GeographicSelects.tsx` | Selezioni geografiche | ✅ Esistente | - |
| `components/NavigationButtons.tsx` | Pulsanti navigazione | ✅ Esistente | - |
| `components/RegistrationForm.tsx` | Form principale | ✅ Modificato | Naviga a /registrazione-ruolo |

#### **📁 Pages/GestisciUtenti/**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `components/UsersTable.tsx` | Tabella utenti | ✅ Modificato | Import corretti |
| `utils/columnUtils.ts` | Utility colonne | ✅ Esistente | - |
| `utils/renderUtils.tsx` | Utility rendering | ✅ Modificato | Estensione .tsx |

---

## 🔧 **Backend (api/)**

#### **📁 Routes**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `routes/email.js` | Endpoint email e registrazione | ✅ Esistente | Controllo email duplicata |
| `routes/auth/registration.js` | Registrazione utenti | ✅ Esistente | Validazione completa |
| `routes/auth/index.js` | Indice auth routes | ✅ Esistente | - |
| `routes/eventi.js` | Gestione eventi | ✅ Modificato | Colonna organizzatore |
| `routes/amnistia.js` | Amnistia | ✅ Esistente | - |
| `routes/capo-stato.js` | Capo di Stato | ✅ Esistente | - |
| `routes/candidati.js` | Candidati | ✅ Esistente | - |
| `routes/elezioni.js` | Elezioni | ✅ Esistente | - |
| `routes/ice.js` | ICE | ✅ Esistente | - |
| `routes/iniziative-popolari.js` | Iniziative popolari | ✅ Esistente | - |
| `routes/referendum.js` | Referendum | ✅ Esistente | - |
| `routes/comunicazioni.js` | Comunicazioni | ✅ Esistente | - |
| `routes/grazia.js` | Grazia | ✅ Esistente | - |

#### **📁 Middleware**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `middleware/auth.js` | Autenticazione | ✅ Esistente | - |
| `middleware/validation.js` | Validazione input | ✅ Esistente | - |

#### **📁 Services**
| File | Funzione | Status | Note |
|------|----------|--------|------|
| `services/emailService.js` | Servizio email | ✅ Esistente | - |

---

## 🗂️ **File di Configurazione**

| File | Funzione | Status | Note |
|------|----------|--------|------|
| `App.tsx` | Router principale | ✅ Modificato | Route aggiunte, import corretti |
| `package.json` | Dipendenze | ✅ Esistente | - |
| `components.json` | Configurazione UI | ✅ Esistente | - |

---

## 📊 **STATISTICHE REFACTORING**

### **File Creati**: 3
- `pages/registrazione-ruolo.tsx`
- `pages/ProponiReferendumAbrogativi.tsx`
- `pages/ProponiIniziativaPopolare.tsx`
- `pages/ProponiICE.tsx`

### **File Modificati**: 15
- `pages/auth-page.tsx`
- `pages/Menu/index.tsx`
- `pages/Opinioni.tsx`
- `pages/Rappresentanti/index.tsx`
- `pages/Strumenti.tsx`
- `pages/Eventi.tsx`
- `pages/Evento.tsx`
- `pages/registrazione-3-residenza.tsx`
- `pages/registrazione-2-dati/components/RegistrationForm.tsx`
- `pages/GestisciUtenti/index.tsx`
- `pages/GestisciGoverno.tsx`
- `pages/GestisciUtenti/components/UsersTable.tsx`
- `pages/GestisciUtenti/utils/renderUtils.tsx`
- `components/Navbar.tsx`
- `App.tsx`

### **File Rimossi**: 1
- `api/routes/auth/check-email.js` (duplicato)

---

## 🎯 **FUNZIONALITÀ PRINCIPALI**

### **✅ Completate**
1. **Sistema di registrazione multi-pagina** con controllo email duplicata
2. **Layout responsive** per tutte le pagine
3. **Navbar fissa** con navigazione corretta
4. **Menu ottimizzato** con bottoni di altezza corretta
5. **Sistema eventi** con form completo
6. **Gestione rappresentanti** con layout migliorato
7. **Strumenti avanzati** ripristinati
8. **API routes** tutte funzionanti

### **⚠️ Note Importanti**
- Il controllo email duplicata era già presente in `api/routes/email.js`
- La pagina `/registrazione-2-dati` contiene i dati completi, non la selezione ruolo
- La selezione ruolo è ora in `/registrazione-ruolo` con campi condizionali
- Tutti i file di gestione hanno import corretti

---

## 📝 **LEZIONI APPRESE**

1. **Verificare sempre** se una funzionalità esiste già prima di ricrearla
2. **Documentare** i cambiamenti durante il refactoring
3. **Mappare** la struttura esistente prima di modificare
4. **Testare** ogni modifica per assicurarsi che non rompa funzionalità esistenti

---

*Ultimo aggiornamento: Gennaio 2025*
*Versione: 1.0*
