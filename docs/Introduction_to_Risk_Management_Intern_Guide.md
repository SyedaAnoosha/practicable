

**`EFFECTIVE RISK MANAGEMENT`**

`INTERN HANDBOOK  ·  01`

**Introduction to**  
**Risk Management**

A starter guide for technical interns

| Audience | Interns and new starters. No prior risk knowledge assumed. |
| :---- | :---- |
| Methodology | ISO 31000:2018 (principles, framework, process) |
| Scope | Practitioner grounding. Not legal, regulatory or financial advice. |
| Version | 1.0  ·  July 2026 |

`CONFIDENTIAL  ·  INTERNAL USE  ·  www.effectiverm.com`

`CONTENTS`

# **What is in this handbook**

**Before you start`3`**

How to use this guide`3`

**Part One  —  Foundations`4`**

01   What risk actually is`5`

02   The language of risk`7`

03   Where risk lives: the three lines of defence`8`

**Part Two  —  The process`9`**

04   The risk management process`10`

05   Analysing risk: likelihood and consequence`12`

06   Treating risk: reducing likelihood and consequence`15`

07   Risk appetite and tolerance`18`

08   Monitoring: KRIs and KCIs`19`

**Part Three  —  Standards and frameworks`20`**

09   The landscape`21`

10   How to read a standard without reading all of it`23`

**Part Four  —  Risk in practice`24`**

11   Three client scenarios`25`

12   The risks in your project`29`

**Part Five  —  Practice`31`**

13   Exercises`32`

14   Ten habits`34`

15   Glossary`35`

16   Where to go next`37`

`BEFORE YOU START`

# **How to use this guide**

You were brought in for what you can build. This guide covers the other half of the job — understanding the thing we build **for**.

Effective Risk Management helps organisations make decisions when the future is uncertain. Every product in our portfolio is a tool for doing that better: RiskMate, Wahid AI, the OSINT vendor-scoring work, the emerging risk model, the AI governance crosswalk. You cannot build a good risk product without understanding what a risk actually is, how it gets measured, and what a user will do with your output at nine o’clock on a Tuesday when their board asks a hard question.

You do not need a risk background. You do need to finish this document before you go far into your build.

### **How to work through it**

| `PART` | `WHAT IT COVERS` | `HOW TO READ IT` |
| :---- | :---- | :---- |
| One — Foundations | What risk is, the vocabulary, who owns it | Read properly. Everything else assumes it. |
| Two — The process | ISO 31000 process, rating risk, reducing risk, monitoring | Read properly. This is the working core. |
| Three — Standards | The frameworks and regulations you will meet | Skim now. Return when one appears in your project. |
| Four — In practice | Three client scenarios, plus the risks in your own project | Read the scenarios. Read your project section twice. |
| Five — Practice | Six exercises with worked answers, habits, glossary | Attempt the exercises before reading the answers. |

### **A note on confidence**

Throughout your internship you will be asked to make judgements on incomplete information. That is not a flaw in the exercise — it is the job. The professional standard is not certainty. It is stating clearly what you know, what you assumed, and how confident you are. "I am not sure yet, here is what I am testing" is a good answer. A confident answer with no basis is not.

| `SCOPE OF THIS DOCUMENT` This is practitioner grounding written for internal training. It is not legal advice, regulatory advice, or a compliance guarantee. Where a real client engagement is involved, the applicable standards and obligations take precedence over anything summarised here. |
| :---- |

**`PART One`**

**Foundations**

What a risk actually is, the words we use to describe one, and who in an organisation is responsible for it.

`01   What risk actually is`

`02   The language of risk`

`03   Where risk lives: the three lines of defence`

`SECTION 01`

## **What risk actually is**

ISO 31000 defines risk as **the effect of uncertainty on objectives**. Three words in that sentence are doing all the work.

| `WORD` | `WHAT IT MEANS` | `WHY IT MATTERS` |
| :---- | :---- | :---- |
| Objectives | Risk is always relative to something you are trying to achieve. | No objective, no risk. "The server might go down" is not a risk statement until you say what that stops you doing. |
| Uncertainty | The outcome is not settled. | If it is certain, it is not a risk — it is a fact, a cost, or an issue. A known bug in production is an issue. The chance that an unknown bug reaches production is a risk. |
| Effect | A deviation from what was expected. | Usually negative. It can also be positive — an opportunity you fail to take is a risk to your objectives. |

### **Distinctions worth getting right early**

| `TERM` | `DEFINITION` | `EXAMPLE` |
| :---- | :---- | :---- |
| Threat | The thing that could act against you. | An attacker; a supplier failure; a regulatory change. |
| Vulnerability | The weakness it could act through. | An unpatched server; a single-supplier dependency; an untested plan. |
| Risk | The combination, expressed as an effect on an objective. | An attacker exploiting the unpatched server, causing a customer data breach. |
| Issue | A risk that has materialised. It is now real. | The breach has happened. It leaves the risk register and enters incident management. |
| Near miss | It nearly happened. Free information, usually wasted. | A key was committed to a public repo and revoked within four minutes. |

Near misses are the cheapest risk data an organisation ever gets. Most organisations never collect them, because nobody wants to report the thing that did not go wrong. If you have a near miss in your project, say so in your check-in.

### **Writing a risk properly**

Most risk registers are useless because the entries are nouns. "Cyber security" is not a risk. "The database might be hacked" is closer but still unmanageable — you cannot tell what would fix it.

Use this structure:

| `THE RISK STATEMENT STRUCTURE` Because \[cause\], \[event\] may occur, resulting in \[consequence\]. |
| :---- |

**Worked example.** "Because privileged access to the production database is not time-limited, an attacker who compromises a developer account may exfiltrate customer records, resulting in a notifiable data breach, regulatory action, and the loss of two enterprise clients."

