import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { SalesforceField, SalesforceDescribeResponse } from "../types/salesforce";

export const DESCRIBE_OBJECT: Tool = {
  name: "salesforce_describe_object",
  description: "Get detailed schema metadata including all fields, relationships, and field properties of any Salesforce object. Examples: 'Account' shows all Account fields including custom fields; 'Case' shows all Case fields including relationships to Account, Contact etc.",
  inputSchema: {
    type: "object",
    properties: {
      objectName: {
        type: "string",
        description: "API name of the object (e.g., 'Account', 'Contact', 'Custom_Object__c')"
      }
    },
    required: ["objectName"]
  }
};

export async function handleDescribeObject(conn: any, objectName: string) {
  const describe = await conn.describe(objectName) as SalesforceDescribeResponse;

  return {
    content: [{
      type: "text",
      text: JSON.stringify(describe, null, 2)
    }],
    isError: false,
  };
}