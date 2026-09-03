import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { PortfolioScraper } from "@/lib/portfolio/scraper";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const portfolioUrl = process.env.PORTFOLIO_URL || "https://shashwatsahu-portfolio-website.vercel.app/";
    const data = await PortfolioScraper.fetchAndExtract(portfolioUrl);

    let itemsFound = 0;

    // Process Projects -> Verification Queue
    for (const proj of data.projects) {
      itemsFound++;
      await prisma.verificationQueue.create({
        data: {
          itemType: "project",
          itemData: JSON.stringify(proj),
          source: "portfolio",
          status: "PENDING",
        },
      });
    }

    // Process Experiences -> Verification Queue
    for (const exp of data.experiences) {
      itemsFound++;
      await prisma.verificationQueue.create({
        data: {
          itemType: "experience",
          itemData: JSON.stringify(exp),
          source: "portfolio",
          status: "PENDING",
        },
      });
    }

    // Process Skills -> Verification Queue
    for (const skill of data.skills) {
      itemsFound++;
      await prisma.verificationQueue.create({
        data: {
          itemType: "skill",
          itemData: JSON.stringify(skill),
          source: "portfolio",
          status: "PENDING",
        },
      });
    }

    await prisma.portfolioSync.create({
      data: {
        portfolioUrl,
        status: "COMPLETED",
        extractedData: JSON.stringify(data),
        itemsFound,
      },
    });

    return NextResponse.json({ success: true, itemsFound });
  } catch (error) {
    console.error("Portfolio sync error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Portfolio sync failed" },
      { status: 500 }
    );
  }
}
