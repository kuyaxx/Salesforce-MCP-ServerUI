#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";

import { createSalesforceConnection } from "./utils/connection.js";

import { DESCRIBE_OBJECT, handleDescribeObject } from "./tools/describe.js";
import { QUERY_RECORDS, handleQueryRecords, QueryArgs } from "./tools/query.js";
import { AGGREGATE_QUERY, handleAggregateQuery, AggregateQueryArgs } from "./tools/aggregateQuery.js";
import { DML_RECORDS, handleDMLRecords, DMLArgs } from "./tools/dml.js";


import { EDIT_SINGLE_RECORD, handleEditSingleRecord, EditRecordArgs, VIEW_RECORDS_TABLE, handleDisplayRecordsTable, VIEW_RECORD_DETAIL, handleViewRecordDetail, ViewRecordDetailArgs } from "./tools/ui.js";

// Load environment variables (using dotenv 16.x which has no stdout tips)
// MCP servers require stdout to contain ONLY JSON-RPC messages
dotenv.config();

const server = new Server(
  {
    name: "salesforce-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [

    DESCRIBE_OBJECT,
    QUERY_RECORDS,
    AGGREGATE_QUERY,
    DML_RECORDS,


    EDIT_SINGLE_RECORD,
    VIEW_RECORDS_TABLE,
    VIEW_RECORD_DETAIL
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;
    if (!args) throw new Error('Arguments are required');

    const conn = await createSalesforceConnection();

    switch (name) {


      case "salesforce_describe_object": {
        const { objectName } = args as { objectName: string };
        if (!objectName) throw new Error('objectName is required');
        return await handleDescribeObject(conn, objectName);
      }

      case "salesforce_query_records": {
        const queryArgs = args as Record<string, unknown>;
        if (!queryArgs.objectName || !Array.isArray(queryArgs.fields)) {
          throw new Error('objectName and fields array are required for query');
        }
        // Type check and conversion
        const validatedArgs: QueryArgs = {
          objectName: queryArgs.objectName as string,
          fields: queryArgs.fields as string[],
          whereClause: queryArgs.whereClause as string | undefined,
          orderBy: queryArgs.orderBy as string | undefined,
          limit: queryArgs.limit as number | undefined
        };
        return await handleQueryRecords(conn, validatedArgs);
      }

      case "salesforce_aggregate_query": {
        const aggregateArgs = args as Record<string, unknown>;
        if (!aggregateArgs.objectName || !Array.isArray(aggregateArgs.selectFields) || !Array.isArray(aggregateArgs.groupByFields)) {
          throw new Error('objectName, selectFields array, and groupByFields array are required for aggregate query');
        }
        // Type check and conversion
        const validatedArgs: AggregateQueryArgs = {
          objectName: aggregateArgs.objectName as string,
          selectFields: aggregateArgs.selectFields as string[],
          groupByFields: aggregateArgs.groupByFields as string[],
          whereClause: aggregateArgs.whereClause as string | undefined,
          havingClause: aggregateArgs.havingClause as string | undefined,
          orderBy: aggregateArgs.orderBy as string | undefined,
          limit: aggregateArgs.limit as number | undefined
        };
        return await handleAggregateQuery(conn, validatedArgs);
      }

      case "salesforce_dml_records": {
        const dmlArgs = args as Record<string, unknown>;
        if (!dmlArgs.operation || !dmlArgs.objectName || !Array.isArray(dmlArgs.records)) {
          throw new Error('operation, objectName, and records array are required for DML');
        }
        const validatedArgs: DMLArgs = {
          operation: dmlArgs.operation as 'insert' | 'update' | 'delete' | 'upsert',
          objectName: dmlArgs.objectName as string,
          records: dmlArgs.records as Record<string, any>[],
          externalIdField: dmlArgs.externalIdField as string | undefined
        };
        return await handleDMLRecords(conn, validatedArgs);
      }





      case "salesforce_edit_record": {
        const editArgs = args as Record<string, unknown>;
        if (!editArgs.text) {
          throw new Error('text is required for editing record');
        }

        // Type check and conversion
        const validatedArgs: EditRecordArgs = {
          text: editArgs.text as string
        };

        return await handleEditSingleRecord(conn, validatedArgs);
      }

      case "salesforce_view_records_table": {
        const tableArgs = args as Record<string, unknown>;
        if (!Array.isArray(tableArgs.records) || !tableArgs.objectType) {
          throw new Error('records array and objectType are required for viewing records table');
        }

        // Type check and conversion
        const validatedArgs = {
          records: tableArgs.records as string[],
          objectType: tableArgs.objectType as string
        };

        return await handleDisplayRecordsTable(conn, validatedArgs);
      }

      case "salesforce_view_record_detail": {
        const detailArgs = args as Record<string, unknown>;
        if (!detailArgs.text) {
          throw new Error('text is required for viewing record detail');
        }

        // Type check and conversion
        const validatedArgs: ViewRecordDetailArgs = {
          text: detailArgs.text as string
        };

        return await handleViewRecordDetail(conn, validatedArgs);
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Salesforce MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
