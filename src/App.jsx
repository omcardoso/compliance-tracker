import React, { useState, useEffect, useCallback } from "react";
import { SignedIn, SignedOut, SignIn, useUser, UserButton } from "@clerk/clerk-react";

// ─── Config ──────────────────────────────────────────────────────────────────
const SCRIPT_URL  = import.meta.env.VITE_SCRIPT_URL;
const CURRENT_YEAR = new Date().getFullYear();

const ADMIN_EMAILS   = ["omcardoso@gmail.com", "cardoso@westchester.eu", "meloatwork@gmail.com"];
const FERNANDO_EMAIL = "gataxservicescorp@gmail.com";

const US_STATES = [
  "florida","delaware","texas","colorado","oklahoma","nevada","wyoming",
  "new york","california","georgia","virginia","north carolina","south carolina",
  "arizona","ohio","illinois","pennsylvania","massachusetts","washington",
  "oregon","utah","new jersey","maryland","connecticut","minnesota",
  "michigan","indiana","tennessee","missouri","wisconsin","louisiana",
  "alabama","kentucky","arkansas","mississippi","kansas","iowa","nebraska",
  "idaho","new mexico","hawaii","alaska","rhode island","vermont",
  "new hampshire","maine","montana","south dakota","north dakota","west virginia",
  "usa","united states","u.s.","us ",
];

function isUSJurisdiction(jurisdiction) {
  if (!jurisdiction) return false;
  const j = jurisdiction.toLowerCase();
  return US_STATES.some(s => j.includes(s));
}

// Filing types per jurisdiction
const JURISDICTION_FILINGS = {
  US:        ["Tax Return"],
  OFFSHORE:  ["Economic Substance"],
  BVI:       ["Economic Substance", "Annual Return"],
};

function getFilingTypesForJurisdiction(jurisdiction) {
  if (!jurisdiction) return [];
  const j = jurisdiction.trim().toLowerCase();
  if (isUSJurisdiction(jurisdiction)) return ["Tax Return"];
  if (j.includes("bvi") || j.includes("british virgin")) return ["Economic Substance", "Annual Return"];
  // All other offshore jurisdictions get Economic Substance
  return ["Economic Substance"];
}

const FILING_DEADLINES = {
  "Economic Substance": "June 30",
  "Annual Return":      "September 30",
  "Tax Return":         "October 15",
};

const TAX_RETURN_STEPS = [
  "Send Information Request Letter",
  "Bank Statements received",
  "Mortgage statement received",
  "Property Management Statement received",
  "HUD received (if new purchase made)",
  "Information on Financial Transactions with Shareholders",
  "Property Tax Information received",
  "Prepare Bookkeeping",
  "Upload reports",
  "Fernando prepared Tax Return",
  "Sent Return to client for signature",
  "Received signed return forms from client",
  "Send signed returns to Fernando",
  "Return Filed",
];

const ECON_SUBSTANCE_STEPS = [
  "Send Google Form link to client",
  "Client submitted form",
  "Prepare Economic Substance filing",
  "Filing submitted",
];

const ANNUAL_RETURN_STEPS = [
  "Send balance sheet request to client",
  "Balance sheet received from client",
  "Prepare Annual Financial Report (AFR)",
  "AFR submitted",
];

const DEFAULT_STEPS = {
  "Economic Substance": ECON_SUBSTANCE_STEPS,
  "Annual Return":      ANNUAL_RETURN_STEPS,
  "Tax Return":         TAX_RETURN_STEPS,
};

