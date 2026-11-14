
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

// Define the information we need about an authenticated user
const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  doctorProfile: {
    select: {
      id: true,
    },
  },
};

// Retrieve and verify the currently authenticated user
export async function getCurrentUser() {
  const session = await auth();

  // Check whether the user is authenticated
  const userId = session?.user?.id;

  if (!userId) {
    return {
      user: null,
      response: NextResponse.json(
        { message: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  // Retrieve the latest user information from the database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  // Check whether the account exists and is active
  if (!user || !user.isActive) {
    return {
      user: null,
      response: NextResponse.json(
        { message: "Your account is inactive or unavailable." },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

// Check whether the authenticated user has an allowed role
export async function requireRole(allowedRoles: UserRole[]) {
  const result = await getCurrentUser();

  // Return authentication errors
  if (result.response) {
    return result;
  }

  // Check the user's current database role
  if (!allowedRoles.includes(result.user.role)) {
    return {
      user: null,
      response: NextResponse.json(
        { message: "You do not have permission to perform this action." },
        { status: 403 }
      ),
    };
  }

  return result;
}
