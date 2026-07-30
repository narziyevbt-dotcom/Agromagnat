import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

loadEnv({ path: '.env.local' });
loadEnv();

const isCompiled = __filename.endsWith('.js');
const ext = isCompiled ? 'js' : 'ts';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'agromagnat',
  password: process.env.DB_PASSWORD ?? 'agromagnat',
  database: process.env.DB_NAME ?? 'agromagnat',
  entities: [__dirname + `/../**/*.entity.${ext}`],
  migrations: [__dirname + `/migrations/*.${ext}`],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

/** Used by the TypeORM CLI for migrations and by the seed runner. */
export default new DataSource(dataSourceOptions);
