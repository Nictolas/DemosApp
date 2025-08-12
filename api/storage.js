// Importa la connessione PostgreSQL
const { pool } = require('./config/db');

const storage = {
  // Inserisce un nuovo profilo utente in PostgreSQL
  async insertUser(userData) {
    try {
      const columns = Object.keys(userData).map(key => `"${key}"`).join(', ');
      const values = Object.values(userData);
      const valuePlaceholders = values.map((_, i) => `$${i + 1}`).join(', ');
      
      const query = `INSERT INTO utenti (${columns}) VALUES (${valuePlaceholders}) RETURNING *`;
      const result = await pool.query(query, values);
      
      return result.rows[0];
    } catch (error) {
      console.error('Errore inserimento utente:', error);
      throw error;
    }
  },

  // Ottiene tutti gli utenti da PostgreSQL
  async getAllUsers() {
    try {
      const result = await pool.query('SELECT * FROM utenti ORDER BY data_registrazione DESC');
      return result.rows;
    } catch (error) {
      console.error('Errore recupero utenti:', error);
      throw error;
    }
  },

  // Ottiene un utente per ID da PostgreSQL
  async getUserById(id) {
    try {
      const result = await pool.query('SELECT * FROM utenti WHERE id = $1', [id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Errore recupero utente per ID:', error);
      throw error;
    }
  },

  // Crea un nuovo utente
  async createUser(data) {
    return await this.insertUser(data);
  },

  // Ottiene il profilo utente tramite un campo userId
  async getUserProfile(userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM utenti WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Errore recupero profilo utente:', error);
      throw error;
    }
  },

  // Aggiorna un utente esistente
  async updateUser(id, updateData) {
    try {
      const columns = Object.keys(updateData).map(key => `"${key}" = $${Object.keys(updateData).indexOf(key) + 2}`);
      const values = [id, ...Object.values(updateData)];
      
      const query = `UPDATE utenti SET ${columns.join(', ')} WHERE id = $1 RETURNING *`;
      const result = await pool.query(query, values);
      
      return result.rows[0];
    } catch (error) {
      console.error('Errore aggiornamento utente:', error);
      throw error;
    }
  },

  // Elimina un utente
  async deleteUser(id) {
    try {
      const result = await pool.query('DELETE FROM utenti WHERE id = $1 RETURNING *', [id]);
      return result.rows[0];
    } catch (error) {
      console.error('Errore eliminazione utente:', error);
      throw error;
    }
  }
};

module.exports = { storage }; 