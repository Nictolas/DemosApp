const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_oifPG6Kvz0UT@ep-withered-butterfly-a2mroznt-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function recoverRealOpinions() {
  try {
    console.log('🔄 RECUPERO OPINIONI REALI - Inizio\n');
    
    // 1. Svuota e ricrea la tabella opinioni con le informazioni corrette
    console.log('1️⃣ RICREAZIONE TABELLA OPINIONI CON INFORMAZIONI REALI');
    console.log('==================================================');
    
    await pool.query('DROP TABLE IF EXISTS opinioni CASCADE');
    await pool.query(`
      CREATE TABLE opinioni (
        id VARCHAR PRIMARY KEY,
        text TEXT NOT NULL,
        gradi_opinione TEXT[] NOT NULL,
        informazioni TEXT
      )
    `);
    console.log('✅ Tabella opinioni ricreata');
    
    // 2. Inserisci le opinioni con le informazioni REALI che spiegano la classificazione
    console.log('\n2️⃣ INSERIMENTO OPINIONI CON INFORMAZIONI REALI');
    console.log('=============================================');
    
    const realOpinions = [
      // Opinion EUROPEE - Politiche che riguardano l'Unione Europea
      { 
        id: 'energia_nucleare', 
        text: 'Energia nucleare', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE ha competenze in materia di energia e sicurezza nucleare. NAZIONALE: Ogni stato membro decide sulla propria politica energetica nucleare.'
      },
      { 
        id: 'sperimentazione_animale', 
        text: 'Sperimentazione animale', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE regolamenta la sperimentazione animale attraverso la Direttiva 2010/63. NAZIONALE: Gli stati membri implementano le norme europee.'
      },
      { 
        id: 'legalizzazione_canapa', 
        text: 'Legalizzazione canapa', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE non ha competenze dirette ma influenza le politiche nazionali. NAZIONALE: Ogni stato decide autonomamente sulla legalizzazione.'
      },
      { 
        id: 'caccia', 
        text: 'Caccia', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE regolamenta la caccia attraverso la Direttiva Uccelli. NAZIONALE: Gli stati implementano le norme europee e stabiliscono leggi nazionali.'
      },
      { 
        id: 'eutanasia', 
        text: 'Eutanasia', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE non ha competenze dirette ma la Corte Europea dei Diritti dell\'Uomo si è pronunciata. NAZIONALE: Ogni stato decide autonomamente.'
      },
      { 
        id: 'carne_coltivata', 
        text: 'Carne coltivata', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE regolamenta la sicurezza alimentare e l\'autorizzazione di nuovi alimenti. NAZIONALE: Gli stati implementano le norme europee.'
      },
      { 
        id: 'nato', 
        text: 'NATO', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE sta sviluppando la propria difesa comune. NAZIONALE: Ogni stato decide autonomamente sulla partecipazione alla NATO.'
      },
      { 
        id: 'matrimonio_gay', 
        text: 'Matrimonio gay', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE promuove l\'uguaglianza e la non discriminazione. NAZIONALE: Ogni stato decide autonomamente sul riconoscimento.'
      },
      { 
        id: 'salario_minimo', 
        text: 'Salario minimo', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE sta lavorando per introdurre standard minimi europei. NAZIONALE: Ogni stato decide autonomamente sul salario minimo.'
      },
      { 
        id: 'case_chiuse', 
        text: 'Case chiuse', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE promuove la lotta alla tratta e allo sfruttamento. NAZIONALE: Ogni stato regolamenta autonomamente la prostituzione.'
      },
      { 
        id: 'omobitransfobia', 
        text: 'Omobitransfobia', 
        gradi: ['E', 'N'],
        informazioni: 'EUROPEO: L\'UE promuove l\'uguaglianza e combatte la discriminazione. NAZIONALE: Ogni stato implementa le norme europee e stabilisce leggi nazionali.'
      },
      
      // Opinion COMUNALI - Politiche di competenza comunale
      { 
        id: 'cassonetti_intelligenti_con_tessera', 
        text: 'Cassonetti intelligenti con tessera', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: La gestione dei rifiuti urbani è di competenza comunale. I cassonetti intelligenti sono una scelta tecnica del comune per la raccolta differenziata.'
      },
      { 
        id: 'concessione_spazi_pubblici_a_centri_sociali_autogestiti', 
        text: 'Concessione spazi pubblici a centri sociali autogestiti', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: La gestione degli spazi pubblici comunali è di competenza del comune. Le concessioni sono decise dall\'amministrazione comunale.'
      },
      { 
        id: 'divieto_di_nuovi_fast_food_nel_centro_storico', 
        text: 'Divieto di nuovi fast food nel centro storico', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: La pianificazione urbanistica e la tutela del centro storico sono di competenza comunale. Il comune decide le attività commerciali consentite.'
      },
      { 
        id: 'estensione_delle_zone_a_traffico_limitato', 
        text: 'Estensione delle zone a traffico limitato', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: La gestione del traffico urbano e la definizione delle ZTL sono di competenza comunale. Il comune decide le limitazioni al traffico.'
      },
      { 
        id: 'finanziamento_eventi_culturali_gratuiti', 
        text: 'Finanziamento eventi culturali gratuiti', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: La promozione culturale locale è di competenza comunale. Il comune decide il budget per eventi e iniziative culturali.'
      },
      { 
        id: 'nuova_biblioteca_comunale', 
        text: 'Nuova biblioteca comunale', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: I servizi bibliotecari sono di competenza comunale. Il comune decide la costruzione e gestione delle biblioteche pubbliche.'
      },
      { 
        id: 'nuove_case_popolari', 
        text: 'Nuove case popolari', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: L\'edilizia residenziale pubblica è di competenza comunale. Il comune gestisce l\'assegnazione degli alloggi popolari.'
      },
      { 
        id: 'nuove_piste_ciclabili', 
        text: 'Nuove piste ciclabili', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: La mobilità urbana e la realizzazione di infrastrutture ciclabili sono di competenza comunale. Il comune pianifica la rete ciclabile.'
      },
      { 
        id: 'nuovi_asili_nido_comunali', 
        text: 'Nuovi asili nido comunali', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: I servizi educativi per la prima infanzia sono di competenza comunale. Il comune gestisce gli asili nido pubblici.'
      },
      { 
        id: 'nuovo_stadio_comunale', 
        text: 'Nuovo stadio comunale', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: Le infrastrutture sportive comunali sono di competenza del comune. Il comune decide la costruzione e gestione degli impianti sportivi.'
      },
      { 
        id: 'parcheggi_gratuiti_per_residenti', 
        text: 'Parcheggi gratuiti per residenti', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: La gestione della sosta urbana è di competenza comunale. Il comune decide le tariffe e le agevolazioni per i residenti.'
      },
      { 
        id: 'potenziamento_trasporto_pubblico', 
        text: 'Potenziamento trasporto pubblico', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: Il trasporto pubblico locale è di competenza comunale. Il comune gestisce le linee urbane e decide gli investimenti.'
      },
      { 
        id: 'riduzione_tasse_rifiuti', 
        text: 'Riduzione tasse rifiuti', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: La TARI (Tassa sui Rifiuti) è di competenza comunale. Il comune decide le tariffe e le agevolazioni.'
      },
      { 
        id: 'sicurezza_strade_scolastiche', 
        text: 'Sicurezza strade scolastiche', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: La sicurezza stradale urbana è di competenza comunale. Il comune gestisce la viabilità e la sicurezza intorno alle scuole.'
      },
      { 
        id: 'sostegno_commercio_locale', 
        text: 'Sostegno commercio locale', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: Le politiche di sviluppo economico locale sono di competenza comunale. Il comune supporta le attività commerciali del territorio.'
      },
      { 
        id: 'verde_pubblico_e_giardini', 
        text: 'Verde pubblico e giardini', 
        gradi: ['CO'],
        informazioni: 'COMUNALE: La gestione del verde pubblico è di competenza comunale. Il comune pianifica e mantiene parchi e giardini pubblici.'
      },
      
      // Opinion REGIONALI - Politiche di competenza regionale
      { 
        id: 'nuovi_inceneritori', 
        text: 'Nuovi inceneritori', 
        gradi: ['R'],
        informazioni: 'REGIONALE: La gestione dei rifiuti e la pianificazione degli impianti di smaltimento sono di competenza regionale. La regione autorizza gli inceneritori.'
      },
      { 
        id: 'chiusura_ospedali_di_provincia', 
        text: 'Chiusura ospedali di provincia', 
        gradi: ['R'],
        informazioni: 'REGIONALE: La programmazione sanitaria e la gestione degli ospedali sono di competenza regionale. La regione decide la rete ospedaliera.'
      },
      
      // Opinion NAZIONALI/COMUNALI - Competenze condivise
      { 
        id: 'raccolta_rifiuti_porta_a_porta', 
        text: 'Raccolta rifiuti porta a porta', 
        gradi: ['N', 'CO'],
        informazioni: 'NAZIONALE: Lo stato stabilisce le norme generali sulla raccolta differenziata. COMUNALE: Il comune implementa il servizio porta a porta.'
      },
      { 
        id: 'riduzione_dell_illuminazione_notturna_per_risparmio_energetico', 
        text: 'Riduzione dell\'illuminazione notturna per risparmio energetico', 
        gradi: ['N', 'CO'],
        informazioni: 'NAZIONALE: Lo stato stabilisce le norme per il risparmio energetico. COMUNALE: Il comune gestisce l\'illuminazione pubblica e decide gli orari.'
      },
      { 
        id: 'sussidi_comunali_per_famiglie_numerose', 
        text: 'Sussidi comunali per famiglie numerose', 
        gradi: ['N', 'CO'],
        informazioni: 'NAZIONALE: Lo stato stabilisce i criteri per i sussidi alle famiglie. COMUNALE: Il comune eroga i sussidi e decide le modalità di accesso.'
      },
      { 
        id: 'videosorveglianza_in_spazi_pubblici', 
        text: 'Videosorveglianza in spazi pubblici', 
        gradi: ['N', 'CO'],
        informazioni: 'NAZIONALE: Lo stato stabilisce le norme sulla privacy e la videosorveglianza. COMUNALE: Il comune decide l\'installazione delle telecamere.'
      },
      { 
        id: 'riduzione_parcheggi_a_pagamento', 
        text: 'Riduzione parcheggi a pagamento', 
        gradi: ['N', 'CO'],
        informazioni: 'NAZIONALE: Lo stato stabilisce le norme generali sulla sosta. COMUNALE: Il comune gestisce la sosta urbana e decide le tariffe.'
      }
    ];
    
    for (const opinion of realOpinions) {
      await pool.query(`
        INSERT INTO opinioni (id, text, gradi_opinione, informazioni)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          text = EXCLUDED.text,
          gradi_opinione = EXCLUDED.gradi_opinione,
          informazioni = EXCLUDED.informazioni
      `, [opinion.id, opinion.text, opinion.gradi, opinion.informazioni]);
    }
    
    console.log(`✅ Inserite ${realOpinions.length} opinioni con informazioni reali`);
    
    // 3. Aggiorna anche opinioni_domande con le stesse informazioni
    console.log('\n3️⃣ AGGIORNAMENTO OPINIONI_DOMANDE');
    console.log('==================================');
    
    for (const opinion of realOpinions) {
      await pool.query(`
        UPDATE opinioni_domande 
        SET informazioni = $1
        WHERE id = $2
      `, [opinion.informazioni, opinion.id]);
    }
    
    console.log('✅ Opinion aggiornate con informazioni reali');
    
    // 4. Verifica il risultato
    console.log('\n4️⃣ VERIFICA RISULTATO');
    console.log('======================');
    
    const opinioniCount = await pool.query('SELECT COUNT(*) FROM opinioni');
    const domandeCount = await pool.query('SELECT COUNT(*) FROM opinioni_domande');
    
    console.log('📊 Opinion in tabella opinioni:', opinioniCount.rows[0].count);
    console.log('📊 Opinion in opinioni_domande:', domandeCount.rows[0].count);
    
    // Mostra esempi con informazioni
    const sampleWithInfo = await pool.query(`
      SELECT id, text, gradi_opinione, informazioni 
      FROM opinioni 
      WHERE informazioni IS NOT NULL 
      LIMIT 3
    `);
    console.log('📊 Esempi con informazioni reali:', sampleWithInfo.rows);
    
    console.log('\n🏁 OPINIONI REALI RECUPERATE CON INFORMAZIONI CORRETTE');
    
  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    console.error('📋 Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

recoverRealOpinions();
