import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import { CoverLetterResult } from "../ai/agents/cover-letter-generator";
import { TailoredResumeContent } from "../ai/agents/resume-writer";

export class PDFCoverLetterGenerator {
  static generate(
    coverLetter: CoverLetterResult,
    tailoredResume: TailoredResumeContent,
    outputPath: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const doc = new PDFDocument({
          size: "LETTER",
          margins: { top: 40, bottom: 40, left: 45, right: 45 },
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        const header = tailoredResume.header;

        // Name
        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor("#111827")
          .text(header.fullName);

        // Contact info
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#4B5563")
          .text(`${header.email}  |  ${header.phone}  |  ${header.location}`);

        doc.moveDown(0.8);

        // Date
        const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        doc
          .font("Helvetica")
          .fontSize(9.5)
          .fillColor("#374151")
          .text(dateStr);

        doc.moveDown(1);

        // Paragraphs
        const paragraphs = coverLetter.content
          .split("\n\n")
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        paragraphs.forEach((pText) => {
          doc
            .font("Helvetica")
            .fontSize(9.5)
            .fillColor("#1F2937")
            .text(pText, { lineGap: 3.5 });
          doc.moveDown(0.6);
        });

        doc.end();

        stream.on("finish", () => resolve(outputPath));
        stream.on("error", (err) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }
}
