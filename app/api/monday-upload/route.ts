import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MONDAY_GQL = "https://api.monday.com/v2";
const MONDAY_FILE = "https://api.monday.com/v2/file";

// Hilfsfunktion: führt eine GraphQL-Query gegen die monday.com-API aus.
async function mondayQuery(token: string, query: string, variables?: Record<string, unknown>) {
  const r = await fetch(MONDAY_GQL, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) {
    const msg = Array.isArray(j.errors) ? j.errors.map((e: { message?: string }) => e.message).join(" | ") : "monday.com-Fehler";
    throw new Error(msg);
  }
  return j.data;
}

export async function POST(req: Request) {
  try {
    const token = process.env.MONDAY_API_TOKEN;
    const boardId = process.env.MONDAY_BOARD_ID;
    const columnId = process.env.MONDAY_FILE_COLUMN_ID;
    if (!token || !boardId || !columnId) {
      return NextResponse.json({
        error: "monday.com nicht konfiguriert. Bitte MONDAY_API_TOKEN, MONDAY_BOARD_ID und MONDAY_FILE_COLUMN_ID in .env.local setzen und den Dev-Server neu starten."
      }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    const itemName = String(form.get("itemName") || "PDF");
    const groupId = form.get("groupId");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Datei fehlt" }, { status: 400 });
    }

    // 1) Item im Board anlegen. group_id optional, damit Items optional in
    // einer bestimmten Gruppe landen können (z. B. nach Quiz-Titel).
    const created = await mondayQuery(token,
      `mutation($boardId: ID!, $name: String!, $groupId: String) { create_item(board_id: $boardId, item_name: $name, group_id: $groupId) { id } }`,
      { boardId, name: itemName, groupId: groupId || null }
    );
    const itemId: string | undefined = created?.create_item?.id;
    if (!itemId) {
      return NextResponse.json({ error: "monday.com hat keine Item-ID geliefert" }, { status: 502 });
    }

    // 2) PDF in die Datei-Spalte hochladen. monday.com erwartet ein Multipart
    // mit "query" und "variables[file]". item_id und column_id werden in den
    // Query-String eingesetzt (column_id ist die Spalten-ID, nicht der Titel).
    const fd = new FormData();
    fd.append(
      "query",
      `mutation ($file: File!) { add_file_to_column(file: $file, item_id: ${itemId}, column_id: "${columnId}") { id } }`
    );
    fd.append("variables[file]", file, file.name);

    const upRes = await fetch(MONDAY_FILE, {
      method: "POST",
      headers: { Authorization: token },
      body: fd,
    });
    const upJson = await upRes.json();
    if (upJson.errors) {
      const msg = Array.isArray(upJson.errors) ? upJson.errors.map((e: { message?: string }) => e.message).join(" | ") : "Upload-Fehler";
      throw new Error(msg);
    }
    return NextResponse.json({
      itemId,
      fileId: upJson?.data?.add_file_to_column?.id ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error("monday-upload error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
