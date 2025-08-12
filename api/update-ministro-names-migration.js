const { pool } = require('./config/db');

async function updateMinistroNames() {
  try {
    // Ottieni tutti i ministeri
    const ministeriResult = await pool.query('SELECT id, nome, categoria FROM ministeri');
    
    for (const ministro of ministeriResult.rows) {
      const nuovoNome = ministro.categoria.charAt(0).toUpperCase() + 
                       ministro.categoria.slice(1).replace(/_/g, ' ');
      
      if (nuovoNome !== ministro.nome) {
        await pool.query(
          'UPDATE ministeri SET nome = $1 WHERE id = $2',
          [nuovoNome, ministro.id]
        );
        console.log(`Aggiornato ministero ${ministro.categoria}: "${ministro.nome}" -> "${nuovoNome}"`);
      }
    }
    
    console.log('Migrazione completata con successo!');
  } catch (error) {
    console.error('Errore durante la migrazione:', error);
    throw error;
  }
}

updateMinistroNames().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); }); 