**The test.** Read your statement and ask two questions. Can you point at something that would reduce the **cause**? Can you point at something separate that would reduce the **consequence**? If the answer to either is no, the statement is still too vague to manage. Section 06 explains why those are two different jobs.

`SECTION 02`

## **The language of risk**

These twelve terms carry the rest of the document. A fuller glossary sits at the back.

| `TERM` | `WHAT IT MEANS` |
| :---- | :---- |
| Likelihood | How probable the event is, over a stated period. Without a time horizon the word is meaningless. |
| Consequence | How bad it is if it happens. Assessed across several dimensions, not just money. |
| Control | Anything that modifies risk — a process, a system setting, a contract clause, a review. |
| Inherent risk | The rating before controls, or assuming controls fail. |
| Residual risk | The rating after controls, as they actually operate today. |
| Target risk | Where you intend to get to, by a stated date. The gap from residual is your treatment plan. |
| Treatment | What you decide to do about a risk: avoid, reduce, transfer, or accept. |
| Risk appetite | How much risk the organisation is willing to take in pursuit of its objectives. |
| Tolerance | The operational threshold that turns appetite into something you can actually breach. |
| Risk owner | The named person accountable for the risk. A team is not an owner. A function is not an owner. |
| KRI / KCI | Key risk indicator (the risk is moving) and key control indicator (the control is or is not working). |
| Velocity | How fast a risk moves from emergence to impact. How much warning you get. |

| `THE ONE THAT TRIPS PEOPLE UP` Inherent and residual are not "before and after we wrote the policy". They are "before and after the control demonstrably operates". A control you cannot evidence does not reduce residual risk, no matter how well designed it is. Section 06.4 covers this. |
| :---- |

`SECTION 03`

## **Where risk lives: the three lines of defence**

Almost every organisation of any size uses some version of a three-lines model. It answers one question: who is responsible for what?

| `LINE` | `WHO` | `WHAT THEY DO` |
| :---- | :---- | :---- |
| First line | The people who do the work — engineering, operations, sales, delivery. | Own the risk in what they do. Design, operate and evidence the controls. Make the day-to-day risk decisions. |
| Second line | Risk, compliance, security, privacy functions. | Set the framework, scales and appetite. Advise, challenge, and oversee. They do not own first-line risk. |
| Third line | Internal audit. | Provide independent assurance to the board that the first two lines are working. Independent means they do not build what they audit. |

The point is not the org chart. The point is that **the person who does the work owns the risk of the work**, and someone independent checks. Risk cannot be delegated to the risk team; if it is, nobody in the business is actually accountable and the register becomes a document rather than a decision-making tool.

| `WHAT THIS MEANS FOR YOU` On your project you are first line. You own the risks in what you build — the data you collect, the claims your output makes, the thing that breaks after you leave. Effective RM has second-line expertise on hand: an ISO 42001 Lead Auditor, deep third-party risk and cyber experience. Use it as challenge, not as approval. Bringing a risk to your check-in is the job working correctly, not a confession. |
| :---- |

**`PART Two`**

**The process**

How risk gets identified, measured, reduced and monitored — and specifically how you lower the likelihood of something happening and the damage it does when it happens anyway.

`04   The risk management process (ISO 31000)`

`05   Analysing risk: likelihood and consequence`

`06   Treating risk: reducing likelihood and consequence`

`07   Risk appetite and tolerance`

`08   Monitoring: KRIs and KCIs`

`SECTION 04`

## **The risk management process**

ISO 31000:2018 sets out a process that looks linear but is not. Three activities run continuously alongside the sequence.

| `RUNS THROUGHOUT, ALONGSIDE EVERY STEP` Communication and consultation   ·   Monitoring and review   ·   Recording and reporting |
| :---- |

| `STEP` | `THE QUESTION IT ANSWERS` |
| :---- | :---- |
| 1\. Scope, context and criteria | What are we assessing, for whom, against what objectives, and using which scales? |
| 2\. Risk identification | What could happen, why, and what would follow? |
| 3\. Risk analysis | How likely is it, and how bad would it be? |
| 4\. Risk evaluation | Is that acceptable against our criteria and appetite? Decide. |
| 5\. Risk treatment | What are we going to do about it, who owns it, and by when? |

### **4.1  Scope, context and criteria**

Establish what you are assessing (a process, a system, a vendor, an AI use case, a whole company), the objective at stake, and the scales you will use. **Internal context** covers strategy, people, systems, culture and appetite. **External context** covers regulators, customers, competitors, technology and geopolitics. **Criteria** are the likelihood and consequence scales, and what counts as material.

Skipping this step is the single most common cause of a useless risk assessment. Without agreed scope and agreed scales, two people rate the same risk differently and neither of them is wrong.

### **4.2  Risk identification**

No single method finds everything. Triangulate.

* **Top-down workshops** — executives and the board name the risks to strategy.

* **Bottom-up RCSA** — teams identify risks and controls in their own processes.

* **Process and critical-operations mapping** — walk the end-to-end flow including people, systems, data and third parties, and ask where it breaks.

* **Threat-led identification** — start from who would attack you and how. If you have done threat modelling, STRIDE, or attack trees, you have done risk identification under a different name.

* **Scenario analysis** — take a severe but plausible event and work through what it would do to you.

* **Horizon scanning** — what is emerging that is not yet on the register. This is the whole basis of Project 06\.

* **Incidents, near misses, audit findings and complaints** — evidence of what has already gone wrong, in your organisation or someone else’s.

### **4.3  Risk evaluation is a decision, not a measurement**

Analysis tells you how big the risk is. Evaluation decides what to do about that: accept it, treat it, escalate it, or go back and investigate further because your confidence is too low to decide. The comparison point is the organisation’s appetite (Section 07). Without a stated appetite, evaluation collapses into "that seems a bit concerning" and nothing changes.

