import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import * as fs from "fs";
import * as path from "path";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "File path parameter required" }, { status: 400 });
  }

  // Security check: ensure path is within project storage directory
  const resolvedPath = path.resolve(filePath);
  const storageRoot = path.resolve(process.cwd(), "storage");

  if (!resolvedPath.startsWith(storageRoot)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!fs.existsSync(resolvedPath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(resolvedPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const filename = path.basename(resolvedPath);

  let contentType = "application/octet-stream";
  if (ext === ".pdf") contentType = "application/pdf";
  else if (ext === ".docx") contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
