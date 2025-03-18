import { google } from "googleapis";
export const schema = {
    name: "gdrive_read_file",
    description: "Read contents of a file from Google Drive",
    inputSchema: {
        type: "object",
        properties: {
            fileId: {
                type: "string",
                description: "ID of the file to read",
            },
        },
        required: ["fileId"],
    },
};
const drive = google.drive("v3");
export async function readFile(args) {
    const result = await readGoogleDriveFile(args.fileId);
    return {
        content: [
            {
                type: "text",
                text: `Contents of ${result.name}:\n\n${result.contents.text || result.contents.blob}`,
            },
        ],
        isError: false,
    };
}
async function readGoogleDriveFile(fileId) {
    // First get file metadata to check mime type
    const file = await drive.files.get({
        fileId,
        fields: "mimeType,name",
    });
    // For Google Docs/Sheets/etc we need to export
    if (file.data.mimeType?.startsWith("application/vnd.google-apps")) {
        let exportMimeType;
        switch (file.data.mimeType) {
            case "application/vnd.google-apps.document":
                exportMimeType = "text/markdown";
                break;
            case "application/vnd.google-apps.spreadsheet":
                exportMimeType = "text/csv";
                break;
            case "application/vnd.google-apps.presentation":
                exportMimeType = "text/plain";
                break;
            case "application/vnd.google-apps.drawing":
                exportMimeType = "image/png";
                break;
            default:
                exportMimeType = "text/plain";
        }
        const res = await drive.files.export({ fileId, mimeType: exportMimeType }, { responseType: "text" });
        return {
            name: file.data.name || fileId,
            contents: {
                mimeType: exportMimeType,
                text: res.data,
            },
        };
    }
    // For regular files download content
    const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
    const mimeType = file.data.mimeType || "application/octet-stream";
    const isText = mimeType.startsWith("text/") || mimeType === "application/json";
    const content = Buffer.from(res.data);
    return {
        name: file.data.name || fileId,
        contents: {
            mimeType,
            ...(isText
                ? { text: content.toString("utf-8") }
                : { blob: content.toString("base64") }),
        },
    };
}
