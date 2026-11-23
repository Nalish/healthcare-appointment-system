
"use client";

import { useEffect, useMemo, useState } from "react";

interface Department {
  id: string;
  name: string;
  description: string | null;
}

interface Doctor {
  id: string;
  departmentId: string;
  consultationDurationMinutes: number;
  user: {
    fullName: string;
  };
  department: {
    name: string;
  };
}

interface Availability {
  id: string;
  doctorId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  doctor: {
    id: string;
  };
}

interface BookingData {
  departments: Department[];
  doctors: Doctor[];
  availability: Availability[];
  appointments: Appointment[];
}

function getNairobiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(
    Date.UTC(year, month - 1, day)
  ).getUTCDay();

  return weekday === 0 ? 7 : weekday;
}

function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  const date = new Date(Date.UTC(2026, 0, 1, hours, remainingMinutes));

  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export default function BookAppointment() {
  const [data, setData] = useState<BookingData>({
    departments: [],
    doctors: [],
    availability: [],
    appointments: [],
  });

  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load the information needed for booking
  useEffect(() => {
    async function loadBookingData() {
      try {
        const responses = await Promise.all([
          fetch("/api/departments", { cache: "no-store" }),
          fetch("/api/doctors", { cache: "no-store" }),
          fetch("/api/availability", { cache: "no-store" }),
          fetch("/api/appointments", { cache: "no-store" }),
        ]);

        const results = await Promise.all(
          responses.map(async (response) => {
            const result = await response.json();

            if (!response.ok) {
              throw new Error(
                result.message || "Failed to load booking information."
              );
            }

            return result;
          })
        );

        setData({
          departments: results[0],
          doctors: results[1],
          availability: results[2],
          appointments: results[3],
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load booking information."
        );
      } finally {
        setLoading(false);
      }
    }

    loadBookingData();
  }, []);

  // Get doctors belonging to the selected department
  const filteredDoctors = useMemo(
    () =>
      data.doctors.filter(
        (doctor) => doctor.departmentId === departmentId
      ),
    [data.doctors, departmentId]
  );

  const selectedDoctor = data.doctors.find(
    (doctor) => doctor.id === doctorId
  );

  // Generate available appointment times
  const availableTimes = useMemo(() => {
    if (!selectedDoctor || !selectedDate) {
      return [];
    }

    const weekday = getWeekday(selectedDate);
    const duration = selectedDoctor.consultationDurationMinutes;

    if (!Number.isInteger(duration) || duration <= 0) {
      return [];
    }

    const schedules = data.availability.filter(
      (item) =>
        item.doctorId === doctorId &&
        item.dayOfWeek === weekday &&
        item.isActive
    );

    const today = getNairobiDate();
    const now = new Date();

    const nowInNairobi = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Nairobi",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(now).replace(":", "")
    );

    const slots: string[] = [];

    schedules.forEach((schedule) => {
      for (
        let start = schedule.startMinute;
        start + duration <= schedule.endMinute;
        start += duration
      ) {
        const hours = Math.floor(start / 60);
        const minutes = start % 60;

        const time = `${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}`;

        const startDate = new Date(
          `${selectedDate}T${time}:00+03:00`
        );

        const endDate = new Date(
          startDate.getTime() + duration * 60 * 1000
        );

        // Exclude past appointment times
        if (selectedDate === today) {
          if (hours * 60 + minutes <= Math.floor(nowInNairobi / 100) * 60 + nowInNairobi % 100) {
            continue;
          }
        }

        if (startDate <= now) {
          continue;
        }

        // Exclude times occupied by existing appointments
        const hasConflict = data.appointments.some((appointment) => {
          if (
            appointment.doctor.id !== doctorId ||
            appointment.status === "CANCELLED"
          ) {
            return false;
          }

          const existingStart = new Date(appointment.startTime);
          const existingEnd = new Date(appointment.endTime);

          return (
            startDate < existingEnd &&
            endDate > existingStart
          );
        });

        if (!hasConflict) {
          slots.push(time);
        }
      }
    });

    return [...new Set(slots)].sort();
  }, [
    selectedDoctor,
    selectedDate,
    doctorId,
    data.availability,
    data.appointments,
  ]);

  // Book appointment
  async function handleBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!doctorId || !selectedDate || !selectedTime) {
      setError("Please select a department, doctor, date and time.");
      return;
    }

    const startTime = new Date(
      `${selectedDate}T${selectedTime}:00+03:00`
    );

    if (startTime <= new Date()) {
      setError("Please select a future appointment time.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doctorId,
          startTime: startTime.toISOString(),
          reason: reason.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Failed to book appointment."
        );
      }

      setData((previous) => ({
        ...previous,
        appointments: [
          ...previous.appointments,
          {
            ...result,
            doctor: { id: doctorId },
          },
        ],
      }));

      setSuccess("Your appointment has been booked successfully!");

      setSelectedTime("");
      setReason("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while booking."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-text-secondary">Loading booking information...</p>;
  }

  return (
    <div className="max-w-3xl space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          Book an Appointment
        </h1>

        <p className="mt-2 text-text-secondary">
          Select a department, doctor and convenient consultation time.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      <form
        onSubmit={handleBooking}
        className="space-y-6 rounded-xl border border-border bg-white p-6"
      >

        {/* Department */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            Select Department
          </label>

          <select
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setDoctorId("");
              setSelectedDate("");
              setSelectedTime("");
            }}
            required
            className="w-full rounded-lg border border-border p-3"
          >
            <option value="">Choose a department</option>

            {data.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        {/* Doctor */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            Select Doctor
          </label>

          <select
            value={doctorId}
            onChange={(event) => {
              setDoctorId(event.target.value);
              setSelectedDate("");
              setSelectedTime("");
            }}
            required
            disabled={!departmentId}
            className="w-full rounded-lg border border-border p-3 disabled:bg-gray-100"
          >
            <option value="">Choose a doctor</option>

            {filteredDoctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.user.fullName}
              </option>
            ))}
          </select>

          {departmentId && filteredDoctors.length === 0 && (
            <p className="mt-2 text-sm text-text-secondary">
              No doctors are currently available in this department.
            </p>
          )}
        </div>

        {/* Consultation duration */}
        {selectedDoctor && (
          <p className="text-sm text-text-secondary">
            Consultation duration:{" "}
            {selectedDoctor.consultationDurationMinutes} minutes
          </p>
        )}

        {/* Date */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            Appointment Date
          </label>

          <input
            type="date"
            value={selectedDate}
            min={getNairobiDate()}
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setSelectedTime("");
            }}
            required
            disabled={!doctorId}
            className="w-full rounded-lg border border-border p-3 disabled:bg-gray-100"
          />
        </div>

        {/* Available times */}
        {selectedDate && doctorId && (
          <div>
            <label className="mb-3 block text-sm font-medium">
              Available Time Slots
            </label>

            {availableTimes.length === 0 ? (
              <p className="rounded-lg bg-gray-50 p-4 text-sm text-text-secondary">
                No available time slots for this date. Please select another date.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {availableTimes.map((time) => {
                  const [hours, minutes] = time.split(":").map(Number);
                  const totalMinutes = hours * 60 + minutes;

                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedTime(time)}
                      className={`rounded-lg border p-3 text-sm font-medium ${
                        selectedTime === time
                          ? "border-primary bg-primary text-white"
                          : "border-border hover:border-primary"
                      }`}
                    >
                      {formatTime(totalMinutes)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Reason */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            Reason for Consultation
          </label>

          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="Briefly describe why you need the consultation..."
            className="w-full rounded-lg border border-border p-3"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !selectedTime}
          className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Booking Appointment..." : "Confirm Appointment"}
        </button>

      </form>
    </div>
  );
}
