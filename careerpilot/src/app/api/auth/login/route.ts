import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword, hashPassword, createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const isValid = await verifyPassword(password);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // Find or create the default user
    let user = await prisma.user.findFirst();
    if (!user) {
      const hash = await hashPassword(password);
      user = await prisma.user.create({
        data: {
          email: "Shashwatsahu.contact@gmail.com",
          name: "Shashwat Sahu",
          passwordHash: hash,
        },
      });

      // Create default career profile
      await prisma.careerProfile.create({
        data: {
          userId: user.id,
          fullName: "Shashwat Sahu",
          email: "Shashwatsahu.contact@gmail.com",
          linkedinUrl: "https://www.linkedin.com/in/shashwatsahu21",
          githubUrl: "https://github.com/ShashwatSahu21",
          portfolioUrl: "https://shashwatsahu-portfolio-website.vercel.app/",
        },
      });

      // Create default settings
      await prisma.userSettings.create({
        data: { userId: user.id },
      });
    }

    const token = await createSessionToken(user.id);
    await setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
