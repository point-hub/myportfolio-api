/**
 * MongoDB Schema
 *
 * https://www.mongodb.com/docs/current/core/schema-validation/update-schema-validation/
 * https://www.mongodb.com/docs/drivers/node/current/fundamentals/indexes/
 * https://www.mongodb.com/developer/products/mongodb/mongodb-schema-design-best-practices/
 */

import type { ISchema } from '@point-hub/papi';

import { collectionName } from './entity';

export const schema: ISchema[] = [
  {
    collection: collectionName,
    unique: [['code'], ['name'], ['account_number'], ['account_name']],
    uniqueIfExists: [[]],
    indexes: [],
    schema: {
      bsonType: 'object',
      required: ['code', 'name', 'account_number', 'account_name'],
      // additionalProperties: false,
      properties: {
        _id: {
          bsonType: 'objectId',
          description: 'Unique ID for the document.',
        },
        code: {
          bsonType: 'string',
          description: 'The code of the bank entity.',
        },
        name: {
          bsonType: 'string',
          description: 'The name of the bank entity.',
        },
        branch: {
          bsonType: 'string',
          description: 'The branch of the bank entity.',
        },
        address: {
          bsonType: 'string',
          description: 'The address of the bank entity.',
        },
        phone: {
          bsonType: 'string',
          description: 'The phone of the bank entity.',
        },
        account_number: {
          bsonType: 'string',
          description: 'The account_number of the bank entity.',
        },
        account_name: {
          bsonType: 'string',
          description: 'The account_name of the bank entity.',
        },
        notes: {
          bsonType: 'string',
          description: 'Additional notes or information about the bank entity.',
        },
        is_archived: {
          bsonType: 'bool',
          description: 'Indicates whether the record is archived.',
        },
        created_at: {
          bsonType: 'date',
          description: 'Timestamp indicating when this record was created.',
        },
        created_by_id: {
          bsonType: 'objectId',
          description: 'The ID of the user who created this record.',
        },
      },
    },
  },
];
