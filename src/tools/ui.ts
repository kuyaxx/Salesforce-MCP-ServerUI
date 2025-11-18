import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { createUIResource } from "@mcp-ui/server";

/* --------------------------------------------------------------
   TYPES
   -------------------------------------------------------------- */
export interface EditRecordArgs {
  text: string;
}

export interface ViewRecordsArgs {
  records: string[];
}

type Object = Record<string, string>;

/* --------------------------------------------------------------
   CONSTANTS
   -------------------------------------------------------------- */
const REQUIRED_FIELDS = [
  "Name",
  "Id",
] as const;

/* --------------------------------------------------------------
   1. Parse → de-duplicate + keep original casing
   -------------------------------------------------------------- */
function parseObjectText(raw: string): Object {
  const lines = raw.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const nameLine = lines.find(l => !l.startsWith("*"));
  if (!nameLine) throw new Error("Missing object name (first non-bullet line).");

  const fieldMap = new Map<string, string>(); // lower → original label
  const valueMap = new Map<string, string>(); // lower → value (last wins)

  for (const line of lines) {
    if (!line.startsWith("*")) continue;
    const m = line.match(/^\*\s*([^:]+):\s*(.+)$/);
    if (!m) continue;
    const rawKey = m[1].trim();
    const value = m[2].trim();
    const lower = rawKey.toLowerCase();
    fieldMap.set(lower, rawKey);
    valueMap.set(lower, value);
  }

  const missing = REQUIRED_FIELDS.filter(f => !fieldMap.has(f.toLowerCase()));
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(", ")}`);

  const obj: Object = { Name: nameLine };
  for (const [lower, value] of valueMap.entries()) {
    const label = fieldMap
      .get(lower)!
      .split(/[\s_]+/)
      .map(w => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    obj[label] = value;
  }
  return obj;
}

/* --------------------------------------------------------------
   2. Strict ISO Date Check (excludes %, $, numbers, etc.)
   -------------------------------------------------------------- */
function isIsoDate(value: string): boolean {
  const trimmed = value.trim();

  // Block common non-dates early
  if (/%$/.test(trimmed)) return false;
  if (/^\$/.test(trimmed)) return false;
  if (/^\d+$/.test(trimmed)) return false; // pure number
  if (trimmed.includes('$') || trimmed.includes('%') || trimmed.includes(',')) return false;

  // Strict YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  }

  // Fallback: try parsing, but reject ancient/future dates
  const parsed = Date.parse(trimmed);
  if (isNaN(parsed)) return false;
  const year = new Date(parsed).getFullYear();
  return year >= 1900 && year <= 2100;
}

/* --------------------------------------------------------------
   3. Dynamic HTML Card (with smart input types)
   -------------------------------------------------------------- */
function objectCardHtml(obj: Object) {
  const esc = (s: string) => {
    return s.replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/"/g, '"');
  };

  const sortedKeys = Object.keys(obj).sort((a, b) => {
    if (a === "Id") return 1;
    if (b === "Id") return -1;
    return a.localeCompare(b);
  });

  const fieldsHtml = sortedKeys
    .map(key => {
      const value = obj[key];
      const id = key.replace(/\s+/g, "").toLowerCase();
      const lowerKey = key.toLowerCase();

      const isId = lowerKey === "id";
      const isDateField = lowerKey.includes("date");
      const isProbabilityField = lowerKey.includes("probability");
      const isAmountField = lowerKey.includes("amount") || lowerKey.includes("revenue");

      const forceText = isProbabilityField || isAmountField || isId;
      let type = "text";
      let inputValue = esc(value);

      // Date fields: only if value is valid ISO date
      if (!forceText && isDateField && isIsoDate(value)) {
        type = "date";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const d = new Date(value);
          if (!isNaN(d.getTime())) {
            inputValue = d.toISOString().split("T")[0];
          }
        }
      }

      // Probability: strip % for editing
      if (isProbabilityField && /%\s*$/.test(value)) {
        inputValue = esc(value.replace(/%\s*$/, "").trim());
      }

      const readonly = isId ? 'readonly style="background:#f3f4f6"' : "";

      const percentSymbol = isProbabilityField
        ? `<span class="percent-symbol">%</span>`
        : "";

      return `
        <div class="field ${isProbabilityField ? "percent-field" : ""}">
          <label for="${id}">${esc(key)}</label>
          <div class="input-wrapper">
            <input type="${type}" id="${id}" value="${inputValue}" ${readonly}>
            ${percentSymbol}
          </div>
        </div>`;
    })
    .join("\n");

  const title = esc(obj.Name || "Object");

  // Safely inject original data
  const objJson = JSON.stringify(obj)
    .replace(/<\/script>/gi, "<\\/script>")
    .replace(/<!--/g, "<\\!--");

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Edit – ${title}</title>
  <style>
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI;background:#f9f9fb}
    .wrap{max-width:720px;margin:0 auto;padding:16px}
    .card{background:#fff;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.07);overflow:hidden}
    .header{padding:16px 20px;border-bottom:1px solid #eee}
    .header h1{margin:0;font-size:18px;font-weight:600;color:#111}
    .body{padding:20px}
    .field{margin-bottom:16px;position:relative}
    .field label{display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:4px}
    .input-wrapper{position:relative}
    .field input[type=text],.field input[type=date]{
      width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;
      font-size:15px;background:#fff;color:#111;box-sizing:border-box;
    }
    .percent-field input{padding-right:32px}
    .percent-symbol{
      position:absolute;right:12px;top:50%;transform:translateY(-50%);
      color:#6b7280;font-size:14px;pointer-events:none;
    }
    .field input:focus{border-color:#111;outline:none}
    .field input[readonly]{background:#f3f4f6;color:#6b7280}
    .actions{padding:16px 20px;display:flex;justify-content:flex-end;gap:10px;border-top:1px solid #eee}
    .btn{padding:10px 16px;border:0;border-radius:999px;font-weight:500;cursor:pointer;font-size:14px}
    .btn.primary{background:#111;color:#fff}
    .btn.cancel{background:#e5e7eb;color:#111}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header"><h1>Edit ${title}</h1></div>
      <div class="body">
        ${fieldsHtml}
      </div>
      <div class="actions">
        <button class="btn cancel" onclick="cancel()">Cancel</button>
        <button class="btn primary" onclick="save()">Save</button>
      </div>
    </div>
  </div>
  <script>
    // Original data from server
    const original = ${objJson};

    // Resize observer
    const observer = new ResizeObserver(es => {
      for (const e of es) {
        parent.postMessage(
          { type: "ui-size-change", payload: { height: e.contentRect.height + 16 } },
          "*"
        );
      }
    });
    observer.observe(document.documentElement);

    function getFormData() {
      const data = {};
      document.querySelectorAll(".field").forEach(f => {
        const label = f.querySelector("label").innerText;
        const input = f.querySelector("input");
        let value = input.value.trim();

        // Re-add % for probability
        if (f.classList.contains("percent-field")) {
          value = value ? value + "%" : "";
        }

        data[label] = value;
      });
      return data;
    }

    function buildPrompt(current) {
      const changed = [];
      for (const key of Object.keys(original)) {
        const oldVal = original[key];
        const newVal = current[key] ?? "";
        if (oldVal === newVal) continue;

        const normOld = key.toLowerCase().includes("date") ? oldVal.split("T")[0] : oldVal;
        const normNew = key.toLowerCase().includes("date") ? newVal.split("T")[0] : newVal;
        if (normOld !== normNew) {
          changed.push(\`\${key} from "\${normOld}" to "\${normNew}"\`);
        }
      }
      if (changed.length === 0) return "No changes detected.";
      const plural = changed.length > 1 ? "these fields" : "this field";
      return \`Update \${plural}: \${changed.join("; ")}.\`;
    }

    function save() {
      const current = getFormData();
      const prompt = buildPrompt(current);
      parent.postMessage({
        type: "prompt",
        payload: { prompt, params: { recordData: current } }
      }, "*");
    }

    function cancel() {
      parent.postMessage({ type: "action", payload: { action: "cancel" } }, "*");
    }
  </script>
</body>
</html>`;
}

