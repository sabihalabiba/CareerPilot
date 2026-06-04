"use client";
import { useState, useEffect } from "react";
import axios from "axios";

const API = "http://localhost:8000";
const USER_ID = "demo-user";

export default function CareerPilot() {
  const [tab, setTab] = useState("cv");
  const [cvUploaded, setCvUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! Upload your CV first, then ask me anything about your career." }
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [jobQuery, setJobQuery] = useState("software internships in Dhaka");
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [jobDesc, setJobDesc] = useState("");
  const [fitResult, setFitResult] = useState<any>(null);
  const [fitLoading, setFitLoading] = useState(false);

  const [clJobTitle, setClJobTitle] = useState("");
  const [clCompany, setClCompany] = useState("");
  const [clJobDesc, setClJobDesc] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [clLoading, setClLoading] = useState(false);

  const [roadmapGoal, setRoadmapGoal] = useState("");
  const [roadmapWeeks, setRoadmapWeeks] = useState(12);
  const [roadmap, setRoadmap] = useState<any>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);

  const [targetRole, setTargetRole] = useState("");
  const [skillGap, setSkillGap] = useState<any>(null);
  const [skillGapLoading, setSkillGapLoading] = useState(false);

  const [applications, setApplications] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [dashboard, setDashboard] = useState<any>(null);
  const [nudge, setNudge] = useState("");

  // Add application form
  const [addJobTitle, setAddJobTitle] = useState("");
  const [addCompany, setAddCompany] = useState("");
  const [addDeadline, setAddDeadline] = useState("");

  useEffect(() => { loadData(); }, []);

async function loadData() {
  try {
    const [apps, gs, dash, evts, tds] = await Promise.all([
      axios.get(`${API}/applications/${USER_ID}`),
      axios.get(`${API}/goals/${USER_ID}`),
      axios.get(`${API}/dashboard/${USER_ID}`),
      axios.get(`${API}/calendar/${USER_ID}`),
      axios.get(`${API}/todo/${USER_ID}`)
    ]);
    setApplications(apps.data.applications || []);
    setGoals(gs.data.goals || []);
    setDashboard(dash.data);
    setEvents(evts.data.events || []);
    setTodos(tds.data.todos || []);
  } catch (e) { console.log(e); }
}

  async function handleCVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", e.target.files[0]);
    await axios.post(`${API}/upload-cv/${USER_ID}`, formData);
    setCvUploaded(true);
    setUploading(false);
    setMessages([{ role: "ai", text: "CV uploaded and indexed! I have read every section. Ask me anything about your career." }]);
    loadData();
  }

  async function sendMessage() {
    if (!input.trim()) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);
    try {
      const res = await axios.post(`${API}/chat`, { user_id: USER_ID, message: userMsg });
      setMessages(prev => [...prev, { role: "ai", text: res.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Something went wrong. Please try again." }]);
    }
    setChatLoading(false);
  }

  async function searchJobs() {
    setSearchLoading(true);
    setJobs([]);
    try {
      const res = await axios.post(`${API}/search-jobs`, { user_id: USER_ID, query: jobQuery });
      setJobs(res.data.jobs || []);
    } catch { }
    setSearchLoading(false);
  }

  async function trackJob(job: any) {
    await axios.post(`${API}/add-application`, {
      user_id: USER_ID, job_title: job.title,
      company: job.company, status: "applied", deadline: job.deadline
    });
    await loadData();
    alert("Added to tracker!");
  }

  async function checkFit() {
    if (!jobDesc.trim()) return;
    setFitLoading(true);
    setFitResult(null);
    try {
      const res = await axios.post(`${API}/fit-score`, { user_id: USER_ID, job_description: jobDesc });
      setFitResult(res.data);
    } catch { }
    setFitLoading(false);
  }

  async function generateCoverLetter() {
    if (!clJobTitle.trim() || !clCompany.trim()) return;
    setClLoading(true);
    setCoverLetter("");
    const res = await axios.post(`${API}/cover-letter`, {
      user_id: USER_ID, job_title: clJobTitle,
      company: clCompany, job_description: clJobDesc
    });
    setCoverLetter(res.data.letter);
    setClLoading(false);
  }

  async function generateRoadmap() {
    if (!roadmapGoal.trim()) return;
    setRoadmapLoading(true);
    setRoadmap(null);
    const res = await axios.post(`${API}/roadmap`, {
      user_id: USER_ID, goal: roadmapGoal, weeks: roadmapWeeks
    });
    setRoadmap(res.data);
    setRoadmapLoading(false);
  }

  async function analyzeSkillGap() {
    if (!targetRole.trim()) return;
    setSkillGapLoading(true);
    setSkillGap(null);
    const res = await axios.post(`${API}/skill-gap`, { user_id: USER_ID, target_role: targetRole });
    setSkillGap(res.data);
    setSkillGapLoading(false);
  }

  // FIXED: tracker now sends JSON body
  async function moveCard(id: string, newStatus: string) {
    try {
      await axios.patch(`${API}/applications/${id}`, { status: newStatus });
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status: newStatus.toLowerCase() } : a));
    } catch (e) { console.log(e); }
  }

  async function deleteApp(id: string) {
    try {
      await axios.delete(`${API}/applications/${id}`);
      setApplications(prev => prev.filter(a => a.id !== id));
    } catch (e) { console.log(e); }
  }

  async function addManualApplication() {
    if (!addJobTitle.trim() || !addCompany.trim()) return;
    await axios.post(`${API}/add-application`, {
      user_id: USER_ID, job_title: addJobTitle,
      company: addCompany, status: "applied", deadline: addDeadline
    });
    setAddJobTitle(""); setAddCompany(""); setAddDeadline("");
    await loadData();
  }

  async function addGoal() {
    if (!newGoal.trim()) return;
    await axios.post(`${API}/add-goal`, { user_id: USER_ID, text: newGoal });
    setNewGoal("");
    await loadData();
  }

  async function toggleGoal(id: string, done: boolean) {
    await axios.patch(`${API}/goals/${id}?done=${!done}`);
    setGoals(prev => prev.map(g => g.id === id ? { ...g, done: !done } : g));
    await loadData();
  }

