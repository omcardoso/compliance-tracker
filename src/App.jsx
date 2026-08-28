import React, { useState, useEffect, useCallback, useRef } from "react";
import { SignedIn, SignedOut, SignIn, useUser, UserButton } from "@clerk/clerk-react";

// ─── Config ──────────────────────────────────────────────────────────────────
const SCRIPT_URL   = import.meta.env.VITE_SCRIPT_URL;
const CURRENT_YEAR = new Date().getFullYear();

const ADMIN_EMAILS = ["omcardoso@gmail.com", "cardoso@westchester.eu", "meloatwork@gmail.com"];

const US_STATES = [
  "florida","delaware","texas","colorado","oklahoma","nevada","wyoming",
  "new york","california","georgia","virginia","north carolina","south carolina",
  "arizona","ohio","illinois","pennsylvania","massachusetts","washington",
  "oregon","utah","new jersey","maryland","connecticut","minnesota",
  "michigan","indiana","tennessee","missouri","wisconsin","louisiana",
  "alabama","kentucky","arkansas","mississippi","kansas","iowa","nebraska",
  "idaho","new mexico","hawaii","alaska","rhode island","vermont",
  "new hampshire","maine","montana","south dakota","north dakota",
  "west virginia","usa","united states","u.s.",
];

function isUSJurisdiction(j) {
  if (!j) return false;
  const jl = j.toLowerCase();
  return US_STATES.some(s => jl.includes(s));
}

function getFilingTypes(jurisdiction) {
  if (!jurisdiction) return [];
  const j = jurisdiction.toLowerCase();
  if (isUSJurisdiction(jurisdiction)) return ["Tax Return"];
  if (j.includes("bvi") || j.includes("british virgin")) return ["Economic Substance", "Annual Return"];
  return ["Economic Substance"];
}

const DEFAULT_STEPS = {
  "Economic Substance": [
    "Send Google Form link to client",
    "Client submitted form",
    "Prepare Economic Substance filing",
    "Filing submitted",
  ],
  "Annual Return": [
    "Send balance sheet request to client",
    "Balance sheet received from client",
    "Prepare Annual Financial Report (AFR)",
    "AFR submitted",
  ],
  "Tax Return": [
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
  ],
};

const EMAIL_TEMPLATES = {
  "Economic Substance": {
    subject: "URGENTE - {{companyName}} - Informacao para declaracao Anual de Substancia economica",
    body: `IMPORTANTE O prazo para o envio das informacoes preenchidas e ate 30 de Junho para que possamos assegurar o cumprimento das exigencias regulatorias para evitar possiveis multas.

Prezado(a) Cliente,

Como parte dos esforcos continuos para cumprir os requisitos regulatorios de substancia economica, solicitamos sua colaboracao no preenchimento anual do formulario sobre a empresa/entidade abaixo atraves deste link:

https://docs.google.com/forms/d/e/1FAIpQLScEozxzdQyJDo90HNbtmIweKtlEM_fDO4jZhlTUWcL99ugCMg/viewform?usp=publish-editor

Empresa: {{companyName}}
Pais de Incorporacao: {{jurisdiction}}
Numero de Registro: {{registrationNumber}}

Agradecemos sua cooperacao e comprometimento nessa importante etapa.

Octavio Cardoso
President - Westchester International LLC`,
  },
  "Tax Return": {
    subject: "{{companyName}} Declaracao de Renda - Follow up",
    body: `Prezado Cliente,

Se o senhor(a) esta recebendo esse email e porque nao recebemos ate esse momento as informacoes Completas para poder preparar a declaracao de renda da sua empresa para {{year}}.

Para declaracao de renda, solicitamos o envio das demonstracoes financeiras do ano de {{year}} atraves de uma planilha ou extratos bancarios demonstrando as movimentacoes realizadas.

E crucial recebermos todas as informacoes ate dia 30 de junho de {{year}}.

Octavio Cardoso
President - Westchester International LLC`,
  },
  "Annual Return": {
    subject: "{{companyName}} Declaracao Anual - BVI",
    body: `Prezado cliente,

Gostariamos de lembra-lo sobre a obrigacao anual de apresentacao da Declaracao Financeira Anual (AFR) para todas as empresas com sede em British Virgin Islands (BVI).

Solicitamos o envio do balanco contabil da sua empresa referente ao ano fiscal de {{year}} o mais breve possivel.

Octavio Cardoso
President - Westchester International LLC`,
  },
};

const STEP_STATUSES   = ["Pending", "In Progress", "Waiting Client", "Done"];
const FILING_STATUSES = ["Not Started", "In Progress", "Waiting Client", "Complete"];
const ALL_FILING_TYPES = ["Tax Return", "Economic Substance", "Annual Return"];

// ─── Dark Theme Colors ────────────────────────────────────────────────────────
const C = {
  bg:         "#0d0d0d",
  card:       "#1a1a1a",
  card2:      "#222222",
  border:     "#2d2d2d",
  border2:    "#383838",
  text:       "#f1f5f9",
  text2:      "#94a3b8",
  text3:      "#475569",
  accent:     "#6366f1",
  accentHov:  "#4f46e5",
  success:    "#10b981",
  warning:    "#f59e0b",
  danger:     "#ef4444",
  inputBg:    "#242424",
};

