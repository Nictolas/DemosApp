const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
require('dotenv').config();

// Configurazione database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});

// Configurazione export
const EXPORT_CONFIG = {
  // Directory di destinazione (hard disk esterno)
  outputDir: process.env.EXPORT_DIR || '/mnt/external-drive/archivio',
  
  // Compressione
  compression: {
    enabled: true,
    algorithm: 'gzip',
    level: 6
  },
  
  // Formato file
  format: 'csv', // o 'json'
  
  // Dimensione massima file (in MB)
  maxFileSize: 100,
  
  // Batch size per query
  batchSize: 10000
};

// Tabelle da esportare con configurazioni
const EXPORT_TABLES = {
  centralized_logs: {
    enabled: true,
    retentionDays: 30,
    columns: '*', // o array specifico di colonne
    whereClause: 'created_at < NOW() - INTERVAL \'30 days\''
  },
  security_events: {
    enabled: true,
    retentionDays: 30,
    columns: '*',
    whereClause: 'created_at < NOW() - INTERVAL \'30 days\''
  },
  performance_metrics: {
    enabled: true,
    retentionDays: 7,
    columns: '*',
    whereClause: 'created_at < NOW() - INTERVAL \'7 days\''
  },
  health_checks: {
    enabled: true,
    retentionDays: 7,
    columns: '*',
    whereClause: 'created_at < NOW() - INTERVAL \'7 days\''
  },
  access_audit: {
    enabled: true,
    retentionDays: 30,
    columns: '*',
    whereClause: 'created_at < NOW() - INTERVAL \'30 days\''
  },
  audit_logs: {
    enabled: true,
    retentionDays: 30,
    columns: '*',
    whereClause: 'created_at < NOW() - INTERVAL \'30 days\''
  }
};

/**
 * Crea la struttura delle directory
 */
async function createDirectoryStructure() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const monthName = currentDate.toLocaleString('it-IT', { month: 'long' });
  
  const baseDir = path.join(EXPORT_CONFIG.outputDir, year.toString());
  const monthDir = path.join(baseDir, `${month}-${monthName}`);
  
  // Crea directory se non esistono
  await fs.mkdir(baseDir, { recursive: true });
  await fs.mkdir(monthDir, { recursive: true });
  
  return { baseDir, monthDir };
}

/**
 * Verifica se una tabella esiste
 */
async function checkTableExists(tableName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `;
  
  const result = await pool.query(query, [tableName]);
  return result.rows[0].exists;
}

/**
 * Conta i record da esportare
 */
async function countRecordsToExport(tableName, whereClause) {
  const query = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`;
  const result = await pool.query(query);
  return parseInt(result.rows[0].count);
}

/**
 * Esporta una tabella in CSV
 */
async function exportTableToCSV(tableName, config, outputPath) {
  console.log(`📊 Esportazione ${tableName}...`);
  
  const totalRecords = await countRecordsToExport(tableName, config.whereClause);
  console.log(`   Record da esportare: ${totalRecords.toLocaleString()}`);
  
  if (totalRecords === 0) {
    console.log(`   ✅ Nessun record da esportare per ${tableName}`);
    return { exported: 0, files: [] };
  }
  
  const files = [];
  let exported = 0;
  let fileIndex = 1;
  
  // Esporta in batch per evitare problemi di memoria
  while (exported < totalRecords) {
    const offset = exported;
    const limit = EXPORT_CONFIG.batchSize;
    
    const query = `
      SELECT ${config.columns}
      FROM ${tableName}
      WHERE ${config.whereClause}
      ORDER BY created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const result = await pool.query(query);
    
    if (result.rows.length === 0) break;
    
    // Crea nome file
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${tableName}_${timestamp}_part${fileIndex}.csv`;
    const filepath = path.join(outputPath, filename);
    
    // Converte in CSV
    const csvContent = await convertToCSV(result.rows);
    
    // Comprimi se abilitato
    let finalContent = csvContent;
    let finalFilename = filename;
    
    if (EXPORT_CONFIG.compression.enabled) {
      const gzip = promisify(zlib.gzip);
      finalContent = await gzip(csvContent, { level: EXPORT_CONFIG.compression.level });
      finalFilename = filename + '.gz';
    }
    
    // Salva file
    await fs.writeFile(path.join(outputPath, finalFilename), finalContent);
    
    files.push({
      filename: finalFilename,
      originalSize: csvContent.length,
      compressedSize: finalContent.length,
      records: result.rows.length
    });
    
    exported += result.rows.length;
    fileIndex++;
    
    console.log(`   📁 File ${fileIndex - 1}: ${finalFilename} (${result.rows.length} record)`);
  }
  
  console.log(`   ✅ Esportazione completata: ${exported.toLocaleString()} record in ${files.length} file`);
  
  return { exported, files };
}

