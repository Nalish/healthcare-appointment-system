
"use client";

import { useEffect, useState } from "react";

interface Doctor {
  id: string;
  user: {
    fullName: string;
  };
  department: {
    name: string;
    description: string | null;
  };
  licenseNumber: string | null;
  bio: string | null;
  consultationDurationMinutes: number;
}

export default function FindDoctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await fetch("/api/doctors");

        if (!response.ok) {
          throw new Error("Failed to fetch doctors.");
        }

        const data: Doctor[] = await response.json();

        setDoctors(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  if (loading) {
    return <p>Loading doctors...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Find Doctors
        </h1>

        <p className="text-gray-500 mt-1">
          Browse our doctors and find the right specialist for you.
        </p>
      </div>

      {doctors.length === 0 ? (
        <p className="text-gray-500">
          No doctors are currently available.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="border rounded-lg p-5 space-y-3"
            >
              <h2 className="text-lg font-semibold">
                Dr. {doctor.user.fullName}
              </h2>

              <p className="text-sm font-medium text-blue-600">
                {doctor.department.name}
              </p>

              <p className="text-sm text-gray-600">
                {doctor.department.description ||
                  "No department description available."}
              </p>

              {doctor.bio && (
                <p className="text-sm text-gray-700">
                  {doctor.bio}
                </p>
              )}

              <p className="text-sm text-gray-500">
                Consultation duration:{" "}
                {doctor.consultationDurationMinutes} minutes
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
