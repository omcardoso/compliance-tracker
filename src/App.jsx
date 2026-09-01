import React, { useState, useEffect, useCallback } from "react";
import { SignedIn, SignedOut, SignIn, useUser, UserButton } from "@clerk/clerk-react";
import { db, fbGetFilings, fbSaveFiling, fbDeleteFiling, fbDeleteYear, fbGetTemplates, fbSaveTemplate } from "./firebase.js";

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
  return US_STATES.some(s => j.toLowerCase().includes(s));
}
function getFilingTypes(jurisdiction) {
  if (!jurisdiction) return [];
  const j = jurisdiction.toLowerCase();
  if (isUSJurisdiction(jurisdiction)) return ["Tax Return"];
  if (j.includes("bvi") || j.includes("british virgin")) return ["Economic Substance", "Annual Return"];
  return ["Economic Substance"];
}
function getTemplateKey(filingType, jurisdiction) {
  const j = (jurisdiction||"").toLowerCase();
  if (filingType === "Economic Substance") {
    if (j.includes("bvi") || j.includes("british virgin")) return "Economic Substance_BVI";
    if (j.includes("panama")) return "Economic Substance_Panama";
  }
  return filingType;
}
function getStepNames(filingType, jurisdiction) {
  const key = getTemplateKey(filingType, jurisdiction);
  const steps = DEFAULT_STEPS[key] || DEFAULT_STEPS[filingType] || [];
  return steps.map(s => typeof s === "string" ? s : s.name);
}

// Step definitions with default assignments
// assignedTo: "" = unassigned, "__client__" = client, email = specific user
const OCTAVIO  = "omcardoso@gmail.com";
const FERNANDO = "gataxservicescorp@gmail.com";
const KARINA   = "meloatwork@gmail.com";

const DEFAULT_STEPS = {
  "Economic Substance": [
    {name:"Send Google Form link to client", assignedTo:OCTAVIO},
    {name:"Client submitted form",           assignedTo:"__client__"},
    {name:"Prepare Economic Substance declaration", assignedTo:FERNANDO},
    {name:"Declaration filed",               assignedTo:FERNANDO},
  ],
  "Economic Substance_BVI": [
    {name:"Send Google Form link to client", assignedTo:OCTAVIO},
    {name:"Client submitted form",           assignedTo:"__client__"},
    {name:"Prepare Economic Substance declaration", assignedTo:FERNANDO},
    {name:"Declaration filed",               assignedTo:FERNANDO},
    {name:"Financial Reports filed",         assignedTo:FERNANDO},
  ],
  "Economic Substance_Panama": [
    {name:"Send Google Form link to client", assignedTo:OCTAVIO},
    {name:"Client submitted form",           assignedTo:"__client__"},
    {name:"Prepare Economic Substance declaration", assignedTo:FERNANDO},
    {name:"Declaration filed",               assignedTo:FERNANDO},
    {name:"Financial Reports filed",         assignedTo:FERNANDO},
  ],
  "Annual Return": [
    {name:"Send balance sheet request to client", assignedTo:OCTAVIO},
    {name:"Balance sheet received from client",   assignedTo:"__client__"},
    {name:"Prepare Annual Financial Report (AFR)",assignedTo:FERNANDO},
    {name:"AFR submitted",                        assignedTo:FERNANDO},
    {name:"Financial Reports filed",              assignedTo:FERNANDO},
  ],
  "Tax Return": [
    {name:"Send Information request Letter",                      assignedTo:OCTAVIO},
    {name:"Bank Statements received",                             assignedTo:"__client__"},
    {name:"Mortgage statement Received",                          assignedTo:"__client__"},
    {name:"Property Management Statement received",               assignedTo:"__client__"},
    {name:"HUD Received (if new purchase made)",                  assignedTo:"__client__"},
    {name:"Information on Financial Transactions with Shareholders", assignedTo:"__client__"},
    {name:"Property Tax Information Received",                    assignedTo:"__client__"},
    {name:"Prepare Bookkeeping",                                  assignedTo:OCTAVIO},
    {name:"Upload reports",                                       assignedTo:OCTAVIO},
    {name:"Fernando prepared Tax return",                         assignedTo:FERNANDO},
    {name:"Sent Return to client for signature",                  assignedTo:KARINA},
    {name:"Received signed returns forms from client",            assignedTo:"__client__"},
    {name:"Send sign returns to Fernando",                        assignedTo:OCTAVIO},
    {name:"Return Filed",                                         assignedTo:FERNANDO},
  ],
};

const EMAIL_TEMPLATES = {
  "Economic Substance": {
    subject: "URGENTE - {{companyName}} - Informacao para declaracao Anual de Substancia economica",
    body: `IMPORTANTE O prazo para o envio das informacoes preenchidas e ate 30 de Junho.\n\nPrezado(a) Cliente,\n\nComo parte dos esforcos continuos para cumprir os requisitos regulatorios de substancia economica, solicitamos sua colaboracao no preenchimento anual do formulario sobre a empresa/entidade abaixo atraves deste link:\n\nhttps://docs.google.com/forms/d/e/1FAIpQLScEozxzdQyJDo90HNbtmIweKtlEM_fDO4jZhlTUWcL99ugCMg/viewform?usp=publish-editor\n\nEmpresa: {{companyName}}\nPais de Incorporacao: {{jurisdiction}}\nNumero de Registro: {{registrationNumber}}\n\nOctavio Cardoso\nPresident - Westchester International LLC`,
  },
  "Tax Return": {
    subject: "{{companyName}} Declaracao de Renda - Follow up",
    body: `Prezado Cliente,\n\nSe o senhor(a) esta recebendo esse email e porque nao recebemos ate esse momento as informacoes Completas para poder preparar a declaracao de renda da sua empresa para {{year}}.\n\nPara declaracao de renda, solicitamos o envio das demonstracoes financeiras do ano de {{year}} atraves de uma planilha ou extratos bancarios.\n\nE crucial recebermos todas as informacoes ate dia 30 de junho de {{year}}.\n\nOctavio Cardoso\nPresident - Westchester International LLC`,
  },
  "Annual Return": {
    subject: "{{companyName}} Declaracao Anual - BVI",
    body: `Prezado cliente,\n\nGostariamos de lembra-lo sobre a obrigacao anual de apresentacao da Declaracao Financeira Anual (AFR) para todas as empresas com sede em British Virgin Islands (BVI).\n\nSolicitamos o envio do balanco contabil da sua empresa referente ao ano fiscal de {{year}} o mais breve possivel.\n\nOctavio Cardoso\nPresident - Westchester International LLC`,
  },
};

const STEP_STATUSES   = ["Pending","In Progress","Waiting Client","Done"];
const FILING_STATUSES = ["Not Started","In Progress","Waiting Client","Complete"];
const ALL_FILING_TYPES = ["Tax Return","Economic Substance","Annual Return"];
const STATUS_ORDER = { "Overdue":0,"Waiting Client":1,"In Progress":2,"Not Started":3,"No Filings":4,"Complete":5 };

const C = {
  bg:"#0d0d0d",card:"#1a1a1a",card2:"#222222",border:"#2d2d2d",border2:"#383838",
  text:"#f1f5f9",text2:"#94a3b8",text3:"#475569",accent:"#6366f1",
  success:"#10b981",warning:"#f59e0b",danger:"#ef4444",inputBg:"#242424",
};
const STATUS_STYLES = {
  "Not Started":{bg:"#1e293b",color:"#cbd5e1"},"In Progress":{bg:"#1e3a5f",color:"#93c5fd"},
  "Waiting Client":{bg:"#422006",color:"#fcd34d"},"Complete":{bg:"#052e16",color:"#6ee7b7"},
  "Pending":{bg:"#1e293b",color:"#cbd5e1"},"Done":{bg:"#052e16",color:"#6ee7b7"},
  "Overdue":{bg:"#450a0a",color:"#fca5a5"},"No Filings":{bg:"#1e293b",color:"#475569"},
};