`SECTION 05`

## **Analysing risk: likelihood and consequence**

### **5.1  Likelihood**

Likelihood is how probable the event is **over a stated period**. "Likely" means nothing on its own. Next twelve months is the common default; use whatever fits your decision, but say which.

| `RATING` | `DESCRIPTOR` | `GUIDE` |
| :---- | :---- | :---- |
| 5  Almost certain | Expected to occur, repeatedly or imminently | Greater than 85% in 12 months |
| 4  Likely | Expected to occur within the period | 50–85% |
| 3  Possible | Might occur within the period | 25–50% |
| 2  Unlikely | Could occur but is not expected | 5–25% |
| 1  Rare | Not expected within five years | Less than 5% |

The percentages are a calibration aid, not a claim to precision. Their job is to stop two people using "possible" to mean wildly different things.

### **5.2  Consequence**

Consequence is how bad it is if it happens — and it is never only financial. A usable scale has several dimensions.

| `RATING` | `FINANCIAL` | `CUSTOMER` | `REGULATORY` | `OPERATIONAL` |
| :---- | :---- | :---- | :---- | :---- |
| 5  Severe | Threatens viability | Mass detriment, systemic | Enforcement, licence at risk | Critical service down beyond tolerance |
| 4  Major | Material to the P\&L | Large group harmed | Notification plus investigation | Critical service materially degraded |
| 3  Moderate | Absorbable but noticed | Identifiable group affected | Reportable, remediation expected | Workarounds required |
| 2  Minor | Within budget variance | Isolated complaints | Internal breach, no report | Short, contained disruption |
| 1  Insignificant | Negligible | No customer impact | None | No noticeable effect |

| `THE RULE THAT GETS BROKEN MOST OFTEN` Rate against the highest dimension breached, not the average of the dimensions. An incident costing $8,000 that triggers a regulator notification is not a minor risk because the money is small. Averaging dimensions systematically understates regulatory, privacy and conduct exposure — which is exactly where the serious consequences live. |
| :---- |

### **5.3  The matrix, and what it is not**

Plotting likelihood against consequence gives the familiar five-by-five heat map. It is a communication and prioritisation device. It is not a calculation.

| `LIKELIHOOD ↓  /  CONSEQUENCE →` | `1 INSIG.` | `2 MINOR` | `3 MODERATE` | `4 MAJOR` | `5 SEVERE` |
| :---- | :---- | :---- | :---- | :---- | :---- |
| 5  Almost certain | Medium | Medium | High | Extreme | Extreme |
| 4  Likely | Low | Medium | High | High | Extreme |
| 3  Possible | Low | Medium | Medium | High | Extreme |
| 2  Unlikely | Low | Low | Medium | High | High |
| 1  Rare | Low | Low | Low | Medium | High |

**Health warnings.**

* The numbers are ordinal, not cardinal. A likelihood of 4 is not twice a likelihood of 2\. Do not multiply them and present the product as a score with meaning.

* Never average a red and a green into an amber. Aggregation by averaging is how serious exposures disappear from board reports.

* Watch for rating drift. If everything lands in the middle, either the scale is wrong or the culture is discouraging people from calling something red.

* The matrix summarises the analysis. It does not replace the reasoning, and the reasoning is what gets challenged.

### **5.4  Inherent, residual and target**

| `RATING` | `MEANS` | `USED FOR` |
| :---- | :---- | :---- |
| Inherent | The exposure before controls, or assuming they fail. | Understanding how much you depend on your controls. |
| Residual | The exposure after controls, as they actually operate today. | Deciding whether you can live with it. |
| Target | Where you intend to be, by a named date. | Defining the treatment plan and tracking it. |

The gap between **residual and target** is your treatment plan. The gap between **inherent and residual** is the value your controls are delivering — which is why you cannot claim a reduction for a control you cannot evidence.

### **5.5  Velocity and confidence**

**Velocity** is how fast a risk moves from emergence to impact. Two risks with the same rating are not equally urgent if one gives you eighteen months of warning and the other gives you none. Velocity is why the Emerging Risk Model (Project 06\) scores it explicitly alongside impact.

**Confidence** is how much you trust your own rating, and why. Say it out loud: "Moderate confidence — based on two incidents in the last year and no independent testing." Low confidence is itself a finding, and often the most important one in the assessment.

`SECTION 06  ·  THE WORKING CORE`

## **Treating risk: reducing likelihood and consequence**

This is the section to know by heart. Everything before it is preparation for the question a client actually asks: **what do we do about it?**

### **6.1  The four treatment options**

| `OPTION` | `WHAT IT MEANS` | `WORTH KNOWING` |
| :---- | :---- | :---- |
| Avoid | Do not do the activity, or stop doing it. | Legitimate and frequently forgotten. Deciding not to collect from a source whose terms prohibit it is risk avoidance, not failure. |
| Reduce | Apply controls to lower the likelihood, the consequence, or both. | The usual choice, and the subject of the rest of this section. |
| Transfer or share | Move some of the exposure — insurance, contract terms, outsourcing. | You can transfer financial consequence. You cannot transfer accountability. The regulator and the customer still come to you. |
| Accept | Consciously carry the risk. | A decision, made at the right level, documented, with a review date. "We did not get around to it" is not acceptance. |

### **6.2  The bowtie: two places to intervene**

Picture the risk as an event in the middle. Causes flow into it from the left. Consequences flow out of it to the right. That gives you two entirely different places to intervene.

| `LEFT OF THE EVENT` Preventive controls They stop the causes turning into the event. `Reduces LIKELIHOOD` | `THE` EVENT *detection sits here* | `RIGHT OF THE EVENT` Mitigating controls They limit the damage once it has happened. `Reduces CONSEQUENCE` |
| :---- | :---: | :---- |

