const { pool } = require('./config/db');

async function migrateMinisteriFromVoti() {
  try {
    // Ottieni le categorie dai voti esistenti
    const votiResult = await pool.query('SELECT DISTINCT categoria FROM voti_ministri WHERE categoria IS NOT NULL');
    const categorieSet = new Set(votiResult.rows.map(row => row.categoria));

    // Ottieni le categorie dei ministeri esistenti
    const ministeriResult = await pool.query('SELECT DISTINCT categoria FROM ministeri WHERE categoria IS NOT NULL');
    const ministeriEsistenti = new Set(ministeriResult.rows.map(row => row.categoria));

    let count = 0;
    for (const categoria of categorieSet) {
      if (!ministeriEsistenti.has(categoria)) {
        await pool.query(
          'INSERT INTO ministeri (nome, categoria, descrizione, abilitato) VALUES ($1, $2, $3, $4)',
          [
            categoria.charAt(0).toUpperCase() + categoria.slice(1).replace(/_/g, ' '),
            categoria,
            '',
            true
          ]
        );
        count++;
        console.log('Aggiunto ministero:', categoria);
      }
    }
    console.log(`Aggiunti ${count} nuovi ministeri.`);
  } catch (error) {
    console.error('Errore durante la migrazione:', error);
    throw error;
  }
}

migrateMinisteriFromVoti().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); }); 