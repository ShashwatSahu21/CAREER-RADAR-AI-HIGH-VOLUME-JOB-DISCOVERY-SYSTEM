import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
  AlignmentType,
  BorderStyle,
  Packer,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import { TailoredResumeContent } from "../ai/agents/resume-writer";
import * as fs from "fs";
import * as path from "path";

export interface DocxGeneratorOptions {
  fontFamily?: string;
  fontSizePt?: number;
  marginPt?: number;
}

export class DOCXResumeGenerator {
  /**
   * Renders a clean, single-column, ATS-compliant one-page resume.
   * Features:
   * - No multi-column text boxes
   * - Standard typography (Calibri/Arial)
   * - Hyperlinked header items (LinkedIn, GitHub, Portfolio)
   * - Clickable project links
   * - Hyperlinked publication and portfolio references
   */
  static async generate(
    content: TailoredResumeContent,
    outputPath: string,
    options: DocxGeneratorOptions = {}
  ): Promise<string> {
    const font = options.fontFamily || "Calibri";

    // Build Header Paragraph
    const headerChildren = [
      new TextRun({
        text: content.header.fullName.toUpperCase(),
        bold: true,
        size: 28, // 14pt
        font,
        color: "111827",
      }),
      new Paragraph({ text: "", spacing: { after: 60 } }), // spacer
    ];

    // Contact line with clickable hyperlinks
    const contactLine: (TextRun | ExternalHyperlink)[] = [];

    if (content.header.location) {
      contactLine.push(new TextRun({ text: `${content.header.location}  |  `, size: 18, font, color: "374151" }));
    }
    if (content.header.phone) {
      contactLine.push(new TextRun({ text: `${content.header.phone}  |  `, size: 18, font, color: "374151" }));
    }
    if (content.header.email) {
      contactLine.push(
        new ExternalHyperlink({
          children: [new TextRun({ text: content.header.email, size: 18, font, color: "1D4ED8", underline: {} })],
          link: `mailto:${content.header.email}`,
        })
      );
    }
    if (content.header.linkedinUrl) {
      contactLine.push(new TextRun({ text: "  |  ", size: 18, font, color: "374151" }));
      contactLine.push(
        new ExternalHyperlink({
          children: [new TextRun({ text: "LinkedIn", size: 18, font, color: "1D4ED8", underline: {} })],
          link: content.header.linkedinUrl,
        })
      );
    }
    if (content.header.githubUrl) {
      contactLine.push(new TextRun({ text: "  |  ", size: 18, font, color: "374151" }));
      contactLine.push(
        new ExternalHyperlink({
          children: [new TextRun({ text: "GitHub", size: 18, font, color: "1D4ED8", underline: {} })],
          link: content.header.githubUrl,
        })
      );
    }
    if (content.header.portfolioUrl) {
      contactLine.push(new TextRun({ text: "  |  ", size: 18, font, color: "374151" }));
      contactLine.push(
        new ExternalHyperlink({
          children: [new TextRun({ text: "Portfolio", size: 18, font, color: "1D4ED8", underline: {} })],
          link: content.header.portfolioUrl,
        })
      );
    }

    const docChildren: any[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: content.header.fullName.toUpperCase(),
            bold: true,
            size: 28,
            font,
            color: "111827",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: contactLine,
        spacing: { after: 140 },
      }),
    ];

    // Helper: Section Heading
    const addSectionHeader = (title: string) => {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: title.toUpperCase(),
              bold: true,
              size: 20, // 10pt
              font,
              color: "1F2937",
            }),
          ],
          border: {
            bottom: { color: "9CA3AF", space: 2, style: BorderStyle.SINGLE, size: 6 },
          },
          spacing: { before: 140, after: 80 },
        })
      );
    };

    // 1. Education Section
    if (content.education && content.education.length > 0) {
      addSectionHeader("Education");
      content.education.forEach((edu) => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: edu.university, bold: true, size: 19, font, color: "111827" }),
              new TextRun({ text: `  —  ${edu.degree}${edu.specialization && edu.specialization !== edu.degree ? ` in ${edu.specialization}` : ""}`, size: 19, font, color: "374151" }),
              new TextRun({ text: `  (${edu.graduationDate || "2027"})`, size: 18, font, color: "6B7280" }),
              edu.cgpa ? new TextRun({ text: `  |  CGPA: ${edu.cgpa}`, bold: true, size: 18, font, color: "111827" }) : new TextRun({ text: "" }),
            ],
            spacing: { after: 40 },
          })
        );
      });
    }

    // 2. Projects Section
    if (content.projects && content.projects.length > 0) {
      addSectionHeader("Key Technical Projects");
      content.projects.forEach((proj) => {
        const projHeaderRun: (TextRun | ExternalHyperlink)[] = [
          new TextRun({ text: proj.projectName, bold: true, size: 19, font, color: "111827" }),
        ];

        if (proj.technologies && proj.technologies.length > 0) {
          projHeaderRun.push(
            new TextRun({ text: `  [${proj.technologies.slice(0, 5).join(", ")}]`, size: 17, font, color: "4B5563" })
          );
        }

        if (proj.githubUrl) {
          projHeaderRun.push(new TextRun({ text: "  |  ", size: 17, font, color: "6B7280" }));
          projHeaderRun.push(
            new ExternalHyperlink({
              children: [new TextRun({ text: "Code", size: 17, font, color: "1D4ED8", underline: {} })],
              link: proj.githubUrl,
            })
          );
        }

        docChildren.push(
          new Paragraph({
            children: projHeaderRun,
            spacing: { before: 60, after: 30 },
          })
        );

        proj.bullets.forEach((b) => {
          docChildren.push(
            new Paragraph({
              text: `•  ${b.generated_bullet}`,
              bullet: { level: 0 },
              style: "ListParagraph",
              spacing: { after: 20 },
            })
          );
        });
      });
    }

    // 3. Work Experience Section
    if (content.experiences && content.experiences.length > 0) {
      addSectionHeader("Work & Leadership Experience");
      content.experiences.forEach((exp) => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: exp.role, bold: true, size: 19, font, color: "111827" }),
              new TextRun({ text: `  —  ${exp.company}`, size: 19, font, color: "374151" }),
              new TextRun({ text: `  (${exp.startDate} – ${exp.endDate})`, size: 17, font, color: "6B7280" }),
            ],
            spacing: { before: 60, after: 30 },
          })
        );

        exp.bullets.forEach((b) => {
          docChildren.push(
            new Paragraph({
              text: `•  ${b.generated_bullet}`,
              bullet: { level: 0 },
              style: "ListParagraph",
              spacing: { after: 20 },
            })
          );
        });
      });
    }

    // 4. Skills & Competencies
    if (content.skills && content.skills.length > 0) {
      addSectionHeader("Technical Skills & Competencies");
      content.skills.forEach((skillCat) => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${skillCat.category}: `, bold: true, size: 18, font, color: "111827" }),
              new TextRun({ text: skillCat.items.join(", "), size: 18, font, color: "374151" }),
            ],
            spacing: { after: 30 },
          })
        );
      });
    }

    // 5. Achievements
    if (content.achievements && content.achievements.length > 0) {
      addSectionHeader("Achievements & Certifications");
      content.achievements.forEach((ach) => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `•  ${ach.title}`, bold: true, size: 18, font, color: "111827" }),
              ach.organization ? new TextRun({ text: ` (${ach.organization})`, size: 18, font, color: "4B5563" }) : new TextRun({ text: "" }),
              ach.description ? new TextRun({ text: `: ${ach.description}`, size: 18, font, color: "374151" }) : new TextRun({ text: "" }),
            ],
            spacing: { after: 20 },
          })
        );
      });
    }

    // Create Document with standard Letter / 0.5in margins
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 500, // ~0.35 in
                bottom: 500,
                left: 500,
                right: 500,
              },
            },
          },
          children: docChildren,
        },
      ],
    });

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
  }
}