/**
 * Converte array di oggetti in CSV
 */
async function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Header
  csvRows.push(headers.join(','));
  
  // Dati
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      
      // Escape valori che contengono virgole o virgolette
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * Crea indice dei file esportati
 */
async function createIndex(monthDir, exports) {
  const indexData = {
    exportDate: new Date().toISOString(),
    totalTables: Object.keys(exports).length,
    totalRecords: Object.values(exports).reduce((sum, exp) => sum + exp.exported, 0),
    totalFiles: Object.values(exports).reduce((sum, exp) => sum + exp.files.length, 0),
    tables: exports
  };
  
  const indexPath = path.join(monthDir, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
  
  console.log(`📋 Indice creato: ${indexPath}`);
  return indexData;
}

/**
 * Aggiorna indice generale
 */
async function updateGeneralIndex(baseDir, monthIndex) {
  const generalIndexPath = path.join(EXPORT_CONFIG.outputDir, 'index_generale.json');
  
  let generalIndex = { exports: [] };
  
  try {
    const existingData = await fs.readFile(generalIndexPath, 'utf8');
    generalIndex = JSON.parse(existingData);
  } catch (error) {
    // File non esiste, crea nuovo
  }
  
  // Aggiungi nuovo export
  generalIndex.exports.push(monthIndex);
  
  // Mantieni solo ultimi 12 mesi
  generalIndex.exports = generalIndex.exports
    .sort((a, b) => new Date(b.exportDate) - new Date(a.exportDate))
    .slice(0, 12);
  
  await fs.writeFile(generalIndexPath, JSON.stringify(generalIndex, null, 2));
  console.log(`📋 Indice generale aggiornato: ${generalIndexPath}`);
}

/**
 * Elimina i dati esportati dal database
 */
async function deleteExportedData(tableName, whereClause) {
  console.log(`🗑️ Eliminazione dati esportati da ${tableName}...`);
  
  const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
  const result = await pool.query(query);
  
  console.log(`   ✅ Eliminati ${result.rowCount.toLocaleString()} record da ${tableName}`);
  return result.rowCount;
}

/**
 * Funzione principale di export
 */
async function exportToHardDisk(options = {}) {
  const {
    deleteAfterExport = false,
    tables = Object.keys(EXPORT_TABLES),
    dryRun = false
  } = options;
  
  console.log('💾 Avvio export su hard disk esterno...\n');
  
  if (dryRun) {
    console.log('🧪 MODALITÀ DRY RUN - Nessun file verrà creato\n');
  }
  
  try {
    // Crea struttura directory
    const { baseDir, monthDir } = await createDirectoryStructure();
    console.log(`📁 Directory di destinazione: ${monthDir}\n`);
    
    const exports = {};
    let totalExported = 0;
    let totalFiles = 0;
    
    // Esporta ogni tabella
    for (const tableName of tables) {
      const config = EXPORT_TABLES[tableName];
      
      if (!config || !config.enabled) {
        console.log(`⏭️ Tabella ${tableName} disabilitata, salto...`);
        continue;
      }
      
      // Verifica se la tabella esiste
      const tableExists = await checkTableExists(tableName);
      if (!tableExists) {
        console.log(`⚠️ Tabella ${tableName} non esiste, salto...`);
        continue;
      }
      
      if (dryRun) {
        const count = await countRecordsToExport(tableName, config.whereClause);
        console.log(`📊 ${tableName}: ${count.toLocaleString()} record da esportare`);
        exports[tableName] = { exported: count, files: [] };
        totalExported += count;
        continue;
      }
      
      // Esporta tabella
      const result = await exportTableToCSV(tableName, config, monthDir);
      exports[tableName] = result;
      totalExported += result.exported;
      totalFiles += result.files.length;
      
      // Elimina dati se richiesto
      if (deleteAfterExport && result.exported > 0) {
        await deleteExportedData(tableName, config.whereClause);
      }
      
      console.log(''); // Riga vuota per separare le tabelle
    }
    
    if (dryRun) {
      console.log(`\n🧪 DRY RUN COMPLETATO:`);
      console.log(`   Tabelle: ${Object.keys(exports).length}`);
      console.log(`   Record totali: ${totalExported.toLocaleString()}`);
      return { exports, totalExported, totalFiles: 0 };
    }
    
    // Crea indice
    const monthIndex = await createIndex(monthDir, exports);
    await updateGeneralIndex(baseDir, monthIndex);
    
    console.log(`\n✅ EXPORT COMPLETATO:`);
    console.log(`   Directory: ${monthDir}`);
    console.log(`   Tabelle: ${Object.keys(exports).length}`);
    console.log(`   Record esportati: ${totalExported.toLocaleString()}`);
    console.log(`   File creati: ${totalFiles}`);
    console.log(`   Compressione: ${EXPORT_CONFIG.compression.enabled ? 'Abilitata' : 'Disabilitata'}`);
    
    return { exports, totalExported, totalFiles, monthDir };
    
  } catch (error) {
    console.error('❌ Errore durante export:', error);
    throw error;
  }
}

/**
 * Lista i file esportati
 */
async function listExportedFiles() {
  console.log('📋 File esportati disponibili:\n');
  
  try {
    const generalIndexPath = path.join(EXPORT_CONFIG.outputDir, 'index_generale.json');
    const data = await fs.readFile(generalIndexPath, 'utf8');
    const index = JSON.parse(data);
    
    for (const exportData of index.exports) {
      const date = new Date(exportData.exportDate).toLocaleDateString('it-IT');
      console.log(`📅 Export del ${date}:`);
      console.log(`   Record: ${exportData.totalRecords.toLocaleString()}`);
      console.log(`   File: ${exportData.totalFiles}`);
      console.log(`   Tabelle: ${exportData.totalTables}`);
      console.log('');
    }
    
  } catch (error) {
    console.log('⚠️ Nessun file esportato trovato');
  }
}

/**
 * Funzione per eseguire export
 */
async function runExport() {
  try {
    const command = process.argv[2];
    const options = {};
    
    switch (command) {
      case 'export':
        options.deleteAfterExport = process.argv.includes('--delete');
        options.dryRun = process.argv.includes('--dry-run');
        await exportToHardDisk(options);
        break;
        
      case 'list':
        await listExportedFiles();
        break;
        
      case 'dry-run':
        await exportToHardDisk({ dryRun: true });
        break;
        
      default:
        console.log('Uso: node hard-disk-export.js [export|list|dry-run] [--delete] [--dry-run]');
        console.log('  export     - Esporta dati su hard disk');
        console.log('  list       - Lista file esportati');
        console.log('  dry-run    - Simula export senza creare file');
        console.log('  --delete   - Elimina dati dal database dopo export');
        console.log('  --dry-run  - Modalità test (solo conteggi)');
    }
    
  } catch (error) {
    console.error('💥 Errore:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  runExport();
}

module.exports = {
  exportToHardDisk,
  listExportedFiles,
  EXPORT_CONFIG,
  EXPORT_TABLES
};
