"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Upload, 
  Loader2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  FileText, 
  Check, 
  Info,
  RotateCw
} from "lucide-react";

// Rule 5: Prefer clear variable names (e.g., isProcessingFile, rawOcrText, ocrWordSegments)
interface OcrWord {
  text: string;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

export default function DocumentProcessingPage() {
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileMime, setUploadedFileMime] = useState<string | null>(null);
  const [uploadedOriginalName, setUploadedOriginalName] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>("");
  const [ocrWordSegments, setOcrWordSegments] = useState<OcrWord[]>([]);
  const [zoomLevelValue, setZoomLevelValue] = useState<number>(1);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [processingStatusText, setProcessingStatusText] = useState<string>("Ready to upload");

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({ width: 600, height: 850 });

  // Update container dimensions on window resize for correct bounding boxes placement
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setContainerDimensions({ 
            width: width || 600, 
            height: height || (width * 1.41) || 850 
          });
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [uploadedFileUrl]);

  // Handle PDF rendering
  useEffect(() => {
    if (uploadedFileUrl && uploadedFileMime === "application/pdf" && canvasRef.current) {
      renderUploadedPdfOnCanvas(uploadedFileUrl, rotationAngle);
    }
  }, [uploadedFileUrl, uploadedFileMime, zoomLevelValue, rotationAngle]);

  // Trigger floating toast
  const showToastNotification = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Rule 2: Add comments explaining important logic
  // Renders the first page of an uploaded PDF file onto an HTML5 canvas element
  // by dynamically injecting PDF.js from a public CDN link.
  // Combines page.rotate metadata with manual rotation offset.
  const renderUploadedPdfOnCanvas = async (pdfUrl: string, manualAngle = 0) => {
    try {
      setProcessingStatusText("Rendering PDF page...");
      
      const pdfjs = await new Promise<any>((resolve, reject) => {
        if ((window as any).pdfjsLib) {
          resolve((window as any).pdfjsLib);
          return;
        }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
          const loadedLib = (window as any).pdfjsLib;
          loadedLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(loadedLib);
        };
        script.onerror = () => reject(new Error("Failed to load PDF.js script"));
        document.body.appendChild(script);
      });

      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdfDocumentInstance = await loadingTask.promise;
      const firstPage = await pdfDocumentInstance.getPage(1);
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) return;

      // Access the page's original rotation metadata (in degrees)
      const pageRotation = firstPage.rotate || 0;
      // Calculate final target rotation: page rotation + manual rotation offset
      const finalRotation = (pageRotation + manualAngle) % 360;

      // Get initial viewport to compute target scale
      const initialViewport = firstPage.getViewport({ scale: 1, rotation: finalRotation });
      const containerWidth = containerRef.current?.clientWidth || 600;
      const targetScale = (containerWidth / initialViewport.width) * zoomLevelValue;
      
      const viewport = firstPage.getViewport({ scale: targetScale, rotation: finalRotation });
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setContainerDimensions({ width: viewport.width, height: viewport.height });

      const renderContext = {
        canvasContext: canvasContext,
        viewport: viewport
      };
      
      await firstPage.render(renderContext).promise;
      setProcessingStatusText("PDF page rendered");
    } catch (err: any) {
      console.error("PDF rendering error:", err);
      setProcessingStatusText("Failed to render PDF");
    }
  };

  // Dynamically load Tesseract.js script from CDN
  const loadTesseractJs = () => {
    return new Promise<any>((resolve, reject) => {
      if ((window as any).Tesseract) {
        resolve((window as any).Tesseract);
        return;
      }
      // Rule 3: Log each major step
      console.log("[LOG] Injecting Tesseract.js WebAssembly OCR script");
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = () => {
        console.log("[LOG] Tesseract.js WebAssembly OCR script loaded");
        resolve((window as any).Tesseract);
      };
      script.onerror = () => reject(new Error("Failed to load Tesseract.js library"));
      document.body.appendChild(script);
    });
  };

  // Run Tesseract.js client-side OCR on canvas content
  const processDocumentLocally = async (localUrlPath: string, fileMimeType: string, angle = 0) => {
    console.log(`[LOG] processDocumentLocally invoked with rotation angle: ${angle}°`);
    setIsProcessingFile(true);
    setProcessingStatusText("Initializing WebAssembly OCR engine...");

    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas element not initialized in DOM");
      }

      // Step 1: Draw source file to workspace canvas
      if (fileMimeType === "application/pdf") {
        setProcessingStatusText("Rendering PDF to canvas...");
        await renderUploadedPdfOnCanvas(localUrlPath, angle);
      } else {
        setProcessingStatusText("Rendering image to canvas...");
        const imageElement = new Image();
        imageElement.src = localUrlPath;
        await new Promise((resolve, reject) => {
          imageElement.onload = resolve;
          imageElement.onerror = reject;
        });
        
        const canvasContext = canvas.getContext("2d");
        if (canvasContext) {
          // Adjust canvas size based on rotation
          if (angle === 90 || angle === 270) {
            canvas.width = imageElement.naturalHeight;
            canvas.height = imageElement.naturalWidth;
          } else {
            canvas.width = imageElement.naturalWidth;
            canvas.height = imageElement.naturalHeight;
          }
          
          canvasContext.clearRect(0, 0, canvas.width, canvas.height);
          canvasContext.save();
          canvasContext.translate(canvas.width / 2, canvas.height / 2);
          canvasContext.rotate((angle * Math.PI) / 180);
          canvasContext.drawImage(imageElement, -imageElement.naturalWidth / 2, -imageElement.naturalHeight / 2);
          canvasContext.restore();
          
          setContainerDimensions({ width: canvas.width, height: canvas.height });
        }
      }

      // Step 2: Initialize Tesseract OCR Worker and recognize
      setProcessingStatusText("Running local OCR character recognition...");
      const TesseractInstance = await loadTesseractJs();
      const ocrWorker = await TesseractInstance.createWorker("eng");
      
      const { data: { text, lines } } = await ocrWorker.recognize(canvas);
      await ocrWorker.terminate();

      console.log(`[LOG] Local OCR text extracted length: ${text.length}`);
      setRawOcrText(text);
      
      // Save geometries for rendering bounding box outlines (grouping words into column-aware segments similar to PaddleOCR)
      const segments: OcrWord[] = [];
      
      if (lines && Array.isArray(lines)) {
        lines.forEach((line: any) => {
          const words = line.words;
          if (!words || words.length === 0) return;
          
          let currentSegment: OcrWord | null = null;
          
          words.forEach((w: any) => {
            const wBox = w.bbox;
            const wText = w.text.trim();
            if (!wText) return;
            
            const wHeight = wBox.y1 - wBox.y0;
            // Split segments if the horizontal gap is larger than 1.2 times the word height
            const gapThreshold = wHeight * 1.2;
            
            if (!currentSegment) {
              currentSegment = {
                text: wText,
                bbox: { ...wBox }
              };
            } else {
              const gap = wBox.x0 - currentSegment.bbox.x1;
              if (gap > gapThreshold) {
                segments.push(currentSegment);
                currentSegment = {
                  text: wText,
                  bbox: { ...wBox }
                };
              } else {
                currentSegment.text += " " + wText;
                currentSegment.bbox.x1 = wBox.x1;
                currentSegment.bbox.y0 = Math.min(currentSegment.bbox.y0, wBox.y0);
                currentSegment.bbox.y1 = Math.max(currentSegment.bbox.y1, wBox.y1);
              }
            }
          });
          
          if (currentSegment) {
            segments.push(currentSegment);
          }
        });
        setOcrWordSegments(segments);
      } else {
        setOcrWordSegments([]);
      }

      setProcessingStatusText("OCR parsing complete");
      showToastNotification("OCR extraction completed!");
    } catch (err: any) {
      console.error("[LOG] Browser-based OCR failed:", err);
      setProcessingStatusText("OCR failed");
      showToastNotification(`OCR failed: ${err.message}`);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Trigger input selection click
  const triggerFileInputClick = () => {
    fileInputRef.current?.click();
  };

  // Upload handler for target file
  const handleUploadedFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const targetFile = selectedFiles[0];
    if (!targetFile) return;

    // Reset previous OCR results and rotation
    setRawOcrText("");
    setOcrWordSegments([]);
    setRotationAngle(0);
    setUploadedOriginalName(targetFile.name);
    
    const localUrl = URL.createObjectURL(targetFile);
    setUploadedFileUrl(localUrl);
    setUploadedFileMime(targetFile.type);

    await processDocumentLocally(localUrl, targetFile.type, 0);
  };

  // Rotate document handler
  const handleRotateDocument = async () => {
    if (!uploadedFileUrl) return;
    const nextAngle = (rotationAngle + 90) % 360;
    setRotationAngle(nextAngle);
    showToastNotification(`Rotated document to ${nextAngle}°`);
    await processDocumentLocally(uploadedFileUrl, uploadedFileMime || "", nextAngle);
  };

  // Zoom control triggers
  const handleIncreaseZoom = () => setZoomLevelValue(prev => Math.min(prev + 0.15, 2.0));
  const handleDecreaseZoom = () => setZoomLevelValue(prev => Math.max(prev - 0.15, 0.6));
  const handleResetZoomScale = () => setZoomLevelValue(1);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* HEADER COMPONENT */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-teal-400 via-emerald-400 to-indigo-400 bg-clip-text text-transparent">
              Inqora Local Document OCR
            </h1>
            <p className="text-xs text-zinc-400">Client-Side browser Wasm OCR Pipeline</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 flex items-center gap-1.5 border border-zinc-700/50">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse"></span>
            {processingStatusText}
          </span>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadedFileChange}
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
          />
          
          <button
            onClick={triggerFileInputClick}
            disabled={isProcessingFile}
            className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-md shadow-teal-900/10 hover:shadow-teal-500/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isProcessingFile ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing WASM...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Upload PDF or Image</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* TWO-PANEL WORKSPACE GRID */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-10 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-zinc-800/80">
        
        {/* LEFT COLUMN: VISUAL PREVIEW WORKSPACE (60% width) */}
        <section className="lg:col-span-6 flex flex-col bg-zinc-900/40 overflow-hidden">
          {/* Zoom controls bar */}
          <div className="bg-zinc-900/80 border-b border-zinc-800/60 p-3 flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-2 font-mono text-zinc-300">
              <Info className="h-3.5 w-3.5 text-teal-400" />
              <span>{uploadedOriginalName || "No file uploaded"}</span>
            </div>
            
            <div className="flex items-center gap-1.5 bg-zinc-900 px-2 py-1 rounded border border-zinc-850">
              <button 
                onClick={handleDecreaseZoom} 
                title="Zoom Out"
                className="hover:text-zinc-200 p-1 hover:bg-zinc-800 rounded transition cursor-pointer"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono px-1 font-bold min-w-10 text-center text-zinc-300">
                {Math.round(zoomLevelValue * 100)}%
              </span>
              <button 
                onClick={handleIncreaseZoom} 
                title="Zoom In"
                className="hover:text-zinc-200 p-1 hover:bg-zinc-800 rounded transition cursor-pointer"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={handleResetZoomScale} 
                title="Reset Zoom"
                className="hover:text-zinc-200 p-1 hover:bg-zinc-800 rounded transition cursor-pointer ml-1"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button 
                onClick={handleRotateDocument} 
                disabled={!uploadedFileUrl || isProcessingFile}
                title="Rotate 90° Clockwise"
                className="hover:text-zinc-200 p-1 hover:bg-zinc-800 rounded transition cursor-pointer ml-1 border-l border-zinc-800 pl-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Visual Workspace Canvas */}
          <div className="flex-1 overflow-auto p-8 flex justify-center items-start bg-[#0d0d10]">
            <div 
              ref={containerRef}
              className="relative rounded-lg shadow-2xl transition-all duration-200 select-none bg-white origin-top"
              style={{
                transform: `scale(${zoomLevelValue})`,
                width: uploadedFileUrl ? (uploadedFileMime !== "application/pdf" ? "auto" : "600px") : "100%",
                maxWidth: "100%"
              }}
            >
              {/* PDF & Image Canvas (Unconditional, always in DOM to avoid ref crash) */}
              <canvas 
                ref={canvasRef} 
                className="rounded-lg max-w-full"
                style={{ 
                  display: (uploadedFileUrl) ? "block" : "none" 
                }} 
              />

              {/* Upload Drop Zone placeholder when empty */}
              {!uploadedFileUrl && (
                <div 
                  onClick={triggerFileInputClick}
                  className="w-full bg-zinc-900/60 text-zinc-100 border border-dashed border-zinc-800/80 hover:border-zinc-700/80 transition-all rounded-lg p-10 select-none flex flex-col items-center justify-center min-h-[500px] cursor-pointer"
                >
                  <div className="h-16 w-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4 hover:scale-105 transition-transform">
                    <Upload className="h-7 w-7" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-200 mb-2">Upload PDF or Image</h3>
                  <p className="text-xs text-zinc-400 text-center max-w-sm leading-relaxed">
                    Select a document scan from your computer. The characters and bounding boxes will be extracted locally inside your browser via WebAssembly.
                  </p>
                </div>
              )}

              {/* Bounding box outlines layer */}
              {uploadedFileUrl && ocrWordSegments.length > 0 && (
                <div 
                  className="absolute inset-0 z-10 pointer-events-none rounded-lg overflow-hidden"
                  style={{
                    width: `${containerDimensions.width}px`,
                    height: `${containerDimensions.height}px`
                  }}
                >
                  <svg className="w-full h-full absolute inset-0">
                    {ocrWordSegments.map((word, index) => {
                      const box = word.bbox;
                      // Calculate coordinates scaling factor
                      const left = (box.x0 / canvasRef.current!.width) * containerDimensions.width;
                      const top = (box.y0 / canvasRef.current!.height) * containerDimensions.height;
                      const width = ((box.x1 - box.x0) / canvasRef.current!.width) * containerDimensions.width;
                      const height = ((box.y1 - box.y0) / canvasRef.current!.height) * containerDimensions.height;
                      const fontSize = Math.max(Math.round(height * 0.35), 9);

                      return (
                        <g key={index} className="group">
                          <rect
                            x={left}
                            y={top}
                            width={width}
                            height={height}
                            fill="rgba(34, 197, 94, 0.03)"
                            stroke="rgb(0, 222, 0)"
                            strokeWidth={2}
                            className="pointer-events-auto cursor-help"
                          />
                          {/* Text label rendered in pure blue right above the green box (similar to the screenshot) */}
                          <text
                            x={left}
                            y={Math.max(top - Math.max(height * 0.08, 3), fontSize)}
                            fill="rgb(0, 0, 255)"
                            fontSize={`${fontSize}px`}
                            fontWeight="bold"
                            fontFamily="monospace"
                            className="select-none pointer-events-none"
                          >
                            {word.text}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: RAW OCR TEXT DISPLAY PANEL (40% width) */}
        <section className="lg:col-span-4 flex flex-col bg-zinc-900/60 overflow-hidden">
          <div className="bg-zinc-900/90 border-b border-zinc-800/80 p-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-300">Extracted Text Output</h2>
              <p className="text-[10px] text-zinc-500">Raw characters converted locally via browser WASM</p>
            </div>
          </div>

          <div className="flex-1 p-5 overflow-y-auto flex flex-col">
            {rawOcrText ? (
              <textarea
                readOnly
                value={rawOcrText}
                className="w-full flex-1 text-xs font-mono bg-zinc-950/80 text-zinc-200 p-4 rounded-lg border border-zinc-800/80 leading-relaxed focus:outline-none focus:ring-0 resize-none min-h-[400px]"
                placeholder="Extracting text details..."
              />
            ) : (
              <div className="flex-1 border border-dashed border-zinc-800 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                <FileText className="h-8 w-8 text-zinc-700 mb-2" />
                <h4 className="text-xs font-bold text-zinc-400">Waiting for extraction</h4>
                <p className="text-[10px] text-zinc-500 mt-1 max-w-[220px]">
                  Once you upload a document, characters will parse locally and show in this pane.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 border border-zinc-700/80 text-zinc-100 px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 z-50 animate-bounce">
          <Check className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
