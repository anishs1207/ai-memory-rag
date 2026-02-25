import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export async function generateResearchPDF(topic: string, content: string, fileName: string): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const uploadsDir = path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            const filePath = path.join(uploadsDir, fileName);
            const stream = fs.createWriteStream(filePath);

            doc.pipe(stream);

            // Title
            doc.fontSize(24).font('Helvetica-Bold').text('Research Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(18).font('Helvetica').text(topic, { align: 'center' });
            doc.moveDown(2);

            // Date
            doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'right' });
            doc.moveDown(2);

            // Content
            // Clean up content if it contains LaTeX markers as we are doing plain text PDF for now
            const cleanContent = content
                .replace(/\\section\*?\{([^}]+)\}/g, '\n\n$1\n' + '-'.repeat(10))
                .replace(/\\subsection\*?\{([^}]+)\}/g, '\n\n$1')
                .replace(/\\textbf\{([^}]+)\}/g, '$1')
                .replace(/\\textit\{([^}]+)\}/g, '$1')
                .replace(/\\begin\{abstract\}/g, 'ABSTRACT\n' + '-'.repeat(10))
                .replace(/\\end\{abstract\}/g, '\n')
                .replace(/\\begin\{document\}/g, '')
                .replace(/\\end\{document\}/g, '')
                .replace(/\\maketitle/g, '')
                .replace(/\\documentclass\[.*\]\{.*\}/g, '')
                .replace(/\\usepackage\{.*\}/g, '')
                .replace(/\\author\{.*\}/g, '')
                .replace(/\\title\{.*\}/g, '')
                .replace(/\\date\{.*\}/g, '');

            doc.fontSize(12).font('Helvetica').text(cleanContent, {
                align: 'justify',
                paragraphGap: 10
            });

            doc.end();

            stream.on('finish', () => {
                resolve(`/uploads/${fileName}`);
            });

            stream.on('error', (err) => {
                reject(err);
            });
        } catch (err) {
            reject(err);
        }
    });
}
