const stringSimilarity = require('string-similarity');

// A small built-in antonym list covering common exam-answer opposites.
// This is intentionally simple - true meaning-detection needs a real NLP/AI
// model. See the "Improving grading accuracy" note in API_DOCUMENTATION.md
// for how to wire this up to an AI grading call instead, if you want smarter
// grading later.
const ANTONYM_PAIRS = [
  ['true', 'false'], ['yes', 'no'], ['increase', 'decrease'], ['rise', 'fall'],
  ['positive', 'negative'], ['acid', 'base'], ['expand', 'contract'],
  ['open', 'closed'], ['open', 'close'], ['hot', 'cold'], ['high', 'low'],
  ['fast', 'slow'], ['big', 'small'], ['large', 'small'], ['strong', 'weak'],
  ['light', 'dark'], ['heavy', 'light'], ['solid', 'liquid'], ['wet', 'dry'],
  ['before', 'after'], ['above', 'below'], ['left', 'right'], ['up', 'down'],
  ['active', 'passive'], ['oxidation', 'reduction'], ['inhale', 'exhale'],
  ['expensive', 'cheap'], ['import', 'export'], ['supply', 'demand'],
  ['agree', 'disagree'], ['include', 'exclude'], ['legal', 'illegal'],
];

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()]/g, '')
    .replace(/\s+/g, ' ');
}

function isOppositeMeaning(userAns, expectedAns) {
  const u = normalize(userAns);
  const e = normalize(expectedAns);
  return ANTONYM_PAIRS.some(
    ([a, b]) => (u.includes(a) && e.includes(b)) || (u.includes(b) && e.includes(a))
  );
}

/**
 * Grades a single MCQ answer.
 */
function gradeMCQ(question, userAnswer) {
  const correct = normalize(userAnswer) === normalize(question.correctAnswer);
  return {
    isCorrect: correct,
    marksAwarded: correct ? question.marks : 0,
    marksPossible: question.marks,
    feedback: correct ? 'Correct' : 'Incorrect',
  };
}

/**
 * Grades a single fill-in/subjective answer:
 * - Exact match (case/whitespace/punctuation-insensitive)  -> full marks
 * - Opposite meaning (matches a known antonym pair)         -> 0 marks, flagged
 * - Similar meaning (string similarity above threshold)     -> partial marks
 * - Otherwise                                                -> 0 marks
 */
function gradeSubjective(question, userAnswer) {
  const expected = question.expectedAnswer || '';
  const marks = question.marks || 1;

  if (!userAnswer || !userAnswer.trim()) {
    return { isCorrect: false, marksAwarded: 0, marksPossible: marks, feedback: 'No answer submitted' };
  }

  const uNorm = normalize(userAnswer);
  const eNorm = normalize(expected);

  if (uNorm === eNorm) {
    return { isCorrect: true, marksAwarded: marks, marksPossible: marks, feedback: 'Correct' };
  }

  if (isOppositeMeaning(userAnswer, expected)) {
    return {
      isCorrect: false,
      marksAwarded: 0,
      marksPossible: marks,
      feedback: 'Opposite meaning - your answer contradicts the expected answer',
    };
  }

  const similarity = stringSimilarity.compareTwoStrings(uNorm, eNorm);

  if (similarity >= 0.6) {
    const partial = Math.round(marks * 0.5 * 100) / 100;
    return {
      isCorrect: false,
      marksAwarded: partial,
      marksPossible: marks,
      feedback: `Similar meaning - partial credit awarded (${Math.round(similarity * 100)}% match)`,
    };
  }

  return { isCorrect: false, marksAwarded: 0, marksPossible: marks, feedback: 'Incorrect' };
}

function gradeAnswer(question, userAnswer) {
  return question.type === 'mcq' ? gradeMCQ(question, userAnswer) : gradeSubjective(question, userAnswer);
}

module.exports = { gradeAnswer, gradeMCQ, gradeSubjective, normalize };
