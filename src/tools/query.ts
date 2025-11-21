import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createUIResource } from "@mcp-ui/server";
import { recordsTableHtml, recordDetailCardHtml, RecordSection, UIRecord } from "./ui.js";

export const QUERY_RECORDS: Tool = {
  name: "salesforce_query_records",
  description: `Query records from any Salesforce object using SOQL, including relationship queries.

NOTE: For queries with GROUP BY, aggregate functions (COUNT, SUM, AVG, etc.), or HAVING clauses, use salesforce_aggregate_query instead.

Examples:
1. Parent-to-child query (e.g., Account with Contacts):
   - objectName: "Account"
   - fields: ["Name", "(SELECT Id, FirstName, LastName FROM Contacts)"]

2. Child-to-parent query (e.g., Contact with Account details):
   - objectName: "Contact"
   - fields: ["FirstName", "LastName", "Account.Name", "Account.Industry"]

3. Multiple level query (e.g., Contact -> Account -> Owner):
   - objectName: "Contact"
   - fields: ["Name", "Account.Name", "Account.Owner.Name"]

4. Related object filtering:
   - objectName: "Contact"
   - fields: ["Name", "Account.Name"]
   - whereClause: "Account.Industry = 'Technology'"

Note: When using relationship fields:
- Use dot notation for parent relationships (e.g., "Account.Name")
- Use subqueries in parentheses for child relationships (e.g., "(SELECT Id FROM Contacts)")
- Custom relationship fields end in "__r" (e.g., "CustomObject__r.Name")`,
  inputSchema: {
    type: "object",
    properties: {
      objectName: {
        type: "string",
        description: "API name of the object to query"
      },
      fields: {
        type: "array",
        items: { type: "string" },
        description: "List of fields to retrieve, including relationship fields"
      },
      whereClause: {
        type: "string",
        description: "WHERE clause, can include conditions on related objects",
        optional: true
      },
      orderBy: {
        type: "string",
        description: "ORDER BY clause, can include fields from related objects",
        optional: true
      },
      limit: {
        type: "number",
        description: "Maximum number of records to return",
        optional: true
      }
    },
    required: ["objectName", "fields"]
  }
};

export interface QueryArgs {
  objectName: string;
  fields: string[];
  whereClause?: string;
  orderBy?: string;
  limit?: number;
}

// Helper function to validate relationship field syntax
function validateRelationshipFields(fields: string[]): { isValid: boolean; error?: string } {
  for (const field of fields) {
    // Check for parent relationship syntax (dot notation)
    if (field.includes('.')) {
      const parts = field.split('.');
      // Check for empty parts
      if (parts.some(part => !part)) {
        return {
          isValid: false,
          error: `Invalid relationship field format: "${field}". Relationship fields should use proper dot notation (e.g., "Account.Name")`
        };
      }
      // Check for too many levels (Salesforce typically limits to 5)
      if (parts.length > 5) {
        return {
          isValid: false,
          error: `Relationship field "${field}" exceeds maximum depth of 5 levels`
        };
      }
    }

    // Check for child relationship syntax (subqueries)
    if (field.includes('SELECT') && !field.match(/^\(SELECT.*FROM.*\)$/)) {
      return {
        isValid: false,
        error: `Invalid subquery format: "${field}". Child relationship queries should be wrapped in parentheses`
      };
    }
  }

  return { isValid: true };
}



export async function handleQueryRecords(conn: any, args: QueryArgs) {
  const { objectName, fields, whereClause, orderBy, limit } = args;

  try {
    // Validate relationship field syntax
    const validation = validateRelationshipFields(fields);
    if (!validation.isValid) {
      return {
        content: [{
          type: "text",
          text: validation.error!
        }],
        isError: true,
      };
    }

    // Construct SOQL query
    let soql = `SELECT ${fields.join(', ')} FROM ${objectName}`;
    if (whereClause) soql += ` WHERE ${whereClause}`;
    if (orderBy) soql += ` ORDER BY ${orderBy}`;
    if (limit) soql += ` LIMIT ${limit}`;

    const result = await conn.query(soql);

    // Convert records to UIRecord format (string values)
    const uiRecords: UIRecord[] = result.records.map((r: any) => {
      const rec: UIRecord = {};
      for (const [k, v] of Object.entries(r)) {
        if (k === 'attributes') continue;
        if (v === null || v === undefined) {
          rec[k] = '';
        } else if (typeof v === 'object') {
          // If it has a Name, use it (common for parent relationships)
          if ('Name' in (v as any)) {
            rec[k] = (v as any).Name;
          } else {
            rec[k] = JSON.stringify(v);
          }
        } else {
          rec[k] = String(v);
        }
      }
      return rec;
    });

    const recordCount = uiRecords.length;
    const summary = `Found ${recordCount} record${recordCount === 1 ? '' : 's'}`;
    const content: any[] = [{ type: "text", text: JSON.stringify(result.records, null, 2) }];

    if (recordCount === 1) {
      const record = uiRecords[0];
      const recordName = record.Name || record.Id || "Record";
      const recordId = record.Id || "unknown";

      const sections: RecordSection[] = [{
        header: "Details",
        fields: record
      }];

      content.push(createUIResource({
        uri: `ui://record/detail/${encodeURIComponent(recordId)}`,
        content: { type: "rawHtml", htmlString: recordDetailCardHtml(recordName, sections, record) },
        encoding: "text",
      }));
    } else if (recordCount > 1) {
      const objectType = objectName;
      const recordsId = uiRecords[0].Id || "table";

      content.push(createUIResource({
        uri: `ui://records/view/${encodeURIComponent(objectType)}/${encodeURIComponent(recordsId)}`,
        content: { type: "rawHtml", htmlString: recordsTableHtml(uiRecords, objectType) },
        encoding: "text",
      }));
    }

    return {
      content,
      isError: false,
    };
  } catch (error) {
    // Enhanced error handling for relationship queries
    const errorMessage = error instanceof Error ? error.message : String(error);
    let enhancedError = errorMessage;

    if (errorMessage.includes('INVALID_FIELD')) {
      // Try to identify which relationship field caused the error
      const fieldMatch = errorMessage.match(/(?:No such column |Invalid field: )['"]?([^'")\s]+)/);
      if (fieldMatch) {
        const invalidField = fieldMatch[1];
        if (invalidField.includes('.')) {
          enhancedError = `Invalid relationship field "${invalidField}". Please check:\n` +
            `1. The relationship name is correct\n` +
            `2. The field exists on the related object\n` +
            `3. You have access to the field\n` +
            `4. For custom relationships, ensure you're using '__r' suffix`;
        }
      }
    }

    return {
      content: [{
        type: "text",
        text: `Error executing query: ${enhancedError}`
      }],
      isError: true,
    };
  }
}