const STATUS_STYLES = {
  "Not Started":    { bg:"#1f2937", color:"#94a3b8" },
  "In Progress":    { bg:"#1e3a5f", color:"#60a5fa" },
  "Waiting Client": { bg:"#3d2b00", color:"#fbbf24" },
  "Complete":       { bg:"#064e3b", color:"#34d399" },
  "Pending":        { bg:"#1f2937", color:"#94a3b8" },
  "Done":           { bg:"#064e3b", color:"#34d399" },
  "Overdue":        { bg:"#450a0a", color:"#fca5a5" },
  "No Filings":     { bg:"#1f2937", color:"#475569" },
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
    method: "POST", headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isFernando(val) {
  return val && String(val).toLowerCase().includes("fernando");
}
function getDueDate(ft, year) {
  const m = { "Economic Substance": year+"-06-30", "Annual Return": year+"-09-30", "Tax Return": year+"-10-15" };
  return m[ft] || year+"-12-31";
}
function daysUntil(d) {
  if (!d) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.round((new Date(d) - t) / 86400000);
}
function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}
function fill(str, vars) {
  return Object.entries(vars).reduce((s,[k,v]) => s.replaceAll("{{"+k+"}}", v||""), str||"");
}
function getNextResponsible(companyName, filings, year, users) {
  const cos = (filings[companyName]||[]).filter(f => String(f.year)===year && f.status!=="Complete");
  for (const f of cos) {
    const next = (f.steps||[]).find(s => s.status!=="Done" && s.assignedTo);
    if (next) {
      const u = users.find(u => u.email===next.assignedTo);
      return { name: u ? u.name.split(" ")[0] : next.assignedTo.split("@")[0], step: next.stepName };
    }
  }
  return null;
}

// ─── UI Components ───────────────────────────────────────────────────────────
function Spinner({ size=18, color=C.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation:"spin 0.8s linear infinite", display:"inline-block", flexShrink:0 }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeDasharray="40 20"/>
    </svg>
  );
}

function Badge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES["Not Started"];
  return (
    <span style={{ background:s.bg, color:s.color, borderRadius:20,
      padding:"2px 10px", fontSize:11, fontWeight:800, whiteSpace:"nowrap" }}>
      {status}
    </span>
  );
}

