// ============================================================
// Dec Academic CBT Hub — frontend app (vanilla JS, no build step)
// Talks to the Express API under /api. Works as a mobile-friendly
// responsive web app, installable to a phone home screen (PWA).
// ============================================================

const API = '/api';

const state = {
  view: 'login',          // current screen
  user: null,             // { id, name, email, role, ... }
  token: null,
  courses: [],
  topics: [],
  selectedCourse: null,
  selectedTopic: null,
  selectedMode: null,
  examSession: null,      // { mode, questions, questionCount, durationMinutes, startedAt }
  examAnswers: {},        // questionId -> answer
  examIndex: 0,           // current question index (instant mode / general nav)
  instantFeedback: null,  // feedback for the current instant-mode question
  lastResult: null,       // most recent submitted exam result
  history: [],
  historyDetail: null,
  library: [],
  performance: null,
  authMode: 'login',      // 'login' | 'register'
  formError: '',
  formSuccess: '',
  loading: false,
  adminPanel: null,       // which admin sub-panel is open
  adminUsers: [],
  adminMessage: '',
};

// ---------- persistence ----------
function loadSession() {
  try {
    const raw = localStorage.getItem('cbthub_session');
    if (raw) {
      const parsed = JSON.parse(raw);
      state.token = parsed.token;
      state.user = parsed.user;
    }
  } catch (e) { /* ignore */ }
}
function saveSession() {
  localStorage.setItem('cbthub_session', JSON.stringify({ token: state.token, user: state.user }));
}
function clearSession() {
  localStorage.removeItem('cbthub_session');
  state.token = null;
  state.user = null;
}

// ---------- API helper ----------
async function api(path, { method = 'GET', body = null, isForm = false } = {}) {
  const headers = {};
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  let data;
  try { data = await res.json(); } catch (e) { data = {}; }

  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

// ---------- helpers ----------
function fmtDate(d) {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtPct(n) { return `${Math.round(n)}%`; }
function letterFor(i) { return String.fromCharCode(65 + i); }
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function go(view, extra = {}) {
  Object.assign(state, { view, formError: '', formSuccess: '', ...extra });
  render();
}
function roleLabel(role) {
  return { masterAdmin: 'Master Admin', admin: 'Admin', staff: 'Staff', student: 'Student' }[role] || role;
}

// ============================================================
// AUTH SCREENS
// ============================================================
function renderLogin() {
  return `
    <div class="auth-wrap">
      <div class="auth-mark">DEC ACADEMIC</div>
      <h1 class="auth-title">CBT Hub</h1>
      <p class="auth-sub muted">Sign in to practice, track your scores, and study smarter.</p>
      ${state.formError ? `<div class="error-box">${state.formError}</div>` : ''}
      <form id="loginForm">
        <div class="field"><label>Email</label><input type="email" name="email" required autocomplete="username" /></div>
        <div class="field"><label>Password</label><input type="password" name="password" required autocomplete="current-password" /></div>
        <button class="btn btn-primary" type="submit" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div style="text-align:center;margin-top:16px;">
        <button class="link-btn" id="toForgot">Forgot password?</button>
      </div>
      <div class="divider"></div>
      <p style="text-align:center;">New here? <button class="link-btn" id="toRegister">Create a student account</button></p>
    </div>
  `;
}

function renderRegister() {
  return `
    <div class="auth-wrap">
      <div class="auth-mark">DEC ACADEMIC</div>
      <h1 class="auth-title">Create account</h1>
      <p class="auth-sub muted">Student registration — start practicing in minutes.</p>
      ${state.formError ? `<div class="error-box">${state.formError}</div>` : ''}
      <form id="registerForm">
        <div class="field"><label>Full name</label><input name="name" required /></div>
        <div class="field"><label>Email</label><input type="email" name="email" required /></div>
        <div class="field"><label>Phone (optional)</label><input name="phone" /></div>
        <div class="field"><label>Password</label><input type="password" name="password" minlength="6" required /></div>
        <button class="btn btn-accent" type="submit" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Creating…' : 'Create account'}</button>
      </form>
      <p style="text-align:center;margin-top:16px;">Already have an account? <button class="link-btn" id="toLogin">Sign in</button></p>
    </div>
  `;
}

function renderForgot() {
  return `
    <div class="auth-wrap">
      <h1 class="auth-title">Reset password</h1>
      <p class="auth-sub muted">Enter your email and we'll generate a reset link.</p>
      ${state.formError ? `<div class="error-box">${state.formError}</div>` : ''}
      ${state.formSuccess ? `<div class="success-box">${state.formSuccess}</div>` : ''}
      <form id="forgotForm">
        <div class="field"><label>Email</label><input type="email" name="email" required /></div>
        <button class="btn btn-primary" type="submit">Send reset link</button>
      </form>
      <p style="text-align:center;margin-top:16px;"><button class="link-btn" id="toLogin">Back to sign in</button></p>
    </div>
  `;
}

function wireAuthScreens() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(loginForm);
    state.loading = true; render();
    try {
      const data = await api('/auth/login', { method: 'POST', body: { email: fd.get('email'), password: fd.get('password') } });
      state.token = data.token; state.user = data.user; saveSession();
      state.loading = false;
      go('dashboard');
      loadCoreData();
    } catch (err) {
      state.loading = false; state.formError = err.message; render();
    }
  });

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(registerForm);
    state.loading = true; render();
    try {
      const data = await api('/auth/register', { method: 'POST', body: {
        name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), password: fd.get('password'),
      }});
      state.token = data.token; state.user = data.user; saveSession();
      state.loading = false;
      go('dashboard');
      loadCoreData();
    } catch (err) {
      state.loading = false; state.formError = err.message; render();
    }
  });

  const forgotForm = document.getElementById('forgotForm');
  if (forgotForm) forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(forgotForm);
    try {
      const data = await api('/auth/forgot-password', { method: 'POST', body: { email: fd.get('email') } });
      state.formSuccess = data.message + (data.devResetToken ? ` (dev token: ${data.devResetToken})` : '');
      state.formError = '';
      render();
    } catch (err) { state.formError = err.message; render(); }
  });

  const toRegister = document.getElementById('toRegister'); if (toRegister) toRegister.onclick = () => go('register');
  const toLogin = document.getElementById('toLogin'); if (toLogin) toLogin.onclick = () => go('login');
  const toForgot = document.getElementById('toForgot'); if (toForgot) toForgot.onclick = () => go('forgot');
}

