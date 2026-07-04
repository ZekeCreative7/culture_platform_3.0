# Pulse Survey Page Improvement Plan

Date: 2026-07-04
Scope: Planning only. No implementation in this round.

## Goal

Improve the Pulse Survey page so it becomes a trustworthy operating cockpit for organizational diagnosis, listening priority, and follow-through commitments.

The page should not merely look analytical. It should help an operator answer:

1. What is happening in the organization?
2. Where should we listen first?
3. What hypothesis are we testing?
4. What commitment did we make?
5. How will we know whether anything changed?

## Current Page And Data Sources

### Primary implementation files

- `webapp/src/pages/PulsePage.jsx`
- `webapp/src/pulse/PulseComponents.jsx`
- `webapp/src/pulse/pulseEngine.js`
- `webapp/src/pulse/PulseCommitmentsBoard.jsx`
- `webapp/src/pulse/pulseUpload.js`
- `webapp/src/pulse/pulseTemplate.js`
- `webapp/src/config/questions.js`
- `webapp/src/config/domains.js`
- `webapp/src/config/pulseRelations.js`
- `webapp/src/config/pulseDivisions.js`
- `webapp/src/config/pulseDivisionMap.js`
- `webapp/src/report/pulseSessionInsight.js`

### Data model

Pulse data is stored as annual aggregate documents in `pulseResults/{year}`. Each document is expected to include:

- `year`
- `companywide.Q1..Q22` with Likert distribution fields: `fav`, `p5`, `p4`, `p3`, `p2`, `p1`
- `divisions.{divisionId}.items.Q1..Q22`
- `divisions.{divisionId}.n`
- `engagementScore.company.y{year}` and optional `exOutlier{year}`
- optional `meta.companyN`
- optional `meta.orgMapping`

The upload flow expects an Excel workbook with:

- `Pulse_{year}`
- `응답자수(N)`
- `EngagementScore(본사제공)`
- `조직매핑`

The page treats Pulse as aggregate organizational health data, not individual response data.

### Current 22 questions

1. Company recommendation
2. Pride
3. Personal achievement
4. 12-month stay intent
5. Opinion respect
6. Access to needed materials
7. Understanding contribution to company goals
8. Role clarity
9. Understanding appropriate role behavior
10. Skill learning opportunities
11. Comfortable asking for wellbeing help
12. Company wellbeing guides/programs
13. Timely manager feedback
14. Manager recognition
15. Manager support in problem situations
16. Manager development conversations
17. Fearless issue raising
18. Next-level leader communication
19. Action taken after last survey
20. Inclusive work environment effort
21. Sense of belonging
22. Collaboration among colleagues

### Current page structure

The page has three tabs:

- `한눈에 보기`: company-level screening
- `조직별로 보기`: division-level listening context
- `상세 데이터로 보기`: question and trend detail

The overview currently includes:

- Pulse purpose statement
- Upload/template panel
- Engagement Score
- Headline diagnosis
- Three movement cards: wellbeing, voice/action trust, belonging
- Top 3 improved and weakened companywide questions
- Relationship mismatch cards
- Voice to Impact gap
- Division priority ranking
- Data confidence summary

The division view includes:

- Division selector
- Division headline and core metrics
- Top 3 company-gap questions
- Relationship mismatch cards
- Psychological perspective
- Organizational operating perspective
- Listening session question
- Commitment board

The expert view includes:

- Engagement trend
- Matched-question trend
- Theme trend map
- Improved/weakened question divergence
- Full priority table

### Verification facts from this review

- `npm run check` passes when using the repo's portable Node path.
- `npm run build` passes when using the repo's portable Node path.
- Pulse-specific tests pass:
  - `tests/pulseUpload.test.js`
  - `tests/pulseSessionInsight.test.js`
- Runtime browser check at `http://127.0.0.1:4173/culture_platform_3.0/?preview=1#/pulse` shows the Pulse page, but local preview still attempts Firestore Pulse/commitment loading and shows: `Pulse 데이터를 불러오지 못했습니다. Missing or insufficient permissions.`
- Console errors observed in local preview:
  - `Firestore Pulse 로드 실패: FirebaseError: Missing or insufficient permissions.`
  - `Firestore 약속 로드 실패: FirebaseError: Missing or insufficient permissions.`
- This means local preview is not a reliable read-only Pulse demo path yet.

## Objective Evaluation

### What is already strong

