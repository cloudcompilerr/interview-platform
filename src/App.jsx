import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

/* ==========================================================================
   Constants & default data
   ========================================================================== */

const STORAGE_KEYS = {
  session: 'ip_session_v1',
  domains: 'ip_domains_v1',
  interviews: 'ip_interviews_v1',
};

const RATING_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

const RECOMMENDATION_OPTIONS = ['RECOMMEND', 'CONSIDER', 'REJECT'];
const RECOMMENDATION_LABELS = {
  RECOMMEND: 'Recommend',
  CONSIDER: 'Consider',
  REJECT: 'Reject',
};
const RECOMMENDATION_TONES = {
  RECOMMEND: 'success',
  CONSIDER: 'warning',
  REJECT: 'danger',
};

const STATUS_LABELS = { in_progress: 'In Progress', completed: 'Completed' };
const STATUS_TONES = { in_progress: 'info', completed: 'success' };

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'new', label: 'New Interview' },
  { id: 'questions', label: 'Question Bank' },
  { id: 'data', label: 'Data & Reports' },
];

const DEFAULT_DOMAINS = [
  {
    id: 'computer-vision',
    name: 'Computer Vision',
    questions: [
      { id: 'cv-q1', text: 'Explain the difference between object detection and image segmentation. When would you use each?' },
      { id: 'cv-q2', text: 'Walk through how a Convolutional Neural Network processes an image, layer by layer.' },
      { id: 'cv-q3', text: 'How would you handle a dataset with severe class imbalance in an image classification task?' },
      { id: 'cv-q4', text: 'Describe a time you had to optimize a computer vision model for inference speed on edge devices.' },
    ],
  },
  {
    id: 'generative-ai',
    name: 'Generative AI',
    questions: [
      { id: 'genai-q1', text: 'Explain how transformer attention mechanisms work and why they replaced RNNs for most NLP tasks.' },
      { id: 'genai-q2', text: 'What is the difference between fine-tuning, RAG, and prompt engineering? When would you choose each?' },
      { id: 'genai-q3', text: 'How would you mitigate hallucinations in a production LLM application?' },
      { id: 'genai-q4', text: 'Describe how you would evaluate the quality of a generative AI system before shipping it.' },
    ],
  },
  {
    id: 'behavioral-sdlc',
    name: 'Behavioral & SDLC',
    questions: [
      { id: 'beh-q1', text: "Tell me about a time you disagreed with a teammate's technical decision. How did you handle it?" },
      { id: 'beh-q2', text: "Walk me through your team's code review and deployment process at your last role." },
      { id: 'beh-q3', text: 'Describe a production incident you were involved in. What was the root cause and what did you change afterward?' },
      { id: 'beh-q4', text: 'How do you prioritize tasks when given conflicting deadlines from different stakeholders?' },
    ],
  },
];

/* ==========================================================================
   Pure utility helpers
   ========================================================================== */

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
}

function average(numbers) {
  const valid = (numbers || []).filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!valid.length) return null;
  return valid.reduce((sum, n) => sum + n, 0) / valid.length;
}

function formatScore(value) {
  return value === null || value === undefined ? '—' : Number(value).toFixed(1);
}

function slugify(text) {
  const slug = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'interview';
}

