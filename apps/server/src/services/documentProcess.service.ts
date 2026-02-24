import mammoth from "mammoth";
import Tesseract from "tesseract.js";

export const extractTextFromFile = async (file: File): Promise<string> => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return "";

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (ext === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    await parser.destroy();
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