Most teams over-invest on the left and under-invest on the right. Prevention eventually fails — that is what "eventually" means. The mature question is not only "how do we stop this?" but "when this happens, how bad is it, and how quickly do we find out?"

### **6.3  Worked example: unauthorised access to the production database**

The same risk, treated on both sides. Read the two columns and notice that they are doing genuinely different jobs.

| `REDUCE THE LIKELIHOOD` | `REDUCE THE CONSEQUENCE` |
| :---- | :---- |
| Multi-factor authentication on all privileged accounts | Encryption at rest and in transit — stolen data is unusable |
| Least privilege, with time-bound just-in-time access | Tokenisation or pseudonymisation of the most sensitive fields |
| No standing production access for developers | Data minimisation and retention limits — you cannot lose what you never kept |
| Patching and dependency scanning on a defined cadence | Logging, alerting and anomaly detection — shortens time to detect |
| Network segmentation between environments | A tested incident response plan with named roles and a rehearsed first hour |
| Secrets in a managed vault, never in code or env files | Immutable, tested backups with a measured restore time |
| Peer review on infrastructure and access changes | A pre-drafted breach notification process for the OAIC and affected customers |
| Targeted training on credential phishing | Cyber insurance for the financial consequence |

| `WHY THIS MATTERS` The left column changes the probability. The right column changes the size of the loss. Both are risk reduction and they are not interchangeable. A treatment plan with only one column is half a plan. Detection sits in the middle. Monitoring does not stop the event, but it cuts dwell time from months to hours — and dwell time is the single biggest driver of how expensive a breach becomes. That is why detective controls deserve as much attention as preventive ones. |
| :---- |

### **6.4  Types of control**

| `TYPE` | `PURPOSE` | `WHEN IT ACTS` | `EXAMPLE` |
| :---- | :---- | :---- | :---- |
| Directive | Sets the expected behaviour | Before | Policy, standard, training, code of conduct |
| Preventive | Stops the event occurring | Before | MFA, input validation, segregation of duties, approval gates |
| Detective | Finds it happening or having happened | During / after | Monitoring, alerting, reconciliation, log review, audit |
| Corrective | Restores the position afterwards | After | Backup and restore, failover, rollback, incident response |
| Compensating | Substitutes when the primary control is not feasible | Varies | Enhanced monitoring where a small team cannot segregate duties |

**Automated versus manual.** Automated controls are consistent but can fail silently — nobody notices the job stopped running. Manual controls are flexible but degrade with fatigue, turnover and workload. Prefer automated, and monitor it for silent failure.

### **6.5  Design effectiveness and operating effectiveness**

| `QUESTION` | `WHAT YOU ARE TESTING` |
| :---- | :---- |
| Design effectiveness | If this control operated exactly as intended, would it address the risk? |
| Operating effectiveness | Is it actually operating — consistently, over a period, with evidence? |

| `THE EVIDENCE TEST` If you cannot produce evidence, you do not have a control. You have an intention. Before you claim a control, answer three questions: what is the evidence, over what period, and who would produce it if someone asked tomorrow? |
| :---- |

### **6.6  Proportionality**

Controls cost money, time and friction. The test is whether the control costs less than the risk it removes, and whether it degrades the thing it is protecting. Adding a fourth approval step to a low-value process is not risk management; it is bureaucracy with a risk vocabulary.

Over-control is itself a risk. It slows delivery, and people route around it — which leaves you with the original exposure plus a shadow process nobody can see.

`SECTION 07`

## **Risk appetite and tolerance**

Appetite is what turns a risk assessment into a decision. Without it, every assessment ends in a shrug.

| `LEVEL` | `WHAT IT IS` | `SET BY` |
| :---- | :---- | :---- |
| Appetite | How much risk the organisation is willing to take in pursuit of its objectives. Qualitative and quantitative. | Board, with executive input |
| Tolerance | The operational threshold that translates appetite into something measurable and breachable. | Executive / risk function |
| Limit | The cascaded threshold applied to a specific team, process or system. | Business owner |

**Worked through one risk type:**

| Appetite | "We have a low appetite for risks that could result in the loss of client data." |
| :---- | :---- |
| Tolerance | "No more than one confirmed data-handling incident per year. Zero notifiable breaches." |
| Limit | "All privileged access reviewed within 30 days. No standing production access in any environment holding client data." |

Notice the progression: the appetite statement is a sentence you could read to a board; the limit is something an engineer can check on a Tuesday. If you cannot get from one to the other, the appetite statement is aspirational rather than operational — a common and expensive failure.

`SECTION 08`

## **Monitoring: KRIs and KCIs**

A risk assessment is a photograph. Indicators are the video.

| `INDICATOR` | `TELLS YOU` | `EXAMPLE` |
| :---- | :---- | :---- |
| KRI — key risk indicator | The risk itself is increasing or decreasing. | Median time to detect unauthorised access; number of critical vendors with no current attestation |
| KCI — key control indicator | A control is or is not working as intended. | Percentage of critical vulnerabilities open beyond SLA; percentage of privileged accounts without MFA |

**The most common failure is an operational metric wearing a risk badge.** "Number of tickets closed" is a performance measure. It tells you nothing about exposure. Ask what would have to change in the number before someone did something differently — if there is no answer, it is not an indicator.

A good indicator has four properties:

* It is tied to a **specific** risk or control, not a theme.

* It has a **threshold** anchored to appetite, not to whatever looked reasonable.

* Its **data source is verified** and available at the cadence you claim.

* Its **escalation path is rehearsed** — someone has agreed what happens when it breaches. Without that, it is a chart, not an indicator.

**`PART Three`**

**Standards and frameworks**

What each standard is for — so that when a client, a brief or a vendor trust page mentions one, you know which conversation you are in.

`09   The landscape`

