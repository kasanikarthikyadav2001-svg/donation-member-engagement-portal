import { Download, Mail } from "lucide-react";
import { Badge, Empty, Button } from "./ui";
import { money, date, initials, title } from "../utils/format";
import { downloadReceipt, send } from "../services/api";
import { toast } from "sonner";
export function DonationTable({
  rows,
  emailEnabled = false,
}: {
  rows: any[];
  emailEnabled?: boolean;
}) {
  if (!rows.length)
    return (
      <Empty
        title="No donations found"
        description="Recorded contributions and their receipts will appear here."
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Donor</th>
            <th>Purpose</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
            <th>Receipt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id}>
              <td>
                <div className="person-cell">
                  <span className="avatar avatar-small">
                    {initials(d.donor_name)}
                  </span>
                  <div>
                    <strong>{d.donor_name}</strong>
                    <small>{title(d.channel)}</small>
                  </div>
                </div>
              </td>
              <td>{d.campaign}</td>
              <td className="amount-cell">
                {money(d.amount_cents)}
                {d.channel === "sandbox" && <small>Simulation</small>}
              </td>
              <td>
                <Badge value={d.status} />
              </td>
              <td className="nowrap">{date(d.created_at)}</td>
              <td>
                {d.receipt_id ? (
                  <div className="table-actions">
                    <button
                      className="icon-btn"
                      title="Download receipt"
                      aria-label={`Download receipt for ${d.donor_name}`}
                      onClick={() => downloadReceipt(d.receipt_id)}
                    >
                      <Download size={17} />
                    </button>
                    {emailEnabled && (
                      <button
                        className="icon-btn"
                        aria-label={`Email receipt for ${d.donor_name}`}
                        onClick={() =>
                          send(`/receipts/${d.receipt_id}/email`, {})
                            .then((r) => toast.success(r.message))
                            .catch((e) => toast.error(e.message))
                        }
                      >
                        <Mail size={17} />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="muted">Not issued</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
