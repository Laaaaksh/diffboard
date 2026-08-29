import { useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { getSessionUserId } from "@/lib/auth";

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  const userId = await getSessionUserId(req as never);
  if (userId) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Login failed");
      return;
    }
    router.push("/");
  }

  return (
    <div className="container" style={{ maxWidth: 380, paddingTop: 96 }}>
      <div className="stack" style={{ marginBottom: 28, textAlign: "center" }}>
        <h1>
          diff<span style={{ color: "var(--accent)" }}>board</span>
        </h1>
        <p className="muted">Sign in to your self-hosted dashboard</p>
      </div>
      <form onSubmit={onSubmit} className="card stack">
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16, textAlign: "center" }}>
        The admin account is set via <code>ADMIN_EMAIL</code> / <code>ADMIN_PASSWORD</code> on
        first boot - see the README.
      </p>
    </div>
  );
}
