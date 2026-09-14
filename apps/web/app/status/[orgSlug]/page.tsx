import { API_URL } from "@/lib/api";

type StatusPayload = {
  org: { name: string; slug: string };
  services: Array<{
    id: string;
    name: string;
    currentStatus: string;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    status: string;
    severity: string;
    createdAt: string;
  }>;
};

async function loadStatus(orgSlug: string): Promise<StatusPayload | null> {
  const res = await fetch(`${API_URL}/v1/public/status/${orgSlug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function PublicStatusPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const data = await loadStatus(orgSlug);

  if (!data) {
    return (
      <div className="status-shell">
        <div className="page">
          <h1>Status page not found</h1>
          <p className="muted">No organization is published at this URL.</p>
        </div>
      </div>
    );
  }

  const worst = worstStatus(data.services.map((s) => s.currentStatus));

  return (
    <div className="status-shell">
      <div className="page">
        <p className="muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Public status
        </p>
        <h1>{data.org.name}</h1>
        <p className="muted">
          Overall: <strong>{worst.replaceAll("_", " ")}</strong>
        </p>
        <div className="card" style={{ marginTop: "1.5rem" }}>
          <h2>Services</h2>
          {data.services.map((s) => (
            <div
              key={s.id}
              className="row"
              style={{ justifyContent: "space-between", padding: "0.6rem 0", borderBottom: "1px solid #eee" }}
            >
              <span>{s.name}</span>
              <span className={`badge ${s.currentStatus}`}>{s.currentStatus.replaceAll("_", " ")}</span>
            </div>
          ))}
          {!data.services.length && <p className="muted">No services published yet.</p>}
        </div>
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2>Active incidents</h2>
          {data.incidents.map((i) => (
            <div key={i.id} style={{ marginBottom: "0.8rem" }}>
              <strong>{i.title}</strong>{" "}
              <span className={`badge ${i.status}`}>{i.status}</span>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {new Date(i.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
          {!data.incidents.length && <p className="muted">No active incidents.</p>}
        </div>
      </div>
    </div>
  );
}

function worstStatus(statuses: string[]): string {
  const rank = ["operational", "degraded", "partial_outage", "major_outage"];
  return statuses.reduce(
    (worst, s) => (rank.indexOf(s) > rank.indexOf(worst) ? s : worst),
    "operational",
  );
}
