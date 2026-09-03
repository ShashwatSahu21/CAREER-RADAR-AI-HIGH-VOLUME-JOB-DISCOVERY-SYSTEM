import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Webhook endpoint for Career Radar job discovery system.
 * Receives jobs discovered by the Python automation.
 * 
 * POST /api/jobs/import
 * 
 * Payload:
 * {
 *   "jobs": [
 *     {
 *       "job_title": "",
 *       "company": "",
 *       "location": "",
 *       "job_description": "",
 *       "application_url": "",
 *       "source": "",
 *       "date_found": "",
 *       "score": 0,
 *       "tier": ""
 *     }
 *   ]
 * }
 * 
 * Or single job:
 * {
 *   "job_title": "",
 *   "company": "",
 *   ...
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret if configured
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret) {
      const authHeader = req.headers.get("authorization");
      if (authHeader !== `Bearer ${webhookSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();

    // Find the default user
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json(
        { error: "No user configured. Please log in to CareerPilot AI first." },
        { status: 400 }
      );
    }

    // Handle both single job and batch
    const jobsPayload = body.jobs || [body];
    const results: Array<{ title: string; company: string; status: string; id?: string }> = [];

    for (const payload of jobsPayload) {
      const title = payload.job_title || payload.title || "";
      const company = payload.company || "";

      if (!title || !company) {
        results.push({ title, company, status: "skipped_missing_fields" });
        continue;
      }

      // Check for duplicate
      const existing = await prisma.job.findFirst({
        where: {
          userId: user.id,
          title,
          company,
        },
      });

      if (existing) {
        results.push({ title, company, status: "duplicate", id: existing.id });
        continue;
      }

      const job = await prisma.job.create({
        data: {
          userId: user.id,
          title,
          company,
          location: payload.location || "",
          description: payload.job_description || payload.description || "",
          applicationUrl: payload.application_url || payload.apply_link || "",
          source: payload.source || "career_radar",
          sourceJobId: payload.job_id || "",
          status: "DISCOVERED",
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "job_imported",
          entity: "job",
          entityId: job.id,
          details: JSON.stringify({
            source: payload.source,
            score: payload.score,
            tier: payload.tier,
          }),
        },
      });

      results.push({ title, company, status: "created", id: job.id });
    }

    const created = results.filter((r) => r.status === "created").length;
    const duplicates = results.filter((r) => r.status === "duplicate").length;
    const skipped = results.filter((r) => r.status === "skipped_missing_fields").length;

    return NextResponse.json({
      success: true,
      summary: { created, duplicates, skipped, total: results.length },
      results,
    });
  } catch (error) {
    console.error("Webhook import error:", error);
    return NextResponse.json(
      { error: "Failed to import jobs" },
      { status: 500 }
    );
  }
}
