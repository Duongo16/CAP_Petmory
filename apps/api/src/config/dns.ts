import * as dns from 'dns';
import * as fs from 'fs';
import { parseEnv } from 'util';
import { Logger } from '@nestjs/common';

/** May chu DNS du phong khi Node tren Windows chi nhan duoc dia chi loopback. */
const DNS_FALLBACK = ['8.8.8.8', '1.1.1.1'];

/** Cung thu tu tep .env nhu ConfigModule trong app.module. */
const ENV_FILES = ['../../.env', '.env'];

/**
 * Ham nay chay truoc khi ConfigModule nap .env, nen tu doc DNS_SERVERS:
 * uu tien bien moi truong, sau do toi cac tep .env.
 */
function readDnsSetting(): string {
  if (process.env.DNS_SERVERS) {
    return process.env.DNS_SERVERS;
  }
  for (const file of ENV_FILES) {
    if (!fs.existsSync(file)) {
      continue;
    }
    const value = parseEnv(fs.readFileSync(file, 'utf8')).DNS_SERVERS;
    if (value) {
      return value;
    }
  }
  return '';
}

/** dns.promises co bo phan giai rieng, driver MongoDB tra ban ghi SRV qua bo nay. */
function setServers(servers: string[]): void {
  dns.setServers(servers);
  dns.promises.setServers(servers);
}

/**
 * Sua loi `querySrv ECONNREFUSED` khi noi toi MongoDB Atlas bang `mongodb+srv://`.
 *
 * Tren mot so may Windows, Node khong truy van duoc ban ghi SRV qua may chu DNS
 * he thong dua cho no. Dat DNS_SERVERS (cach nhau dau phay) de chi dinh may chu;
 * de trong thi chi tu doi tren Windows khi gap dia chi loopback.
 */
export function useWorkingDns(): void {
  const custom = readDnsSetting()
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);
  if (custom.length > 0) {
    setServers(custom);
    Logger.log(`Dung DNS ${custom.join(', ')} theo DNS_SERVERS`, 'Dns');
    return;
  }

  const current = dns.getServers();
  const loopbackOnly = current.every((server) => server.startsWith('127.') || server === '::1');
  if (process.platform === 'win32' && loopbackOnly) {
    setServers(DNS_FALLBACK);
    Logger.warn(`DNS loopback (${current.join(', ')}), chuyen sang ${DNS_FALLBACK.join(', ')}`, 'Dns');
  }
}
