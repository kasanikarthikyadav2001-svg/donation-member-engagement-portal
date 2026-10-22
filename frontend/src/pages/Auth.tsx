import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { HeartHandshake, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../hooks/auth";
import { Brand } from "../components/Layout";
import { Button, Field } from "../components/ui";
import { api, send } from "../services/api";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
const pass = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");
const schema = z.object({
  name: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  kind: z.literal("donor").optional(),
  consent: z.boolean().optional(),
});
export function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: () => api("/config"),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(
      register
        ? schema.extend({
            name: z.string().min(2, "Enter your full name"),
            password: pass,
            consent: z.literal(true, {
              errorMap: () => ({
                message: "Please accept the collection notice",
              }),
            }),
          })
        : schema,
    ),
    defaultValues: { kind: "donor", consent: false },
  });
  if (auth.user) return <Navigate to="/" replace />;
  const submit = form.handleSubmit(async (v) => {
    setError("");
    try {
      if (register) await auth.register(v);
      else await auth.login({ email: v.email, password: v.password });
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
    }
  });
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="story-kicker">GOOD PEOPLE. SHARED PURPOSE.</span>
          <h1>
            Make a difference.
            <br />
            Stay connected.
          </h1>
          <p>
            A home for the people, contributions, and ideas that make our
            community stronger.
          </p>
          <div className="story-feature">
            <HeartHandshake />
            <span>Support meaningful community initiatives</span>
          </div>
          <div className="story-feature">
            <ShieldCheck />
            <span>Your information, handled with care</span>
          </div>
        </div>
        <small>Sydney Beacon Community Service Club</small>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="auth-mini-brand">BEACON COMMUNITY</span>
          <h2>{register ? "Join our community" : "Welcome back"}</h2>
          <p>
            {register
              ? "Create an account to donate and stay connected."
              : "Sign in to your community workspace."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <Field
                label="Full name"
                error={form.formState.errors.name?.message}
              >
                <input autoComplete="name" {...form.register("name")} />
              </Field>
            )}
            <Field
              label="Email address"
              error={form.formState.errors.email?.message}
            >
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...form.register("email")}
              />
            </Field>
            <Field
              label="Password"
              error={form.formState.errors.password?.message}
              hint={
                register
                  ? "12+ characters with uppercase, lowercase and a number"
                  : undefined
              }
            >
              <span className="password-wrap">
                <input
                  aria-label="Password"
                  type={show ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  {...form.register("password")}
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </Field>
            {register && (
              <>
                <p className="survey-privacy">
                  New accounts join as donors. Contact an administrator to
                  activate membership.
                </p>
                <label className="check-label">
                  <input type="checkbox" {...form.register("consent")} />
                  <span>
                    I agree that Sydney Beacon may store my details to manage
                    donations and membership. Account-linked survey responses
                    are identifiable.{" "}
                    <Link to="/privacy">Collection notice</Link>
                  </span>
                </label>
                {form.formState.errors.consent && (
                  <p className="field-error">
                    {form.formState.errors.consent.message}
                  </p>
                )}
              </>
            )}
            {!register && config?.emailEnabled && (
              <Link className="forgot" to="/forgot-password">
                Forgot password?
              </Link>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <Button
              loading={form.formState.isSubmitting}
              type="submit"
              className="full-width"
            >
              {register ? "Create account" : "Sign in"}
            </Button>
          </form>
          <p className="auth-switch">
            {register
              ? "Already part of the community?"
              : "New to the community?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <div className="auth-security">
            <ShieldCheck size={15} />
            Secure access to your community portal
          </div>
        </div>
      </section>
    </div>
  );
}
export function RecoveryPage({ reset = false }: { reset?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <div className="recovery-shell">
      <div className="auth-card">
        <Brand />
        <h2>{reset ? "Choose a new password" : "Reset your password"}</h2>
        <p>
          {reset
            ? "Use at least 12 characters, uppercase, lowercase and a number."
            : "We’ll email a recovery link if your account is active."}
        </p>
        {done ? (
          <p role="status">
            If an active account exists, a reset link will be emailed.
          </p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              const data = new FormData(e.currentTarget);
              try {
                if (reset) {
                  const p = pass.parse(data.get("password"));
                  await send("/auth/reset-password", {
                    token: params.get("token"),
                    password: p,
                  });
                  toast.success("Password reset. You can sign in now.");
                  navigate("/login");
                } else {
                  await send("/auth/forgot-password", {
                    email: data.get("email"),
                  });
                  setDone(true);
                }
              } catch (err) {
                setError(
                  err instanceof z.ZodError
                    ? err.errors[0].message
                    : (err as Error).message,
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label={reset ? "New password" : "Email address"}>
              <input
                name={reset ? "password" : "email"}
                type={reset ? "password" : "email"}
                required
                autoComplete={reset ? "new-password" : "email"}
              />
            </Field>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button loading={busy} type="submit">
              {reset ? "Update password" : "Send reset link"}
            </Button>
          </form>
        )}
        <Link className="back-link" to="/login">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
export function Privacy() {
  return (
    <div className="recovery-shell">
      <article className="privacy-card">
        <Brand />
        <h1>Collection notice</h1>
        <p>
          Sydney Beacon uses your name, email and profile details to administer
          your account, donations, receipts, membership and surveys.
        </p>
        <p>
          Authorised staff can access records needed for administration. Survey
          responses are linked to your account; the results interface presents
          answers without respondent names. Payment-card entry takes place with
          the payment provider, and card details are not stored in this portal.
        </p>
        <p>
          You can update your contact number and optional communication consent
          in Settings. Essential donation and account records are retained for
          administration and applicable recordkeeping obligations. Contact your
          club administrator to request access, correction, account closure or
          information about retention and deletion.
        </p>
        <p>
          Optional communication consent does not affect necessary account or
          receipt communications.
        </p>
        <Link to="/register">Back to registration</Link>
      </article>
    </div>
  );
}
