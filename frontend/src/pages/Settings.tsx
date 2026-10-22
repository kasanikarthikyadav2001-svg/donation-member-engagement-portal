import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "../hooks/auth";
import { api, send } from "../services/api";
import { initials, title } from "../utils/format";
import {
  PageHeader,
  Button,
  Field,
  Badge,
  Skeleton,
  ErrorState,
} from "../components/ui";
import { toast } from "sonner";
export function Settings() {
  const { user, refresh } = useAuth();
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => api("/profiles/mine"),
  });
  return (
    <>
      <PageHeader
        eyebrow="YOUR PORTAL, YOUR PREFERENCES"
        title="Account settings"
        description="Manage your profile, preferences and account security."
      />
      <section className="card settings-profile">
        <span className="avatar avatar-large">{initials(user!.name)}</span>
        <div>
          <h2>{user!.name}</h2>
          <p>{user!.email}</p>
        </div>
        <Badge value={user!.role} />
      </section>
      <div className="settings-grid">
        <section className="card settings-card">
          <div className="section-title">
            <UserRound size={21} />
            <h2>Personal information</h2>
          </div>
          {profile.isLoading ? (
            <Skeleton rows={3} />
          ) : profile.error ? (
            <ErrorState error={profile.error} />
          ) : (
            <ProfileSettings profile={profile.data} refresh={refresh} />
          )}
        </section>
        <section className="card settings-card">
          <div className="section-title">
            <LockKeyhole size={21} />
            <h2>Password & security</h2>
          </div>
          <PasswordSettings />
          <div className="info-note">
            <ShieldCheck size={20} />
            <span>Changing your password signs out your other sessions.</span>
          </div>
        </section>
      </div>
    </>
  );
}
function ProfileSettings({
  profile,
  refresh,
}: {
  profile: any;
  refresh: () => Promise<void>;
}) {
  const { user } = useAuth();
  const client = useQueryClient();
  const [name, setName] = useState(user!.name),
    [phone, setPhone] = useState(profile?.phone || ""),
    [consent, setConsent] = useState(profile?.consent || false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await send("/auth/account", { name }, "PATCH");
          if (profile)
            await send("/profiles/mine", { phone, consent }, "PATCH");
          await refresh();
          await client.invalidateQueries({ queryKey: ["my-profile"] });
          toast.success("Profile saved");
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Full name">
        <input
          required
          minLength={2}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field
        label="Email address"
        hint="Contact your administrator about account email changes."
      >
        <input value={user!.email} readOnly />
      </Field>
      {profile && (
        <>
          <Field label="Phone number">
            <input
              type="tel"
              maxLength={30}
              pattern="[+0-9\s().\-]*"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <label className="check-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>I consent to optional community communications.</span>
          </label>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy}>
        Save profile
      </Button>
    </form>
  );
}
function PasswordSettings() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          d = new FormData(form);
        setError("");
        if (d.get("newPassword") !== d.get("confirm")) {
          setError("The new passwords do not match.");
          return;
        }
        setBusy(true);
        try {
          await send("/auth/password", {
            currentPassword: d.get("currentPassword"),
            newPassword: d.get("newPassword"),
          });
          form.reset();
          toast.success("Password updated");
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Current password">
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>
      <Field
        label="New password"
        hint="12+ characters with uppercase, lowercase and a number"
      >
        <input
          name="newPassword"
          type="password"
          minLength={12}
          maxLength={128}
          required
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm new password">
        <input
          name="confirm"
          type="password"
          required
          autoComplete="new-password"
        />
      </Field>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy}>
        Update password
      </Button>
    </form>
  );
}