- The page correctly frames Pulse as a first screening and listening-priority tool, not as a punitive scorecard.
- It separates company-level and division-level analysis.
- It uses aggregate data and includes privacy guardrails such as `N < 3` masking.
- It has an upload template flow with PII scanning and organization mapping.
- It connects Pulse findings to commitments through a `You Said / We Heard / We Will / We Did` board.
- It already contains useful operating logic: outlier detection, priority ranking, domain focus, relationship mismatch rules, and Pulse-to-session insight integration.
- It preserves the important product model: Pulse = health check, sessions = intervention, follow-up = change check, commitments = accountability loop.

### Core weaknesses

1. The page overclaims in narrative areas.
   Several diagnosis paragraphs sound like expert conclusions, but the page does not always show the evidence trail, confidence, alternative hypotheses, or what would falsify the interpretation.

2. Local preview is misleading.
   Preview mode bypasses app-wide Firestore subscriptions, but PulsePage still calls `loadPulseYears()` and `loadPulseCommitments()` directly. Operators and reviewers see a permissions error instead of a useful empty/demo state.

3. The domain taxonomy is too coarse.
   Current domains are:
   - psychological safety
   - silo reduction
   - resilience
   - overall atmosphere
   This misses or blurs role clarity, decision rights, career/growth, manager effectiveness, inclusion/belonging, and follow-through trust as separate operating levers.

4. The page mixes executive reporting and operator workflow.
   Engagement Score, diagnostic story, upload panel, priority queue, and commitment board all live together, but the screen does not clearly distinguish "what executives need to know" from "what operators should do next."

5. Division ranking can become a hidden league table.
   The copy says not to rank or penalize, but the UI uses ranking language and a full priority table. Without stronger guardrails, this can be read as "worst teams" rather than "where support starts."

6. The statistical basis is thin.
   The page uses point estimates, simple gaps, weighted priority, and thresholds. It does not expose margin of error, sample-size adequacy beyond basic N warnings, non-response risk, benchmark validity, or year-to-year comparability.

7. The outlier logic contains hard-coded business exceptions.
   `고객혁신본부CE` is manually forced as an outlier. That may be valid, but the page needs a transparent rationale and admin-editable reason so future reviewers do not treat it as an invisible algorithmic truth.

8. Commitments are not yet tightly bound to diagnosis evidence.
   Commitments can store source questions, but the UI does not make a strong path from specific evidence -> listening question -> promise -> owner -> deadline -> proof -> follow-up result.

9. The "easy/expert" layer is underused.
   The toggle exists, but the page structure still exposes mixed Korean/English labels and specialist language such as Engagement Score, Voice Impact Gap, Data Confidence, Divergence Map, RAG, and outlier.

10. The page does not yet show "what changed because of our work."
    It shows survey trends and commitments, but not a clear before/intervention/after/follow-up chain at the Pulse page level.

## Expert Critique

### Organizational diagnosis expert

The page has a good first diagnostic spine, but it needs stronger separation between signal, hypothesis, and decision. Every major insight should show:

- observed signal
- comparison point
- interpretation
- confidence
- alternative explanation
- next evidence to collect
- recommended operating action

Without this, users may confuse plausible storytelling with diagnosis.

### Organizational culture expert

The page correctly avoids blaming low-scoring groups, but the ranking and risk language can still reproduce blame. Culture work needs language that turns "low score" into "support need" and "listening priority." It should foreground trust repair and psychological safety before asking teams to produce action plans.

### Organizational operations expert

The strongest missing layer is operating cadence. The page should say what the operator does this week:

- confirm data quality
- pick 1-3 listening priorities
- schedule listening sessions
- record what was heard
- publish small commitments
- check due dates
- connect follow-up survey evidence

Right now the page is strong as an analysis board, weaker as a weekly operating board.

### Organizational psychology expert

The page references psychological safety, energy, belonging, and cynicism, but it sometimes jumps from survey scores to inferred internal states. This should be softened and made more testable. It should also distinguish:

- psychological safety: interpersonal risk in speaking up
- voice efficacy: belief that speaking up matters
- belonging: felt membership and acceptance
- inclusion: participation in decisions and opportunities
- burnout/energy: available emotional and cognitive resources

### Survey methodology expert

The page needs stronger validity and reliability guardrails:

- N and response rate
- missingness
- year comparability
- organization reorg comparability
- benchmark limitations
- threshold rationale
- suppression rules
- confidence bands or at least "directional only" markers
- distinction between distribution shifts and mean/favorable shifts

