
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type UserRole = "PATIENT" | "DOCTOR" | "ADMIN";

interface SidebarProps {
  role: UserRole;
}

const navigationByRole: Record<
  UserRole,
  { label: string; href: string }[]
> = {
  PATIENT: [
    { label: "Overview", href: "/dashboard" },
    { label: "My Appointments", href: "/appointments" },
    { label: "Find Doctors", href: "/doctors" },
    { label: "Departments", href: "/departments" },
    { label: "Notifications", href: "/notifications" },
  ],

  DOCTOR: [
    { label: "Overview", href: "/dashboard" },
    { label: "Appointments", href: "/appointments" },
    { label: "My Availability", href: "/availability" },
    { label: "Notifications", href: "/notifications" },
  ],

  ADMIN: [
    { label: "Overview", href: "/dashboard" },
    { label: "Appointments", href: "/appointments" },
    { label: "Doctors", href: "/doctors" },
    { label: "Departments", href: "/departments" },
    { label: "Notifications", href: "/notifications" },
  ],
};

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const navigation = navigationByRole[role];

  return (
    <aside className="flex min-h-screen w-64 flex-col bg-primary-dark text-white">
      {/* Application branding */}
      <div className="border-b border-white/10 px-6 py-6">
        <h1 className="text-xl font-bold">
          Healthcare
        </h1>

        <p className="mt-1 text-sm text-slate-300">
          Appointment System
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Main Menu
        </p>

        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(`${item.href}/`));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`block rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-white text-primary-dark"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Account information */}
      <div className="border-t border-white/10 px-6 py-5">
        <p className="text-xs text-slate-400">
          Signed in as
        </p>

        <p className="mt-1 text-sm font-semibold">
          {role}
        </p>
      </div>
    </aside>
  );
}