`10   How to read a standard without reading all of it`

`SECTION 09`

## **The landscape**

You do not need to memorise these. You need to know what each one is **for**.

### **Risk and management systems**

| `STANDARD` | `STATUS` | `WHAT IT IS FOR` | `WHERE YOU MEET IT` |
| :---- | :---- | :---- | :---- |
| ISO 31000:2018 | Guidance | The generic risk management principles, framework and process. Our methodological spine. | Everything in Part Two |
| ISO/IEC 27001:2022 | Certifiable | A management system for information security, with the Annex A control set. | Vendor trust pages (Project 05); client compliance work |
| ISO/IEC 42001:2023 | Certifiable | A management system for AI across its lifecycle. | Projects 02 and 07; Wahid AI |
| ISO 22301 | Certifiable | Business continuity management and recovery objectives. | Resilience engagements |
| COSO ERM 2017 | Guidance | Enterprise risk management integrated with strategy and performance. | Board framing; financial services; audit |
| SOC 2 | Attestation | An independent report against the Trust Services Criteria that a provider gives its customers. | A signal to collect in Project 05 |

### **Cyber and AI frameworks**

| `FRAMEWORK` | `STATUS` | `WHAT IT IS FOR` | `WHERE YOU MEET IT` |
| :---- | :---- | :---- | :---- |
| NIST CSF 2.0 | Voluntary | Structuring and assessing cyber posture across Govern, Identify, Protect, Detect, Respond, Recover. | Common client language, especially US-influenced |
| NIST AI RMF 1.0 | Voluntary | Managing AI risk across Govern, Map, Measure, Manage — without certification overhead. | Project 07 |
| EU AI Act | Binding law | Risk-tiered obligations on AI providers and deployers touching the EU. | Project 07; clients with EU exposure |
| Australia’s AI guardrails and Guidance for AI Adoption | Voluntary | The national baseline for responsible AI practice. | Projects 02 and 07 |
| Singapore Model AI Governance Framework | Voluntary | A widely referenced implementation-oriented AI governance model. | Project 07 |

### **Australian regulation**

| `INSTRUMENT` | `STATUS` | `WHAT IT REQUIRES, IN ONE LINE` | `WHO IT BINDS` |
| :---- | :---- | :---- | :---- |
| APRA CPS 230 | Binding | Manage operational risk, identify critical operations and tolerances, and control service provider arrangements. | APRA-regulated entities |
| APRA CPS 234 | Binding | Maintain information security capability proportionate to the threat, test it, and notify APRA of incidents. | APRA-regulated entities |
| Privacy Act 1988 and the NDB scheme | Binding | Handle personal information under the Australian Privacy Principles and notify eligible data breaches. | Almost anyone handling Australian personal information |

### **Two observations worth carrying**

**The status column is the commercially important one.** Certifiable standards create audit demand. Binding law creates compliance demand. Voluntary frameworks create advisory demand. The three generate very different products.

**They overlap far more than they conflict.** Most of the apparent difference between these regimes is vocabulary, not substance — they largely want the same practices described in different words. That overlap is precisely the commercial opportunity behind Project 07, and the reason a single well-designed control set can satisfy several regimes at once.

`SECTION 10`

## **How to read a standard without reading all of it**

Standards are long and most of the length is scaffolding. A workable order:

| `READ THIS` | `BECAUSE` |
| :---- | :---- |
| Scope and terms | Tells you who it binds and what the words mean in this document specifically. |
| The core clauses or functions | The actual requirements. In ISO management-system standards these are clauses 4 to 10\. |
| The annex or control set | What you will actually be asked to implement and evidence. |
| The version and date | Non-negotiable for anything you cite. A control mapped to a superseded version is worse than no mapping. |

| `SOURCING` Ask for the official standards. Do not work from unofficial copies found online — they are frequently out of date, and citing a superseded clause in client-facing work is the kind of error that ends a commercial relationship. |
| :---- |

**`PART Four`**

**Risk in practice**

Three real-shaped client situations worked end to end, and the specific risks sitting inside each of the seven intern projects.

`11   Three client scenarios`

`12   The risks in your project`

`SECTION 11  ·  SCENARIO ONE`

## **The payroll provider**

**`THIRD-PARTY  ·  PRIVACY  ·  RESILIENCE`**

**The situation.** A mid-size healthcare client outsources payroll to a specialist provider. The provider is a small firm with no SOC 2 report and no ISO 27001 certification. It holds employee bank details and tax file numbers for 2,400 staff, and runs in a single cloud region. The contract has no audit rights, no breach notification clause, and a twelve-month automatic renewal that falls due in six weeks.

**The objective at risk.** Paying 2,400 people accurately and on time, and protecting their personal information.

| `THE RISK STATEMENT` Because the payroll provider has no independently assured security controls and no contractual obligation to notify us of a breach, a compromise of the provider may expose employee tax file numbers and bank details, resulting in a notifiable data breach, remediation cost, industrial relations damage, and inability to run at least one payroll cycle. |
| :---- |

**The analysis.** Likelihood: Possible. Consequence: Major, driven by the regulatory and operational dimensions rather than the financial one. Velocity: high — you learn about this when it has already happened. Confidence: moderate, and explicitly limited by the absence of any independent assurance over the provider.

### **The treatment, split both ways**

| `REDUCE THE LIKELIHOOD` | `REDUCE THE CONSEQUENCE` |
| :---- | :---- |
| Due diligence before the renewal date, not after | Contractual notification within 24 hours of a suspected incident |
| Require evidence of MFA, encryption and access review | Data minimisation — does the provider need tax file numbers in that form at all? |
| Add a security schedule to the contract with a right to audit or an annual attestation | A documented manual payroll fallback, tested once a year |
| Assess the provider’s own critical suppliers — your fourth parties | Pre-agreed exit and data-return terms so you can leave quickly |
|  | An identity-protection arrangement ready for affected staff |

