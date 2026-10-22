import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  ClipboardList,
  CalendarDays,
  Users,
  Pencil,
  BarChart3,
  Send,
} from "lucide-react";
import { api, send } from "../services/api";
import { useAuth, isStaff } from "../hooks/auth";
import { useList } from "../hooks/list";
import { date } from "../utils/format";
import {
  PageHeader,
  Button,
  Modal,
  Field,
  SearchBox,
  Skeleton,
  ErrorState,
  Empty,
  Pagination,
  Badge,
  Confirm,
} from "../components/ui";
import { toast } from "sonner";
type Question = {
  id?: string;
  label: string;
  type: "text" | "choice" | "rating";
  required: boolean;
  options: string[];
};
function SurveyBuilder({
  survey,
  onClose,
}: {
  survey?: any;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["survey", survey?.id],
    queryFn: () => api(`/surveys/${survey.id}`),
    enabled: !!survey,
  });
  return (
    <Modal
      title={survey ? "Edit survey" : "Create a survey"}
      onClose={onClose}
      wide
    >
      {survey && q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : (
        <BuilderForm initial={q.data} onClose={onClose} />
      )}
    </Modal>
  );
}
function BuilderForm({
  initial,
  onClose,
}: {
  initial?: any;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [title, setTitle] = useState(initial?.title || ""),
    [description, setDescription] = useState(initial?.description || ""),
    [audience, setAudience] = useState(initial?.audience || "members"),
    [closes, setCloses] = useState(
      initial?.closes_at
        ? new Date(initial.closes_at).toISOString().slice(0, 16)
        : "",
    );
  const [questions, setQuestions] = useState<Question[]>(
    initial?.questions || [
      { label: "", type: "text", required: true, options: [] },
    ],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const update = (i: number, v: Partial<Question>) =>
    setQuestions((q) => q.map((x, n) => (n === i ? { ...x, ...v } : x)));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
          await send(
            initial ? `/surveys/${initial.id}` : "/surveys",
            {
              title,
              description,
              audience,
              closesAt: closes ? new Date(closes).toISOString() : null,
              questions: questions.map((q) => ({
                label: q.label,
                type: q.type,
                required: q.required,
                options: q.type === "choice" ? q.options : [],
              })),
            },
            initial ? "PATCH" : "POST",
          );
          await client.invalidateQueries();
          toast.success("Survey draft saved");
          onClose();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Survey title">
        <input
          required
          minLength={3}
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What would you like to learn?"
        />
      </Field>
      <Field label="Introduction">
        <textarea
          rows={2}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="form-grid">
        <Field label="Audience">
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="members">Active members</option>
            <option value="all">All portal users</option>
          </select>
        </Field>
        <Field label="Closing date (optional)" hint="Date entered in UTC">
          <input
            type="datetime-local"
            value={closes}
            onChange={(e) => setCloses(e.target.value)}
          />
        </Field>
      </div>
      <div className="builder-heading">
        <h3>Questions</h3>
        <span>{questions.length} / 20</span>
      </div>
      {questions.map((q, i) => (
        <div className="question-builder" key={i}>
          <div className="question-number">
            <strong>Question {i + 1}</strong>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove question ${i + 1}`}
              disabled={questions.length <= 1}
              onClick={() => setQuestions(questions.filter((_, n) => n !== i))}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <Field label="Question">
            <input
              required
              minLength={2}
              maxLength={500}
              value={q.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
          </Field>
          <div className="form-grid">
            <Field label="Answer type">
              <select
                value={q.type}
                onChange={(e) =>
                  update(i, {
                    type: e.target.value as Question["type"],
                    options:
                      e.target.value === "choice"
                        ? ["Option 1", "Option 2"]
                        : [],
                  })
                }
              >
                <option value="text">Written answer</option>
                <option value="choice">Single choice</option>
                <option value="rating">Rating (1–5)</option>
              </select>
            </Field>
            <label className="check-label">
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => update(i, { required: e.target.checked })}
              />
              Required answer
            </label>
          </div>
          {q.type === "choice" && (
            <Field
              label="Options"
              hint="One option per line; 2–12 unique options"
            >
              <textarea
                rows={3}
                required
                value={q.options.join("\n")}
                onChange={(e) =>
                  update(i, { options: e.target.value.split("\n") })
                }
              />
            </Field>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        disabled={questions.length >= 20}
        onClick={() =>
          setQuestions([
            ...questions,
            { label: "", type: "text", required: true, options: [] },
          ])
        }
      >
        <Plus size={16} />
        Add question
      </Button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save draft
        </Button>
      </div>
    </form>
  );
}
function Respond({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["survey", id],
    queryFn: () => api(`/surveys/${id}`),
  });
  const client = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={q.data?.title || "Survey"} onClose={onClose}>
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <p className="muted">{q.data.description}</p>
          <p className="survey-privacy">
            Responses are linked to your account. You can submit once.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await send(`/surveys/${id}/responses`, {
                  answers: q.data.questions.map((x: any) => ({
                    questionId: x.id,
                    value: answers[x.id] || "",
                  })),
                });
                await client.invalidateQueries();
                toast.success("Thank you. Your response has been recorded.");
                onClose();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {q.data.questions.map((x: any) => (
              <Field key={x.id} label={`${x.label}${x.required ? " *" : ""}`}>
                {x.type === "text" ? (
                  <textarea
                    rows={3}
                    required={x.required}
                    maxLength={2000}
                    value={answers[x.id] || ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [x.id]: e.target.value })
                    }
                  />
                ) : x.type === "choice" ? (
                  <select
                    required={x.required}
                    value={answers[x.id] || ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [x.id]: e.target.value })
                    }
                  >
                    <option value="">Choose an answer</option>
                    {x.options.map((o: string) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <div className="rating-options">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label
                        key={n}
                        className={
                          answers[x.id] === String(n) ? "selected" : ""
                        }
                      >
                        <input
                          type="radio"
                          name={x.id}
                          required={x.required}
                          value={n}
                          checked={answers[x.id] === String(n)}
                          onChange={() =>
                            setAnswers({ ...answers, [x.id]: String(n) })
                          }
                        />
                        {n}
                      </label>
                    ))}
                  </div>
                )}
              </Field>
            ))}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Submit response
              </Button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
function Results({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["results", id],
    queryFn: () => api(`/surveys/${id}/results`),
  });
  return (
    <Modal title="Survey results" onClose={onClose} wide>
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorState error={q.error} />
      ) : (
        <>
          <h3>{q.data.title}</h3>
          <p className="muted">
            {q.data.responseCount} response
            {q.data.responseCount === 1 ? "" : "s"} · Summary omits respondent
            names
          </p>
          {q.data.questions.map((x: any) => (
            <section className="result-question" key={x.id}>
              <h3>{x.label}</h3>
              {!x.answers.filter(Boolean).length ? (
                <p className="muted">No answers yet.</p>
              ) : x.type === "text" ? (
                <ul className="written-answers">
                  {x.answers.filter(Boolean).map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : (
                <div>
                  {(x.type === "rating"
                    ? ["1", "2", "3", "4", "5"]
                    : x.options
                  ).map((o: string) => {
                    const count = x.answers.filter(
                      (a: string) => a === o,
                    ).length;
                    return (
                      <div className="result-bar" key={o}>
                        <span>{o}</span>
                        <div className="progress-track">
                          <div
                            style={{
                              width: `${(count / Math.max(1, q.data.responseCount)) * 100}%`,
                            }}
                          />
                        </div>
                        <strong>{count}</strong>
                      </div>
                    );
                  })}
                  {x.type === "rating" && (
                    <p className="muted">
                      Average:{" "}
                      {(
                        x.answers
                          .filter(Boolean)
                          .reduce((a: number, b: string) => a + Number(b), 0) /
                        x.answers.filter(Boolean).length
                      ).toFixed(1)}{" "}
                      / 5
                    </p>
                  )}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </Modal>
  );
}
export function Surveys() {
  const { user } = useAuth();
  const staff = isStaff(user);
  const list = useList();
  const client = useQueryClient();
  const [builder, setBuilder] = useState<any>(undefined),
    [respond, setRespond] = useState(""),
    [results, setResults] = useState(""),
    [confirm, setConfirm] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["surveys", list.query],
    queryFn: () => api(`/surveys?${list.query}`),
  });
  return (
    <>
      <PageHeader
        eyebrow="LISTEN. LEARN. CONNECT."
        title="Community surveys"
        description={
          staff
            ? "Create thoughtful conversations and understand your community."
            : "Share your perspective and help shape what comes next."
        }
        action={
          staff ? (
            <Button onClick={() => setBuilder(null)}>
              <Plus size={18} />
              Create survey
            </Button>
          ) : undefined
        }
      />
      <div className="toolbar survey-toolbar">
        <SearchBox
          value={list.search}
          onChange={list.setSearch}
          placeholder="Search surveys…"
        />
        {staff && (
          <select
            aria-label="Filter survey status"
            value={list.status}
            onChange={(e) => list.setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        )}
      </div>
      {q.isLoading ? (
        <Skeleton />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : !q.data.data.length ? (
        <section className="card">
          <Empty
            title="No surveys available"
            description={
              staff
                ? "Create a survey to start gathering feedback."
                : "You’ll see surveys here when they’re published for your audience."
            }
          />
        </section>
      ) : (
        <div className="survey-grid">
          {q.data.data.map((s: any) => (
            <article className="card survey-card" key={s.id}>
              <div className="survey-card-top">
                <span className="survey-icon">
                  <ClipboardList size={24} />
                </span>
                <Badge value={s.status} />
              </div>
              <h2>{s.title}</h2>
              <p>{s.description || "Share feedback with your community."}</p>
              <div className="survey-meta">
                <span>
                  <Users size={16} />
                  {s.audience === "members"
                    ? "Active members"
                    : "All portal users"}
                </span>
                <span>
                  <CalendarDays size={16} />
                  {s.closes_at
                    ? `Closes ${date(s.closes_at)}`
                    : "No closing date"}
                </span>
              </div>
              <div className="survey-card-bottom">
                <span>
                  {staff
                    ? `${s.response_count} responses`
                    : s.responded
                      ? "Response submitted"
                      : "Your voice matters"}
                </span>
                <div>
                  {staff ? (
                    <>
                      {s.status === "draft" && (
                        <button
                          className="icon-btn"
                          aria-label={`Edit ${s.title}`}
                          onClick={() => setBuilder(s)}
                        >
                          <Pencil size={18} />
                        </button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => setResults(s.id)}
                      >
                        <BarChart3 size={16} />
                        Results
                      </Button>
                      {s.status !== "closed" && (
                        <Button
                          variant={
                            s.status === "draft" ? "primary" : "secondary"
                          }
                          onClick={() => setConfirm(s)}
                        >
                          {s.status === "draft" ? "Publish" : "Close"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      disabled={s.responded}
                      onClick={() => setRespond(s.id)}
                    >
                      {s.responded ? "Completed" : "Take survey"}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {q.data && (
        <Pagination
          page={list.page}
          total={q.data.total}
          onChange={list.setPage}
        />
      )}{" "}
      {builder !== undefined && (
        <SurveyBuilder survey={builder} onClose={() => setBuilder(undefined)} />
      )}{" "}
      {respond && <Respond id={respond} onClose={() => setRespond("")} />}{" "}
      {results && <Results id={results} onClose={() => setResults("")} />}{" "}
      {confirm && (
        <Confirm
          title={
            confirm.status === "draft"
              ? "Publish this survey?"
              : "Close this survey?"
          }
          description={
            confirm.status === "draft"
              ? "The survey will be available to its audience. Published questions cannot be edited."
              : "New responses will no longer be accepted. Results will remain available."
          }
          loading={busy}
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await send(`/surveys/${confirm.id}/status`, {
                status: confirm.status === "draft" ? "published" : "closed",
              });
              await client.invalidateQueries();
              toast.success("Survey status updated");
              setConfirm(null);
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}