function logout() {
  clearSession();
  Object.assign(state, { view: 'login', courses: [], topics: [], history: [], library: [], performance: null });
  render();
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadCoreData() {
  try {
    const c = await api('/courses');
    state.courses = c.courses;
  } catch (e) { /* ignore */ }
}

async function loadTopicsForCourse(courseId) {
  const t = await api(`/topics?course=${courseId}`);
  state.topics = t.topics;
}

async function loadPerformance() {
  try {
    const p = await api('/exams/performance');
    state.performance = p;
  } catch (e) { /* ignore */ }
}

async function loadHistory() {
  state.loading = true; render();
  try {
    const h = await api('/exams/history');
    state.history = h.results;
  } catch (e) { /* ignore */ }
  state.loading = false; render();
}

async function loadLibrary() {
  state.loading = true; render();
  try {
    const l = await api('/library');
    state.library = l.materials;
  } catch (e) { /* ignore */ }
  state.loading = false; render();
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const isStaffPlus = ['admin', 'masterAdmin', 'staff'].includes(state.user.role);
  return `
    <div class="top-header">
      <div>
        <div class="eyebrow">Welcome back</div>
        <h1>${state.user.name.split(' ')[0]}</h1>
      </div>
      <span class="role-badge">${roleLabel(state.user.role)}</span>
    </div>

    ${state.performance ? `
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-num">${state.performance.totalExamsTaken}</div><div class="stat-label">Exams taken</div></div>
        <div class="stat-box"><div class="stat-num">${fmtPct(state.performance.overallAverage)}</div><div class="stat-label">Average score</div></div>
      </div>
      ${state.performance.weakTopics && state.performance.weakTopics.length ? `
        <div class="card">
          <h3>Topics to review</h3>
          <p class="muted" style="margin-bottom:10px;">Your average is under 50% here — worth another pass.</p>
          ${state.performance.weakTopics.slice(0, 3).map(t => `
            <div class="card-row" style="padding:6px 0;">
              <span>${t.topic}</span><span class="tag">${fmtPct(t.averagePercentage)}</span>
            </div>`).join('')}
        </div>` : ''}
    ` : ''}

    <div class="section-title"><h2>Start practicing</h2></div>
    <div class="card">
      <p class="muted" style="margin-bottom:12px;">Pick a course to begin a new practice exam.</p>
      <button class="btn btn-accent" id="quickStartBtn">Choose course & start</button>
    </div>

    ${isStaffPlus ? `
      <div class="section-title"><h2>Manage content</h2></div>
      <div class="select-list">
        <div class="select-item" id="goAdminQuestions"><span>Courses, topics &amp; questions</span><span class="chev">›</span></div>
        <div class="select-item" id="goAdminLibrary"><span>Library uploads</span><span class="chev">›</span></div>
        ${['admin','masterAdmin'].includes(state.user.role) ? `<div class="select-item" id="goAdminUsers"><span>Manage staff &amp; students</span><span class="chev">›</span></div>` : ''}
        ${state.user.role === 'masterAdmin' ? `<div class="select-item" id="goAdminCreateAdmin"><span>Create an Admin account</span><span class="chev">›</span></div>` : ''}
      </div>
    ` : ''}
  `;
}

function wireDashboard() {
  const qs = document.getElementById('quickStartBtn');
  if (qs) qs.onclick = () => { state.selectedCourse = null; state.selectedTopic = null; state.selectedMode = null; go('courseSelect'); };
  const gq = document.getElementById('goAdminQuestions'); if (gq) gq.onclick = () => go('adminContent');
  const gl = document.getElementById('goAdminLibrary'); if (gl) gl.onclick = () => { loadLibrary(); go('adminLibrary'); };
  const gu = document.getElementById('goAdminUsers'); if (gu) gu.onclick = () => go('adminUsers');
  const ga = document.getElementById('goAdminCreateAdmin'); if (ga) ga.onclick = () => go('adminCreateAdmin');
}

// ============================================================
// EXAM SETUP: course -> topic -> mode
// ============================================================
function renderCourseSelect() {
  return `
    <div class="top-header"><div><div class="eyebrow">Step 1 of 3</div><h1>Choose a course</h1></div></div>
    <div class="select-list">
      ${state.courses.length ? state.courses.map(c => `
        <div class="select-item" data-course="${c._id}"><span>${c.name}</span><span class="chev">›</span></div>
      `).join('') : `<div class="empty-state">No courses yet. Ask an admin to add one.</div>`}
    </div>
    <div style="margin-top:16px;"><button class="btn btn-ghost" id="backToDash">‹ Back to dashboard</button></div>
  `;
}
function wireCourseSelect() {
  document.querySelectorAll('[data-course]').forEach(node => {
    node.onclick = async () => {
      state.selectedCourse = state.courses.find(c => c._id === node.dataset.course);
      state.loading = true; render();
      await loadTopicsForCourse(state.selectedCourse._id);
      state.loading = false;
      go('topicSelect');
    };
  });
  document.getElementById('backToDash').onclick = () => go('dashboard');
}

function renderTopicSelect() {
  return `
    <div class="top-header"><div><div class="eyebrow">Step 2 of 3 · ${state.selectedCourse.name}</div><h1>Choose a topic</h1></div></div>
    <div class="select-list">
      ${state.topics.length ? state.topics.map(t => `
        <div class="select-item" data-topic="${t._id}"><span>${t.name}</span><span class="chev">›</span></div>
      `).join('') : `<div class="empty-state">No topics in this course yet.</div>`}
    </div>
    <div style="margin-top:16px;"><button class="btn btn-ghost" id="backBtn">‹ Back</button></div>
  `;
}
function wireTopicSelect() {
  document.querySelectorAll('[data-topic]').forEach(node => {
    node.onclick = () => {
      state.selectedTopic = state.topics.find(t => t._id === node.dataset.topic);
      go('modeSelect');
    };
  });
  document.getElementById('backBtn').onclick = () => go('courseSelect');
}

const MODE_INFO = {
  short: { label: 'Short', meta: '20 Qs · 15 min' },
  medium: { label: 'Medium', meta: '30 Qs · 20 min' },
  long: { label: 'Long', meta: '50 Qs · 45 min' },
  instant: { label: 'Instant', meta: 'One at a time · instant feedback' },
};
function renderModeSelect() {
  return `
    <div class="top-header"><div><div class="eyebrow">Step 3 of 3 · ${state.selectedTopic.name}</div><h1>Choose exam mode</h1></div></div>
    <div class="mode-grid">
      ${Object.entries(MODE_INFO).map(([key, m]) => `
        <button class="mode-card" data-mode="${key}">
          <div class="mode-name">${m.label}</div>
          <div class="mode-meta">${m.meta}</div>
        </button>
      `).join('')}
    </div>
    <div style="margin-top:20px;"><button class="btn btn-ghost" id="backBtn">‹ Back</button></div>
  `;
}
function wireModeSelect() {
  document.querySelectorAll('[data-mode]').forEach(node => {
    node.onclick = () => startExam(node.dataset.mode);
  });
  document.getElementById('backBtn').onclick = () => go('topicSelect');
}

async function startExam(mode) {
  state.selectedMode = mode;
  state.loading = true; render();
  try {
    const data = await api(`/exams/start?course=${state.selectedCourse._id}&topic=${state.selectedTopic._id}&mode=${mode}`);
    state.examSession = data;
    state.examAnswers = {};
    state.examIndex = 0;
    state.instantFeedback = null;
    state.loading = false;
    go('examTaking');
    if (mode !== 'instant') startTimer(data.durationMinutes * 60);
  } catch (err) {
    state.loading = false;
    state.formError = err.message;
    go('modeSelect');
  }
}

// ---------- countdown timer for timed modes ----------
let timerInterval = null;
let timerSecondsLeft = 0;
function startTimer(totalSeconds) {
  clearInterval(timerInterval);
  timerSecondsLeft = totalSeconds;
  timerInterval = setInterval(() => {
    timerSecondsLeft -= 1;
    const pill = document.getElementById('timerPill');
    if (pill) {
      pill.textContent = fmtClock(timerSecondsLeft);
      pill.classList.toggle('low', timerSecondsLeft <= 60);
    }
    if (timerSecondsLeft <= 0) {
      clearInterval(timerInterval);
      finishExam();
    }
  }, 1000);
}
function fmtClock(s) {
  const m = Math.max(0, Math.floor(s / 60));
  const sec = Math.max(0, s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ============================================================
// EXAM TAKING (question-by-question, works for all 4 modes)
// ============================================================
function currentQuestion() {
  return state.examSession.questions[state.examIndex];
}

function renderExamTaking() {
  const s = state.examSession;
  const q = currentQuestion();
  const total = s.questions.length;
  const answered = state.examAnswers[q._id];
  const isInstant = s.instant;
  const fb = state.instantFeedback;

  const optionsHtml = q.type === 'mcq'
    ? `<div class="option-list">
        ${q.options.map((opt, i) => {
          let cls = 'option-row';
          if (isInstant && fb) {
            if (opt === fb.correctAnswer) cls += ' correct';
            else if (opt === answered && !fb.isCorrect) cls += ' incorrect';
          } else if (answered === opt) {
            cls += ' selected';
          }
          return `<div class="${cls}" data-opt="${i}"><span class="option-letter">${letterFor(i)}</span><span>${opt}</span></div>`;
        }).join('')}
      </div>`
    : `<div class="field" style="margin-top:14px;">
        <label>Your answer</label>
        <textarea id="subjectiveAnswer" ${isInstant && fb ? 'disabled' : ''}>${answered || ''}</textarea>
      </div>`;

  const feedbackHtml = (isInstant && fb) ? `
    <div class="feedback-banner ${fb.isCorrect ? 'correct' : 'incorrect'}">
      <strong>${fb.feedback}</strong>${q.type === 'subjective' ? ` — expected: "${fb.correctAnswer}"` : ''}
      ${q.explanation ? `<div style="margin-top:6px;">${q.explanation}</div>` : ''}
    </div>` : '';

  const showCheckBtn = isInstant && !fb;
  const showNextBtn = !isInstant || fb;
  const isLast = state.examIndex === total - 1;

  return `
    <div class="exam-topbar">
      <span class="tag">${state.selectedTopic.name}</span>
      ${!isInstant ? `<span class="timer-pill" id="timerPill">${fmtClock(timerSecondsLeft)}</span>` : `<span class="tag">Instant mode</span>`}
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${((state.examIndex + 1) / total) * 100}%"></div></div>
    <div class="q-index">Question ${state.examIndex + 1} of ${total}</div>
    <div class="q-text">${q.questionText}</div>
    ${q.image ? `<img class="q-image" src="${q.image}" alt="Question illustration" />` : ''}
    ${optionsHtml}
    ${feedbackHtml}
    <div class="exam-nav">
      ${state.examIndex > 0 && !isInstant ? `<button class="btn btn-outline" id="prevBtn">Back</button>` : ''}
      ${showCheckBtn ? `<button class="btn btn-accent" id="checkBtn">Check answer</button>` : ''}
      ${showNextBtn ? `<button class="btn btn-primary" id="nextBtn">${isLast ? 'Finish exam' : 'Next question'}</button>` : ''}
    </div>
  `;
}

function wireExamTaking() {
  const q = currentQuestion();
  const s = state.examSession;

  document.querySelectorAll('[data-opt]').forEach(node => {
    node.onclick = () => {
      if (s.instant && state.instantFeedback) return; // locked after checking
      state.examAnswers[q._id] = q.options[Number(node.dataset.opt)];
      render();
    };
  });

  const checkBtn = document.getElementById('checkBtn');
  if (checkBtn) checkBtn.onclick = async () => {
    const ta = document.getElementById('subjectiveAnswer');
    if (ta) state.examAnswers[q._id] = ta.value;
    const userAnswer = state.examAnswers[q._id];
    if (!userAnswer) { return; }
    state.loading = true; render();
    try {
      const fb = await api('/exams/instant/check', { method: 'POST', body: { questionId: q._id, userAnswer } });
      state.instantFeedback = fb;
    } catch (e) { /* ignore */ }
    state.loading = false; render();
  };

  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) nextBtn.onclick = () => {
    const ta = document.getElementById('subjectiveAnswer');
    if (ta) state.examAnswers[q._id] = ta.value;

    if (state.examIndex < s.questions.length - 1) {
      state.examIndex += 1;
      state.instantFeedback = null;
      render();
    } else {
      finishExam();
    }
  };

  const prevBtn = document.getElementById('prevBtn');
  if (prevBtn) prevBtn.onclick = () => { state.examIndex -= 1; render(); };
}

async function finishExam() {
  clearInterval(timerInterval);
  const s = state.examSession;
  const answers = s.questions.map(q => ({ questionId: q._id, userAnswer: state.examAnswers[q._id] || '' }));

  state.loading = true; render();
  try {
    const data = await api('/exams/submit', { method: 'POST', body: {
      course: state.selectedCourse._id, topic: state.selectedTopic._id, mode: state.selectedMode,
      startedAt: s.startedAt, answers,
    }});
    state.lastResult = data.result;
    state.loading = false;
    loadPerformance();
    go('examResult');
  } catch (err) {
    state.loading = false;
    alert(`Could not submit exam: ${err.message}`);
    render();
  }
}

// ============================================================
// EXAM RESULT
// ============================================================
function renderExamResult() {
  const r = state.lastResult;
  const wrong = r.answers.filter(a => !a.isCorrect);
  return `
    <div class="score-hero">
      <div class="eyebrow">${MODE_INFO[r.mode] ? MODE_INFO[r.mode].label : r.mode} mode result</div>
      <div class="score-ring-num">${fmtPct(r.percentage)}</div>
      <p class="muted">${r.marksScored} / ${r.totalMarks} marks · ${r.correctCount} correct, ${r.wrongCount} wrong</p>
    </div>

    <div class="card-row" style="gap:10px;">
      <button class="btn btn-accent" id="reviewBtn">Review answers</button>
      <button class="btn btn-outline" id="doneBtn">Done</button>
    </div>

    <div id="reviewSection" class="hidden" style="margin-top:18px;">
      <h3>Wrong answers</h3>
      ${wrong.length === 0 ? `<p class="muted">Perfect run — no wrong answers.</p>` : wrong.map(a => `
        <div class="answer-review wrong">
          <p style="font-weight:600;margin-bottom:4px;">${a.questionText}</p>
          <p class="muted" style="margin:0;">Your answer: ${a.userAnswer || '(no answer)'}</p>
          <p style="margin:2px 0;color:var(--success);">Correct answer: ${a.correctAnswer}</p>
          ${a.explanation ? `<p class="muted" style="margin:4px 0 0;">${a.explanation}</p>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}
function wireExamResult() {
  document.getElementById('reviewBtn').onclick = () => {
    document.getElementById('reviewSection').classList.toggle('hidden');
  };
  document.getElementById('doneBtn').onclick = () => go('dashboard');
}

// ============================================================
// RECORDS (exam history)
// ============================================================
function renderRecords() {
  return `
    <div class="top-header"><div><div class="eyebrow">Your history</div><h1>Examination records</h1></div></div>
    ${state.loading ? `<div class="loading">Loading…</div>` : (
      state.history.length ? state.history.map(r => `
        <div class="card card-row" data-result="${r._id}" style="cursor:pointer;">
          <div>
            <h3>${r.course ? r.course.name : ''} · ${r.topic ? r.topic.name : ''}</h3>
            <p class="muted" style="margin:2px 0 0;">${MODE_INFO[r.mode] ? MODE_INFO[r.mode].label : r.mode} mode · ${fmtDate(r.createdAt)}</p>
          </div>
          <div class="stat-num" style="font-size:20px;">${fmtPct(r.percentage)}</div>
        </div>
      `).join('') : `<div class="empty-state">No exams taken yet. Start one from your dashboard.</div>`
    )}
  `;
}
function wireRecords() {
  document.querySelectorAll('[data-result]').forEach(node => {
    node.onclick = async () => {
      state.loading = true; render();
      try {
        const d = await api(`/exams/results/${node.dataset.result}`);
        state.historyDetail = d.result;
      } catch (e) { /* ignore */ }
      state.loading = false;
      go('recordDetail');
    };
  });
}

function renderRecordDetail() {
  const r = state.historyDetail;
  return `
    <div class="top-header"><div><div class="eyebrow">${fmtDate(r.createdAt)}</div><h1>${r.course.name}</h1></div></div>
    <p class="muted">${r.topic.name} · ${MODE_INFO[r.mode] ? MODE_INFO[r.mode].label : r.mode} mode</p>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num">${fmtPct(r.percentage)}</div><div class="stat-label">Score</div></div>
      <div class="stat-box"><div class="stat-num">${r.correctCount}/${r.totalQuestions}</div><div class="stat-label">Correct</div></div>
    </div>
    <h3 style="margin-top:16px;">All answers</h3>
    ${r.answers.map(a => `
      <div class="answer-review ${a.isCorrect ? 'right' : 'wrong'}">
        <p style="font-weight:600;margin-bottom:4px;">${a.questionText}</p>
        <p class="muted" style="margin:0;">Your answer: ${a.userAnswer || '(no answer)'}</p>
        ${!a.isCorrect ? `<p style="margin:2px 0;color:var(--success);">Correct answer: ${a.correctAnswer}</p>` : ''}
        <p class="muted" style="margin:2px 0;">${a.feedback}</p>
      </div>
    `).join('')}
    <button class="btn btn-ghost" id="backBtn">‹ Back to records</button>
  `;
}
function wireRecordDetail() {
  document.getElementById('backBtn').onclick = () => go('records');
}

// ============================================================
// LIBRARY
// ============================================================
function renderLibrary() {
  const canUpload = ['admin', 'masterAdmin', 'staff'].includes(state.user.role);
  return `
    <div class="top-header"><div><div class="eyebrow">Study materials</div><h1>Library</h1></div></div>
    ${canUpload ? `<button class="btn btn-outline" id="uploadPdfBtn" style="margin-bottom:14px;">+ Upload PDF</button>` : ''}
    ${state.loading ? `<div class="loading">Loading…</div>` : (
      state.library.length ? state.library.map(m => `
        <div class="card lib-item">
          <div class="lib-icon">PDF</div>
          <div style="flex:1;">
            <h3>${m.title}</h3>
            <p class="muted" style="margin:2px 0;">${m.course ? m.course.name : ''} · ${m.fileSizeKB} KB</p>
          </div>
          <a class="btn btn-sm btn-primary" href="${m.fileUrl}" target="_blank" rel="noopener">Open</a>
        </div>
      `).join('') : `<div class="empty-state">No study materials yet.</div>`
    )}
  `;
}
function wireLibrary() {
  const btn = document.getElementById('uploadPdfBtn');
  if (btn) btn.onclick = () => go('libraryUpload');
}

function renderLibraryUpload() {
  return `
    <div class="top-header"><div><h1>Upload PDF</h1></div></div>
    ${state.formError ? `<div class="error-box">${state.formError}</div>` : ''}
    <form id="uploadForm">
      <div class="field"><label>Title</label><input name="title" required /></div>
      <div class="field"><label>Course</label>
        <select name="course" required>${state.courses.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Description (optional)</label><textarea name="description"></textarea></div>
      <div class="field"><label>PDF file</label><input type="file" name="file" accept="application/pdf" required /></div>
      <button class="btn btn-accent" type="submit" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Uploading…' : 'Upload'}</button>
    </form>
    <button class="btn btn-ghost" id="backBtn" style="margin-top:10px;">‹ Cancel</button>
  `;
}
function wireLibraryUpload() {
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.loading = true; render();
    try {
      await api('/library', { method: 'POST', body: fd, isForm: true });
      state.loading = false;
      await loadLibrary();
      go('library');
    } catch (err) {
      state.loading = false; state.formError = err.message; render();
    }
  });
  document.getElementById('backBtn').onclick = () => go('library');
}

// ============================================================
// ACCOUNT
// ============================================================
function renderAccount() {
  return `
    <div class="top-header"><div><div class="eyebrow">${roleLabel(state.user.role)}</div><h1>My account</h1></div></div>
    ${state.formError ? `<div class="error-box">${state.formError}</div>` : ''}
    ${state.formSuccess ? `<div class="success-box">${state.formSuccess}</div>` : ''}

    <div class="card">
      <h3>Profile</h3>
      <form id="profileForm">
        <div class="field"><label>Name</label><input name="name" value="${state.user.name}" required /></div>
        <div class="field"><label>Email</label><input value="${state.user.email}" disabled /></div>
        <div class="field"><label>Phone</label><input name="phone" value="${state.user.phone || ''}" /></div>
        <button class="btn btn-primary" type="submit">Save changes</button>
      </form>
    </div>

    <div class="card">
      <h3>Change password</h3>
      <form id="passwordForm">
        <div class="field"><label>Current password</label><input type="password" name="currentPassword" required /></div>
        <div class="field"><label>New password</label><input type="password" name="newPassword" minlength="6" required /></div>
        <button class="btn btn-outline" type="submit">Update password</button>
      </form>
    </div>

    <button class="btn btn-danger" id="logoutBtn">Log out</button>
  `;
}
function wireAccount() {
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await api('/users/me', { method: 'PUT', body: { name: fd.get('name'), phone: fd.get('phone') } });
      state.user = data.user; saveSession();
      state.formSuccess = 'Profile updated.'; state.formError = '';
    } catch (err) { state.formError = err.message; }
    render();
  });
  document.getElementById('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/users/me/password', { method: 'PUT', body: {
        currentPassword: fd.get('currentPassword'), newPassword: fd.get('newPassword'),
      }});
      state.formSuccess = 'Password updated.'; state.formError = '';
      e.target.reset();
    } catch (err) { state.formError = err.message; }
    render();
  });
  document.getElementById('logoutBtn').onclick = logout;
}

// ============================================================
// ADMIN: courses / topics / questions
// ============================================================
function renderAdminContent() {
  return `
    <div class="top-header"><div><div class="eyebrow">Manage content</div><h1>Courses &amp; questions</h1></div></div>
    ${state.formError ? `<div class="error-box">${state.formError}</div>` : ''}
    ${state.formSuccess ? `<div class="success-box">${state.formSuccess}</div>` : ''}

    <div class="card">
      <h3>Add a course</h3>
      <form id="courseForm">
        <div class="field"><label>Course name</label><input name="name" required /></div>
        <div class="field"><label>Description</label><input name="description" /></div>
        <button class="btn btn-outline" type="submit">Add course</button>
      </form>
    </div>

    <div class="card">
      <h3>Add a topic</h3>
      <form id="topicForm">
        <div class="field"><label>Course</label>
          <select name="course" required>${state.courses.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Topic name</label><input name="name" required /></div>
        <button class="btn btn-outline" type="submit">Add topic</button>
      </form>
    </div>

    <div class="card">
      <h3>Add a single question</h3>
      <form id="questionForm">
        <div class="field"><label>Course</label>
          <select name="course" id="qCourse" required>${state.courses.map(c => `<option value="${c._id}">${c.name}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Topic</label><select name="topic" id="qTopic" required></select></div>
        <div class="field"><label>Type</label>
          <select name="type" id="qType">
            <option value="mcq">Multiple choice</option>
            <option value="subjective">Fill-in / subjective</option>
          </select>
        </div>
        <div class="field"><label>Question text</label><textarea name="questionText" required></textarea></div>

        <div id="mcqFields">
          <div class="field"><label>Option A</label><input name="opt0" /></div>
          <div class="field"><label>Option B</label><input name="opt1" /></div>
          <div class="field"><label>Option C</label><input name="opt2" /></div>
          <div class="field"><label>Option D</label><input name="opt3" /></div>
          <div class="field"><label>Correct option (must match exactly)</label><input name="correctAnswer" /></div>
        </div>
        <div id="subjectiveFields" class="hidden">
          <div class="field"><label>Expected answer</label><input name="expectedAnswer" /></div>
        </div>

        <div class="field"><label>Explanation (shown after answering)</label><textarea name="explanation"></textarea></div>
        <div class="field"><label>Marks</label><input name="marks" type="number" value="1" min="1" /></div>
        <div class="field"><label>Image (optional)</label><input type="file" name="image" accept="image/*" /></div>
        <button class="btn btn-accent" type="submit">Add question</button>
      </form>
    </div>

    <div class="card">
      <h3>Bulk-add questions</h3>
      <p class="muted">Paste a JSON array of questions — fastest way to load many at once.</p>
      <form id="bulkForm">
        <div class="field"><textarea name="bulkJson" rows="6" placeholder='[{"type":"mcq","course":"COURSE_ID","topic":"TOPIC_ID","questionText":"2+2=?","options":["2","3","4","5"],"correctAnswer":"4","explanation":"Basic addition","marks":1}]'></textarea></div>
        <button class="btn btn-outline" type="submit">Bulk add</button>
      </form>
    </div>

    <button class="btn btn-ghost" id="backBtn">‹ Back to dashboard</button>
  `;
}

function wireAdminContent() {
  document.getElementById('courseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/courses', { method: 'POST', body: { name: fd.get('name'), description: fd.get('description') } });
      await loadCoreData();
      state.formSuccess = 'Course added.'; state.formError = '';
    } catch (err) { state.formError = err.message; }
    render();
  });

  document.getElementById('topicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/topics', { method: 'POST', body: { name: fd.get('name'), course: fd.get('course') } });
      state.formSuccess = 'Topic added.'; state.formError = '';
    } catch (err) { state.formError = err.message; }
    render();
  });

  const qCourse = document.getElementById('qCourse');
  const qTopic = document.getElementById('qTopic');
  async function refreshTopicDropdown() {
    if (!qCourse.value) return;
    const t = await api(`/topics?course=${qCourse.value}`);
    qTopic.innerHTML = t.topics.map(tp => `<option value="${tp._id}">${tp.name}</option>`).join('');
  }
  qCourse.addEventListener('change', refreshTopicDropdown);
  refreshTopicDropdown();

  const qType = document.getElementById('qType');
  qType.addEventListener('change', () => {
    document.getElementById('mcqFields').classList.toggle('hidden', qType.value !== 'mcq');
    document.getElementById('subjectiveFields').classList.toggle('hidden', qType.value !== 'subjective');
  });

  document.getElementById('questionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = fd.get('type');
    const payload = new FormData();
    payload.append('type', type);
    payload.append('course', fd.get('course'));
    payload.append('topic', fd.get('topic'));
    payload.append('questionText', fd.get('questionText'));
    payload.append('explanation', fd.get('explanation') || '');
    payload.append('marks', fd.get('marks') || 1);
    if (type === 'mcq') {
      const opts = [fd.get('opt0'), fd.get('opt1'), fd.get('opt2'), fd.get('opt3')];
      payload.append('options', JSON.stringify(opts));
      payload.append('correctAnswer', fd.get('correctAnswer'));
    } else {
      payload.append('expectedAnswer', fd.get('expectedAnswer'));
    }
    const imgFile = e.target.querySelector('[name="image"]').files[0];
    if (imgFile) payload.append('image', imgFile);

    try {
      await api('/questions', { method: 'POST', body: payload, isForm: true });
      state.formSuccess = 'Question added.'; state.formError = '';
      e.target.reset();
    } catch (err) { state.formError = err.message; }
    render();
  });

  document.getElementById('bulkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const questions = JSON.parse(fd.get('bulkJson'));
      const data = await api('/questions/bulk', { method: 'POST', body: { questions } });
      state.formSuccess = `Added ${data.createdCount}, failed ${data.failedCount}.`;
      state.formError = data.errors && data.errors.length ? JSON.stringify(data.errors) : '';
    } catch (err) { state.formError = err.message; }
    render();
  });

  document.getElementById('backBtn').onclick = () => go('dashboard');
}

