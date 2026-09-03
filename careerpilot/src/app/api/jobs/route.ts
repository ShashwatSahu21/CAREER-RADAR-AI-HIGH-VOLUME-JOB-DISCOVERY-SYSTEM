import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, company, location, employmentType, description, applicationUrl, source, autoAnalyze } = body;

    if (!title || !company) {
      return NextResponse.json({ error: "Title and company are required" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.job.findFirst({
      where: {
        userId: session.userId,
        title: title,
        company: company,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "This job already exists", id: existing.id }, { status: 409 });
    }

    const job = await prisma.job.create({
      data: {
        userId: session.userId,
        title,
        company,
        location: location || "",
        employmentType: employmentType || "",
        description: description || "",
        applicationUrl: applicationUrl || "",
        source: source || "manual",
        status: "DISCOVERED",
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.userId,
        action: "job_created",
        entity: "job",
        entityId: job.id,
        details: JSON.stringify({ title, company, source, autoAnalyze }),
      },
    });

    // If autoAnalyze is requested, trigger analysis (Phase 2)
    // For now, just mark it for future processing
    if (autoAnalyze) {
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "DISCOVERED" },
      });
    }

    return NextResponse.json({ id: job.id, success: true });
  } catch (error) {
    console.error("Job creation error:", error);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.job.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: { analysis: true, application: true },
  });

  return NextResponse.json(jobs);
}
