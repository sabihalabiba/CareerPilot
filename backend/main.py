from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import httpx
import fitz
from groq import Groq
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ai = Groq(api_key=GROQ_API_KEY)
cv_store = {}
memory_store = {}


def db_get(table, filters=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{filters}"
    r = httpx.get(url, headers=HEADERS)
    return r.json()


def db_post(table, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {**HEADERS, "Prefer": "return=representation"}
    r = httpx.post(url, headers=headers, json=data)
    return r.json()


def db_patch(table, filters, data):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{filters}"
    r = httpx.patch(url, headers=HEADERS, json=data)
    return r.json()


def ask_ai(messages_list):
    response = ai.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages_list,
        max_tokens=1500,
        temperature=0.6
    )
    return response.choices[0].message.content


def get_cv(user_id):
    if user_id in cv_store:
        return cv_store[user_id]
    data = db_get("cvs", f"user_id=eq.{user_id}&select=cv_text")
    if data and len(data) > 0:
        cv_store[user_id] = data[0]["cv_text"]
        return cv_store[user_id]
    return ""


def parse_json(text):
    try:
        text = text.replace("```json", "").replace("```", "").strip()
        start = text.find("{")
        end = text.rfind("}") + 1
        return json.loads(text[start:end])
    except:
        return None


def chunk_cv(cv_text):
    chunks = []
    current_text = ""
    current_section = "general"
    section_keywords = [
        "experience", "education", "skills", "projects",
        "achievements", "summary", "objective", "certifications", "languages"
    ]
    for line in cv_text.split("\n"):
        line_stripped = line.strip()
        line_lower = line_stripped.lower()
        is_header = any(keyword in line_lower for keyword in section_keywords)
        if is_header and len(line_stripped) < 40:
            if current_text.strip():
                chunks.append({"section": current_section, "text": current_text.strip()})
            current_section = line_stripped
            current_text = line + "\n"
        else:
            current_text += line + "\n"
    if current_text.strip():
        chunks.append({"section": current_section, "text": current_text.strip()})
    return chunks


def find_relevant_chunks(chunks, question, max_chunks=3):
    question_words = set(question.lower().split())
    stop_words = {"the", "is", "am", "are", "for", "a", "an", "i", "my", "me", "do", "what", "how", "can"}
    question_words = question_words - stop_words
    scored_chunks = []
    for chunk in chunks:
        score = 0
        chunk_lower = chunk["text"].lower()
        for word in question_words:
            if len(word) > 3 and word in chunk_lower:
                score += 1
        scored_chunks.append((score, chunk))
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    return [chunk for score, chunk in scored_chunks[:max_chunks]]


def get_memory(user_id):
    """Get last 8 messages from database"""
    if user_id in memory_store and len(memory_store[user_id]) > 0:
        return memory_store[user_id]
    # Load from database
    data = db_get("conversation_memory",
        f"user_id=eq.{user_id}&order=created_at.asc&limit=8")
    if isinstance(data, list) and data:
        messages = [{"role": d["role"], "content": d["content"]} for d in data]
        memory_store[user_id] = messages
        return messages
    return []


def save_memory(user_id, role, content):
    """Save message to memory and database"""
    if user_id not in memory_store:
        memory_store[user_id] = []
    memory_store[user_id].append({"role": role, "content": content})
    if len(memory_store[user_id]) > 8:
        memory_store[user_id] = memory_store[user_id][-8:]

    # Save to database
    db_post("conversation_memory", {
        "user_id": user_id,
        "role": role,
        "content": content[:2000]  # limit size
    })

    # Keep only last 8 in database too
    data = db_get("conversation_memory",
        f"user_id=eq.{user_id}&order=created_at.asc")
    if isinstance(data, list) and len(data) > 8:
        old_ids = [d["id"] for d in data[:-8]]
        for old_id in old_ids:
            httpx.delete(
                f"{SUPABASE_URL}/rest/v1/conversation_memory?id=eq.{old_id}",
                headers=HEADERS
            )


# ── Models ─────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    user_id: str
    message: str

class FitRequest(BaseModel):
    user_id: str
    job_description: str

class JobSearchRequest(BaseModel):
    user_id: str
    query: str

class ApplicationRequest(BaseModel):
    user_id: str
    job_title: str
    company: str
    status: str = "applied"
    deadline: str = ""

class UpdateApplicationRequest(BaseModel):
    status: str

class GoalRequest(BaseModel):
    user_id: str
    text: str
    deadline: str = ""
    category: str = "General"

class CoverLetterRequest(BaseModel):
    user_id: str
    job_title: str
    company: str
    job_description: str = ""

class RoadmapRequest(BaseModel):
    user_id: str
    goal: str
    weeks: int = 12

class NudgeRequest(BaseModel):
    user_id: str

class SkillGapRequest(BaseModel):
    user_id: str
    target_role: str


# ── Health ─────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "CareerPilot backend running"}

@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Upload CV ──────────────────────────────────────────────────
@app.post("/upload-cv/{user_id}")
async def upload_cv(user_id: str, file: UploadFile = File(...)):
    content = await file.read()
    pdf = fitz.open(stream=content, filetype="pdf")
    full_text = ""
    for page in pdf:
        full_text += page.get_text()
    cv_store[user_id] = full_text
    upsert_headers = {**HEADERS, "Prefer": "resolution=merge-duplicates"}
    httpx.post(f"{SUPABASE_URL}/rest/v1/cvs", headers=upsert_headers,
               json={"user_id": user_id, "cv_text": full_text})
    memory_store[user_id] = []
    return {"message": "CV uploaded!", "characters": len(full_text)}


# ── Chat ───────────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest):
    if not req.message or len(req.message.strip()) < 2:
        return {"reply": "Please type a question!"}
    cv_text = get_cv(req.user_id)
    if not cv_text:
        return {"reply": "Please upload your CV first so I can give you personalized advice!"}

    chunks = chunk_cv(cv_text)
    relevant_chunks = find_relevant_chunks(chunks, req.message)
    context = "\n\n".join([f"[{c['section'].upper()}]\n{c['text']}" for c in relevant_chunks]) if relevant_chunks else cv_text[:1000]
    history = get_memory(req.user_id)

    messages = [
        {
            "role": "system",
            "content": f"""You are CareerPilot, a sharp and highly experienced AI career coach specializing in the tech industry in Bangladesh (Dhaka market, companies like Brain Station 23, Chaldal, Pathao, bKash, BJIT, Shohoz).

CANDIDATE CV CONTEXT:
{context}

YOUR PERSONALITY:
- Direct, confident, and specific — never vague
- You give verdicts, not just observations
- You reference the candidate's ACTUAL experience by name
- You are like a senior engineer giving brutally honest but kind advice

MEMORY: You remember the full conversation. If someone asks a follow-up, connect it to what was discussed before.

FOR EVERY ANSWER STRUCTURE IT AS:
**Verdict:** One clear sentence answer
**Your Strengths:** Bullet list of matching skills from their actual CV
**Your Gaps:** Bullet list of what is missing  
**Action Plan:** 2-3 specific steps they can take THIS WEEK
**Pro Tip:** One expert insight they probably haven't thought of

Keep total response under 250 words. Be sharp, be specific, be useful."""
        }
    ]

    for msg in history:
        messages.append(msg)
    messages.append({"role": "user", "content": req.message})

    reply = ask_ai(messages)
    save_memory(req.user_id, "user", req.message)
    save_memory(req.user_id, "assistant", reply)
    return {"reply": reply}


# ── Fit Score ──────────────────────────────────────────────────
@app.post("/fit-score")
async def fit_score(req: FitRequest):
    cv_text = get_cv(req.user_id)
    if not cv_text:
        return {"error": "Please upload your CV first!"}

    # Step 1: Extract CV skills
    cv_skills_raw = ask_ai([
        {"role": "system", "content": "Extract skills from CVs. Return ONLY a JSON array. No explanation."},
        {"role": "user", "content": f"Extract ALL technical skills, tools, languages, frameworks from this CV. Include variations (e.g. both 'ML' and 'Machine Learning').\n\nCV:\n{cv_text}\n\nReturn format: [\"Python\", \"Machine Learning\", \"ML\", \"FastAPI\"]"}
    ])
    try:
        cv_skills_raw = cv_skills_raw.replace("```json","").replace("```","").strip()
        cv_skills = json.loads(cv_skills_raw[cv_skills_raw.find("["):cv_skills_raw.rfind("]")+1])
    except:
        cv_skills = []

    # Step 2: Extract JD requirements
    jd_skills_raw = ask_ai([
        {"role": "system", "content": "Extract requirements from job descriptions. Return ONLY a JSON array."},
        {"role": "user", "content": f"Extract ALL required skills, qualifications and tools from this JD.\n\nJD:\n{req.job_description}\n\nReturn format: [\"Python\", \"3 years experience\", \"Docker\"]"}
    ])
    try:
        jd_skills_raw = jd_skills_raw.replace("```json","").replace("```","").strip()
        jd_skills = json.loads(jd_skills_raw[jd_skills_raw.find("["):jd_skills_raw.rfind("]")+1])
    except:
        jd_skills = []

    # Step 3: Semantic matching using AI
    # Instead of exact string matching, ask AI to judge each skill
    match_prompt = f"""You are a technical recruiter doing skill matching.

CV Skills: {cv_skills}
Job Requirements: {jd_skills}

For each job requirement, determine if the CV has a matching or equivalent skill.
Consider synonyms: "ML" = "Machine Learning", "JS" = "JavaScript", "Postgres" = "PostgreSQL" etc.

Return EXACT JSON:
{{
  "matched": ["requirement1", "requirement2"],
  "missing": ["requirement3", "requirement4"],
  "partial": ["requirement5 (has related skill but not exact)"]
}}"""

    match_raw = ask_ai([{"role": "user", "content": match_prompt}])
    match_data = parse_json(match_raw)

    if match_data:
        matched = match_data.get("matched", [])
        missing = match_data.get("missing", [])
        partial = match_data.get("partial", [])
        total = len(matched) + len(missing) + len(partial)
        match_score = round(((len(matched) + len(partial) * 0.5) / max(total, 1)) * 100)
    else:
        cv_lower = [s.lower() for s in cv_skills]
        matched = [s for s in jd_skills if s.lower() in cv_lower]
        missing = [s for s in jd_skills if s.lower() not in cv_lower]
        partial = []
        match_score = round((len(matched) / max(len(jd_skills), 1)) * 100)

    # Step 4: Experience level check
    exp_prompt = f"""Compare experience levels.
CV: {cv_text[:400]}
JD: {req.job_description[:400]}

Return JSON:
{{
  "years_required": "2+ years",
  "years_candidate_has": "1 year internship",
  "experience_verdict": "slightly underqualified"
}}"""
    exp_raw = ask_ai([{"role": "user", "content": exp_prompt}])
    exp_data = parse_json(exp_raw)

    # Adjust score for experience
    if exp_data:
        verdict = exp_data.get("experience_verdict", "")
        if "overqualified" in verdict or "strong" in verdict:
            match_score = min(match_score + 5, 99)
        elif "underqualified" in verdict or "lacking" in verdict:
            match_score = max(match_score - 10, 5)

    # Step 5: Generate recommendation
    rec_prompt = f"""Candidate scored {match_score}% for this job.
Matched: {matched}
Missing: {missing}
Partial: {partial}
Experience: {exp_data}

Write 2 sentences: (1) honest verdict — should they apply? (2) the single most important thing to fix.
Be direct and specific."""

    recommendation = ask_ai([{"role": "user", "content": rec_prompt}])

    return {
        "match_score": match_score,
        "matched_skills": matched,
        "missing_skills": missing,
        "partial_skills": partial,
        "recommendation": recommendation.strip(),
        "experience_info": exp_data,
        "total_skills_in_jd": len(jd_skills),
        "total_skills_matched": len(matched)
    }


# ── Job Search ─────────────────────────────────────────────────
@app.post("/search-jobs")
async def search_jobs(req: JobSearchRequest):
    cv_text = get_cv(req.user_id)

    # Step 1: Try real Adzuna API first
    real_jobs = []
    try:
        # Search in Bangladesh (country code: bd)
        adzuna_url = "https://api.adzuna.com/v1/api/jobs/gb/search/1"
        params = {
            "app_id": ADZUNA_APP_ID,
            "app_key": ADZUNA_APP_KEY,
            "what": req.query,
            "results_per_page": 5,
            "content-type": "application/json"
        }
        response = httpx.get(adzuna_url, params=params, timeout=10)
        data = response.json()
        real_jobs = data.get("results", [])
    except Exception as e:
        print(f"Adzuna error: {e}")

    if real_jobs:
        # Step 2: Process real jobs and compute fit score for each
        cv_lower = cv_text.lower() if cv_text else ""
        processed = []

        for job in real_jobs[:4]:
            title = job.get("title", "Unknown Role")
            company = job.get("company", {}).get("display_name", "Unknown Company")
            location = job.get("location", {}).get("display_name", "United Kingdom")
            description = job.get("description", "")
            salary_min = job.get("salary_min")
            salary_max = job.get("salary_max")
            redirect_url = job.get("redirect_url", "")

            # Format salary
            if salary_min and salary_max:
                salary = f"£{int(salary_min):,} - £{int(salary_max):,}/yr"
            elif salary_min:
                salary = f"£{int(salary_min):,}+/yr"
            else:
                salary = "Salary not specified"

            # Compute fit score by keyword overlap
            if cv_text and description:
                desc_words = set(description.lower().split())
                cv_words = set(cv_lower.split())
                common = desc_words & cv_words
                # Filter out noise words
                noise = {"the","a","an","and","or","in","at","to","of","for","is","are","with","that","this","on","be","as","it","by","from","have","has","was","will","can","not","but","we","you","our","your","their","they","also","more","all","been","an","its","we","which"}
                common = {w for w in common if len(w) > 3 and w not in noise}
                fit_score = min(round(len(common) / max(len(desc_words - noise), 1) * 150), 98)
            else:
                fit_score = 50

            # Get why it matches using AI
            why_prompt = f"""In ONE sentence, explain why this job matches or doesn't match the candidate.
Job: {title} at {company}
Job description snippet: {description[:300]}
Candidate CV snippet: {cv_text[:300]}
Be specific. Reference actual skills."""

            why = ask_ai([{"role": "user", "content": why_prompt}])

            # Extract required skills from description using AI
            skills_prompt = f"""List the top 5 required technical skills from this job description as a JSON array. Example: ["Python", "SQL", "React"]. Return ONLY the array.
Description: {description[:500]}"""
            skills_raw = ask_ai([{"role": "user", "content": skills_prompt}])
            try:
                skills_raw = skills_raw.replace("```json","").replace("```","").strip()
                required_skills = json.loads(skills_raw[skills_raw.find("["):skills_raw.rfind("]")+1])
            except:
                required_skills = ["See job description"]

            processed.append({
                "title": title,
                "company": company,
                "location": location,
                "salary": salary,
                "deadline": "See listing",
                "fit_score": fit_score,
                "why_matches": why.strip(),
                "required_skills": required_skills,
                "apply_url": redirect_url,
                "source": "real"
            })

        return {"jobs": processed}

    else:
        # Fallback: AI generated but clearly labelled
        cv_summary = cv_text[:400] if cv_text else "No CV uploaded"
        prompt = f"""You are a job search assistant. The real job API is unavailable.

Generate 3 realistic job listings based on:
CV: {cv_summary}
Query: "{req.query}"

Use real companies that actually exist globally.
Be honest about salaries.

Return EXACT JSON:
{{
  "jobs": [
    {{
      "title": "Backend Engineer",
      "company": "Accenture",
      "location": "London, UK",
      "salary": "£35,000-£45,000/yr",
      "deadline": "Rolling applications",
      "fit_score": 78,
      "why_matches": "Your FastAPI experience matches their Python backend requirements",
      "required_skills": ["Python", "FastAPI", "SQL"],
      "apply_url": "",
      "source": "ai_generated"
    }}
  ]
}}"""
        result = ask_ai([{"role": "user", "content": prompt}])
        parsed = parse_json(result)
        return parsed if parsed else {"jobs": []}


# ── Cover Letter ───────────────────────────────────────────────
@app.post("/cover-letter")
async def cover_letter(req: CoverLetterRequest):
    cv_text = get_cv(req.user_id)
    if not cv_text:
        return {"letter": "Please upload your CV first!"}

    prompt = f"""You are a world-class cover letter writer who has helped 10,000+ engineers land jobs at top tech companies.

CANDIDATE CV:
{cv_text}

TARGET ROLE: {req.job_title} at {req.company}
JOB DESCRIPTION: {req.job_description}

Write a cover letter that will make the hiring manager stop scrolling.

RULES:
- Start with a specific achievement or bold statement — NOT "I am writing to apply"
- Paragraph 1: Hook — your most impressive relevant achievement from the CV
- Paragraph 2: Why you are the perfect fit — connect 2-3 specific CV items to the JD
- Paragraph 3: Why {req.company} specifically — show you know them
- Paragraph 4: Confident close with call to action
- Use ONLY real experience from the CV — never invent anything
- 250-300 words maximum
- Professional but human tone — no corporate buzzwords"""

    letter = ask_ai([
        {"role": "system", "content": "You write cover letters that get interviews. Every line must earn its place."},
        {"role": "user", "content": prompt}
    ])
    return {"letter": letter}


# ── Roadmap ────────────────────────────────────────────────────
@app.post("/roadmap")
async def generate_roadmap(req: RoadmapRequest):
    cv_text = get_cv(req.user_id)

    prompt = f"""You are a senior tech career coach who has mentored hundreds of engineers in Bangladesh.

CANDIDATE CV:
{cv_text[:800]}

GOAL: {req.goal}
TIMEFRAME: {req.weeks} weeks

Create a highly specific, actionable week-by-week roadmap. Build on what they already know.
Use ONLY free resources: YouTube, freeCodeCamp, Kaggle, fast.ai, CS50, Coursera audit, official docs.

Respond in EXACT JSON — no extra text:
{{
  "goal": "{req.goal}",
  "total_weeks": {req.weeks},
  "starting_point": "What they already know that helps",
  "weeks": [
    {{
      "week": 1,
      "focus": "Topic name",
      "objective": "What they will be able to do after this week",
      "tasks": ["Specific task 1", "Specific task 2", "Build: small project"],
      "resources": ["Resource name — platform", "Resource name — platform"],
      "hours_needed": 10,
      "milestone": "Completion checkpoint"
    }}
  ],
  "final_outcome": "Specific job-ready outcome",
  "jobs_unlocked": ["Job title 1", "Job title 2"]
}}"""

    result = ask_ai([{"role": "user", "content": prompt}])
    parsed = parse_json(result)
    return parsed if parsed else {"error": "Could not generate roadmap"}


# ── Nudge ──────────────────────────────────────────────────────
@app.post("/nudge")
async def get_nudge(req: NudgeRequest):
    cv_text = get_cv(req.user_id)
    applications = db_get("applications", f"user_id=eq.{req.user_id}")
    goals = db_get("goals", f"user_id=eq.{req.user_id}")
    total_apps = len(applications) if isinstance(applications, list) else 0
    pending = [g for g in goals if not g.get("done")] if isinstance(goals, list) else []

    prompt = f"""You are CareerPilot giving a sharp motivational nudge.

Stats: {total_apps} applications sent, {len(pending)} pending goals
CV: {cv_text[:200]}

Write a 2-sentence nudge that is specific, urgent, and encouraging.
Reference their actual situation. Make them want to act RIGHT NOW."""

    nudge = ask_ai([{"role": "user", "content": prompt}])
    return {"nudge": nudge.strip()}


# ── Skill Gap ──────────────────────────────────────────────────
@app.post("/skill-gap")
async def skill_gap(req: SkillGapRequest):
    cv_text = get_cv(req.user_id)
    if not cv_text:
        return {"error": "Please upload your CV first!"}

    prompt = f"""You are a senior tech recruiter at a top Bangladesh company.

CANDIDATE CV:
{cv_text[:800]}

TARGET ROLE: {req.target_role}

Be brutally honest. Compare the candidate's current skills against what top companies actually require for this role in 2026.

Respond in EXACT JSON:
{{
  "target_role": "{req.target_role}",
  "current_level": "Honest assessment",
  "readiness_percent": 65,
  "gap_summary": "2-3 sentence honest assessment",
  "skills_have": ["skill1", "skill2"],
  "skills_need": ["skill1", "skill2"],
  "time_to_ready": "X months if studying Y hours/week",
  "priority_skills": ["Most important skill to learn first"],
  "free_resources": ["Resource — platform (free)"]
}}"""

    result = ask_ai([{"role": "user", "content": prompt}])
    parsed = parse_json(result)
    return parsed if parsed else {"error": "Could not analyze"}


# ── Applications ───────────────────────────────────────────────
@app.post("/add-application")
async def add_application(req: ApplicationRequest):
    data = db_post("applications", {
        "user_id": req.user_id,
        "job_title": req.job_title,
        "company": req.company,
        "status": req.status.lower(),
        "deadline": req.deadline
    })
    return data[0] if isinstance(data, list) and data else {"message": "Saved!"}

@app.get("/applications/{user_id}")
async def get_applications(user_id: str):
    data = db_get("applications", f"user_id=eq.{user_id}&order=created_at.desc")
    return {"applications": data if isinstance(data, list) else []}

@app.patch("/applications/{app_id}")
async def update_application(app_id: str, req: UpdateApplicationRequest):
    db_patch("applications", f"id=eq.{app_id}", {"status": req.status.lower()})
    return {"message": "Updated!"}

@app.delete("/applications/{app_id}")
async def delete_application(app_id: str):
    url = f"{SUPABASE_URL}/rest/v1/applications?id=eq.{app_id}"
    httpx.delete(url, headers=HEADERS)
    return {"message": "Deleted!"}


# ── Goals ──────────────────────────────────────────────────────
@app.post("/add-goal")
async def add_goal(req: GoalRequest):
    data = db_post("goals", {
        "user_id": req.user_id,
        "text": req.text,
        "deadline": req.deadline,
        "category": req.category,
        "done": False
    })
    return data[0] if isinstance(data, list) and data else {"message": "Saved!"}

@app.get("/goals/{user_id}")
async def get_goals(user_id: str):
    data = db_get("goals", f"user_id=eq.{user_id}&order=created_at.desc")
    return {"goals": data if isinstance(data, list) else []}

@app.patch("/goals/{goal_id}")
async def update_goal(goal_id: str, done: bool):
    db_patch("goals", f"id=eq.{goal_id}", {"done": done})
    return {"message": "Updated!"}


# ── Dashboard ──────────────────────────────────────────────────
@app.get("/dashboard/{user_id}")
async def get_dashboard(user_id: str):
    applications = db_get("applications", f"user_id=eq.{user_id}")
    goals = db_get("goals", f"user_id=eq.{user_id}")
    cv_text = get_cv(user_id)
    apps = applications if isinstance(applications, list) else []
    goal_list = goals if isinstance(goals, list) else []
    total_goals = len(goal_list)
    done_goals = len([g for g in goal_list if g.get("done")])
    return {
        "total_applications": len(apps),
        "by_status": {
            "applied": len([a for a in apps if a.get("status") == "applied"]),
            "interviewing": len([a for a in apps if a.get("status") == "interviewing"]),
            "offer": len([a for a in apps if a.get("status") == "offer"]),
            "rejected": len([a for a in apps if a.get("status") == "rejected"])
        },
        "goals_completed": done_goals,
        "total_goals": total_goals,
        "roadmap_percent": round((done_goals / total_goals * 100)) if total_goals > 0 else 0,
        "cv_uploaded": bool(cv_text),
        "memory_messages": len(get_memory(user_id))
    }

@app.delete("/memory/{user_id}")
async def clear_memory(user_id: str):
    memory_store[user_id] = []
    url = f"{SUPABASE_URL}/rest/v1/conversation_memory?user_id=eq.{user_id}"
    httpx.delete(url, headers=HEADERS)
    return {"message": "Memory cleared!"}

# ── Calendar Events ────────────────────────────────────────────
class CalendarEventRequest(BaseModel):
    user_id: str
    title: str
    date: str
    type: str = "deadline"
    description: str = ""

@app.post("/calendar/add")
async def add_calendar_event(req: CalendarEventRequest):
    data = db_post("calendar_events", {
        "user_id": req.user_id,
        "title": req.title,
        "date": req.date,
        "type": req.type,
        "description": req.description
    })
    return data[0] if isinstance(data, list) and data else {"message": "Event saved!"}

@app.get("/calendar/{user_id}")
async def get_calendar_events(user_id: str):
    data = db_get("calendar_events", f"user_id=eq.{user_id}&order=date.asc")
    return {"events": data if isinstance(data, list) else []}

@app.delete("/calendar/{event_id}")
async def delete_calendar_event(event_id: str):
    url = f"{SUPABASE_URL}/rest/v1/calendar_events?id=eq.{event_id}"
    httpx.delete(url, headers=HEADERS)
    return {"message": "Deleted!"}


# ── To-Do Items ────────────────────────────────────────────────
class TodoRequest(BaseModel):
    user_id: str
    text: str
    due_date: str = ""
    priority: str = "medium"

@app.post("/todo/add")
async def add_todo(req: TodoRequest):
    data = db_post("todos", {
        "user_id": req.user_id,
        "text": req.text,
        "due_date": req.due_date,
        "priority": req.priority,
        "done": False
    })
    return data[0] if isinstance(data, list) and data else {"message": "Todo saved!"}

@app.get("/todo/{user_id}")
async def get_todos(user_id: str):
    data = db_get("todos", f"user_id=eq.{user_id}&order=created_at.desc")
    return {"todos": data if isinstance(data, list) else []}

@app.patch("/todo/{todo_id}")
async def update_todo(todo_id: str, done: bool):
    db_patch("todos", f"id=eq.{todo_id}", {"done": done})
    return {"message": "Updated!"}

@app.delete("/todo/{todo_id}")
async def delete_todo(todo_id: str):
    url = f"{SUPABASE_URL}/rest/v1/todos?id=eq.{todo_id}"
    httpx.delete(url, headers=HEADERS)
    return {"message": "Deleted!"}
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)