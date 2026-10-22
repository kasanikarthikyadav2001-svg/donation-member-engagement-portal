import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, ShieldCheck, Wallet } from "lucide-react";
import { api, send } from "../services/api";
import { useAuth, isStaff } from "../hooks/auth";
import { useList } from "../hooks/list";
import {
  PageHeader,
  Button,
  Modal,
  Field,
  SearchBox,
  Skeleton,
  ErrorState,
  Pagination,
} from "../components/ui";
import { DonationTable } from "../components/DonationTable";
import { toast } from "sonner";
const schema = z.object({
  profileId: z.string().uuid("Select a person"),
  amount: z.coerce
    .number()
    .min(1, "Minimum donation is $1")
    .max(1000000)
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
      "Use at most two decimal places",
    ),
  channel: z.enum(["cash", "bank_transfer", "sandbox", "stripe"]),
  campaign: z.string().trim().min(2).max(120),
  note: z.string().max(1000),
});
function DonationForm({
  onClose,
  config,
}: {
  onClose: () => void;
  config: any;
}) {
  const { user } = useAuth();
  const staff = isStaff(user);
  const [personSearch, setPersonSearch] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const people = useQuery({
    queryKey: ["donation-people", personSearch],
    queryFn: () =>
      api(
        `/profiles?status=active&limit=100&search=${encodeURIComponent(personSearch)}`,
      ),
    enabled: !!staff,
  });
  const mine = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => api("/profiles/mine"),
    enabled: !staff,
  });
  const client = useQueryClient();
  const [error, setError] = useState("");
  const f = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      profileId: "",
      amount: 50,
      channel: staff
        ? "bank_transfer"
        : config.paymentsEnabled
          ? "stripe"
          : "sandbox",
      campaign: "Community fund",
      note: "",
    },
  });
  useEffect(() => {
    if (mine.data) f.setValue("profileId", mine.data.id);
  }, [mine.data]);
  const channel = f.watch("channel");
  const unavailable =
    !staff && !config.paymentsEnabled && !config.sandboxEnabled;
  return (
    <Modal
      title={staff ? "Record a donation" : "Support your community"}
      onClose={onClose}
    >
      <p className="muted">
        {staff
          ? "Record a received cash or bank transfer donation, or start hosted card checkout."
          : "Choose a contribution amount and the initiative you’d like to support."}
      </p>
      {unavailable ? (
        <div className="form-error">
          Online donations are currently unavailable. Please contact the club to
          arrange a bank transfer.
        </div>
      ) : (
        <form
          onSubmit={f.handleSubmit(async (v) => {
            setError("");
            try {
              const r = await send("/donations", { ...v, idempotencyKey: key });
              if (r.checkoutUrl) {
                window.location.assign(r.checkoutUrl);
                return;
              }
              await client.invalidateQueries();
              toast.success(
                v.channel === "sandbox"
                  ? "Simulated donation recorded. No funds collected."
                  : "Donation recorded and receipt issued",
              );
              onClose();
            } catch (e) {
              setError((e as Error).message);
            }
          })}
        >
          {staff && (
            <>
              <Field label="Find a donor">
                <input
                  placeholder="Search donors by name or email"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                />
              </Field>
              <Field
                label="Donor"
                error={f.formState.errors.profileId?.message}
              >
                <select {...f.register("profileId")}>
                  <option value="">Select a person</option>
                  {people.data?.data.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.email}
                    </option>
                  ))}
                </select>
              </Field>
              {people.error && (
                <p className="field-error">{people.error.message}</p>
              )}
            </>
          )}
          <div className="form-grid">
            <Field
              label="Amount (AUD)"
              error={f.formState.errors.amount?.message}
            >
              <input
                type="number"
                min="1"
                max="1000000"
                step="0.01"
                {...f.register("amount")}
              />
            </Field>
            <Field label="Payment method">
              <select {...f.register("channel")}>
                {staff && (
                  <>
                    <option value="bank_transfer">
                      Received bank transfer
                    </option>
                    <option value="cash">Received cash</option>
                  </>
                )}
                {config.paymentsEnabled && (
                  <option value="stripe">Secure card checkout</option>
                )}
                {config.sandboxEnabled && (
                  <option value="sandbox">Sandbox simulation</option>
                )}
              </select>
            </Field>
          </div>
          <Field
            label="Initiative"
            error={f.formState.errors.campaign?.message}
          >
            <input list="initiatives" {...f.register("campaign")} />
            <datalist id="initiatives">
              <option value="Community fund" />
              <option value="Food relief" />
              <option value="Youth mentoring" />
            </datalist>
          </Field>
          <Field
            label="Note (optional)"
            error={f.formState.errors.note?.message}
          >
            <textarea rows={2} {...f.register("note")} />
          </Field>
          <div className="info-note">
            <ShieldCheck size={20} />
            <span>
              {channel === "sandbox"
                ? "This is a simulation. No money will be collected."
                : channel === "stripe"
                  ? "Card details are handled by Stripe and never stored in Beacon."
                  : "Confirm the funds have been received before recording this donation."}
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
            <Button loading={f.formState.isSubmitting} type="submit">
              {channel === "stripe"
                ? "Continue to checkout"
                : channel === "sandbox"
                  ? "Simulate donation"
                  : "Record received donation"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
export function Donations() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(params.has("new"));
  const list = useList();
  const q = useQuery({
    queryKey: ["donations", list.query],
    queryFn: () => api(`/donations?${list.query}`),
    refetchInterval: params.has("payment") ? 5000 : false,
  });
  const config = useQuery({
    queryKey: ["config"],
    queryFn: () => api("/config"),
  });
  const close = () => {
    setOpen(false);
    if (params.has("new")) setParams({});
  };
  return (
    <>
      <PageHeader
        eyebrow="GENEROSITY IN ACTION"
        title={staff ? "Donations" : "My donations"}
        description="Every contribution, with a clear and traceable history."
        action={
          <Button disabled={!config.data} onClick={() => setOpen(true)}>
            <Plus size={18} />
            {staff ? "Record donation" : "Make a donation"}
          </Button>
        }
      />
      {params.has("payment") && (
        <div className="info-note">
          <Wallet size={20} />
          <span>
            {params.get("payment") === "processing"
              ? "Your checkout has returned. The donation will update after verified payment confirmation."
              : "Checkout was cancelled. No success receipt will be issued unless payment is confirmed."}
          </span>
          <Button variant="ghost" onClick={() => setParams({})}>
            Dismiss
          </Button>
        </div>
      )}
      {config.data?.sandboxEnabled && (
        <p className="sandbox-banner">
          Development environment · simulated donations are labelled and
          excluded from fundraising totals.
        </p>
      )}
      <section className="card">
        <div className="toolbar">
          <SearchBox
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search donor, initiative or receipt…"
          />
          <select
            aria-label="Filter donation status"
            value={list.status}
            onChange={(e) => list.setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="succeeded">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {q.isLoading ? (
          <Skeleton />
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : (
          <DonationTable
            rows={q.data.data}
            emailEnabled={config.data?.emailEnabled}
          />
        )}{" "}
        {q.data && (
          <Pagination
            page={list.page}
            total={q.data.total}
            onChange={list.setPage}
          />
        )}
      </section>
      {open && config.data && (
        <DonationForm config={config.data} onClose={close} />
      )}
    </>
  );
}
