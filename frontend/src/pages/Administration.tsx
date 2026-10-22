import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, ShieldCheck } from "lucide-react";
import { api, send } from "../services/api";
import { useList } from "../hooks/list";
import { date, initials, title } from "../utils/format";
import {
  PageHeader,
  Button,
  Field,
  Modal,
  Confirm,
  SearchBox,
  Badge,
  Skeleton,
  ErrorState,
  Empty,
  Pagination,
} from "../components/ui";
import { toast } from "sonner";
export function Administration() {
  const [tab, setTab] = useState("accounts");
  const list = useList();
  const [edit, setEdit] = useState<any>(null);
  const q = useQuery({
    queryKey: [tab, list.query],
    queryFn: () => api(`/${tab}?${list.query}`),
  });
  return (
    <>
      <PageHeader
        eyebrow="CONTROL & ACCOUNTABILITY"
        title="Administration"
        description="Manage access and review the activity behind your records."
      />
      <div className="tabs" role="tablist" aria-label="Administration sections">
        {[
          ["accounts", "Portal accounts"],
          ["audit", "Audit history"],
          ["email-jobs", "Email delivery"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              list.setSearch("");
              list.setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="card">
        {tab !== "email-jobs" && (
          <div className="toolbar">
            <SearchBox
              value={list.search}
              onChange={list.setSearch}
              placeholder={
                tab === "audit"
                  ? "Search action or person…"
                  : "Search accounts…"
              }
            />
          </div>
        )}
        {q.isLoading ? (
          <Skeleton />
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !q.data.data.length ? (
          <Empty
            title={
              tab === "email-jobs" ? "No emails queued" : "No records found"
            }
            description={
              tab === "email-jobs"
                ? "Configured email deliveries will appear here."
                : "Try a different search."
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {(tab === "accounts"
                    ? ["Account", "Role", "Status", "Created", "Actions"]
                    : tab === "audit"
                      ? ["Action", "Person", "Record type", "Date"]
                      : [
                          "Recipient",
                          "Subject",
                          "Status",
                          "Attempts",
                          "Created",
                        ]
                  ).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((r: any) => (
                  <tr key={r.id}>
                    {tab === "accounts" ? (
                      <>
                        <td>
                          <div className="person-cell">
                            <span className="avatar">{initials(r.name)}</span>
                            <div>
                              <strong>{r.name}</strong>
                              <small>{r.email}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge value={r.role} />
                        </td>
                        <td>
                          <Badge value={r.status} />
                        </td>
                        <td>{date(r.created_at)}</td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label={`Manage access for ${r.name}`}
                            onClick={() => setEdit(r)}
                          >
                            <Pencil size={17} />
                          </button>
                        </td>
                      </>
                    ) : tab === "audit" ? (
                      <>
                        <td>
                          <strong>{title(r.action)}</strong>
                        </td>
                        <td>{r.actor_name || "System"}</td>
                        <td>{title(r.entity_type)}</td>
                        <td className="nowrap">
                          {new Date(r.created_at).toLocaleString("en-AU")}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{r.recipient}</td>
                        <td>{r.subject}</td>
                        <td>
                          <Badge value={r.status} />
                        </td>
                        <td>{r.attempts} / 5</td>
                        <td>{date(r.created_at)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.data && tab !== "email-jobs" && (
          <Pagination
            page={list.page}
            total={q.data.total}
            onChange={list.setPage}
          />
        )}
      </section>
      {edit && <AccessForm account={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
function AccessForm({
  account,
  onClose,
}: {
  account: any;
  onClose: () => void;
}) {
  const [role, setRole] = useState(account.role),
    [status, setStatus] = useState(account.status),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false);
  const client = useQueryClient();
  return (
    <Modal title="Manage portal access" onClose={onClose}>
      <p className="muted">
        {account.name} · {account.email}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setConfirm(true);
        }}
      >
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="admin">Administrator — all controls</option>
            <option value="volunteer">Volunteer — records and surveys</option>
            <option value="member">Member — own donations and surveys</option>
            <option value="donor">
              Donor — own donations and eligible surveys
            </option>
          </select>
        </Field>
        <Field label="Account status">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive — sign-in disabled</option>
          </select>
        </Field>
        <div className="info-note">
          <ShieldCheck size={20} />
          <span>
            Saving revokes this user’s sessions so the new permissions apply
            immediately.
          </span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save permissions</Button>
        </div>
      </form>
      {confirm && (
        <Confirm
          title="Change account permissions?"
          description={`Apply ${role} access and ${status} status to ${account.name}?`}
          loading={busy}
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await send(`/accounts/${account.id}`, { role, status }, "PATCH");
              await client.invalidateQueries();
              toast.success("Access updated");
              onClose();
            } catch (e) {
              setError((e as Error).message);
              setConfirm(false);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </Modal>
  );
}
