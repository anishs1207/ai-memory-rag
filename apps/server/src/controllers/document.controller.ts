import type { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { parseResult } from "@/utils/index.js";

// Rule 5: Prefer clear variable names over short ones (e.g., databaseFilePath, processedDocuments)
const uploadsDirectoryPath = path.join(process.cwd(), "uploads");
const databaseFilePath = path.join(uploadsDirectoryPath, "processed_documents.json");

// Ensure uploads folder and database file exist
if (!fs.existsSync(uploadsDirectoryPath)) {
  fs.mkdirSync(uploadsDirectoryPath, { recursive: true });
}
if (!fs.existsSync(databaseFilePath)) {
  fs.writeFileSync(databaseFilePath, JSON.stringify([], null, 2));
}

export const processDocument = async (req: Request, res: Response) => {
  // Rule 3: Log each major step
  console.log("[LOG] processDocument controller invoked");

  try {
    if (!req.file) {
      console.log("[LOG] Error: No file uploaded");
      return res.status(400).json({ success: false, error: "No document file uploaded" });
    }

    const uploadedFileName = req.file.filename;
    const uploadedOriginalName = req.file.originalname;
    const uploadedFilePath = req.file.path;
    const fileExtension = path.extname(uploadedOriginalName).toLowerCase();
    
    console.log(`[LOG] File uploaded successfully: ${uploadedOriginalName} (Saved as: ${uploadedFileName})`);

    // Determine MIME type for Gemini
    let fileMimeType = "application/octet-stream";
    if (fileExtension === ".pdf") {
      fileMimeType = "application/pdf";
    } else if (fileExtension === ".png") {
      fileMimeType = "image/png";
    } else if (fileExtension === ".jpg" || fileExtension === ".jpeg") {
      fileMimeType = "image/jpeg";
    }

    console.log(`[LOG] Detected MIME Type: ${fileMimeType}`);

    // Rule 2: Add comments explaining important logic
    // We read the file content as a base64 string. Gemini API's inlineData
    // accepts this base64 structure to analyze PDF and image layouts.
    const fileBuffer = fs.readFileSync(uploadedFilePath);
    const base64FileContent = fileBuffer.toString("base64");

    // Initialize Gemini SDK client
    console.log("[LOG] Initializing GoogleGenAI client");
    const googleGenAIClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

    // Construct the extraction prompt with detailed layout instructions
    const extractionSystemPrompt = `
      You are an expert Intelligent Document Processing (IDP) agent. 
      Analyze the attached document and perform OCR text extraction, layout parsing, and field detection.
      
      Extract the following information if present:
      - Document Type (e.g. "Patient Intake Form", "Medical Invoice", "Prescription", "Receipt", "Other")
      - Provider / Organization Name (e.g. doctor, hospital, shop)
      - Document Date / Date of Service
      - Patient / Customer Name
      - Date of Birth (DOB)
      - Contact Info (Phone or Email)
      - Address
      - Record / Invoice Number (if invoice)
      - Total Amount (if invoice)
      
      Additionally, check if the document contains a table of line items (e.g., list of medications, medical services, purchased items). If so, extract the rows.

      CRITICAL INSTRUCTION FOR BOUNDING BOXES:
      For each extracted field and table row, find its bounding box coordinates on the first page of the document.
      The bounding box coordinates MUST be normalized to a 0-1000 scale.
      Format: [ymin, xmin, ymax, xmax] where:
      - ymin: Distance from top edge (0 to 1000)
      - xmin: Distance from left edge (0 to 1000)
      - ymax: Distance from top edge to box bottom (0 to 1000)
      - xmax: Distance from left edge to box right (0 to 1000)
      Example: If a name is in the middle of the page, its bounding box might be [350, 150, 390, 480].
      
      If a field cannot be found, omit its bounding box (set to null) and set the value to empty string or null.
      
      For each field, estimate your confidence score (between 0.00 and 1.00).

      You MUST respond ONLY with a JSON object conforming strictly to this structure:
      {
        "documentType": "string",
        "fields": [
          {
            "id": "patientName", 
            "label": "Patient Name",
            "value": "Emily Rose Carter",
            "confidence": 0.98,
            "bbox": [ymin, xmin, ymax, xmax]
          },
          {
            "id": "dob",
            "label": "Date of Birth",
            "value": "14/03/1992",
            "confidence": 0.95,
            "bbox": [ymin, xmin, ymax, xmax]
          },
          ... other fields ...
        ],
        "tables": [
          {
            "id": "lineItems",
            "label": "Line Items",
            "headers": ["Description", "Qty", "Unit Price", "Total"],
            "rows": [
              {
                "description": "Amoxicillin 500mg",
                "quantity": "2",
                "unitPrice": "$15.00",
                "total": "$30.00",
                "bbox": [ymin, xmin, ymax, xmax]
              }
            ]
          }
        ]
      }
      
      Ensure you only output valid JSON. Do not include markdown codeblocks or text outside the JSON.
    `;

    console.log("[LOG] Calling Gemini 2.5 Flash API for layout understanding...");
    const aiResponse = await googleGenAIClient.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: fileMimeType,
                data: base64FileContent,
              },
            },
            {
              text: extractionSystemPrompt,
            },
          ],
        },
      ],
    });

    console.log("[LOG] Gemini content generation completed");

    // Parse the JSON response returned by Gemini
    const parsedDocumentData = parseResult(aiResponse);
    console.log("[LOG] Successfully parsed document content from Gemini");

    // Construct backend response payload
    const responsePayload = {
      id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fileName: uploadedOriginalName,
      filePath: `/uploads/${uploadedFileName}`,
      mimeType: fileMimeType,
      extraction: parsedDocumentData,
    };

    console.log("[LOG] Returning extracted results to client");
    return res.status(200).json({
      success: true,
      data: responsePayload,
    });

  } catch (error: any) {
    console.error("[LOG] Error processing document:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to process document with Gemini OCR",
    });
  }
};

export const saveExtractedData = async (req: Request, res: Response) => {
  // Rule 3: Log each major step
  console.log("[LOG] saveExtractedData controller invoked");

  try {
    const documentBodyData = req.body;
    if (!documentBodyData || !documentBodyData.id) {
      console.log("[LOG] Error: Missing document body data or ID");
      return res.status(400).json({ success: false, error: "Invalid document data to save" });
    }

    console.log(`[LOG] Saving verified document ID: ${documentBodyData.id}`);

    // Read existing database file
    let documentsList = [];
    if (fs.existsSync(databaseFilePath)) {
      const dbContent = fs.readFileSync(databaseFilePath, "utf-8");
      documentsList = JSON.parse(dbContent);
    }

    // Filter out existing record if it was already saved, then append new one
    documentsList = documentsList.filter((doc: any) => doc.id !== documentBodyData.id);
    documentsList.push({
      ...documentBodyData,
      savedAt: new Date().toISOString(),
    });

    // Write back to the mock database file
    fs.writeFileSync(databaseFilePath, JSON.stringify(documentsList, null, 2));
    console.log(`[LOG] Successfully saved document data to ${databaseFilePath}`);

    return res.status(200).json({
      success: true,
      message: "Document data saved successfully",
    });
  } catch (error: any) {
    console.error("[LOG] Error saving document data:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to save document data",
    });
  }
};
