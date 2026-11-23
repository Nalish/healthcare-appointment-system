
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Notifications from "@/components/notifications/Notifications";

export default async function NotificationsPage() {
  const session = await auth();

  const userId = session?.user?.id;

  if (!userId) {
    redirect("/signin");
  }

  return <Notifications userId={userId} />;
}
