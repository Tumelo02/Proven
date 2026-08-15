# Proven: Q&A Prep (Assume a Hostile Panel)

Nine teams, one winner. Assume every judge is actively trying to find the crack in this idea. Don't memorize these word for word, know the *reasoning* well enough to answer a question that isn't on this list. Two teammates take questions live; both of you should be able to answer everything below, not just your own "half."

---

## ⭐ Read these five first

If time runs short before the panel, these are the ones most likely to actually come up, and the ones that do the most damage if you fumble them.

1. **Is this surveillance of entrepreneurs?** The single most reputationally dangerous question in the room.
2. **Is this a credit score or not?** Get this fuzzy and you contradict your own "no automatic approval" positioning.
3. **What stops an entrepreneur from gaming their own numbers?** A real, honest vulnerability in the current model, don't dodge it.
4. **Why can't a funder just use Excel, or build this internally?** The "why do you even need to exist" test.
5. **What if Absa passes?** Your GTM leans on one first partner, know the fallback cold.

---

## ⭐ The one you must nail: is this surveillance of entrepreneurs?

**Q: You're building a system that watches funded entrepreneurs' every move and flags them to a funder. Isn't that just surveillance dressed up as support?**

The alternative to this isn't "no oversight," it's the oversight that already happens today, invisibly. A funder already decides whether to keep supporting a business, right now, based on a milestone report, a gut feel, or nothing at all, and the entrepreneur rarely sees why they were flagged or passed over. That's the real surveillance: silent, unaccountable, and one-directional.

Proven makes that visibility mutual. The entrepreneur sees the same Health Score the funder sees, the same explanation for it, and the same recommendation. A weak score routes to guidance first, not a funding cut. The entrepreneur owns the upside too: the same track record that could flag a problem is the one that builds their credit-readiness evidence. This isn't a surveillance tool, it's the first time the entrepreneur gets to see the same scoreboard as the funder.

**Follow-up you should expect: "What if someone disagrees with their score?"**
The score informs a conversation, it doesn't replace one, and it never triggers an automatic funding decision. A Watch or At Risk score routes to a guidance card the entrepreneur can act on, and funders are explicitly told the score is evidence to support a human decision, not a verdict.

---

## ⭐ Is this a credit score? Where's the line?

**Q: You keep saying "not automatic approval," so what exactly is Proven scoring, and what is it not?**

Be precise here, this is easy to blur under pressure. The Business Health Score (0 to 100, weighted: sales trend 35%, spending control 25%, reporting consistency 20%, customer growth 20%) is an *operational* signal, it tells you how the business is doing right now. It is not a credit score and Proven does not run credit checks, pull bureau data, or issue a lending decision.

Credit readiness is a separate, longer-horizon layer built from the same evidence over time (Building Track Record → Developing → Strong Evidence → Credit-Ready Candidate). It answers "has this business built a documented case," not "should you lend to them." Every screen that shows it carries the same line: evidence to support, not replace, a formal credit assessment. Keeping that boundary explicit is deliberate: the moment Proven starts making credit decisions, it takes on National Credit Act obligations and bureau-grade compliance the team isn't built for yet, and doesn't need to be, to prove the model.

---

## Innovation and creativity

**Q: Grant and portfolio monitoring dashboards already exist. What's actually new here?**
Most monitoring tools stop at reporting, they tell an administrator what happened. Proven closes the loop: Track, Detect, Guide, Prove. A business that's struggling doesn't just get flagged in someone's spreadsheet, it gets a guidance card explaining what changed and what to do next. A business that performs well builds portable evidence it can use with the *next* funder, not just the current one. Most tools help one side of the relationship. Proven is built around the relationship itself.

**Q: Isn't this just alternative credit scoring with extra steps?**
No, and that distinction is the point (see the credit-score question above). Alternative credit scoring tries to build a lending decision from thin data. Proven doesn't try to replace underwriting, it gives both sides a shared, explainable record of performance that a formal credit process can draw on later.

---

## Relevance of the problem

**Q: How do you actually know funding underperformance is about lack of visibility, and not fraud, mismanagement, or bad market conditions?**
Be honest, don't overclaim. This doesn't claim to fix every cause of business failure. Load shedding, market conditions and outright fraud are real, and Proven doesn't solve them. What it solves is the specific, addressable slice: giving both the entrepreneur and the funder visibility early enough to intervene on the problems that *are* recoverable, instead of finding out at the next milestone that it's already too late. That's a partial solution to a multi-causal problem, and a partial solution that catches even some of a high SME failure rate is still meaningful impact.

**Q: Isn't this one team's read of the problem? Isn't that a thin basis for a whole pitch?**
It's corroborated independently: South Africa's documented SME failure rate, the fact that funders themselves structure support as milestone-gated (which only makes sense if checkpoints matter), and the wider enterprise-development ecosystem that already spends on exactly this kind of monitoring. The lived observation pointed us at the problem; the data backs it up independently.

---

## Technical feasibility and prototype

