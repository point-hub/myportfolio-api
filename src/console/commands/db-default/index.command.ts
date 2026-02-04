import { BaseConsoleCommand, BaseDatabaseConnection, BaseMongoDBConnection } from '@point-hub/papi';

import mongoDBConfig from '@/config/mongodb';

export default class DbSeedCommand extends BaseConsoleCommand {
  dbConnection = new BaseDatabaseConnection(new BaseMongoDBConnection(mongoDBConfig.url, mongoDBConfig.name));

  constructor() {
    super({
      name: 'db:default',
      description: 'Populate database with default entries',
      summary: 'Populate database with default entries',
      arguments: [],
      options: [],
    });
  }

  async handle(): Promise<void> {
    let session;
    try {
      await this.dbConnection.open();
      session = this.dbConnection.startSession();
      session.startTransaction();
      if (mongoDBConfig.name.includes('_dev_db')) {
        // Reset database
        await this.reset({ session });
        // Seed required default data
        await this.seeds('default', { session });
      }
      await session?.commitTransaction();
    } catch (error) {
      console.error(error);
      await session?.abortTransaction();
    } finally {
      await session?.endSession();
      this.dbConnection.close();
    }
  }

  private async reset(options: Record<string, unknown>) {
    await this.resetCollection('counters', options);
    await this.resetCollection('audit_logs', options);
    await this.resetCollection('permissions', options);
    await this.resetCollection('roles', options);
    await this.resetCollection('users', options);
    await this.resetCollection('owners', options);
    await this.resetCollection('banks', options);
    await this.resetCollection('brokers', options);
    await this.resetCollection('issuers', options);
    await this.resetCollection('deposits', options);
    await this.resetCollection('savings', options);
    await this.resetCollection('insurances', options);
    await this.resetCollection('bonds', options);
    await this.resetCollection('stocks', options);
  }

  private async resetCollection(name: string, options: Record<string, unknown>) {
    console.info(`[truncate] ${name}`);
    await this.dbConnection.collection(name).deleteAll(options);
  }

  private async seeds(name: string, options: Record<string, unknown>): Promise<void> {
    const { seed } = await import(`@/modules/_shared/seeds/${name}.seed`);
    await seed(this.dbConnection, options);
  }
}