// ─── API ─────────────────────────────────────────────────────────────────────
async function apiRead(action, params={}) {
  const qs=new URLSearchParams({action,...params}).toString();
  const res=await fetch("/api/data?"+qs);
  if(!res.ok) throw new Error("HTTP "+res.status);
  return res.json();
}
async function apiWrite(body) {
  const res=await fetch(SCRIPT_URL,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(body)});
  if(!res.ok) throw new Error("HTTP "+res.status);
  return res.json();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDueDate(ft,year) {
  return {"Economic Substance":year+"-06-30","Annual Return":year+"-09-30","Tax Return":year+"-10-15"}[ft]||year+"-12-31";
}
function daysUntil(d) {
  if(!d) return null;
  const t=new Date(); t.setHours(0,0,0,0);
  return Math.round((new Date(d)-t)/86400000);
}
function fmtDate(d) {
  if(!d) return "";
  return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function fill(str,vars) {
  return Object.entries(vars).reduce((s,[k,v])=>s.replaceAll("{{"+k+"}}",v||""),str||"");
}
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function recalcStatus(steps) {
  if(!steps.length) return "Not Started";
  if(steps.every(s=>s.status==="Done")) return "Complete";
  if(steps.some(s=>s.status==="Waiting Client")) return "Waiting Client";
  if(steps.some(s=>s.status==="In Progress")) return "In Progress";
  return "Not Started";
}
function getNextResponsible(companyName,filings,year,users) {
  const cos=(filings[companyName]||[]).filter(f=>String(f.year)===year&&f.status!=="Complete"&&f.filingType!=="__notes__");
  for(const f of cos){
    const next=(f.steps||[]).find(s=>s.status!=="Done"&&s.assignedTo);
    if(next){
      if(next.assignedTo==="__client__") return {name:"Client",step:next.stepName};
      const u=users.find(u=>u.email===next.assignedTo);
      return {name:u?u.name.split(" ")[0]:next.assignedTo.split("@")[0],step:next.stepName};
    }
  }
  return null;
}
function getStepsFromTemplates(filingType,jurisdiction,templates) {
  const key=getTemplateKey(filingType,jurisdiction);
  // Templates stored in Firestore are plain string arrays (user-customized)
  if(templates[key]) return templates[key].map(s=>typeof s==="string"?{name:s,assignedTo:""}:s);
  if(templates[filingType]) return templates[filingType].map(s=>typeof s==="string"?{name:s,assignedTo:""}:s);
  return DEFAULT_STEPS[key]||DEFAULT_STEPS[filingType]||[];
}

// ─── UI Components ───────────────────────────────────────────────────────────
function Spinner({size=18,color=C.accent}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{animation:"spin 0.8s linear infinite",display:"inline-block",flexShrink:0}}><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeDasharray="40 20"/></svg>;
}
function Badge({status}) {
  const s=STATUS_STYLES[status]||STATUS_STYLES["Not Started"];
  return <span style={{background:s.bg,color:s.color,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800,whiteSpace:"nowrap"}}>{status}</span>;
}
function DaysBadge({days}) {
  if(days===null||days===undefined) return null;
  let bg,color,label;
  if(days<0){bg="#450a0a";color="#fca5a5";label=Math.abs(days)+"d overdue";}
  else if(days<=14){bg="#422006";color="#fcd34d";label=days+"d left";}
  else if(days<=60){bg="#1e3a5f";color="#93c5fd";label=days+"d left";}
  else{bg="#052e16";color="#34d399";label=days+"d left";}
  return <span style={{background:bg,color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:800,whiteSpace:"nowrap"}}>{label}</span>;
}
function Btn({onClick,disabled,children,variant="primary",size="md",style={}}) {
  const base={border:"none",borderRadius:7,cursor:disabled?"default":"pointer",fontWeight:800,display:"inline-flex",alignItems:"center",gap:6,fontFamily:"inherit",opacity:disabled?0.5:1,...style};
  const v={primary:{background:C.accent,color:"#fff",fontSize:size==="sm"?11:13,padding:size==="sm"?"4px 10px":"8px 18px"},secondary:{background:C.card2,color:C.text2,fontSize:size==="sm"?11:13,padding:size==="sm"?"4px 10px":"8px 18px",border:"1px solid "+C.border2},danger:{background:"#450a0a",color:"#fca5a5",fontSize:size==="sm"?11:13,padding:size==="sm"?"4px 10px":"8px 18px"},ghost:{background:"none",color:C.text2,fontSize:size==="sm"?11:13,padding:size==="sm"?"4px 8px":"6px 12px"}};
  return <button onClick={!disabled?onClick:undefined} disabled={disabled} style={{...base,...v[variant]}}>{children}</button>;
}
function Modal({title,onClose,children,width=640}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,borderRadius:14,width:"100%",maxWidth:width,maxHeight:"90vh",display:"flex",flexDirection:"column",border:"1px solid "+C.border,boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <span style={{flex:1,fontFamily:"Georgia,serif",fontWeight:900,fontSize:16,color:C.text}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.text3,fontSize:20,padding:"0 4px"}}>x</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:20}}>{children}</div>
      </div>
    </div>
  );
}

// ─── Scope Choice Modal ───────────────────────────────────────────────────────
function ScopeModal({title,description,confirmLabel,onConfirm,onClose,filingType}) {
  const [scope,setScope]=useState("this");
  const radio={display:"flex",alignItems:"flex-start",gap:10,padding:"12px 14px",borderRadius:9,cursor:"pointer",border:"1px solid "+C.border,marginBottom:8,background:C.card2};
  return (
    <Modal title={title} onClose={onClose} width={480}>
      <p style={{fontSize:13,color:C.text3,marginBottom:16,lineHeight:1.5}}>{description}</p>
      <div onClick={()=>setScope("this")} style={{...radio,borderColor:scope==="this"?C.accent:C.border,background:scope==="this"?"#1e1b4b":C.card2}}>
        <div style={{width:16,height:16,borderRadius:"50%",border:"2px solid "+(scope==="this"?C.accent:C.border2),background:scope==="this"?C.accent:"transparent",flexShrink:0,marginTop:1}}/>
        <div>
          <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:2}}>This filing only</div>
          <div style={{fontSize:11,color:C.text3}}>Applies to this company's current filing. Does not affect other companies or future filings.</div>
        </div>
      </div>
      <div onClick={()=>setScope("permanent")} style={{...radio,borderColor:scope==="permanent"?C.accent:C.border,background:scope==="permanent"?"#1e1b4b":C.card2}}>
        <div style={{width:16,height:16,borderRadius:"50%",border:"2px solid "+(scope==="permanent"?C.accent:C.border2),background:scope==="permanent"?C.accent:"transparent",flexShrink:0,marginTop:1}}/>
        <div>
          <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:2}}>Permanently for all future {filingType} filings</div>
          <div style={{fontSize:11,color:C.text3}}>Updates the template. All future companies of this type will include this change.</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={()=>onConfirm(scope)}>{confirmLabel}</Btn>
      </div>
    </Modal>
  );
}

