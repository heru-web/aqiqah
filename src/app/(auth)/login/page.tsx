import { redirect } from "next/navigation";
import { LoginForm, type DemoAccount } from "@/components/auth/login-form";
import { getAuth } from "@/lib/server/auth";

function parseDemoAccounts(raw: string | undefined): DemoAccount[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is DemoAccount =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as DemoAccount).role === "string" &&
        typeof (a as DemoAccount).email === "string" &&
        typeof (a as DemoAccount).password === "string"
    );
  } catch {
    return [];
  }
}

export default async function LoginPage() {
  const user = await getAuth();
  if (user) redirect("/dashboard");

  const accounts = parseDemoAccounts(process.env.DEMO_LOGIN_ACCOUNTS);

  return <LoginForm accounts={accounts} />;
}