### Executive communication expert

The page should offer a small executive summary mode: one headline, three signals, two risks, three commitments, and one ask. Executives should not have to read the detailed analyst story to know what decision is needed.

### HRBP / facilitator expert

The page should produce a facilitator brief per division:

- why this group is selected
- what not to say
- first 3 listening questions
- likely sensitive topics
- where to avoid overpromising
- what small commitment is safe to make
- what evidence should be captured afterwards

## Improvement Plan

### Priority 0: Make the page trustworthy in preview and empty states

1. Ensure `?preview=1` does not trigger Firestore Pulse and commitment loads.
2. Add a local preview Pulse demo dataset or a clearer "no Pulse data loaded in local preview" state.
3. Replace raw permission errors with operator-safe messages.
4. Add a data-source badge:
   - Firestore live
   - uploaded current year
   - local preview sample
   - no data

Definition of done:

- Local preview Pulse page has no Firestore permission errors.
- Empty state explains exactly how to load or preview Pulse data.
- Browser console has no unexpected Pulse errors.

### Priority 1: Redesign the information architecture around operator decisions

Replace the three generic tabs with a clearer workflow:

1. `요약`: executive and operator summary
2. `우선 경청`: where to listen first and why
3. `조직 상세`: selected division diagnosis
4. `약속 추적`: commitments and evidence
5. `데이터 품질`: upload, mapping, confidence, caveats

Keep expert detail available, but move it behind drill-down panels instead of making it a main narrative lane.

### Priority 2: Turn every insight into an evidence card

Each insight card should include:

- signal title
- supporting questions
- current value
- previous value or benchmark
- change
- N / confidence label
- "what this may mean"
- "what else could explain it"
- "what to ask next"
- linked commitment or session

This is the main move from storytelling to defensible diagnosis.

### Priority 3: Replace ranking language with support-priority language

Change:

- `랭킹`
- `리스크`
- `가중 리스크 점수`
- `worst/top`

Toward:

- `경청 우선순위`
- `지원 필요도`
- `확인 필요 신호`
- `먼저 찾아갈 조직`

Keep sortable tables for operators, but explain that the order is a support queue, not an evaluation.

### Priority 4: Expand the domain model

Proposed diagnostic domains:

1. Engagement foundation: Q1-Q4
2. Voice and action trust: Q5, Q17-Q19
3. Role clarity and operating clarity: Q6-Q9
4. Growth and capability: Q10, Q16
5. Wellbeing and help-seeking: Q11-Q12, Q15
6. Manager support: Q13-Q16
7. Inclusion and belonging: Q20-Q21
8. Collaboration and cross-boundary work: Q18, Q22

The same question can belong to multiple interpretive lenses, but the UI should explain that these are lenses, not independent scales.

### Priority 5: Add a Pulse-to-session-to-follow-up loop

For each selected division, show:

- Pulse signal
- listening session scheduled or needed
- related session survey result
- follow-up survey status
- commitment status
- evidence captured
- next operating action

This makes Pulse part of the change tracker instead of a standalone dashboard.

### Priority 6: Build facilitator and executive outputs

Add two generated views:

- Executive brief:
  - headline
  - strongest signal
  - biggest risk
  - support priorities
  - commitments requiring executive help

- Facilitator brief:
  - selected division context
  - 3 listening questions
  - things to avoid saying
  - safe first commitment pattern
  - follow-up evidence to capture

### Priority 7: Strengthen statistical guardrails

Add a `Data Quality` layer that shows:

- sample size
- response rate if available
- suppressed groups
- missing questions
- year comparability
- org mapping confidence
- outlier rationale
- benchmark caveats
- "directional only" labels where needed

### Priority 8: Make commitments evidence-linked

Improve the commitment board so every commitment can link to:

- Pulse year
- scope
- source question(s)
- insight card
- listening session
- owner role
- due date
- evidence
- follow-up survey result

Add a simple status narrative:

- heard
- promised
- in progress
- done
- checked again

## Proposed First Implementation Slice After Planning

Do not start with a full redesign. Start with the smallest high-trust slice:

1. Fix local preview / empty-state behavior.
2. Add support-priority language changes to the overview table.
3. Add evidence-card format for the top company insight and one selected division insight.
4. Add data-source/confidence badges.
5. Browser-verify:
   - local preview
   - no-data state
   - uploaded-data state if a sample workbook is available
   - desktop and mobile layout
   - no unexpected console errors

