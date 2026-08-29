import Link from "next/link";
import { useRouter } from "next/router";

export function Topbar() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="topbar">
      <Link href="/" className="brand">
        diff<span>board</span>
      </Link>
      <button className="btn secondary" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
