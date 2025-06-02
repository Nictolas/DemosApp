// Script per completare la migrazione da Supabase a Firebase
const fs = require('fs');
const path = require('path');

function fixFirebaseMigration() {
  // Lista dei file da aggiornare
  const files = [
    'client/src/components/EditUserDialog.tsx',
    'client/src/pages/ScegliRappresentante.tsx',
    'client/src/pages/Rappresentanti.tsx',
    'client/src/pages/StatisticheUtenti.tsx',
    'client/src/pages/GestisciUtenti.tsx'
  ];

  files.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Rimuovi tutte le chiamate db.from() problematiche
      content = content.replace(/const \{ data[^}]*\} = await db[^;]*;/g, 
        '// REMOVED: Direct database call - use API instead');
      
      // Rimuovi import di db se presente
      content = content.replace(/import \{ db[^}]*\} from[^;]*;/g, '');
      
      fs.writeFileSync(filePath, content);
      console.log(`Fixed: ${filePath}`);
    }
  });
}

fixFirebaseMigration();