function byteSize(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return JSON.stringify(value).length;
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function safeLoad(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (error) {
    console.error(`Failed to load "${key}" from localStorage:`, error);
    return fallback;
  }
}

function safeSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed to save "${key}" to localStorage:`, error);
    return false;
  }
}

function mergeById(existing, incoming) {
  const map = new Map((existing || []).map((item) => [item.id, item]));
  (incoming || []).forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

function downloadFile(filename, content, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Download failed:', error);
    return false;
  }
}

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildInterview({ candidateName, interviewer, date, notes, domain }) {
  return {
    id: generateId(),
    candidateName,
    domainId: domain.id,
    domainName: domain.name,
    interviewer: interviewer || 'Unspecified',
    date,
    notes: notes || '',
    status: 'in_progress',
    responses: domain.questions.map((q) => ({
      questionId: q.id,
      questionText: q.text,
      response: '',
      rating: null,
    })),
    technicalScore: null,
    behavioralScore: null,
    sdlcScore: null,
    overallAssessment: '',
    recommendation: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
  };
}

function buildTxtReport(interview) {
  const divider = '='.repeat(60);
  const sub = '-'.repeat(60);
  const avgRating = average(interview.responses.map((r) => r.rating));
  const overall = average([interview.technicalScore, interview.behavioralScore, interview.sdlcScore]);
  const lines = [];

  lines.push(divider, 'INTERVIEW ASSESSMENT REPORT', divider, '');
  lines.push(`Candidate:    ${interview.candidateName}`);
  lines.push(`Domain:       ${interview.domainName}`);
  lines.push(`Interviewer:  ${interview.interviewer || '—'}`);
  lines.push(`Date:         ${formatDate(interview.date)}`);
  lines.push(`Status:       ${STATUS_LABELS[interview.status] || interview.status}`);
  lines.push('', sub, 'QUESTIONS & RESPONSES', sub);

  interview.responses.forEach((r, idx) => {
    lines.push('', `${idx + 1}. ${r.questionText}`);
    lines.push(`   Response: ${r.response ? r.response : '(no response recorded)'}`);
    lines.push(`   Rating:   ${r.rating ? `${r.rating}/10` : 'Not rated'}`);
  });

  lines.push('', sub, 'SCORES', sub);
  lines.push(`Technical Score:          ${formatScore(interview.technicalScore)}/10`);
  lines.push(`Behavioral Score:         ${formatScore(interview.behavioralScore)}/10`);
  lines.push(`SDLC Score:               ${formatScore(interview.sdlcScore)}/10`);
  lines.push(`Average Question Rating:  ${formatScore(avgRating)}/10`);
  lines.push(`Overall Score:            ${formatScore(overall)}/10`);

  lines.push('', sub, 'OVERALL ASSESSMENT', sub);
  lines.push(interview.overallAssessment || '(no assessment notes recorded)');

  lines.push('', sub, `RECOMMENDATION: ${interview.recommendation || 'PENDING'}`, sub, '');
  lines.push(`Generated by Interview Platform on ${formatDateTime(nowIso())}`);

  return lines.join('\n');
}

function buildCsvReport(interview) {
  const rows = [];
  rows.push(['Field', 'Value']);
  rows.push(['Candidate', interview.candidateName]);
  rows.push(['Domain', interview.domainName]);
  rows.push(['Interviewer', interview.interviewer || '']);
  rows.push(['Date', interview.date || '']);
  rows.push(['Status', STATUS_LABELS[interview.status] || interview.status]);
  rows.push(['Technical Score', interview.technicalScore ?? '']);
  rows.push(['Behavioral Score', interview.behavioralScore ?? '']);
  rows.push(['SDLC Score', interview.sdlcScore ?? '']);
  rows.push(['Overall Assessment', interview.overallAssessment || '']);
  rows.push(['Recommendation', interview.recommendation || '']);
  rows.push([]);
  rows.push(['#', 'Question', 'Response', 'Rating (1-10)']);
  interview.responses.forEach((r, idx) => {
    rows.push([idx + 1, r.questionText, r.response || '', r.rating ?? '']);
  });
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

function buildJsonReport(interview) {
  return JSON.stringify(interview, null, 2);
}

function buildBackupPayload(domains, interviews) {
  return {
    version: 1,
    exportedAt: nowIso(),
    domains,
    interviews,
  };
}

/* ==========================================================================
   Small presentational components
   ========================================================================== */

function Badge({ tone = 'neutral', children }) {
  return <span className={`ip-badge ip-badge-${tone}`}>{children}</span>;
}

function EmptyState({ title, body }) {
  return (
    <div className="ip-empty-state">
      <h3>{title}</h3>
      <p className="ip-text-muted">{body}</p>
    </div>
  );
}

function ToastBanner({ toast }) {
  if (!toast) return null;
  return (
    <div className={`ip-toast ip-toast-${toast.type}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Interview Platform crashed:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="ip-login-screen">
          <div className="ip-login-card">
            <h1>Something went wrong</h1>
            <p className="ip-text-muted">
              An unexpected error occurred. Your saved data is untouched in localStorage — try again or refresh the page.
            </p>
            <button type="button" className="ip-btn ip-btn-primary ip-btn-block" onClick={this.handleReset}>
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <InterviewPlatform />
    </ErrorBoundary>
  );
}

/* ==========================================================================
   Login
   ========================================================================== */

function LoginView({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Enter any username and password to continue.');
      return;
    }
    setError('');
    onLogin(username.trim());
  }

  return (
    <div className="ip-login-screen">
      <div className="ip-login-card">
        <h1>Interview Platform</h1>
        <p className="ip-text-muted">Zero-cost, offline-first interview management.</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="ip-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. jordan.lee"
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="ip-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="any password works"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="ip-form-error">{error}</p>}
          <button type="submit" className="ip-btn ip-btn-primary ip-btn-block">
            Sign In
          </button>
        </form>
        <p className="ip-login-note">
          Demo authentication — any username and password works. Nothing leaves this device.
        </p>
      </div>
    </div>
  );
}

/* ==========================================================================
   Navigation shell
   ========================================================================== */

