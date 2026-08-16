import fs from "node:fs";
import path from "node:path";
import { generateResearchPDF } from "../dist/utils/pdf-gen.js";

const fileName = "pdf-gen-smoke.pdf";
const outputPath = path.join(process.cwd(), "uploads", fileName);

try {
    const url = await generateResearchPDF(
        "Local LaTeX Research",
        String.raw`\section{Abstract}This is a local report with \textbf{formatted text}.\section{Findings}\begin{itemize}\item First finding\item Second finding\end{itemize}`,
        fileName,
    );
    const bytes = await fs.promises.readFile(outputPath);
    if (url !== `/uploads/${fileName}` || bytes.subarray(0, 4).toString() !== "%PDF" || bytes.length < 500) {
        throw new Error("Generated artifact is not a valid PDF");
    }
    console.log(`Local PDF smoke test passed (${bytes.length} bytes)`);
} finally {
    await fs.promises.rm(outputPath, { force: true });
}
