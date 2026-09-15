# Dec Academic CBT Hub — API Documentation

Base URL (local): `http://localhost:5000/api`
Base URL (deployed): `https://your-domain.com/api`

All protected endpoints require a header:
```
Authorization: Bearer <token>
```
You get `<token>` from `/auth/login` or `/auth/register`.

All responses are JSON. Successful responses include `"success": true`. Errors look like:
```json
{ "success": false, "message": "Description of what went wrong" }
```

---

## 1. Authentication — `/api/auth`

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Student self-registration |
| POST | `/auth/login` | Public | Login (any role) |
| POST | `/auth/forgot-password` | Public | Request a password reset token |
| POST | `/auth/reset-password` | Public | Reset password using the token |

**POST `/auth/register`**
```json
{ "name": "Jane Doe", "email": "jane@example.com", "phone": "08012345678", "password": "secret123" }
```
Returns `{ success, user, token }`.

**POST `/auth/login`**
```json
{ "email": "jane@example.com", "password": "secret123" }
```
Returns `{ success, user, token }`.

**POST `/auth/forgot-password`**
```json
{ "email": "jane@example.com" }
```
In development, the response includes `devResetToken` directly so you can test without setting up email. In production, wire up the `nodemailer` block (see `.env.example` SMTP settings) to actually send it.

**POST `/auth/reset-password`**
```json
{ "token": "<reset token>", "newPassword": "newSecret123" }
```

---

## 2. Admin & user management — `/api/admin` (protected)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/admin/create-admin` | Master Admin only | Create an Admin account |
| POST | `/admin/create-staff` | Admin, Master Admin | Create a Staff account |
| GET | `/admin/users?role=student` | Staff, Admin, Master Admin | List users (staff only ever see students) |
| PUT | `/admin/users/:id/status` | Admin, Master Admin | Activate/deactivate a user: `{ "isActive": false }` |
| DELETE | `/admin/users/:id` | Admin, Master Admin | Delete a user |

Guard rails baked in: Admins can never create/edit/delete other Admins or the Master Admin — only the Master Admin can. The Master Admin account can never be deactivated or deleted.

---

## 3. Courses — `/api/courses` (protected)

| Method | Endpoint | Access |
|---|---|---|
| GET | `/courses` | Any logged-in user |
| POST | `/courses` | Admin, Staff, Master Admin |
| PUT | `/courses/:id` | Admin, Staff, Master Admin |
| DELETE | `/courses/:id` | Admin, Master Admin |

```json
{ "name": "Mathematics", "description": "SS3 core mathematics" }
```

---

## 4. Topics — `/api/topics` (protected)

| Method | Endpoint | Access |
|---|---|---|
| GET | `/topics?course=<courseId>` | Any logged-in user |
| POST | `/topics` | Admin, Staff, Master Admin |
| PUT | `/topics/:id` | Admin, Staff, Master Admin |
| DELETE | `/topics/:id` | Admin, Master Admin |

```json
{ "name": "Quadratic Equations", "course": "<courseId>", "description": "" }
```

---

## 5. Questions — `/api/questions` (protected)

