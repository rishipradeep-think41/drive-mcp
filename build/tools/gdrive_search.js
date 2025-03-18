import { google } from "googleapis";
export const schema = {
    name: "gdrive_search",
    description: "Search for files in Google Drive",
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Search query",
            },
            pageToken: {
                type: "string",
                description: "Token for the next page of results",
                optional: true,
            },
            pageSize: {
                type: "number",
                description: "Number of results per page (max 100)",
                optional: true,
            },
        },
        required: ["query"],
    },
};
export async function search(args) {
    const drive = google.drive("v3");
    const userQuery = args.query.trim();
    let searchQuery = "";
    // If query is empty, list all files
    if (!userQuery) {
        searchQuery = "trashed = false";
    }
    else {
        // Escape special characters in the query
        const escapedQuery = userQuery.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        // Build search query with multiple conditions
        const conditions = [];
        // Search in title
        conditions.push(`name contains '${escapedQuery}'`);
        // If specific file type is mentioned in query, add mimeType condition
        if (userQuery.toLowerCase().includes("sheet")) {
            conditions.push("mimeType = 'application/vnd.google-sheets.spreadsheet'");
        }
        searchQuery = `(${conditions.join(" or ")}) and trashed = false`;
    }
    const res = await drive.files.list({
        q: searchQuery,
        pageSize: args.pageSize || 10,
        pageToken: args.pageToken,
        orderBy: "modifiedTime desc",
        fields: "nextPageToken, files(id, name, mimeType, modifiedTime, size)",
    });
    const fileList = res.data.files
        ?.map((file) => `${file.id} ${file.name} (${file.mimeType})`)
        .join("\n");
    let response = `Found ${res.data.files?.length ?? 0} files:\n${fileList}`;
    // Add pagination info if there are more results
    if (res.data.nextPageToken) {
        response += `\n\nMore results available. Use pageToken: ${res.data.nextPageToken}`;
    }
    return {
        content: [
            {
                type: "text",
                text: response,
            },
        ],
        isError: false,
    };
}
