"""Seed assessments with questions for all modules.

Creates one published assessment per module, with questions derived from each
module's lessons. Each question has 4 options (1 correct, 3 distractors) for
single-choice questions.

Usage:
    cd backend && python -m scripts.seed_assessments

Requires DATABASE_URL in .env.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Assessment,
    AssessmentOption,
    AssessmentQuestion,
    AssessmentQuestionType,
    Course,
    Lesson,
    Module,
)
from app.db.session import AsyncSessionLocal


# ── Question bank per domain ─────────────────────────────────────────────────

DOMAIN_QUESTIONS: dict[str, list[dict]] = {
    "risk-management": [
        {
            "prompt": "What is the primary purpose of a risk register?",
            "options": [
                ("To satisfy audit requirements", False),
                ("To track and manage risks that could affect organisational objectives", True),
                ("To document all possible negative outcomes", False),
                ("To assign blame when things go wrong", False),
            ],
        },
        {
            "prompt": "Which of the following is the most important quality of a risk statement?",
            "options": [
                ("It uses professional risk terminology", False),
                ("It is specific enough for a decision-maker to act on", True),
                ("It includes a likelihood and impact rating", False),
                ("It references the relevant ISO standard", False),
            ],
        },
        {
            "prompt": "Why is 'team ownership' of a risk generally ineffective?",
            "options": [
                ("Teams lack the technical skills to manage risks", False),
                ("Distributed ownership means no single person is accountable", True),
                ("Teams are too busy to update the risk register", False),
                ("Risk management is only for senior leadership", False),
            ],
        },
        {
            "prompt": "What should happen when a risk owner leaves the organisation?",
            "options": [
                ("The risk should be removed from the register", False),
                ("The risk should be reassigned before the owner departs", True),
                ("The risk should be escalated to the board", False),
                ("Nothing — the risk will be picked up at the next review", False),
            ],
        },
        {
            "prompt": "What is the correct order of risk escalation?",
            "options": [
                ("Board → Manager → Owner", False),
                ("Owner → Manager → Board", True),
                ("Manager → Owner → Board", False),
                ("Any person can escalate to any level", False),
            ],
        },
        {
            "prompt": "How often should individual risk owners update their entries?",
            "options": [
                ("Annually, during the full register review", False),
                ("Monthly, as part of regular operations", True),
                ("Only when the risk rating changes", False),
                ("Only when requested by the risk committee", False),
            ],
        },
        {
            "prompt": "What is the 'one-sentence risk test'?",
            "options": [
                ("Every risk must be expressible in exactly one sentence", False),
                ("A board member should understand the required action from the statement alone", True),
                ("Risk statements should not exceed 25 words", False),
                ("Each risk should be summarised in a single slide", False),
            ],
        },
        {
            "prompt": "Which of the following is NOT a valid reason to escalate a risk?",
            "options": [
                ("The risk has materialised", False),
                ("The owner needs approval for a mitigation expenditure", False),
                ("The risk rating has decreased", True),
                ("The mitigation is not working as expected", False),
            ],
        },
        {
            "prompt": "What makes a risk register entry a 'list' rather than a 'register'?",
            "options": [
                ("It has fewer than 10 entries", False),
                ("It lacks a clear next action and deadline for each entry", True),
                ("It is stored in a spreadsheet rather than a database", False),
                ("It has not been reviewed in the current quarter", False),
            ],
        },
        {
            "prompt": "When reporting risk to the board, what is most important?",
            "options": [
                ("Presenting the complete risk register with all ratings", False),
                ("Highlighting changes and decisions needed, not just status", True),
                ("Using a standardised colour-coded heatmap", False),
                ("Including detailed mitigation plans for every risk", False),
            ],
        },
    ],
    "cyber-security": [
        {
            "prompt": "What is the first step in responding to a cyber security incident?",
            "options": [
                ("Notify all customers immediately", False),
                ("Contain the incident to prevent further damage", True),
                ("Contact law enforcement", False),
                ("Delete all affected systems", False),
            ],
        },
        {
            "prompt": "Which principle states that users should only have access to what they need?",
            "options": [
                ("Defence in depth", False),
                ("Least privilege", True),
                ("Separation of duties", False),
                ("Zero trust", False),
            ],
        },
        {
            "prompt": "What is the primary risk of shadow IT?",
            "options": [
                ("It increases software licensing costs", False),
                ("It bypasses security controls and creates unmanaged data flows", True),
                ("It reduces IT department headcount", False),
                ("It slows down employee productivity", False),
            ],
        },
        {
            "prompt": "What does MFA protect against that a password alone does not?",
            "options": [
                ("Phishing emails", False),
                ("Credential theft and password reuse attacks", True),
                ("Malware infections", False),
                ("Physical theft of devices", False),
            ],
        },
        {
            "prompt": "What is the most effective way to reduce phishing risk?",
            "options": [
                ("Blocking all external emails", False),
                ("Regular awareness training combined with simulated phishing tests", True),
                ("Requiring VPN for all email access", False),
                ("Encrypting all email communications", False),
            ],
        },
        {
            "prompt": "What is a key difference between a vulnerability and a threat?",
            "options": [
                ("They are the same thing", False),
                ("A vulnerability is a weakness; a threat is something that exploits it", True),
                ("A threat is always external; a vulnerability is always internal", False),
                ("Vulnerabilities are always software-related; threats are always human", False),
            ],
        },
        {
            "prompt": "Why is regular patch management critical?",
            "options": [
                ("It improves system performance", False),
                ("It closes known vulnerabilities before they can be exploited", True),
                ("It satisfies vendor licensing requirements", False),
                ("It reduces the need for antivirus software", False),
            ],
        },
        {
            "prompt": "What is the purpose of a security incident response plan?",
            "options": [
                ("To prevent all security incidents from occurring", False),
                ("To provide a structured approach for detecting, containing, and recovering from incidents", True),
                ("To assign blame after an incident occurs", False),
                ("To satisfy insurance policy requirements", False),
            ],
        },
        {
            "prompt": "Which data classification level requires the most stringent controls?",
            "options": [
                ("Public", False),
                ("Internal", False),
                ("Confidential", True),
                ("Published", False),
            ],
        },
        {
            "prompt": "What is the primary benefit of network segmentation?",
            "options": [
                ("It simplifies network management", False),
                ("It limits the blast radius of a security breach", True),
                ("It eliminates the need for firewalls", False),
                ("It increases network bandwidth", False),
            ],
        },
    ],
    "compliance": [
        {
            "prompt": "What is the primary purpose of a compliance framework?",
            "options": [
                ("To eliminate all regulatory risk", False),
                ("To provide a structured approach to meeting legal and regulatory obligations", True),
                ("To replace the need for legal counsel", False),
                ("To automate all compliance reporting", False),
            ],
        },
        {
            "prompt": "What is the difference between a regulation and a standard?",
            "options": [
                ("They are the same thing", False),
                ("A regulation is legally binding; a standard is voluntary unless adopted", True),
                ("Standards are always more stringent than regulations", False),
                ("Regulations apply only to public companies", False),
            ],
        },
        {
            "prompt": "Why is documentation critical for compliance?",
            "options": [
                ("It satisfies auditors' paperwork requirements", False),
                ("It provides evidence that controls are operating effectively", True),
                ("It replaces the need for actual controls", False),
                ("It automatically ensures compliance", False),
            ],
        },
        {
            "prompt": "What is a 'control objective'?",
            "options": [
                ("The specific procedure to implement a control", False),
                ("What a control is designed to achieve", True),
                ("The cost of implementing a control", False),
                ("The timeline for deploying a control", False),
            ],
        },
        {
            "prompt": "Who is ultimately responsible for compliance within an organisation?",
            "options": [
                ("The compliance officer", False),
                ("The external auditor", False),
                ("The board of directors and senior management", True),
                ("The IT department", False),
            ],
        },
        {
            "prompt": "What is a material weakness in internal controls?",
            "options": [
                ("A minor control deficiency with low impact", False),
                ("A deficiency that could result in a material misstatement not being prevented", True),
                ("A control that is poorly documented", False),
                ("A control that is newer than 12 months", False),
            ],
        },
        {
            "prompt": "What is the purpose of a compliance risk assessment?",
            "options": [
                ("To identify all applicable regulations", False),
                ("To prioritise compliance efforts based on likelihood and impact of non-compliance", True),
                ("To eliminate the need for ongoing monitoring", False),
                ("To satisfy ISO 27001 certification requirements", False),
            ],
        },
        {
            "prompt": "What is 'regulatory fatigue'?",
            "options": [
                ("When regulations change too frequently to keep up with", True),
                ("When employees become tired of compliance training", False),
                ("When regulators reduce their enforcement activities", False),
                ("When compliance systems become outdated", False),
            ],
        },
        {
            "prompt": "Which of the following is NOT a typical compliance obligation?",
            "options": [
                ("Data protection requirements", False),
                ("Financial reporting standards", False),
                ("Employee satisfaction targets", True),
                ("Industry-specific licensing requirements", False),
            ],
        },
        {
            "prompt": "What is the role of internal audit in compliance?",
            "options": [
                ("To design compliance controls", False),
                ("To independently evaluate whether controls are operating effectively", True),
                ("To replace external audit requirements", False),
                ("To manage day-to-day compliance activities", False),
            ],
        },
    ],
    "resilience": [
        {
            "prompt": "What is organisational resilience?",
            "options": [
                ("The ability to prevent all disruptions", False),
                ("The ability to adapt, recover, and continue operating during adverse events", True),
                ("Having a comprehensive insurance policy", False),
                ("Maintaining redundant systems for all critical processes", False),
            ],
        },
        {
            "prompt": "What is the difference between business continuity and disaster recovery?",
            "options": [
                ("They are the same thing", False),
                ("Business continuity focuses on maintaining operations; disaster recovery focuses on restoring IT systems", True),
                ("Disaster recovery is a subset of business continuity", False),
                ("Business continuity is only relevant to IT departments", False),
            ],
        },
        {
            "prompt": "What is a Business Impact Analysis (BIA)?",
            "options": [
                ("A risk assessment for IT systems only", False),
                ("A process to identify critical functions and quantify the impact of disruption", True),
                ("A financial audit of business operations", False),
                ("A marketing assessment of competitive position", False),
            ],
        },
        {
            "prompt": "What does RTO stand for and what does it measure?",
            "options": [
                ("Recovery Time Objective — the maximum acceptable downtime", True),
                ("Return on Technology — the investment efficiency of IT systems", False),
                ("Risk Transfer Option — the mechanism for shifting risk", False),
                ("Resource Turnover Objective — the rate of resource replacement", False),
            ],
        },
        {
            "prompt": "Why are regular exercises important for business continuity?",
            "options": [
                ("They satisfy audit requirements only", False),
                ("They validate that plans work and identify gaps before a real incident", True),
                ("They replace the need for documented plans", False),
                ("They guarantee successful recovery during an actual disaster", False),
            ],
        },
        {
            "prompt": "What is the primary purpose of a crisis communication plan?",
            "options": [
                ("To manage public relations during a crisis", False),
                ("To ensure timely, accurate information flows to all stakeholders during an incident", True),
                ("To prevent crises from occurring", False),
                ("To assign blame after a crisis", False),
            ],
        },
        {
            "prompt": "What is the 'Swiss cheese model' in the context of incident prevention?",
            "options": [
                ("Each defence layer has holes; incidents occur when holes align", True),
                ("All defence layers must be perfect to prevent incidents", False),
                ("Incidents are always caused by a single failure", False),
                ("Redundancy eliminates all risk of failure", False),
            ],
        },
        {
            "prompt": "What is a key characteristic of a resilient organisation?",
            "options": [
                ("Zero tolerance for any risk", False),
                ("Ability to anticipate, adapt, and recover from disruptions", True),
                ("Complete automation of all processes", False),
                ("Elimination of all manual processes", False),
            ],
        },
        {
            "prompt": "What is the relationship between risk management and resilience?",
            "options": [
                ("They are contradictory approaches", False),
                ("Risk management identifies threats; resilience ensures the organisation can withstand them", True),
                ("Resilience replaces the need for risk management", False),
                ("Risk management is a subset of resilience only", False),
            ],
        },
        {
            "prompt": "What is a 'scenario test' in the context of resilience planning?",
            "options": [
                ("A theoretical discussion of potential threats", False),
                ("A structured exercise that simulates a specific disruption to test response capabilities", True),
                ("A review of historical incident data", False),
                ("A compliance questionnaire sent to vendors", False),
            ],
        },
    ],
    "artificial-intelligence": [
        {
            "prompt": "What is the primary concern with AI bias?",
            "options": [
                ("AI systems are too slow to be useful", False),
                ("AI systems can perpetuate or amplify existing unfair patterns in data", True),
                ("AI systems require too much computing power", False),
                ("AI systems cannot understand human language", False),
            ],
        },
        {
            "prompt": "What is 'explainability' in the context of AI?",
            "options": [
                ("The speed at which an AI model can be deployed", False),
                ("The ability to understand and articulate how an AI system reaches its decisions", True),
                ("The cost of developing an AI model", False),
                ("The number of features a model uses", False),
            ],
        },
        {
            "prompt": "Why is human oversight important in AI-assisted decision making?",
            "options": [
                ("AI systems are always wrong", False),
                ("Humans can catch errors, biases, and edge cases that the AI may miss", True),
                ("Legal requirements mandate human involvement in all decisions", False),
                ("AI systems cannot process enough data", False),
            ],
        },
        {
            "prompt": "What is a 'model card' in responsible AI practice?",
            "options": [
                ("A physical access card for AI laboratory equipment", False),
                ("Documentation that describes a model's intended use, limitations, and performance characteristics", True),
                ("A credit card used to pay for AI cloud services", False),
                ("A certification that an AI model is unbiased", False),
            ],
        },
        {
            "prompt": "What is 'data poisoning' in the context of AI security?",
            "options": [
                ("When AI models consume too much data", False),
                ("When malicious actors manipulate training data to cause model misbehaviour", True),
                ("When data storage systems become corrupted", False),
                ("When AI models generate too much synthetic data", False),
            ],
        },
        {
            "prompt": "What is the purpose of AI governance frameworks?",
            "options": [
                ("To prevent all AI development", False),
                ("To establish principles, policies, and processes for responsible AI use", True),
                ("To replace existing regulatory frameworks", False),
                ("To standardise AI model architectures", False),
            ],
        },
        {
            "prompt": "What is 'differential privacy' in the context of AI?",
            "options": [
                ("Giving different users different levels of data access", False),
                ("A mathematical framework for providing privacy guarantees when training AI models", True),
                ("Keeping AI models confidential from competitors", False),
                ("Using different privacy settings for different AI applications", False),
            ],
        },
        {
            "prompt": "What is the main risk of deploying AI without proper testing?",
            "options": [
                ("The AI will be too slow", False),
                ("Unexpected behaviours, biases, or failures may cause harm in production", True),
                ("Development costs will increase", False),
                ("Users will prefer the manual process", False),
            ],
        },
        {
            "prompt": "What is 'adversarial testing' for AI systems?",
            "options": [
                ("Testing AI against competing AI systems", False),
                ("Deliberately attempting to cause AI failures to identify vulnerabilities", True),
                ("Testing AI performance on competitor benchmarks", False),
                ("Deploying AI to compete with human workers", False),
            ],
        },
        {
            "prompt": "What is the role of a 'Responsible AI Lead' in an organisation?",
            "options": [
                ("To develop all AI models", False),
                ("To oversee AI ethics, risk management, and compliance with AI policies", True),
                ("To replace the Chief Technology Officer", False),
                ("To manage AI vendor relationships only", False),
            ],
        },
    ],
}


def _get_domain_for_course(course_slug: str) -> str:
    """Determine the domain from a course slug."""
    slug_lower = course_slug.lower()
    if "cyber" in slug_lower or "security" in slug_lower:
        return "cyber-security"
    elif "compliance" in slug_lower:
        return "compliance"
    elif "resilien" in slug_lower:
        return "resilience"
    elif "artificial" in slug_lower or "ai" in slug_lower or "machine" in slug_lower:
        return "artificial-intelligence"
    return "risk-management"


async def seed_assessments():
    """Create one assessment per module with questions and options."""
    async with AsyncSessionLocal() as session:
        # Get all courses
        courses = (await session.execute(select(Course))).scalars().all()

        if not courses:
            print("No courses found. Run seed_five_courses.py first.")
            return

        created = 0
        skipped = 0

        for course in courses:
            domain = _get_domain_for_course(course.slug)
            pool = DOMAIN_QUESTIONS.get(domain, DOMAIN_QUESTIONS["risk-management"])

            # Get modules
            modules = (
                await session.execute(
                    select(Module)
                    .where(Module.course_id == course.id)
                    .order_by(Module.sort_order)
                )
            ).scalars().all()

            if not modules:
                print(f"  Skipping '{course.title}' — no modules")
                skipped += 1
                continue

            for module in modules:
                # Check if assessment already exists for this module
                existing = (
                    await session.execute(
                        select(Assessment).where(Assessment.module_id == module.id)
                    )
                ).scalar_one_or_none()

                if existing:
                    print(f"  Skipping module '{module.title}' — assessment already exists")
                    skipped += 1
                    continue

                # Get lessons for this module
                lessons = (
                    await session.execute(
                        select(Lesson)
                        .where(Lesson.module_id == module.id)
                        .order_by(Lesson.sort_order)
                    )
                ).scalars().all()

                if not lessons:
                    print(f"  Skipping module '{module.title}' — no lessons")
                    skipped += 1
                    continue

                # Create 2 questions per module
                questions = []
                for i in range(min(2, len(pool))):
                    q_data = pool[i]
                    questions.append({
                        "prompt": q_data["prompt"],
                        "options": q_data["options"],
                        "sort_order": i,
                    })

                if not questions:
                    print(f"  Skipping module '{module.title}' — no questions")
                    skipped += 1
                    continue

                # Create assessment
                assessment = Assessment(
                    module_id=module.id,
                    title=f"{module.title} Assessment",
                    description=f"Test your understanding of {module.title}.",
                    passing_score=70,
                    max_attempts=3,
                    published=True,
                )
                session.add(assessment)
                await session.flush()

                # Create questions and options
                for q_data in questions:
                    question = AssessmentQuestion(
                        assessment_id=assessment.id,
                        prompt=q_data["prompt"],
                        sort_order=q_data["sort_order"],
                        question_type=AssessmentQuestionType.SINGLE_CHOICE,
                    )
                    session.add(question)
                    await session.flush()

                    for opt_idx, (label, is_correct) in enumerate(q_data["options"]):
                        option = AssessmentOption(
                            question_id=question.id,
                            label=label,
                            is_correct=is_correct,
                            sort_order=opt_idx,
                        )
                        session.add(option)

                await session.flush()
                created += 1
                print(f"  Created assessment for module '{module.title}' with {len(questions)} questions")

        await session.commit()
        print(f"\nDone: {created} assessments created, {skipped} skipped")


if __name__ == "__main__":
    asyncio.run(seed_assessments())
