import { faker } from '@faker-js/faker';
import { BaseFactory, type IDatabase } from '@point-hub/papi';

import { type IBank } from './interface';
import { CreateRepository } from './repositories/create.repository';
import { CreateManyRepository } from './repositories/create-many.repository';

export default class BankFactory extends BaseFactory<IBank> {
  constructor(public dbConnection: IDatabase, public options?: Record<string, unknown>) {
    super();
  }

  definition() {
    return {
      code: 'BANK/' + faker.number.int({ min: 1, max: 99999 }).toString().padStart(5, '0'),
      name: faker.person.fullName(),
      branch: faker.person.fullName(),
      address: faker.person.fullName(),
      phone: faker.person.fullName(),
      account_number: faker.person.fullName(),
      account_name: faker.person.fullName(),
      notes: faker.lorem.words(),
      is_archived: false,
      created_at: new Date(),
      created_by_id: undefined, // injected
    } as IBank;
  }

  async create() {
    const createRepository = new CreateRepository(this.dbConnection, this.options);
    return await createRepository.handle(this.makeOne());
  }

  async createMany(count: number) {
    const createManyRepository = new CreateManyRepository(this.dbConnection, this.options);
    return await createManyRepository.handle(this.makeMany(count));
  }
}