function DaysBadge({ days }) {
  if (days===null||days===undefined) return null;
  let bg, color, label;
  if (days<0)        { bg="#450a0a"; color="#fca5a5"; label=Math.abs(days)+"d overdue"; }
  else if (days<=14) { bg="#3d2b00"; color="#fbbf24"; label=days+"d left"; }
  else if (days<=60) { bg="#1e3a5f"; color="#60a5fa"; label=days+"d left"; }
  else               { bg="#064e3b"; color="#34d399"; label=days+"d left"; }
  return (
    <span style={{ background:bg, color, borderRadius:20, padding:"2px 9px",
      fontSize:10, fontWeight:800, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function Btn({ onClick, disabled, children, variant="primary", size="md", style={} }) {
  const base = { border:"none", borderRadius:7, cursor:disabled?"default":"pointer",
    fontWeight:800, display:"inline-flex", alignItems:"center", gap:6,
    fontFamily:"inherit", transition:"opacity 0.15s", opacity:disabled?0.5:1, ...style };
  const variants = {
    primary:   { background:C.accent,   color:"#fff", fontSize: size==="sm"?11:13, padding: size==="sm"?"4px 10px":"8px 18px" },
    secondary: { background:C.card2,    color:C.text2, fontSize: size==="sm"?11:13, padding: size==="sm"?"4px 10px":"8px 18px", border:"1px solid "+C.border2 },
    danger:    { background:"#450a0a",  color:"#fca5a5", fontSize: size==="sm"?11:13, padding: size==="sm"?"4px 10px":"8px 18px" },
    ghost:     { background:"none",     color:C.text2, fontSize: size==="sm"?11:13, padding: size==="sm"?"4px 8px":"6px 12px" },
  };
  return (
    <button onClick={!disabled?onClick:undefined} disabled={disabled}
      style={{ ...base, ...variants[variant] }}>
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, style={} }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder}
      style={{ background:C.inputBg, border:"1px solid "+C.border2, borderRadius:7,
        color:C.text, padding:"7px 10px", fontSize:12, fontFamily:"inherit",
        outline:"none", ...style }}/>
  );
}

function Modal({ title, onClose, children, width=640 }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.card, borderRadius:14, width:"100%", maxWidth:width,
        maxHeight:"90vh", display:"flex", flexDirection:"column",
        border:"1px solid "+C.border, boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid "+C.border,
          display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <span style={{ flex:1, fontFamily:"Georgia,serif", fontWeight:900,
            fontSize:16, color:C.text }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none",
            cursor:"pointer", color:C.text3, fontSize:20, padding:"0 4px" }}>x</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:20 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Email Modal ──────────────────────────────────────────────────────────────
function EmailModal({ filing, company, onClose }) {
  const tmpl = EMAIL_TEMPLATES[filing.filingType] || {};
  const vars = { companyName:company.name||"", jurisdiction:company.jurisdiction||"",
    registrationNumber:company.registrationNumber||"", year:String(filing.year||CURRENT_YEAR) };
  const [to,      setTo]      = useState(company.clientEmail||"");
  const [subject, setSubject] = useState(fill(tmpl.subject, vars));
  const [body,    setBody]    = useState(fill(tmpl.body, vars));
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const send = async () => {
    if (!to.trim()) { alert("Enter recipient email."); return; }
    setSending(true);
    try { await apiWrite({ action:"sendComplianceEmail", to, subject, body }); setSent(true); setTimeout(onClose,1800); }
    catch(e) { alert("Error: "+e.message); }
    setSending(false);
  };

  const labelStyle = { fontSize:10, fontWeight:800, color:C.text3,
    textTransform:"uppercase", letterSpacing:"0.06em", display:"block", marginBottom:3 };
  const inputStyle = { width:"100%", background:C.inputBg, border:"1px solid "+C.border2,
    borderRadius:7, color:C.text, padding:"7px 10px", fontSize:13,
    fontFamily:"inherit", outline:"none", boxSizing:"border-box" };

  return (
    <Modal title={"Send Email \u2014 "+filing.filingType} onClose={onClose} width={700}>
      {sent ? (
        <div style={{ textAlign:"center", padding:40 }}>
          <div style={{ fontSize:48, marginBottom:12 }}>✓</div>
          <p style={{ fontSize:15, fontWeight:700, color:C.success }}>Email sent!</p>
        </div>
      ) : (
        <div>
          {[["To",to,setTo],["Subject",subject,setSubject]].map(([label,val,setter])=>(
            <div key={label} style={{ marginBottom:12 }}>
              <label style={labelStyle}>{label}</label>
              <input value={val} onChange={e=>setter(e.target.value)} style={inputStyle}/>
            </div>
          ))}
          <div style={{ marginBottom:16 }}>
            <label style={labelStyle}>Body</label>
            <textarea value={body} onChange={e=>setBody(e.target.value)} rows={12}
              style={{ ...inputStyle, resize:"vertical", lineHeight:1.6 }}/>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn onClick={send} disabled={sending||!to.trim()}>
              {sending ? <><Spinner size={13} color="#fff"/>Sending...</> : "Send Email"}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Step Row ─────────────────────────────────────────────────────────────────
function StepRow({ step, users, isAdmin, currentUserEmail, onUpdate }) {
  const [editing,    setEditing]    = useState(false);
  const [status,     setStatus]     = useState(step.status||"Pending");
  const [notes,      setNotes]      = useState(step.notes||"");
  const [assignedTo, setAssignedTo] = useState(step.assignedTo||"");
  const [saving,     setSaving]     = useState(false);
  const canEdit = isAdmin || currentUserEmail===step.assignedTo;
  const isDone  = step.status==="Done";

  const quickToggle = async () => {
    if (!canEdit) return;
    const next = { ...step, status:isDone?"Pending":"Done",
      completedAt:isDone?"":new Date().toISOString() };
    try { await apiWrite({ action:"saveComplianceStep", step:next }); } catch(e) {}
    onUpdate(next);
  };

  const save = async () => {
    setSaving(true);
    const next = { ...step, status, notes, assignedTo,
      completedAt:status==="Done"?(step.completedAt||new Date().toISOString()):"" };
    try { await apiWrite({ action:"saveComplianceStep", step:next }); onUpdate(next); setEditing(false); }
    catch(e) { alert("Error: "+e.message); }
    setSaving(false);
  };

  const selStyle = { background:C.inputBg, border:"1px solid "+C.border2, borderRadius:7,
    color:C.text, padding:"5px 8px", fontSize:12, outline:"none", width:"100%" };

  return (
    <div style={{ padding:"9px 14px", borderBottom:"1px solid "+C.border,
      background:isDone?"#0d1f13":"transparent" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div onClick={quickToggle}
          style={{ width:18, height:18, borderRadius:4, flexShrink:0, cursor:canEdit?"pointer":"default",
            background:isDone?C.success:"transparent",
            border:"2px solid "+(isDone?C.success:C.border2),
            display:"flex", alignItems:"center", justifyContent:"center" }}>
          {isDone && <span style={{ color:"#fff", fontSize:10, fontWeight:900 }}>✓</span>}
        </div>
        <span style={{ flex:1, fontSize:12, fontWeight:600,
          color:isDone?C.text3:C.text,
          textDecoration:isDone?"line-through":"none" }}>
          {step.stepName}
        </span>
        {step.assignedTo && (
          <span style={{ fontSize:10, color:C.accent, fontWeight:700,
            background:"#1e1b4b", borderRadius:6, padding:"2px 7px" }}>
            {(users.find(u=>u.email===step.assignedTo)||{}).name?.split(" ")[0] || step.assignedTo.split("@")[0]}
          </span>
        )}
        {!editing && <Badge status={step.status||"Pending"}/>}
        {canEdit && !editing && (
          <button onClick={()=>setEditing(true)}
            style={{ background:"none", border:"none", cursor:"pointer", color:C.text3, fontSize:14, padding:"0 3px" }}>
            ✏
          </button>
        )}
      </div>
      {step.notes && !editing && (
        <div style={{ marginTop:3, marginLeft:28, fontSize:11, color:C.text3, fontStyle:"italic" }}>
          {step.notes}
        </div>
      )}
      {editing && (
        <div style={{ marginTop:10, padding:12, background:C.card2,
          borderRadius:8, border:"1px solid "+C.border }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            {isAdmin && (
              <div style={{ flex:"1 1 160px" }}>
                <label style={{ fontSize:10, fontWeight:800, color:C.text3,
                  textTransform:"uppercase", display:"block", marginBottom:3 }}>Assign to</label>
                <select value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} style={selStyle}>
                  <option value="">Unassigned</option>
                  {users.map(u=><option key={u.id} value={u.email}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ flex:"1 1 130px" }}>
              <label style={{ fontSize:10, fontWeight:800, color:C.text3,
                textTransform:"uppercase", display:"block", marginBottom:3 }}>Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={selStyle}>
                {STEP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Notes..."
            style={{ width:"100%", background:C.inputBg, border:"1px solid "+C.border2, borderRadius:7,
              color:C.text, padding:"6px 8px", fontSize:12, fontFamily:"inherit",
              outline:"none", resize:"vertical", boxSizing:"border-box", marginBottom:8 }}/>
          <div style={{ display:"flex", gap:6 }}>
            <Btn variant="secondary" size="sm" onClick={()=>setEditing(false)}>Cancel</Btn>
            <Btn size="sm" onClick={save} disabled={saving}>
              {saving?<><Spinner size={10} color="#fff"/>Saving...</>:"Save"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filing Card ──────────────────────────────────────────────────────────────
function FilingCard({ filing, company, users, isAdmin, currentUserEmail, onUpdate, onEmail }) {
  const [steps,       setSteps]       = useState(filing.steps||[]);
  const [expanded,    setExpanded]    = useState(false);
  const [filingStatus,setFilingStatus]= useState(filing.status||"Not Started");
  const days = daysUntil(filing.dueDate);
  const done = steps.filter(s=>s.status==="Done").length;
  const pct  = steps.length ? Math.round((done/steps.length)*100) : 0;

  const recalc = (ns) => {
    if (ns.every(s=>s.status==="Done")) return "Complete";
    if (ns.some(s=>s.status==="Waiting Client")) return "Waiting Client";
    if (ns.some(s=>s.status==="In Progress"))    return "In Progress";
    return "Not Started";
  };

  const updateStep = async (updated) => {
    const ns = steps.map(s=>s.stepId===updated.stepId?updated:s);
    const st = recalc(ns);
    setSteps(ns); setFilingStatus(st);
    try { await apiWrite({ action:"saveComplianceFiling", filing:{...filing, status:st, steps:ns} }); onUpdate({...filing,status:st,steps:ns}); }
    catch(e) {}
  };

  return (
    <div style={{ border:"1px solid "+C.border, borderRadius:10, overflow:"hidden", marginBottom:10 }}>
      <div style={{ padding:"11px 14px", background:C.card2,
        display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}
        onClick={()=>setExpanded(v=>!v)}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ fontWeight:800, fontSize:13, color:C.text }}>{filing.filingType}</span>
            <Badge status={filingStatus}/>
            {filingStatus!=="Complete" && <DaysBadge days={days}/>}
          </div>
          <div style={{ fontSize:11, color:C.text3 }}>
            Due: {fmtDate(filing.dueDate)} &middot; {done}/{steps.length} steps
          </div>
          <div style={{ marginTop:5, height:3, background:C.border, borderRadius:2 }}>
            <div style={{ width:pct+"%", height:"100%", borderRadius:2,
              background:pct===100?C.success:C.accent, transition:"width 0.3s" }}/>
          </div>
        </div>
        {isAdmin && (
          <Btn size="sm" onClick={e=>{e.stopPropagation();onEmail(filing);}}>✉ Email</Btn>
        )}
        <span style={{ color:C.text3, fontSize:11, display:"inline-block",
          transform:expanded?"rotate(180deg)":"none", transition:"transform 0.2s" }}>▼</span>
      </div>
      {expanded && steps.map(step=>(
        <StepRow key={step.stepId} step={step} users={users}
          isAdmin={isAdmin} currentUserEmail={currentUserEmail}
          onUpdate={updateStep}/>
      ))}
    </div>
  );
}

// ─── Year Manager Modal ───────────────────────────────────────────────────────
function YearManager({ companies, filings, setFilings, yearFilter, setYearFilter, onClose, showToast }) {
  const [working,  setWorking]  = useState(false);
  const [progress, setProgress] = useState("");
  const [delYear,  setDelYear]  = useState("");
  const [newYear,  setNewYear]  = useState(String(CURRENT_YEAR));

  const years = [...new Set(
    Object.values(filings).flat().map(f=>String(f.year)).filter(Boolean)
  )].sort().reverse();

  const initAllCompanies = async () => {
    if (!newYear) return;
    setWorking(true);
    let created = 0;
    for (const c of companies) {
      const types = getFilingTypes(c.jurisdiction);
      const existing = (filings[c.name]||[]).filter(f=>String(f.year)===newYear).map(f=>f.filingType);
      const toCreate = types.filter(ft=>!existing.includes(ft));
      for (const ft of toCreate) {
        const steps = (DEFAULT_STEPS[ft]||[]).map((name,i)=>({
          stepId:"s_"+Date.now()+"_"+i+"_"+Math.random().toString(36).slice(2,6),
          stepName:name, assignedTo:"", status:"Pending", notes:"", completedAt:"", order:i
        }));
        const f = {
          filingId:"f_"+Date.now()+"_"+Math.random().toString(36).slice(2,6),
          companyName:c.name, jurisdiction:c.jurisdiction, filingType:ft,
          year:parseInt(newYear), status:"Not Started",
          dueDate:getDueDate(ft,parseInt(newYear)), steps, yearNotes:"",
        };
        try { await apiWrite({ action:"saveComplianceFiling", filing:f }); created++; }
        catch(e) {}
        setProgress("Creating... "+created+" filings");
        setFilings(prev=>({ ...prev, [c.name]:[...(prev[c.name]||[]), f] }));
      }
    }
    setYearFilter(newYear);
    setProgress("");
    showToast(created+" filings created for "+newYear);
    setWorking(false);
  };

  const deleteYear = async () => {
    if (!delYear || !window.confirm("Delete ALL filings for "+delYear+"? This cannot be undone.")) return;
    setWorking(true);
    const toDelete = Object.values(filings).flat().filter(f=>String(f.year)===delYear);
    for (const f of toDelete) {
      try { await apiWrite({ action:"deleteComplianceFiling", filingId:f.filingId }); } catch(e) {}
    }
    setFilings(prev=>{
      const next = {};
      Object.entries(prev).forEach(([k,v])=>{ next[k]=v.filter(f=>String(f.year)!==delYear); });
      return next;
    });
    if (yearFilter===delYear) setYearFilter(String(CURRENT_YEAR));
    showToast("All "+delYear+" filings deleted");
    setDelYear("");
    setWorking(false);
  };

  const selectStyle = { background:C.inputBg, border:"1px solid "+C.border2, borderRadius:7,
    color:C.text, padding:"7px 10px", fontSize:13, outline:"none", width:"100%" };

  return (
    <Modal title="Manage Filing Years" onClose={onClose} width={520}>
      <div>
        {/* Create new year */}
        <div style={{ background:C.card2, borderRadius:10, padding:16, marginBottom:16,
          border:"1px solid "+C.border }}>
          <div style={{ fontWeight:800, fontSize:13, color:C.text, marginBottom:12 }}>
            Initialize Year for All Companies
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, color:C.text3, display:"block", marginBottom:4 }}>Year</label>
            <select value={newYear} onChange={e=>setNewYear(e.target.value)} style={selectStyle}>
              {[CURRENT_YEAR+1,CURRENT_YEAR,CURRENT_YEAR-1,CURRENT_YEAR-2].map(y=>(
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <p style={{ fontSize:11, color:C.text3, marginBottom:12, lineHeight:1.5 }}>
            This will create all required filings for every company based on their jurisdiction.
            Existing filings for this year will not be affected.
          </p>
          {progress && (
            <p style={{ fontSize:11, color:C.accent, marginBottom:8 }}>{progress}</p>
          )}
          <Btn onClick={initAllCompanies} disabled={working}>
            {working?<><Spinner size={13} color="#fff"/>Working...</>:"Create All Filings for "+newYear}
          </Btn>
        </div>

        {/* Delete year */}
        <div style={{ background:"#1a0a0a", borderRadius:10, padding:16,
          border:"1px solid #450a0a" }}>
          <div style={{ fontWeight:800, fontSize:13, color:"#fca5a5", marginBottom:12 }}>
            Delete Entire Year
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, color:C.text3, display:"block", marginBottom:4 }}>Select year to delete</label>
            <select value={delYear} onChange={e=>setDelYear(e.target.value)} style={selectStyle}>
              <option value="">-- Select year --</option>
              {years.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <Btn variant="danger" onClick={deleteYear} disabled={!delYear||working}>
            Delete All {delYear||"..."} Filings
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────
function SidePanel({ company, filings, users, isAdmin, currentUserEmail, yearFilter, onClose, updateFiling }) {
  const [emailFiling, setEmailFiling] = useState(null);
  const [notes,       setNotes]       = useState("");
  const [notesSaved,  setNotesSaved]  = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const cos = (filings[company.name]||[]).filter(f=>String(f.year)===yearFilter);

  // Load notes from the special __notes__ filing
  useEffect(()=>{
    const notesFiling = cos.find(f=>f.filingType==="__notes__");
    setNotes(notesFiling ? (notesFiling.yearNotes||"") : "");
    setNotesSaved(false);
  }, [company.name, yearFilter]);

  const saveNotes = async () => {
    setSavingNotes(true);
    const existing = cos.find(f=>f.filingType==="__notes__");
    const notesRecord = existing
      ? { ...existing, yearNotes:notes }
      : {
          filingId:"notes_"+company.name.replace(/\s/g,"_")+"_"+yearFilter,
          companyName:company.name, jurisdiction:company.jurisdiction,
          filingType:"__notes__", year:parseInt(yearFilter),
          status:"N/A", dueDate:"", steps:[], yearNotes:notes,
        };
    try {
      await apiWrite({ action:"saveComplianceFiling", filing:notesRecord });
      updateFiling(company.name, notesRecord);
      setNotesSaved(true);
      setTimeout(()=>setNotesSaved(false), 2000);
    } catch(e) { alert("Error saving notes: "+e.message); }
    setSavingNotes(false);
  };

  const realFilings = cos.filter(f=>f.filingType!=="__notes__");

  return (
    <div style={{ position:"fixed", top:54, right:0, bottom:0, width:"55%", maxWidth:820,
      background:C.card, borderLeft:"1px solid "+C.border, display:"flex", flexDirection:"column",
      zIndex:100, overflowY:"auto", boxShadow:"-8px 0 32px rgba(0,0,0,0.4)" }}>
      {/* Header */}
      <div style={{ padding:"16px 20px", borderBottom:"1px solid "+C.border,
        display:"flex", alignItems:"flex-start", gap:12, flexShrink:0,
        background:C.card2, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"Georgia,serif", fontSize:17, fontWeight:900,
            color:C.text, marginBottom:4 }}>{company.name}</div>
          <div style={{ display:"flex", gap:16, fontSize:11, color:C.text3, flexWrap:"wrap" }}>
            <span>{company.jurisdiction}</span>
            {company.registrationNumber && <span>#{company.registrationNumber}</span>}
            {company.clientEmail && <span>{company.clientEmail}</span>}
            {company.accounting && <span>Acct: {company.accounting}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none",
          cursor:"pointer", color:C.text3, fontSize:22, padding:"0 4px", flexShrink:0 }}>x</button>
      </div>

      <div style={{ padding:20, flex:1 }}>
        {/* Notes section */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, fontWeight:900, color:C.text3,
            textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>
            Notes — {yearFilter}
          </div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3}
            placeholder={"Add notes for "+company.name+" ("+yearFilter+")..."}
            style={{ width:"100%", background:C.inputBg, border:"1px solid "+C.border2,
              borderRadius:8, color:C.text, padding:"8px 10px", fontSize:12,
              fontFamily:"inherit", outline:"none", resize:"vertical",
              boxSizing:"border-box", lineHeight:1.6, marginBottom:8 }}/>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Btn size="sm" onClick={saveNotes} disabled={savingNotes}>
              {savingNotes?<><Spinner size={10} color="#fff"/>Saving...</>:"Save Notes"}
            </Btn>
            {notesSaved && <span style={{ fontSize:11, color:C.success }}>Saved ✓</span>}
          </div>
        </div>

        {/* Filings */}
        <div style={{ fontSize:11, fontWeight:900, color:C.text3,
          textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:12 }}>
          Filings — {yearFilter}
        </div>
        {realFilings.length===0 ? (
          <div style={{ textAlign:"center", padding:32, color:C.text3, fontSize:13 }}>
            No filings for {yearFilter} yet.
          </div>
        ) : realFilings.map(filing=>(
          <FilingCard key={filing.filingId} filing={filing} company={company}
            users={users} isAdmin={isAdmin} currentUserEmail={currentUserEmail}
            onUpdate={f=>updateFiling(company.name,f)}
            onEmail={f=>setEmailFiling(f)}/>
        ))}
      </div>

      {emailFiling && (
        <EmailModal filing={emailFiling} company={company}
          onClose={()=>setEmailFiling(null)}/>
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
  const [yearFilter,   setYearFilter]   = useState(String(CURRENT_YEAR));
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [jurFilter,    setJurFilter]    = useState("All");
  const [typeFilter,   setTypeFilter]   = useState("All");
  const [selectedCo,   setSelectedCo]   = useState(null);
  const [toast,        setToast]        = useState(null);
  const [yearMgr,      setYearMgr]      = useState(false);

  const isAdmin = currentUser && (
    ADMIN_EMAILS.includes((currentUser.email||"").toLowerCase()) ||
    currentUser.role==="admin" || currentUser.role==="editor"
  );

  const showToast = (msg, type="success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500);
  };

  const loadData = useCallback(async()=>{
    if (!clerkUser) return;
    setLoading(true);
    try {
      const email = (clerkUser.primaryEmailAddress?.emailAddress||"").toLowerCase();
      const [cd,ud,fd] = await Promise.all([
        apiRead("getCompanies"), apiRead("getUsers"), apiRead("getFilings",{year:yearFilter})
      ]);
      const ul = ud.users||[];
      const match = ul.find(u=>(u.email||"").toLowerCase()===email);
      setCurrentUser(match||{email,role:"viewer",name:clerkUser.fullName||email});
      setUsers(ul);
      setCompanies(cd.companies||[]);
      const fm={};
      (fd.filings||[]).forEach(f=>{ if(!fm[f.companyName])fm[f.companyName]=[]; fm[f.companyName].push(f); });
      setFilings(fm);
    } catch(e) { setError(e.message); }
    setLoading(false);
  },[clerkUser, yearFilter]);

  useEffect(()=>{ if(clerkUser) loadData(); },[clerkUser,loadData]);

  const updateFiling = (companyName, updatedFiling) => {
    setFilings(prev=>({
      ...prev,
      [companyName]:(prev[companyName]||[]).map(f=>f.filingId===updatedFiling.filingId?updatedFiling:f)
        .concat((prev[companyName]||[]).some(f=>f.filingId===updatedFiling.filingId)?[]:[updatedFiling])
    }));
  };

  // Stats
  const allFilings = Object.values(filings).flat()
    .filter(f=>String(f.year)===yearFilter && f.filingType!=="__notes__");
  const stats = {
    total:    allFilings.length,
    complete: allFilings.filter(f=>f.status==="Complete").length,
    overdue:  allFilings.filter(f=>f.status!=="Complete"&&daysUntil(f.dueDate)<0).length,
    dueSoon:  allFilings.filter(f=>f.status!=="Complete"&&daysUntil(f.dueDate)>=0&&daysUntil(f.dueDate)<=30).length,
  };

  // My tasks
  const myTasks = allFilings.flatMap(f=>
    (f.steps||[]).filter(s=>s.assignedTo===currentUser?.email&&s.status!=="Done")
      .map(s=>({...s, filing:f, company:companies.find(c=>c.name===f.companyName)}))
  ).sort((a,b)=>new Date(a.filing.dueDate)-new Date(b.filing.dueDate));

  // Jurisdiction options
  const jurOptions = ["All", ...new Set(companies.map(c=>c.jurisdiction).filter(Boolean))].sort();

  const getWorstStatus = (name) => {
    const cos = (filings[name]||[]).filter(f=>String(f.year)===yearFilter&&f.filingType!=="__notes__");
    if (!cos.length) return "No Filings";
    if (cos.some(f=>f.status!=="Complete"&&daysUntil(f.dueDate)<0)) return "Overdue";
    if (cos.every(f=>f.status==="Complete")) return "Complete";
    if (cos.some(f=>f.status==="Waiting Client")) return "Waiting Client";
    if (cos.some(f=>f.status==="In Progress"))    return "In Progress";
    return "Not Started";
  };

  const visibleCompanies = companies.filter(c=>{
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (jurFilter!=="All" && c.jurisdiction!==jurFilter) return false;
    if (typeFilter!=="All") {
      const types = getFilingTypes(c.jurisdiction);
      if (!types.includes(typeFilter)) return false;
    }
    if (statusFilter==="All") return true;
    const ws = getWorstStatus(c.name);
    if (statusFilter==="No Filings") return ws==="No Filings";
    return ws===statusFilter;
  });

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:C.bg }}>
      <Spinner size={32}/>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", background:C.bg, flexDirection:"column", gap:12 }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <p style={{ fontSize:15, fontWeight:700, color:C.text }}>Could not connect</p>
      <p style={{ fontSize:13, color:C.text3 }}>{error}</p>
      <Btn onClick={loadData}>Retry</Btn>
    </div>
  );

  const panelOpen = !!selectedCo;

  return (
    <div style={{ minHeight:"100vh", background:C.bg,
      fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      color:C.text }}>

      {/* Header */}
      <div style={{ background:"#000", borderBottom:"1px solid "+C.border,
        padding:"0 20px", display:"flex", alignItems:"center", gap:12, height:54,
        position:"sticky", top:0, zIndex:200 }}>
        <span style={{ fontFamily:"Georgia,serif", fontWeight:900, fontSize:15, color:C.text }}>
          Compliance Tracker
        </span>
        <span style={{ color:C.border2 }}>|</span>
        <span style={{ fontSize:11, color:C.text3 }}>Westchester International</span>
        <div style={{ flex:1 }}/>

        {/* Year selector */}
        <select value={yearFilter} onChange={e=>{setYearFilter(e.target.value);setSelectedCo(null);}}
          style={{ background:"#111", color:C.text, border:"1px solid "+C.border2,
            borderRadius:7, padding:"4px 10px", fontSize:12, fontWeight:700, outline:"none" }}>
          {[CURRENT_YEAR+1,CURRENT_YEAR,CURRENT_YEAR-1,CURRENT_YEAR-2].map(y=>(
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {isAdmin && (
          <Btn size="sm" variant="secondary" onClick={()=>setYearMgr(true)}>
            🗓 Manage Years
          </Btn>
        )}

        <UserButton/>
      </div>

      {/* Stats bar */}
      <div style={{ background:"#111", borderBottom:"1px solid "+C.border,
        padding:"10px 20px", display:"flex", gap:20 }}>
        {[
          { label:"Total",    value:stats.total,    color:C.accent },
          { label:"Complete", value:stats.complete, color:C.success },
          { label:"Overdue",  value:stats.overdue,  color:C.danger },
          { label:"Due Soon", value:stats.dueSoon,  color:C.warning },
          { label:"My Tasks", value:myTasks.length, color:"#a78bfa" },
        ].map(s=>(
          <div key={s.label} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:18, fontWeight:900, color:s.color }}>{s.value}</span>
            <span style={{ fontSize:11, color:C.text3 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ display:"flex", height:"calc(100vh - 104px)" }}>

        {/* Company list */}
        <div style={{ flex:1, overflowY:"auto", transition:"all 0.3s" }}>
          {/* Filters */}
          <div style={{ padding:"12px 16px", borderBottom:"1px solid "+C.border,
            display:"flex", gap:8, flexWrap:"wrap", alignItems:"center",
            background:C.card, position:"sticky", top:0, zIndex:10 }}>
            <div style={{ position:"relative", flex:"1 1 180px", maxWidth:240 }}>
              <span style={{ position:"absolute", left:8, top:"50%",
                transform:"translateY(-50%)", color:C.text3, fontSize:12 }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Search companies..."
                style={{ width:"100%", background:C.inputBg, border:"1px solid "+C.border2,
                  borderRadius:7, color:C.text, padding:"6px 8px 6px 26px",
                  fontSize:12, outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}/>
            </div>
            {[
              ["statusFilter",statusFilter,setStatusFilter,["All",...FILING_STATUSES,"No Filings","Overdue"],"Status"],
              ["jurFilter",jurFilter,setJurFilter,jurOptions,"Jurisdiction"],
              ["typeFilter",typeFilter,setTypeFilter,["All",...ALL_FILING_TYPES],"Filing Type"],
            ].map(([key,val,setter,opts,label])=>(
              <select key={key} value={val} onChange={e=>setter(e.target.value)}
                style={{ background:C.inputBg, border:"1px solid "+C.border2, borderRadius:7,
                  color:C.text, padding:"6px 9px", fontSize:12, outline:"none" }}>
                {opts.map(o=><option key={o} value={o}>{o==="All"?label+": All":o}</option>)}
              </select>
            ))}
            <span style={{ fontSize:11, color:C.text3, marginLeft:"auto" }}>
              {visibleCompanies.length} companies
            </span>
          </div>

          {/* Column headers */}
          <div style={{ display:"grid",
            gridTemplateColumns: panelOpen ? "2fr 1fr 1fr 100px" : "2fr 1fr 1fr 1fr 120px 100px",
            padding:"7px 16px", background:"#111", borderBottom:"1px solid "+C.border,
            position:"sticky", top:53, zIndex:9 }}>
            {(panelOpen
              ? ["Company","Jurisdiction","Status","Next"]
              : ["Company","Jurisdiction","Filing Types","Status","Next Responsible","Actions"]
            ).map(h=>(
              <span key={h} style={{ fontSize:10, fontWeight:900, color:C.text3,
                textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {visibleCompanies.length===0 ? (
            <div style={{ padding:48, textAlign:"center", color:C.text3, fontSize:13 }}>
              No companies match your filters.
            </div>
          ) : visibleCompanies.map(c=>{
            const ws = getWorstStatus(c.name);
            const next = getNextResponsible(c.name, filings, yearFilter, users);
            const isSelected = selectedCo?.name===c.name;
            const rowBg = isSelected ? "#1e1b4b" : "transparent";

            return (
              <div key={c.name}
                onClick={()=>setSelectedCo(isSelected?null:c)}
                style={{ display:"grid",
                  gridTemplateColumns:panelOpen?"2fr 1fr 1fr 100px":"2fr 1fr 1fr 1fr 120px 100px",
                  padding:"10px 16px", borderBottom:"1px solid "+C.border,
                  cursor:"pointer", background:rowBg, transition:"background 0.1s" }}
                onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background=C.card2; }}
                onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.background="transparent"; }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:C.text }}>{c.name}</div>
                  {c.clientEmail && <div style={{ fontSize:11, color:C.text3 }}>{c.clientEmail}</div>}
                </div>
                <div style={{ fontSize:12, color:C.text2, display:"flex", alignItems:"center" }}>
                  {c.jurisdiction}
                </div>
                {!panelOpen && (
                  <div style={{ display:"flex", flexDirection:"column", gap:3, justifyContent:"center" }}>
                    {getFilingTypes(c.jurisdiction).map(ft=>(
                      <span key={ft} style={{ fontSize:10, background:C.card2, color:C.text3,
                        borderRadius:4, padding:"1px 6px", display:"inline-block" }}>{ft}</span>
                    ))}
                  </div>
                )}
                <div style={{ display:"flex", alignItems:"center" }}>
                  <Badge status={ws}/>
                </div>
                {!panelOpen && (
                  <div style={{ display:"flex", flexDirection:"column", justifyContent:"center" }}>
                    {next ? (
                      <>
                        <span style={{ fontSize:12, fontWeight:700, color:C.accent }}>{next.name}</span>
                        <span style={{ fontSize:10, color:C.text3,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          maxWidth:110 }}>{next.step}</span>
                      </>
                    ) : ws==="Complete" ? (
                      <span style={{ fontSize:11, color:C.success }}>Complete ✓</span>
                    ) : (
                      <span style={{ fontSize:11, color:C.text3 }}>Unassigned</span>
                    )}
                  </div>
                )}
                {!panelOpen && (
                  <div style={{ display:"flex", alignItems:"center" }}>
                    <span style={{ fontSize:11, color:C.accent }}>View →</span>
                  </div>
                )}
                {panelOpen && (
                  <div style={{ display:"flex", flexDirection:"column", justifyContent:"center" }}>
                    {next ? (
                      <span style={{ fontSize:11, fontWeight:700, color:C.accent }}>{next.name}</span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Side Panel */}
        {selectedCo && (
          <SidePanel
            company={selectedCo}
            filings={filings}
            users={users}
            isAdmin={isAdmin}
            currentUserEmail={currentUser?.email}
            yearFilter={yearFilter}
            onClose={()=>setSelectedCo(null)}
            updateFiling={updateFiling}
          />
        )}
      </div>

      {/* Year Manager Modal */}
      {yearMgr && (
        <YearManager
          companies={companies}
          filings={filings}
          setFilings={setFilings}
          yearFilter={yearFilter}
          setYearFilter={setYearFilter}
          onClose={()=>setYearMgr(false)}
          showToast={showToast}/>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:20, right:20, zIndex:9999,
          background:toast.type==="error"?C.danger:C.success,
          color:"#fff", borderRadius:10, padding:"10px 18px",
          fontSize:13, fontWeight:700, boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>
          {toast.msg}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}`}</style>
    </div>
  );
}
