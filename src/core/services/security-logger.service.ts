import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger(SecurityLoggerService.name);
  private readonly logDir = 'logs';
  private readonly securityLogPath: string;

  constructor() {
    // 确保日志目录存在
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir);
    }
    this.securityLogPath = path.join(this.logDir, 'security.log');
  }

  private async writeLog(message: string) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      await fs.promises.appendFile(this.securityLogPath, logEntry);
    } catch (error) {
      this.logger.error(`Failed to write security log: ${error.message}`);
    }
  }

  async logAuthAttempt(ip: string, success: boolean, details?: string) {
    const message = `Authentication attempt from ${ip}: ${success ? 'SUCCESS' : 'FAILURE'}${details ? ` - ${details}` : ''}`;
    await this.writeLog(message);
  }

  async logUnauthorizedAccess(ip: string, resource: string, details?: string) {
    const message = `Unauthorized access attempt from ${ip} to ${resource}${details ? ` - ${details}` : ''}`;
    await this.writeLog(message);
  }

  async logSecurityEvent(eventType: string, details: string) {
    const message = `Security event - ${eventType}: ${details}`;
    await this.writeLog(message);
  }

  async logSuspiciousActivity(ip: string, activity: string, details?: string) {
    const message = `Suspicious activity detected from ${ip}: ${activity}${details ? ` - ${details}` : ''}`;
    await this.writeLog(message);
  }

  async getRecentLogs(hours: number = 24): Promise<string[]> {
    try {
      const content = await fs.promises.readFile(this.securityLogPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const now = new Date();
      const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

      return lines.filter(line => {
        const timestamp = new Date(line.slice(1, 25));
        return timestamp >= cutoff;
      });
    } catch (error) {
      this.logger.error(`Failed to read security logs: ${error.message}`);
      return [];
    }
  }
} 