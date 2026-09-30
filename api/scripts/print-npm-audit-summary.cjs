const { spawnSync } = require('child_process');

const result = spawnSync(process.execPath.replace(/node(?:\.exe)?$/i, 'npm'), ['audit', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32'
});

const raw = result.stdout || '';
try {
  const report = JSON.parse(raw);
  const counts = report.metadata?.vulnerabilities || {};
  console.log('[NPM_AUDIT_COUNTS]', JSON.stringify(counts));

  const rows = Object.entries(report.vulnerabilities || {}).map(([name, v]) => ({
    name,
    severity: v.severity,
    isDirect: Boolean(v.isDirect),
    range: v.range,
    effects: v.effects || [],
    fixAvailable: v.fixAvailable,
    via: (v.via || []).map((item) => {
      if (typeof item === 'string') return item;
      return {
        source: item.source,
        name: item.name,
        title: item.title,
        url: item.url,
        severity: item.severity,
        range: item.range
      };
    })
  }));

  for (const row of rows) {
    console.log('[NPM_AUDIT_VULN]', JSON.stringify(row));
  }
} catch (error) {
  console.log('[NPM_AUDIT_ERROR]', error.message);
  if (result.stderr) console.log('[NPM_AUDIT_STDERR]', result.stderr.slice(0, 4000));
}

process.exit(0);
