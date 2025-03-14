import { createCookieSessionStorage, redirect } from "react-router";
import { getUserById } from "./db";

// Create a session storage
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "spotispot_session",
    secure: process.env.NODE_ENV === "production",
    secrets: ["s3cr3t"], // this should be an environment variable in a real app
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
  },
});

// Get the user session
export async function getUserSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

// Get the logged in user ID from session
export async function getUserId(request: Request) {
  const session = await getUserSession(request);
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  return userId;
}

// Get the logged in user from session
export async function getUser(request: Request) {
  const userId = await getUserId(request);
  if (!userId) return null;

  try {
    const user = await getUserById(userId);
    return user;
  } catch (error) {
    throw logout(request);
  }
}

// Create user session
export async function createUserSession(userId: string, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);

  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

// Require a user to be logged in
export async function requireUser(
  request: Request,
  redirectTo: string = "/auth/login"
) {
  const user = await getUser(request);
  if (!user) {
    // Remember the requested URL for redirect after login
    const url = new URL(request.url);
    const params = new URLSearchParams();
    params.set("redirectTo", url.pathname + url.search);
    
    throw redirect(`${redirectTo}?${params.toString()}`);
  }
  return user;
}

// Logout - destroy the session
export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}