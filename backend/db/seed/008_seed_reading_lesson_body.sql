-- The real text for Module 2's reading lesson (previously seeded empty/unpublished
-- in 007). Author-written, not generated filler — see docs/handover.md. Run after
-- 007_seed_course_module2_and_free_preview.sql.

UPDATE lessons
SET body = 'Most risk registers fail long before anyone questions the framework behind them. They fail at the sentence level — one vague line nobody can act on, sitting in a spreadsheet nobody opens again. This lesson is about fixing that at the level where it actually breaks: the entry itself.

1. Why register entries become unreadable

Four habits are enough to kill a register on their own, and most registers have all four.

Vague risk statements. "Risk to business performance" describes almost nothing — it could mean a dozen different failures, so a reader has no idea what''s actually being tracked.

No clear owner. A risk that isn''t tied to one named person isn''t managed, it''s recorded. Ownership is what turns an entry into a commitment instead of a note.

No action. A risk with a rating and no next step is a warning with nowhere to go. It sits there, gets reviewed every quarter, and nothing changes.

Too much background. Explaining the entire operating environment before naming the risk buries the one sentence that matters under paragraphs that don''t move a decision forward.

Fix those four and most of the register becomes readable — everything else is formatting.

2. Write the risk in one sentence

Before you touch a template, write the risk as a single, specific sentence: an event, and its business consequence. If it takes more than one sentence, you''re probably describing a cause and an effect that should stay separate — or you haven''t actually decided what the risk is yet.

3. Before / after

BEFORE:
"There is a risk that changes in our operating environment could impact business performance."

AFTER:
"A failure of our primary logistics provider could delay customer deliveries by more than 48 hours."

The "after" version names the event — a specific provider failing — and the consequence, with a number attached. Anyone reading it, including someone outside your team, knows exactly what''s being tracked. Notice what''s missing, too: no throat-clearing about the operating environment, no hedging. Just the risk.

4. Add the owner

Every entry needs one name, not a team and not a function. "Operations" is not an owner; "Operations Manager, J. Reyes" is. If you can''t name a single accountable person, that''s worth flagging on its own — a risk with no owner is really an unassigned decision waiting to happen, and the register should say so rather than hide it behind a department name.

5. Add the next action

The action is what makes an entry worth returning to. It doesn''t need to be the finished mitigation plan, just the next concrete step and a date. "Confirm backup logistics provider by 30 September" tells the reader something is actually moving. "Monitor" is not an action, it''s a placeholder for one — and a register full of placeholders is indistinguishable from a register nobody is managing.

6. The one-sentence test

Before you close an entry, ask: would a board member know what decision or action this entry requires, without asking you to explain it out loud? If the answer is no, the entry isn''t done — it just looks finished. Run every entry you write through this test before you file it, not after someone in a meeting asks what it means.

7. Quick checklist

Before you file an entry, check it has:

□ A specific event, not a category
□ A stated business consequence
□ A clear, named owner
□ A next action with a date
□ Wording a stranger could understand without you in the room

A register full of entries that pass this checklist doesn''t need a redesign to get used again — it just needs someone to be able to read it. The template in the next lesson is built around exactly these five fields, so you can put this straight to work rather than starting from a blank sheet.',
    published = true
WHERE slug = 'writing-entries-people-actually-read';