**Transfer** covers part of the financial consequence through insurance — not the operational disruption and not the reputational damage. **Accept** applies to what remains: a small provider will always carry some irreducible likelihood of compromise, and that residual should be accepted explicitly, at executive level, with a twelve-month review, rather than left unstated.

| `WHAT THIS TEACHES` Third-party risk is contract design, plus proportionate monitoring, plus an exit you have actually tested. The reason vendor questionnaires are slow, self-reported and stale is precisely the problem Project 05 attacks — which is why a defensible public-data scoring method is commercially valuable, and why the methodology matters more than the code. |
| :---- |

`SECTION 11  ·  SCENARIO TWO`

## **The customer service AI assistant**

**`AI GOVERNANCE  ·  CONDUCT  ·  REGULATORY`**

**The situation.** An insurance client has deployed a large language model assistant in its customer portal to answer policy coverage questions. It is grounded on the product disclosure statements. There is no human review of responses, no logging of what it said to whom, and no evaluation set. It has been live for six weeks.

**The objective at risk.** Giving customers accurate coverage information, and meeting conduct obligations.

| `THE RISK STATEMENT` Because the assistant generates coverage answers without human review, output logging or monitoring, it may state coverage that a policy does not provide, resulting in customers making financial decisions on incorrect information, a remediation obligation, conduct-regulator exposure, and reputational damage. |
| :---- |

**The analysis.** Likelihood: Likely — six weeks live with no monitoring means there is no evidence it has not happened, and generative systems are non-deterministic by construction. Consequence: Major. **Confidence in the rating: low**, because there is no monitoring data at all. That low confidence is itself the most important finding here, and it should be written into the assessment rather than smoothed over.

### **The treatment, split both ways**

| `REDUCE THE LIKELIHOOD` | `REDUCE THE CONSEQUENCE` |
| :---- | :---- |
| Constrain scope to a defined set of question types, with explicit refusal behaviour outside it | A clear in-product statement of what the assistant is, and one-click handoff to a human |
| Retrieval restricted to current, version-controlled product disclosure statements | Log every prompt and response so a wrong answer can be found, traced and remediated |
| Pre-deployment evaluation against a test set of real coverage questions with known answers | Weekly sampling and review of responses by someone who knows the products |
| Change control whenever the model, prompt or retrieval corpus changes | A customer remediation process designed before it is needed, not during |
| Human review for high-consequence question types | A kill switch with a named owner who is authorised to use it without a committee |

**The standards lens.** ISO/IEC 42001 for the management system around the AI. NIST AI RMF Measure and Manage for the evaluation and monitoring. Australia’s AI guardrails for human oversight, transparency and contestability. Note that all three want broadly the same things in different words.

| `WHAT THIS TEACHES` With generative AI, most of the useful controls sit on the consequence side, because you cannot make the system deterministic. Logging, evaluation, human handoff, scope constraints and reversibility are the risk controls. An organisation that says "we tested the prompts" has done work on the left of the bowtie and nothing on the right. This is the problem space behind Project 07\. |
| :---- |

`SECTION 11  ·  SCENARIO THREE`

## **The untested recovery plan**

**`OPERATIONAL RESILIENCE  ·  CONTROL EFFECTIVENESS`**

**The situation.** A logistics client runs its warehouse management system in a single cloud region. A disaster recovery plan exists, is well written, and has never been executed. The documented recovery time objective is four hours. Nobody has ever measured an actual recovery.

| `THE RISK STATEMENT` Because the recovery plan for the warehouse management system has never been executed or measured, a regional outage may extend well beyond the four-hour recovery objective, resulting in halted dispatch across three distribution centres, contractual service credits, and the loss of a major customer at renewal. |
| :---- |

**The interesting part is the rating, not the risk.** The team rated inherent risk as Major and Possible, then rated residual as Moderate and Unlikely, citing the existence of the recovery plan. That is wrong. The plan has demonstrated **design** effectiveness — read it, and it would plausibly work. It has **no evidence of operating effectiveness** whatsoever.

Until the failover is executed and the actual recovery time is measured, residual risk should sit at or very near inherent, with the assumption stated. Rating residual down because a document exists is one of the most common and most consequential errors in practice, and it is exactly what an auditor or a regulator will find.

### **The treatment**

Primarily consequence reduction: execute the failover, measure the real recovery time, close the gap between measured and required, then re-rate on evidence. Secondarily likelihood reduction: multi-region deployment, or at minimum multi-availability-zone. Note the order — testing what you already have is cheaper and more informative than building something new on top of it.

| `WHAT THIS TEACHES` "We have a plan" is not a control. Evidence that the plan works is a control. Whenever you see a risk register where residual is comfortably below inherent, the first question is always the same: what is the evidence for the difference? |
| :---- |

`SECTION 12`

## **The risks in your project**

Every project on the catalogue carries risk. Identify yours in week one and bring it to your first check-in — written in the cause / event / consequence structure, with a proposed treatment split across likelihood and consequence. This is where to start looking.

**`PROJECT 01`   Knowledge for Good**

**Delivery and duty-of-care risk.**

You are working with real students in another country. Over-promising outcomes, mishandling participant data, or cultural missteps carry consequences that land on people with no power in the arrangement. Budget discipline matters too — every commitment made during the internship implies a cost someone carries afterwards.

**`PROJECT 02`   Humane**

**Partner, IP and continuity risk.**

The asset belongs to someone else. Confirm branding, content ownership and approval rights before you build, not after. A site that must outlive you needs a named maintainer; if there is not one, you have created a risk rather than delivered a platform.

**`PROJECT 03`   Deciding in the Dark**

**IP, brand and consumer risk.**