async function getNudge() {
  try {
    const res = await axios.post(`${API}/nudge`, { user_id: USER_ID });
    if (res.data.nudge) {
      setNudge(res.data.nudge);
    } else {
      setNudge("Stay focused! Keep applying and building your skills every day.");
    }
  } catch (e) {
    setNudge("Stay focused! Keep applying and building your skills every day.");
  }
}
async function addEvent() {
  if (!newEventTitle.trim() || !newEventDate) return;
  await axios.post(`${API}/calendar/add`, {
    user_id: USER_ID, title: newEventTitle,
    date: newEventDate, type: newEventType
  });
  setNewEventTitle(""); setNewEventDate("");
  await loadData();
}

async function deleteEvent(id: string) {
  await axios.delete(`${API}/calendar/${id}`);
  setEvents(prev => prev.filter(e => e.id !== id));
}

async function addTodo() {
  if (!newTodo.trim()) return;
  await axios.post(`${API}/todo/add`, {
    user_id: USER_ID, text: newTodo,
    due_date: newTodoDue, priority: newTodoPriority
  });
  setNewTodo(""); setNewTodoDue("");
  await loadData();
}

async function toggleTodo(id: string, done: boolean) {
  await axios.patch(`${API}/todo/${id}?done=${!done}`);
  setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !done } : t));
}

async function deleteTodo(id: string) {
  await axios.delete(`${API}/todo/${id}`);
  setTodos(prev => prev.filter(t => t.id !== id));
}
 const tabs = [
  { id: "cv", label: "My CV", icon: "📄" },
  { id: "jobs", label: "Job Hunter", icon: "🔍" },
  { id: "fit", label: "Fit Score", icon: "📊" },
  { id: "chat", label: "AI Assistant", icon: "🤖" },
  { id: "cover", label: "Cover Letter", icon: "✉️" },
  { id: "roadmap", label: "Roadmap", icon: "🗺️" },
  { id: "skillgap", label: "Skill Gap", icon: "🎯" },
  { id: "tracker", label: "Tracker", icon: "📌" },
  { id: "goals", label: "Goals", icon: "✅" },
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "todo", label: "To-Do", icon: "📝" },
  { id: "dashboard", label: "Dashboard", icon: "📈" },
];
const [events, setEvents] = useState<any[]>([]);
const [newEventTitle, setNewEventTitle] = useState("");
const [newEventDate, setNewEventDate] = useState("");
const [newEventType, setNewEventType] = useState("deadline");