const EMAIL_TEMPLATES = {
  "Economic Substance": {
    subject: "URGENTE - {{companyName}} - Informacao para declaracao Anual de Substancia economica - IMPORTANTE",
    body: `IMPORTANTE O prazo para o envio das informacoes preenchidas e ate 30 de Junho para que possamos assegurar o cumprimento das exigencias regulatorias para evitar possiveis multas.

Prezado(a) Cliente,

Como parte dos esforcos continuos para cumprir os requisitos regulatorios de substancia economica, solicitamos sua colaboracao no preenchimento anual do formulario sobre a empresa/entidade abaixo atraves deste link:

https://docs.google.com/forms/d/e/1FAIpQLScEozxzdQyJDo90HNbtmIweKtlEM_fDO4jZhlTUWcL99ugCMg/viewform?usp=publish-editor

Empresa: {{companyName}}
Pais de Incorporacao: {{jurisdiction}}
Numero de Registro: {{registrationNumber}}

Este questionario nos auxiliara na coleta das informacoes necessarias para garantir nossa conformidade com as diretrizes estabelecidas pelo governo local da sua empresa.

Agradecemos sua cooperacao e comprometimento nessa importante etapa.

Octavio Cardoso
President
Westchester International LLC`,
  },
  "Tax Return": {
    subject: "{{companyName}} Declaracao de Renda - Follow up",
    body: `Prezado Cliente:

Se o senhor(a) esta recebendo esse email e porque nao recebemos ate esse momento as informacoes Completas para poder preparar a declaracao de renda da sua empresa para {{year}}.

Conforme abaixo indicado, e fundamental recebermos o mais rapido possivel todas as informacoes necessarias para atendermos os prazos estabelecidos pela Receita Americana.

Para declaracao de renda, solicitamos o envio das demonstracoes financeiras do ano de {{year}} atraves de uma planilha ou extratos bancarios demonstrando as movimentacoes realizadas, como por exemplo:
- Aumento ou reducao de capital, distribuicao de dividendos
- Emprestimos entre empresas
- Compra de imoveis (receitas/recebimentos de aluguel/despesas)
- Despesas gerais, impostos pagos

OBSERVACAO MUITO IMPORTANTE: PRECISAMOS SER INFORMADOS SE HOUVE QUALQUER MOVIMENTACAO DE RECURSOS ENTRE A EMPRESA E SEUS ACIONISTAS NAO AMERICANOS.

E crucial recebermos todas as informacoes ate dia 30 de junho de {{year}}.

Octavio Cardoso
President
Westchester International LLC`,
  },
  "Annual Return": {
    subject: "{{companyName}} Declaracao Anual - BVI",
    body: `Prezado cliente,

Gostariamos de lembrá-lo sobre a obrigacao anual de apresentacao da Declaracao Financeira Anual (AFR) para todas as empresas com sede em British Virgin Islands (BVI).

A declaracao consiste em um balanco contabil basico e uma demonstracao de lucros e perdas. Esse relatorio deve ser apresentado dentro do prazo de nove meses apos o encerramento do ano fiscal. O nao cumprimento sujeita a empresa a multas de ate US$ 5.000,00.

Solicitamos o envio do balanco contabil da sua empresa referente ao ano fiscal de {{year}} o mais breve possivel.

Permanecemos a disposicao para esclarecer qualquer duvida.

Octavio Cardoso
President
Westchester International LLC`,
  },
};

const STEP_STATUSES   = ["Pending", "In Progress", "Waiting Client", "Done"];
const FILING_STATUSES = ["Not Started", "In Progress", "Waiting Client", "Complete"];

const STATUS_COLORS = {
  "Not Started":    { bg:"#f1f5f9", color:"#475569" },
  "In Progress":    { bg:"#dbeafe", color:"#1e40af" },
  "Waiting Client": { bg:"#fef3c7", color:"#92400e" },
  "Complete":       { bg:"#d1fae5", color:"#065f46" },
  "Pending":        { bg:"#f1f5f9", color:"#475569" },
  "Done":           { bg:"#d1fae5", color:"#065f46" },
  "Overdue":        { bg:"#fee2e2", color:"#991b1b" },
};

// ─── API ─────────────────────────────────────────────────────────────────────
async function apiRead(action, params = {}) {
  const qs  = new URLSearchParams({ action, ...params }).toString();
  const res = await fetch("/api/data?" + qs);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function apiWrite(body) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isFernando(val) {
  if (!val) return false;
  return String(val).toLowerCase().includes("fernando");
}

function getDueDate(filingType, year) {
  const map = {
    "Economic Substance": year + "-06-30",
    "Annual Return":      year + "-09-30",
    "Tax Return":         year + "-10-15",
  };
  return map[filingType] || (year + "-12-31");
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const due = new Date(dateStr);
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}

function fillTemplate(str, vars) {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll("{{" + k + "}}", v || ""), str || ""
  );
}

// ─── UI Components ───────────────────────────────────────────────────────────
function Spinner({ size = 18, color = "#6366f1" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation:"spin 0.8s linear infinite", display:"inline-block", flexShrink:0 }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeDasharray="40 20"/>
    </svg>
  );
}

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS["Not Started"];
  return (
    <span style={{ background:s.bg, color:s.color, borderRadius:20,
      padding:"2px 10px", fontSize:11, fontWeight:800, whiteSpace:"nowrap" }}>
      {status}
    </span>
  );
}

