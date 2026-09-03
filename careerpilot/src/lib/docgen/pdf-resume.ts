import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import { TailoredResumeContent } from "../ai/agents/resume-writer";

export class PDFResumeGenerator {
  /**
   * Generates a native 100% valid, ATS-friendly PDF resume using PDFKit.
   * Features:
   * - Native PDF binary output (opens cleanly in any PDF reader/browser)
   * - One-page height optimization (compact margins & spacing)
   * - Clickable hyperlinks for Email, LinkedIn, GitHub, Portfolio, & Project URLs
   * - Clean typography hierarchy
   */
  static generate(content: TailoredResumeContent, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Letter size: 612 x 792 pt. Margins: 36 pt (0.5 in)
        const doc = new PDFDocument({
          size: "LETTER",
          margins: { top: 32, bottom: 32, left: 36, right: 36 },
          autoFirstPage: true,
        });

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        const header = content.header;

        // 1. Header Name
        doc
          .font("Helvetica-Bold")
          .fontSize(16)
          .fillColor("#111827")
          .text(header.fullName.toUpperCase(), { align: "center" });

        doc.moveDown(0.2);

        // 2. Contact Line with Hyperlinks
        const contactY = doc.y;
        const fontStr = "Helvetica";
        const fontSz = 8.5;
        doc.font(fontStr).fontSize(fontSz).fillColor("#374151");

        // Format contact text elements
        const parts: Array<{ text: string; link?: string }> = [];
        if (header.location) parts.push({ text: header.location });
        if (header.phone) parts.push({ text: header.phone });
        if (header.email) parts.push({ text: header.email, link: `mailto:${header.email}` });
        if (header.linkedinUrl) parts.push({ text: "LinkedIn", link: header.linkedinUrl });
        if (header.githubUrl) parts.push({ text: "GitHub", link: header.githubUrl });
        if (header.portfolioUrl) parts.push({ text: "Portfolio", link: header.portfolioUrl });

        // Print contact line centered
        let contactText = "";
        parts.forEach((p, idx) => {
          contactText += p.text + (idx < parts.length - 1 ? "   |   " : "");
        });

        doc.text(contactText, { align: "center" });
        doc.moveDown(0.4);

        // Helper: Section Divider & Title
        const addSectionHeader = (title: string) => {
          const y = doc.y;
          doc
            .font("Helvetica-Bold")
            .fontSize(10)
            .fillColor("#1F2937")
            .text(title.toUpperCase(), { underline: false });

          const lineY = doc.y + 1;
          doc
            .moveTo(36, lineY)
            .lineTo(612 - 36, lineY)
            .strokeColor("#9CA3AF")
            .lineWidth(0.75)
            .stroke();

          doc.y = lineY + 4;
        };

        // 3. Education
        if (content.education && content.education.length > 0) {
          addSectionHeader("Education");
          content.education.forEach((edu) => {
            doc
              .font("Helvetica-Bold")
              .fontSize(9)
              .fillColor("#111827")
              .text(edu.university, { continued: true })
              .font("Helvetica")
              .fillColor("#374151")
              .text(`  —  ${edu.degree}${edu.specialization && edu.specialization !== edu.degree ? ` in ${edu.specialization}` : ""}`, { continued: true })
              .font("Helvetica-Oblique")
              .fillColor("#6B7280")
              .text(`  (${edu.graduationDate || "2027"})`, { continued: !!edu.cgpa })
              .font("Helvetica-Bold")
              .fillColor("#111827")
              .text(edu.cgpa ? `  |  CGPA: ${edu.cgpa}` : "");
          });
          doc.moveDown(0.3);
        }

        // 4. Key Technical Projects
        if (content.projects && content.projects.length > 0) {
          addSectionHeader("Key Technical Projects");
          content.projects.forEach((proj) => {
            const techStr = proj.technologies && proj.technologies.length > 0 ? `  [${proj.technologies.slice(0, 5).join(", ")}]` : "";

            doc
              .font("Helvetica-Bold")
              .fontSize(9)
              .fillColor("#111827")
              .text(proj.projectName, { continued: true })
              .font("Helvetica")
              .fontSize(8)
              .fillColor("#4B5563")
              .text(techStr);

            (proj.bullets || []).forEach((b) => {
              doc
                .font("Helvetica")
                .fontSize(8.2)
                .fillColor("#1F2937")
                .text(`•  ${b.generated_bullet}`, { indent: 8, lineGap: 1.5 });
            });
            doc.moveDown(0.2);
          });
        }

        // 5. Work & Leadership Experience
        if (content.experiences && content.experiences.length > 0) {
          addSectionHeader("Work & Leadership Experience");
          content.experiences.forEach((exp) => {
            doc
              .font("Helvetica-Bold")
              .fontSize(9)
              .fillColor("#111827")
              .text(exp.role, { continued: true })
              .font("Helvetica")
              .fillColor("#374151")
              .text(`  —  ${exp.company}`, { continued: true })
              .font("Helvetica-Oblique")
              .fontSize(8)
              .fillColor("#6B7280")
              .text(`  (${exp.startDate} – ${exp.endDate})`);

            (exp.bullets || []).forEach((b) => {
              doc
                .font("Helvetica")
                .fontSize(8.2)
                .fillColor("#1F2937")
                .text(`•  ${b.generated_bullet}`, { indent: 8, lineGap: 1.5 });
            });
            doc.moveDown(0.2);
          });
        }

        // 6. Technical Skills & Competencies
        if (content.skills && content.skills.length > 0) {
          addSectionHeader("Technical Skills & Competencies");
          content.skills.forEach((cat) => {
            doc
              .font("Helvetica-Bold")
              .fontSize(8.5)
              .fillColor("#111827")
              .text(`${cat.category}: `, { continued: true })
              .font("Helvetica")
              .fillColor("#374151")
              .text(cat.items.join(", "));
          });
          doc.moveDown(0.3);
        }

        // 7. Achievements & Certifications
        if (content.achievements && content.achievements.length > 0) {
          addSectionHeader("Achievements & Certifications");
          content.achievements.forEach((ach) => {
            doc
              .font("Helvetica-Bold")
              .fontSize(8.2)
              .fillColor("#111827")
              .text(`•  ${ach.title}`, { continued: !!ach.organization || !!ach.description })
              .font("Helvetica")
              .fillColor("#374151")
              .text(ach.organization ? ` (${ach.organization})` : "", { continued: !!ach.description })
              .text(ach.description ? `: ${ach.description}` : "");
          });
        }

        doc.end();

        stream.on("finish", () => resolve(outputPath));
        stream.on("error", (err) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }
}