| Method | Endpoint | Access |
|---|---|---|
| GET | `/questions?course=&topic=&includeAnswers=true` | Any logged-in user (answers hidden unless you're staff+ and pass `includeAnswers=true`) |
| POST | `/questions` | Admin, Staff, Master Admin — single question, multipart form (supports an `image` file) |
| POST | `/questions/bulk` | Admin, Staff, Master Admin — bulk add, JSON body |
| PUT | `/questions/:id` | Admin, Staff, Master Admin |
| DELETE | `/questions/:id` | Admin, Staff, Master Admin |

**MCQ example:**
```json
{
  "type": "mcq",
  "course": "<courseId>",
  "topic": "<topicId>",
  "questionText": "What is 2 + 2?",
  "options": ["2", "3", "4", "5"],
  "correctAnswer": "4",
  "explanation": "Basic addition.",
  "marks": 1
}
```

**Subjective/fill-in example:**
```json
{
  "type": "subjective",
  "course": "<courseId>",
  "topic": "<topicId>",
  "questionText": "What gas do plants absorb during photosynthesis?",
  "expectedAnswer": "carbon dioxide",
  "explanation": "Plants absorb CO2 and release oxygen.",
  "marks": 2
}
```

**Bulk add** — `POST /questions/bulk`:
```json
{ "questions": [ { ...question1 }, { ...question2 } ] }
```
Returns a 207 with `createdCount`, `failedCount`, and per-row `errors` so you know exactly which rows failed and why — good rows still get created even if others fail.

Uploading an image: send as `multipart/form-data` with a field named `image`, plus the other fields as normal form fields (this is what the "Add a single question" form in the app does).

---

## 6. Exams — `/api/exams` (protected)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/exams/start?course=&topic=&mode=short\|medium\|long\|instant` | Get a fresh, shuffled question set + timer config. Answers are never included. |
| POST | `/exams/instant/check` | Instant Mode only — grade one question immediately: `{ "questionId", "userAnswer" }` |
| POST | `/exams/submit` | Submit a completed exam (any mode), grades everything, saves to history |
| GET | `/exams/history` | Logged-in user's own past attempts (summary, no full answer detail) |
| GET | `/exams/results/:id` | Full detail of one attempt — every question, your answer, correct answer, feedback |
| GET | `/exams/performance` | Aggregated stats: total exams, overall average, per-topic average, weak topics (<50%) |

**Exam mode config** (edit in `examModes.js`):

| Mode | Questions | Time |
|---|---|---|
| Short | 20 | 15 min |
| Medium | 30 | 20 min |
| Long | 50 | 45 min *(see note below)* |
| Instant | 15 | untimed, one question at a time |

> Your original brief said Long Mode = 50 questions in 10 minutes. That's 12 seconds/question, which is almost certainly a typo — I used 45 minutes instead. Change the `durationMinutes` value in `examModes.js` any time.

**POST `/exams/submit`:**
```json
{
  "course": "<courseId>",
  "topic": "<topicId>",
  "mode": "short",
  "startedAt": "2026-09-08T10:00:00.000Z",
  "answers": [
    { "questionId": "<id1>", "userAnswer": "4" },
    { "questionId": "<id2>", "userAnswer": "carbon dioxide" }
  ]
}
```
Returns the full graded `result` object: score, percentage, marks, and a per-question breakdown with feedback (`"Correct"`, `"Similar meaning - partial credit awarded (78% match)"`, `"Opposite meaning - your answer contradicts the expected answer"`, `"Incorrect"`).

**How fill-in grading works** (in `scoring.js`):
1. Normalize both answers (lowercase, trim, strip punctuation).
2. Exact match → full marks.
3. Matches a known antonym pair (e.g. "increase" vs "decrease") → 0 marks, flagged as opposite meaning.
4. String similarity ≥ 60% → half marks, flagged as partial/similar.
5. Otherwise → 0 marks.

This is a solid heuristic, not true language understanding. If you later want smarter grading (e.g. "the mitochondria is the powerhouse of the cell" correctly matching "mitochondria produces energy"), the cleanest upgrade is to route ungraded/borderline subjective answers through an AI grading call (e.g. the Claude API) instead of pure string similarity — ask your developer to wire that into `gradeSubjective()` if you want it later.

---

## 7. Library — `/api/library` (protected)

| Method | Endpoint | Access |
|---|---|---|
| GET | `/library?course=<courseId>` | Any logged-in user |
| POST | `/library` | Admin, Staff, Master Admin — multipart form, field `file` (PDF only) |
| DELETE | `/library/:id` | Admin, Staff, Master Admin |

Form fields for upload: `title`, `course`, `description` (optional), `file` (the PDF).

---

## 8. My account — `/api/users` (protected)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users/me` | Get my own profile |
| PUT | `/users/me` | Update my name/phone |
| PUT | `/users/me/password` | Change my password: `{ currentPassword, newPassword }` |

---

## 9. Health check

`GET /api/health` — returns `{ success: true, message: "..." }`. Useful for confirming the server is up after deploying.

---

## Data model summary

- **User**: name, email, phone, password (hashed), role (`masterAdmin`/`admin`/`staff`/`student`), createdBy, isActive
- **Course**: name, description
- **Topic**: name, course, description
- **Question**: type (`mcq`/`subjective`), course, topic, questionText, image, options[4] + correctAnswer (mcq) or expectedAnswer (subjective), explanation, marks
- **ExamResult**: user, course, topic, mode, answers[] (with grading detail), totalMarks, marksScored, percentage, timestamps
- **Library**: title, description, course, fileUrl, uploadedBy

Every record that belongs to a user (results, profile) is scoped by `req.user._id` from the JWT — nobody can read or modify another user's data through the API.
