
"use client";

import { useEffect, useState } from "react";

type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  reason: string | null;
  doctor: {
    id: string;
    user: {
      fullName: string;
    };
    department: {
      name: string;
    };
  };
}

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const response = await fetch("/api/appointments", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to retrieve appointments.");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid appointment data received.");
        }

        setAppointments(data);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchAppointments();
  }, []);

  // Calculate appointment statistics
  const now = new Date();

  const upcomingAppointments = appointments
    .filter(
      (appointment) =>
        new Date(appointment.startTime) > now &&
        appointment.status !== "CANCELLED" &&
        appointment.status !== "COMPLETED"
    )
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() -
        new Date(b.startTime).getTime()
    );

  const pendingAppointments = appointments.filter(
    (appointment) => appointment.status === "PENDING"
  );

  const confirmedAppointments = appointments.filter(
    (appointment) => appointment.status === "CONFIRMED"
  );

  // Format appointment date
  function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  }

  // Format appointment time
  function formatTime(date: string) {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(date));
  }

  function getStatusStyles(status: AppointmentStatus) {
    switch (status) {
      case "CONFIRMED":
        return "bg-green-100 text-green-700";

      case "PENDING":
        return "bg-yellow-100 text-yellow-700";

      case "CANCELLED":
        return "bg-red-100 text-red-700";

      case "COMPLETED":
        return "bg-gray-100 text-gray-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  }

  return (
    <div className="space-y-8">

      {/* Welcome section */}
      <section>
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome to Your Dashboard
        </h1>

        <p className="mt-2 text-text-secondary">
          Keep track of your appointments and healthcare activities.
        </p>
      </section>

      {/* Statistics */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">

        <div className="rounded-xl border border-border bg-white p-6">
          <p className="text-sm text-text-secondary">
            Total Appointments
          </p>
          <p className="mt-3 text-3xl font-bold text-primary">
            {appointments.length}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white p-6">
          <p className="text-sm text-text-secondary">
            Upcoming Appointments
          </p>
          <p className="mt-3 text-3xl font-bold text-primary">
            {upcomingAppointments.length}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white p-6">
          <p className="text-sm text-text-secondary">
            Pending Appointments
          </p>
          <p className="mt-3 text-3xl font-bold text-warning">
            {pendingAppointments.length}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-white p-6">
          <p className="text-sm text-text-secondary">
            Confirmed Appointments
          </p>
          <p className="mt-3 text-3xl font-bold text-success">
            {confirmedAppointments.length}
          </p>
        </div>

      </section>

      {/* Upcoming appointments */}
      <section className="rounded-xl border border-border bg-white">

        <div className="border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold text-text-primary">
            Upcoming Appointments
          </h2>

          <p className="mt-1 text-sm text-text-secondary">
            Your scheduled consultations.
          </p>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-text-secondary">
            Loading appointments...
          </p>
        ) : error ? (
          <p className="p-6 text-sm text-danger">
            {error}
          </p>
        ) : upcomingAppointments.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">
            You don't have any upcoming appointments.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">

              <thead className="bg-gray-50 text-text-secondary">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Time</th>
                  <th className="px-6 py-4 font-medium">Doctor</th>
                  <th className="px-6 py-4 font-medium">Department</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {upcomingAppointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td className="px-6 py-4">
                      {formatDate(appointment.startTime)}
                    </td>

                    <td className="px-6 py-4">
                      {formatTime(appointment.startTime)}
                    </td>

                    <td className="px-6 py-4 font-medium text-text-primary">
                      {appointment.doctor.user.fullName}
                    </td>

                    <td className="px-6 py-4">
                      {appointment.doctor.department.name}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusStyles(
                          appointment.status
                        )}`}
                      >
                        {appointment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}

      </section>

    </div>
  );
}
