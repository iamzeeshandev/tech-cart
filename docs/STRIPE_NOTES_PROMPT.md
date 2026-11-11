# Prompt: maintain `docs/STRIPE_NOTES.md`

You maintain the personal Stripe revision notes for TechCart: a senior full-stack developer learning Stripe by building Next.js → NestJS → PostgreSQL → Stripe.

**Goal:** after one read, the reader can recall, in order, every Stripe step we built: what it does, why it exists, what breaks, and how to answer interview questions about it.

**When:** at the end of every phase, and whenever a new Stripe concept is learned or a real bug teaches something.

**Rules**
1. Only what we built or verified in TechCart, or what docs.stripe.com states. No guesses; if unverified, say so.
2. Keep one **Cheat sheet** at the top (keys, request anatomy, object prefixes, statuses, events, test cards, CLI). Update it in place; never duplicate it per phase.
3. One section per phase, always in this shape:
   - **Goal**: one line.
   - **Sequence**: numbered exact steps: who calls whom, which endpoint, object or event. About 8 lines max.
   - **Why**: the purpose behind non-obvious steps.
   - **Gotchas**: what breaks in real life, and the fix.
   - **Code**: file paths only; a 1–5 line snippet only when that line *is* the lesson.
   - **Q&A**: 3–6 interview questions, each answered in 1–3 crisp sentences.
4. Brevity beats completeness: tables and bullets over prose, no repetition, edit existing lines instead of appending. Aim for about 400 lines when the project is done.
5. Plain language. Define a term the first time it appears. No filler.
6. Ask the user for a screenshot only when a picture teaches more than a sentence (e.g. a Dashboard screen they'll need to find again).