The author’s voice and intellectual property must be represented faithfully. Taking payment introduces privacy obligations over buyer data and consumer-law obligations around refunds and claims. Decide the brand home early — it changes checkout, invoicing and who is liable.

**`PROJECT 04`   Kanban Board**

**Data persistence and lock-in risk.**

The distinguishing feature is a history that must survive years. Ask what happens if the hosting provider disappears, the free tier ends, or nobody logs in for six months. Your persistence choice is a risk decision, not a technical preference — document it, including how the data gets out again.

**`PROJECT 05`   OSINT for TPRM**

**Legal, ethical and defensibility risk.**

Publicly visible is not the same as lawfully collectable. Terms of service, the law on automated collection, and how you store what you gather all matter, and the position must be documented per source. Beyond legality: a wrong score published about a real company is a commercial and defamation exposure. Every score must trace to a source and a rationale.

**`PROJECT 06`   Emerging Risk Model**

**Credibility risk.**

An output that looks board-ready but is not defensible is worse than no output, because someone will act on it. Be explicit about method and limits — this is curated, not predictive. Overstating what the model knows is the risk that kills the product.

**`PROJECT 07`   AI Governance Convergence**

**Accuracy and currency risk.**

Regulatory content goes stale monthly. A control set mapped to a superseded version of a regime is actively harmful to the user who relies on it. Cite sources with versions and dates, design the mapping to be updatable, surface the age of each record to the user, and frame everything as practitioner guidance rather than legal advice.

| `ACROSS EVERY PROJECT` Three risks apply to all of you. Handle carefully anything you are given access to. Represent your confidence honestly, especially when it is low. And do not create a dependency the organisation cannot maintain once you have gone — an elegant system nobody else can run is a liability wearing the costume of a deliverable. |
| :---- |

**`PART Five`**

**Practice**

Six exercises with worked answers, the habits that separate risk work from paperwork, and a glossary.

`13   Exercises`

`14   Ten habits`

`15   Glossary`

`16   Where to go next`

`SECTION 13`

## **Exercises**

Attempt each one before reading the answer. Bring anything you disagreed with to your check-in — the disagreements are usually more useful than the agreements.

**`EXERCISE 01`   Rewrite the risk statement**

A risk register entry reads, in full: **"Risk: AWS."** Rewrite it properly for the Kanban board project (Project 04\) using the cause / event / consequence structure.

| `WORKED ANSWER` A workable answer. "Because the monthly delivery history is stored in a single hosted database with no export and no backup, loss of the account or withdrawal of the provider’s free tier may render the archive unrecoverable, resulting in permanent loss of the organisation’s record of what it delivered — the one feature the board exists to provide." What changed. The rewrite names an objective, a cause you can attack, an event, and a consequence expressed in terms someone would actually care about. "AWS" told you nothing and pointed at no treatment. The rewrite points at several: exports, backups, a second copy, a documented restore. |
| :---- |

**`EXERCISE 02`   Split the controls**

A developer accidentally commits an API key to a public repository. List the controls that reduce the **likelihood**, and separately the controls that reduce the **consequence**.

| `WORKED ANSWER` Likelihood. Pre-commit secret scanning; secrets held in a managed vault rather than in files; .gitignore and templated environment files; code review; developer training; private-by-default repositories. Consequence. Secret scanning on the remote with immediate alerting, which shortens exposure from weeks to minutes; short-lived, automatically rotated credentials; least-privilege scoping so a leaked key can do very little; a rehearsed revocation runbook; monitoring for anomalous use of the key. The point. The first column is what you usually hear proposed. The second column is what determines whether this incident is an embarrassment or a breach. |
| :---- |

**`EXERCISE 03`   Challenge the rating**

A team rates a risk inherent Major / Possible, and residual Moderate / Unlikely. The only control cited is a disaster recovery plan that has never been tested. What is wrong, and what should the register say?

| `WORKED ANSWER` What is wrong. The residual rating credits a control with no evidence of operating effectiveness. Design effectiveness has been demonstrated; operating effectiveness has not been tested at all. What it should say. Residual at or near inherent, with the assumption stated explicitly. Target of Moderate / Unlikely, dated, with the treatment recorded as "execute and measure a failover test by \[date\], then re-rate on the measured result". That distinction — between a rating based on evidence and a rating based on hope — is the difference between a risk register and a wish list. |
| :---- |

**`EXERCISE 04`   Choose a treatment**

On Project 05, a valuable breach-data source has terms of service that prohibit automated collection. You could technically collect from it without being detected. What is the correct treatment, and why?

| `WORKED ANSWER` Avoid. Not reduce. Why. No control on the likelihood side makes an unlawful collection lawful. "We will not get caught" is not a control — it is an assumption about someone else’s detection capability, which is the weakest possible basis for a decision, and it fails the moment the source improves its monitoring. The correct treatment. Rule the source out. Document the position for that source in the methodology. Note the licensed or paid alternative in the roadmap. Find a lawful proxy signal. Record the decision so the next person does not relitigate it. The commercial reason. On this project the methodology is the deliverable, and a methodology with an unlawful source inside it cannot be sold, cited or defended. The technical feasibility of the collection is irrelevant to whether it belongs in the product. |
| :---- |

**`EXERCISE 05`   Write an indicator**

On Project 07, one of the central risks is that the regime mapping goes stale. Propose a KRI.

| `WORKED ANSWER` Weak. "Number of regimes covered." That is an activity metric. It goes up when you do work and never warns you about anything. Better. "Age in days of the oldest regime record in the crosswalk, against a threshold of 90 days." It is leading, tied to the specific risk of staleness, thresholded, and has an obvious escalation. Better still. Surface it to the user, not only internally — a coverage note stating when each regime was last verified. That converts an internal control into a transparency feature, which is both more honest and more commercially credible than a mapping that silently ages. |
| :---- |

