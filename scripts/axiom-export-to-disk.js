const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
require('dotenv').config();

// Axiom SDK
let Axiom;
let axiom;
try {
  Axiom = require('@axiomhq/axiom-node');
  if (process.env.AXIOM_ENABLED === 'true' && process.env.AXIOM_API_TOKEN && process.env.AXIOM_ORG_ID) {
    axiom = new Axiom({
      token: process.env.AXIOM_API_TOKEN,
      orgId: process.env.AXIOM_ORG_ID,
      region: process.env.AXIOM_REGION || 'eu'
    });
  }
} catch (error) {
  console.error('❌ Axiom SDK non installato:', error.message);
  process.exit(1);
}

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
  
  // Batch size per query Axiom
  batchSize: 10000
};

// Dataset da esportare con configurazioni
const EXPORT_DATASETS = {
  centralized_logs: {
    enabled: true,
    retentionDays: 30,
    dataset: process.env.AXIOM_DATASET || 'centralized_logs'
  },
  audit_logs: {
    enabled: true,
    retentionDays: 30,
    dataset: process.env.AXIOM_AUDIT_DATASET || 'audit_logs'
  },
  performance_metrics: {
    enabled: false, // Abilita quando crei il dataset
    retentionDays: 7,
    dataset: 'performance_metrics'
  },
  security_events: {
    enabled: false, // Abilita quando crei il dataset
    retentionDays: 30,
    dataset: 'security_events'
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
  
  const baseDir = path.join(EXPORT_CONFIG.outputDir, 'axiom', year.toString());
  const monthDir = path.join(baseDir, `${month}-${monthName}`);
  
  // Crea directory se non esistono
  await fs.mkdir(baseDir, { recursive: true });
  await fs.mkdir(monthDir, { recursive: true });
  
  return { baseDir, monthDir };
}

/**
 * Query Axiom per ottenere log
 */
async function queryAxiomDataset(datasetName, startDate, endDate, limit = 10000, offset = 0) {
  try {
    // Query AQL per ottenere log in un range di date
    const query = `
      ['${datasetName}']
      | where _time >= timestamp('${startDate.toISOString()}')
      | where _time <= timestamp('${endDate.toISOString()}')
      | order by _time asc
      | limit ${limit} offset ${offset}
    `;
    
    console.log(`   🔍 Query Axiom: ${limit} record da ${startDate.toISOString()} a ${endDate.toISOString()}`);
    
    const result = await axiom.query(query, {
      startTime: startDate,
      endTime: endDate
    });
    
    return result.matches || [];
  } catch (error) {
    console.error(`   ❌ Errore query Axiom per ${datasetName}:`, error.message);
    return [];
  }
}

/**
 * Conta i record in Axiom per un periodo
 */
async function countAxiomRecords(datasetName, startDate, endDate) {
  try {
    const query = `
      ['${datasetName}']
      | where _time >= timestamp('${startDate.toISOString()}')
      | where _time <= timestamp('${endDate.toISOString()}')
      | summarize count()
    `;
    
    const result = await axiom.query(query, {
      startTime: startDate,
      endTime: endDate
    });
    
    return result.matches?.[0]?.count || 0;
  } catch (error) {
    console.error(`   ❌ Errore conteggio Axiom per ${datasetName}:`, error.message);
    return 0;
  }
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
      
      // Gestisci oggetti/array (converti in JSON string)
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      
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
 * Esporta un dataset da Axiom
 */
async function exportAxiomDataset(datasetName, config, outputPath) {
  console.log(`📊 Esportazione ${datasetName} da Axiom...`);
  
  // Calcola range date (ultimi N giorni)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - config.retentionDays);
  
  // Conta record totali
  const totalRecords = await countAxiomRecords(datasetName, startDate, endDate);
  console.log(`   Record da esportare: ${totalRecords.toLocaleString()}`);
  
  if (totalRecords === 0) {
    console.log(`   ✅ Nessun record da esportare per ${datasetName}`);
    return { exported: 0, files: [] };
  }
  
  const files = [];
  let exported = 0;
  let fileIndex = 1;
  let offset = 0;
  
  // Esporta in batch
  while (exported < totalRecords) {
    const limit = Math.min(EXPORT_CONFIG.batchSize, totalRecords - exported);
    
    // Query Axiom
    const records = await queryAxiomDataset(datasetName, startDate, endDate, limit, offset);
    
    if (records.length === 0) break;
    
    // Crea nome file
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${datasetName}_${timestamp}_part${fileIndex}.csv`;
    const filepath = path.join(outputPath, filename);
    
    // Converte in CSV
    const csvContent = await convertToCSV(records);
    
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
      records: records.length
    });
    
    exported += records.length;
    offset += records.length;
    fileIndex++;
    
    console.log(`   📁 File ${fileIndex - 1}: ${finalFilename} (${records.length} record)`);
    
    // Pausa per evitare rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`   ✅ Esportazione completata: ${exported.toLocaleString()} record in ${files.length} file`);
  
  return { exported, files };
}

/**
 * Crea indice dei file esportati
 */
async function createIndex(monthDir, exports) {
  const indexData = {
    exportDate: new Date().toISOString(),
    source: 'axiom',
    totalDatasets: Object.keys(exports).length,
    totalRecords: Object.values(exports).reduce((sum, exp) => sum + exp.exported, 0),
    totalFiles: Object.values(exports).reduce((sum, exp) => sum + exp.files.length, 0),
    datasets: exports
  };
  
  const indexPath = path.join(monthDir, 'index.json');
  await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
  
  console.log(`📋 Indice creato: ${indexPath}`);
  return indexData;
}

/**
 * Funzione principale di export da Axiom
 */
async function exportAxiomToHardDisk(options = {}) {
  const {
    datasets = Object.keys(EXPORT_DATASETS),
    dryRun = false
  } = options;
  
  if (!axiom) {
    console.error('❌ Axiom non configurato. Verifica AXIOM_ENABLED, AXIOM_API_TOKEN e AXIOM_ORG_ID');
    process.exit(1);
  }
  
  console.log('💾 Avvio export da Axiom su hard disk esterno...\n');
  
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
    
    // Esporta ogni dataset
    for (const datasetKey of datasets) {
      const config = EXPORT_DATASETS[datasetKey];
      
      if (!config || !config.enabled) {
        console.log(`⏭️ Dataset ${datasetKey} disabilitato, salto...`);
        continue;
      }
      
      const datasetName = config.dataset;
      
      if (dryRun) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - config.retentionDays);
        const count = await countAxiomRecords(datasetName, startDate, endDate);
        console.log(`📊 ${datasetKey}: ${count.toLocaleString()} record da esportare`);
        exports[datasetKey] = { exported: count, files: [] };
        totalExported += count;
        continue;
      }
      
      // Esporta dataset
      const result = await exportAxiomDataset(datasetName, config, monthDir);
      exports[datasetKey] = result;
      totalExported += result.exported;
      totalFiles += result.files.length;
      
      console.log(''); // Riga vuota per separare i dataset
    }
    
    if (dryRun) {
      console.log(`\n🧪 DRY RUN COMPLETATO:`);
      console.log(`   Dataset: ${Object.keys(exports).length}`);
      console.log(`   Record totali: ${totalExported.toLocaleString()}`);
      return { exports, totalExported, totalFiles: 0 };
    }
    
    // Crea indice
    const monthIndex = await createIndex(monthDir, exports);
    
    console.log(`\n✅ EXPORT COMPLETATO:`);
    console.log(`   Directory: ${monthDir}`);
    console.log(`   Dataset: ${Object.keys(exports).length}`);
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
 * Funzione per eseguire export
 */
async function runExport() {
  try {
    const command = process.argv[2];
    const options = {};
    
    switch (command) {
      case 'export':
        options.dryRun = process.argv.includes('--dry-run');
        const datasets = process.argv.includes('--datasets') 
          ? process.argv[process.argv.indexOf('--datasets') + 1].split(',')
          : Object.keys(EXPORT_DATASETS);
        options.datasets = datasets;
        await exportAxiomToHardDisk(options);
        break;
        
      case 'dry-run':
        await exportAxiomToHardDisk({ dryRun: true });
        break;
        
      default:
        console.log('Uso: node axiom-export-to-disk.js [export|dry-run] [--dry-run] [--datasets=dataset1,dataset2]');
        console.log('  export          - Esporta dati da Axiom su hard disk');
        console.log('  dry-run          - Simula export senza creare file');
        console.log('  --dry-run        - Modalità test (solo conteggi)');
        console.log('  --datasets=...   - Lista dataset da esportare (separati da virgola)');
        console.log('\nDataset disponibili:');
        Object.keys(EXPORT_DATASETS).forEach(key => {
          const config = EXPORT_DATASETS[key];
          console.log(`  - ${key} (${config.enabled ? 'abilitato' : 'disabilitato'}) -> ${config.dataset}`);
        });
    }
    
  } catch (error) {
    console.error('💥 Errore:', error);
    process.exit(1);
  }
}

// Esegui se chiamato direttamente
if (require.main === module) {
  runExport();
}

module.exports = {
  exportAxiomToHardDisk,
  EXPORT_CONFIG,
  EXPORT_DATASETS
};

