const app = require('./app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server avviato sulla porta ${PORT}`);
  console.log(`🌐 API disponibile su http://localhost:${PORT}`);
  console.log(`📧 Resend configurato: ${process.env.RESEND_API_KEY ? 'Sì' : 'No'}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'Configurato' : 'Non configurato'}`);
});
