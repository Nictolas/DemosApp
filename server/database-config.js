import mysql from 'mysql2/promise';

// Crea un pool di connessioni per gestire le richieste al database in modo efficiente.
export const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});