/* --------------------------------------------------------------
   3b. Records Table HTML (for viewing multiple records)
   -------------------------------------------------------------- */
function recordsTableHtml(records: Object[], objectType: string) {
  const esc = (s: string) => {
    return s.replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/"/g, '"');
  };

  if (records.length === 0) {
    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Records – ${objectType}</title>
  <style>
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI;background:#f9f9fb}
    .wrap{max-width:1024px;margin:0 auto;padding:16px}
    .card{background:#fff;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.07);overflow:hidden}
    .header{padding:16px 20px;border-bottom:1px solid #eee}
    .header h1{margin:0;font-size:18px;font-weight:600;color:#111}
    .body{padding:20px;text-align:center;color:#6b7280}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header"><h1>${objectType} Records</h1></div>
      <div class="body">
        <p>No records found.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  // Get all field names from all records
  const allFields = new Set<string>();
  records.forEach(record => {
    Object.keys(record).forEach(field => allFields.add(field));
  });

  const fields = Array.from(allFields).sort((a, b) => {
    if (a === "Name") return -1;
    if (b === "Name") return 1;
    if (a === "Id") return 1;
    if (b === "Id") return -1;
    return a.localeCompare(b);
  });

  const tableRows = records
    .map((record, index) => {
      const actionCell = `<td class="action-cell"><button class="edit-btn" onclick="event.stopPropagation(); editRecord(${index})" title="Edit Record">Edit</button></td>`;

      const cells = fields.map(field => {
        const value = record[field] || "";
        const displayValue = ((field: string, val: string) => {
          if (val === "") return "";

          // Format dates
          if (field.toLowerCase().includes("date") && isIsoDate(val)) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
          }

          // Format probability (if it has %)
          if (field.toLowerCase().includes("probability") && val.endsWith("%")) {
            return val;
          }

          return esc(val);
        })(field, value);

        return `<td class="cell">${displayValue}</td>`;
      }).join("");

      // Safely inject record data for edit action
      const recordJson = JSON.stringify(record)
        .replace(/<\/script>/gi, "<\\/script>")
        .replace(/<!--/g, "<\\!--");

      return `<tr class="record-row" onclick="editRecord(${index})" data-record='${recordJson}'>${actionCell}${cells}</tr>`;
    })
    .join("\n");

  const tableHeaders = [
    '<th class="header-cell">Actions</th>',
    ...fields.map(field => `<th class="header-cell">${esc(field)}</th>`)
  ].join("");

  // Safely inject all records for the script
  const recordsJson = JSON.stringify(records)
    .replace(/<\/script>/gi, "<\\/script>")
    .replace(/<!--/g, "<\\!--");

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Records – ${objectType}</title>
  <style>
    body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI;background:#f9f9fb}
    .wrap{max-width:1024px;margin:0 auto;padding:16px}
    .card{background:#fff;border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.07);overflow:hidden}
    .header{padding:16px 20px;border-bottom:1px solid #eee}
    .header h1{margin:0;font-size:18px;font-weight:600;color:#111}
    .body{padding:0}
    table{width:100%;border-collapse:collapse}
    th,td{padding:12px 16px;text-align:left;border-bottom:1px solid #f3f4f6}
    th{font-weight:600;color:#374151;font-size:14px;background:#f9f9fb}
    .record-row{cursor:pointer;transition:background-color 0.15s}
    .record-row:hover{background:#f9f9fb}
    .record-row:first-child{border-bottom:1px solid #e5e7eb}
    .cell{font-size:14px;color:#111;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .header-cell{font-size:12px;text-transform:uppercase;letter-spacing:0.05em}
    .action-cell{text-align:center;width:80px}
    .edit-btn{background:#111;color:#fff;border:0;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:500;cursor:pointer;transition:background-color 0.15s}
    .edit-btn:hover{background:#333}
    .edit-btn:active{background:#000}
    .no-records{text-align:center;padding:40px;color:#6b7280}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header"><h1>${objectType} Records</h1></div>
      <div class="body">
        <table>
          <thead><tr>${tableHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    // All records data from server
    const allRecords = ${recordsJson};

    // Resize observer
    const observer = new ResizeObserver(es => {
      for (const e of es) {
        parent.postMessage(
          { type: "ui-size-change", payload: { height: e.contentRect.height + 16 } },
          "*"
        );
      }
    });
    observer.observe(document.documentElement);

    function editRecord(recordIndex) {
      const record = allRecords[recordIndex];
      if (record) {
        // Build prompt to open record in edit mode
        const prompt = "Edit this " + (record.Name || "record") + " record in the UI form:";

        parent.postMessage({
          type: "prompt",
          payload: {
            prompt,
            params: { text: formatRecordForEdit(record) }
          }
        }, "*");
      }
    }

    function formatRecordForEdit(record) {
      let textContent = record.Name || "Record";

      for (const [key, value] of Object.entries(record)) {
        if (key !== "Name") {
          textContent += "\\n* " + key + ": " + value;
        }
      }

      return textContent;
    }
  </script>
</body>
</html>`;
}

/* --------------------------------------------------------------
   4. Tool Definition (MCP SDK format)
   -------------------------------------------------------------- */
export const EDIT_SINGLE_RECORD: Tool = {
  name: "salesforce_edit_record",
  description: `Edit a single Salesforce record using an interactive UI form. Use this tool when you want to modify, update, or edit record data with a visual form interface.

ACTIVATE THIS TOOL when users say things like:
• "Edit this record"
• "Open [record] in edit mode/form/UI"
• "Show [record] in editing form/interface"
• "Modify/update [record] fields"
• "Edit [record] values/data"

The tool provides a dynamic web form with:
• Smart input types (dates, text, numbers)
• Field validation formatting
• Save/Cancel functionality
• Visual editing interface
• Support for all standard and custom Salesforce fields

Example usage: When a user wants to edit a contact's information, this tool opens an interactive form where they can modify field values visually rather than through text commands.`,
  inputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Text representation of the record to edit, formatted as: 'ObjectName\\n\\n* Field1: value1\\n* Field2: value2\\n...' with Name and Id as required fields"
      }
    },
    required: ["text"]
  }
};

/* --------------------------------------------------------------
   5. Handler Function (following MCP server pattern)
   -------------------------------------------------------------- */
export async function handleEditSingleRecord(conn: any, args: EditRecordArgs) {
  const { text } = args;

  try {
    let obj: Object;
    obj = parseObjectText(text);

    const summary = Object.entries(obj)
      .map(([k, v]) => `**${k}:** ${v}`)
      .join("\n");

    const objId = obj["Id"] || "new";

    return {
      content: [
        { type: "text", text: summary },
        createUIResource({
          uri: `ui://record/edit/${encodeURIComponent(objId)}`,
          content: { type: "rawHtml", htmlString: objectCardHtml(obj) },
          encoding: "text",
        }),
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: `Error parsing object text: ${errorMessage}\n\nExpected format:\n\`\`\`\nObject Name\n\n* Id: record-id\n* Name: record-name\n* AnyField: value\n* AnotherField: value\n\`\`\``
      }],
      isError: true,
    };
  }
}

/* --------------------------------------------------------------
   6. View Multiple Records Tool (Table format)
   -------------------------------------------------------------- */
export const VIEW_RECORDS_TABLE: Tool = {
  name: "salesforce_view_records_table",
  description: `Display multiple Salesforce records in a table view with edit functionality. Use this tool when you want to view, browse, or select from a list of records with the ability to edit individual records by clicking on them.

ACTIVATE THIS TOOL when users say things like:
• "Show me all records"
• "Show me top 5 open opportunities by amount"
• "View [records] in a table/list"
• "List all [records] with edit option"
• "Display [records] for selection/editing"
• "Browse records and edit selected ones"

The tool provides an interactive table with:
• All records displayed in rows and columns
• Action button in the first column to edit each individual record
• Clickable rows to launch edit mode for individual records (maintaining backward compatibility)
• Consistent styling with edit forms
• Smart field formatting (dates, percentages, etc.)
• Responsive design for different screen sizes

Example usage: When a user wants to see a list of contacts or accounts and be able to edit specific ones, this tool displays them in an interactive table where clicking the "Edit" button in the first column opens the edit form.`,
  inputSchema: {
    type: "object",
    properties: {
      records: {
        type: "array",
        items: {
          type: "string"
        },
        description: "Array of text representations for records, each formatted as: 'ObjectName\\n\\n* Field1: value1\\n* Field2: value2\\n...' with Name and Id as required fields per record"
      },
      objectType: {
        type: "string",
        description: "The Salesforce object type (e.g., 'Account', 'Contact', 'Custom_Object__c') for display purposes"
      }
    },
    required: ["records", "objectType"]
  }
};

/* --------------------------------------------------------------
   7. Handler Function for Table View
   -------------------------------------------------------------- */
export async function handleDisplayRecordsTable(conn: any, args: { records: string[], objectType: string }) {
  const { records, objectType } = args;

  try {
    // Parse each record text into objects
    const parsedRecords: Object[] = records.map(text => parseObjectText(text));

    const summary = `Found ${parsedRecords.length} ${objectType} record${parsedRecords.length === 1 ? '' : 's'}`;

    const recordsId = parsedRecords.length > 0 ? parsedRecords[0]["Id"] : "table";

    return {
      content: [
        { type: "text", text: summary },
        createUIResource({
          uri: `ui://records/view/${encodeURIComponent(objectType)}/${encodeURIComponent(recordsId)}`,
          content: { type: "rawHtml", htmlString: recordsTableHtml(parsedRecords, objectType) },
          encoding: "text",
        }),
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: `Error parsing records: ${errorMessage}\n\nExpected format for each record:\n\`\`\`\nObject Name\n\n* Id: record-id\n* Name: record-name\n* AnyField: value\n* AnotherField: value\n\`\`\``
      }],
      isError: true,
    };
  }
}
