
import type { TestType } from '@util';
import fs from 'node:fs/promises';

interface TestResults {
  succeeded: number;
  failed: number;
  error?: 'name';
  failed_tests?: TestType[];
}

interface TestEntry {
  key: string;
  results: TestResults;
}

type Status = 'pass' | 'fail' | 'not-implemented' | 'not-tested';

interface FunctionRow {
  name: string;
  category: string;
  status: Status;
  passed: number;
  total: number;
  failed_tests?: TestType[];
}

export async function RunReport() {

  const resultsRaw = await fs.readFile('test-results.json', 'utf-8');
  const results: TestEntry[] = JSON.parse(resultsRaw);

  const csvRaw = await fs.readFile('data/excel_functions.csv', 'utf-8');
  const csvLines = csvRaw.trim().split('\n').slice(1);

  const csvFunctions: { name: string; category: string }[] = [];
  for (const line of csvLines) {
    const [name, category] = line.split(',');
    if (name && category) {
      csvFunctions.push({ name: name.trim(), category: category.trim() });
    }
  }

  const resultMap = new Map<string, TestEntry>();
  for (const entry of results) {
    resultMap.set(entry.key, entry);
  }

  const rows: FunctionRow[] = [];

  for (const fn of csvFunctions) {
    const entry = resultMap.get(fn.name);
    if (!entry) {
      rows.push({ name: fn.name, category: fn.category, status: 'not-tested', passed: 0, total: 0 });
      continue;
    }

    const { succeeded, failed, error, failed_tests } = entry.results;
    const total = succeeded + failed;

    let status: Status;
    if (error === 'name') {
      status = 'not-implemented';
    } else if (failed > 0) {
      status = 'fail';
    } else {
      status = 'pass';
    }

    rows.push({ name: fn.name, category: fn.category, status, passed: succeeded, total, failed_tests });
  }

  const categories = [...new Set(csvFunctions.map(f => f.category))];

  const counts = { pass: 0, fail: 0, 'not-implemented': 0, 'not-tested': 0 };
  for (const row of rows) counts[row.status]++;
  const totalFunctions = rows.length;

  function pct(n: number) {
    return ((n / totalFunctions) * 100).toFixed(1);
  }

  function esc(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const statusLabel: Record<Status, string> = {
    'pass': 'Pass',
    'fail': 'Fail',
    'not-implemented': 'Not Implemented',
    'not-tested': 'Not Tested',
  };

  const statusColor: Record<Status, string> = {
    'pass': '#22c55e',
    'fail': '#ef4444',
    'not-implemented': '#9ca3af',
    'not-tested': '#d1d5db',
  };

  let html = `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TREB Function Coverage Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f9fafb; color: #111827; padding: 24px; max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 16px; }
    .summary { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .summary-card { padding: 12px 20px; border-radius: 8px; color: #fff; font-weight: 600; font-size: 14px; }
    .summary-card .num { font-size: 28px; display: block; }
    .summary-card.pass { background: #22c55e; }
    .summary-card.fail { background: #ef4444; }
    .summary-card.not-implemented { background: #6b7280; }
    .summary-card.not-tested { background: #9ca3af; }
    .bar { height: 12px; display: flex; border-radius: 6px; overflow: hidden; margin-bottom: 24px; }
    .bar div { height: 100%; }
    .category { margin-bottom: 24px; }
    .category h2 { font-size: 18px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #e5e7eb; }
    .category h2 .cat-stats { font-size: 13px; font-weight: 400; color: #6b7280; margin-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 6px 10px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; font-weight: 600; }
    td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; }
    tr:hover td { background: #f9fafb; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; color: #fff; }
    .badge.pass { background: #22c55e; }
    .badge.fail { background: #ef4444; }
    .badge.not-implemented { background: #6b7280; }
    .badge.not-tested { background: #d1d5db; color: #6b7280; }
    .failed-expr { font-family: monospace; font-size: 12px; color: #991b1b; }
    .timestamp { font-size: 12px; color: #9ca3af; margin-bottom: 16px; }
  </style>
  </head>
  <body>
  <h1>TREB Function Coverage Report</h1>
  <div class="timestamp">Generated ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</div>
  <div class="summary">
    <div class="summary-card pass"><span class="num">${counts.pass}</span>Pass (${pct(counts.pass)}%)</div>
    <div class="summary-card fail"><span class="num">${counts.fail}</span>Fail (${pct(counts.fail)}%)</div>
    <div class="summary-card not-implemented"><span class="num">${counts['not-implemented']}</span>Not Implemented (${pct(counts['not-implemented'])}%)</div>
    <div class="summary-card not-tested"><span class="num">${counts['not-tested']}</span>Not Tested (${pct(counts['not-tested'])}%)</div>
  </div>
  <div class="bar">
    <div style="width:${pct(counts.pass)}%;background:${statusColor.pass}"></div>
    <div style="width:${pct(counts.fail)}%;background:${statusColor.fail}"></div>
    <div style="width:${pct(counts['not-implemented'])}%;background:${statusColor['not-implemented']}"></div>
    <div style="width:${pct(counts['not-tested'])}%;background:${statusColor['not-tested']}"></div>
  </div>
  `;

  for (const category of categories) {
    const catRows = rows.filter(r => r.category === category).sort((a, b) => a.name.localeCompare(b.name));
    const catPass = catRows.filter(r => r.status === 'pass').length;
    const catFail = catRows.filter(r => r.status === 'fail').length;
    const catNI = catRows.filter(r => r.status === 'not-implemented').length;

    html += `<div class="category">
  <h2>${esc(category)}<span class="cat-stats">${catRows.length} functions &mdash; ${catPass} pass, ${catFail} fail, ${catNI} not implemented, ${catRows.length - catPass - catFail - catNI} not tested</span></h2>
  <table>
  <tr><th>Function</th><th>Status</th><th>Tests</th><th>Failed Expressions</th></tr>
  `;

    for (const row of catRows) {
      const testsCol = row.status === 'not-tested' ? '&mdash;' : `${row.passed}/${row.total}`;
      const failedCol = row.failed_tests?.length
        ? row.failed_tests.map(t => `<span class="failed-expr">${esc(t.expression)}</span>`).join(', ')
        : '';

      html += `<tr>
    <td><strong>${esc(row.name)}</strong></td>
    <td><span class="badge ${row.status}">${statusLabel[row.status]}</span></td>
    <td>${testsCol}</td>
    <td>${failedCol}</td>
  </tr>\n`;
    }

    html += `</table></div>\n`;
  }

  html += `</body></html>`;

  await fs.writeFile('report.html', html, 'utf-8');
  console.info(`Report written to report.html (${totalFunctions} functions)`);

}

