import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let settings = await prisma.userSettings.findUnique({
    where: { userId: session.userId },
  });

  if (!settings) {
    settings = await prisma.userSettings.create({
      data: { userId: session.userId },
    });
  }

  return <SettingsClient settings={settings} />;
}
