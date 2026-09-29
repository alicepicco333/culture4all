# Culture for All: comprehension test plan

A small think-aloud study to find out whether readers understand the charts, and what to change when
they don't. It is written to be run by one person in about a week. No results are recorded here yet:
fill in the results section after the sessions.

## What we want to learn

1. Can readers find a specific fact in a chart (a value, a rank, a comparison)?
2. Do they draw the conclusion the chapter intends, and not a stronger one (for example, cause instead of association)?
3. Do the "How to read it" lines, the data tables and "Follow a region" help, or go unnoticed?
4. Where do people misread: scales (per inhabitant, log scale), colour meanings (south vs. north and centre), maps?

## Participants

- 5 people. Five sessions surface most of the serious comprehension problems in a page like this.
- A mix: at least 2 who rarely read charts, at least 1 who reads Italian public data professionally or academically,
  at least 1 on a phone, and, if possible, 1 who uses a screen reader or zoom.
- Not people who worked on the project.

## Setup

- 30 to 40 minutes, in person or on a video call with screen sharing.
- Open the live page with no region selected. For the phone participant, send the link to their phone.
- Record the screen and audio, with consent. Take notes in the sheet below as you go.

## Script

**Introduction (read aloud)**
"This is a web page about access to culture in Italy. I'm testing the page, not you: there are no wrong answers,
and if something is confusing, that is exactly what I need to know. Please think aloud as you go: say what you are
looking at, what you expect, and what surprises you. You can stop at any time."

**Consent**
Ask for permission to record. Explain that recordings stay with the researcher and are deleted after the analysis,
and that quotes in any write-up will be anonymous.

**Free exploration (3 minutes)**
"Take a few minutes to look at the page as you normally would. Tell me what you think it's about."

**Tasks.** Read each one aloud. Do not point at the chart. Note time, success and path.

| # | Task | Correct answer | What it tests |
|---|------|----------------|---------------|
| 1 | Which region has the most libraries for the number of people who live there? | Valle d'Aosta (4.3 per 10,000, 2012), then Trentino-Alto Adige (3.8). "Rome" or "Lombardia" means the reader used raw counts. | Counts vs. rates, the two maps |
| 2 | Roughly what share of municipalities in Abruzzo has no library? | About 56% (170 of 305) | Reading a ranked bar chart |
| 3 | If you live in a small town without a library, how far is the nearest one likely to be? | For half of such towns, under 4 km (median 3.9 km) | The distance map and its bars |
| 4 | How many times more does a library in Emilia-Romagna lend than one in Campania? | About 68 times (10,137 vs 149) | Bar comparison, the headline figure |
| 5 | Do libraries that lend more *cause* more people to read? | No: the page shows an association, not a cause | Scatter plot, log scale, over-reading |
| 6 | Did the difference in reading between north and south get bigger or smaller since 2011? Why? | Smaller (16.5 to 13.9 points), because the north read less, not because the south read more | Slope chart and gap line |
| 7 | Sicily has very few events per resident. Does that mean there is little culture there? | No: Sicily runs its own heritage, so its events are mostly outside this dataset | Caveats, reading the source notes |
| 8 | Pick the region you know best and tell me one thing where it does better than the Italian average. | Any correct fact, e.g. via "Follow a region" | Discoverability of Follow a region |
| 9 | Find the exact number of loans per public library in Lazio. | 2,568 per public library (in the chart's tooltip or the data table) | Tooltips, data tables |

**After each task**
- "How sure are you, from 1 (guessing) to 5 (certain)?"
- If they struggled: "What did you expect to see?"

**Closing questions**
- "What is the one thing you'll remember from this page?"
- "Was anything misleading, or hard to trust?"
- "Did you notice the 'How to read it' lines? Did they help?"
- "Would you use 'Follow a region'? For what?"
- Single Ease Question for the whole page: "Overall, how easy was it to understand, from 1 (very hard) to 7 (very easy)?"

## Notes sheet (one per participant)

| Task | Success (yes / partial / no) | Time | Confidence 1–5 | Path taken | Quote | Problem seen |
|------|------------------------------|------|----------------|------------|-------|--------------|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |
| 4 | | | | | | |
| 5 | | | | | | |
| 6 | | | | | | |
| 7 | | | | | | |
| 8 | | | | | | |
| 9 | | | | | | |

## Analysis

1. For each task, count successes and average confidence. Flag any task with 2 or more failures, and any case of
   high confidence with a wrong answer: those are the most harmful misreadings.
2. Group the problems seen into themes (for example "reads counts as rates", "misses the source note",
   "doesn't find the table").
3. Rate each problem: 3 = leads to a wrong conclusion, 2 = slows the reader down, 1 = cosmetic.
4. Decide one change per severe problem, make it, and, if time allows, re-test the failed tasks with 2 new people.

## Results

*To be filled in after the sessions.*

| Problem | Seen in | Severity | Change made | Re-test |
|---------|---------|----------|-------------|---------|
| | | | | |

## Changes already made for comprehension (2026 redesign)

These were designed ahead of the test, based on common chart-reading problems; the test checks whether they work.

- A "How to read it" line under every chart heading, in plain language.
- The finding stated in words above each chart, with the key numbers in bold.
- A data table behind every chart, for exact values and for screen readers.
- Charts linked to their finding and how-to line for screen readers (`aria-describedby`).
- "Follow a region": choose a region and it stays highlighted in every chart, with a profile of where it stands.
- Caveats placed next to the chart they qualify (distance is straight-line; events cover only the Ministry's places).
