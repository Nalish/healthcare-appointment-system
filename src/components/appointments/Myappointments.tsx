
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

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Fetch the authenticated patient's appointments
  useEffect(() => {
    async function fetchAppointments() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/appointments");

        if (!response.ok) {
          throw new Error("Failed to retrieve appointments.");
        }

        const data: Appointment[] = await response.json();

        setAppointments(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchAppointments();
  }, []);

  // Format appointment date
  function formatDate(date: string) {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  }

  // Format appointment time
  function formatTime(date: string) {
    return new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(date));
  }

  // Determine status styling
  function getStatusStyle(status: AppointmentStatus) {
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

  // Cancel an appointment using the existing PATCH endpoint
  async function handleCancel(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to cancel this appointment?"
    );

    if (!confirmed) return;

    try {
      setCancellingId(id);
      setError("");

      const response = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "CANCELLED",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to cancel appointment."
        );
      }

      // Update the appointment immediately in the UI
      setAppointments((previousAppointments) =>
        previousAppointments.map((appointment) =>
          appointment.id === id
            ? { ...appointment, status: "CANCELLED" }
            : appointment
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setCancellingId(null);
    }
  }

  // Appointment statistics
  const totalAppointments = appointments.length;

  const upcomingAppointments = appointments.filter(
    (appointment) =>
      new Date(appointment.startTime) > new Date() &&
      ["PENDING", "CONFIRMED"].includes(appointment.status)
  ).length;

  const pendingAppointments = appointments.filter(
    (appointment) => appointment.status === "PENDING"
  ).length;

  return (
    <div className="space-y-8">

      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          My Appointments
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          View and manage your hospital appointments.
        </p>
      </div>

      {/* Appointment statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">
            Total Appointments
          </p>

          <p className="mt-2 text-2xl font-bold text-gray-900">
            {totalAppointments}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">
            Upcoming Appointments
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-600">
            {upcomingAppointments}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">
            Pending Appointments
          </p>

          <p className="mt-2 text-2xl font-bold text-yellow-600">
            {pendingAppointments}
          </p>
        </div>

      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Appointments table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">

        <div className="border-b border-gray-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Appointment History
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            All your scheduled and previous appointments.
          </p>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">
            Loading your appointments...
          </div>
        ) : appointments.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="font-semibold text-gray-800">
              No appointments found
            </h3>

            <p className="mt-2 text-sm text-gray-500">
              You haven't booked any appointments yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">

              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-6 py-4 font-semibold">
                    Doctor
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Department
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Date
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Time
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Status
                  </th>

                  <th className="px-6 py-4 font-semibold">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">

                {appointments.map((appointment) => {
                  const canCancel =
                    ["PENDING", "CONFIRMED"].includes(
                      appointment.status
                    ) &&
                    new Date(appointment.startTime) > new Date();

                  return (
                    <tr
                      key={appointment.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {appointment.doctor.user.fullName}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {appointment.doctor.department.name}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(appointment.startTime)}
                      </td>

                      <td className="px-6 py-4 text-gray-600">
                        {formatTime(appointment.startTime)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusStyle(
                            appointment.status
                          )}`}
                        >
                          {appointment.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {canCancel ? (
                          <button
                            onClick={() =>
                              handleCancel(appointment.id)
                            }
                            disabled={cancellingId === appointment.id}
                            className="font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {cancellingId === appointment.id
                              ? "Cancelling..."
                              : "Cancel"}
                          </button>
                        ) : (
                          <span className="text-gray-400">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
