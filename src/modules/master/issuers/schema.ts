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
    unique: [['code'], ['name']],
    uniqueIfExists: [[]],
    indexes: [],
    schema: {
      bsonType: 'object',
      required: ['code', 'name'],
      // additionalProperties: false,
      properties: {
        _id: {
          bsonType: 'objectId',
          description: 'Unique ID for the document.',
        },
        code: {
          bsonType: 'string',
          description: 'The code of the issuer entity.',
        },
        name: {
          bsonType: 'string',
          description: 'The name of the issuer entity.',
        },
        notes: {
          bsonType: 'string',
          description: 'Additional notes or information about the issuer entity.',
        },
        is_archived: {
          bsonType: 'bool',
          description: 'Indicates whether the record is archived.',
        },
        created_by_id: {
          bsonType: 'objectId',
          description: 'The ID of the user who created this record.',
        },
        created_at: {
          bsonType: 'date',
          description: 'Timestamp indicating when created this record.',
        },
        updated_by_id: {
          bsonType: 'objectId',
          description: 'The ID of the user who updated this record.',
        },
        updated_at: {
          bsonType: 'date',
          description: 'Timestamp indicating when updated this record.',
        },
        archived_by_id: {
          bsonType: 'objectId',
          description: 'The ID of the user who archived this record.',
        },
        archived_at: {
          bsonType: 'date',
          description: 'Timestamp indicating when archived this record.',
        },
      },
    },
  },
];
