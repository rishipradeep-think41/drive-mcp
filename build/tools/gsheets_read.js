import { google } from "googleapis";
export const schema = {
    name: "gsheets_read",
    description: "Read data from a Google Spreadsheet with flexible options for ranges and formatting",
    inputSchema: {
        type: "object",
        properties: {
            spreadsheetId: {
                type: "string",
                description: "The ID of the spreadsheet to read",
            },
            ranges: {
                type: "array",
                items: {
                    type: "string",
                },
                description: "Optional array of A1 notation ranges like ['Sheet1!A1:B10']. If not provided, reads entire sheet.",
            },
            sheetId: {
                type: "number",
                description: "Optional specific sheet ID to read. If not provided with ranges, reads first sheet.",
            },
        },
        required: ["spreadsheetId"],
    },
};
const sheets = google.sheets("v4");
function getA1Notation(row, col) {
    let a1 = "";
    while (col > 0) {
        col--;
        a1 = String.fromCharCode(65 + (col % 26)) + a1;
        col = Math.floor(col / 26);
    }
    return `${a1}${row + 1}`;
}
async function processSheetData(response) {
    const results = [];
    // Handle both single and multiple ranges
    const valueRanges = response.data.valueRanges || [response.data];
    for (const range of valueRanges) {
        const values = range.values || [];
        if (values.length === 0)
            continue;
        // Extract sheet name from range
        const rangeParts = range.range?.split("!") || [];
        const sheetName = rangeParts[0]?.replace(/'/g, "") || "Sheet1";
        // Process data with cell locations
        const processedValues = values.map((row, rowIndex) => row.map((cell, colIndex) => ({
            value: cell,
            location: `${sheetName}!${getA1Notation(rowIndex, colIndex + 1)}`,
        })));
        // Process headers with locations
        const columnHeaders = processedValues[0];
        const data = processedValues.slice(1);
        results.push({
            sheetName,
            data,
            totalRows: values.length,
            totalColumns: columnHeaders.length,
            columnHeaders,
        });
    }
    return results;
}
export async function readSheet(args) {
    try {
        let response;
        if (args.ranges) {
            // Read specific ranges
            response = await sheets.spreadsheets.values.batchGet({
                spreadsheetId: args.spreadsheetId,
                ranges: args.ranges,
            });
        }
        else if (args.sheetId !== undefined) {
            // Get sheet name from sheet ID first
            const metadata = await sheets.spreadsheets.get({
                spreadsheetId: args.spreadsheetId,
                fields: "sheets.properties",
            });
            const sheet = metadata.data.sheets?.find((s) => s.properties?.sheetId === args.sheetId);
            if (!sheet?.properties?.title) {
                throw new Error(`Sheet ID ${args.sheetId} not found`);
            }
            response = await sheets.spreadsheets.values.get({
                spreadsheetId: args.spreadsheetId,
                range: sheet.properties.title,
            });
        }
        else {
            // Read first sheet by default
            response = await sheets.spreadsheets.values.get({
                spreadsheetId: args.spreadsheetId,
                range: "A:ZZ", // Read all possible columns
            });
        }
        const processedData = await processSheetData(response);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(processedData, null, 2),
                },
            ],
            isError: false,
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error reading spreadsheet: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
}
