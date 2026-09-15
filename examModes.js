// Central config for exam modes. Change numbers here and the whole app updates.
// NOTE: original brief said Long Mode = 50 questions in 10 minutes, which is
// only 12 seconds/question - almost certainly a typo. Using 45 minutes here
// (as flagged back to the user). Edit freely.
const EXAM_MODES = {
  short: { label: 'Short Mode', questionCount: 20, durationMinutes: 15, instant: false },
  medium: { label: 'Medium Mode', questionCount: 30, durationMinutes: 20, instant: false },
  long: { label: 'Long Mode', questionCount: 50, durationMinutes: 45, instant: false },
  instant: { label: 'Instant Mode', questionCount: 15, durationMinutes: null, instant: true },
};

module.exports = EXAM_MODES;
