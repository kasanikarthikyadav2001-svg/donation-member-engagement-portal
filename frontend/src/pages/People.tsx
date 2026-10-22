import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, UserPlus, Download } from "lucide-react";
import { api, send } from "../services/api";
import { useAuth } from "../hooks/auth";
import { useList } from "../hooks/list";
import { money, initials, title, exportCsv } from "../utils/format";
import {
  Button,
  Field,
  Modal,
  Badge,
  PageHeader,
  SearchBox,
  Skeleton,
  ErrorState,
  Empty,
  Pagination,
} from "../components/ui";
import { toast } from "sonner";
const schema = z.object({
  name: z.string().trim().min(2, "Enter a full name").max(120),
  email: z.string().email("Enter a valid email"),
  phone: z
    .string()
    .max(30)
    .regex(/^[+\d\s().-]*$/, "Enter a valid phone number"),
  kind: z.enum(["donor", "member", "both"]),
  status: z.enum(["active", "inactive"]),
  consent: z.boolean(),
  notes: z.string().max(2000),
});
function ProfileForm({
  profile,
  onClose,
}: {
  profile: any;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const f = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: profile
      ? {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          kind: profile.kind,
          status: profile.status,
          consent: profile.consent,
          notes: profile.notes,
        }
      : {
          name: "",
          email: "",
          phone: "",
          kind: "donor",
          status: "active",
          consent: false,
          notes: "",
        },
  });
  const [error, setError] = useState("");
  return (
    <Modal title={profile ? "Edit person" : "Add a person"} onClose={onClose}>
      <form
        onSubmit={f.handleSubmit(async (v) => {
          setError("");
          try {
            await send(
              profile ? `/profiles/${profile.id}` : "/profiles",
              v,
              profile ? "PATCH" : "POST",
            );
            await client.invalidateQueries();
            toast.success(profile ? "Profile updated" : "Person added");
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      >
        <div className="form-grid">
          <Field label="Full name" error={f.formState.errors.name?.message}>
            <input {...f.register("name")} />
          </Field>
          <Field
            label="Email address"
            error={f.formState.errors.email?.message}
            hint={
              profile?.user_id ? "Email is linked to an account." : undefined
            }
          >
            <input
              type="email"
              readOnly={!!profile?.user_id}
              {...f.register("email")}
            />
          </Field>
          <Field label="Phone number" error={f.formState.errors.phone?.message}>
            <input type="tel" {...f.register("phone")} />
          </Field>
          <Field label="Relationship">
            <select {...f.register("kind")}>
              <option value="donor">Donor</option>
              <option value="member">Member</option>
              <option value="both">Donor & member</option>
            </select>
          </Field>
          <Field label="Status">
            <select {...f.register("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </div>
        <Field label="Internal notes" error={f.formState.errors.notes?.message}>
          <textarea rows={3} {...f.register("notes")} />
        </Field>
        <label className="check-label">
          <input type="checkbox" {...f.register("consent")} />
          <span>Consent to optional communications has been obtained.</span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={f.formState.isSubmitting}>
            {profile ? "Save changes" : "Add person"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function AccountForm({
  profile,
  onClose,
}: {
  profile: any;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Create portal access" onClose={onClose}>
      <p className="muted">
        Create an account for {profile.name}. Share the initial password
        securely; they can change it in Settings.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await send(`/profiles/${profile.id}/account`, {
              role: d.get("role"),
              password: d.get("password"),
            });
            await client.invalidateQueries();
            toast.success("Portal account created");
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Access role">
          <select name="role">
            <option value="donor">Donor</option>
            <option value="member">Member</option>
            <option value="volunteer">Volunteer</option>
          </select>
        </Field>
        <Field
          label="Initial password"
          hint="12+ characters with uppercase, lowercase and a number"
        >
          <input
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function People() {
  const list = useList();
  const { user } = useAuth();
  const [kind, setKind] = useState("");
  const [edit, setEdit] = useState<any>(undefined),
    [account, setAccount] = useState<any>(null);
  const q = useQuery({
    queryKey: ["profiles", list.query, kind],
    queryFn: () => api(`/profiles?${list.query}&kind=${kind}`),
  });
  return (
    <>
      <PageHeader
        eyebrow="PEOPLE & CONNECTIONS"
        title="Your community"
        description="Keep donor and member relationships in one place."
        action={
          <Button onClick={() => setEdit(null)}>
            <Plus size={18} />
            Add person
          </Button>
        }
      />
      <section className="card">
        <div className="toolbar">
          <SearchBox
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search name or email…"
          />
          <div className="toolbar-controls">
            <select
              aria-label="Filter relationship"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                list.setPage(1);
              }}
            >
              <option value="">All relationships</option>
              <option value="donor">Donors</option>
              <option value="member">Members</option>
            </select>
            <select
              aria-label="Filter status"
              value={list.status}
              onChange={(e) => list.setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <Button
              variant="secondary"
              disabled={!q.data?.data.length}
              onClick={() =>
                exportCsv(
                  "beacon-people-page.csv",
                  q.data.data.map((p: any) => ({
                    name: p.name,
                    email: p.email,
                    phone: p.phone,
                    relationship: p.kind,
                    status: p.status,
                    consent: p.consent,
                  })),
                )
              }
            >
              <Download size={16} />
              Export page
            </Button>
          </div>
        </div>
        {q.isLoading ? (
          <Skeleton />
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !q.data.data.length ? (
          <Empty
            title="No people found"
            description="Try another search or add your first person."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Relationship</th>
                  <th>Status</th>
                  <th>Contributions</th>
                  <th>Portal access</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {q.data.data.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar">{initials(p.name)}</span>
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="relationship">
                        {p.kind === "both" ? "Donor & member" : title(p.kind)}
                      </span>
                    </td>
                    <td>
                      <Badge value={p.status} />
                    </td>
                    <td className="amount-cell">{money(p.total_donated)}</td>
                    <td>
                      {p.user_id ? (
                        <Badge value={p.role} />
                      ) : (
                        <span className="muted">No account</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-btn"
                          aria-label={`Edit ${p.name}`}
                          onClick={() => setEdit(p)}
                        >
                          <Pencil size={17} />
                        </button>
                        {!p.user_id && user?.role === "admin" && (
                          <button
                            className="icon-btn"
                            aria-label={`Create account for ${p.name}`}
                            onClick={() => setAccount(p)}
                          >
                            <UserPlus size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.data && (
          <Pagination
            page={list.page}
            total={q.data.total}
            onChange={list.setPage}
          />
        )}
      </section>
      {edit !== undefined && (
        <ProfileForm profile={edit} onClose={() => setEdit(undefined)} />
      )}{" "}
      {account && (
        <AccountForm profile={account} onClose={() => setAccount(null)} />
      )}
    </>
  );
}
