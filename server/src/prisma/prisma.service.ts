import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function buildConnectionString(): string {
  // tiro su i dati del databse
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // carico le variabili dall'env, con default
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  const user = process.env.DB_USER ?? 'user';
  const password = process.env.DB_PASSWORD ?? 'password';
  const name = process.env.DB_NAME ?? 'mydb';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // costruttore con config adapter
  constructor() {
    const adapter = new PrismaPg({ connectionString: buildConnectionString() });
    super({ adapter });
  }

  // per connessione
  async onModuleInit() {
    await this.$connect();
  }

  // disc alla morte
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
