import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { PDFResumeGenerator } from "./pdf-resume";
import { PDFCoverLetterGenerator } from "./pdf-cover-letter";

const execAsync = promisify(exec);

export class PDFConverter {
  /**
   * Converts a DOCX file to a PDF file using LibreOffice CLI if available.
   * If LibreOffice CLI is not installed, uses PDFKit to generate native PDF.
   */
  static async convertDocxToPdf(
    docxPath: string,
    pdfOutputPath: string,
    tailoredResumeData?: any,
    coverLetterData?: any
  ): Promise<boolean> {
    const outputDir = path.dirname(pdfOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1. Attempt LibreOffice soffice conversion first if installed
    try {
      const cmd = `soffice --headless --convert-to pdf "${docxPath}" --outdir "${outputDir}"`;
      await execAsync(cmd, { timeout: 15000 });

      const generatedPdfName = path.basename(docxPath, path.extname(docxPath)) + ".pdf";
      const generatedPdfPath = path.join(outputDir, generatedPdfName);

      if (fs.existsSync(generatedPdfPath)) {
        if (generatedPdfPath !== pdfOutputPath) {
          fs.renameSync(generatedPdfPath, pdfOutputPath);
        }
        return true;
      }
    } catch {
      // LibreOffice not installed on system
    }

    // 2. Native PDFKit Generator Fallback
    try {
      if (tailoredResumeData) {
        await PDFResumeGenerator.generate(tailoredResumeData, pdfOutputPath);
        return true;
      } else if (coverLetterData && tailoredResumeData) {
        await PDFCoverLetterGenerator.generate(coverLetterData, tailoredResumeData, pdfOutputPath);
        return true;
      }
    } catch (err) {
      console.error("Native PDFKit generation error:", err);
    }

    return false;
  }
}