const [todos, setTodos] = useState<any[]>([]);
const [newTodo, setNewTodo] = useState("");
const [newTodoDue, setNewTodoDue] = useState("");
const [newTodoPriority, setNewTodoPriority] = useState("medium");

  const inp = "w-full bg-white/80 backdrop-blur border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition placeholder-slate-400";
  const btn = "w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white py-3 rounded-2xl text-sm font-bold shadow-lg shadow-violet-200/50 disabled:opacity-40 transition";

  return (
    <div className="min-h-screen flex" style={{ background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)" }}>

      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-60 z-20 flex flex-col"
        style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(255,255,255,0.1)" }}>

        {/* Logo */}
        <div className="p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>C</div>
            <div>
              <p className="font-black text-white text-base tracking-tight">CareerPilot</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>AI Career Co-pilot</p>
            </div>
          </div>
          {cvUploaded && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-emerald-400 font-semibold">CV Indexed</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold mb-1 transition text-left"
              style={tab === t.id ? {
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                color: "white",
                boxShadow: "0 4px 15px rgba(124,58,237,0.4)"
              } : {
                color: "rgba(255,255,255,0.6)",
                background: "transparent"
              }}
              onMouseEnter={e => { if (tab !== t.id) (e.target as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={e => { if (tab !== t.id) (e.target as HTMLElement).style.background = "transparent"; }}>
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button onClick={getNudge}
            className="w-full py-2.5 rounded-2xl text-xs font-bold transition"
            style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
            ✨ Get AI Nudge
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="ml-60 flex-1 p-8">

        {/* Nudge */}
        {nudge && (
          <div className="rounded-2xl p-4 mb-6 flex justify-between items-start"
            style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)" }}>
            <div className="flex gap-3">
              <span className="text-xl">✨</span>
              <p className="text-sm text-amber-300">{nudge}</p>
            </div>
            <button onClick={() => setNudge("")} className="text-amber-500 ml-4 text-lg hover:text-amber-300">✕</button>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-1">
            {tabs.find(t => t.id === tab)?.icon} {tabs.find(t => t.id === tab)?.label}
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            {tab === "cv" && "Upload your CV to unlock all AI features"}
            {tab === "jobs" && "AI-powered job search matched to your profile"}
            {tab === "fit" && "See your match score for any job description"}
            {tab === "chat" && "Your AI career coach — it knows your CV"}
            {tab === "cover" && "Generate personalized cover letters instantly"}
            {tab === "roadmap" && "Week by week learning plan to reach your goal"}
            {tab === "skillgap" && "Discover exactly what skills you need"}
            {tab === "tracker" && "Track every application in one place"}
            {tab === "goals" && "Set and crush your weekly career goals"}
            {tab === "dashboard" && "Your complete career progress overview"}
          </p>
        </div>

        {/* Glass card style */}
        {/* CV TAB */}
        {tab === "cv" && (
          <div className="rounded-3xl p-8" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>
            <label className="block w-full border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition group"
              style={{ borderColor: "rgba(124,58,237,0.4)" }}>
              <input type="file" accept=".pdf" onChange={handleCVUpload} className="hidden" />
              {uploading ? (
                <div>
                  <div className="text-5xl mb-4 animate-bounce">⚡</div>
                  <p className="text-violet-300 font-bold text-lg">Reading and indexing your CV...</p>
                  <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Chunking sections and preparing AI context</p>
                </div>
              ) : cvUploaded ? (
                <div>
                  <div className="text-5xl mb-4">✅</div>
                  <p className="text-emerald-400 font-bold text-lg">CV uploaded and ready!</p>
                  <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>All AI features are now active · Click to replace</p>
                </div>
              ) : (
                <div>
                  <div className="text-5xl mb-4">📄</div>
                  <p className="text-white font-bold text-xl">Drop your CV here</p>
                  <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>PDF only · Powers all AI features</p>
                </div>
              )}
            </label>
            <div className="grid grid-cols-3 gap-4 mt-6">
              {[
                { icon: "🧠", text: "RAG pipeline reads every section" },
                { icon: "🎯", text: "Finds relevant chunks per question" },
                { icon: "⚡", text: "Powers chat, fit score, roadmap" }
              ].map((f, i) => (
                <div key={i} className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <p className="text-2xl mb-2">{f.icon}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JOBS TAB */}
        {tab === "jobs" && (
          <div>
            <div className="rounded-3xl p-4 mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex gap-3">
                <input value={jobQuery} onChange={e => setJobQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchJobs()}
                  className={inp} placeholder="e.g. ML internships in Dhaka"/>
                <button onClick={searchJobs} disabled={searchLoading}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg disabled:opacity-40 transition whitespace-nowrap">
                  {searchLoading ? "⏳ Hunting..." : "🔍 Hunt Jobs"}
                </button>
              </div>
            </div>
            {jobs.length === 0 && !searchLoading && (
              <div className="text-center py-20">
                <p className="text-5xl mb-4">🔍</p>
                <p style={{ color: "rgba(255,255,255,0.4)" }}>Enter a job search query above</p>
              </div>
            )}
            {jobs.map((job, i) => (
              <div key={i} className="rounded-3xl p-6 mb-4 transition hover:scale-[1.01]"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
                  <div>
                    <p className="font-black text-white text-xl">{job.title}</p>
                    <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{job.company} · {job.location}</p>
                  </div>
                  <span className={`text-sm font-black px-4 py-2 rounded-full ${job.fit_score >= 80 ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"}`}>
                    {job.fit_score}% fit
                  </span>
                </div>
                <div className="h-2 rounded-full mb-4" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className={`h-2 rounded-full ${job.fit_score >= 80 ? "bg-emerald-500" : "bg-amber-400"}`}
                    style={{ width: `${job.fit_score}%` }}/>
                </div>
                <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>💰 {job.salary} · ⏰ Deadline: {job.deadline}</p>
                <div className="rounded-2xl p-3 mb-4" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.2)" }}>
                  <p className="text-xs text-violet-300">💡 {job.why_matches}</p>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {job.required_skills?.map((s: string, j: number) => (
                    <span key={j} className="text-xs px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>{s}</span>
                  ))}
                  <button onClick={() => trackJob(job)}
                    className="ml-auto text-xs font-bold px-4 py-1.5 rounded-full transition"
                    style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa" }}>
                    + Track
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FIT SCORE TAB */}
        {tab === "fit" && (
          <div className="rounded-3xl p-8" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <textarea value={jobDesc} onChange={e => setJobDesc(e.target.value)}
              rows={7} className={`${inp} mb-4 resize-none`}
              placeholder="Paste the full job description here..."/>
            <button onClick={checkFit} disabled={fitLoading} className={btn}>
              {fitLoading ? "⏳ Analyzing match..." : "📊 Compute Fit Score"}
            </button>
            {fitResult && (
              <div className="mt-8">
                <div className="flex items-center gap-6 mb-6 rounded-2xl p-6" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}>
                  <div className="text-7xl font-black" style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {fitResult.match_score}%
                  </div>
                  <div>
                    <p className="font-black text-white text-xl">Match Score</p>
                    <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{fitResult.total_skills_matched} of {fitResult.total_skills_in_jd} required skills found</p>
                  </div>
                </div>
                <div className="h-3 rounded-full mb-6" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="h-3 rounded-full" style={{ width: `${fitResult.match_score}%`, background: "linear-gradient(90deg, #7c3aed, #4f46e5)" }}/>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="rounded-2xl p-5" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <p className="text-xs font-black text-emerald-400 mb-3 uppercase tracking-wider">✅ You Have</p>
                    {fitResult.matched_skills?.map((s: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0"></div>
                        <p className="text-xs text-emerald-300">{s}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl p-5" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <p className="text-xs font-black text-red-400 mb-3 uppercase tracking-wider">❌ You Need</p>
                    {fitResult.missing_skills?.map((s: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0"></div>
                        <p className="text-xs text-red-300">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl p-4" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
                  <p className="text-xs font-black text-violet-400 mb-2">💡 Recommendation</p>
                  <p className="text-sm text-violet-200">{fitResult.recommendation}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {tab === "chat" && (
          <div className="rounded-3xl p-6" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex gap-2 flex-wrap mb-4">
              {["Am I ready for a software role?", "What skills am I missing?", "Build me a 3 month roadmap", "Draft a cover letter"].map(q => (
                <button key={q} onClick={() => setInput(q)}
                  className="text-xs px-3 py-1.5 rounded-full transition font-medium"
                  style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa" }}>
                  {q}
                </button>
              ))}
            </div>
            <div className="rounded-2xl p-4 min-h-72 max-h-[480px] overflow-y-auto mb-4 flex flex-col gap-3"
              style={{ background: "rgba(0,0,0,0.2)" }}>
              {messages.map((m, i) => (
                <div key={i} className={`text-sm p-4 rounded-2xl max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                  m.role === "user" ? "self-end" : "self-start"
                }`} style={m.role === "user" ? {
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  color: "white",
                  boxShadow: "0 4px 15px rgba(124,58,237,0.3)"
                } : {
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.9)"
                }}>
                  {m.text}
                </div>
              ))}
              {chatLoading && (
                <div className="text-sm self-start p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                  <span className="animate-pulse">⚡ Thinking...</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendMessage()}
                placeholder="Ask anything about your career..."
                className={inp}/>
              <button onClick={sendMessage}
                className="px-6 py-3 rounded-2xl text-sm font-bold text-white transition"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 4px 15px rgba(124,58,237,0.4)" }}>
                Send ⚡
              </button>
            </div>
          </div>
        )}

        {/* COVER LETTER TAB */}
        {tab === "cover" && (
          <div className="rounded-3xl p-8" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input value={clJobTitle} onChange={e => setClJobTitle(e.target.value)} className={inp} placeholder="Job title"/>
              <input value={clCompany} onChange={e => setClCompany(e.target.value)} className={inp} placeholder="Company name"/>
            </div>
            <textarea value={clJobDesc} onChange={e => setClJobDesc(e.target.value)}
              rows={4} className={`${inp} mb-4 resize-none`}
              placeholder="Paste job description (recommended for better results)"/>
            <button onClick={generateCoverLetter} disabled={clLoading} className={btn}>
              {clLoading ? "⏳ Writing your letter..." : "✉️ Generate Cover Letter"}
            </button>
            {coverLetter && (
              <div className="mt-6 rounded-2xl p-6" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-xs font-black uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Generated Letter</p>
                  <button onClick={() => navigator.clipboard.writeText(coverLetter)}
                    className="text-xs font-bold px-4 py-1.5 rounded-full transition"
                    style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa" }}>
                    📋 Copy
                  </button>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.8)" }}>{coverLetter}</p>
              </div>
            )}
          </div>
        )}

        {/* ROADMAP TAB — FIXED */}
        {tab === "roadmap" && (
          <div>
            <div className="rounded-3xl p-6 mb-6" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <input value={roadmapGoal} onChange={e => setRoadmapGoal(e.target.value)}
                className={`${inp} mb-3`} placeholder="e.g. Become an ML Engineer"/>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm font-semibold text-white">Weeks:</span>
                {[4, 8, 12, 16, 24].map(w => (
                  <button key={w} onClick={() => setRoadmapWeeks(w)}
                    className="w-10 h-10 rounded-xl text-sm font-bold transition"
                    style={roadmapWeeks === w ? {
                      background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white"
                    } : {
                      background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)"
                    }}>
                    {w}
                  </button>
                ))}
              </div>
              <button onClick={generateRoadmap} disabled={roadmapLoading} className={btn}>
                {roadmapLoading ? "⏳ Building your roadmap..." : "🗺️ Generate Roadmap"}
              </button>
            </div>

            {roadmap && (
              <div>
                <div className="rounded-2xl p-5 mb-6" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(79,70,229,0.2))", border: "1px solid rgba(124,58,237,0.3)" }}>
                  <p className="font-black text-white text-xl">{roadmap.goal}</p>
                  {roadmap.starting_point && <p className="text-sm text-violet-300 mt-1">📍 Starting from: {roadmap.starting_point}</p>}
                  <p className="text-sm text-violet-200 mt-2">🎯 {roadmap.final_outcome}</p>
                  {roadmap.jobs_unlocked && (
                    <div className="flex gap-2 flex-wrap mt-3">
                      {roadmap.jobs_unlocked.map((j: string, i: number) => (
                        <span key={i} className="text-xs px-3 py-1 rounded-full text-emerald-300"
                          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                          🔓 {j}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* FIXED: Week by week with clear week numbers */}
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-0 bottom-0 w-0.5" style={{ background: "rgba(124,58,237,0.3)" }}></div>

                  {roadmap.weeks?.map((w: any, i: number) => (
                    <div key={i} className="relative flex gap-4 mb-4">
                      {/* Week number circle */}
                      <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center font-black text-white text-sm z-10"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 0 20px rgba(124,58,237,0.5)" }}>
                        W{w.week}
                      </div>

                      {/* Content */}
                      <div className="flex-1 rounded-2xl p-5 mb-1"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            {/* FIXED: Dark, visible week label */}
                            <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: "#a78bfa" }}>
                              WEEK {w.week}
                            </p>
                            <p className="font-black text-white text-lg">{w.focus}</p>
                            {w.objective && <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>🎯 {w.objective}</p>}
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}>
                              ⏱ {w.hours_needed}h
                            </span>
                          </div>
                        </div>

                        {/* Tasks */}
                        <div className="mb-3">
                          <p className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Tasks</p>
                          {w.tasks?.map((t: string, j: number) => (
                            <div key={j} className="flex items-start gap-2 mb-1.5">
                              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#a78bfa" }}></div>
                              <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>{t}</p>
                            </div>
                          ))}
                        </div>

                        {/* Resources */}
                        <div className="flex gap-2 flex-wrap">
                          {w.resources?.map((r: string, j: number) => (
                            <span key={j} className="text-xs px-3 py-1 rounded-full font-medium"
                              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)", color: "#6ee7b7" }}>
                              📚 {r}
                            </span>
                          ))}
                        </div>

                        {/* Milestone */}
                        {w.milestone && (
                          <div className="mt-3 rounded-xl p-2" style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
                            <p className="text-xs text-amber-300">🏁 Milestone: {w.milestone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SKILL GAP TAB */}
        {tab === "skillgap" && (
          <div className="rounded-3xl p-8" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <input value={targetRole} onChange={e => setTargetRole(e.target.value)}
              className={`${inp} mb-4`} placeholder="e.g. ML Engineer, Full Stack Developer, DevOps"/>
            <button onClick={analyzeSkillGap} disabled={skillGapLoading} className={btn}>
              {skillGapLoading ? "⏳ Analyzing..." : "🎯 Analyze Skill Gap"}
            </button>
            {skillGap && (
              <div className="mt-6">
                <div className="rounded-2xl p-5 mb-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Current Level</p>
                      <p className="font-bold text-white mt-1">{skillGap.current_level}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Time to Ready</p>
                      <p className="font-bold text-violet-400 mt-1">{skillGap.time_to_ready}</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Readiness</p>
                      <p className="font-bold text-emerald-400 mt-1">{skillGap.readiness_percent ?? "—"}%</p>
                    </div>
                  </div>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{skillGap.gap_summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="rounded-2xl p-4" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <p className="text-xs font-black text-emerald-400 mb-3 uppercase tracking-wider">✅ You Have</p>
                    {skillGap.skills_have?.map((s: string, i: number) => (
                      <p key={i} className="text-xs text-emerald-300 mb-1.5">• {s}</p>
                    ))}
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <p className="text-xs font-black text-red-400 mb-3 uppercase tracking-wider">❌ You Need</p>
                    {skillGap.skills_need?.map((s: string, i: number) => (
                      <p key={i} className="text-xs text-red-300 mb-1.5">• {s}</p>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl p-4 mb-3" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)" }}>
                  <p className="text-xs font-black text-violet-400 mb-2 uppercase tracking-wider">🚀 Learn These First</p>
                  {skillGap.priority_skills?.map((s: string, i: number) => (
                    <p key={i} className="text-xs text-violet-300 mb-1">→ {s}</p>
                  ))}
                </div>
                <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <p className="text-xs font-black mb-2 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>📚 Free Resources</p>
                  {skillGap.free_resources?.map((r: string, i: number) => (
                    <p key={i} className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>• {r}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TRACKER TAB — FIXED */}
        {tab === "tracker" && (
          <div>
            {/* Add manually */}
            <div className="rounded-3xl p-5 mb-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <p className="text-sm font-bold text-white mb-3">➕ Add Application Manually</p>
              <div className="flex gap-3 flex-wrap">
                <input value={addJobTitle} onChange={e => setAddJobTitle(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400 placeholder-white/40"
                  placeholder="Job title"/>
                <input value={addCompany} onChange={e => setAddCompany(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400 placeholder-white/40"
                  placeholder="Company"/>
                <input type="date" value={addDeadline} onChange={e => setAddDeadline(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400"/>
                <button onClick={addManualApplication}
                  className="px-5 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
                  Add
                </button>
              </div>
            </div>

            {/* Kanban */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { status: "applied", label: "Applied", emoji: "📤", color: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)", text: "#93c5fd" },
                { status: "interviewing", label: "Interviewing", emoji: "🎤", color: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.3)", text: "#fde68a" },
                { status: "offer", label: "Offer", emoji: "🎉", color: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", text: "#6ee7b7" },
                { status: "rejected", label: "Rejected", emoji: "❌", color: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", text: "#fca5a5" }
              ].map(({ status, label, emoji, color, border, text }) => (
                <div key={status} className="rounded-3xl p-4" style={{ background: color, border: `1px solid ${border}` }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span>{emoji}</span>
                    <h3 className="text-sm font-black uppercase tracking-wide" style={{ color: text }}>{label}</h3>
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)", color: text }}>
                      {applications.filter(a => a.status === status).length}
                    </span>
                  </div>
                  {applications.filter(a => a.status === status).map(app => (
                    <div key={app.id} className="rounded-2xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <p className="text-xs font-bold text-white mb-0.5">{app.job_title}</p>
                      <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>{app.company}</p>
                      {app.deadline && <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>⏰ {app.deadline}</p>}
                      <select value={app.status}
                        onChange={e => moveCard(app.id, e.target.value)}
                        className="w-full text-xs rounded-xl p-1.5 font-medium mb-2 outline-none"
                        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}>
                        <option value="applied" style={{ background: "#1e1b4b" }}>📤 Applied</option>
                        <option value="interviewing" style={{ background: "#1e1b4b" }}>🎤 Interviewing</option>
                        <option value="offer" style={{ background: "#1e1b4b" }}>🎉 Offer</option>
                        <option value="rejected" style={{ background: "#1e1b4b" }}>❌ Rejected</option>
                      </select>
                      <button onClick={() => deleteApp(app.id)}
                        className="w-full text-xs py-1 rounded-xl transition"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
                        🗑 Remove
                      </button>
                    </div>
                  ))}
                  {applications.filter(a => a.status === status).length === 0 && (
                    <p className="text-xs text-center py-6" style={{ color: "rgba(255,255,255,0.2)" }}>Empty</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GOALS TAB */}
        {tab === "goals" && (
          <div className="rounded-3xl p-8" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex gap-3 mb-6">
              <input value={newGoal} onChange={e => setNewGoal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addGoal()}
                placeholder="e.g. Apply to 5 jobs this week"
                className={inp}/>
              <button onClick={addGoal}
                className="px-6 py-3 rounded-2xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 4px 15px rgba(124,58,237,0.4)" }}>
                Add
              </button>
            </div>
            {goals.length === 0 && (
              <div className="text-center py-12">
                <p className="text-5xl mb-4">🎯</p>
                <p style={{ color: "rgba(255,255,255,0.3)" }}>No goals yet. Add your first goal above!</p>
              </div>
            )}
            {goals.map(goal => (
              <div key={goal.id} className="flex items-center gap-4 p-4 rounded-2xl mb-3 transition"
                style={{ background: goal.done ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)", border: goal.done ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(255,255,255,0.1)" }}>
                <button onClick={() => toggleGoal(goal.id, goal.done)}
                  className="w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition"
                  style={goal.done ? { background: "#10b981", borderColor: "#10b981", color: "white" } : { borderColor: "rgba(255,255,255,0.3)" }}>
                  {goal.done && <span className="text-xs font-bold">✓</span>}
                </button>
                <p className={`text-sm flex-1 font-medium ${goal.done ? "line-through" : "text-white"}`}
                  style={{ color: goal.done ? "rgba(255,255,255,0.4)" : "white" }}>
                  {goal.text}
                </p>
                {goal.done && <span className="text-xs font-bold text-emerald-400">Done! 🎉</span>}
              </div>
            ))}
          </div>
        )}
{/* CALENDAR TAB */}
{tab === "calendar" && (
  <div>
    <div className="rounded-3xl p-5 mb-5"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <p className="text-sm font-bold text-white mb-3">➕ Add Event or Deadline</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)}
          className={inp} placeholder="Event title e.g. Apply to Brain Station 23"/>
        <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)}
          className={inp}/>
      </div>
      <div className="flex gap-3 mb-3">
        {["deadline", "interview", "followup", "goal"].map(type => (
          <button key={type} onClick={() => setNewEventType(type)}
            className="px-4 py-2 rounded-xl text-xs font-bold capitalize transition"
            style={newEventType === type ? {
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "white"
            } : {
              background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)"
            }}>
            {type === "deadline" ? "⏰ Deadline" : type === "interview" ? "🎤 Interview" : type === "followup" ? "📞 Follow Up" : "🎯 Goal"}
          </button>
        ))}
      </div>
      <button onClick={addEvent}
        className="w-full py-2.5 rounded-2xl text-sm font-bold text-white"
        style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
        Add to Calendar
      </button>
    </div>

    {/* Calendar grid */}
    <div className="rounded-3xl p-5"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <p className="text-sm font-bold text-white mb-4">📅 Upcoming Events</p>
      {events.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📅</p>
          <p style={{ color: "rgba(255,255,255,0.3)" }}>No events yet. Add deadlines and interviews above!</p>
        </div>
      )}
      {events.map((evt, i) => {
        const typeConfig: any = {
          deadline: { emoji: "⏰", color: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", text: "#fca5a5" },
          interview: { emoji: "🎤", color: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.3)", text: "#fde68a" },
          followup: { emoji: "📞", color: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)", text: "#93c5fd" },
          goal: { emoji: "🎯", color: "rgba(124,58,237,0.15)", border: "rgba(124,58,237,0.3)", text: "#a78bfa" }
        };
        const cfg = typeConfig[evt.type] || typeConfig.goal;
        return (
          <div key={i} className="flex items-center gap-4 rounded-2xl p-4 mb-3"
            style={{ background: cfg.color, border: `1px solid ${cfg.border}` }}>
            <span className="text-2xl">{cfg.emoji}</span>
            <div className="flex-1">
              <p className="font-bold text-white text-sm">{evt.title}</p>
              <p className="text-xs mt-0.5" style={{ color: cfg.text }}>{evt.date} · {evt.type}</p>
            </div>
            <button onClick={() => deleteEvent(evt.id)}
              className="text-xs px-3 py-1 rounded-xl transition"
              style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
              🗑
            </button>
          </div>
        );
      })}
    </div>
  </div>
)}

{/* TO-DO TAB */}
{tab === "todo" && (
  <div>
    <div className="rounded-3xl p-5 mb-5"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <p className="text-sm font-bold text-white mb-3">➕ Add To-Do</p>
      <input value={newTodo} onChange={e => setNewTodo(e.target.value)}
        onKeyDown={e => e.key === "Enter" && addTodo()}
        className={`${inp} mb-3`} placeholder="e.g. Update CV with new project"/>
      <div className="flex gap-3 mb-3">
        <input type="date" value={newTodoDue} onChange={e => setNewTodoDue(e.target.value)}
          className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-violet-400"/>
        {["low", "medium", "high"].map(p => (
          <button key={p} onClick={() => setNewTodoPriority(p)}
            className="px-4 py-2 rounded-xl text-xs font-bold capitalize transition"
            style={newTodoPriority === p ? {
              background: p === "high" ? "rgba(239,68,68,0.4)" : p === "medium" ? "rgba(251,191,36,0.4)" : "rgba(16,185,129,0.4)",
              color: "white"
            } : {
              background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)"
            }}>
            {p === "high" ? "🔴 High" : p === "medium" ? "🟡 Medium" : "🟢 Low"}
          </button>
        ))}
      </div>
      <button onClick={addTodo}
        className="w-full py-2.5 rounded-2xl text-sm font-bold text-white"
        style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
        Add To-Do
      </button>
    </div>

    <div className="rounded-3xl p-5"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <p className="text-sm font-bold text-white mb-4">
        📝 Tasks ({todos.filter(t => !t.done).length} remaining)
      </p>
      {todos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📝</p>
          <p style={{ color: "rgba(255,255,255,0.3)" }}>No tasks yet. Add your first to-do above!</p>
        </div>
      )}
      {/* Pending */}
      {todos.filter(t => !t.done).map(todo => {
        const priorityStyle: any = {
          high: { dot: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
          medium: { dot: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)" },
          low: { dot: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)" }
        };
        const ps = priorityStyle[todo.priority] || priorityStyle.medium;
        return (
          <div key={todo.id} className="flex items-center gap-4 rounded-2xl p-4 mb-3 transition"
            style={{ background: ps.bg, border: `1px solid ${ps.border}` }}>
            <button onClick={() => toggleTodo(todo.id, todo.done)}
              className="w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition"
              style={{ borderColor: ps.dot }}>
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{todo.text}</p>
              {todo.due_date && <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>📅 Due: {todo.due_date}</p>}
            </div>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ps.dot }}></div>
            <button onClick={() => deleteTodo(todo.id)}
              className="text-xs px-3 py-1 rounded-xl"
              style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
              🗑
            </button>
          </div>
        );
      })}
      {/* Done */}
      {todos.filter(t => t.done).length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
            Completed ({todos.filter(t => t.done).length})
          </p>
          {todos.filter(t => t.done).map(todo => (
            <div key={todo.id} className="flex items-center gap-4 rounded-2xl p-3 mb-2"
              style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
              <button onClick={() => toggleTodo(todo.id, todo.done)}
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "#10b981", color: "white" }}>
                <span className="text-xs font-bold">✓</span>
              </button>
              <p className="text-sm flex-1 line-through" style={{ color: "rgba(255,255,255,0.35)" }}>{todo.text}</p>
              <button onClick={() => deleteTodo(todo.id)}
                className="text-xs px-2 py-1 rounded-xl"
                style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5" }}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}
        {/* DASHBOARD TAB */}
        {tab === "dashboard" && (
          <div>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: "Applications", value: dashboard?.total_applications ?? 0, emoji: "📤", gradient: "from-violet-600 to-indigo-600" },
                { label: "Interviewing", value: dashboard?.by_status?.interviewing ?? 0, emoji: "🎤", gradient: "from-amber-500 to-orange-500" },
                { label: "Offers", value: dashboard?.by_status?.offer ?? 0, emoji: "🎉", gradient: "from-emerald-500 to-teal-500" },
                { label: "Goals Done", value: `${dashboard?.goals_completed ?? 0}/${dashboard?.total_goals ?? 0}`, emoji: "✅", gradient: "from-blue-500 to-cyan-500" },
              ].map((s, i) => (
                <div key={i} className="rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <p className="text-3xl mb-3">{s.emoji}</p>
                  <p className="text-4xl font-black text-white">{s.value}</p>
                  <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl p-6" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-sm font-black text-white mb-4">📈 Roadmap Progress</p>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 h-3 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <div className="h-3 rounded-full" style={{ width: `${dashboard?.roadmap_percent ?? 0}%`, background: "linear-gradient(90deg, #7c3aed, #4f46e5)" }}/>
                  </div>
                  <span className="text-sm font-black text-violet-400">{dashboard?.roadmap_percent ?? 0}%</span>
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{dashboard?.goals_completed ?? 0} of {dashboard?.total_goals ?? 0} goals completed</p>
              </div>
              <div className="rounded-3xl p-6" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <p className="text-sm font-black text-white mb-4">🔄 Pipeline</p>
                {[
                  { status: "applied", emoji: "📤", color: "#818cf8" },
                  { status: "interviewing", emoji: "🎤", color: "#fbbf24" },
                  { status: "offer", emoji: "🎉", color: "#34d399" },
                  { status: "rejected", emoji: "❌", color: "#f87171" }
                ].map(({ status, emoji, color }) => (
                  <div key={status} className="flex items-center gap-3 mb-3">
                    <span className="text-sm">{emoji}</span>
                    <p className="text-xs w-20 capitalize" style={{ color: "rgba(255,255,255,0.5)" }}>{status}</p>
                    <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-2 rounded-full" style={{
                        width: `${Math.min(((dashboard?.by_status?.[status] ?? 0) / Math.max(dashboard?.total_applications ?? 1, 1)) * 100, 100)}%`,
                        background: color
                      }}/>
                    </div>
                    <p className="text-xs font-bold w-4 text-right" style={{ color }}>{dashboard?.by_status?.[status] ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}