# Salesforce MCP Server with MCP-UI

This project is a demonstration of adding [MCP-UI](https://mcpui.dev/) functionality to a Salesforce MCP server. It is based on a subset of the [Salesforce MCP Server](https://github.com/tsmztech/mcp-server-salesforce), specifically focusing on object queries, aggregate queries, DML operations, and metadata descriptions.

> **Note:** This is not production-ready code. This project is designed to demonstrate how to add MCP-UI to an agent to present nicely formatted responses.

## Features

- **Rich UI Responses**: Enhanced TypeScript implementation using MCP-UI to present Salesforce data in a nicely formatted way.
- **Reusable UI Module**: Includes `src/tools/ui.ts` which can be used independently with other Salesforce MCP servers.
- **Local Execution**: Supports running locally for development and testing.

## Getting Started

### Installation

```bash
npm install
npm run build
```

### Authentication

This server supports the same authentication methods as the original repository:
1. **Salesforce CLI** (Recommended for local/dev)
2. **Username/Password**
3. **OAuth 2.0 Client Credentials**

For detailed authentication setup and Claude Desktop configuration, please refer to the [original repository documentation](https://github.com/tsmztech/mcp-server-salesforce#setup).

## Usage

This server provides tools to interact with Salesforce, now enhanced with UI components for better visualization in supported clients.

### UI Functionalities (from `ui.ts`)

The `ui.ts` module provides several key components for rendering Salesforce data:

- **Object Card (`objectCardHtml`)**: Renders a single record in an editable form with smart inputs (date pickers, percentage formatting) and validation.
- **Records Table (`recordsTableHtml`)**: Displays a list of records in a responsive table with "Edit" actions for quick modifications.
- **Read-Only Table (`readOnlyTableHtml`)**: Presents aggregate query results or read-only data in a clean tabular format.
- **Detail Card (`recordDetailCardHtml`)**: Shows a comprehensive view of a record with grouped sections and formatted fields (auto-linking emails, phones, and URLs).

## Sample Run Command

To run this server from an agent (e.g., Goose), use the following command:

```bash
node /Users/kuyaxx/Salesforce-MCP-ServerUI
```

## References

- **Source Repository**: [github.com/tsmztech/mcp-server-salesforce](https://github.com/tsmztech/mcp-server-salesforce)
- **MCP-UI Documentation**: [mcpui.dev](https://mcpui.dev/)