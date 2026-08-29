import type { SnapshotStatus } from "@diffboard/core";

export class DiffboardClient {
  constructor(
    private readonly serverUrl: string,
    private readonly token: string,
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.serverUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });

    if (res.status === 404 && path.startsWith("/api/baseline")) {
      return null as T;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Diffboard API ${init.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
    }

    return (await res.json()) as T;
  }

  async createBuild(params: {
    branch: string;
    baseBranch: string;
    commitSha: string;
    prNumber: number | null;
  }): Promise<{ id: string }> {
    return this.request("/api/builds", { method: "POST", body: JSON.stringify(params) });
  }

  async getBaseline(params: {
    branch: string;
    name: string;
    viewport: string;
  }): Promise<{ imageBase64: string; imageKey: string } | null> {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/baseline?${query}`);
  }

  async uploadSnapshot(
    buildId: string,
    params: {
      name: string;
      viewport: string;
      status: SnapshotStatus;
      imageBase64: string;
      diffPercent?: number;
      diffImageBase64?: string;
      baselineKey?: string;
    },
  ): Promise<{ id: string }> {
    return this.request(`/api/builds/${buildId}/snapshots`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async finalizeBuild(buildId: string): Promise<{
    status: string;
    buildUrl: string;
    summary: { total: number; new: number; changed: number; unchanged: number };
  }> {
    return this.request(`/api/builds/${buildId}/finalize`, { method: "POST" });
  }
}
