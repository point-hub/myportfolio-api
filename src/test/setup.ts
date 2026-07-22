import { DatabaseTestUtil } from '@point-hub/papi';
import { afterAll, beforeAll } from 'bun:test';

import mongoDBConfig from '@/config/mongodb';

import { TestUtil } from './utils';

const databaseName = mongoDBConfig.name.includes('_test_db')
  ? mongoDBConfig.name
  : `${mongoDBConfig.name}_test`;

beforeAll(async () => {
  console.info(`initiate database connection ${databaseName}`);
  await DatabaseTestUtil.open(mongoDBConfig.url, databaseName);
  console.info(`drop database ${databaseName}`);
  await DatabaseTestUtil.dbConnection.dropDatabase();
  console.info('generate database collection schema');
  await DatabaseTestUtil.createCollections(await TestUtil.getSchema());
}, 10_000);

afterAll(async () => {
  console.info('close database connection');
  await DatabaseTestUtil.close();
});
