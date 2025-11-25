import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { DMLResult } from "../types/salesforce";

export const DML_RECORDS: Tool = {
  name: "salesforce_dml_records",
  description: `Perform data manipulation operations on Salesforce records:
  - insert: Create new records
  - update: Modify existing records (requires Id)
  - delete: Remove records (requires Id)
  - upsert: Insert or update based on external ID field
  Examples: Insert new Accounts, Update Case status, Delete old records, Upsert based on custom external ID`,
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["insert", "update", "delete", "upsert"],
        description: "Type of DML operation to perform"
      },
      objectName: {
        type: "string",
        description: "API name of the object"
      },
      records: {
        type: "array",
        items: { type: "object" },
        description: "Array of records to process"
      },
      externalIdField: {
        type: "string",
        description: "External ID field name for upsert operations",
        optional: true
      }
    },
    required: ["operation", "objectName", "records"]
  }
};

export interface DMLArgs {
  operation: 'insert' | 'update' | 'delete' | 'upsert';
  objectName: string;
  records: Record<string, any>[];
  externalIdField?: string;
}

export async function handleDMLRecords(conn: any, args: DMLArgs) {
  const { operation, objectName, records, externalIdField } = args;

  let result: DMLResult | DMLResult[];

  switch (operation) {
    case 'insert':
      result = await conn.sobject(objectName).create(records);
      break;
    case 'update':
      result = await conn.sobject(objectName).update(records);
      break;
    case 'delete':
      result = await conn.sobject(objectName).destroy(records.map(r => r.Id));
      break;
    case 'upsert':
      if (!externalIdField) {
        throw new Error('externalIdField is required for upsert operations');
      }
      result = await conn.sobject(objectName).upsert(records, externalIdField);
      break;
    default:
      throw new Error(`Unsupported operation: ${operation}`);
  }

  // Format DML results
  const results = Array.isArray(result) ? result : [result];

  return {
    content: [{
      type: "text",
      text: JSON.stringify(results, null, 2)
    }],
    isError: false,
  };
}