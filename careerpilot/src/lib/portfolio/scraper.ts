import * as cheerio from "cheerio";

export interface PortfolioExtractedData {
  projects: Array<{
    projectName: string;
    description: string;
    technologies: string[];
    githubUrl?: string;
    demoUrl?: string;
    bullets: string[];
  }>;
  experiences: Array<{
    company: string;
    role: string;
    period: string;
    description: string;
  }>;
  skills: Array<{ name: string; category: string; percent?: string }>;
}

export class PortfolioScraper {
  static async fetchAndExtract(portfolioUrl: string = "https://shashwatsahu-portfolio-website.vercel.app/"): Promise<PortfolioExtractedData> {
    const res = await fetch(portfolioUrl, { headers: { "User-Agent": "CareerPilot-AI/1.0" } });
    if (!res.ok) {
      throw new Error(`Failed to fetch portfolio (${res.status}): ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const projects: PortfolioExtractedData["projects"] = [];
    const experiences: PortfolioExtractedData["experiences"] = [];
    const skills: PortfolioExtractedData["skills"] = [];

    // Extract Projects from cards
    $(".project-side-card").each((_, el) => {
      const title = $(el).find(".project-side-title").text().trim();
      const techBadgeList: string[] = [];
      $(el).find(".tech-badge").each((_, b) => {
        techBadgeList.push($(b).text().trim());
      });

      const bullets: string[] = [];
      $(el).find("ul li").each((_, li) => {
        bullets.push($(li).text().trim());
      });

      const githubUrl = $(el).find('a[href*="github.com"]').attr("href");
      const demoUrl = $(el).find('a[href*="linkedin.com"], a[href*="vercel.app"]').attr("href");

      if (title) {
        projects.push({
          projectName: title,
          description: bullets.slice(0, 2).join(" ") || title,
          technologies: techBadgeList.filter(Boolean),
          githubUrl,
          demoUrl,
          bullets,
        });
      }
    });

    // Extract Milestones / Experiences
    $(".milestone-card").each((_, el) => {
      const title = $(el).find(".milestone-title").text().trim();
      const company = $(el).find(".milestone-company").text().trim();
      const period = $(el).find(".milestone-year").text().trim();
      const desc = $(el).find(".milestone-desc").text().trim();

      if (title || company) {
        experiences.push({
          role: title,
          company: company.replace("📜 Certificate", "").replace("📄 Offer Letter", "").trim(),
          period,
          description: desc,
        });
      }
    });

    // Extract Skills
    $(".skill-item").each((_, el) => {
      const name = $(el).find(".skill-name").text().trim();
      const val = $(el).find(".skill-val").text().trim();
      const categoryHeader = $(el).closest(".skill-card").find("h3").text().trim().replace(/[\[\]]/g, "");

      if (name) {
        skills.push({
          name,
          category: categoryHeader || "General",
          percent: val,
        });
      }
    });

    return { projects, experiences, skills };
  }
}
