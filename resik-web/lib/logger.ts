type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
}

function writeLog(entry: LogEntry) {
  if (typeof window === 'undefined') {
    console.log(JSON.stringify(entry));
  } else {
    const color = entry.level === 'error' ? '\x1b[31m' : entry.level === 'warn' ? '\x1b[33m' : '\x1b[36m';
    console.log(`${color}[${entry.level.toUpperCase()}]${'\x1b[0m'} ${entry.event}`, entry.data || '');
  }
}

export function logReportCreated(reportId: string, userId: string, weight: number) {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'report_created',
    data: { reportId, userId, weight },
  });
}

export function logReportSync(success: boolean, count: number, error?: string) {
  writeLog({
    timestamp: new Date().toISOString(),
    level: success ? 'info' : 'error',
    event: 'report_sync',
    data: { success, count, error },
  });
}

export function logPickupCompleted(pickupId: string, reportId: string, weight: number) {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'pickup_completed',
    data: { pickupId, reportId, weight },
  });
}

export function logError(event: string, error: unknown) {
  writeLog({
    timestamp: new Date().toISOString(),
    level: 'error',
    event,
    data: { error: String(error) },
  });
}