// ============================================================
// ADMIN: library management (with delete)
// ============================================================
function renderAdminLibrary() {
  return `
    <div class="top-header"><div><h1>Library uploads</h1></div></div>
    <button class="btn btn-outline" id="uploadPdfBtn" style="margin-bottom:14px;">+ Upload PDF</button>
    ${state.loading ? `<div class="loading">Loading…</div>` : (
      state.library.length ? state.library.map(m => `
        <div class="card lib-item">
          <div class="lib-icon">PDF</div>
          <div style="flex:1;">
            <h3>${m.title}</h3>
            <p class="muted" style="margin:2px 0;">${m.course ? m.course.name : ''} · ${m.fileSizeKB} KB</p>
          </div>
          <button class="btn btn-sm btn-danger" data-del="${m._id}">Delete</button>
        </div>
      `).join('') : `<div class="empty-state">No study materials yet.</div>`
    )}
    <button class="btn btn-ghost" id="backBtn" style="margin-top:10px;">‹ Back to dashboard</button>
  `;
}
function wireAdminLibrary() {
  document.getElementById('uploadPdfBtn').onclick = () => go('libraryUpload', { adminReturnTo: 'adminLibrary' });
  document.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this material?')) return;
      try { await api(`/library/${btn.dataset.del}`, { method: 'DELETE' }); await loadLibrary(); } catch (e) { alert(e.message); }
    };
  });
  document.getElementById('backBtn').onclick = () => go('dashboard');
}

