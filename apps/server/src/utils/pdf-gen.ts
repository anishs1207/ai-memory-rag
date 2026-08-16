import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

type ResearchBlock = {
    kind: "heading" | "subheading" | "bullet" | "paragraph";
    text: string;
};

function decodeLatexText(value: string): string {
    return value
        .replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, "$2 ($1)")
        .replace(/\\(?:textbf|textit|emph|underline)\{([^{}]*)\}/g, "$1")
        .replace(/\\(?:url)\{([^{}]*)\}/g, "$1")
        .replace(/\\[$%&#_{}]/g, (match) => match.slice(1))
        .replace(/~+/g, " ")
        .replace(/\\(?:label|ref|cite)\{[^{}]*\}/g, "")
        .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "")
        .replace(/[{}]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function parseLatexResearch(content: string): ResearchBlock[] {
    let normalized = content
        .replace(/```(?:latex|tex)?/gi, "")
        .replace(/```/g, "")
        .replace(/%.*$/gm, "")
        .replace(/\\begin\{document\}/g, "\n")
        .replace(/\\end\{document\}/g, "\n")
        .replace(/\\(?:documentclass|usepackage)(?:\[[^\]]*\])?\{[^}]*\}/g, "")
        .replace(/\\(?:title|author|date)\{[^}]*\}/g, "")
        .replace(/\\(?:maketitle|tableofcontents|newpage|clearpage)\b/g, "")
        .replace(/\\section\*?\{([^}]*)\}/g, "\n@@HEADING@@$1\n")
        .replace(/\\subsection\*?\{([^}]*)\}/g, "\n@@SUBHEADING@@$1\n")
        .replace(/\\subsubsection\*?\{([^}]*)\}/g, "\n@@SUBHEADING@@$1\n")
        .replace(/\\item\s*/g, "\n@@BULLET@@")
        .replace(/\\(?:begin|end)\{(?:itemize|enumerate|description|center|flushleft|flushright)\}/g, "\n")
        .replace(/\\\\/g, "\n");

    const blocks: ResearchBlock[] = [];
    for (const rawPart of normalized.split(/\n{2,}|\r?\n/)) {
        const part = rawPart.trim();
        if (!part) continue;

        let kind: ResearchBlock["kind"] = "paragraph";
        let value = part;
        if (part.startsWith("@@HEADING@@")) {
            kind = "heading";
            value = part.slice("@@HEADING@@".length);
        } else if (part.startsWith("@@SUBHEADING@@")) {
            kind = "subheading";
            value = part.slice("@@SUBHEADING@@".length);
        } else if (part.startsWith("@@BULLET@@")) {
            kind = "bullet";
            value = part.slice("@@BULLET@@".length);
        }

        const text = decodeLatexText(value);
        if (text) blocks.push({ kind, text });
    }
    return blocks;
}

export async function generateResearchPDF(topic: string, content: string, fileName: string): Promise<string> {
    const uploadsDir = path.join(process.cwd(), "uploads");
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "-");
    const pdfFileName = safeFileName.toLowerCase().endsWith(".pdf") ? safeFileName : `${safeFileName}.pdf`;
    const filePath = path.join(uploadsDir, pdfFileName);
    const blocks = parseLatexResearch(content);

    console.log(`[PDF-Gen] Generating local PDF for topic: ${topic}`);

    await new Promise<void>((resolve, reject) => {
        const document = new PDFDocument({ size: "A4", margin: 54, info: { Title: topic, Author: "Inqora AI" } });
        const output = fs.createWriteStream(filePath);
        output.on("finish", resolve);
        output.on("error", reject);
        document.on("error", reject);
        document.pipe(output);

        document.font("Helvetica-Bold").fontSize(22).fillColor("#111827").text(topic, { align: "center" });
        document.moveDown(0.5);
        document.font("Helvetica").fontSize(9).fillColor("#6B7280").text(`Generated ${new Date().toLocaleDateString()}`, { align: "center" });
        document.moveDown(2);

        for (const block of blocks) {
            if (block.kind === "heading") {
                document.moveDown(0.8).font("Helvetica-Bold").fontSize(16).fillColor("#111827").text(block.text).moveDown(0.35);
            } else if (block.kind === "subheading") {
                document.moveDown(0.5).font("Helvetica-Bold").fontSize(13).fillColor("#1F2937").text(block.text).moveDown(0.25);
            } else if (block.kind === "bullet") {
                document.font("Helvetica").fontSize(10.5).fillColor("#374151").text(`•  ${block.text}`, { indent: 12, lineGap: 3 }).moveDown(0.3);
            } else {
                document.font("Helvetica").fontSize(10.5).fillColor("#374151").text(block.text, { align: "justify", lineGap: 3 }).moveDown(0.65);
            }
        }

        if (blocks.length === 0) {
            document.font("Helvetica").fontSize(11).fillColor("#374151").text("No research content was generated.");
        }
        document.end();
    });

    console.log(`[PDF-Gen] PDF generated locally: ${pdfFileName}`);
    return `/uploads/${pdfFileName}`;
}
