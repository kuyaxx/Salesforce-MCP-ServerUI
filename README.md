# Salesforce MCP Server
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/tsmztech/mcp-server-salesforce/badge)](https://securityscorecards.dev/viewer/?uri=github.com/tsmztech/mcp-server-salesforce)


An MCP (Model Context Protocol) server implementation that integrates Claude with Salesforce, enabling natural language interactions with your Salesforce data and metadata. This server allows Claude to query, modify, and manage your Salesforce objects and records using everyday language.

<a href="https://glama.ai/mcp/servers/kqeniawbr6">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/kqeniawbr6/badge" alt="Salesforce Server MCP server" />
</a>

## Features

* **Field Management**: Create and modify custom fields using natural language
* **Smart Object Search**: Find Salesforce objects using partial name matches
* **Detailed Schema Information**: Get comprehensive field and relationship details for any object
* **Flexible Data Queries**: Query records with relationship support and complex filters
* **Data Manipulation**: Insert, update, delete, and upsert records with ease
* **Cross-Object Search**: Search across multiple objects using SOSL
* **Intuitive Error Handling**: Clear feedback with Salesforce-specific error details
* **Switchable Authentication**: Supports multiple orgs. Easily switch your active Salesforce org based on the default org configured in your VS Code workspace (use Salesforce_CLI authentication for this feature).

## Installation

### Global Installation (npm)

```bash
npm install -g @tsmztech/mcp-server-salesforce
```

### Claude Desktop Quick Installation

For easy setup with Claude Desktop, download the pre-configured extension:

1. Download [`salesforce-mcp-extension.dxt`](./claude-desktop/salesforce-mcp-extension.dxt) from the `claude-desktop/` folder
2. Open Claude Desktop → Settings → Extensions
3. Drag the `.dxt` file into the Extensions window
4. Configure your Salesforce credentials when prompted

For manual Claude Desktop configuration, see [Usage with Claude Desktop](#usage-with-claude-desktop) below.

## Tools

### salesforce_search_objects
Search for standard and custom objects:
* Search by partial name matches
* Finds both standard and custom objects
* Example: "Find objects related to Account" will find Account, AccountHistory, etc.

### salesforce_describe_object
Get detailed object schema information:
* Field definitions and properties
* Relationship details
* Picklist values
* Example: "Show me all fields in the Account object"

### salesforce_query_records
Query records with relationship support:
* Parent-to-child relationships
* Child-to-parent relationships
* Complex WHERE conditions
* Example: "Get all Accounts with their related Contacts"
* Note: For queries with GROUP BY or aggregate functions, use salesforce_aggregate_query

### salesforce_aggregate_query
Execute aggregate queries with GROUP BY:
* GROUP BY single or multiple fields
* Aggregate functions: COUNT, COUNT_DISTINCT, SUM, AVG, MIN, MAX
* HAVING clauses for filtering grouped results
* Date/time grouping functions
* Example: "Count opportunities by stage" or "Find accounts with more than 10 opportunities"

### salesforce_dml_records
Perform data operations:
* Insert new records
* Update existing records
* Delete records
* Upsert using external IDs
* Example: "Update status of multiple accounts"

### salesforce_manage_field
Manage object fields:
* Add new custom fields
* Modify field properties
* Create relationships
* Automatically grants Field Level Security to System Administrator by default
* Use `grantAccessTo` parameter to specify different profiles
* Example: "Add a Rating picklist field to Account"

### salesforce_search_all
Search across multiple objects:
* SOSL-based search
* Multiple object support
* Field snippets
* Example: "Search for 'cloud' across Accounts and Opportunities"

## Setup

### Salesforce Authentication
You can connect to Salesforce using one of three authentication methods:

#### 1. Username/Password Authentication (Default)
1. Set up your Salesforce credentials
2. Get your security token (Reset from Salesforce Settings)

#### 2. OAuth 2.0 Client Credentials Flow
1. Create a Connected App in Salesforce
2. Enable OAuth settings and select "Client Credentials Flow"
3. Set appropriate scopes (typically "api" is sufficient)
4. Save the Client ID and Client Secret
5. **Important**: Note your instance URL (e.g., `https://your-domain.my.salesforce.com`) as it's required for authentication

#### 3. Salesforce CLI Authentication (Recommended for local/dev) (contribution by @andrea9293)
1. Install and authenticate Salesforce CLI (`sf`).
2. Make sure your org is authenticated and accessible via `sf org display --json` in the root of your Salesforce project.
3. The server will automatically retrieve the access token and instance url using the CLI.



### Usage with Claude Desktop


Add to your `claude_desktop_config.json`:


#### For Salesforce CLI Authentication:
```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["-y", "@tsmztech/mcp-server-salesforce"],
      "env": {
        "SALESFORCE_CONNECTION_TYPE": "Salesforce_CLI"
      }
    }
  }
}
```

#### For Username/Password Authentication:
```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["-y", "@tsmztech/mcp-server-salesforce"],
      "env": {
        "SALESFORCE_CONNECTION_TYPE": "User_Password",
        "SALESFORCE_USERNAME": "your_username",
        "SALESFORCE_PASSWORD": "your_password",
        "SALESFORCE_TOKEN": "your_security_token",
        "SALESFORCE_INSTANCE_URL": "org_url"        // Optional. Default value: https://login.salesforce.com
      }
    }
  }
}
```

#### For OAuth 2.0 Client Credentials Flow:
```json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["-y", "@tsmztech/mcp-server-salesforce"],
      "env": {
        "SALESFORCE_CONNECTION_TYPE": "OAuth_2.0_Client_Credentials",
        "SALESFORCE_CLIENT_ID": "your_client_id",
        "SALESFORCE_CLIENT_SECRET": "your_client_secret",
        "SALESFORCE_INSTANCE_URL": "https://your-domain.my.salesforce.com"  // REQUIRED: Must be your exact Salesforce instance URL
      }
    }
  }
}
```

> **Note**: For OAuth 2.0 Client Credentials Flow, the `SALESFORCE_INSTANCE_URL` must be your exact Salesforce instance URL (e.g., `https://your-domain.my.salesforce.com`). The token endpoint will be constructed as `<instance_url>/services/oauth2/token`.

## Example Usage

### Searching Objects
```
"Find all objects related to Accounts"
"Show me objects that handle customer service"
"What objects are available for order management?"
```

### Getting Schema Information
```
"What fields are available in the Account object?"
"Show me the picklist values for Case Status"
"Describe the relationship fields in Opportunity"
```

### Querying Records
```
"Get all Accounts created this month"
"Show me high-priority Cases with their related Contacts"
"Find all Opportunities over $100k"
```

### Aggregate Queries
```
"Count opportunities by stage"
"Show me the total revenue by account"
"Find accounts with more than 10 opportunities"
"Calculate average deal size by sales rep and quarter"
"Get the number of cases by priority and status"
```

### Searching Across Objects
```
"Search for 'cloud' in Accounts and Opportunities"
"Find mentions of 'network issue' in Cases and Knowledge Articles"
"Search for customer name across all relevant objects"
```

## Development

### Building from source
```bash
# Clone the repository
git clone https://github.com/tsmztech/mcp-server-salesforce.git

# Navigate to directory
cd mcp-server-salesforce

# Install dependencies
npm install

# Build the project
npm run build
```

## Contributing
Contributions are welcome! Feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Issues and Support
If you encounter any issues or need support, please file an issue on the [GitHub repository](https://github.com/tsmztech/mcp-server-salesforce/issues).