// ============================================================
// ADMIN: user management (staff/admin/masterAdmin)
// ============================================================
async function loadAdminUsers() {
  state.loading = true; render();
  try {
    const d = await api('/admin/users');
    state.adminUsers = d.users;
  } catch (e) { /* ignore */ }
  state.loading = false; render();
}

function renderAdminUsers() {
  const canCreateStaff = ['admin', 'masterAdmin'].includes(state.user.role);
  return `
    <div class="top-header"><div><h1>Staff &amp; students</h1></div></div>
    ${state.formError ? `<div class="error-box">${state.formError}</div>` : ''}
    ${state.formSuccess ? `<div class="success-box">${state.formSuccess}</div>` : ''}

    ${canCreateStaff ? `
      <div class="card">
        <h3>Add a staff account</h3>
        <form id="staffForm">
          <div class="field"><label>Name</label><input name="name" required /></div>
          <div class="field"><label>Email</label><input type="email" name="email" required /></div>
          <div class="field"><label>Phone</label><input name="phone" /></div>
          <div class="field"><label>Temporary password</label><input type="password" name="password" minlength="6" required /></div>
          <button class="btn btn-accent" type="submit">Create staff account</button>
        </form>
      </div>
    ` : ''}

    ${state.loading ? `<div class="loading">Loading…</div>` : state.adminUsers.map(u => `
      <div class="card card-row">
        <div>
          <h3>${u.name}</h3>
          <p class="muted" style="margin:2px 0;">${u.email} · ${roleLabel(u.role)}${u.isActive ? '' : ' · deactivated'}</p>
        </div>
        <div class="list-actions">
          <button class="btn btn-sm btn-outline" data-toggle="${u.id}" data-active="${u.isActive}">${u.isActive ? 'Deactivate' : 'Reactivate'}</button>
        </div>
      </div>
    `).join('')}
    <button class="btn btn-ghost" id="backBtn" style="margin-top:10px;">‹ Back to dashboard</button>
  `;
}
function wireAdminUsers() {
  const staffForm = document.getElementById('staffForm');
  if (staffForm) staffForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/admin/create-staff', { method: 'POST', body: {
        name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), password: fd.get('password'),
      }});
      state.formSuccess = 'Staff account created.'; state.formError = '';
      e.target.reset();
      await loadAdminUsers();
    } catch (err) { state.formError = err.message; render(); }
  });

  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.onclick = async () => {
      const isActive = btn.dataset.active === 'true';
      try {
        await api(`/admin/users/${btn.dataset.toggle}/status`, { method: 'PUT', body: { isActive: !isActive } });
        await loadAdminUsers();
      } catch (err) { alert(err.message); }
    };
  });

  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.onclick = () => go('dashboard');
}

