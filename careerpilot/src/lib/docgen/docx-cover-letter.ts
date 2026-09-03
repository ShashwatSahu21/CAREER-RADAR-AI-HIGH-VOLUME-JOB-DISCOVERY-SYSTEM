import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  Packer,
  ExternalHyperlink,
} from "docx";
import { CoverLetterResult } from "../ai/agents/cover-letter-generator";
import { TailoredResumeContent } from "../ai/agents/resume-writer";
import * as fs from "fs";
import * as path from "path";

export class DOCXCoverLetterGenerator {
  static async generate(
    coverLetter: CoverLetterResult,
    tailoredResume: TailoredResumeContent,
    outputPath: string,
    fontFamily: string = "Calibri"
  ): Promise<string> {
    const font = fontFamily;
    const header = tailoredResume.header;

    const docChildren: Paragraph[] = [
      // Header Name
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: header.fullName,
            bold: true,
            size: 24, // 12pt
            font,
            color: "111827",
          }),
        ],
      }),

      // Contact Line
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({ text: `${header.email}  |  ${header.phone}  |  ${header.location}`, size: 18, font, color: "4B5563" }),
        ],
        spacing: { after: 200 },
      }),

      // Date
      new Paragraph({
        children: [
          new TextRun({
            text: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
            size: 19,
            font,
            color: "374151",
          }),
        ],
        spacing: { after: 200 },
      }),
    ];

    // Split letter body into clean paragraphs
    const paragraphs = coverLetter.content
      .split("\n\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    paragraphs.forEach((pText) => {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: pText,
              size: 20, // 10pt
              font,
              color: "1F2937",
            }),
          ],
          spacing: { after: 120 },
        })
      );
    });

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720, // 0.5 in
                bottom: 720,
                left: 720,
                right: 720,
              },
            },
          },
          children: docChildren,
        },
      ],
    });

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
  }
}
