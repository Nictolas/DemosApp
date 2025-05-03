pabaseService.tempOpinions || {};
        delete SupabaseService.tempOpinions[utenteId]; // Rimuovi dalla memoria temporanea
      }
      
      return { success: true, data: result ? result.data : [opinionData] };
    } catch (error: any) {
      console.error('Exception saving opinions in Supabase:', error);
      
      // Controlla se l'errore è relativo alla chiave esterna (foreign key constraint)
      if (error.code === '23503' && error.message.includes('violates foreign key constraint')) {
        console.log('Errore di vincolo di chiave esterna. Verificare se:');
        console.log('1. L\'utente esiste nella tabella users di Supabase');
        console.log('2. Il vincolo di chiave esterna è configurato correttamente');
        console.log('3. L\'ID utente è stato passato correttamente');
        
        // Salviamo temporaneamente in memoria le opinioni
        console.log('Salvataggio temporaneo delle opinioni in memoria...');
      }
      
      // Salviamo in memoria le opinioni
      SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
      SupabaseService.tempOpinions[utenteId] = {
        utente_id: utenteId,
        ...opinions
      };
      
      return { 
        success: true, 
        data: [{
          utente_id: utenteId,
          ...opinions
        }],
        note: "I dati sono stati salvati temporaneamente in memoria a causa di un errore nel database: " + (error.message || 'Errore sconosciuto')
      };
    }
  }
  
  // Variabile statica per memorizzare temporaneamente le opinioni in caso di errori
  static tempOpinions: Record<string, any> = {};

  /**
   * Recupera le opinioni dell'utente da Supabase tramite ID utente
   */
  static async getUserOpinions(utenteId: string): Promise<{ 
    energia_nucleare?: string; 
    sperimentazione_animale?: string;
    legalizzazione_canapa?: string;
    caccia?: string;
    unione_europea?: string;
  } | null> {
    try {
      // Prima controlla se abbiamo dei dati in memoria per questo utente
      if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[utenteId]) {
        console.log('Recuperando opinioni dalla memoria temporanea per utenteId:', utenteId);
        return SupabaseService.tempOpinions[utenteId];
      }
      
      // Scegliamo quale client Supabase usare (admin o regolare)
      // Il client admin bypassa le policy RLS
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Recuperando opinioni con client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      // Prima di tutto, dobbiamo verificare se l'utente esiste nella tabella "utenti" e ottenere
      // il corrispondente user_id dalla tabella "users", che è quello che ci serve
      let usersId: number | null = null;
      
      // Se l'ID utente è un'email, ottieni l'ID dalla tabella users tramite email
      if (utenteId.includes('@')) {
        console.log(`Il valore utenteId è un'email: ${utenteId}, cercando l'ID corrispondente nella tabella users`);
        
        const { data: userData, error: userError } = await client
          .from('users')
          .select('id')
          .eq('email', utenteId)
          .single();
          
        if (userError || !userData) {
          console.error(`Errore nel recuperare l'ID dalla tabella users per l'email ${utenteId}:`, userError);
          // Controlla se abbiamo dati in memoria prima di restituire un oggetto vuoto
          if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[utenteId]) {
            return SupabaseService.tempOpinions[utenteId];
          }
          
          return {
            energia_nucleare: '',
            sperimentazione_animale: '',
            legalizzazione_canapa: '',
            caccia: '',
            unione_europea: ''
          };
        }
        
        usersId = userData.id;
        console.log(`ID numerico recuperato dalla tabella users per l'email ${utenteId}: ${usersId}`);
      } 
      // Se l'ID sembra essere numerico, usalo direttamente
      else if (!isNaN(Number(utenteId))) {
        usersId = Number(utenteId);
        console.log(`L'ID utente fornito è già numerico: ${usersId}`);
      } 
      // Altrimenti, prova a usarlo così com'è (può essere un UUID)
      else {
        console.log(`Utilizzo l'ID così com'è, assumendo che sia un riferimento diretto: ${utenteId}`);
        // Verifica se l'ID si riferisce a un record nella tabella utenti che ha un user_id
        const { data: utentiData, error: utentiError } = await client
          .from('utenti')
          .select('user_id')
          .eq('id', utenteId)
          .single();
          
        if (!utentiError && utentiData && utentiData.user_id) {
          usersId = utentiData.user_id;
          console.log(`Trovato riferimento a user_id ${usersId} per l'utente con ID ${utenteId}`);
        } else {
          usersId = null; // Useremo l'ID originale
        }
      }
      
      // Ora prova a recuperare da Supabase usando l'ID corretto
      const queryId = usersId ? usersId.toString() : utenteId;
      console.log(`Interrogazione alla tabella opinioni con utente_id = ${queryId}`);
      
      const { data, error } = await client
        .from('opinioni')
        .select('*')
        .eq('utente_id', queryId)
        .single();
      
      if (error) {
        console.error('Error getting user opinions from Supabase:', error);
        
        // Se l'errore è dovuto a RLS o record non trovato, restituiamo un oggetto vuoto
        // che verrà interpretato come "non ci sono ancora opinioni"
        if (error.code === 'PGRST116' || error.code === '42501') {
          // Se stiamo già usando il client admin e c'è un errore, non ci sono davvero opinioni
          if (usingAdminClient) {
            console.log('Nessuna opinione trovata per l\'utente (verificato con client admin)');
          } else {
            console.log('Errore di accesso con client standard, possibile problema di RLS');
          }
          
          // Controlla se abbiamo dati in memoria prima di restituire un oggetto vuoto
          if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[utenteId]) {
            return SupabaseService.tempOpinions[utenteId];
          }
          
          return {
            energia_nucleare: '',
            sperimentazione_animale: '',
            legalizzazione_canapa: '',
            caccia: '',
            unione_europea: ''
          };
        }
        
        return null;
      }
      
      if (!data) {
        // Se non ci sono dati ma non c'è stato un errore, restituiamo un oggetto vuoto
        // o i dati in memoria, se disponibili
        if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[utenteId]) {
          return SupabaseService.tempOpinions[utenteId];
        }
        
        return {
          energia_nucleare: '',
          sperimentazione_animale: '',
          legalizzazione_canapa: '',
          caccia: '',
          unione_europea: ''
        };
      }
      
      // Se abbiamo recuperato dati da Supabase, aggiorna anche la cache in memoria
      SupabaseService.tempOpinions = SupabaseService.tempOpinions || {};
      SupabaseService.tempOpinions[utenteId] = data;
      
      return data;
    } catch (error) {
      console.error('Exception getting user opinions from Supabase:', error);
      
      // In caso di eccezione, prova a restituire i dati in memoria se disponibili
      if (SupabaseService.tempOpinions && SupabaseService.tempOpinions[utenteId]) {
        return SupabaseService.tempOpinions[utenteId];
      }
      
      return null;
    }
  }

  /**
   * Recupera le opinioni di tutti gli utenti
   */
  static async getAllOpinions(): Promise<any[]> {
    try {
      // Scegliamo quale client Supabase usare (admin o regolare)
      const client = supabaseAdmin || supabase;
      const usingAdminClient = !!supabaseAdmin;
      
      console.log(`Recuperando tutte le opinioni con client Supabase ${usingAdminClient ? 'ADMIN (bypassa RLS)' : 'standard (soggetto a RLS)'}`);
      
      const { data, error } = await client
        .from('opinioni')
        .select('*');
      
      if (error || !data) {
        console.error('Error getting all opinions from Supabase:', error);
        
        // Se c'è un errore, restituisci i dati memorizzati in tempOpinions
        if (SupabaseService.tempOpinions) {
          // Converti l'oggetto tempOpinions in un array
          const opinionArray = Object.values(SupabaseService.tempOpinions);
          console.log('Using in-memory opinions instead of database:', opinionArray);
          return opinionArray;
        }
        
        return [];
      }
      
      // Combina i dati dal database con quelli in memoria
      // Questo è importante per visualizzare sia i dati permanenti che quelli temporanei
      const dbData = data || [];
      const memoryData = Object.values(SupabaseService.tempOpinions || {});
      
      // Crea una mappa per evitare duplicati
      const opinionMap = new Map();
      
      // Aggiungi prima i dati dal database
      for (const opinion of dbData) {
        opinionMap.set(opinion.utente_id, opinion);
      }
      
      // Poi aggiungi o sostituisci con i dati in memoria, che hanno priorità perché più recenti
      for (const opinion of memoryData) {
        opinionMap.set(opinion.utente_id, opinion);
      }
      
      // Converti la mappa in un array
      const combinedData = Array.from(opinionMap.values());
      
      return combinedData;
    } catch (error) {
      console.error('Exception getting all opinions from Supabase:', error);
      
      // In caso di eccezione, prova a restituire i dati in memoria
      if (SupabaseService.tempOpinions) {
        return Object.values(SupabaseService.tempOpinions);
      }
      
      return [];
    }
  }
}

export default SupabaseService;