**`EXERCISE 06`   Rate the consequence**

An incident costs $8,000 to remediate, affects 40 customers, and requires notification to the OAIC. The team rates the consequence as Minor because the financial figure is small. Are they right?

| `WORKED ANSWER` No. Rate against the highest dimension breached, not the average across dimensions. Why. On a standard consequence scale, a regulatory notification sits at Moderate or Major regardless of the dollar figure, because the exposure is not the remediation cost. It is regulatory attention, the possibility of enforcement, the cost of the notification process itself, and the loss of customer trust. The wider lesson. Averaging dimensions is one of the most common errors in practice, and it fails in a specific and predictable direction: it systematically understates regulatory, privacy and conduct risk — which is precisely where the severe consequences live. |
| :---- |

`SECTION 14`

## **Ten habits**

The difference between risk work that changes decisions and risk work that fills a folder.

| `01` | Start with the objective. No objective, no risk. |
| :---- | :---- |
| **`02`** | Write the cause, the event and the consequence separately. If you cannot, you do not yet understand the risk. |
| **`03`** | Rate against a stated scale and a stated time horizon, or do not rate at all. |
| **`04`** | Never claim a control you cannot evidence. |
| **`05`** | Ask what reduces the likelihood, and then ask separately what reduces the consequence. |
| **`06`** | Assume prevention will eventually fail, and design for that day. |
| **`07`** | Say your confidence out loud, particularly when it is low. |
| **`08`** | Treat acceptance as a decision — made by someone with the authority, on a date, with a review. |
| **`09`** | Apply proportionality. A control that costs more than the risk is a new risk. |
| **`10`** | Write it down. If it is not recorded it did not happen — for auditors, for regulators, and for whoever picks up your work after you leave. |

`SECTION 15`

## **Glossary**

| `TERM` | `DEFINITION` |
| :---- | :---- |
| Assurance | Independent confirmation that controls are designed and operating as claimed. |
| Compensating control | A substitute control used where the preferred control is not feasible. |
| Consequence | The outcome of an event, assessed across financial, customer, regulatory, operational and reputational dimensions. |
| Control | Anything that modifies risk: a process, a system setting, a contract clause, a review. |
| Control owner | The named person accountable for a control operating as designed. |
| Corrective control | Acts after the event to restore the position — backups, failover, incident response. |
| Design effectiveness | Whether a control would address the risk if it operated as intended. |
| Detective control | Identifies that an event is occurring or has occurred — monitoring, alerting, reconciliation. |
| Directive control | Sets expected behaviour — policy, standard, training. |
| Emerging risk | A risk whose nature, likelihood or impact is not yet well understood, typically over a longer horizon. |
| Inherent risk | Exposure before controls, or assuming controls fail. |
| Issue | A risk that has materialised. Managed through incident or issue management, not the risk register. |
| KCI | Key control indicator — evidence that a control is or is not working. |
| KRI | Key risk indicator — evidence that a risk is increasing or decreasing. |
| Likelihood | The probability of an event over a stated time period. |
| Materiality | The threshold above which something matters enough to report or act on. |
| Near miss | An event that almost occurred, or occurred without consequence. Valuable and usually uncollected. |
| Operating effectiveness | Whether a control is actually operating, consistently, with evidence, over a period. |
| Preventive control | Acts before the event to stop it occurring. |
| RCSA | Risk and control self-assessment — a structured bottom-up identification and rating exercise run by the first line. |
| Residual risk | Exposure after controls, as they actually operate today. |
| Risk | The effect of uncertainty on objectives (ISO 31000). |
| Risk appetite | How much risk an organisation is willing to take in pursuit of its objectives. |
| Risk criteria | The scales and thresholds used to evaluate significance. |
| Risk owner | The named individual accountable for a risk and its treatment. |
| Risk register | The record of identified risks, their ratings, controls, owners and treatments. |
| Risk taxonomy | The agreed classification of risk types used across an organisation. |
| Target risk | The rating an organisation intends to reach, by a stated date. |
| Third party | Any external organisation delivering a service or holding data on your behalf. A fourth party is their supplier. |
| Threat | A source of potential harm. |
| Three lines of defence | The model separating risk ownership (first), oversight and challenge (second), and independent assurance (third). |
| Tolerance | The operational threshold that translates appetite into a measurable, breachable limit. |
| Treatment | The chosen response to a risk: avoid, reduce, transfer or accept. |
| Velocity | The speed at which a risk moves from emergence to impact. |
| Vulnerability | A weakness that a threat could exploit. |

`SECTION 16`

## **Where to go next**

In roughly this order. Ask for official copies of the standards rather than sourcing them online.

### **Read first**

* **ISO 31000:2018** — short, readable, and the direct source for Part Two of this guide.

* **Effective RM Knowledge Hub** — the Emerging Risk Identification and Escalation Guide, and the wider article set.

* **Deciding in the Dark** — the 100 practitioner questions at effectiverm.com/knowledge/100-questions. These are the questions real risk leaders are actually asking, tagged by domain, effort and payback. Read the ones in your project’s domain.

### **Read when your project needs it**

* **ISO/IEC 27001:2022**, particularly Annex A — Projects 05 and any security-facing work.

* **ISO/IEC 42001:2023** and the **NIST AI RMF** — Projects 02 and 07\.

* **NIST CSF 2.0** — the six functions are a good structural model even outside cyber.

* **APRA CPS 230 and CPS 234** — if your work touches an APRA-regulated client.

* **OAIC guidance on the Notifiable Data Breaches scheme** — if you handle Australian personal information in any form.

| `ONE LAST THING` The best risk professionals are not the ones with the most frameworks. They are the ones who ask a clear question, listen to the answer, and are honest about what they do not know. You already have the technical half of that. This guide is the other half. |
| :---- |

