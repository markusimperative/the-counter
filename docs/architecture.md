# Architecture and reveal boundaries

Vite builds a React/TypeScript application. Authored scenes and the pure narrative reducer live in `src/narrative/`; presentation, audio and survey effects consume the reducer's explicit state. No gameplay AI, random branch selection or server response determines the narrative.

The three chapters preserve 64 Timed histories (A/B/C/unanswered per chapter) and 27 Reflective histories. Response windows use elapsed play time; captions outside decisions remain player-paced. The browser's current date/time and sound availability do not select outcomes.

`src/reading/companions.ts` controls the article metadata and existing opening/final visibility rules. The public opening offers optional reading; pilot opening, gameplay, Review and the survey omit it. Replay resets the gate.

`AfterShift` owns the optional six-question reflection. Its existing final-resolution branch renders the closing screen only after confirmed save/export, explicit skip or decline. `BehindTheCounter` is rendered inside that branch, after the companion essays. It is absent from opening/onboarding, chapters, Review, invitation, questions, consent and unconfirmed export. No new question, answer, response field or storage layer is introduced.

The discovery uses a semantic labelled section and a descriptive link with a new-tab notice, `noopener noreferrer`, a visible focus outline and a minimum 44-pixel target. Its short fade is disabled by system or in-app reduced-motion preference. It remains in normal document flow within the existing scrollable final screen.

Local pilot responses are written only with explicit consent by the loopback receiver in `server/`; static production cannot collect them. The public source contains tests and fixtures but no participant records or saved verification responses.
