import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  HeartHandshake,
  Users,
  Wallet,
  CalendarDays,
  Plus,
  ArrowUpRight,
  ClipboardList,
} from "lucide-react";
import { api } from "../services/api";
import { useAuth, isStaff } from "../hooks/auth";
import { money } from "../utils/format";
import { PageHeader, Skeleton, ErrorState, Empty } from "../components/ui";
import { DonationTable } from "../components/DonationTable";
export function Dashboard() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api("/dashboard"),
  });
  const surveys = useQuery({
    queryKey: ["surveys", "dashboard"],
    queryFn: () => api("/surveys?limit=3&status=published"),
  });
  if (q.isLoading) return <Skeleton rows={7} />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { summary, monthly, recent, campaigns } = q.data;
  const max = Math.max(1, ...monthly.map((m: any) => Number(m.amount)));
  const stats = [
    {
      label: staff ? "Total contributions" : "My contributions",
      value: money(summary.raised),
      note: `${summary.donation_count} recorded donations`,
      icon: Wallet,
    },
    {
      label: "This month",
      value: money(summary.this_month),
      note: "Confirmed contributions only",
      icon: CalendarDays,
    },
    {
      label: staff ? "Active donors" : "Pending donations",
      value: staff ? summary.donors : summary.pending,
      note: staff
        ? "People supporting our mission"
        : "Awaiting payment confirmation",
      icon: HeartHandshake,
    },
    {
      label: staff ? "Active members" : "Open surveys",
      value: staff ? summary.members : surveys.data?.total || 0,
      note: staff ? "Connected to our community" : "Share your perspective",
      icon: Users,
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="YOUR COMMUNITY, AT A GLANCE"
        title={`Good to see you, ${user!.name.split(" ")[0]}.`}
        description="Here’s what’s happening across your community."
        action={
          <Link className="btn btn-primary" to="/donations?new=1">
            <Plus size={18} />
            {staff ? "Record donation" : "Make a donation"}
          </Link>
        }
      />
      <section className="welcome-banner">
        <div>
          <span className="banner-tag">TOGETHER, WE MAKE AN IMPACT</span>
          <h2>Small acts. Stronger communities.</h2>
          <p>
            Every contribution helps create opportunities for the people around
            us.
          </p>
        </div>
        <HeartHandshake className="banner-symbol" size={112} strokeWidth={1} />
      </section>
      <section className="stats-grid">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <article className="stat-card" key={label}>
            <div className="stat-label">
              <span>{label}</span>
              <span className="stat-icon">
                <Icon size={19} />
              </span>
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="card contributions-card">
          <div className="card-head">
            <div>
              <h2>Contribution activity</h2>
              <p>Confirmed donations over the last six months</p>
            </div>
            <span className="chart-key">
              <i />
              AUD
            </span>
          </div>
          <div
            className="bar-chart"
            role="img"
            aria-label={monthly
              .map((m: any) => `${m.month}: ${money(m.amount)}`)
              .join(", ")}
          >
            {monthly.map((m: any) => (
              <div className="bar-column" key={m.month}>
                <span>{Number(m.amount) > 0 ? money(m.amount) : "—"}</span>
                <div className="bar-track">
                  <div
                    className="bar"
                    style={{
                      height: `${Math.max(Number(m.amount) > 0 ? 4 : 0, (Number(m.amount) / max) * 100)}%`,
                    }}
                  />
                </div>
                <small>{m.month}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Where support goes</h2>
              <p>Contributions by initiative</p>
            </div>
          </div>
          <div className="campaign-list">
            {campaigns.length ? (
              campaigns.map((c: any, i: number) => (
                <div key={c.campaign}>
                  <div className="campaign-name">
                    <span>
                      <i className={`campaign-dot dot-${i}`} />
                      {c.campaign}
                    </span>
                    <strong>{money(c.amount)}</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      style={{
                        width: `${(Number(c.amount) / Math.max(Number(summary.raised), 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <small>
                    {c.count} contribution{c.count !== 1 ? "s" : ""}
                  </small>
                </div>
              ))
            ) : (
              <Empty
                title="Support starts here"
                description="Your first confirmed donation will appear here."
              />
            )}
          </div>
        </section>
      </div>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Recent donations</h2>
            <p>The latest contributions to your community</p>
          </div>
          <Link className="text-link" to="/donations">
            View all <ArrowUpRight size={16} />
          </Link>
        </div>
        <DonationTable rows={recent} />
      </section>
      <section className="card survey-preview">
        <div className="survey-preview-icon">
          <ClipboardList size={28} />
        </div>
        <div>
          <h2>Your voice shapes our community</h2>
          <p>
            {surveys.data?.total
              ? `${surveys.data.total} published survey${surveys.data.total === 1 ? "" : "s"} ${staff ? "in your workspace" : "available to you"}.`
              : "Visit surveys to stay connected with member feedback."}
          </p>
        </div>
        <Link className="btn btn-secondary" to="/surveys">
          Explore surveys
        </Link>
      </section>
    </>
  );
}