## Open Questions For Grilling

1. Should the Pulse page optimize first for executives, HR operators, facilitators, or team leaders?
2. Are Pulse results meant to be visible to all operators, or only to admins/HRBP roles?
3. Should division priority be shown as an ordered queue, grouped bands, or hidden until a division is selected?
4. Is the platform allowed to include generated interpretation text, or should all interpretations be clearly marked as hypotheses?
5. Do we have response rate by division, or only N?
6. Should commitments be public communication artifacts, internal tracking artifacts, or both?
7. What is the minimum evidence required before marking a commitment as "done"?
8. Should the page support Korean-only operator language, or preserve global terms such as Engagement Score?
9. Who owns outlier decisions, and where should the reason be recorded?
10. What should the page do when Pulse and session survey signals disagree?

## Instructions For Independent Review Rounds

Each independent review should challenge this plan from scratch and return:

1. strongest critique of the current Pulse page
2. missing insight or blind spot
3. expert-specific objections
4. revised improvement priorities
5. what should not be built yet
6. first implementation slice recommendation

## Ten-Round Independent Review Synthesis

Ten independent review rounds were run against this document and the current Pulse code. The review lenses were:

1. organizational diagnosis
2. organizational culture
3. HR and organizational operations
4. organizational psychology
5. survey methodology and organizational data analysis
6. executive communication
7. HRBP and facilitation
8. product and UX strategy
9. data governance, privacy, and ethics
10. red-team critique

### Strongest Consensus

The next step should not be a large IA redesign. The next step should be a trust and interpretation-safety slice.

The repeated critique was that the page risks becoming a more polished version of the same problem: a screen that sounds expert, but can still overstate what the data proves, expose sensitive organizational signals, or make operators think in rankings instead of careful listening.

### Strongest Objections To The Initial Plan

1. Interpretation safety must come before more insight UI.
   Reviewers repeatedly objected to strong phrases such as `조용한 퇴사`, `학습된 무력감`, `정서적 에너지 고갈`, `냉소`, and similar psychological labels. Pulse can suggest a topic for inquiry; it should not diagnose inner states.

2. The question dictionary and semantic mapping need repair before domain expansion.
   Several reviewers noticed that some question labels, semantic keys, and domain uses appear misaligned. Examples to re-check include Q6, Q8, Q9, Q18, and Q22. Expanding domains before fixing the question dictionary would increase false precision.

3. Data governance is not a later concern.
   Pulse upload, mapping changes, outlier decisions, commitment edits/deletes, and GPT prompt generation need clearer permissions, audit trails, and data-use limits. Aggregated data can still create group-level identification and stigma.

4. Ranking language is not solved by nicer labels.
   Even if the copy says "support priority," numeric ranking tables can still be read as worst-team league tables. Priority bands are safer than rank numbers.

5. Facilitator usefulness is more urgent than polished executive storytelling.
   HRBP/facilitator review argued that the dangerous moment is not reading the chart; it is the live conversation where a leader gets defensive, overpromises, or mishandles sensitive disclosures.

6. Executive summaries should be decision cards, not analysis summaries.
   Executives need to know what decision or support is required. A polished narrative without a decision request can become reporting theater.

7. Preview reliability is still a must-fix.
   Local preview currently surfaces Firestore permission errors on the Pulse page. This damages trust and makes review/demo work unreliable.

### Revised Product Principle

Pulse is not a verdict engine.

Pulse is a governed listening-priority and follow-through tool. Its job is to help the operator:

1. know whether the data is usable
2. identify where to listen first
3. avoid unsafe interpretation
4. prepare a careful conversation
5. make small, accountable commitments
6. verify later whether the loop closed

## Final Improvement Plan

### Priority 0: Pulse Safety Rails

Before adding new analysis surfaces, define and enforce safety rails:

- Replace strong psychological labels with observable experience language.
- Every diagnosis-style section must distinguish:
  - observed signal
  - possible interpretation
  - alternative explanation
  - what cannot be concluded
  - next listening question
- Add data-use language:
  - not for performance evaluation
  - not for individual tracking
  - not a team-ranking tool
  - directional signal only where data is limited
- Group support priority into bands instead of numeric rankings wherever possible:
  - `즉시 경청`
  - `추가 확인`
  - `모니터링`
  - `데이터 재검토`
  - `표본 부족`

### Priority 1: Preview And Empty-State Trust

Fix the local preview path so `?preview=1#/pulse` does not produce Firestore permission errors.

