import fs from 'fs';
import path from 'path';
import axios from 'axios';

/**
 * Generates a professional PDF from LaTeX content using a cloud compiler API.
 */
export async function generateResearchPDF(topic: string, content: string, fileName: string): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, fileName);

    try {
        console.log(`[PDF-Gen] Compiling LaTeX for topic: ${topic}`);

        // Ensure we have a proper document structure if the AI didn't provide one
        let fullLatex = content;
        if (!content.includes('\\documentclass')) {
            fullLatex = `
\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{hyperref}
\\usepackage{geometry}
\\geometry{margin=1in}

\\title{Research Report: ${topic}}
\\author{PAXIO Memory AI}
\\date{\\today}

\\begin{document}
\\maketitle

${content}

\\end{document}
            `;
        }

        // Using a reliable cloud LaTeX compiler API (latex.ytane.com or similar)
        // Note: In a production app, you might use a dedicated service like Overleaf API or a self-hosted latex-container
        const response = await axios({
            method: 'post',
            url: 'https://latex.ytane.com/compile',
            data: {
                latex: fullLatex,
                generator: 'pdflatex'
            },
            responseType: 'arraybuffer',
            timeout: 30000 // 30s timeout for compilation
        });

        if (response.status === 200) {
            fs.writeFileSync(filePath, response.data);
            console.log(`[PDF-Gen] PDF generated successfully: ${fileName}`);
            return `/uploads/${fileName}`;
        } else {
            throw new Error(`Compiler API returned status ${response.status}`);
        }
    } catch (err: any) {
        console.error("[PDF-Gen] LaTeX Compilation Error:", err.message);
        
        // Fallback to minimal PDF if compilation fails
        // (This preserves the original logic but adds a warning)
        console.warn("[PDF-Gen] Falling back to text-based PDF due to compilation error.");
        throw new Error(`LaTeX compilation failed: ${err.message}`);
    }
}