// ─── Email Modal ──────────────────────────────────────────────────────────────
function EmailModal({filing,company,onClose}) {
  const taxYr=String((filing.year||CURRENT_YEAR)-1);
  const tmpl=EMAIL_TEMPLATES[filing.filingType]||{};
  const vars={companyName:company.name||"",jurisdiction:company.jurisdiction||"",registrationNumber:company.registrationNumber||"",year:taxYr};
  const [to,setTo]=useState(company.clientEmail||"");
  const [subject,setSubject]=useState(fill(tmpl.subject||"",vars));
  const [body,setBody]=useState(fill(tmpl.body||"",vars));
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const inp={width:"100%",background:C.inputBg,border:"1px solid "+C.border2,borderRadius:7,color:C.text,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  const send=async()=>{if(!to.trim()){alert("Enter recipient email.");return;}setSending(true);try{await apiWrite({action:"sendComplianceEmail",to,subject,body});setSent(true);setTimeout(onClose,1800);}catch(e){alert("Error: "+e.message);}setSending(false);};
  return (
    <Modal title={"Send Email \u2014 "+filing.filingType} onClose={onClose} width={700}>
      {sent?<div style={{textAlign:"center",padding:40}}><div style={{fontSize:48,marginBottom:12}}>✓</div><p style={{fontSize:15,fontWeight:700,color:C.success}}>Email sent!</p></div>:(
        <div>
          {[["To",to,setTo],["Subject",subject,setSubject]].map(([label,val,setter])=>(
            <div key={label} style={{marginBottom:12}}><label style={{fontSize:10,fontWeight:800,color:C.text3,textTransform:"uppercase",display:"block",marginBottom:3}}>{label}</label><input value={val} onChange={e=>setter(e.target.value)} style={inp}/></div>
          ))}
          <div style={{marginBottom:16}}><label style={{fontSize:10,fontWeight:800,color:C.text3,textTransform:"uppercase",display:"block",marginBottom:3}}>Body</label><textarea value={body} onChange={e=>setBody(e.target.value)} rows={12} style={{...inp,resize:"vertical",lineHeight:1.6}}/></div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={send} disabled={sending||!to.trim()}>{sending?<><Spinner size={13} color="#fff"/>Sending...</>:"Send Email"}</Btn></div>
        </div>
      )}
    </Modal>
  );
}

// ─── Step Row ─────────────────────────────────────────────────────────────────
function StepRow({step,users,isAdmin,currentUserEmail,onUpdate,onDelete}) {
  const [editing,setEditing]=useState(false);
  const [status,setStatus]=useState(step.status||"Pending");
  const [notes,setNotes]=useState(step.notes||"");
  const [assignedTo,setAssignedTo]=useState(step.assignedTo||"");
  const [saving,setSaving]=useState(false);
  const [hovered,setHovered]=useState(false);
  const canEdit=isAdmin||currentUserEmail===step.assignedTo;
  const isDone=step.status==="Done";
  // Defensive: stepName might be an object if created with old buggy code
  const stepName = typeof step.stepName==="string" ? step.stepName : (step.stepName?.name||"(unnamed step)");
  const sel={background:C.inputBg,border:"1px solid "+C.border2,borderRadius:7,color:C.text,padding:"5px 8px",fontSize:12,outline:"none",width:"100%"};
  const assignLabel=step.assignedTo==="__client__"?"Client":(users.find(u=>u.email===step.assignedTo)||{}).name?.split(" ")[0]||step.assignedTo?.split("@")[0];

  const quickToggle=()=>{if(!canEdit)return;onUpdate({...step,status:isDone?"Pending":"Done",completedAt:isDone?"":new Date().toISOString()});};
  const save=async()=>{setSaving(true);onUpdate({...step,status,notes,assignedTo,completedAt:status==="Done"?(step.completedAt||new Date().toISOString()):""});setEditing(false);setSaving(false);};

  return (
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{padding:"9px 14px",borderBottom:"1px solid "+C.border,background:isDone?"#0d1f13":"transparent"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div onClick={quickToggle} style={{width:18,height:18,borderRadius:4,flexShrink:0,cursor:canEdit?"pointer":"default",background:isDone?C.success:"transparent",border:"2px solid "+(isDone?C.success:C.border2),display:"flex",alignItems:"center",justifyContent:"center"}}>
          {isDone&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
        </div>
        <span style={{flex:1,fontSize:12,fontWeight:600,color:isDone?C.text3:C.text,textDecoration:isDone?"line-through":"none"}}>{stepName}</span>
        {step.assignedTo&&<span style={{fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px",color:step.assignedTo==="__client__"?"#34d399":C.accent,background:step.assignedTo==="__client__"?"#052e16":"#1e1b4b"}}>{assignLabel}</span>}
        {!editing&&<Badge status={step.status||"Pending"}/>}
        {canEdit&&!editing&&<button onClick={()=>setEditing(true)} style={{background:"none",border:"none",cursor:"pointer",color:C.text3,fontSize:14,padding:"0 3px"}}>✏</button>}
        {isAdmin&&hovered&&!editing&&(
          <button onClick={()=>onDelete(step)} title="Remove step"
            style={{background:"none",border:"none",cursor:"pointer",color:C.danger,fontSize:16,padding:"0 3px",lineHeight:1}}>×</button>
        )}
      </div>
      {step.notes&&!editing&&<div style={{marginTop:3,marginLeft:28,fontSize:11,color:C.text3,fontStyle:"italic"}}>{step.notes}</div>}
      {editing&&(
        <div style={{marginTop:10,padding:12,background:C.card2,borderRadius:8,border:"1px solid "+C.border}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
            {isAdmin&&<div style={{flex:"1 1 160px"}}><label style={{fontSize:10,fontWeight:800,color:C.text3,textTransform:"uppercase",display:"block",marginBottom:3}}>Assign to</label>
              <select value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} style={sel}>
                <option value="">Unassigned</option>
                <option value="__client__">Client</option>
                {users.map(u=><option key={u.id} value={u.email}>{u.name}</option>)}
              </select></div>}
            <div style={{flex:"1 1 130px"}}><label style={{fontSize:10,fontWeight:800,color:C.text3,textTransform:"uppercase",display:"block",marginBottom:3}}>Status</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={sel}>
                {STEP_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
              </select></div>
          </div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Notes..."
            style={{width:"100%",background:C.inputBg,border:"1px solid "+C.border2,borderRadius:7,color:C.text,padding:"6px 8px",fontSize:12,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box",marginBottom:8}}/>
          <div style={{display:"flex",gap:6}}><Btn variant="secondary" size="sm" onClick={()=>setEditing(false)}>Cancel</Btn><Btn size="sm" onClick={save} disabled={saving}>{saving?<><Spinner size={10} color="#fff"/>Saving...</>:"Save"}</Btn></div>
        </div>
      )}
    </div>
  );
}

// ─── Filing Card ──────────────────────────────────────────────────────────────
function FilingCard({filing,company,users,isAdmin,currentUserEmail,onUpdate,onEmail,templates,onUpdateTemplate}) {
  const [steps,setSteps]=useState(filing.steps||[]);
  const [expanded,setExpanded]=useState(true);
  const [filingStatus,setFilingStatus]=useState(filing.status||"Not Started");
  const [addingStep,setAddingStep]=useState(false);
  const [newStepName,setNewStepName]=useState("");
  const [scopeModal,setScopeModal]=useState(null);
  const [dragOverId,setDragOverId]=useState(null);
  const dragIdRef=React.useRef(null);

  const handleDragStart=(e,step)=>{ dragIdRef.current=step.stepId; e.dataTransfer.effectAllowed="move"; };
  const handleDragOver=(e,step)=>{ e.preventDefault(); setDragOverId(step.stepId); };
  const handleDragLeave=()=>setDragOverId(null);
  const handleDrop=async(e,targetStep)=>{
    e.preventDefault();
    const draggedId=dragIdRef.current;
    setDragOverId(null);
    if(!draggedId||draggedId===targetStep.stepId) return;
    const draggedIdx=steps.findIndex(s=>s.stepId===draggedId);
    const targetIdx=steps.findIndex(s=>s.stepId===targetStep.stepId);
    const ns=[...steps];
    const [removed]=ns.splice(draggedIdx,1);
    ns.splice(targetIdx,0,removed);
    ns.forEach((s,i)=>{ s.order=i; });
    const st=recalcStatus(ns);
    const upd={...filing,status:st,steps:ns};
    setSteps(ns);setFilingStatus(st);
    await fbSaveFiling(upd);
    onUpdate(upd);
  }; // {type:"add"|"delete", step?, name?}
  const days=daysUntil(filing.dueDate);
  const done=steps.filter(s=>s.status==="Done").length;
  const pct=steps.length?Math.round((done/steps.length)*100):0;
  const templateKey=getTemplateKey(filing.filingType,filing.jurisdiction);

  const getCurrentTemplateSteps=()=>{
    const raw = templates[templateKey]||templates[filing.filingType]||DEFAULT_STEPS[templateKey]||DEFAULT_STEPS[filing.filingType]||[];
    return raw.map(s=>typeof s==="string"?s:s.name);
  };

  const updateStep=async(updated)=>{
    const prevStep=steps.find(s=>s.stepId===updated.stepId);
    const ns=steps.map(s=>s.stepId===updated.stepId?updated:s);
    const st=recalcStatus(ns);
    const upd={...filing,status:st,steps:ns};
    setSteps(ns);setFilingStatus(st);
    await fbSaveFiling(upd);
    onUpdate(upd);
    // Send email if step newly assigned to a real user
    if(updated.assignedTo && updated.assignedTo!=="__client__" && updated.assignedTo!==prevStep?.assignedTo){
      const assignedUser=users.find(u=>u.email===updated.assignedTo);
      if(assignedUser){
        const nl="\n";
        const subj="New task assigned: "+updated.stepName;
        const body="Hi "+assignedUser.name+","+nl+nl+"You have been assigned a new compliance task:"+nl+nl+
          "Task: "+updated.stepName+nl+
          "Entity: "+company.name+nl+
          "Jurisdiction: "+company.jurisdiction+nl+
          "Filing: "+filing.filingType+nl+
          "Due date: "+filing.dueDate+nl+nl+
          "Please log in to the Compliance Tracker to update the status."+nl+nl+
          "Westchester International LLC";
        try{await apiWrite({action:"sendComplianceEmail",to:updated.assignedTo,subject:subj,body});}catch(e){}
      }
    }
  };

  const handleAddStep=()=>{
    if(!newStepName.trim()) return;
    setScopeModal({type:"add",name:newStepName.trim()});
    setAddingStep(false);
    setNewStepName("");
  };

  const confirmAdd=async(scope)=>{
    const name=scopeModal.name;
    const newStep={stepId:uid(),stepName:name,assignedTo:"",status:"Pending",notes:"",completedAt:"",order:steps.length};
    const ns=[...steps,newStep];
    const st=recalcStatus(ns);
    const upd={...filing,status:st,steps:ns};
    setSteps(ns);setFilingStatus(st);
    await fbSaveFiling(upd);
    onUpdate(upd);
    if(scope==="permanent"){
      const tmplSteps=[...getCurrentTemplateSteps(),name];
      await fbSaveTemplate(templateKey,tmplSteps);
      if(onUpdateTemplate) onUpdateTemplate(templateKey,tmplSteps);
    }
    setScopeModal(null);
  };

  const handleDeleteStep=(step)=>{
    setScopeModal({type:"delete",step});
  };

  const confirmDelete=async(scope)=>{
    const stepId=scopeModal.step.stepId;
    const stepName=scopeModal.step.stepName;
    const ns=steps.filter(s=>s.stepId!==stepId);
    const st=recalcStatus(ns);
    const upd={...filing,status:st,steps:ns};
    setSteps(ns);setFilingStatus(st);
    await fbSaveFiling(upd);
    onUpdate(upd);
    if(scope==="permanent"){
      const tmplSteps=getCurrentTemplateSteps().filter(s=>s!==stepName);
      await fbSaveTemplate(templateKey,tmplSteps);
      if(onUpdateTemplate) onUpdateTemplate(templateKey,tmplSteps);
    }
    setScopeModal(null);
  };

  return (
    <>
    <div style={{border:"1px solid "+C.border,borderRadius:10,overflow:"hidden",marginBottom:10}}>
      <div style={{padding:"11px 14px",background:C.card2,display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>setExpanded(v=>!v)}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
            <span style={{fontWeight:800,fontSize:13,color:C.text}}>{filing.filingType}</span>
            <Badge status={filingStatus}/>
            {filingStatus!=="Complete"&&<DaysBadge days={days}/>}
          </div>
          <div style={{fontSize:11,color:C.text3}}>Due: {fmtDate(filing.dueDate)} &middot; Tax Year {String(parseInt(filing.year)-1)} &middot; {done}/{steps.length} steps</div>
          <div style={{marginTop:5,height:3,background:C.border,borderRadius:2}}>
            <div style={{width:pct+"%",height:"100%",borderRadius:2,background:pct===100?C.success:C.accent,transition:"width 0.3s"}}/>
          </div>
        </div>
        {isAdmin&&<Btn size="sm" onClick={e=>{e.stopPropagation();onEmail(filing);}}>✉ Email</Btn>}
        <span style={{color:C.text3,fontSize:11,transform:expanded?"rotate(180deg)":"none",transition:"transform 0.2s",display:"inline-block"}}>▼</span>
      </div>
      {expanded&&(
        <>
          {steps.map(step=>(
            <div key={step.stepId}
              draggable={isAdmin}
              onDragStart={e=>handleDragStart(e,step)}
              onDragOver={e=>handleDragOver(e,step)}
              onDragLeave={handleDragLeave}
              onDrop={e=>handleDrop(e,step)}
              style={{
                borderTop:dragOverId===step.stepId?"2px solid "+C.accent:"2px solid transparent",
                transition:"border-color 0.1s",
                cursor:isAdmin?"grab":"default",
                background:dragOverId===step.stepId?"#1e1b4b":"transparent"
              }}>
              <StepRow step={step} users={users} isAdmin={isAdmin}
                currentUserEmail={currentUserEmail} onUpdate={updateStep} onDelete={handleDeleteStep}/>
            </div>
          ))}
          {/* Add step row */}
          {isAdmin&&(
            <div style={{padding:"8px 14px",background:"#111",borderTop:"1px solid "+C.border}}>
              {addingStep?(
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input value={newStepName} onChange={e=>setNewStepName(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter")handleAddStep();if(e.key==="Escape"){setAddingStep(false);setNewStepName("");}}}
                    placeholder="Step name..." autoFocus
                    style={{flex:1,background:C.inputBg,border:"1px solid "+C.accent,borderRadius:7,color:C.text,padding:"6px 10px",fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                  <Btn size="sm" onClick={handleAddStep} disabled={!newStepName.trim()}>Add</Btn>
                  <Btn size="sm" variant="ghost" onClick={()=>{setAddingStep(false);setNewStepName("");}}>Cancel</Btn>
                </div>
              ):(
                <button onClick={e=>{e.stopPropagation();setAddingStep(true);}}
                  style={{background:"none",border:"none",cursor:"pointer",color:C.accent,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:4,padding:0}}>
                  + Add Step
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>

    {/* Scope modals */}
    {scopeModal?.type==="add"&&(
      <ScopeModal
        title="Add Step"
        description={"Adding: \""+scopeModal.name+"\""}
        confirmLabel="Add Step"
        filingType={filing.filingType}
        onConfirm={confirmAdd}
        onClose={()=>setScopeModal(null)}/>
    )}
    {scopeModal?.type==="delete"&&(
      <ScopeModal
        title="Remove Step"
        description={"Removing: \""+scopeModal.step.stepName+"\""}
        confirmLabel="Remove Step"
        filingType={filing.filingType}
        onConfirm={confirmDelete}
        onClose={()=>setScopeModal(null)}/>
    )}
    </>
  );
}

// ─── Year Manager ─────────────────────────────────────────────────────────────
function YearManager({companies,filings,setFilings,yearFilter,setYearFilter,onClose,showToast,templates,isOctavio}) {
  const [working,setWorking]=useState(false);
  const [progress,setProgress]=useState("");
  const [delYear,setDelYear]=useState("");
  const [newYear,setNewYear]=useState(String(CURRENT_YEAR));
  const years=[...new Set(Object.values(filings).flat().map(f=>String(f.year)).filter(Boolean))].sort().reverse();
  const sel={background:C.inputBg,border:"1px solid "+C.border2,borderRadius:7,color:C.text,padding:"7px 10px",fontSize:13,outline:"none",width:"100%",marginBottom:10};

  const initAll=async()=>{
    setWorking(true);let created=0;
    for(const c of companies){
      const types=getFilingTypes(c.jurisdiction);
      const existing=(filings[c.name]||[]).filter(f=>String(f.year)===newYear).map(f=>f.filingType);
      const toCreate=types.filter(ft=>!existing.includes(ft));
      for(const ft of toCreate){
        const stepDefs=getStepsFromTemplates(ft,c.jurisdiction,templates);
        const steps=stepDefs.map((s,i)=>({stepId:uid(),stepName:typeof s==="string"?s:s.name,assignedTo:typeof s==="string"?"":s.assignedTo||"",status:"Pending",notes:"",completedAt:"",order:i}));
        const f={filingId:uid(),companyName:c.name,jurisdiction:c.jurisdiction,filingType:ft,year:parseInt(newYear),status:"Not Started",dueDate:getDueDate(ft,parseInt(newYear)),steps,yearNotes:""};
        await fbSaveFiling(f);created++;
        setProgress("Creating... "+created+" filings");
        setFilings(prev=>({...prev,[c.name]:[...(prev[c.name]||[]),f]}));
      }
    }
    setYearFilter(newYear);setProgress("");showToast(created+" filings created for "+newYear);setWorking(false);
  };
  const deleteYear=async()=>{
    if(!delYear||!window.confirm("Delete ALL filings for "+delYear+"?")) return;
    setWorking(true);
    await fbDeleteYear(delYear);
    setFilings(prev=>{const n={};Object.entries(prev).forEach(([k,v])=>{n[k]=v.filter(f=>String(f.year)!==delYear);});return n;});
    if(yearFilter===delYear) setYearFilter(String(CURRENT_YEAR));
    showToast("All "+delYear+" filings deleted");setDelYear("");setWorking(false);
  };
  return (
    <Modal title="Manage Filing Years" onClose={onClose} width={520}>
      <div style={{background:C.card2,borderRadius:10,padding:16,marginBottom:16,border:"1px solid "+C.border}}>
        <div style={{fontWeight:800,fontSize:13,color:C.text,marginBottom:12}}>Initialize Year for All Companies</div>
        <select value={newYear} onChange={e=>setNewYear(e.target.value)} style={sel}>
          {[CURRENT_YEAR+1,CURRENT_YEAR,CURRENT_YEAR-1,CURRENT_YEAR-2].map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <p style={{fontSize:11,color:C.text3,marginBottom:12,lineHeight:1.5}}>Creates all required filings for every company based on their jurisdiction. Uses your custom templates if saved.</p>
        {progress&&<p style={{fontSize:11,color:C.accent,marginBottom:8}}>{progress}</p>}
        <Btn onClick={initAll} disabled={working}>{working?<><Spinner size={13} color="#fff"/>Working...</>:"Create All Filings for "+newYear}</Btn>
      </div>
      {isOctavio&&<div style={{background:"#1a0a0a",borderRadius:10,padding:16,border:"1px solid #7f1d1d"}}>
        <div style={{fontWeight:800,fontSize:13,color:"#fca5a5",marginBottom:12}}>Delete Entire Year</div>
        <p style={{fontSize:11,color:"#f87171",marginBottom:10,lineHeight:1.5}}>Only years with existing filings appear here.</p>
        <select value={delYear} onChange={e=>setDelYear(e.target.value)} style={{...sel,background:"#1a0a0a",borderColor:"#7f1d1d"}}>
          <option value="">-- Select year --</option>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <Btn variant="danger" onClick={deleteYear} disabled={!delYear||working}>Delete All {delYear||"..."} Filings</Btn>
      </div>}
    </Modal>
  );
}

// ─── Email Blast Modal ────────────────────────────────────────────────────────
function EmailBlastModal({companies,filings,yearFilter,onClose}) {
  const taxYear=String(parseInt(yearFilter)-1);
  const groups=Object.values(companies.flatMap(c=>{
    const cos=(filings[c.name]||[]).filter(f=>String(f.year)===yearFilter&&f.filingType!=="__notes__");
    return cos.flatMap(f=>(f.steps||[]).filter(s=>s.assignedTo==="__client__"&&s.status!=="Done").map(s=>({company:c,filing:f,step:s})));
  }).reduce((acc,{company,filing,step})=>{
    const k=company.name+"||"+filing.filingId;
    if(!acc[k])acc[k]={company,filing,steps:[],to:company.clientEmail||""};
    acc[k].steps.push(step);return acc;
  },{}));
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(0);
  const [done,setDone]=useState(false);
  const [editTo,setEditTo]=useState({});
  const getTmpl=g=>{const tmpl=EMAIL_TEMPLATES[g.filing.filingType]||{};const vars={companyName:g.company.name,jurisdiction:g.company.jurisdiction||"",registrationNumber:g.company.registrationNumber||"",year:taxYear};return{subject:fill(tmpl.subject||"",vars),body:fill(tmpl.body||"",vars)};};
  const sendAll=async()=>{setSending(true);let count=0;for(const g of groups){const to=editTo[g.filing.filingId]!==undefined?editTo[g.filing.filingId]:g.to;if(!to)continue;const{subject,body}=getTmpl(g);try{await apiWrite({action:"sendComplianceEmail",to,subject,body});count++;setSent(count);}catch(e){}}setDone(true);setSending(false);};
  const inp={width:"100%",background:C.inputBg,border:"1px solid "+C.border2,borderRadius:7,color:C.text,padding:"5px 8px",fontSize:12,fontFamily:"inherit",outline:"none",boxSizing:"border-box"};
  return (
    <Modal title={"Email Clients \u2014 Tax Year "+taxYear} onClose={onClose} width={720}>
      {done?<div style={{textAlign:"center",padding:40}}><div style={{fontSize:48,marginBottom:12}}>✓</div><p style={{fontSize:15,fontWeight:700,color:C.success}}>{sent} emails sent successfully</p></div>
      :groups.length===0?<div style={{textAlign:"center",padding:40}}><div style={{fontSize:40,marginBottom:12}}>✓</div><p style={{fontSize:14,fontWeight:700,color:C.text}}>No pending client steps</p><p style={{fontSize:12,color:C.text3,marginTop:8}}>Assign steps to "Client" to include them in the email blast.</p></div>
      :(
        <div>
          <div style={{background:C.card2,borderRadius:9,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.text3,border:"1px solid "+C.border}}><span style={{color:C.text,fontWeight:700}}>{groups.length} emails</span> will be sent to clients with pending action items for Tax Year {taxYear}.</div>
          {groups.map(g=>{const to=editTo[g.filing.filingId]!==undefined?editTo[g.filing.filingId]:(g.to||"");return(
            <div key={g.filing.filingId} style={{background:C.card2,borderRadius:9,padding:12,marginBottom:10,border:"1px solid "+C.border}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:C.text}}>{g.company.name}</div><div style={{fontSize:11,color:C.text3}}>{g.filing.filingType} &middot; {g.steps.length} pending step{g.steps.length>1?"s":""}</div></div><Badge status={g.filing.status}/></div>
              <div style={{marginBottom:6}}><label style={{fontSize:10,fontWeight:800,color:C.text3,textTransform:"uppercase",display:"block",marginBottom:3}}>To</label><input value={to} onChange={e=>setEditTo(p=>({...p,[g.filing.filingId]:e.target.value}))} placeholder="Client email" style={{...inp,borderColor:to?C.border2:C.danger}}/>{!to&&<div style={{fontSize:10,color:C.danger,marginTop:2}}>No email — will be skipped</div>}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{g.steps.map(s=><span key={s.stepId} style={{fontSize:10,background:"#1e293b",color:"#94a3b8",borderRadius:5,padding:"1px 7px"}}>{s.stepName}</span>)}</div>
            </div>
          );})}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}><Btn variant="secondary" onClick={onClose}>Cancel</Btn><Btn onClick={sendAll} disabled={sending}>{sending?<><Spinner size={13} color="#fff"/>Sending {sent}/{groups.length}...</>:"Send "+groups.length+" Email"+(groups.length>1?"s":"")}</Btn></div>
        </div>
      )}
    </Modal>
  );
}

// ─── Side Panel ───────────────────────────────────────────────────────────────
function SidePanel({company,filings,users,isAdmin,currentUserEmail,yearFilter,onClose,updateFiling,templates,onUpdateTemplate}) {
  const [emailFiling,setEmailFiling]=useState(null);
  const [notes,setNotes]=useState("");
  const [notesSaved,setNotesSaved]=useState(false);
  const [savingNotes,setSavingNotes]=useState(false);
  const cos=(filings[company.name]||[]).filter(f=>String(f.year)===yearFilter);
  const taxYear=String(parseInt(yearFilter)-1);
  useEffect(()=>{const nf=cos.find(f=>f.filingType==="__notes__");setNotes(nf?(nf.yearNotes||""):"");setNotesSaved(false);},[company.name,yearFilter]);
  const saveNotes=async()=>{setSavingNotes(true);const existing=cos.find(f=>f.filingType==="__notes__");const nr=existing?{...existing,yearNotes:notes}:{filingId:"notes_"+company.name.replace(/[^a-z0-9]/gi,"_")+"_"+yearFilter,companyName:company.name,jurisdiction:company.jurisdiction,filingType:"__notes__",year:parseInt(yearFilter),status:"N/A",dueDate:"",steps:[],yearNotes:notes};await fbSaveFiling(nr);updateFiling(company.name,nr);setNotesSaved(true);setTimeout(()=>setNotesSaved(false),2000);setSavingNotes(false);};
  const realFilings=cos.filter(f=>f.filingType!=="__notes__");
  return (
    <div style={{width:"58%",maxWidth:820,background:C.card,borderLeft:"1px solid "+C.border,display:"flex",flexDirection:"column",overflowY:"auto",flexShrink:0}}>
      <div style={{padding:"14px 16px",background:C.card2,borderBottom:"1px solid "+C.border,display:"flex",alignItems:"flex-start",gap:12,position:"sticky",top:0,zIndex:10}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:16,fontWeight:900,color:C.text,marginBottom:4}}>{company.name}</div>
          <div style={{display:"flex",gap:14,fontSize:11,color:C.text3,flexWrap:"wrap"}}>
            <span>{company.jurisdiction}</span>
            {company.registrationNumber&&<span>#{company.registrationNumber}</span>}
            {company.clientEmail&&<span>{company.clientEmail}</span>}
            {company.accounting&&<span>Acct: {company.accounting}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.text3,fontSize:20,padding:"0 4px"}}>x</button>
      </div>
      <div style={{padding:16,flex:1}}>
        <div style={{fontSize:9,fontWeight:900,color:C.text3,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Notes — Tax Year {taxYear}</div>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder={"Notes for "+company.name+" (Tax Year "+taxYear+")..."}
          style={{width:"100%",background:C.inputBg,border:"1px solid "+C.border2,borderRadius:8,color:C.text,padding:"8px 10px",fontSize:12,fontFamily:"inherit",outline:"none",resize:"vertical",boxSizing:"border-box",lineHeight:1.6,marginBottom:8}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
          <Btn size="sm" onClick={saveNotes} disabled={savingNotes}>{savingNotes?<><Spinner size={10} color="#fff"/>Saving...</>:"Save Notes"}</Btn>
          {notesSaved&&<span style={{fontSize:11,color:C.success}}>Saved ✓</span>}
        </div>
        <div style={{fontSize:9,fontWeight:900,color:C.text3,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Filings — Tax Year {taxYear}</div>
        {realFilings.length===0?<div style={{textAlign:"center",padding:32,color:C.text3,fontSize:13}}>No filings for {yearFilter} yet.</div>
        :realFilings.map(filing=>(
          <FilingCard key={filing.filingId} filing={filing} company={company} users={users}
            isAdmin={isAdmin} currentUserEmail={currentUserEmail} templates={templates}
            onUpdate={f=>updateFiling(company.name,f)} onEmail={f=>setEmailFiling(f)}
            onUpdateTemplate={onUpdateTemplate}/>
        ))}
      </div>
      {emailFiling&&<EmailModal filing={emailFiling} company={company} onClose={()=>setEmailFiling(null)}/>}
    </div>
  );
}


// ─── Reports Page ─────────────────────────────────────────────────────────────
function ReportsPage({companies, filings, users, yearFilter}) {
  const taxYear = String(parseInt(yearFilter)-1);
  const [groupBy,     setGroupBy]     = useState("company");
  const [statusFilt,  setStatusFilt]  = useState("All");
  const [typeFilt,    setTypeFilt]    = useState("All");
  const [jurFilt,     setJurFilt]     = useState("All");
  const [personFilt,  setPersonFilt]  = useState("All");

  const OCTAVIO  = "omcardoso@gmail.com";
  const FERNANDO = "gataxservicescorp@gmail.com";
  const KARINA   = "meloatwork@gmail.com";

  const getUserName = email => {
    if(email==="__client__") return "Client";
    if(!email) return "Unassigned";
    const u = users.find(u=>u.email===email);
    return u ? u.name : email.split("@")[0];
  };

  // Build flat list of all pending steps
  const allSteps = Object.values(filings).flat()
    .filter(f => String(f.year)===yearFilter && f.filingType!=="__notes__")
    .flatMap(f => {
      const co = companies.find(c=>c.name===f.companyName);
      return (f.steps||[]).map(s=>({
        ...s,
        companyName:  f.companyName,
        jurisdiction: f.jurisdiction || co?.jurisdiction || "",
        filingType:   f.filingType,
        dueDate:      f.dueDate,
        clientEmail:  co?.clientEmail || "",
      }));
    });

  const filtered = allSteps.filter(s => {
    if(statusFilt!=="All" && statusFilt==="Pending/Active") {
      if(s.status==="Done") return false;
    } else if(statusFilt!=="All" && s.status!==statusFilt) return false;
    if(typeFilt!=="All" && s.filingType!==typeFilt) return false;
    if(jurFilt!=="All" && s.jurisdiction!==jurFilt) return false;
    if(personFilt!=="All") {
      if(personFilt==="Unassigned" && s.assignedTo) return false;
      if(personFilt!=="Unassigned" && s.assignedTo!==personFilt) return false;
    }
    return true;
  });

  // Group
  const grouped = filtered.reduce((acc, s) => {
    let key;
    if(groupBy==="company")      key = s.companyName;
    else if(groupBy==="person")  key = getUserName(s.assignedTo);
    else if(groupBy==="jurisdiction") key = s.jurisdiction || "Unknown";
    else if(groupBy==="client")  key = s.clientEmail || "(no email)";
    if(!acc[key]) acc[key]=[];
    acc[key].push(s);
    return acc;
  }, {});

  const jurOptions = ["All",...new Set(Object.values(filings).flat().map(f=>f.jurisdiction).filter(Boolean))].sort();
  const personOptions = ["All","Unassigned",...users.map(u=>u.email),"__client__"];

  const downloadCSV = () => {
    const rows = [["Company","Jurisdiction","Filing Type","Step","Assigned To","Status","Due Date","Client Email"]];
    filtered.forEach(s => rows.push([
      s.companyName, s.jurisdiction, s.filingType, s.stepName,
      getUserName(s.assignedTo), s.status, s.dueDate, s.clientEmail
    ]));
    const csv = rows.map(r=>r.map(v=>`"${(v||"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download="compliance-report-"+yearFilter+".csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const sel = {background:C.inputBg,border:"1px solid "+C.border2,borderRadius:7,color:C.text,padding:"6px 9px",fontSize:12,outline:"none",colorScheme:"dark"};
  const statusColors = {"Done":C.success,"Pending":C.text3,"In Progress":"#93c5fd","Waiting Client":"#fcd34d"};

  return (
    <div style={{maxWidth:1100,margin:"0 auto",padding:24}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <h2 style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:900,color:C.text,flex:1}}>
          Reports — Tax Year {taxYear}
        </h2>
        <button onClick={downloadCSV}
          style={{background:"#052e16",color:"#34d399",border:"1px solid #065f46",borderRadius:7,
            padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
          ⬇ Download CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{background:C.card,borderRadius:12,padding:14,border:"1px solid "+C.border,
        marginBottom:20,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,color:C.text3,fontWeight:700}}>Group by:</span>
        {["company","person","jurisdiction","client"].map(g=>(
          <button key={g} onClick={()=>setGroupBy(g)}
            style={{background:groupBy===g?C.accent:C.card2,color:groupBy===g?"#fff":C.text2,
              border:"1px solid "+(groupBy===g?C.accent:C.border2),borderRadius:6,
              padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>
            {g==="client"?"Client (Email)":g.charAt(0).toUpperCase()+g.slice(1)}
          </button>
        ))}
        <span style={{color:C.border2}}>|</span>
        <select value={statusFilt} onChange={e=>setStatusFilt(e.target.value)} style={sel}>
          <option value="All">All Statuses</option>
          <option value="Pending/Active">Pending / Active</option>
          {["Pending","In Progress","Waiting Client","Done"].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={typeFilt} onChange={e=>setTypeFilt(e.target.value)} style={sel}>
          <option value="All">All Filing Types</option>
          {["Tax Return","Economic Substance","Annual Return"].map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select value={jurFilt} onChange={e=>setJurFilt(e.target.value)} style={sel}>
          {jurOptions.map(j=><option key={j} value={j}>{j==="All"?"All Jurisdictions":j}</option>)}
        </select>
        <select value={personFilt} onChange={e=>setPersonFilt(e.target.value)} style={sel}>
          <option value="All">All People</option>
          <option value="Unassigned">Unassigned</option>
          <option value="__client__">Client</option>
          {users.map(u=><option key={u.id} value={u.email}>{u.name}</option>)}
        </select>
        <span style={{fontSize:11,color:C.text3,marginLeft:"auto"}}>{filtered.length} steps</span>
      </div>

      {/* Groups */}
      {Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([group,steps])=>(
        <div key={group} style={{background:C.card,borderRadius:12,border:"1px solid "+C.border,
          overflow:"hidden",marginBottom:14}}>
          <div style={{padding:"10px 16px",background:C.card2,borderBottom:"1px solid "+C.border,
            display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontWeight:800,fontSize:13,color:C.text,flex:1}}>{group}</span>
            <span style={{fontSize:11,color:C.text3}}>{steps.length} step{steps.length!==1?"s":""}</span>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#111"}}>
                  {["Company","Jurisdiction","Filing","Step","Assigned","Status","Due"].map(h=>(
                    <th key={h} style={{padding:"6px 12px",fontSize:9,fontWeight:900,color:C.text3,
                      textTransform:"uppercase",letterSpacing:"0.06em",textAlign:"left",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {steps.map((s,i)=>(
                  <tr key={s.stepId} style={{borderTop:"1px solid "+C.border,
                    background:i%2===0?"transparent":C.card2}}>
                    <td style={{padding:"7px 12px",fontSize:11,color:C.text,fontWeight:600,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.companyName}</td>
                    <td style={{padding:"7px 12px",fontSize:11,color:C.text2}}>{s.jurisdiction}</td>
                    <td style={{padding:"7px 12px",fontSize:11,color:C.text2}}>{s.filingType}</td>
                    <td style={{padding:"7px 12px",fontSize:11,color:C.text,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.stepName}</td>
                    <td style={{padding:"7px 12px",fontSize:11,color:"#818cf8",fontWeight:700}}>{getUserName(s.assignedTo)}</td>
                    <td style={{padding:"7px 12px"}}>
                      <span style={{fontSize:10,fontWeight:800,color:statusColors[s.status]||C.text3}}>{s.status}</span>
                    </td>
                    <td style={{padding:"7px 12px",fontSize:11,color:C.text3,whiteSpace:"nowrap"}}>{s.dueDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {Object.keys(grouped).length===0&&(
        <div style={{textAlign:"center",padding:48,color:C.text3,fontSize:13}}>No steps match your filters.</div>
      )}
    </div>
  );
}

// ─── Communications Page ──────────────────────────────────────────────────────
function CommsPage({companies, filings, yearFilter, showToast}) {
  const taxYear = String(parseInt(yearFilter)-1);
  const [sending,   setSending]   = useState({});
  const [sentCount, setSentCount] = useState({});
  const [expanded,  setExpanded]  = useState({econ:true, tax:true, bvi:true});

  const STEP_TRIGGERS = {
    econ: "Send Google Form link to client",
    tax:  "Send Information request Letter",
    bvi:  "Send balance sheet request to client",
  };
  const FILING_TYPES = { econ:"Economic Substance", tax:"Tax Return", bvi:"Annual Return" };
  const LABELS = { econ:"Economic Substance", tax:"Tax Return (US)", bvi:"BVI Annual Return" };

  // Find companies where the trigger step is still Pending
  const getCandidates = (type) => {
    const triggerStep = STEP_TRIGGERS[type];
    const filingType  = FILING_TYPES[type];
    return companies.flatMap(c => {
      const f = (filings[c.name]||[]).find(f=>
        String(f.year)===yearFilter && f.filingType===filingType
      );
      if(!f) return [];
      const step = (f.steps||[]).find(s=>s.stepName===triggerStep);
      if(!step || step.status==="Done") return [];
      return [{ company:c, filing:f, step, to:c.clientEmail||"" }];
    });
  };

  const sendBlast = async(type) => {
    const candidates = getCandidates(type);
    setSending(p=>({...p,[type]:true}));
    let count=0;
    for(const {company, filing, step} of candidates){
      if(!company.clientEmail) continue;
      const tmpl = EMAIL_TEMPLATES[FILING_TYPES[type]]||{};
      const vars = { companyName:company.name, jurisdiction:company.jurisdiction||"",
        registrationNumber:company.registrationNumber||"", year:taxYear };
      const subject = fill(tmpl.subject||"", vars);
      const body    = fill(tmpl.body||"", vars);
      try {
        await apiWrite({action:"sendComplianceEmail", to:company.clientEmail, subject, body});
        // Mark step as Waiting Client
        const updStep = {...step, status:"Waiting Client"};
        const ns = (filing.steps||[]).map(s=>s.stepId===step.stepId?updStep:s);
        const upd = {...filing, status:"Waiting Client", steps:ns};
        await fbSaveFiling(upd);
        count++;
      } catch(e) {}
    }
    setSentCount(p=>({...p,[type]:count}));
    setSending(p=>({...p,[type]:false}));
    showToast(count+" emails sent");
  };

  const Section = ({type}) => {
    const candidates = getCandidates(type);
    const isOpen = expanded[type];
    const isSending = sending[type];
    const sent = sentCount[type];
    const withEmail    = candidates.filter(c=>c.to);
    const withoutEmail = candidates.filter(c=>!c.to);

    return (
      <div style={{background:C.card,borderRadius:12,border:"1px solid "+C.border,marginBottom:16,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",background:C.card2,display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}
          onClick={()=>setExpanded(p=>({...p,[type]:!p[type]}))}>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:14,color:C.text,marginBottom:3}}>{LABELS[type]}</div>
            <div style={{fontSize:11,color:C.text3}}>
              {candidates.length} companies with pending first step &middot; {withEmail.length} have email &middot; {withoutEmail.length} missing email
            </div>
          </div>
          {sent!==undefined&&<span style={{fontSize:11,color:C.success,fontWeight:700}}>{sent} sent ✓</span>}
          {isOpen&&withEmail.length>0&&(
            <button onClick={e=>{e.stopPropagation();sendBlast(type);}} disabled={isSending}
              style={{background:C.accent,color:"#fff",border:"none",borderRadius:7,
                padding:"6px 16px",fontSize:12,fontWeight:800,cursor:isSending?"default":"pointer",
                display:"flex",alignItems:"center",gap:6,opacity:isSending?0.7:1}}>
              {isSending?<><Spinner size={12} color="#fff"/>Sending...</>:"Send "+withEmail.length+" Emails"}
            </button>
          )}
          <span style={{color:C.text3,fontSize:11}}>{isOpen?"▼":"▶"}</span>
        </div>
        {isOpen&&(
          <div>
            {candidates.length===0?(
              <div style={{padding:24,textAlign:"center",color:C.text3,fontSize:12}}>
                All first steps are complete for this filing type.
              </div>
            ):(
              <>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1.5fr 80px",
                  padding:"6px 16px",background:"#111",borderTop:"1px solid "+C.border}}>
                  {["Company","Jurisdiction","Client Email",""].map(h=>(
                    <span key={h} style={{fontSize:9,fontWeight:900,color:C.text3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</span>
                  ))}
                </div>
                {candidates.map(({company,step})=>(
                  <div key={company.name} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1.5fr 80px",
                    padding:"9px 16px",borderTop:"1px solid "+C.border,alignItems:"center"}}>
                    <div style={{fontWeight:600,fontSize:12,color:C.text}}>{company.name}</div>
                    <div style={{fontSize:11,color:C.text2}}>{company.jurisdiction}</div>
                    <div style={{fontSize:11,color:company.clientEmail?C.text2:C.danger}}>
                      {company.clientEmail||"⚠ No email"}
                    </div>
                    <div>
                      <span style={{fontSize:10,fontWeight:800,
                        color:step.status==="Waiting Client"?"#fcd34d":C.text3,
                        background:step.status==="Waiting Client"?"#422006":"transparent",
                        borderRadius:5,padding:step.status==="Waiting Client"?"1px 6px":"0"}}>
                        {step.status}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{maxWidth:1000,margin:"0 auto",padding:24}}>
      <h2 style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:900,color:C.text,marginBottom:6}}>
        Communications — Tax Year {taxYear}
      </h2>
      <p style={{fontSize:12,color:C.text3,marginBottom:24,lineHeight:1.6}}>
        Send information request emails to clients. Only companies where the first step is still pending are shown.
        Sending an email automatically marks the step as <strong style={{color:"#fcd34d"}}>Waiting Client</strong>.
      </p>
      <Section type="tax"/>
      <Section type="econ"/>
      <Section type="bvi"/>
    </div>
  );
}

// ─── Users Page ──────────────────────────────────────────────────────────────
function UsersPage({users,setUsers,showToast,currentUserEmail,isOctavio}) {
  const [newName,  setNewName]  = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole,  setNewRole]  = useState("editor");
  const [saving,   setSaving]   = useState(false);
  const ROLES = ["admin","editor","client","viewer"];
  const inp = {background:C.inputBg,border:"1px solid "+C.border2,borderRadius:7,color:C.text,padding:"7px 10px",fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box",colorScheme:"dark"};
  const lbl = {fontSize:10,fontWeight:800,color:C.text3,textTransform:"uppercase",letterSpacing:"0.06em",display:"block",marginBottom:4};

  const addUser = async() => {
    if(!newName.trim()||!newEmail.trim()){alert("Name and email required.");return;}
    setSaving(true);
    const user={id:"u_"+Date.now(),name:newName.trim(),email:newEmail.trim().toLowerCase(),
      role:newRole,initials:newName.trim().split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2),status:"active"};
    try{
      await apiWrite({action:"saveUser",user});
      setUsers(prev=>[...prev,user]);
      setNewName("");setNewEmail("");setNewRole("editor");
      showToast(user.name+" added successfully");
    }catch(e){alert("Error: "+e.message);}
    setSaving(false);
  };

  const removeUser = async(user) => {
    if(user.email===currentUserEmail){alert("You cannot delete your own account.");return;}
    if(!window.confirm("Delete "+user.name+"? This cannot be undone.")) return;
    try{
      await apiWrite({action:"deleteUser",id:user.id});
      setUsers(prev=>prev.filter(u=>u.id!==user.id));
      showToast(user.name+" deleted");
    }catch(e){alert("Error: "+e.message);}
  };

  const roleBadge = role => {
    const colors={admin:{bg:"#1e1b4b",color:"#818cf8"},editor:{bg:"#1e3a5f",color:"#93c5fd"},client:{bg:"#052e16",color:"#6ee7b7"},viewer:{bg:"#1e293b",color:"#94a3b8"}};
    const s=colors[role]||colors.viewer;
    return <span style={{background:s.bg,color:s.color,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:800}}>{role}</span>;
  };

  return (
    <div style={{maxWidth:800,margin:"0 auto",padding:24}}>
      <h2 style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:900,color:C.text,marginBottom:6}}>User Management</h2>
      <p style={{fontSize:12,color:C.text3,marginBottom:24}}>Add or remove users. Roles: admin (full access), editor (can update steps), client (view only), viewer (read only).</p>

      {isOctavio&&<div style={{background:C.card,borderRadius:12,padding:20,border:"1px solid "+C.border,marginBottom:24}}>
        <div style={{fontWeight:800,fontSize:13,color:C.text,marginBottom:16}}>Add New User</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 140px",gap:12,marginBottom:14}}>
          <div><label style={lbl}>Full Name</label><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="John Smith" style={inp}/></div>
          <div><label style={lbl}>Email</label><input value={newEmail} onChange={e=>setNewEmail(e.target.value)} placeholder="john@example.com" type="email" style={inp}/></div>
          <div><label style={lbl}>Role</label>
            <select value={newRole} onChange={e=>setNewRole(e.target.value)} style={inp}>
              {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <Btn onClick={addUser} disabled={saving||!newName.trim()||!newEmail.trim()}>
          {saving?<><Spinner size={13} color="#fff"/>Adding...</>:"+ Add User"}
        </Btn>
      </div>}

      {/* Users list */}
      <div style={{background:C.card,borderRadius:12,border:"1px solid "+C.border,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1.5fr 100px 60px",padding:"8px 16px",background:"#111",borderBottom:"1px solid "+C.border}}>
          {["Name","Email","Role",""].map(h=><span key={h} style={{fontSize:9,fontWeight:900,color:C.text3,textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</span>)}
        </div>
        {users.map(u=>(
          <div key={u.id} style={{display:"grid",gridTemplateColumns:"1fr 1.5fr 100px 60px",padding:"12px 16px",borderBottom:"1px solid "+C.border,alignItems:"center"}}
            onMouseEnter={e=>e.currentTarget.style.background=C.card2}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:C.text}}>{u.name}</div>
              {u.id&&<div style={{fontSize:10,color:C.text3}}>ID: {u.id}</div>}
            </div>
            <div style={{fontSize:12,color:C.text2}}>{u.email}</div>
            <div>{roleBadge(u.role||"viewer")}</div>
            <div>
              {isOctavio&&u.email!==currentUserEmail&&(
                <button onClick={()=>removeUser(u)}
                  style={{background:"none",border:"1px solid #450a0a",borderRadius:6,color:"#fca5a5",cursor:"pointer",fontSize:11,fontWeight:700,padding:"3px 8px"}}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
        {users.length===0&&<div style={{padding:32,textAlign:"center",color:C.text3,fontSize:13}}>No users found.</div>}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const {user:clerkUser}=useUser();
  const [companies,setCompanies]=useState([]);
  const [users,setUsers]=useState([]);
  const [filings,setFilings]=useState({});
  const [templates,setTemplates]=useState({});
  const [currentUser,setCurrentUser]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [yearFilter,setYearFilter]=useState(String(CURRENT_YEAR));
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("All");
  const [jurFilter,setJurFilter]=useState("All");
  const [typeFilter,setTypeFilter]=useState("All");
  const [selectedCo,setSelectedCo]=useState(null);
  const [toast,setToast]=useState(null);
  const [yearMgr,setYearMgr]=useState(false);
  const [emailBlast,setEmailBlast]=useState(false);
  const [sortBy,setSortBy]=useState("name");
  const [sortDir,setSortDir]=useState("asc");
  const [view,setView]=useState("dashboard"); // dashboard | users | reports | comms

  const isAdmin=currentUser&&(ADMIN_EMAILS.includes((currentUser.email||"").toLowerCase())||currentUser.role==="admin"||currentUser.role==="editor");
  const isOctavio=currentUser&&["omcardoso@gmail.com","cardoso@westchester.eu"].includes((currentUser.email||"  ").toLowerCase());
  const taxYear=String(parseInt(yearFilter)-1);
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);};
  const updateTemplate=(key,steps)=>{setTemplates(prev=>({...prev,[key]:steps}));};
  const sortCol=col=>{if(sortBy===col)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortBy(col);setSortDir("asc");}};
  const sortIcon=col=>sortBy===col?(sortDir==="asc"?" ▲":" ▼"):" ↕";

  const cleanSteps = (steps) => (steps||[]).map(s => ({
    ...s,
    stepName:   typeof s.stepName==="string"   ? s.stepName   : (s.stepName?.name  ||"(unnamed step)"),
    assignedTo: typeof s.assignedTo==="string" ? s.assignedTo : "",
  }));

  const loadData=useCallback(async()=>{
    if(!clerkUser)return;
    setLoading(true);
    try{
      const email=(clerkUser.primaryEmailAddress?.emailAddress||"").toLowerCase();
      const [cd,ud,filingDocs,tmpl]=await Promise.all([apiRead("getCompanies"),apiRead("getUsers"),fbGetFilings(),fbGetTemplates()]);
      const ul=ud.users||[];
      setCurrentUser(ul.find(u=>(u.email||"").toLowerCase()===email)||{email,role:"viewer",name:clerkUser.fullName||email});
      setUsers(ul);setCompanies(cd.companies||[]);setTemplates(tmpl);
      const fm={};
      filingDocs.forEach(f=>{
        const cleaned={...f,steps:cleanSteps(f.steps)};
        if(!fm[f.companyName])fm[f.companyName]=[];
        fm[f.companyName].push(cleaned);
      });
      setFilings(fm);
    }catch(e){setError(e.message);}
    setLoading(false);
  },[clerkUser]);

  useEffect(()=>{if(clerkUser)loadData();},[clerkUser,loadData]);

  const updateFiling=(companyName,updatedFiling)=>{
    setFilings(prev=>{const list=prev[companyName]||[];const exists=list.some(f=>f.filingId===updatedFiling.filingId);return{...prev,[companyName]:exists?list.map(f=>f.filingId===updatedFiling.filingId?updatedFiling:f):[...list,updatedFiling]};});
  };

  const getWorstStatus=name=>{
    const cos=(filings[name]||[]).filter(f=>String(f.year)===yearFilter&&f.filingType!=="__notes__");
    if(!cos.length)return"No Filings";
    if(cos.some(f=>f.status!=="Complete"&&daysUntil(f.dueDate)<0))return"Overdue";
    if(cos.every(f=>f.status==="Complete"))return"Complete";
    if(cos.some(f=>f.status==="Waiting Client"))return"Waiting Client";
    if(cos.some(f=>f.status==="In Progress"))return"In Progress";
    return"Not Started";
  };

  const allFilings=Object.values(filings).flat().filter(f=>String(f.year)===yearFilter&&f.filingType!=="__notes__");
  const stats={total:allFilings.length,complete:allFilings.filter(f=>f.status==="Complete").length,overdue:allFilings.filter(f=>f.status!=="Complete"&&daysUntil(f.dueDate)<0).length,dueSoon:allFilings.filter(f=>f.status!=="Complete"&&daysUntil(f.dueDate)>=0&&daysUntil(f.dueDate)<=30).length};
  const myTasks=allFilings.flatMap(f=>(f.steps||[]).filter(s=>s.assignedTo===currentUser?.email&&s.status!=="Done").map(s=>({...s,filing:f,company:companies.find(c=>c.name===f.companyName)}))).sort((a,b)=>new Date(a.filing.dueDate)-new Date(b.filing.dueDate));
  const jurOptions=["All",...new Set(companies.map(c=>c.jurisdiction).filter(Boolean))].sort();

  const visibleCompanies=[...companies.filter(c=>{
    if(search&&!c.name?.toLowerCase().includes(search.toLowerCase()))return false;
    if(jurFilter!=="All"&&c.jurisdiction!==jurFilter)return false;
    if(typeFilter!=="All"&&!getFilingTypes(c.jurisdiction).includes(typeFilter))return false;
    if(statusFilter==="All")return true;
    const ws=getWorstStatus(c.name);
    if(statusFilter==="No Filings")return ws==="No Filings";
    return ws===statusFilter;
  })].sort((a,b)=>{
    let av,bv;
    if(sortBy==="name"){av=a.name||"";bv=b.name||"";}
    else if(sortBy==="jurisdiction"){av=a.jurisdiction||"";bv=b.jurisdiction||"";}
    else if(sortBy==="status"){av=STATUS_ORDER[getWorstStatus(a.name)]??99;bv=STATUS_ORDER[getWorstStatus(b.name)]??99;return sortDir==="asc"?av-bv:bv-av;}
    return sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av);
  });

  const panelOpen=!!selectedCo;
  const gridFull="2fr 1fr 1fr 1fr 130px 80px";
  const gridComp="1.8fr 0.8fr 0.9fr";

  if(loading)return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg}}><Spinner size={32}/></div>;
  if(error)return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,flexDirection:"column",gap:12}}><div style={{fontSize:40}}>⚠️</div><p style={{fontSize:15,fontWeight:700,color:C.text}}>Could not connect</p><p style={{fontSize:13,color:C.text3}}>{error}</p><Btn onClick={loadData}>Retry</Btn></div>;

  const hdrSpan=(label,col)=><span onClick={col?()=>sortCol(col):undefined} style={{fontSize:9,fontWeight:900,color:C.text3,textTransform:"uppercase",letterSpacing:"0.07em",cursor:col?"pointer":"default"}}>{label}{col?sortIcon(col):""}</span>;

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",color:C.text}}>
      <div style={{background:"#000",borderBottom:"1px solid "+C.border,padding:"0 20px",display:"flex",alignItems:"center",gap:12,height:54,position:"sticky",top:0,zIndex:200}}>
        <span style={{fontFamily:"Georgia,serif",fontWeight:900,fontSize:15,color:C.text}}>Compliance Tracker</span>
        <span style={{color:C.border2}}>|</span>
        <span style={{fontSize:11,color:C.text3}}>Westchester International</span>
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,color:C.text3}}>Work Year</span>
          <select value={yearFilter} onChange={e=>{setYearFilter(e.target.value);setSelectedCo(null);}} style={{background:"#111",color:C.text,border:"1px solid "+C.border2,borderRadius:7,padding:"4px 10px",fontSize:12,fontWeight:700,outline:"none",colorScheme:"dark"}}>
            {[CURRENT_YEAR+1,CURRENT_YEAR,CURRENT_YEAR-1,CURRENT_YEAR-2].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <span style={{fontSize:11,color:C.text3,background:C.card2,border:"1px solid "+C.border,borderRadius:6,padding:"3px 9px",whiteSpace:"nowrap"}}>Tax Year <span style={{color:"#818cf8",fontWeight:800}}>{taxYear}</span></span>
        </div>
        {isAdmin&&<><Btn size="sm" variant="secondary" onClick={()=>setYearMgr(true)}>🗓 Manage Years</Btn><Btn size="sm" variant="secondary" onClick={()=>setView(v=>v==="reports"?"dashboard":"reports")} style={{color:"#38bdf8",borderColor:"#0c4a6e"}}>📊 Reports</Btn><Btn size="sm" variant="secondary" onClick={()=>setView(v=>v==="comms"?"dashboard":"comms")} style={{color:"#34d399",borderColor:"#064e3b"}}>✉ Comms</Btn>{isOctavio&&<Btn size="sm" variant="secondary" onClick={()=>setView(v=>v==="users"?"dashboard":"users")} style={{color:"#a78bfa",borderColor:"#3b0764"}}>👥 Users</Btn>}</>}
        <UserButton/>
      </div>

      {view==="users"   && <UsersPage users={users} setUsers={setUsers} showToast={showToast} currentUserEmail={currentUser?.email} isOctavio={isOctavio}/>}
      {view==="reports"  && <ReportsPage companies={companies} filings={filings} users={users} yearFilter={yearFilter}/>}
      {view==="comms"    && <CommsPage companies={companies} filings={filings} yearFilter={yearFilter} showToast={showToast}/>}
      {(view==="dashboard") && <div style={{background:"#111",borderBottom:"1px solid "+C.border,padding:"8px 20px",display:"flex",gap:6,alignItems:"center"}}>
        {[{v:stats.total,l:"Total",c:"#818cf8"},{v:stats.complete,l:"Complete",c:"#34d399"},{v:stats.overdue,l:"Overdue",c:"#f87171"},{v:stats.dueSoon,l:"Due Soon",c:"#fbbf24"},{v:myTasks.length,l:"My Tasks",c:"#a78bfa"}].map(s=>(
          <React.Fragment key={s.l}><span style={{fontSize:16,fontWeight:900,color:s.c}}>{s.v}</span><span style={{fontSize:10,color:C.text3,marginRight:14}}>{s.l}</span></React.Fragment>
        ))}
      </div>}

      {(view==="dashboard") && <div style={{display:"flex",height:"calc(100vh - 104px)"}}>
        <div style={{flex:1,overflowY:"auto",minWidth:0}}>
          <div style={{padding:"8px 14px",borderBottom:"1px solid "+C.border,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",background:C.card,position:"sticky",top:0,zIndex:10}}>
            <div style={{position:"relative",flex:"1 1 180px",maxWidth:240}}>
              <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:C.text3,fontSize:12}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search companies..."
                style={{width:"100%",background:C.inputBg,border:"1px solid "+C.border2,borderRadius:7,color:C.text,padding:"6px 8px 6px 26px",fontSize:12,outline:"none",boxSizing:"border-box",fontFamily:"inherit",colorScheme:"dark"}}/>
            </div>
            {[[statusFilter,setStatusFilter,["All",...FILING_STATUSES,"No Filings","Overdue"],"Status"],[jurFilter,setJurFilter,jurOptions,"Jurisdiction"],[typeFilter,setTypeFilter,["All",...ALL_FILING_TYPES],"Filing Type"]].map(([val,setter,opts,label],i)=>(
              <select key={i} value={val} onChange={e=>setter(e.target.value)} style={{background:C.inputBg,border:"1px solid "+C.border2,borderRadius:7,color:C.text,padding:"6px 9px",fontSize:12,outline:"none",colorScheme:"dark"}}>
                {opts.map(o=><option key={o} value={o}>{o==="All"?label+": All":o}</option>)}
              </select>
            ))}
            <span style={{fontSize:11,color:C.text3,marginLeft:"auto"}}>{visibleCompanies.length} companies</span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:panelOpen?gridComp:gridFull,padding:"6px 14px",background:"#111",borderBottom:"1px solid "+C.border,position:"sticky",top:53,zIndex:9}}>
            {panelOpen?<>{hdrSpan("Company","name")}{hdrSpan("Jurisdiction","jurisdiction")}{hdrSpan("Status","status")}</>
            :<>{hdrSpan("Company","name")}{hdrSpan("Jurisdiction","jurisdiction")}{hdrSpan("Filing Types",null)}{hdrSpan("Status","status")}{hdrSpan("Next Responsible",null)}{hdrSpan("",null)}</>}
          </div>

          {visibleCompanies.length===0?<div style={{padding:48,textAlign:"center",color:C.text3,fontSize:13}}>No companies match your filters.</div>
          :visibleCompanies.map(c=>{
            const ws=getWorstStatus(c.name);
            const next=getNextResponsible(c.name,filings,yearFilter,users);
            const isSel=selectedCo?.name===c.name;
            const hasFilings=(filings[c.name]||[]).filter(f=>String(f.year)===yearFilter&&f.filingType!=="__notes__").length>0;
            return(
              <div key={c.name} onClick={()=>setSelectedCo(isSel?null:c)}
                style={{display:"grid",gridTemplateColumns:panelOpen?gridComp:gridFull,padding:"10px 14px",borderBottom:"1px solid "+C.border,cursor:"pointer",background:isSel?"#1e1b4b":"transparent",transition:"background 0.1s"}}
                onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=C.card2;}}
                onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                <div><div style={{fontWeight:700,fontSize:12,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>{c.clientEmail&&<div style={{fontSize:10,color:C.text3}}>{c.clientEmail}</div>}</div>
                <div style={{fontSize:11,color:"#cbd5e1",display:"flex",alignItems:"center"}}>{c.jurisdiction}</div>
                {!panelOpen&&<div style={{display:"flex",flexDirection:"column",gap:2,justifyContent:"center"}}>{getFilingTypes(c.jurisdiction).map(ft=><span key={ft} style={{fontSize:9,background:C.card2,color:C.text3,borderRadius:4,padding:"1px 5px",display:"inline-block"}}>{ft}</span>)}</div>}
                <div style={{display:"flex",alignItems:"center"}}>{hasFilings?<Badge status={ws}/>:<span style={{fontSize:10,color:C.text3,fontStyle:"italic"}}>No filings</span>}</div>
                {!panelOpen&&<div style={{display:"flex",flexDirection:"column",justifyContent:"center"}}>
                  {next?<><span style={{fontSize:11,fontWeight:700,color:"#818cf8"}}>{next.name}</span><span style={{fontSize:10,color:C.text3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:110}}>{next.step}</span></>
                  :ws==="Complete"?<span style={{fontSize:11,color:C.success}}>Complete ✓</span>:<span style={{fontSize:11,color:C.text3}}>Unassigned</span>}
                </div>}
                {!panelOpen&&<div style={{display:"flex",alignItems:"center"}}>
                  {isAdmin&&!hasFilings?<Btn size="sm" onClick={async e=>{
                    e.stopPropagation();
                    const types=getFilingTypes(c.jurisdiction);
                    for(const ft of types){
                      const stepDefs=getStepsFromTemplates(ft,c.jurisdiction,templates);
                      const steps=stepDefs.map((s,i)=>({stepId:uid(),stepName:typeof s==="string"?s:s.name,assignedTo:typeof s==="string"?"":s.assignedTo||"",status:"Pending",notes:"",completedAt:"",order:i}));
                      const f={filingId:uid(),companyName:c.name,jurisdiction:c.jurisdiction,filingType:ft,year:parseInt(yearFilter),status:"Not Started",dueDate:getDueDate(ft,parseInt(yearFilter)),steps,yearNotes:""};
                      await fbSaveFiling(f);updateFiling(c.name,f);
                    }
                    showToast("Filings created for "+c.name);
                  }}>+ Create</Btn>:<span style={{fontSize:11,color:"#818cf8"}}>View →</span>}
                </div>}
              </div>
            );
          })}
        </div>

        {selectedCo&&<SidePanel company={selectedCo} filings={filings} users={users} isAdmin={isAdmin} currentUserEmail={currentUser?.email} yearFilter={yearFilter} onClose={()=>setSelectedCo(null)} updateFiling={updateFiling} templates={templates} onUpdateTemplate={updateTemplate}/>}
      </div>}



      {emailBlast&&<EmailBlastModal companies={companies} filings={filings} yearFilter={yearFilter} onClose={()=>setEmailBlast(false)}/>}
      {yearMgr&&<YearManager companies={companies} filings={filings} setFilings={setFilings} yearFilter={yearFilter} setYearFilter={setYearFilter} onClose={()=>setYearMgr(false)} showToast={showToast} templates={templates} isOctavio={isOctavio}/>}

      {toast&&<div style={{position:"fixed",bottom:20,right:20,zIndex:9999,background:toast.type==="error"?C.danger:C.success,color:"#fff",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:700,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>{toast.msg}</div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}select,input,textarea{color-scheme:dark}::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}`}</style>
    </div>
  );
}
