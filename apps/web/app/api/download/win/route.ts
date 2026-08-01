import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

/**
 * GET /api/download/win
 * Locates and streams the compiled Electron desktop executable (desktop-app 0.0.0.exe).
 */
export async function GET() {
  const possiblePaths = [
    path.join(process.cwd(), "public/downloads/desktop-app.exe"),
    path.join(process.cwd(), "../../apps/blinky/dist/desktop-app 0.0.0.exe"),
    path.join(process.cwd(), "../blinky/dist/desktop-app 0.0.0.exe"),
    path.join(process.cwd(), "public/downloads/blinky.exe"),
  ]

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath)
      const stat = fs.statSync(filePath)

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="desktop-app-0.0.0.exe"',
          "Content-Length": stat.size.toString(),
        },
      })
    }
  }

  return NextResponse.json({ error: "Desktop executable payload not found" }, { status: 404 })
}
