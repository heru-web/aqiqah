"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { destroySession } from "@/lib/server/auth";
import { loginWithEmailAndPassword } from "@/server/services/auth";

export interface AuthState {
  error?: string;
  success?: boolean;
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    const h = await headers();
    const result = await loginWithEmailAndPassword(email, password, {
      ip: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    });
    const store = await cookies();
    const c = result.cookie as { name: string; value: string; httpOnly: boolean; secure: boolean; sameSite: "lax"; path: string; maxAge: number };
    store.set(c.name, c.value, {
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
      path: c.path,
      maxAge: c.maxAge,
    });
  } catch (err) {
    if (err instanceof AppError) return { error: err.message };
    return { error: "Login gagal. Coba lagi." };
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}