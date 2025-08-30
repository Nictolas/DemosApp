import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    console.log('🔍 Controllo email nel database:', email);

    // Controlla se l'email esiste nella tabella users
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const exists = result.rows.length > 0;
    console.log('📊 Email trovata nel database:', exists, 'Righe:', result.rows.length);

    res.status(200).json({ exists });

  } catch (error) {
    console.error('💥 Errore durante il controllo email:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    await pool.end();
  }
}
