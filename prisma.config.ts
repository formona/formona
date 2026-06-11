import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl = (
  process.env.PRISMA_DATABASE_URL
  ?? process.env.POSTGRES_URL
  ?? 'postgresql://formona:formona@localhost:5432/formona'
);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