function NavShell({ session, view, onNavigate, onLogout, mobileNavOpen, setMobileNavOpen, children }) {
  return (
    <div className="ip-app-shell">
      <div
        className={`ip-sidebar-backdrop ${mobileNavOpen ? 'ip-sidebar-backdrop-open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside className={`ip-sidebar ${mobileNavOpen ? 'ip-sidebar-open' : ''}`}>
        <div className="ip-sidebar-header">
          <h2>Interview Platform</h2>
          <p className="ip-text-muted ip-small">Offline &middot; $0/month</p>
        </div>
        <nav className="ip-nav-list">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ip-nav-item ${view === item.id ? 'ip-nav-item-active' : ''}`}
              onClick={() => {
                onNavigate(item.id);
                setMobileNavOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="ip-sidebar-footer">
          <p className="ip-small">
            Signed in as <strong>{session.username}</strong>
          </p>
          <button type="button" className="ip-btn ip-btn-ghost ip-btn-block ip-btn-sm" onClick={onLogout}>
            Log Out
          </button>
        </div>
      </aside>
      <div className="ip-main-column">
        <header className="ip-topbar">
          <button
            type="button"
            className="ip-icon-btn"
            aria-label="Toggle navigation"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            &#9776;
          </button>
          <strong>Interview Platform</strong>
        </header>
        <main className="ip-main">{children}</main>
      </div>
    </div>
  );
}

/* ==========================================================================
   Dashboard
   ========================================================================== */

function DashboardView({ session, domains, interviews, onNavigate, onResume, onViewReport }) {
  const stats = useMemo(() => {
    const completed = interviews.filter((iv) => iv.status === 'completed');
    const inProgress = interviews.filter((iv) => iv.status === 'in_progress');
    const byDomain = domains.map((domain) => ({
      domain,
      count: interviews.filter((iv) => iv.domainId === domain.id).length,
    }));
    const byRecommendation = RECOMMENDATION_OPTIONS.map((rec) => ({
      rec,
      count: completed.filter((iv) => iv.recommendation === rec).length,
    }));
    const overallScores = completed
      .map((iv) => average([iv.technicalScore, iv.behavioralScore, iv.sdlcScore]))
      .filter((n) => n !== null);
    const recent = [...interviews]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5);

    return {
      total: interviews.length,
      completedCount: completed.length,
      inProgressCount: inProgress.length,
      byDomain,
      byRecommendation,
      averageOverallScore: average(overallScores),
      recent,
    };
  }, [domains, interviews]);

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>Welcome back, {session.username}</h1>
          <p className="ip-text-muted">Here's how your interview pipeline looks today.</p>
        </div>
        <button type="button" className="ip-btn ip-btn-primary" onClick={() => onNavigate('new')}>
          New Interview
        </button>
      </div>

      <div className="ip-grid-stats">
        <div className="ip-stat-card">
          <span className="ip-stat-value">{stats.total}</span>
          <span className="ip-stat-label">Total Interviews</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{stats.completedCount}</span>
          <span className="ip-stat-label">Completed</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{stats.inProgressCount}</span>
          <span className="ip-stat-label">In Progress</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{formatScore(stats.averageOverallScore)}</span>
          <span className="ip-stat-label">Avg. Overall Score</span>
        </div>
      </div>

      <div className="ip-two-col">
        <div className="ip-card">
          <h3>Interviews by Domain</h3>
          {stats.byDomain.map(({ domain, count }) => (
            <div className="ip-bar-row" key={domain.id}>
              <span>{domain.name}</span>
              <span className="ip-text-muted">{count}</span>
            </div>
          ))}
        </div>
        <div className="ip-card">
          <h3>Recommendations (Completed)</h3>
          {stats.byRecommendation.map(({ rec, count }) => (
            <div className="ip-bar-row" key={rec}>
              <Badge tone={RECOMMENDATION_TONES[rec]}>{RECOMMENDATION_LABELS[rec]}</Badge>
              <span className="ip-text-muted">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ip-card">
        <h3>Recent Activity</h3>
        {stats.recent.length === 0 ? (
          <EmptyState
            title="No interviews yet"
            body="Start your first interview to see it show up here."
          />
        ) : (
          <div className="ip-table-wrap">
            <table className="ip-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Domain</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((iv) => (
                  <tr key={iv.id}>
                    <td>{iv.candidateName}</td>
                    <td>{iv.domainName}</td>
                    <td>
                      <Badge tone={STATUS_TONES[iv.status]}>{STATUS_LABELS[iv.status]}</Badge>
                    </td>
                    <td>{formatDateTime(iv.updatedAt)}</td>
                    <td className="ip-table-actions">
                      {iv.status === 'in_progress' ? (
                        <button type="button" className="ip-btn ip-btn-sm ip-btn-secondary" onClick={() => onResume(iv.id)}>
                          Continue
                        </button>
                      ) : (
                        <button type="button" className="ip-btn ip-btn-sm ip-btn-secondary" onClick={() => onViewReport(iv.id)}>
                          View Report
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   New Interview
   ========================================================================== */

function NewInterviewView({ domains, defaultInterviewer, onCreate, onCancel }) {
  const [candidateName, setCandidateName] = useState('');
  const [domainId, setDomainId] = useState(domains[0]?.id || '');
  const [interviewer, setInterviewer] = useState(defaultInterviewer || '');
  const [date, setDate] = useState(todayInputDate());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (!candidateName.trim()) {
      setError('Candidate name is required.');
      return;
    }
    const domain = domains.find((d) => d.id === domainId);
    if (!domain) {
      setError('Please select a domain.');
      return;
    }
    setError('');
    onCreate({
      candidateName: candidateName.trim(),
      domain,
      interviewer: interviewer.trim(),
      date,
      notes: notes.trim(),
    });
  }

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>New Interview</h1>
          <p className="ip-text-muted">Set up a new interview session for a candidate.</p>
        </div>
      </div>
      <div className="ip-card ip-card-narrow">
        <form onSubmit={handleSubmit} noValidate>
          <div className="ip-field">
            <label htmlFor="ni-candidate">Candidate Name *</label>
            <input
              id="ni-candidate"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              autoFocus
            />
          </div>
          <div className="ip-field">
            <label htmlFor="ni-domain">Domain *</label>
            <select id="ni-domain" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.questions.length} questions)
                </option>
              ))}
            </select>
          </div>
          <div className="ip-field">
            <label htmlFor="ni-interviewer">Interviewer</label>
            <input
              id="ni-interviewer"
              value={interviewer}
              onChange={(e) => setInterviewer(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="ip-field">
            <label htmlFor="ni-date">Date</label>
            <input id="ni-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="ip-field">
            <label htmlFor="ni-notes">Notes (optional)</label>
            <textarea
              id="ni-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context about this candidate or role..."
            />
          </div>
          {error && <p className="ip-form-error">{error}</p>}
          <div className="ip-form-actions">
            <button type="button" className="ip-btn ip-btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="ip-btn ip-btn-primary">
              Start Interview
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==========================================================================
   Interview Session
   ========================================================================== */

function SessionView({ interview, onUpdateResponse, onUpdateInterview, onComplete, onBack }) {
  const [tab, setTab] = useState('questions');

  if (!interview) {
    return (
      <EmptyState title="Interview not found" body="It may have been deleted. Go back to the dashboard." />
    );
  }

  const answeredCount = interview.responses.filter((r) => r.rating !== null).length;

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>{interview.candidateName}</h1>
          <p className="ip-text-muted">
            {interview.domainName} &middot; Interviewer: {interview.interviewer} &middot; {formatDate(interview.date)}
          </p>
        </div>
        <Badge tone={STATUS_TONES[interview.status]}>{STATUS_LABELS[interview.status]}</Badge>
      </div>

      <div className="ip-tabs">
        <button
          type="button"
          className={`ip-tab ${tab === 'questions' ? 'ip-tab-active' : ''}`}
          onClick={() => setTab('questions')}
        >
          Questions ({answeredCount}/{interview.responses.length} rated)
        </button>
        <button
          type="button"
          className={`ip-tab ${tab === 'assessment' ? 'ip-tab-active' : ''}`}
          onClick={() => setTab('assessment')}
        >
          Final Assessment
        </button>
      </div>

      {tab === 'questions' ? (
        <div>
          {interview.responses.map((r, idx) => (
            <div className="ip-question-card" key={r.questionId}>
              <p className="ip-question-text">
                {idx + 1}. {r.questionText}
              </p>
              <div className="ip-field">
                <label htmlFor={`resp-${r.questionId}`}>Candidate Response</label>
                <textarea
                  id={`resp-${r.questionId}`}
                  rows={3}
                  value={r.response}
                  onChange={(e) =>
                    onUpdateResponse(interview.id, r.questionId, { response: e.target.value })
                  }
                  placeholder="Record what the candidate said..."
                />
              </div>
              <div className="ip-field ip-field-inline">
                <label htmlFor={`rate-${r.questionId}`}>Rating</label>
                <select
                  id={`rate-${r.questionId}`}
                  value={r.rating ?? ''}
                  onChange={(e) =>
                    onUpdateResponse(interview.id, r.questionId, {
                      rating: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                >
                  <option value="">Not rated</option>
                  {RATING_VALUES.map((n) => (
                    <option key={n} value={n}>
                      {n}/10
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          <div className="ip-form-actions">
            <button type="button" className="ip-btn ip-btn-ghost" onClick={onBack}>
              Back to Dashboard
            </button>
            <button type="button" className="ip-btn ip-btn-primary" onClick={() => setTab('assessment')}>
              Continue to Assessment
            </button>
          </div>
        </div>
      ) : (
        <div className="ip-card ip-card-narrow">
          <div className="ip-field">
            <label htmlFor="tech-score">Technical Score</label>
            <select
              id="tech-score"
              value={interview.technicalScore ?? ''}
              onChange={(e) =>
                onUpdateInterview(interview.id, {
                  technicalScore: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Select score</option>
              {RATING_VALUES.map((n) => (
                <option key={n} value={n}>
                  {n}/10
                </option>
              ))}
            </select>
          </div>
          <div className="ip-field">
            <label htmlFor="beh-score">Behavioral Score</label>
            <select
              id="beh-score"
              value={interview.behavioralScore ?? ''}
              onChange={(e) =>
                onUpdateInterview(interview.id, {
                  behavioralScore: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Select score</option>
              {RATING_VALUES.map((n) => (
                <option key={n} value={n}>
                  {n}/10
                </option>
              ))}
            </select>
          </div>
          <div className="ip-field">
            <label htmlFor="sdlc-score">SDLC Score</label>
            <select
              id="sdlc-score"
              value={interview.sdlcScore ?? ''}
              onChange={(e) =>
                onUpdateInterview(interview.id, {
                  sdlcScore: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Select score</option>
              {RATING_VALUES.map((n) => (
                <option key={n} value={n}>
                  {n}/10
                </option>
              ))}
            </select>
          </div>
          <div className="ip-field">
            <label htmlFor="overall-assessment">Overall Assessment</label>
            <textarea
              id="overall-assessment"
              rows={4}
              value={interview.overallAssessment}
              onChange={(e) => onUpdateInterview(interview.id, { overallAssessment: e.target.value })}
              placeholder="Summarize strengths, gaps, and concerns..."
            />
          </div>
          <div className="ip-field">
            <label htmlFor="recommendation">Recommendation</label>
            <select
              id="recommendation"
              value={interview.recommendation ?? ''}
              onChange={(e) => onUpdateInterview(interview.id, { recommendation: e.target.value || null })}
            >
              <option value="">Select recommendation</option>
              {RECOMMENDATION_OPTIONS.map((rec) => (
                <option key={rec} value={rec}>
                  {RECOMMENDATION_LABELS[rec]}
                </option>
              ))}
            </select>
          </div>
          <div className="ip-form-actions">
            <button type="button" className="ip-btn ip-btn-ghost" onClick={() => setTab('questions')}>
              Back to Questions
            </button>
            <button type="button" className="ip-btn ip-btn-primary" onClick={() => onComplete(interview.id)}>
              Complete Interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Question Bank
   ========================================================================== */

function QuestionBankView({ domains, onAddQuestion, onDeleteQuestion }) {
  const [selectedDomainId, setSelectedDomainId] = useState(domains[0]?.id || '');
  const [newQuestion, setNewQuestion] = useState('');

  const selectedDomain = domains.find((d) => d.id === selectedDomainId) || domains[0];

  function handleAdd(event) {
    event.preventDefault();
    if (!newQuestion.trim() || !selectedDomain) return;
    onAddQuestion(selectedDomain.id, newQuestion.trim());
    setNewQuestion('');
  }

  function handleDelete(questionId) {
    if (window.confirm('Delete this question? This cannot be undone.')) {
      onDeleteQuestion(selectedDomain.id, questionId);
    }
  }

  if (!selectedDomain) {
    return <EmptyState title="No domains configured" body="Domains could not be loaded." />;
  }

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>Question Bank</h1>
          <p className="ip-text-muted">Manage interview questions for each domain.</p>
        </div>
      </div>

      <div className="ip-tabs">
        {domains.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`ip-tab ${selectedDomain.id === d.id ? 'ip-tab-active' : ''}`}
            onClick={() => setSelectedDomainId(d.id)}
          >
            {d.name} ({d.questions.length})
          </button>
        ))}
      </div>

      <div className="ip-card">
        <h3>Add a Question</h3>
        <form onSubmit={handleAdd} className="ip-form-inline">
          <textarea
            rows={2}
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder={`New question for ${selectedDomain.name}...`}
          />
          <button type="submit" className="ip-btn ip-btn-primary">
            Add Question
          </button>
        </form>
      </div>

      <div className="ip-card">
        <h3>{selectedDomain.name} Questions</h3>
        {selectedDomain.questions.length === 0 ? (
          <EmptyState title="No questions yet" body="Add your first question above." />
        ) : (
          selectedDomain.questions.map((q, idx) => (
            <div className="ip-question-card ip-question-card-compact" key={q.id}>
              <p>
                {idx + 1}. {q.text}
              </p>
              <button type="button" className="ip-btn ip-btn-sm ip-btn-danger" onClick={() => handleDelete(q.id)}>
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Data Management
   ========================================================================== */

function DataView({ domains, interviews, onDeleteInterview, onViewReport, onResume, onExportAll, onImport }) {
  const fileInputRef = useRef(null);

  const stats = useMemo(() => {
    const domainsBytes = byteSize(domains);
    const interviewsBytes = byteSize(interviews);
    const questionCount = domains.reduce((sum, d) => sum + d.questions.length, 0);
    return {
      domainsBytes,
      interviewsBytes,
      totalBytes: domainsBytes + interviewsBytes,
      questionCount,
    };
  }, [domains, interviews]);

  const sortedInterviews = useMemo(
    () => [...interviews].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [interviews]
  );

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (file) onImport(file);
    event.target.value = '';
  }

  function handleDelete(interview) {
    if (window.confirm(`Delete the interview for ${interview.candidateName}? This cannot be undone.`)) {
      onDeleteInterview(interview.id);
    }
  }

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>Data & Reports</h1>
          <p className="ip-text-muted">View, export, back up and restore all interview data.</p>
        </div>
      </div>

      <div className="ip-two-col">
        <div className="ip-card">
          <h3>Storage Usage</h3>
          <div className="ip-bar-row">
            <span>Interviews</span>
            <span className="ip-text-muted">{interviews.length}</span>
          </div>
          <div className="ip-bar-row">
            <span>Domains</span>
            <span className="ip-text-muted">{domains.length}</span>
          </div>
          <div className="ip-bar-row">
            <span>Questions</span>
            <span className="ip-text-muted">{stats.questionCount}</span>
          </div>
          <div className="ip-bar-row">
            <span>Approx. localStorage used</span>
            <span className="ip-text-muted">{formatBytes(stats.totalBytes)}</span>
          </div>
          <p className="ip-small ip-text-muted">
            Browsers typically allow 5&ndash;10&nbsp;MB of localStorage per site &mdash; plenty for thousands of interviews.
          </p>
        </div>

        <div className="ip-card">
          <h3>Backup & Restore</h3>
          <p className="ip-text-muted">Export everything to a JSON file, or restore from a previous backup.</p>
          <div className="ip-form-actions ip-form-actions-start">
            <button type="button" className="ip-btn ip-btn-primary" onClick={onExportAll}>
              Export All Data (JSON)
            </button>
            <button type="button" className="ip-btn ip-btn-secondary" onClick={handleImportClick}>
              Import Backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
          <p className="ip-small ip-text-muted">
            Importing merges by ID &mdash; existing interviews and domains with matching IDs are updated, new ones are added.
          </p>
        </div>
      </div>

      <div className="ip-card">
        <h3>All Interviews</h3>
        {sortedInterviews.length === 0 ? (
          <EmptyState title="No interviews recorded" body="Create your first interview to see it here." />
        ) : (
          <div className="ip-table-wrap">
            <table className="ip-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Domain</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Recommendation</th>
                  <th>Score</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedInterviews.map((iv) => {
                  const overall = average([iv.technicalScore, iv.behavioralScore, iv.sdlcScore]);
                  return (
                    <tr key={iv.id}>
                      <td>{iv.candidateName}</td>
                      <td>{iv.domainName}</td>
                      <td>{formatDate(iv.date)}</td>
                      <td>
                        <Badge tone={STATUS_TONES[iv.status]}>{STATUS_LABELS[iv.status]}</Badge>
                      </td>
                      <td>
                        {iv.recommendation ? (
                          <Badge tone={RECOMMENDATION_TONES[iv.recommendation]}>
                            {RECOMMENDATION_LABELS[iv.recommendation]}
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Pending</Badge>
                        )}
                      </td>
                      <td>{formatScore(overall)}</td>
                      <td className="ip-table-actions">
                        {iv.status === 'in_progress' ? (
                          <button type="button" className="ip-btn ip-btn-sm ip-btn-secondary" onClick={() => onResume(iv.id)}>
                            Resume
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ip-btn ip-btn-sm ip-btn-secondary"
                            onClick={() => onViewReport(iv.id)}
                          >
                            Report
                          </button>
                        )}
                        <button type="button" className="ip-btn ip-btn-sm ip-btn-danger" onClick={() => handleDelete(iv)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   Report View
   ========================================================================== */

function ReportView({ interview, onDownloadTxt, onDownloadJson, onDownloadCsv, onBack, onDelete }) {
  if (!interview) {
    return <EmptyState title="Interview not found" body="It may have been deleted. Go back to the dashboard." />;
  }

  const avgRating = average(interview.responses.map((r) => r.rating));
  const overall = average([interview.technicalScore, interview.behavioralScore, interview.sdlcScore]);

  return (
    <div>
      <div className="ip-page-header">
        <div>
          <h1>{interview.candidateName}</h1>
          <p className="ip-text-muted">
            {interview.domainName} &middot; Interviewer: {interview.interviewer} &middot; {formatDate(interview.date)}
          </p>
        </div>
        <Badge tone={STATUS_TONES[interview.status]}>{STATUS_LABELS[interview.status]}</Badge>
      </div>

      <div className="ip-form-actions ip-form-actions-start ip-no-print">
        <button type="button" className="ip-btn ip-btn-secondary" onClick={() => onDownloadTxt(interview)}>
          Download TXT
        </button>
        <button type="button" className="ip-btn ip-btn-secondary" onClick={() => onDownloadJson(interview)}>
          Download JSON
        </button>
        <button type="button" className="ip-btn ip-btn-secondary" onClick={() => onDownloadCsv(interview)}>
          Download CSV
        </button>
      </div>

      <div className="ip-grid-stats">
        <div className="ip-stat-card">
          <span className="ip-stat-value">{formatScore(interview.technicalScore)}</span>
          <span className="ip-stat-label">Technical</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{formatScore(interview.behavioralScore)}</span>
          <span className="ip-stat-label">Behavioral</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{formatScore(interview.sdlcScore)}</span>
          <span className="ip-stat-label">SDLC</span>
        </div>
        <div className="ip-stat-card">
          <span className="ip-stat-value">{formatScore(overall)}</span>
          <span className="ip-stat-label">Overall</span>
        </div>
      </div>

      <div className="ip-card">
        <h3>Recommendation</h3>
        {interview.recommendation ? (
          <Badge tone={RECOMMENDATION_TONES[interview.recommendation]}>
            {RECOMMENDATION_LABELS[interview.recommendation]}
          </Badge>
        ) : (
          <Badge tone="neutral">Pending</Badge>
        )}
      </div>

      <div className="ip-card">
        <h3>Overall Assessment</h3>
        <p>{interview.overallAssessment || 'No assessment notes recorded yet.'}</p>
      </div>

      <div className="ip-card">
        <h3>Questions & Responses (avg. rating {formatScore(avgRating)}/10)</h3>
        {interview.responses.map((r, idx) => (
          <div className="ip-question-card ip-question-card-compact" key={r.questionId}>
            <p className="ip-question-text">
              {idx + 1}. {r.questionText}
            </p>
            <p>{r.response || <span className="ip-text-muted">No response recorded.</span>}</p>
            <Badge tone="neutral">{r.rating ? `${r.rating}/10` : 'Not rated'}</Badge>
          </div>
        ))}
      </div>

      <div className="ip-form-actions ip-no-print">
        <button type="button" className="ip-btn ip-btn-ghost" onClick={onBack}>
          Back to Dashboard
        </button>
        <button
          type="button"
          className="ip-btn ip-btn-danger"
          onClick={() => {
            if (window.confirm(`Delete the interview for ${interview.candidateName}? This cannot be undone.`)) {
              onDelete(interview.id);
            }
          }}
        >
          Delete Interview
        </button>
      </div>
    </div>
  );
}

/* ==========================================================================
   Main application component
   ========================================================================== */

function InterviewPlatform() {
  const [session, setSession] = useState(() => safeLoad(STORAGE_KEYS.session, null));
  const [domains, setDomains] = useState(() => {
    const loaded = safeLoad(STORAGE_KEYS.domains, null);
    return loaded && Array.isArray(loaded) && loaded.length > 0 ? loaded : DEFAULT_DOMAINS;
  });
  const [interviews, setInterviews] = useState(() => safeLoad(STORAGE_KEYS.interviews, []));
  const [view, setView] = useState('dashboard');
  const [activeInterviewId, setActiveInterviewId] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    safeSave(STORAGE_KEYS.domains, domains);
  }, [domains]);

  useEffect(() => {
    safeSave(STORAGE_KEYS.interviews, interviews);
  }, [interviews]);

  useEffect(() => {
    if (session) {
      safeSave(STORAGE_KEYS.session, session);
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.session);
      } catch (error) {
        console.error('Failed to clear session from localStorage:', error);
      }
    }
  }, [session]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  const activeInterview = useMemo(
    () => interviews.find((iv) => iv.id === activeInterviewId) || null,
    [interviews, activeInterviewId]
  );

  const handleLogin = useCallback((username) => {
    setSession({ username, loginAt: nowIso() });
    setView('dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    setSession(null);
    setActiveInterviewId(null);
    setView('dashboard');
  }, []);

  const handleNavigate = useCallback((targetView) => {
    setView(targetView);
  }, []);

  const handleCreateInterview = useCallback(
    (formData) => {
      const interview = buildInterview(formData);
      setInterviews((prev) => [interview, ...prev]);
      setActiveInterviewId(interview.id);
      setView('session');
      showToast(`Interview started for ${interview.candidateName}.`, 'success');
    },
    [showToast]
  );

  const handleUpdateResponse = useCallback((interviewId, questionId, patch) => {
    setInterviews((prev) =>
      prev.map((iv) =>
        iv.id !== interviewId
          ? iv
          : {
              ...iv,
              updatedAt: nowIso(),
              responses: iv.responses.map((r) => (r.questionId === questionId ? { ...r, ...patch } : r)),
            }
      )
    );
  }, []);

  const handleUpdateInterview = useCallback((interviewId, patch) => {
    setInterviews((prev) =>
      prev.map((iv) => (iv.id !== interviewId ? iv : { ...iv, ...patch, updatedAt: nowIso() }))
    );
  }, []);

  const handleCompleteInterview = useCallback(
    (interviewId) => {
      const interview = interviews.find((iv) => iv.id === interviewId);
      if (!interview) return;
      const missing = [];
      if (interview.technicalScore === null) missing.push('Technical Score');
      if (interview.behavioralScore === null) missing.push('Behavioral Score');
      if (interview.sdlcScore === null) missing.push('SDLC Score');
      if (!interview.recommendation) missing.push('Recommendation');
      if (!interview.overallAssessment || !interview.overallAssessment.trim()) missing.push('Overall Assessment');
      if (missing.length) {
        showToast(`Complete these fields before finishing: ${missing.join(', ')}.`, 'danger');
        return;
      }
      setInterviews((prev) =>
        prev.map((iv) =>
          iv.id === interviewId ? { ...iv, status: 'completed', completedAt: nowIso(), updatedAt: nowIso() } : iv
        )
      );
      setView('report');
      showToast('Interview completed and report generated.', 'success');
    },
    [interviews, showToast]
  );

  const handleDeleteInterview = useCallback(
    (interviewId) => {
      setInterviews((prev) => prev.filter((iv) => iv.id !== interviewId));
      setActiveInterviewId((prev) => (prev === interviewId ? null : prev));
      setView('data');
      showToast('Interview deleted.', 'info');
    },
    [showToast]
  );

  const handleResume = useCallback((interviewId) => {
    setActiveInterviewId(interviewId);
    setView('session');
  }, []);

  const handleViewReport = useCallback((interviewId) => {
    setActiveInterviewId(interviewId);
    setView('report');
  }, []);

  const handleAddQuestion = useCallback(
    (domainId, text) => {
      setDomains((prev) =>
        prev.map((d) => (d.id !== domainId ? d : { ...d, questions: [...d.questions, { id: generateId(), text }] }))
      );
      showToast('Question added.', 'success');
    },
    [showToast]
  );

  const handleDeleteQuestion = useCallback(
    (domainId, questionId) => {
      setDomains((prev) =>
        prev.map((d) => (d.id !== domainId ? d : { ...d, questions: d.questions.filter((q) => q.id !== questionId) }))
      );
      showToast('Question removed.', 'info');
    },
    [showToast]
  );

  const handleExportAll = useCallback(() => {
    const payload = buildBackupPayload(domains, interviews);
    const ok = downloadFile(
      `interview-platform-backup-${todayInputDate()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    showToast(ok ? 'Backup downloaded.' : 'Export failed.', ok ? 'success' : 'danger');
  }, [domains, interviews, showToast]);

  const handleImportBackup = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          if (!parsed || !Array.isArray(parsed.domains) || !Array.isArray(parsed.interviews)) {
            throw new Error('Invalid backup file format.');
          }
          setDomains((prev) => mergeById(prev, parsed.domains));
          setInterviews((prev) => mergeById(prev, parsed.interviews));
          showToast(
            `Imported ${parsed.interviews.length} interview(s) and ${parsed.domains.length} domain(s).`,
            'success'
          );
        } catch (error) {
          console.error('Import failed:', error);
          showToast('Import failed: the file is not a valid backup.', 'danger');
        }
      };
      reader.onerror = () => showToast('Could not read the selected file.', 'danger');
      reader.readAsText(file);
    },
    [showToast]
  );

  const handleDownloadTxt = useCallback((interview) => {
    downloadFile(`${slugify(interview.candidateName)}-report.txt`, buildTxtReport(interview), 'text/plain');
  }, []);

  const handleDownloadJson = useCallback((interview) => {
    downloadFile(`${slugify(interview.candidateName)}-report.json`, buildJsonReport(interview), 'application/json');
  }, []);

  const handleDownloadCsv = useCallback((interview) => {
    downloadFile(`${slugify(interview.candidateName)}-report.csv`, buildCsvReport(interview), 'text/csv');
  }, []);

  if (!session) {
    return (
      <>
        <style>{APP_STYLES}</style>
        <LoginView onLogin={handleLogin} />
        <ToastBanner toast={toast} />
      </>
    );
  }

  let pageContent;
  switch (view) {
    case 'new':
      pageContent = (
        <NewInterviewView
          domains={domains}
          defaultInterviewer={session.username}
          onCreate={handleCreateInterview}
          onCancel={() => setView('dashboard')}
        />
      );
      break;
    case 'session':
      pageContent = (
        <SessionView
          interview={activeInterview}
          onUpdateResponse={handleUpdateResponse}
          onUpdateInterview={handleUpdateInterview}
          onComplete={handleCompleteInterview}
          onBack={() => setView('dashboard')}
        />
      );
      break;
    case 'questions':
      pageContent = (
        <QuestionBankView domains={domains} onAddQuestion={handleAddQuestion} onDeleteQuestion={handleDeleteQuestion} />
      );
      break;
    case 'data':
      pageContent = (
        <DataView
          domains={domains}
          interviews={interviews}
          onDeleteInterview={handleDeleteInterview}
          onViewReport={handleViewReport}
          onResume={handleResume}
          onExportAll={handleExportAll}
          onImport={handleImportBackup}
        />
      );
      break;
    case 'report':
      pageContent = (
        <ReportView
          interview={activeInterview}
          onDownloadTxt={handleDownloadTxt}
          onDownloadJson={handleDownloadJson}
          onDownloadCsv={handleDownloadCsv}
          onBack={() => setView('dashboard')}
          onDelete={handleDeleteInterview}
        />
      );
      break;
    default:
      pageContent = (
        <DashboardView
          session={session}
          domains={domains}
          interviews={interviews}
          onNavigate={handleNavigate}
          onResume={handleResume}
          onViewReport={handleViewReport}
        />
      );
  }

  return (
    <>
      <style>{APP_STYLES}</style>
      <NavShell
        session={session}
        view={view}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
      >
        {pageContent}
      </NavShell>
      <ToastBanner toast={toast} />
    </>
  );
}

/* ==========================================================================
   Inline component styles
   ========================================================================== */

const APP_STYLES = `
.ip-text-muted { color: var(--color-text-muted); }
.ip-small { font-size: 0.85rem; }

.ip-login-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 50%, #312e81 100%);
}
.ip-login-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 40px;
  max-width: 380px;
  width: 100%;
}
.ip-login-card h1 { font-size: 1.6rem; margin-bottom: 6px; }
.ip-login-card form { margin-top: 20px; }
.ip-login-note { margin-top: 18px; font-size: 0.82rem; color: var(--color-text-muted); text-align: center; }

.ip-field { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
.ip-field-inline { max-width: 200px; }
.ip-field label { font-size: 0.85rem; font-weight: 600; color: var(--color-text); }
.ip-field input,
.ip-field select,
.ip-field textarea {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  background: #fff;
  color: var(--color-text);
  width: 100%;
  resize: vertical;
}
.ip-field input:focus,
.ip-field select:focus,
.ip-field textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
}
.ip-form-error { color: var(--color-danger); font-size: 0.85rem; margin: 4px 0 12px; }
.ip-form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }
.ip-form-actions-start { justify-content: flex-start; flex-wrap: wrap; }
.ip-form-inline { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
.ip-form-inline textarea { flex: 1; min-width: 220px; }

.ip-btn {
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px 18px;
  font-weight: 600;
  font-size: 0.92rem;
  transition: filter 0.15s ease, transform 0.05s ease;
  white-space: nowrap;
}
.ip-btn:active { transform: translateY(1px); }
.ip-btn-primary { background: var(--color-primary); color: #fff; }
.ip-btn-primary:hover { filter: brightness(1.08); }
.ip-btn-secondary { background: #eef2ff; color: var(--color-primary-dark); }
.ip-btn-secondary:hover { filter: brightness(0.97); }
.ip-btn-danger { background: #fef2f2; color: var(--color-danger); }
.ip-btn-danger:hover { filter: brightness(0.97); }
.ip-btn-ghost { background: transparent; color: var(--color-text-muted); border: 1px solid var(--color-border); }
.ip-btn-ghost:hover { background: #f1f5f9; }
.ip-btn-block { width: 100%; }
.ip-btn-sm { padding: 6px 12px; font-size: 0.82rem; }

.ip-icon-btn {
  border: none;
  background: transparent;
  font-size: 1.3rem;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text);
}
.ip-icon-btn:hover { background: #f1f5f9; }

.ip-app-shell { display: flex; min-height: 100vh; }
.ip-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #ffffff;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
}
.ip-sidebar-header h2 { font-size: 1.15rem; margin-bottom: 4px; }
.ip-sidebar-header { margin-bottom: 24px; }
.ip-nav-list { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.ip-nav-item {
  text-align: left;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-weight: 500;
  color: var(--color-text);
}
.ip-nav-item:hover { background: #f1f5f9; }
.ip-nav-item-active { background: var(--color-primary); color: #fff; }
.ip-nav-item-active:hover { background: var(--color-primary-dark); }
.ip-sidebar-footer {
  border-top: 1px solid var(--color-border);
  padding-top: 16px;
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ip-sidebar-backdrop { display: none; }

.ip-main-column { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ip-topbar {
  display: none;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid var(--color-border);
}
.ip-main { padding: 28px; flex: 1; max-width: 1100px; width: 100%; margin: 0 auto; }

.ip-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.ip-page-header h1 { font-size: 1.6rem; margin-bottom: 6px; }

.ip-grid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.ip-stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: var(--shadow-sm);
}
.ip-stat-value { font-size: 1.8rem; font-weight: 700; color: var(--color-primary-dark); }
.ip-stat-label { font-size: 0.85rem; color: var(--color-text-muted); }

.ip-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.ip-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px 22px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
}
.ip-card h3 { font-size: 1.05rem; margin-bottom: 14px; }
.ip-card-narrow { max-width: 520px; }

.ip-bar-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}
.ip-bar-row:last-child { border-bottom: none; }

.ip-table-wrap { overflow-x: auto; }
.ip-table { width: 100%; border-collapse: collapse; }
.ip-table th {
  text-align: left;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  padding: 8px 10px;
  border-bottom: 2px solid var(--color-border);
}
.ip-table td { padding: 10px; border-bottom: 1px solid var(--color-border); font-size: 0.92rem; }
.ip-table tbody tr:hover { background: #f8fafc; }
.ip-table-actions { display: flex; gap: 8px; white-space: nowrap; }

.ip-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
}
.ip-badge-neutral { background: #f1f5f9; color: var(--color-text-muted); }
.ip-badge-success { background: #dcfce7; color: #166534; }
.ip-badge-warning { background: #fef3c7; color: #92400e; }
.ip-badge-danger { background: #fee2e2; color: #991b1b; }
.ip-badge-info { background: #e0e7ff; color: #3730a3; }

.ip-tabs { display: flex; gap: 6px; margin-bottom: 18px; flex-wrap: wrap; border-bottom: 1px solid var(--color-border); }
.ip-tab {
  background: transparent;
  border: none;
  padding: 10px 16px;
  font-weight: 600;
  color: var(--color-text-muted);
  border-bottom: 2px solid transparent;
}
.ip-tab:hover { color: var(--color-text); }
.ip-tab-active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

.ip-question-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px 18px;
  margin-bottom: 14px;
}
.ip-question-card-compact { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.ip-question-text { font-weight: 600; margin-bottom: 10px; }

.ip-empty-state { text-align: center; padding: 32px 16px; }
.ip-empty-state h3 { margin-bottom: 6px; }

.ip-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 100;
  padding: 12px 18px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-weight: 600;
  font-size: 0.9rem;
  color: #fff;
  background: var(--color-primary);
  max-width: 320px;
}
.ip-toast-success { background: var(--color-success); }
.ip-toast-warning { background: var(--color-warning); }
.ip-toast-danger { background: var(--color-danger); }
.ip-toast-info { background: var(--color-primary); }

@media (max-width: 880px) {
  .ip-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    z-index: 60;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }
  .ip-sidebar-open { transform: translateX(0); }
  .ip-sidebar-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    z-index: 55;
  }
  .ip-sidebar-backdrop-open { display: block; }
  .ip-topbar { display: flex; }
  .ip-main { padding: 18px; }
  .ip-two-col { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .ip-page-header { flex-direction: column; }
  .ip-grid-stats { grid-template-columns: repeat(2, 1fr); }
  .ip-form-actions { flex-direction: column-reverse; }
  .ip-form-actions .ip-btn { width: 100%; }
}
`;
