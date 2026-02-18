import mammoth from "mammoth";
import Tesseract from "tesseract.js";

export const extractTextFromFile = async (file: File): Promise<string> => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return "";

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (ext === "pdf") {
    // Dynamic import for ESM pdf module
    const pdfModule = await import("pdf-parse"); 
    // pdf function is exported directly (not default)
    //@ts-expect-error
    const pdfFn = pdfModule.pdf ?? pdfModule.PDFParse ?? pdfModule; 
    const pdfData = await pdfFn(buffer);
    return pdfData.text;
  }

  if (ext === "docx" || ext === "doc") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (["png", "jpg", "jpeg"].includes(ext)) {
    const result = await Tesseract.recognize(buffer, "eng");
    return result.data.text;
  }

  return "";
};