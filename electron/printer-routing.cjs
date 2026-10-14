const { execFile } = require('node:child_process');

function normalizePrinterNames(names, legacy = '') {
  if (names === undefined) return legacy ? [legacy] : [];
  if (!Array.isArray(names) || names.length > 20 || names.some(name => typeof name !== 'string' || !name.trim() || name.length > 256)) {
    throw new Error('Select valid photo printers in F2 settings.');
  }
  return [...new Set(names)];
}

async function readWindowsStatus() {
  if (process.platform !== 'win32') return [];
  // Static command: printer names never become executable PowerShell text.
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$jobs = @(Get-CimInstance Win32_PrintJob)
$printers = @(Get-CimInstance Win32_Printer | ForEach-Object {
  $printer = $_
  $count = @($jobs | Where-Object {
    $separator = $_.Name.LastIndexOf(',')
    $separator -gt 0 -and $_.Name.Substring(0, $separator).TrimEnd() -eq $printer.Name -and $_.JobStatus -notmatch 'Printed|Completed'
  }).Count
  [PSCustomObject]@{ name = $printer.Name; offline = [bool]$printer.WorkOffline; status = [int]$printer.PrinterStatus; extendedStatus = [int]$printer.ExtendedPrinterStatus; error = [int]$printer.DetectedErrorState; jobs = $count }
})
ConvertTo-Json -InputObject $printers -Compress
`;
  return new Promise(resolve => {
    execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
        if (error) return resolve([]);
        try { const data = JSON.parse(stdout.replace(/^\uFEFF/, '')); resolve(Array.isArray(data) ? data : []); }
        catch { resolve([]); }
      });
  });
}

function printerState(info) {
  if (!info) return 'unknown';
  if (info.offline || info.status === 7 || info.extendedStatus === 7 || info.error === 9) return 'offline';
  if ([4, 6, 7, 8, 10, 11].includes(info.error) || info.status === 6 || [6, 8, 9, 11, 16, 18].includes(info.extendedStatus)) return 'error';
  if (info.jobs > 0 || [4, 5].includes(info.status) || [4, 5, 10, 12, 13, 14, 17].includes(info.extendedStatus)) return 'busy';
  return info.status === 3 || info.extendedStatus === 3 ? 'ready' : 'unknown';
}

async function listPrinters(webContents) {
  const [printers, statuses] = await Promise.all([webContents.getPrintersAsync(), module.exports.readWindowsStatus()]);
  const byName = new Map(statuses.map(info => [info.name, info]));
  return printers.map(printer => ({ name: printer.name, displayName: printer.displayName || printer.name,
    state: printerState(byName.get(printer.name)), jobs: byName.get(printer.name)?.jobs ?? null }));
}

function choosePrinter(names, printers) {
  if (!names.length) throw new Error('Select photo printers in F2 settings.');
  const candidates = names.map(name => printers.find(printer => printer.name === name))
    .filter(printer => printer && !['offline', 'error'].includes(printer.state));
  if (!candidates.length) throw new Error('Selected photo printers are disconnected, offline or need attention. Check them and retry.');
  const ready = candidates.find(printer => printer.state === 'ready');
  return { printer: ready || candidates[0], reason: ready ? 'ready' : candidates.every(printer => printer.state === 'busy') ? 'all-busy' : 'status-unknown' };
}

module.exports = { normalizePrinterNames, readWindowsStatus, printerState, listPrinters, choosePrinter };