// ============================================================
// ADMIN: Master Admin creates an Admin
// ============================================================
function renderAdminCreateAdmin() {
  return `
    <div class="top-header"><div><h1>Create Admin account</h1></div></div>
    <p class="muted">Only the Master Admin can create Admin accounts.</p>
    ${state.formError ? `<div class="error-box">${state.formError}</div>` : ''}
    ${state.formSuccess ? `<div class="success-box">${state.formSuccess}</div>` : ''}
    <form id="adminForm">
      <div class="field"><label>Name</label><input name="name" required /></div>
      <div class="field"><label>Email</label><input type="email" name="email" required /></div>
      <div class="field"><label>Phone</label><input name="phone" /></div>
      <div class="field"><label>Temporary password</label><input type="password" name="password" minlength="6" required /></div>
      <button class="btn btn-accent" type="submit">Create admin account</button>
    </form>
    <button class="btn btn-ghost" id="backBtn" style="margin-top:10px;">‹ Back to dashboard</button>
  `;
}
function wireAdminCreateAdmin() {
  document.getElementById('adminForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/admin/create-admin', { method: 'POST', body: {
        name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone'), password: fd.get('password'),
      }});
      state.formSuccess = 'Admin account created.'; state.formError = '';
      e.target.reset();
    } catch (err) { state.formError = err.message; }
    render();
  });
  document.getElementById('backBtn').onclick = () => go('dashboard');
}

