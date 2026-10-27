import Link from "next/link";
import { connection } from "next/server";
import { SignOutButton } from "@/components/auth-buttons";
import { getSessionUser } from "@/lib/session";

export async function UserNav() {
  await connection();
  const user = await getSessionUser();
  if (!user) {
    return (
      <Link href="/login" className="text-muted hover:text-foreground">
        登入
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-3">
      <Link href="/dashboards" className="flex items-center gap-2 hover:text-accent">
        {user.image && <img src={user.image} alt="" className="h-6 w-6 rounded-full" />}
        <span className="max-w-28 truncate">{user.name}</span>
      </Link>
      <SignOutButton />
    </span>
  );
}
