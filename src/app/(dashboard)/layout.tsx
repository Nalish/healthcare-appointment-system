
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export const instant = false;

type UserRole = "PATIENT" | "DOCTOR" | "ADMIN";

const validRoles: UserRole[] = [
  "PATIENT",
  "DOCTOR",
  "ADMIN",
];

// Handles authentication and dashboard rendering
async function AuthenticatedDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  // Retrieve authenticated session
  const session = await auth();

  // Redirect unauthenticated users
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  // Validate user role
  const role = session.user.role;

  if (!validRoles.includes(role)) {
    redirect("/api/auth/signin");
  }

  // Get user's display name
  const name =
    session.user.name ||
    session.user.email ||
    "User";

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header name={name} role={role} />

        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

// Shared dashboard layout
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-text-secondary">
            Loading dashboard...
          </p>
        </div>
      }
    >
      <AuthenticatedDashboard>
        {children}
      </AuthenticatedDashboard>
    </Suspense>
  );
}