The no-data and preview states should show:

- current data source
- whether data is live, local preview, uploaded, or missing
- what the operator can safely do next
- sample/demo path if available
- upload path if live data is needed

### Priority 2: Data Contract And Question Dictionary

Before expanding domains, create a single authoritative Pulse question dictionary.

For each question:

- Q number
- visible label
- semantic key
- allowed interpretation
- disallowed interpretation
- domain lenses
- benchmark availability
- benchmark source
- comparison caveats

Then update domain mapping and relation rules to use this dictionary.

Data contract should also identify:

- N
- population size if available
- response rate if available
- missing questions
- organization mapping confidence
- organization reorg/comparison status
- benchmark source and validity
- outlier reason and owner

### Priority 3: Governance And Auditability

Pulse must have operating controls before it becomes more powerful.

Add or plan explicit controls for:

- who can upload Pulse data
- who can edit org mapping
- who can mark outliers or exclude data
- who can create/edit/delete commitments
- who can copy GPT prompts
- audit logs for upload, mapping change, outlier decision, commitment create/edit/delete, and prompt copy
- reason fields for destructive or interpretive changes
- default suppression or restricted detail for low-N or low-confidence groups

### Priority 4: Operator First Screen

The Pulse landing state should answer four questions in 10 seconds:

1. Is the data usable?
2. Where should we listen first?
3. What is the safest question to ask?
4. What commitments are open or overdue?

The first screen should include:

- data status card
- this-week support queue
- one company-level signal
- one selected-division signal when selected
- open commitments / overdue commitments
- next operating action

Keep detailed analysis lower on the page or behind drill-downs.

### Priority 5: Evidence Cards, But Only Two First

Do not cardify the whole page at once.

Implement the evidence-card pattern for:

1. one company-level signal
2. one division-level signal

Each card should contain:

- signal
- source questions
- value and change
- N / response-rate status / comparison status
- possible interpretation
- alternative explanations
- what cannot be concluded
- listening question
- linked commitment or next action

### Priority 6: Facilitator Brief Before Full Executive Brief

For the first selected division, add a practical facilitator brief:

- why this group is selected
- 3 safe opening questions
- 5 phrases leaders should avoid
- how to respond when leaders become defensive
- sensitive-topic escalation rule
- safe first commitment examples
- what to record after the session
- 48-hour follow-up message structure

This should use plain field language, not psychological labels.

### Priority 7: Commitment Board As A Trust Ledger

The commitment board should become an accountability ledger, not just a promise list.

Add or plan:

- linked signal/question
- linked listening session
- owner role
- due date
- next check date
- evidence required
- status-change reason
- executive support needed
- follow-up result
- audit trail

The state progression should be:

1. heard
2. acknowledged
3. promised
4. in progress
5. done
6. checked again

### Priority 8: Executive Decision Card Later

Only after the safety, data, and operator loop are reliable, add an executive decision view:

- key signal
- why it matters
- what is uncertain
- decisions needed
- support requested
- 30-day commitment
- next verification point

This should not be a broad auto-generated report at first.

## Final First Implementation Slice

The next build slice should be:

### Pulse Trust Patch

Scope:

1. Fix local preview / empty-state Pulse behavior so permission errors do not appear.
2. Add a data source and data-use safety badge.
3. Replace ranking/risk/RAG-heavy labels with support-priority language and bands.
4. Repair or centralize the Pulse question dictionary for Q labels, semantic keys, and domain lenses.
5. Prevent division pages from reusing company-level insight text as if it described the selected division.
6. Add one company-level and one division-level evidence card using the safer format.
7. Add minimal audit/logging plan or implementation hooks for Pulse upload and commitment changes.

Explicitly out of scope:

- full 5-tab IA redesign
- full executive brief
- full facilitator toolkit
- GPT prompt expansion
- confidence interval visualizations
- all-question evidence cards
- full Pulse-to-session-to-follow-up reconstruction
- new automated psychological diagnosis

Completion criteria:

- `?preview=1#/pulse` shows no Pulse Firestore permission errors.
- No-data state clearly explains what the operator can do.
- Support priority is not displayed as a blame/ranking league table.
- Strong psychological labels are removed or downgraded to observable experience language.
- Question dictionary and domain labels have one source of truth.
- One company signal and one division signal show evidence, limits, and next listening question.
- Browser verification passes for desktop and mobile intent.
- Console has no unexpected Pulse errors.

