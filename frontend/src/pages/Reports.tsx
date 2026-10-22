import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Wallet, HeartHandshake } from "lucide-react";
import { api } from "../services/api";
import { money, date, exportCsv, title } from "../utils/format";
import {
  PageHeader,
  Button,
  Field,
  Badge,
  Skeleton,
  ErrorState,
  Empty,
  Pagination,
} from "../components/ui";
export function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`),
    [to, setTo] = useState(today),
    [range, setRange] = useState({
      from: `${today.slice(0, 7)}-01`,
      to: today,
    });
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["reports", range],
    queryFn: () => api(`/reports?from=${range.from}&to=${range.to}`),
  });
  return (
    <>
      <PageHeader
        eyebrow="CLARITY FOR YOUR COMMUNITY"
        title="Donation reports"
        description="Review contributions across a date range and export your records."
        action={
          <Button
            variant="secondary"
            disabled={!q.data?.data.length}
            onClick={() =>
              exportCsv(
                `beacon-donations-${range.from}-${range.to}.csv`,
                q.data.data.map((d: any) => ({
                  date: d.created_at,
                  donor: d.donor_name,
                  email: d.email,
                  amount_aud: (d.amount_cents / 100).toFixed(2),
                  method: d.channel,
                  status: d.status,
                  initiative: d.campaign,
                  receipt: d.reference,
                })),
              )
            }
          >
            <Download size={17} />
            Export CSV
          </Button>
        }
      />
      <form
        className="card report-filter"
        onSubmit={(e) => {
          e.preventDefault();
          setRange({ from, to });
          setPage(1);
        }}
      >
        <Field label="From date">
          <input
            type="date"
            value={from}
            max={to}
            required
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To date">
          <input
            type="date"
            value={to}
            min={from}
            required
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Button type="submit">Apply date range</Button>
      </form>
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        <>
          <div className="stats-grid report-stats">
            <article className="stat-card">
              <div className="stat-label">
                Confirmed contributions
                <Wallet size={20} />
              </div>
              <strong>{money(q.data.summary.raised)}</strong>
              <small>Excludes simulated and unconfirmed payments</small>
            </article>
            <article className="stat-card">
              <div className="stat-label">
                Donation records
                <HeartHandshake size={20} />
              </div>
              <strong>{q.data.summary.count}</strong>
              <small>All statuses in the selected date range</small>
            </article>
          </div>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Donation ledger</h2>
                <p>
                  {date(range.from)} – {date(range.to)} (UTC)
                </p>
              </div>
            </div>
            {q.data.data.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Donor</th>
                      <th>Initiative</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.data
                      .slice((page - 1) * 10, page * 10)
                      .map((d: any) => (
                        <tr key={d.id}>
                          <td className="nowrap">{date(d.created_at)}</td>
                          <td>
                            <strong>{d.donor_name}</strong>
                          </td>
                          <td>{d.campaign}</td>
                          <td>{title(d.channel)}</td>
                          <td>
                            <Badge value={d.status} />
                          </td>
                          <td className="amount-cell">
                            {money(d.amount_cents)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No donations in this period"
                description="Choose another date range to see more records."
              />
            )}
            <Pagination
              page={page}
              total={q.data.data.length}
              onChange={setPage}
            />
          </section>
        </>
      )}
    </>
  );
}
