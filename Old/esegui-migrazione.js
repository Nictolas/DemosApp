// Script per eseguire la migrazione delle colonne dopo il deploy
// Chiama questo script DOPO che il server è stato deployato su Render

fetch('https://demos-c7k0.onrender.com/api/migrate/columns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
})
.then(response => response.json())
.then(data => {
  console.log('✅ Migrazione completata:', data);
})
.catch(error => {
  console.error('❌ Errore:', error);
});