function DaysBadge({ days }) {
  if (days === null || days === undefined) return null;
  let bg, color, label;
  if (days < 0)         { bg="#fee2e2"; color="#991b1b"; label=Math.abs(days)+"d overdue"; }
  else if (days <= 14)  { bg="#fef3c7"; color="#92400e"; label=days+"d left"; }
  else if (days <= 60)  { bg="#dbeafe"; color="#1e40af"; label=days+"d left"; }
  else                  { bg="#d1fae5"; color="#065f46"; label=days+"d left"; }
  return (
    <span style={{ background:bg, color, borderRadius:20,
      padding:"2px 9px", fontSize:10, fontWeight:800, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function Modal({ title, onClose, children, width = 640 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)",
      zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:width,
        maxHeight:"90vh", display:"flex", flexDirection:"column",
        boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9",
          display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <span style={{ flex:1, fontFamily:"Georgia,serif", fontWeight:900,
            fontSize:16, color:"#0f172a" }}>{title}</span>
          <button onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer",
              color:"#94a3b8", fontSize:22, lineHeight:1, padding:"0 4px" }}>x</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:20 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Email Modal ──────────────────────────────────────────────────────────────
function EmailModal({ filing, company, onClose }) {
  const tmpl = EMAIL_TEMPLATES[filing.filingType] || {};
  const vars = {
    companyName:        company.name || "",
    jurisdiction:       company.jurisdiction || "",
    registrationNumber: company.registrationNumber || "",
    year:               String(filing.year || CURRENT_YEAR),
  };
  const [to,      setTo]      = useState(company.clientEmail || "");
  const [subject, setSubject] = useState(fillTemplate(tmpl.subject, vars));
  const [body,    setBody]    = useState(fillTemplate(tmpl.body, vars));
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const send = async () => {
    if (!to.trim()) { alert("Please enter recipient email."); return; }
    setSending(true);
    try {
      await apiWrite({ action:"sendComplianceEmail", to, subject, body });
      setSent(true);
      setTimeout(onClose, 1800);
    } catch(e) { alert("Error sending: " + e.message); }
    setSending(false);
  };

  return (
    <Modal title={"Send Email \u2014 " + filing.filingType} onClose={onClose} width={700}>
      {sent ? (
        <div style={{ textAlign:"center", padding:40 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>✓</div>
          <p style={{ fontSize:15, fontWeight:700, color:"#065f46" }}>Email sent!</p>
        </div>
      ) : (
        <div>
          {[["To", to, setTo, "text"], ["Subject", subject, setSubject, "text"]].map(([label, val, setter]) => (
            <div key={label} style={{ marginBottom:12 }}>
              <label style={{ fontSize:10, fontWeight:800, color:"#64748b",
                textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:3 }}>{label}</label>
              <input value={val} onChange={e => setter(e.target.value)}
                style={{ width:"100%", padding:"7px 10px", borderRadius:7, border:"1.5px solid #e2e8f0",
                  fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>
          ))}
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:10, fontWeight:800, color:"#64748b",
              textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:3 }}>Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={14}
              style={{ width:"100%", padding:"7px 10px", borderRadius:7, border:"1.5px solid #e2e8f0",
                fontSize:12, fontFamily:"inherit", outline:"none", resize:"vertical",
                boxSizing:"border-box", lineHeight:1.6 }}/>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={onClose}
              style={{ padding:"8px 16px", borderRadius:7, border:"1.5px solid #e2e8f0",
                background:"#fff", color:"#475569", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              Cancel
            </button>
            <button onClick={send} disabled={sending || !to.trim()}
              style={{ padding:"8px 20px", borderRadius:7, border:"none",
                background: to.trim() && !sending ? "#6366f1" : "#94a3b8",
                color:"#fff", fontSize:13, fontWeight:800,
                cursor: to.trim() && !sending ? "pointer" : "default",
                display:"flex", alignItems:"center", gap:6 }}>
              {sending ? <><Spinner size={14} color="#fff"/>Sending...</> : "Send Email"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Step Row ─────────────────────────────────────────────────────────────────
function StepRow({ step, users, isAdmin, currentUserEmail, onUpdate }) {
  const [editing,    setEditing]    = useState(false);
  const [status,     setStatus]     = useState(step.status || "Pending");
  const [notes,      setNotes]      = useState(step.notes  || "");
  const [assignedTo, setAssignedTo] = useState(step.assignedTo || "");
  const [saving,     setSaving]     = useState(false);

  const canEdit = isAdmin || currentUserEmail === step.assignedTo;

  const quickToggle = async () => {
    if (!canEdit) return;
    const next = { ...step,
      status: step.status === "Done" ? "Pending" : "Done",
      completedAt: step.status === "Done" ? "" : new Date().toISOString(),
    };
    try { await apiWrite({ action:"saveComplianceStep", step:next }); } catch(e) {}
    onUpdate(next);
  };

  const save = async () => {
    setSaving(true);
    const next = { ...step, status, notes, assignedTo,
      completedAt: status === "Done" ? (step.completedAt || new Date().toISOString()) : "" };
    try {
      await apiWrite({ action:"saveComplianceStep", step:next });
      onUpdate(next);
      setEditing(false);
    } catch(e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  const isDone = step.status === "Done";
  return (
    <div style={{ padding:"10px 14px", borderBottom:"1px solid #f8fafc",
      background: isDone ? "#f0fdf4" : "#fff" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div onClick={quickToggle}
          style={{ width:18, height:18, borderRadius:4, flexShrink:0,
            cursor: canEdit ? "pointer" : "default",
            background: isDone ? "#10b981" : "#fff",
            border:"2px solid " + (isDone ? "#10b981" : "#d1d5db"),
            display:"flex", alignItems:"center", justifyContent:"center" }}>
          {isDone && <span style={{ color:"#fff", fontSize:11 }}>✓</span>}
        </div>
        <span style={{ flex:1, fontSize:13, fontWeight:600,
          color: isDone ? "#6b7280" : "#0f172a",
          textDecoration: isDone ? "line-through" : "none" }}>
          {step.stepName}
        </span>
        {step.assignedTo && (
          <span style={{ fontSize:11, color:"#6366f1", fontWeight:700,
            background:"#ede9fe", borderRadius:6, padding:"2px 8px" }}>
            {(users.find(u => u.email === step.assignedTo) || {}).name || step.assignedTo.split("@")[0]}
          </span>
        )}
        {!editing && <Badge status={step.status || "Pending"}/>}
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)}
            style={{ background:"none", border:"none", cursor:"pointer",
              color:"#94a3b8", fontSize:15, padding:"0 4px" }}>✏</button>
        )}
      </div>
      {step.notes && !editing && (
        <div style={{ marginTop:4, marginLeft:28, fontSize:11, color:"#64748b", fontStyle:"italic" }}>
          {step.notes}
        </div>
      )}
      {editing && (
        <div style={{ marginTop:10, padding:12, background:"#f8fafc",
          borderRadius:8, border:"1px solid #e2e8f0" }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            {isAdmin && (
              <div style={{ flex:"1 1 180px" }}>
                <label style={{ fontSize:10, fontWeight:800, color:"#64748b",
                  textTransform:"uppercase", display:"block", marginBottom:3 }}>Assign to</label>
                <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
                  style={{ width:"100%", padding:"6px 8px", borderRadius:7,
                    border:"1.5px solid #e2e8f0", fontSize:12, outline:"none" }}>
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.email}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ flex:"1 1 140px" }}>
              <label style={{ fontSize:10, fontWeight:800, color:"#64748b",
                textTransform:"uppercase", display:"block", marginBottom:3 }}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ width:"100%", padding:"6px 8px", borderRadius:7,
                  border:"1.5px solid #e2e8f0", fontSize:12, outline:"none" }}>
                {STEP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder="Notes..."
            style={{ width:"100%", padding:"6px 8px", borderRadius:7, border:"1.5px solid #e2e8f0",
              fontSize:12, fontFamily:"inherit", outline:"none", resize:"vertical",
              boxSizing:"border-box", marginBottom:8 }}/>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => setEditing(false)}
              style={{ padding:"5px 12px", borderRadius:6, border:"1.5px solid #e2e8f0",
                background:"#fff", color:"#475569", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              style={{ padding:"5px 14px", borderRadius:6, border:"none",
                background:"#6366f1", color:"#fff", fontSize:12, fontWeight:800,
                cursor: saving ? "default" : "pointer",
                display:"flex", alignItems:"center", gap:4 }}>
              {saving ? <><Spinner size={11} color="#fff"/>Saving...</> : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filing Card ──────────────────────────────────────────────────────────────
function FilingCard({ filing, company, users, isAdmin, currentUserEmail, onUpdate }) {
  const [steps,       setSteps]       = useState(filing.steps || []);
  const [expanded,    setExpanded]    = useState(false);
  const [emailModal,  setEmailModal]  = useState(false);
  const [filingStatus,setFilingStatus]= useState(filing.status || "Not Started");

  const days = daysUntil(filing.dueDate);
  const done = steps.filter(s => s.status === "Done").length;
  const pct  = steps.length ? Math.round((done / steps.length) * 100) : 0;

  const recalcStatus = (newSteps) => {
    if (newSteps.every(s => s.status === "Done"))            return "Complete";
    if (newSteps.some(s => s.status === "Waiting Client"))   return "Waiting Client";
    if (newSteps.some(s => s.status === "In Progress"))      return "In Progress";
    return "Not Started";
  };

  const updateStep = async (updated) => {
    const newSteps = steps.map(s => s.stepId === updated.stepId ? updated : s);
    const newStatus = recalcStatus(newSteps);
    setSteps(newSteps);
    setFilingStatus(newStatus);
    try {
      await apiWrite({ action:"saveComplianceFiling",
        filing:{ ...filing, status:newStatus, steps:newSteps }});
      onUpdate({ ...filing, status:newStatus, steps:newSteps });
    } catch(e) {}
  };

  return (
    <div style={{ border:"1px solid #e2e8f0", borderRadius:10, overflow:"hidden", marginBottom:12 }}>
      <div style={{ padding:"12px 16px", background:"#f8fafc",
        display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontWeight:800, fontSize:14, color:"#0f172a" }}>{filing.filingType}</span>
            <Badge status={filingStatus}/>
            {filingStatus !== "Complete" && <DaysBadge days={days}/>}
          </div>
          <div style={{ fontSize:11, color:"#64748b" }}>
            Due: {formatDate(filing.dueDate)} &middot; {done}/{steps.length} steps complete
          </div>
          <div style={{ marginTop:6, height:4, background:"#e2e8f0", borderRadius:2 }}>
            <div style={{ width:pct+"%", height:"100%", borderRadius:2,
              background: pct===100 ? "#10b981" : "#6366f1", transition:"width 0.3s" }}/>
          </div>
        </div>
        {isAdmin && (
          <button onClick={e => { e.stopPropagation(); setEmailModal(true); }}
            style={{ background:"#6366f1", color:"#fff", border:"none", borderRadius:7,
              padding:"5px 12px", fontSize:11, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>
            ✉ Email
          </button>
        )}
        <span style={{ color:"#94a3b8", fontSize:13, display:"inline-block",
          transform: expanded ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}>▼</span>
      </div>
      {expanded && steps.map(step => (
        <StepRow key={step.stepId} step={step} users={users}
          isAdmin={isAdmin} currentUserEmail={currentUserEmail}
          onUpdate={updateStep}/>
      ))}
      {emailModal && (
        <EmailModal filing={filing} company={company} onClose={() => setEmailModal(false)}/>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { user: clerkUser } = useUser();

  const [companies,    setCompanies]    = useState([]);
  const [users,        setUsers]        = useState([]);
  const [filings,      setFilings]      = useState({});
  const [currentUser,  setCurrentUser]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [view,         setView]         = useState("dashboard");
  const [selected,     setSelected]     = useState(null);
  const [yearFilter,   setYearFilter]   = useState(String(CURRENT_YEAR));
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [toast,        setToast]        = useState(null);
  const [creating,     setCreating]     = useState(false);

  const isAdmin = currentUser && (
    ADMIN_EMAILS.includes((currentUser.email || "").toLowerCase()) ||
    currentUser.role === "admin" || currentUser.role === "editor"
  );

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    if (!clerkUser) return;
    setLoading(true);
    try {
      const email = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase() || "";
      const [cd, ud, fd] = await Promise.all([
        apiRead("getCompanies"),
        apiRead("getUsers"),
        apiRead("getFilings", { year: yearFilter }),
      ]);

      const userList = ud.users || [];
      const match    = userList.find(u => (u.email || "").toLowerCase() === email);
      setCurrentUser(match || { email, role:"viewer", name: clerkUser.fullName || email });
      setUsers(userList);
      setCompanies(cd.companies || []);

      const fm = {};
      (fd.filings || []).forEach(f => {
        if (!fm[f.companyName]) fm[f.companyName] = [];
        fm[f.companyName].push(f);
      });
      setFilings(fm);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }, [clerkUser, yearFilter]);

  useEffect(() => { if (clerkUser) loadData(); }, [clerkUser, loadData]);

  const createFilingsForCompany = async (company) => {
    setCreating(true);
    const filingTypes = getFilingTypesForJurisdiction(company.jurisdiction);
    const existing    = (filings[company.name] || [])
      .filter(f => String(f.year) === yearFilter)
      .map(f => f.filingType);
    const toCreate = filingTypes.filter(ft => !existing.includes(ft));

    if (toCreate.length === 0) {
      showToast("All filings already created for " + yearFilter);
      setCreating(false);
      return;
    }
    try {
      const newFilings = [];
      for (const ft of toCreate) {
        const steps = (DEFAULT_STEPS[ft] || []).map((name, i) => ({
          stepId:      "s_" + Date.now() + "_" + i,
          stepName:    name,
          assignedTo:  "",
          status:      "Pending",
          notes:       "",
          completedAt: "",
          order:       i,
        }));
        const f = {
          filingId:    "f_" + Date.now() + "_" + ft.replace(/\s/g, ""),
          companyName: company.name,
          jurisdiction:company.jurisdiction,
          filingType:  ft,
          year:        parseInt(yearFilter),
          status:      "Not Started",
          dueDate:     getDueDate(ft, parseInt(yearFilter)),
          steps,
        };
        await apiWrite({ action:"saveComplianceFiling", filing:f });
        newFilings.push(f);
      }
      setFilings(prev => ({
        ...prev,
        [company.name]: [...(prev[company.name] || []), ...newFilings],
      }));
      showToast(toCreate.join(", ") + " created for " + yearFilter);
    } catch(e) { showToast("Error: " + e.message, "error"); }
    setCreating(false);
  };

  const updateFiling = (companyName, updatedFiling) => {
    setFilings(prev => ({
      ...prev,
      [companyName]: (prev[companyName] || []).map(f =>
        f.filingId === updatedFiling.filingId ? updatedFiling : f
      ),
    }));
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const allFilings = Object.values(filings).flat()
    .filter(f => String(f.year) === yearFilter);
  const stats = {
    total:    allFilings.length,
    complete: allFilings.filter(f => f.status === "Complete").length,
    overdue:  allFilings.filter(f => f.status !== "Complete" && daysUntil(f.dueDate) < 0).length,
    dueSoon:  allFilings.filter(f => f.status !== "Complete" &&
                daysUntil(f.dueDate) >= 0 && daysUntil(f.dueDate) <= 30).length,
  };

  // ── My Tasks ───────────────────────────────────────────────────────────────
  const myTasks = allFilings.flatMap(f =>
    (f.steps || [])
      .filter(s => s.assignedTo === currentUser?.email && s.status !== "Done")
      .map(s => ({
        ...s,
        filing:  f,
        company: companies.find(c => c.name === f.companyName),
      }))
  ).sort((a, b) => new Date(a.filing.dueDate) - new Date(b.filing.dueDate));

  // ── Filtered companies ─────────────────────────────────────────────────────
  const visibleCompanies = companies.filter(c => {
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === "All") return true;
    const cos = (filings[c.name] || []).filter(f => String(f.year) === yearFilter);
    if (statusFilter === "No Filings") return cos.length === 0;
    return cos.some(f => f.status === statusFilter);
  });

  const getWorstStatus = (companyName) => {
    const cos = (filings[companyName] || []).filter(f => String(f.year) === yearFilter);
    if (cos.length === 0) return "No Filings";
    if (cos.some(f => f.status !== "Complete" && daysUntil(f.dueDate) < 0)) return "Overdue";
    if (cos.every(f => f.status === "Complete")) return "Complete";
    if (cos.some(f => f.status === "Waiting Client")) return "Waiting Client";
    if (cos.some(f => f.status === "In Progress"))    return "In Progress";
    return "Not Started";
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:"#f1f5f9" }}>
      <Spinner size={32}/>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:"#f1f5f9", flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <p style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>Could not connect</p>
      <p style={{ fontSize:13, color:"#64748b" }}>{error}</p>
      <button onClick={loadData}
        style={{ background:"#6366f1", color:"#fff", border:"none", borderRadius:8,
          padding:"8px 20px", fontSize:13, fontWeight:800, cursor:"pointer" }}>Retry</button>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f1f5f9",
      fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ background:"#0f172a", padding:"0 24px",
        display:"flex", alignItems:"center", gap:14, height:54 }}>
        <span style={{ fontFamily:"Georgia,serif", fontWeight:900, fontSize:16, color:"#fff" }}>
          Compliance Tracker
        </span>
        <span style={{ color:"#334155" }}>|</span>
        <span style={{ fontSize:12, color:"#64748b" }}>Westchester International</span>
        <div style={{ flex:1 }}/>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
          style={{ background:"#1e293b", color:"#e2e8f0", border:"1px solid #334155",
            borderRadius:7, padding:"4px 10px", fontSize:12, fontWeight:700, outline:"none" }}>
          {[CURRENT_YEAR+1, CURRENT_YEAR, CURRENT_YEAR-1, CURRENT_YEAR-2].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        {[
          { key:"dashboard", label:"Dashboard" },
          { key:"tasks",     label:"My Tasks" + (myTasks.length ? " (" + myTasks.length + ")" : "") },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setView(key)}
            style={{ background: view===key ? "#6366f1" : "none",
              color: view===key ? "#fff" : "#94a3b8", border:"none",
              borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            {label}
          </button>
        ))}
        <UserButton/>
      </div>

      <div style={{ maxWidth:1280, margin:"0 auto", padding:24 }}>

        {/* ── Dashboard ── */}
        {view === "dashboard" && !selected && (
          <>
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
              {[
                { label:"Total Filings",   value:stats.total,    color:"#6366f1" },
                { label:"Complete",        value:stats.complete, color:"#059669" },
                { label:"Overdue",         value:stats.overdue,  color:"#dc2626" },
                { label:"Due in 30 days",  value:stats.dueSoon,  color:"#d97706" },
              ].map(s => (
                <div key={s.label} style={{ background:"#fff", borderRadius:12,
                  padding:"16px 20px", border:"1px solid #e2e8f0" }}>
                  <div style={{ fontSize:30, fontWeight:900, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0",
              overflow:"hidden" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid #f1f5f9",
                display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                <div style={{ position:"relative", flex:"1 1 220px", maxWidth:280 }}>
                  <span style={{ position:"absolute", left:9, top:"50%",
                    transform:"translateY(-50%)", color:"#94a3b8", fontSize:12 }}>🔍</span>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search companies..."
                    style={{ width:"100%", padding:"6px 8px 6px 28px", borderRadius:8,
                      border:"1.5px solid #e2e8f0", fontSize:12, outline:"none",
                      boxSizing:"border-box", fontFamily:"inherit" }}/>
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  style={{ padding:"6px 10px", borderRadius:8, border:"1.5px solid #e2e8f0",
                    fontSize:12, outline:"none", fontFamily:"inherit" }}>
                  <option value="All">All Statuses</option>
                  {FILING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="No Filings">No Filings</option>
                </select>
                <span style={{ fontSize:12, color:"#64748b" }}>{visibleCompanies.length} companies</span>
              </div>

              {/* Column headers */}
              <div style={{ display:"grid", gridTemplateColumns:"2.5fr 1fr 1.5fr 1fr 90px",
                padding:"8px 16px", background:"#f8fafc", borderBottom:"1px solid #f1f5f9" }}>
                {["Company","Jurisdiction","Filing Types","Status",""].map(h => (
                  <span key={h} style={{ fontSize:10, fontWeight:900, color:"#94a3b8",
                    textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {visibleCompanies.length === 0 ? (
                <div style={{ padding:48, textAlign:"center", color:"#94a3b8", fontSize:13 }}>
                  No companies match your filters.
                </div>
              ) : visibleCompanies.map(c => {
                const ws = getWorstStatus(c.name);
                const rowBg = ws === "Overdue" ? "#fff5f5" : ws === "Complete" ? "#f0fdf4" : "#fff";
                const cos   = (filings[c.name] || []).filter(f => String(f.year) === yearFilter);
                return (
                  <div key={c.name}
                    onClick={() => setSelected(c)}
                    style={{ display:"grid", gridTemplateColumns:"2.5fr 1fr 1.5fr 1fr 90px",
                      padding:"11px 16px", borderBottom:"1px solid #f8fafc",
                      cursor:"pointer", background:rowBg, transition:"filter 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.filter="brightness(0.97)"}
                    onMouseLeave={e => e.currentTarget.style.filter="none"}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:"#0f172a" }}>{c.name}</div>
                      {c.clientEmail && (
                        <div style={{ fontSize:11, color:"#64748b" }}>{c.clientEmail}</div>
                      )}
                    </div>
                    <div style={{ fontSize:12, color:"#475569", display:"flex", alignItems:"center" }}>
                      {c.jurisdiction}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:3,
                      justifyContent:"center", alignItems:"flex-start" }}>
                      {getFilingTypesForJurisdiction(c.jurisdiction).map(ft => (
                        <span key={ft} style={{ fontSize:10, background:"#f1f5f9",
                          color:"#475569", borderRadius:4, padding:"1px 6px" }}>{ft}</span>
                      ))}
                    </div>
                    <div style={{ display:"flex", alignItems:"center" }}>
                      {cos.length === 0
                        ? <span style={{ fontSize:11, color:"#94a3b8", fontStyle:"italic" }}>No filings</span>
                        : <Badge status={ws}/>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center" }}>
                      {isAdmin && cos.length === 0 && (
                        <button
                          onClick={e => { e.stopPropagation(); createFilingsForCompany(c); }}
                          disabled={creating}
                          style={{ background:"#6366f1", color:"#fff", border:"none",
                            borderRadius:6, padding:"4px 9px", fontSize:10,
                            fontWeight:800, cursor:"pointer" }}>
                          + Create
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Company Detail ── */}
        {view === "dashboard" && selected && (
          <div>
            <button onClick={() => setSelected(null)}
              style={{ background:"none", border:"none", cursor:"pointer",
                color:"#6366f1", fontSize:13, fontWeight:700,
                marginBottom:16, display:"flex", alignItems:"center", gap:4 }}>
              ← Back to Dashboard
            </button>
            <div style={{ background:"#fff", borderRadius:12, padding:"16px 20px",
              border:"1px solid #e2e8f0", marginBottom:20 }}>
              <div style={{ fontFamily:"Georgia,serif", fontSize:18, fontWeight:900,
                color:"#0f172a", marginBottom:6 }}>{selected.name}</div>
              <div style={{ display:"flex", gap:20, fontSize:12, color:"#64748b", flexWrap:"wrap" }}>
                <span>📍 {selected.jurisdiction}</span>
                {selected.registrationNumber && <span>🔢 {selected.registrationNumber}</span>}
                {selected.clientEmail && <span>✉ {selected.clientEmail}</span>}
                {selected.accounting && <span>👤 {selected.accounting}</span>}
              </div>
            </div>
            {isAdmin && (
              <button onClick={() => createFilingsForCompany(selected)} disabled={creating}
                style={{ background:"#6366f1", color:"#fff", border:"none", borderRadius:8,
                  padding:"8px 18px", fontSize:13, fontWeight:800, marginBottom:16,
                  cursor: creating ? "default" : "pointer", opacity: creating ? 0.7 : 1,
                  display:"flex", alignItems:"center", gap:6 }}>
                {creating ? <><Spinner size={13} color="#fff"/>Creating...</> :
                  "+ Initialize " + yearFilter + " Filings"}
              </button>
            )}
            {(filings[selected.name] || []).filter(f => String(f.year) === yearFilter).length === 0 ? (
              <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0",
                padding:48, textAlign:"center", color:"#94a3b8", fontSize:13 }}>
                No filings for {yearFilter} yet.
                {isAdmin && " Click the button above to initialize them."}
              </div>
            ) : (
              (filings[selected.name] || [])
                .filter(f => String(f.year) === yearFilter)
                .map(filing => (
                  <FilingCard key={filing.filingId}
                    filing={filing} company={selected}
                    users={users} isAdmin={isAdmin}
                    currentUserEmail={currentUser?.email}
                    onUpdate={f => updateFiling(selected.name, f)}/>
                ))
            )}
          </div>
        )}

        {/* ── My Tasks ── */}
        {view === "tasks" && (
          <div>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:20, fontWeight:900,
              color:"#0f172a", marginBottom:20 }}>
              My Tasks — {currentUser?.name || currentUser?.email}
            </h2>
            {myTasks.length === 0 ? (
              <div style={{ background:"#fff", borderRadius:12, border:"1px solid #e2e8f0",
                padding:48, textAlign:"center" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>✓</div>
                <p style={{ fontSize:15, fontWeight:700, color:"#0f172a" }}>All caught up!</p>
                <p style={{ fontSize:13, color:"#64748b" }}>No pending tasks assigned to you.</p>
              </div>
            ) : myTasks.map(task => (
              <div key={task.stepId}
                style={{ background:"#fff", borderRadius:10, border:"1px solid #e2e8f0",
                  padding:"14px 18px", marginBottom:10,
                  display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:"#0f172a", marginBottom:2 }}>
                    {task.stepName}
                  </div>
                  <div style={{ fontSize:11, color:"#64748b" }}>
                    {task.company?.name} &middot; {task.filing?.filingType} &middot; {task.filing?.year}
                  </div>
                </div>
                <DaysBadge days={daysUntil(task.filing?.dueDate)}/>
                <Badge status={task.status}/>
                <button onClick={() => { setSelected(task.company); setView("dashboard"); }}
                  style={{ background:"#f1f5f9", color:"#475569", border:"none",
                    borderRadius:7, padding:"5px 10px", fontSize:11,
                    fontWeight:700, cursor:"pointer" }}>
                  Open →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:20, right:20, zIndex:9999,
          background: toast.type === "error" ? "#ef4444" : "#10b981",
          color:"#fff", borderRadius:10, padding:"10px 18px", fontSize:13,
          fontWeight:700, boxShadow:"0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes spin { to { transform:rotate(360deg); } } * { box-sizing:border-box; }`}</style>
    </div>
  );
}

