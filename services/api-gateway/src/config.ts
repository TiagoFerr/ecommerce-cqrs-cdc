import 'dotenv/config';

export interface GatewayConfig {
  port: number;
  writeServiceUrl: string;
  readServiceUrl: string;
}

export const config: GatewayConfig = {
  port: Number(process.env.PORT) || 3000,
  writeServiceUrl: process.env.WRITE_SERVICE_URL || 'http://localhost:3001',
  readServiceUrl: process.env.READ_SERVICE_URL || 'http://localhost:3002',
};