// ============================================================
// MASTER RENDER / ROUTER
// ============================================================
const TAB_VIEWS = { dashboard: 'dashboard', records: 'records', library: 'library', account: 'account' };
const NO_TABBAR_VIEWS = ['login', 'register', 'forgot', 'examTaking', 'examResult'];

function render() {
  const screen = document.getElementById('screen');
  const tabbar = document.getElementById('tabbar');
  let html = '';
  let wire = () => {};

  switch (state.view) {
    case 'login': html = renderLogin(); wire = wireAuthScreens; break;
    case 'register': html = renderRegister(); wire = wireAuthScreens; break;
    case 'forgot': html = renderForgot(); wire = wireAuthScreens; break;
    case 'dashboard': html = renderDashboard(); wire = wireDashboard; break;
    case 'courseSelect': html = renderCourseSelect(); wire = wireCourseSelect; break;
    case 'topicSelect': html = renderTopicSelect(); wire = wireTopicSelect; break;
    case 'modeSelect': html = renderModeSelect(); wire = wireModeSelect; break;
    case 'examTaking': html = renderExamTaking(); wire = wireExamTaking; break;
    case 'examResult': html = renderExamResult(); wire = wireExamResult; break;
    case 'records': html = renderRecords(); wire = wireRecords; break;
    case 'recordDetail': html = renderRecordDetail(); wire = wireRecordDetail; break;
    case 'library': html = renderLibrary(); wire = wireLibrary; break;
    case 'libraryUpload': html = renderLibraryUpload(); wire = wireLibraryUpload; break;
    case 'account': html = renderAccount(); wire = wireAccount; break;
    case 'adminContent': html = renderAdminContent(); wire = wireAdminContent; break;
    case 'adminLibrary': html = renderAdminLibrary(); wire = wireAdminLibrary; break;
    case 'adminUsers': html = renderAdminUsers(); wire = wireAdminUsers; break;
    case 'adminCreateAdmin': html = renderAdminCreateAdmin(); wire = wireAdminCreateAdmin; break;
    default: html = renderDashboard(); wire = wireDashboard;
  }

  screen.innerHTML = html;
  screen.classList.toggle('no-tabbar-pad', NO_TABBAR_VIEWS.includes(state.view));
  wire();

  // tab bar visibility + active state
  const showTabbar = !!state.user && !NO_TABBAR_VIEWS.includes(state.view);
  tabbar.classList.toggle('hidden', !showTabbar);
  const activeTab = TAB_VIEWS[state.view] || (['courseSelect','topicSelect','modeSelect'].includes(state.view) ? 'dashboard' :
                    (['recordDetail'].includes(state.view) ? 'records' :
                    (['libraryUpload'].includes(state.view) ? 'library' :
                    (['adminContent','adminLibrary','adminUsers','adminCreateAdmin'].includes(state.view) ? 'dashboard' : null))));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });
}

document.getElementById('tabbar').addEventListener('click', async (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab === 'dashboard') { await loadPerformance(); go('dashboard'); }
  if (tab === 'records') { go('records'); loadHistory(); }
  if (tab === 'library') { go('library'); loadLibrary(); }
  if (tab === 'account') go('account');
});

// ============================================================
// INIT
// ============================================================
async function init() {
  loadSession();
  if (state.token && state.user) {
    state.view = 'dashboard';
    render();
    await loadCoreData();
    await loadPerformance();
  }
  render();
}
init();
