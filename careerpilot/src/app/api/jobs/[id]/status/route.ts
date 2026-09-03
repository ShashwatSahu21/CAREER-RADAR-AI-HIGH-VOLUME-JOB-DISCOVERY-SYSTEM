import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { status } = await req.json();

    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job || job.userId !== session.userId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const updated = await prisma.job.update({
      where: { id },
      data: { status },
    });

    // Update Application tracking table as well
    await prisma.application.upsert({
      where: { jobId: id },
      update: { status },
      create: {
        jobId: id,
        userId: session.userId,
        status,
      },
    });

    return NextResponse.json({ success: true, job: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
