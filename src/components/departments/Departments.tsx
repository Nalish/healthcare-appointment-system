
"use client";

import { useEffect, useState } from "react";

interface Department {
  id: string;
  name: string;
  description: string | null;
}

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await fetch("/api/departments");

        if (!response.ok) {
          throw new Error("Failed to fetch departments.");
        }

        const data: Department[] = await response.json();

        setDepartments(data);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Something went wrong."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Departments
        </h1>

        <p className="text-gray-500 mt-1">
          Explore our medical departments and the services they offer.
        </p>
      </div>

      {loading && (
        <p className="text-gray-500">
          Loading departments...
        </p>
      )}

      {!loading && error && (
        <p className="text-red-500">{error}</p>
      )}

      {!loading && !error && departments.length === 0 && (
        <p className="text-gray-500">
          No departments are currently available.
        </p>
      )}

      {!loading && !error && departments.length > 0 && (
        <>
          <p className="text-sm text-gray-500">
            {departments.length} departments available
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((department) => (
              <div
                key={department.id}
                className="border border-gray-200 rounded-lg p-5 space-y-3"
              >
                <h2 className="text-lg font-semibold">
                  {department.name}
                </h2>

                <p className="text-sm text-gray-600">
                  {department.description ||
                    "No description available for this department."}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