**Q: Your prototype runs on sample data. What happens the moment you try to connect a real funder's portfolio?**
Be direct rather than dodge it: real deployment needs a data-sharing and consent agreement with each funder and business, likely POPIA-compliant data handling, and possibly direct integrations with accounting or banking data down the line. That's real, non-trivial work, which is exactly why the Ask is a pilot partnership, not a claim that this is production-ready today. What *is* proven is the scoring and guidance engine itself, it's rules-based and doesn't care where the numbers come from, so connecting real data sources is an integration problem, not a redesign of the logic.

**Q: Why rules-based scoring instead of real machine learning? Doesn't that make it less impressive?**
Deliberate choice, not a limitation. This score has to be explainable to the entrepreneur, defensible to the funder, and eventually to auditors. A black-box ML score that flags someone as high-risk with no explanation is a liability in this context, not a feature. It's also honest: there's no real historical outcome dataset yet to train a model on without overfitting. Transparent and rules-based now, with a validated ML layer added later once real outcomes exist, is the responsible sequencing.

**Q: What stops an entrepreneur from gaming their own numbers?**
This is the honest gap in the current model, don't pretend otherwise. Business vitals (money in, money out, customers) are currently self-reported by the entrepreneur every month. Reporting consistency is itself 20% of the score, so a missed or suspiciously smooth report already counts against it, but a determined entrepreneur could inflate numbers today. The roadmap answer is direct integrations with accounting platforms or bank feeds to verify self-reported figures over time, that's explicitly part of what a pilot would validate and fund. Today, the mitigation is that the evidence trail is longitudinal, one good month doesn't move the credit-readiness band, a consistent pattern over many months does, which raises the cost of sustained gaming considerably.

---

## Business viability

**Q: Why would a funder pay for this instead of just tracking it in Excel or a shared spreadsheet?**
Excel can hold numbers, it can't generate a live Health Score, explain *why* a business dipped, generate a guidance card the entrepreneur actually sees, or build a credit-readiness record that follows the business across funders. Someone still has to build and maintain all of that logic by hand, for every business, every month. Proven is the tool that does that automatically and shows the same evidence to both sides, that's not a spreadsheet feature, it's the product.

**Q: Why can't the bank or funder just build this internally?**
They could, and some eventually might, but that's true of almost any SaaS tool a bank uses. Building it internally means owning the scoring logic, the guidance content, the entrepreneur-facing product, and the maintenance, for a tool that isn't their core business. Proven's edge is that this *is* our core focus: a team that's already built the two-sided loop, already thinking about entrepreneur adoption and funder trust at the same time. The realistic path for most funders is a pilot with a focused vendor before a multi-year internal build, that's the opening we're asking for.

**Q: Your go-to-market leans on Absa. What if they pass?**
Real concentration risk worth acknowledging directly rather than waving away. Absa's entrepreneurship and enterprise-development initiatives are the fastest first conversation because of timing and this hackathon, not the only viable buyer. NYDA, SEDFA, other banks' own enterprise-development programmes, incubators and accelerators all have the identical blind spot: they fund SMEs and then lose visibility until the next milestone. If Absa passes, the same pitch goes to the next funder with the same pain point.

**Q: What's the actual price someone would pay for this?**
Don't invent a number that isn't backed by a real conversation, say so directly: pricing hasn't been validated with a real buyer yet, and that's explicitly part of what the pilot is for. The model is a SaaS subscription or institutional licence priced at the portfolio level, not per loan. Frame the value instead of a fake number: the cost of one funded business failing silently is likely higher than a year of a monitoring subscription, and that's the comparison a funder actually cares about.

---

## Presentation quality and team capability

**Q: Why should we trust a student team over actual fintech professionals to build something a bank would use?**
Reframe rather than deflect: this is explicitly a pilot-stage prototype asking for partnership and mentorship *because* the team knows it needs that expertise, the ask isn't "give us production access," it's "let us prove the mechanism with your guidance." The team's edge isn't fintech infrastructure experience, it's proximity to the actual problem, lived context most teams building bank software don't have.

**Q: If a judge asks something none of you know the answer to, what do you do?**
Say so plainly and reason through it live rather than bluffing: "That's a fair question, we haven't fully solved that yet, here's how we'd think about it." Judges notice bluffing far more than they penalise an honest "we don't know yet, here's our reasoning."

---

## Equity and access

**Q: Not every funded entrepreneur has reliable data access or digital comfort. Doesn't self-reporting exclude the people who need this most?**
Fair challenge, worth conceding the limit honestly. The reporting form is deliberately kept to a handful of simple monthly numbers, not full accounting software, to keep the barrier low. But it still assumes some connectivity and comfort with a screen, and that's a real access gap for the least digitally included businesses. The mitigation is that a missed or inconsistent report is itself a scored signal rather than a silent data blackout, so the system doesn't quietly exclude someone, it flags the gap. Closing that gap further, through a mentor-assisted or offline reporting path, is a fair addition to the roadmap.

---

## If you get a question you genuinely can't answer

Don't invent a confident-sounding number or claim. Say what you know, say what you don't, and say how you'd find out. A team that says "we haven't validated that yet, here's how we'd approach it" reads as more credible than a team that guesses and gets caught.
