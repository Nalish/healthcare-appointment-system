
import { signOut } from "@/auth";

interface HeaderProps {
  name: string;
  role: "PATIENT" | "DOCTOR" | "ADMIN";
}

export default function Header({ name, role }: HeaderProps) {
  async function handleSignOut() {
    "use server";

    await signOut({
      redirectTo: "/",
    });
  }

  return (
    <header className="flex h-20 items-center justify-between border-b border-border bg-white px-8">
      {/* Page heading */}
      <div>
        <h2 className="text-lg font-semibold text-text-primary">
          Healthcare Appointment System
        </h2>

        <p className="text-sm text-text-secondary">
          Manage your healthcare activities
        </p>
      </div>

      {/* User information */}
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-sm font-semibold text-text-primary">
            {name}
          </p>

          <p className="text-xs text-text-secondary">
            {role}
          </p>
        </div>

        <form action={handleSignOut}>
          <button
            type="submit"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-gray-100"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
