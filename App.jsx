import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

/* ═══════════════════════════════════════════════════
   TOKENS
═══════════════════════════════════════════════════ */
const T = {
  // ── APPLE GLASS BACKGROUNDS — deep obsidian with blue-shift ──
  bg0:"#060810", bg1:"#080c14", bg2:"#0c1219", bg3:"#111820", bg4:"#17202a",
  // ── GLASS BORDERS — ultra-fine specular lines ──
  line0:"rgba(255,255,255,0.04)", line1:"rgba(255,255,255,0.08)", line2:"rgba(255,255,255,0.15)",
  // ── PRIMARY BRAND — Electric Cyan / Teal ──
  cyan:"#06d6f0",    cyanLt:"#34e4ff",   cyanDm:"rgba(6,214,240,0.09)",   cyanGl:"rgba(6,214,240,0.13)",
  // gold — rank accent only
  gold:"#f0a500",    goldLt:"#f8c040",   goldDm:"rgba(240,165,0,0.1)",    goldGl:"rgba(240,165,0,0.15)",
  // ── SEMANTIC — traffic-light ──
  green:"#30d158",   greenLt:"#4de06e",  greenDm:"rgba(48,209,88,0.09)",  greenGl:"rgba(48,209,88,0.16)",
  amber:"#ff9f0a",   amberLt:"#ffb340",  amberDm:"rgba(255,159,10,0.1)",  amberGl:"rgba(255,159,10,0.16)",
  red:"#ff453a",     redLt:"#ff6961",    redDm:"rgba(255,69,58,0.09)",    redGl:"rgba(255,69,58,0.16)",
  // Secondary
  blue:"#0a84ff",    blueDm:"rgba(10,132,255,0.1)",
  violet:"#bf5af2",  violetDm:"rgba(191,90,242,0.1)",
  rose:"#ff453a",
  // ── TEXT — Apple-style warm near-white hierarchy ──
  t1:"#f5f5f7", t2:"#98989f", t3:"#48484a",
  // ── RANK COLORS — refined precious metals ──
  r0:"#ffd60a",   // 1st — gold
  r1:"#c4c4c6",   // 2nd — silver
  r2:"#bf7e3a",   // 3rd — bronze
  r0dm:"rgba(255,214,10,0.10)",
  r1dm:"rgba(196,196,198,0.08)",
  r2dm:"rgba(191,126,58,0.08)",
  rad:"10px", radL:"14px", radXl:"20px",
};

const METRICS = [
  { key:"appts",    label:"Appointments", short:"Appts",  icon:"A",  color:T.t1,     dim:"rgba(255,255,255,0.04)", fmt:v=>`${v}`,                     sfmt:v=>`${v}` },
  { key:"sales",    label:"Sales",        short:"Sales",  icon:"S",  color:T.t1,     dim:"rgba(255,255,255,0.04)", fmt:v=>`${v}`,                     sfmt:v=>`${v}` },
  { key:"kw",       label:"Kilowatts",    short:"kW",     icon:"kW", color:T.cyan,   dim:T.cyanDm,                fmt:v=>`${v.toFixed(1)} kW`,       sfmt:v=>`${v.toFixed(0)}kW` },
  { key:"revenue",  label:"Revenue",      short:"Rev",    icon:"$",  color:T.green,  dim:T.greenDm,               fmt:v=>fmtNum(v),          sfmt:v=>fmtNumShort(v) },
  { key:"showRate", label:"Show Rate",    short:"Show%",  icon:"%",  color:T.amber,  dim:T.amberDm,               fmt:v=>`${v}%`,                    sfmt:v=>`${v}%` },
];

const AVATAR_PAL = [
  ["#5a85c8","#141e30"],["#c9922a","#0f2428"],["#7a6fb0","#1a1828"],
  ["#3d9e6a","#0f2219"],["#c9922a","#261c08"],["#c05060","#261014"],
  ["#8a7a5a","#201a10"],["#5a8a8a","#101e1e"],
];
const avBg     = n => AVATAR_PAL[n.charCodeAt(0) % AVATAR_PAL.length];
const initials = n => n.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);

// Derive live rep stats from allDeals — single source of truth for sales, revenue, kw
// appts and shows stay on rep object (set by dialer); sales/revenue/kw come from deals
// periodFilter: null = all time | "day" = today | "week" = last 7d | "month" = last 30d | "year" = last 365d
function deriveRepStats(rep, deals, periodFilter) {
  const myDeals = deals[rep.id] || [];
  const soldKeys = ["sold","site_survey","design","engineering","install_sched","installed","pto"];
  const now = new Date(); now.setHours(23,59,59,999);
  const dayStart = new Date(); dayStart.setHours(0,0,0,0);

  const inPeriod = (d) => {
    if (!periodFilter || periodFilter==="all") return true;
    if (!d.closeDate) return false; // no closeDate = can't attribute to a period
    // Parse as local date (append T12:00:00 to avoid UTC midnight shifting the day)
    const cd = new Date(d.closeDate + "T12:00:00");
    if (periodFilter==="day")   return cd >= dayStart && cd <= now;
    if (periodFilter==="week")  return cd >= new Date(now - 7*86400000);
    if (periodFilter==="month") return cd >= new Date(now - 30*86400000);
    if (periodFilter==="year")  return cd >= new Date(now - 365*86400000);
    return true;
  };

  const soldDeals = myDeals.filter(d => soldKeys.includes(d.status) && inPeriod(d));
  return {
    ...rep,
    sales:   soldDeals.length,
    revenue: soldDeals.reduce((s,d) => s + (d.price  || 0), 0),
    kw:      parseFloat(soldDeals.reduce((s,d) => s + (d.kw || 0), 0).toFixed(1)),
  };
}

const showRate = r => r.appts ? Math.round((r.shows/r.appts)*100) : 0;
const mval     = (r,k) => k==="showRate" ? showRate(r) : r[k];
const sortBy   = (reps,k) => [...reps].sort((a,b)=>mval(b,k)-mval(a,k));
const fmtM     = (k,v) => METRICS.find(m=>m.key===k)?.fmt(v)??v;

const REPS_DATA = [
   { id:1, name:"Marcus Rivera",  pin:"1111", sales:14, kw:98.2, revenue:72800, appts:48, shows:18, sparkline:[32,36,39,43,46,48], commPaid:18200, commPending:9400,  chargebacksTotal:1000 },
   { id:2, name:"Jade Thompson",  pin:"2222", sales:11, kw:74.6, revenue:57200, appts:38, shows:14, sparkline:[24,28,31,34,36,38], commPaid:13000, commPending:7800,  chargebacksTotal:500  },
   { id:3, name:"Casey Lin",      pin:"3333", sales:9,  kw:66.1, revenue:46800, appts:36, shows:13, sparkline:[22,25,28,31,34,36], commPaid:11200, commPending:6500,  chargebacksTotal:0    },
   { id:4, name:"Devon Okafor",   pin:"4444", sales:7,  kw:50.3, revenue:36400, appts:28, shows:9,  sparkline:[16,19,21,24,26,28], commPaid:8400,  commPending:4900,  chargebacksTotal:500  },
   { id:5, name:"Priya Nair",     pin:"5555", sales:4,  kw:31.2, revenue:20800, appts:22, shows:6,  sparkline:[10,13,15,17,19,22], commPaid:5200,  commPending:3800,  chargebacksTotal:0    },
   { id:6, name:"Tyler Moss",     pin:"6666", sales:2,  kw:18.4, revenue:10400, appts:16, shows:4,  sparkline:[7,9,11,12,14,16],   commPaid:2800,  commPending:1950,  chargebacksTotal:0    },
];
const ADMIN_PIN = "0000";
const SPARK_LABELS = ["W1","W2","W3","W4","W5","W6"];

/* ═══════════════════════════════════════════════════
   SETTER RANK SYSTEM
═══════════════════════════════════════════════════ */
const SETTER_RANKS = [
  {
    id:"rookie", title:"Rookie Setter", abbr:"RS", color:"#6b6b6b",
    bg:"rgba(107,107,107,0.1)", border:"rgba(107,107,107,0.25)",
    comp:{ pct:"25%", upfront:"$500", label:"25% commission · $500 upfront per deal" },
    req:"Min 15 sets · Show Rate Elite 30% or 3-mo total 28%",
    logo: (size=20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V12"/><path d="M12 12C12 8 8 5 4 6c0 4 3 7 8 6z"/><path d="M12 12C12 8 16 5 20 6c0 4-3 7-8 6z"/>
      </svg>
    ),
  },
  {
    id:"setter", title:"Setter", abbr:"S", color:"#7a8fa8",
    bg:"rgba(122,143,168,0.1)", border:"rgba(122,143,168,0.25)",
    comp:{ pct:"30%", upfront:"$500", label:"30% commission · $500 upfront per deal" },
    req:"Min 25 sets · Show Rate Elite 33% or 3-mo total 32%",
    logo: (size=20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    id:"setter_captain", title:"Setter Captain", abbr:"SC", color:T.blue,
    bg:"rgba(90,133,200,0.1)", border:"rgba(90,133,200,0.25)",
    comp:{ pct:"40%", upfront:"$750", label:"40% commission · $750 upfront per deal" },
    req:"Min 30 sets · Show Rate Elite 35% or 3-mo total 35%",
    logo: (size=20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <polygon points="12,8 13.2,11 16.5,11 13.8,13 14.8,16.5 12,14.5 9.2,16.5 10.2,13 7.5,11 10.8,11" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    id:"setter_manager", title:"Setter Manager", abbr:"SM", color:T.amber,
    bg:"rgba(74,159,168,0.1)", border:"rgba(74,159,168,0.25)",
    comp:{ pct:"50%", upfront:"$1,000", label:"50% commission · $1,000 upfront per deal" },
    req:"Min 30 sets · Leadership role",
    logo: (size=20) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 17l3-9 4.5 4.5L12 5l2.5 7.5L19 8l3 9H2z"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
];

// Map promo title to rank id for lookup
const PROMO_TO_RANK = {
  "Rookie Setter": "rookie",
  "Setter": "setter",
  "Setter Captain": "setter_captain",
  "Setter Manager": "setter_manager",
};

// Get rank = last fully completed rank tier (not the one being worked toward)
function getRepRank(rep) {
  if (rep.rankOverride) {
    const found = SETTER_RANKS.find(r => r.id === rep.rankOverride);
    if (found) return found;
  }
  // Use unscaled monthly actuals (_appts/_shows) if present, so rank never changes with period filter
  const appts = rep._appts !== undefined ? rep._appts : rep.appts;
  const shows  = rep._shows !== undefined ? rep._shows : rep.shows;
  const sr = appts ? Math.round((shows / appts) * 100) : 0;
  const ladder = [
    { id:"setter_manager", met: appts >= 45 && sr >= 35 },
    { id:"setter_captain", met: appts >= 35 && sr >= 35 },
    { id:"setter",         met: appts >= 25 && sr >= 30 },
    { id:"rookie",         met: appts >= 0  && sr >= 25 },
  ];
  const achieved = ladder.find(l => l.met);
  return SETTER_RANKS.find(r => r.id === achieved.id) || SETTER_RANKS[0];
}

// Returns the metric value for a given promotion criteria metric
function mvalPromo(rep, metric) {
  if (metric === "showRate") return rep.appts ? Math.round((rep.shows / rep.appts) * 100) : 0;
  return mval(rep, metric);
}

// Returns the PROMOTIONS_DATA entry whose targetRankId is the rank ABOVE the rep's current rank.
// Works for every rank — always points toward the next level.
function getNextRankPromo(rep) {
  const currentRank = getRepRank(rep);
  const currentIdx  = SETTER_RANKS.findIndex(r => r.id === currentRank.id);
  const nextRank    = SETTER_RANKS[currentIdx + 1] || null;
  if (!nextRank) return { nextRank: null, promo: null };
  const promo = PROMOTIONS_DATA.find(p => p.targetRankId === nextRank.id) || null;
  return { nextRank, promo };
}

// Promotion progress bar — all 4 ranks, partial fill on active segment
function RankProgressBar({ rep, compact=false }) {
  const currentRank = getRepRank(rep);
  const currentIdx  = SETTER_RANKS.findIndex(r => r.id === currentRank.id);
  const { nextRank, promo } = getNextRankPromo(rep);

  // For OR groups, use the best (max) progress within the group.
  // For standalone criteria, use their own progress. Average across all logical units.
  const segmentPct = promo ? (() => {
    const groups = {};
    const standalone = [];
    promo.criteria.forEach(c => {
      const val = mvalPromo(rep, c.metric);
      const pct = Math.min(100, Math.round((val / (c.goal || 1)) * 100));
      if (c.orGroup) {
        groups[c.orGroup] = Math.max(groups[c.orGroup] || 0, pct);
      } else {
        standalone.push(pct);
      }
    });
    const all = [...standalone, ...Object.values(groups)];
    return Math.round(all.reduce((s, p) => s + p, 0) / (all.length || 1));
  })() : 100;

  return (
    <div style={{width:"100%"}}>
      {!compact && (
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          {SETTER_RANKS.map((rank, i) => (
            <div key={rank.id} style={{flex:1,textAlign:"center"}}>
              <div style={{
                fontSize:10,fontWeight:i===currentIdx?700:400,
                color:i<currentIdx?T.green:i===currentIdx?rank.color:T.t3,
                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
                paddingLeft:i===0?0:4,paddingRight:i===SETTER_RANKS.length-1?0:4,
              }}>{rank.title}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",position:"relative"}}>
        {SETTER_RANKS.map((rank, i) => {
          const isDone    = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isLast    = i === SETTER_RANKS.length - 1;
          const nextRankColor = SETTER_RANKS[i + 1]?.color || T.t2;
          return (
            <React.Fragment key={rank.id}>
              <div style={{
                width:compact?20:28, height:compact?20:28,
                borderRadius:"50%",flexShrink:0,zIndex:1,
                background:isDone?"rgba(48,209,88,0.18)":isCurrent?`${rank.color}22`:"rgba(255,255,255,0.06)",
                border:`2px solid ${isDone?T.green:isCurrent?rank.color:"rgba(255,255,255,0.14)"}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                color:isDone?T.green:isCurrent?rank.color:T.t3,
                boxShadow:isCurrent?`0 0 10px ${rank.color}44`:"none",
                transition:"all 0.3s",
              }}>
                {isDone
                  ? <svg width={compact?8:10} height={compact?8:10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : typeof rank.logo==="function" ? rank.logo(compact?9:12) : null
                }
              </div>
              {!isLast && (
                <div style={{flex:1,height:compact?2:3,position:"relative",background:"rgba(255,255,255,0.08)",borderRadius:2}}>
                  <div style={{
                    position:"absolute",left:0,top:0,height:"100%",borderRadius:2,
                    background: isDone
                      ? "rgba(48,209,88,0.45)"
                      : isCurrent
                        ? `${nextRankColor}66`
                        : "transparent",
                    width: isDone ? "100%" : isCurrent ? `${segmentPct}%` : "0%",
                    transition:"width 0.8s cubic-bezier(0.22,1,0.36,1)",
                  }}/>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      {compact && (
        <div style={{textAlign:"center",marginTop:5,fontSize:10,color:currentRank.color,fontWeight:600}}>
          {currentRank.title}
        </div>
      )}
    </div>
  );
}

function RankBadgeInline({ rep, size="sm" }) {
  const rank = getRepRank(rep);
  const isLg = size==="lg";
  return (
    <div style={{
      display:"inline-flex", alignItems:"center", gap:isLg?7:5,
      padding:isLg?"5px 11px":"3px 8px",
      borderRadius:5,
      background:rank.bg, border:`1px solid ${rank.border}`,
      flexShrink:0,
    }}>
      <span style={{color:rank.color, display:"flex", alignItems:"center", lineHeight:1}}>
        {rank.logo(isLg?14:11)}
      </span>
      <span style={{
        fontSize:isLg?11:10, fontWeight:600,
        color:rank.color, letterSpacing:"0.03em",
        whiteSpace:"nowrap",
      }}>{rank.title}</span>
    </div>
  );
}



/* ═══════════════════════════════════════════════════
   CSS INJECTION
═══════════════════════════════════════════════════ */
// TODO: Replace with hosted URL (e.g. "/logo.png") before production to reduce bundle size
const APEX_LOGO_URL = "data:image/png;base64,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";

const injectCSS = () => {
  let el = document.getElementById("apex-v2");
  if (!el) { el = document.createElement("style"); el.id = "apex-v2"; document.head.appendChild(el); }
  el.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=SF+Pro+Display:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body,html{
      background:${T.bg0};font-family:'Inter',system-ui,-apple-system,sans-serif;
      -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
      color:${T.t1};
    }
    /* Layered ambient light — Apple-style */
    body::before{
      content:'';position:fixed;inset:0;z-index:0;pointer-events:none;
      background:
        radial-gradient(ellipse 90% 60% at 15% -5%, rgba(6,214,240,0.07) 0%, transparent 55%),
        radial-gradient(ellipse 70% 50% at 85% 105%, rgba(10,132,255,0.06) 0%, transparent 50%),
        radial-gradient(ellipse 50% 40% at 50% 50%, rgba(6,214,240,0.03) 0%, transparent 70%);
    }
    body::after{
      content:'';position:fixed;inset:0;z-index:0;pointer-events:none;
      background:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
      opacity:0.4;
    }
    ::-webkit-scrollbar{width:3px;height:3px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
    ::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.18)}

    /* ── keyframes ── */
    @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes ping{0%{transform:scale(1);opacity:0.8}70%{transform:scale(1.8);opacity:0}100%{transform:scale(1.8);opacity:0}}
    @keyframes scaleIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
    @keyframes slideRight{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
    @keyframes barGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @keyframes pinShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
    @keyframes dotPop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(6,214,240,0.15)}50%{box-shadow:0 0 40px rgba(6,214,240,0.3)}}

    .afu{animation:fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) forwards}
    .afi{animation:fadeIn 0.3s ease forwards}
    .asi{animation:scaleIn 0.35s cubic-bezier(0.22,1,0.36,1) forwards}
    .asr{animation:slideRight 0.3s cubic-bezier(0.22,1,0.36,1) forwards}

    /* ── GLASS BASE — Apple liquid glass ── */
    .glass{
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08);
      backdrop-filter:blur(40px) saturate(1.8);-webkit-backdrop-filter:blur(40px) saturate(1.8);
    }
    
    /* ── base card ── */
    .card{
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:${T.radL};
      backdrop-filter:blur(32px) saturate(1.6);-webkit-backdrop-filter:blur(32px) saturate(1.6);
      transition:border-color 0.2s,box-shadow 0.2s;
      box-shadow:0 1px 0 rgba(255,255,255,0.07) inset,0 8px 32px rgba(0,0,0,0.4),0 2px 8px rgba(0,0,0,0.2);
    }
    .card:hover{
      border-color:rgba(255,255,255,0.13);
      box-shadow:0 1px 0 rgba(255,255,255,0.09) inset,0 16px 48px rgba(0,0,0,0.45),0 0 0 1px rgba(6,214,240,0.06);
    }

    /* ── rep card ── */
    .rcard{
      background:rgba(255,255,255,0.035);
      border:1px solid rgba(255,255,255,0.07);
      border-radius:${T.radXl};position:relative;overflow:hidden;
      backdrop-filter:blur(40px) saturate(1.8);-webkit-backdrop-filter:blur(40px) saturate(1.8);
      transition:border-color 0.25s,box-shadow 0.25s,transform 0.25s;
      box-shadow:0 1px 0 rgba(255,255,255,0.06) inset,0 4px 24px rgba(0,0,0,0.35);
    }
    /* Specular top highlight */
    .rcard::before{
      content:'';position:absolute;top:0;left:0;right:0;height:1px;
      background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.18) 30%,rgba(255,255,255,0.24) 50%,rgba(255,255,255,0.18) 70%,transparent 100%);
      pointer-events:none;z-index:1;
    }
    .rcard::after{
      content:'';position:absolute;inset:0;pointer-events:none;
      background:linear-gradient(135deg,rgba(255,255,255,0.025) 0%,transparent 50%);
    }
    @media(hover:hover){
      .rcard:hover{
        border-color:rgba(255,255,255,0.14);
        box-shadow:0 1px 0 rgba(255,255,255,0.1) inset,0 20px 60px rgba(0,0,0,0.5),0 0 0 1px rgba(6,214,240,0.08),0 0 40px rgba(6,214,240,0.04);
        transform:translateY(-2px);
      }
    }
    /* Rank glow accents */
    .rcard.r0{border-color:rgba(255,214,10,0.22);box-shadow:0 1px 0 rgba(255,214,10,0.1) inset,0 4px 24px rgba(0,0,0,0.4),0 0 32px rgba(255,214,10,0.05)}
    .rcard.r1{border-color:rgba(196,196,198,0.16);box-shadow:0 1px 0 rgba(196,196,198,0.07) inset,0 4px 20px rgba(0,0,0,0.35)}
    .rcard.r2{border-color:rgba(191,126,58,0.14);box-shadow:0 1px 0 rgba(191,126,58,0.06) inset,0 4px 20px rgba(0,0,0,0.35)}

    /* ── metric tab ── */
    .mtab{
      display:flex;align-items:center;gap:6px;
      padding:7px 16px;border-radius:${T.radL};
      border:1px solid rgba(255,255,255,0.07);
      background:rgba(255,255,255,0.04);
      color:${T.t2};
      font-family:'Inter',sans-serif;font-size:12.5px;font-weight:500;
      cursor:pointer;transition:all 0.18s;white-space:nowrap;letter-spacing:-0.01em;
      backdrop-filter:blur(20px);
    }
    .mtab:hover{
      background:rgba(255,255,255,0.07);
      border-color:rgba(255,255,255,0.12);
      color:${T.t1};
    }
    .mtab.on{color:#fff;border-color:transparent;font-weight:600;
      box-shadow:0 1px 0 rgba(255,255,255,0.12) inset,0 4px 16px rgba(0,0,0,0.3);
    }

    /* ── mobile metric chip ── */
    .mchip{
      display:flex;flex-direction:column;align-items:center;gap:3px;
      padding:10px 10px;border-radius:12px;
      border:1px solid rgba(255,255,255,0.06);
      background:rgba(255,255,255,0.03);
      cursor:pointer;transition:all 0.18s;flex:1;
      font-family:'Inter',sans-serif;
      backdrop-filter:blur(20px);
    }
    .mchip:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.1)}
    .mchip.on{border-color:transparent;box-shadow:0 1px 0 rgba(255,255,255,0.1) inset}

    /* ── stat pill ── */
    .spill{
      display:flex;flex-direction:column;
      padding:12px 14px;border-radius:12px;
      border:1px solid rgba(255,255,255,0.14);
      background:rgba(255,255,255,0.08);
      flex:1;min-width:0;
      backdrop-filter:blur(24px);
      box-shadow:0 1px 0 rgba(255,255,255,0.12) inset;
    }
    .spill .caps{min-height:22px;display:flex;align-items:flex-start;}
    .spill .mono{margin-top:4px;}

    /* ── progress bar ── */
    .ptrack{height:2px;border-radius:2px;background:rgba(255,255,255,0.06);overflow:hidden}
    .pfill{height:100%;border-radius:2px;transform-origin:left;animation:barGrow 1s cubic-bezier(0.22,1,0.36,1) forwards}

    /* ── pin pad ── */
    .pin-key{
      width:100%;aspect-ratio:1.4/1;border-radius:14px;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.1);
      color:${T.t1};font-family:'Inter',sans-serif;font-size:21px;font-weight:500;
      cursor:pointer;transition:all 0.12s;display:flex;align-items:center;justify-content:center;
      -webkit-tap-highlight-color:transparent;
      backdrop-filter:blur(20px);
      box-shadow:0 1px 0 rgba(255,255,255,0.1) inset,0 2px 8px rgba(0,0,0,0.25);
    }
    .pin-key:hover{background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.16)}
    .pin-key:active{transform:scale(0.94);background:rgba(255,255,255,0.14)}
    .pin-key.zero{grid-column:2}
    .pin-key.del{background:transparent;border-color:transparent;color:${T.t3};font-size:22px;box-shadow:none}
    .pin-key.del:hover{color:${T.t1};background:rgba(255,255,255,0.06)}

    /* ── buttons ── */
    .btn-cyan{
      background:${T.cyan};color:#021014;
      font-family:'Inter',sans-serif;font-size:14px;font-weight:650;
      border:none;border-radius:12px;padding:13px 24px;
      cursor:pointer;transition:all 0.18s;letter-spacing:-0.01em;width:100%;
      box-shadow:0 1px 0 rgba(255,255,255,0.3) inset,0 8px 24px rgba(6,214,240,0.25),0 2px 6px rgba(0,0,0,0.2);
    }
    .btn-cyan:hover{
      background:${T.cyanLt};
      box-shadow:0 1px 0 rgba(255,255,255,0.35) inset,0 12px 32px rgba(6,214,240,0.35),0 2px 6px rgba(0,0,0,0.2);
      transform:translateY(-1px);
    }
    .btn-cyan:active{transform:translateY(0);box-shadow:0 1px 0 rgba(255,255,255,0.2) inset,0 4px 12px rgba(6,214,240,0.2)}
    .btn-cyan:disabled{opacity:0.4;pointer-events:none}
    .btn-out{
      background:rgba(255,255,255,0.06);color:${T.t2};
      font-family:'Inter',sans-serif;font-size:13px;font-weight:500;
      border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:9px 18px;
      cursor:pointer;transition:all 0.16s;
      backdrop-filter:blur(20px);
      box-shadow:0 1px 0 rgba(255,255,255,0.08) inset;
    }
    .btn-out:hover{border-color:rgba(255,255,255,0.18);color:${T.t1};background:rgba(255,255,255,0.09)}
    .btn-sm{
      background:rgba(255,255,255,0.05);color:${T.t2};
      font-family:'Inter',sans-serif;font-size:11.5px;font-weight:500;
      border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:5px 12px;
      cursor:pointer;transition:all 0.14s;
    }
    .btn-sm:hover{border-color:rgba(255,255,255,0.15);color:${T.t1};background:rgba(255,255,255,0.09)}
    .btn-del{
      background:rgba(255,69,58,0.08);color:${T.red};
      border:1px solid rgba(255,69,58,0.2);border-radius:8px;
      padding:5px 10px;font-size:11.5px;cursor:pointer;
      font-family:'Inter',sans-serif;transition:all 0.14s;
    }
    .btn-del:hover{background:rgba(255,69,58,0.14);border-color:rgba(255,69,58,0.35)}

    /* ── period selector ── */
    .pgroup{
      display:flex;
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08);
      backdrop-filter:blur(24px);
      border-radius:${T.rad};padding:3px;gap:2px;
      box-shadow:0 1px 0 rgba(255,255,255,0.06) inset;
    }
    .pbtn{
      font-size:11.5px;font-weight:500;padding:5px 13px;border-radius:7px;border:none;
      background:transparent;color:${T.t3};cursor:pointer;transition:all 0.15s;
      font-family:'Inter',sans-serif;
    }
    .pbtn.on{
      background:rgba(255,255,255,0.09);color:${T.t1};
      border:1px solid rgba(255,255,255,0.12);
      box-shadow:0 1px 0 rgba(255,255,255,0.1) inset,0 2px 8px rgba(0,0,0,0.25);
    }

    /* ── inputs ── */
    .hinput{
      background:rgba(255,255,255,0.05);
      border:1px solid rgba(255,255,255,0.1);
      backdrop-filter:blur(20px);border-radius:${T.rad};
      color:${T.t1};padding:10px 14px;
      font-family:'Inter',sans-serif;font-size:13.5px;
      outline:none;width:100%;transition:border-color 0.2s,box-shadow 0.2s;
      box-shadow:0 1px 0 rgba(255,255,255,0.04) inset;
    }
    .hinput:focus{
      border-color:rgba(6,214,240,0.5);
      box-shadow:0 0 0 3px rgba(6,214,240,0.1),0 1px 0 rgba(255,255,255,0.04) inset;
    }
    .hinput::placeholder{color:${T.t3}}

    /* ── modal — deep glass ── */
    .moverlay{
      position:fixed;inset:0;
      background:rgba(0,0,0,0.72);
      backdrop-filter:blur(40px) saturate(0.7);
      z-index:200;
      display:flex;align-items:center;justify-content:center;padding:20px;
      animation:fadeIn 0.2s ease;
    }
    .mpanel{
      background:rgba(16,22,32,0.92);
      border:1px solid rgba(255,255,255,0.1);
      border-radius:24px;padding:30px;
      width:100%;max-width:440px;
      backdrop-filter:blur(60px) saturate(1.8);-webkit-backdrop-filter:blur(60px) saturate(1.8);
      box-shadow:
        0 1px 0 rgba(255,255,255,0.1) inset,
        0 -1px 0 rgba(0,0,0,0.3) inset,
        0 48px 120px rgba(0,0,0,0.8),
        0 0 80px rgba(6,214,240,0.04);
      animation:scaleIn 0.3s cubic-bezier(0.22,1,0.36,1);
      max-height:90vh;overflow-y:auto;
      position:relative;
    }
    .mpanel::before{
      content:'';position:absolute;top:0;left:0;right:0;height:1px;border-radius:24px 24px 0 0;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,0.18) 30%,rgba(255,255,255,0.22) 50%,rgba(255,255,255,0.18) 70%,transparent);
    }

    /* ── search ── */
    .swrap{position:relative}
    .swrap svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none}
    .sinput{
      background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);
      backdrop-filter:blur(20px);border-radius:${T.rad};
      color:${T.t1};padding:9px 14px 9px 38px;
      font-family:'Inter',sans-serif;font-size:13px;
      outline:none;transition:all 0.2s;width:100%;
    }
    .sinput:focus{border-color:rgba(6,214,240,0.45);box-shadow:0 0 0 3px rgba(6,214,240,0.08)}
    .sinput::placeholder{color:${T.t3}}

    /* ── toast ── */
    .toast{
      position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
      background:rgba(20,28,40,0.95);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:14px;
      padding:11px 20px;
      font-family:'Inter',sans-serif;font-size:13px;color:${T.t1};
      box-shadow:0 1px 0 rgba(255,255,255,0.1) inset,0 24px 64px rgba(0,0,0,0.6);
      z-index:300;
      animation:fadeUp 0.3s cubic-bezier(0.22,1,0.36,1);
      display:flex;align-items:center;gap:10px;white-space:nowrap;
      backdrop-filter:blur(40px);
    }

    /* ── utility ── */
    .mono{font-family:'JetBrains Mono',monospace}
    .caps{font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${T.t2}}
    .divider{height:1px;background:rgba(255,255,255,0.06)}
    .admin-fns{opacity:0;transition:opacity 0.16s}
    @media(hover:hover){.rcard:hover .admin-fns{opacity:1}}
    @media(hover:none){.admin-fns{opacity:1}}

    /* ── deal tracker ── */
    .deal-card{
      background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
      border-radius:14px;backdrop-filter:blur(32px);
      transition:border-color 0.2s,box-shadow 0.2s;position:relative;overflow:hidden;
      box-shadow:0 1px 0 rgba(255,255,255,0.05) inset;
    }
    .deal-card::before{
      content:'';position:absolute;top:0;left:0;right:0;height:1px;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12) 50%,transparent);
    }
    .deal-card:hover{border-color:rgba(255,255,255,0.12);box-shadow:0 1px 0 rgba(255,255,255,0.07) inset,0 12px 36px rgba(0,0,0,0.4)}
    .stage-btn{
      display:flex;align-items:center;justify-content:center;padding:7px 0;
      border-radius:9px;border:1px solid rgba(255,255,255,0.07);
      background:rgba(255,255,255,0.03);
      cursor:pointer;transition:all 0.15s;font-family:'Inter',sans-serif;
      font-size:11.5px;font-weight:500;color:${T.t3};flex:1;
    }
    .stage-btn:hover{background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.12);color:${T.t1}}
    .stage-btn.active{font-weight:700;border-color:transparent}
    .adder-chip{
      display:inline-flex;align-items:center;gap:6px;padding:5px 11px;
      border-radius:8px;background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08);
      font-size:12px;color:${T.t2};cursor:pointer;transition:all 0.14s;
      font-family:'Inter',sans-serif;
    }
    .adder-chip:hover{border-color:rgba(255,255,255,0.14);color:${T.t1}}
    .adder-chip.on{background:rgba(6,214,240,0.1);border-color:rgba(6,214,240,0.35);color:${T.cyan}}
    .tab-nav-btn{
      display:flex;align-items:center;gap:6px;padding:7px 16px;border-radius:10px;
      border:1px solid rgba(255,255,255,0.07);
      background:rgba(255,255,255,0.04);color:${T.t2};
      font-family:'Inter',sans-serif;font-size:12.5px;font-weight:500;
      cursor:pointer;transition:all 0.15s;white-space:nowrap;
      backdrop-filter:blur(20px);
    }
    .tab-nav-btn:hover{background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.12);color:${T.t1}}
    .tab-nav-btn.on{
      background:rgba(6,214,240,0.1);border-color:rgba(6,214,240,0.35);
      color:${T.cyan};font-weight:600;
      box-shadow:0 0 16px rgba(6,214,240,0.1);
    }
    .deal-stat-box{
      display:flex;flex-direction:column;gap:3px;padding:12px 14px;
      border-radius:10px;background:rgba(255,255,255,0.03);
      border:1px solid rgba(255,255,255,0.07);flex:1;min-width:0;
      backdrop-filter:blur(20px);
      box-shadow:0 1px 0 rgba(255,255,255,0.05) inset;
    }

    /* ── incentives ── */
    .inc-card{
      background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);
      border-radius:18px;backdrop-filter:blur(40px);
      position:relative;overflow:hidden;transition:border-color 0.2s,box-shadow 0.2s;
      box-shadow:0 1px 0 rgba(255,255,255,0.07) inset;
    }
    .inc-card::before{
      content:'';position:absolute;top:0;left:0;right:0;height:1px;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2) 50%,transparent);
    }
    .inc-card:hover{border-color:rgba(255,255,255,0.13);box-shadow:0 1px 0 rgba(255,255,255,0.09) inset,0 12px 32px rgba(0,0,0,0.35)}
    .rep-race-row{
      display:flex;align-items:center;gap:10px;padding:10px 13px;
      border-radius:10px;border:1px solid rgba(255,255,255,0.06);
      background:rgba(255,255,255,0.03);backdrop-filter:blur(20px);
      transition:background 0.15s,border-color 0.15s;
    }
    .rep-race-row:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.1)}
    .rep-race-row.is-me{border-color:rgba(6,214,240,0.25);background:rgba(6,214,240,0.06)}
    .promo-card{
      background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);
      border-radius:18px;backdrop-filter:blur(40px);
      position:relative;overflow:hidden;transition:border-color 0.2s,box-shadow 0.2s;
      box-shadow:0 1px 0 rgba(255,255,255,0.07) inset;
    }
    .promo-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.18) 50%,transparent);}
    .promo-card:hover{border-color:rgba(255,255,255,0.13);box-shadow:0 1px 0 rgba(255,255,255,0.09) inset,0 16px 48px rgba(0,0,0,0.4)}
    .countdown-box{
      display:flex;flex-direction:column;align-items:center;gap:2px;
      background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);
      border-radius:9px;padding:8px 12px;min-width:46px;
      backdrop-filter:blur(20px);
      box-shadow:0 1px 0 rgba(255,255,255,0.08) inset;
    }
    .tier-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:10px;font-size:11px;font-weight:700;letter-spacing:0.04em}
    @keyframes tickPulse{0%,100%{opacity:1}50%{opacity:0.5}}
    .tick{animation:tickPulse 1s ease infinite}
    button:focus-visible,[tabindex]:focus-visible{outline:2px solid ${T.cyan};outline-offset:2px}
    a:focus-visible{outline:2px solid ${T.cyan};outline-offset:2px}
  `;
};

/* ═══════════════════════════════════════════════════
   ATOMS
═══════════════════════════════════════════════════ */
/* Muted glass avatar palette — 8 distinct but desaturated hues */
const AV_GLASS = [
  {bg:"rgba(10,132,255,0.18)",  border:"rgba(10,132,255,0.3)",  color:"#6eb9ff"},
  {bg:"rgba(191,90,242,0.15)",  border:"rgba(191,90,242,0.28)", color:"#d18fff"},
  {bg:"rgba(48,209,88,0.14)",   border:"rgba(48,209,88,0.26)",  color:"#72e695"},
  {bg:"rgba(255,159,10,0.15)",  border:"rgba(255,159,10,0.28)", color:"#ffc24d"},
  {bg:"rgba(6,214,240,0.14)",   border:"rgba(6,214,240,0.26)",  color:"#5ee8fb"},
  {bg:"rgba(255,69,58,0.14)",   border:"rgba(255,69,58,0.26)",  color:"#ff897f"},
  {bg:"rgba(255,214,10,0.14)",  border:"rgba(255,214,10,0.26)", color:"#ffe566"},
  {bg:"rgba(90,200,250,0.14)",  border:"rgba(90,200,250,0.26)", color:"#7ed5fd"},
];
function Avatar({ name, size=44, ring=null }) {
  const n=name.trim(); const av = AV_GLASS[(n.charCodeAt(0)*3 + n.charCodeAt(n.length-1)*7 + n.length*7) % AV_GLASS.length];
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background:`radial-gradient(circle at 35% 35%, ${av.bg.replace('0.18','0.28').replace('0.14','0.22').replace('0.15','0.24').replace('0.16','0.24')}, ${av.bg})`,
      border:`1px solid ${ring ? ring+"60" : av.border}`,
      backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.32, fontWeight:600, color:av.color,
      fontFamily:"'Inter', system-ui, sans-serif", flexShrink:0, letterSpacing:"-0.01em",
      boxShadow: ring
        ? `0 0 0 2px ${ring}28, 0 0 12px ${ring}18, 0 2px 12px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.15) inset`
        : `0 2px 12px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.12) inset`,
      transition:"box-shadow 0.2s",
      position:"relative",
      overflow:"hidden",
    }}>
      <div style={{
        position:"absolute",top:0,left:0,right:0,height:"45%",
        background:"linear-gradient(180deg,rgba(255,255,255,0.15) 0%,transparent 100%)",
        borderRadius:"50% 50% 0 0 / 40% 40% 0 0",
        pointerEvents:"none",
      }}/>
      {initials(name)}
    </div>
  );
}

function RankBadge({ rank, size=32 }) {
  const rDm  = rank===0?T.r0dm:rank===1?T.r1dm:T.r2dm;
  const rCol = rank===0?T.r0:rank===1?T.r1:T.r2;
  if (rank < 3) return (
    <div style={{
      width:size, height:size, borderRadius:8,
      background:rDm,
      border:`1px solid ${rCol}44`,
      backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
    }}>
      <span className="mono" style={{fontSize:size*0.38, fontWeight:700, color:rCol, letterSpacing:"-0.03em"}}>{rank+1}</span>
    </div>
  );
  return (
    <div style={{
      width:size, height:size, borderRadius:8,
      background:"transparent", border:`1px solid rgba(255,255,255,0.04)`,
      display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
    }}>
      <span className="mono" style={{ fontSize:size*0.36, color:T.t3, fontWeight:500 }}>{rank+1}</span>
    </div>
  );
}

function ProgressBar({ value, max, color, delay=0 }) {
  const pct = Math.min((value / (max||1)) * 100, 100);
  return (
    <div className="ptrack">
      <div className="pfill" style={{
        width:`${pct}%`, background:color,
        boxShadow:"none",
        animationDelay:`${delay}ms`,
      }}/>
    </div>
  );
}

function Sparkline({ data, color }) {
  const d = data.map((v,i)=>({ x:SPARK_LABELS[i], v }));
  const id = `sg${color.replace(/[^a-z0-9]/gi,"")}`;
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={d} margin={{top:3,right:0,bottom:0,left:0}}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.28}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          dot={false} fill={`url(#${id})`}/>
        <Tooltip content={({active,payload})=>
          active&&payload?.length
            ? <div style={{background:"rgba(18,24,36,0.95)",border:`1px solid rgba(255,255,255,0.12)`,borderRadius:8,padding:"7px 12px",fontSize:12,fontFamily:"'Inter', system-ui, sans-serif",backdropFilter:"blur(20px)",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
                <span style={{color:T.t2,marginRight:5}}>{payload[0]?.payload?.x}</span>
                <span style={{fontWeight:600,color:T.t1}}>{payload[0]?.value}</span>
              </div>
            : null
        }/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ShowArc({ value, size=64 }) {
  const col = value>=35?T.green:value>=25?T.amber:T.red;
  const r=24, circ=2*Math.PI*r, arc=circ*0.72;
  const offset=arc-(arc*value/100);
  return (
    <svg width={size} height={size*0.65} viewBox="0 0 64 42" overflow="visible">
      <path d="M 8 38 A 24 24 0 1 1 56 38" fill="none" stroke={"rgba(255,255,255,0.08)"} strokeWidth="4.5" strokeLinecap="round"/>
      <path d="M 8 38 A 24 24 0 1 1 56 38" fill="none" stroke={col} strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={offset}
        style={{transition:"stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)",}}/>
      <text x="32" y="35" textAnchor="middle" fill={T.t1} fontSize="13" fontWeight="700" fontFamily="'JetBrains Mono', monospace">{value}%</text>
    </svg>
  );
}

function LiveDot({ color=T.green }) {
  return (
    <div style={{
      width:7, height:7, borderRadius:"50%",
      background:color, flexShrink:0,
      boxShadow:"none",
      animation:"pulse 2s ease infinite",
    }}/>
  );
}

function Toast({ msg, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,2600); return ()=>clearTimeout(t); },[onClose]);
  return <div className="toast"><LiveDot/>{msg}</div>;
}

/* ═══════════════════════════════════════════════════
   HOOK: window size
═══════════════════════════════════════════════════ */
function useWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(()=>{
    let t;
    const h = ()=>{ clearTimeout(t); t=setTimeout(()=>setW(window.innerWidth),150); };
    window.addEventListener("resize",h);
    return ()=>{ window.removeEventListener("resize",h); clearTimeout(t); };
  },[]);
  return w;
}

/* ═══════════════════════════════════════════════════
   LOGIN SCREEN
═══════════════════════════════════════════════════ */
function LoginScreen({ reps, onLogin }) {
  const [selected, setSelected] = useState(null);
  const [pin,      setPin]      = useState("");
  const [error,    setError]    = useState(false);
  const [shake,    setShake]    = useState(false);
  const [step,     setStep]     = useState("pick"); // pick | enter
  const width = useWidth();
  const isMobile = width < 640;

  // Keyboard support for PIN entry
  useEffect(()=>{
    if (step !== "enter") return;
    const onKey = (e) => {
      if (e.key >= "0" && e.key <= "9") handleKey(e.key);
      else if (e.key === "Backspace") delPin();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, pin]);

  const handleKey = (k) => {
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      setTimeout(()=>tryLogin(next), 120);
    }
  };

  const tryLogin = (p) => {
    if (p === ADMIN_PIN) { onLogin({ name:"Admin", isAdmin:true }); return; }
    const rep = reps.find(r=>r.pin===p);
    if (rep) { onLogin({ ...rep, isAdmin:false }); return; }
    // wrong
    setShake(true);
    setError(true);
    setPin("");
    setTimeout(()=>setShake(false), 500);
  };

  const delPin = () => { setPin(p=>p.slice(0,-1)); setError(false); };
  const KEYS   = ["1","2","3","4","5","6","7","8","9"];

  return (
    <div style={{
      minHeight:"100vh", background:T.bg0,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"24px 20px", position:"relative", overflow:"hidden",
    }}>
      {/* ambient glow */}
      <div style={{
        position:"absolute", top:"-20%", left:"50%", transform:"translateX(-50%)",
        width:"70vw", height:"60vh",
        background:`radial-gradient(ellipse, ${T.cyanGl} 0%, transparent 68%)`,
        pointerEvents:"none", opacity:0.55,
      }}/>
      <div style={{
          position:"relative", zIndex:1, width:"100%", maxWidth:380,
          background:"rgba(255,255,255,0.045)",
          border:"1px solid rgba(255,255,255,0.11)",
          borderRadius:28,
          backdropFilter:"blur(60px) saturate(1.8)",
          WebkitBackdropFilter:"blur(60px) saturate(1.8)",
          padding:"36px 30px",
          boxShadow:"0 1px 0 rgba(255,255,255,0.15) inset,0 -1px 0 rgba(0,0,0,0.2) inset,0 48px 120px rgba(0,0,0,0.7),0 0 80px rgba(6,214,240,0.04)",
        }}>

        {/* Specular top highlight */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:"1px",borderRadius:"28px 28px 0 0",background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.22) 30%,rgba(255,255,255,0.28) 50%,rgba(255,255,255,0.22) 70%,transparent)",pointerEvents:"none"}}/>

        {/* Apex Academy Logo */}
        <div className="afu" style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:28}}>
          <img src={APEX_LOGO_URL} alt="Apex Academy" style={{width:140,marginBottom:8,filter:"drop-shadow(0 0 20px rgba(255,255,255,0.2))"}}/>
        </div>

        {step==="pick" && (
          <div className="afu" style={{ animationDelay:"80ms", opacity:0 }}>
            <div style={{ fontSize:13.5, color:T.t2, textAlign:"center", marginBottom:18, fontWeight:500 }}>
              Who are you?
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {reps.map((rep,i)=>(
                <button key={rep.id}
                  className="afu"
                  style={{
                    animationDelay:`${100+i*40}ms`, opacity:0,
                    display:"flex", alignItems:"center", gap:12,
                    background: selected?.id===rep.id ? "rgba(6,214,240,0.1)" : "rgba(255,255,255,0.04)",
                    border:`1px solid ${selected?.id===rep.id ? "rgba(6,214,240,0.4)" : "rgba(255,255,255,0.09)"}`,
                    borderRadius:14, padding:"12px 16px",
                    cursor:"pointer", transition:"all 0.2s", textAlign:"left",
                    fontFamily:"'Inter',system-ui,sans-serif",
                    backdropFilter:"blur(20px)",
                    boxShadow: selected?.id===rep.id
                      ? "0 1px 0 rgba(255,255,255,0.1) inset, 0 4px 16px rgba(6,214,240,0.12)"
                      : "0 1px 0 rgba(255,255,255,0.06) inset",
                  }}
                  onClick={()=>{ setSelected(rep); setStep("enter"); setPin(""); setError(false); }}>
                  <Avatar name={rep.name} size={36}/>
                  <span style={{ fontWeight:600, fontSize:14, color:T.t1, letterSpacing:"-0.01em" }}>
                    {rep.name}
                  </span>
                  <svg style={{marginLeft:"auto",color:T.t3}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              ))}
              {/* admin ghost entry */}
              <button style={{
                background:"transparent", border:"none", cursor:"pointer",
                fontSize:12, color:T.t3, marginTop:6, fontFamily:"'Inter',system-ui,sans-serif",
                padding:"6px",
              }} onClick={()=>{ setSelected({name:"Admin"}); setStep("enter"); setPin(""); setError(false); }}>
                Admin access →
              </button>
            </div>
          </div>
        )}

        {step==="enter" && (
          <div className="asi" style={{ opacity:0 }}>
            {/* back + who */}
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
              <button style={{
                background:"rgba(255,255,255,0.06)", border:`1px solid rgba(255,255,255,0.11)`, borderRadius:10,
                padding:"7px 12px", cursor:"pointer", color:T.t2, display:"flex",
                fontFamily:"'Inter',system-ui,sans-serif", fontSize:13,
                backdropFilter:"blur(20px)",
                boxShadow:"0 1px 0 rgba(255,255,255,0.08) inset",
              }} onClick={()=>{ setStep("pick"); setSelected(null); setPin(""); setError(false); }}>
                ← Back
              </button>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                {selected?.name!=="Admin" && <Avatar name={selected?.name||""} size={32}/>}
                <span style={{ fontWeight:600, fontSize:14, color:T.t1 }}>{selected?.name}</span>
              </div>
            </div>

            {/* pin dots */}
            <div style={{ display:"flex", justifyContent:"center", gap:14, marginBottom:32 }}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{
                  width:13, height:13, borderRadius:"50%",
                  background: pin.length>i
                    ? error ? T.rose : T.cyan
                    : "rgba(255,255,255,0.08)",
                  transition:"background 0.15s, transform 0.15s",
                  transform: pin.length>i ? "scale(1.15)" : "scale(1)",
                  boxShadow: pin.length>i && !error ? `0 0 8px ${T.cyan}88` : "none",
                  animation: pin.length===i+1 ? "dotPop 0.2s ease" : "none",
                }}/>
              ))}
            </div>

            {error && (
              <div style={{ textAlign:"center", fontSize:12.5, color:T.rose, marginBottom:16, fontWeight:500 }}>
                Incorrect PIN — try again
              </div>
            )}

            {/* keypad */}
            <div style={{
              display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9,
              animation: shake ? "pinShake 0.4s ease" : "none",
            }}>
              {KEYS.map(k=>(
                <button key={k} className="pin-key" onClick={()=>handleKey(k)}>{k}</button>
              ))}
              <div/>
              <button className="pin-key zero" onClick={()=>handleKey("0")}>0</button>
              <button className="pin-key del" onClick={delPin}>⌫</button>
            </div>

            <div style={{ textAlign:"center", marginTop:20, fontSize:12, color:T.t3 }}>
              Enter your 4-digit PIN
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PODIUM
═══════════════════════════════════════════════════ */
function Podium({ reps, metric, isMobile }) {
  const m   = METRICS.find(x=>x.key===metric);
  const top = sortBy(reps, metric).slice(0,3);
  if (top.length < 2) return null;
  const slots = [
    { rep:top[1], rank:1, h:isMobile?100:120, av:isMobile?42:50 },
    { rep:top[0], rank:0, h:isMobile?130:155, av:isMobile?54:62 },
    { rep:top[2]||null, rank:2, h:isMobile?84:100, av:isMobile?38:46 },
  ];
  const rc = [T.r0, T.r1, T.r2];
  const md = ["1","2","3"];

  return (
    <div className="card" style={{ overflow:"hidden", position:"relative", marginBottom:20, padding:"24px 16px 0" }}>
      {/* Top ambient glow */}
      <div style={{
        position:"absolute", top:-60, left:"50%", transform:"translateX(-50%)",
        width:"60%", height:140,
        background:`radial-gradient(ellipse, rgba(255,214,10,0.07) 0%, rgba(6,214,240,0.04) 40%, transparent 70%)`,
        pointerEvents:"none",
      }}/>
      {/* Subtle grid lines */}
      <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px)",backgroundSize:"100% 40px",pointerEvents:"none",opacity:0.4}}/>

      <div style={{ display:"flex", justifyContent:"center", alignItems:"flex-end", gap:isMobile?4:8, position:"relative" }}>
        {slots.map(({rep,rank,h,av},si)=>{
          if(!rep) return <div key={si} style={{width:isMobile?100:160}}/>;
          const val=mval(rep,metric);
          const c=rc[rank]; const isNo1=rank===0;
          const glowColor = rank===0?"rgba(255,214,10,0.12)":rank===1?"rgba(196,196,198,0.07)":"rgba(191,126,58,0.07)";
          return (
            <div key={rep.id} style={{
              width:isMobile?110:172, minHeight:h,
              background:`linear-gradient(180deg,${glowColor} 0%,transparent 70%)`,
              border:`1px solid ${c}30`, borderBottom:"none",
              borderRadius:"16px 16px 0 0", padding:isMobile?"18px 10px 22px":"22px 14px 26px",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end",
              position:"relative", overflow:"hidden",
            }}>
              {/* specular top line */}
              <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${c}50,transparent)`}}/>
              {/* rank medal badge */}
              <div style={{
                fontSize:isNo1?14:12,fontWeight:800,marginBottom:12,
                color:c,letterSpacing:"-0.02em",fontFamily:"'JetBrains Mono',monospace",
                background:`${c}18`,
                border:`1px solid ${c}40`,
                padding:"3px 12px",borderRadius:7,
                backdropFilter:"blur(12px)",
                boxShadow:`0 0 12px ${c}20`,
              }}>{md[rank]}</div>
              <Avatar name={rep.name} size={av} ring={c}/>
              <div style={{fontWeight:700,fontSize:isMobile?12:13.5,color:T.t1,marginTop:11,textAlign:"center",letterSpacing:"-0.02em"}}>
                {rep.name.split(" ")[0]}
              </div>
              <div className="mono" style={{
                fontWeight:800, fontSize:isNo1?(isMobile?23:28):(isMobile?17:22),
                color:c, lineHeight:1, marginTop:6,
                textShadow:isNo1?`0 0 20px ${c}60`:"none",
              }}>{m.fmt(val)}</div>
              <div className="caps" style={{marginTop:5,color:T.t3,fontSize:9}}>{m.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   METRIC SELECTOR — mobile chips vs desktop tabs
═══════════════════════════════════════════════════ */
function MetricSelector({ active, onChange, isMobile }) {
  if (isMobile) return (
    <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:16 }}>
      {METRICS.map(m=>{
        const isOn = active===m.key;
        return (
          <button key={m.key} className={`mchip${isOn?" on":""}`}
            style={isOn?{background:m.dim,borderColor:`${m.color}44`}:{}}
            onClick={()=>onChange(m.key)}>
            <span style={{fontSize:11,fontWeight:isOn?600:500,color:isOn?m.color:T.t3,whiteSpace:"nowrap"}}>
              {m.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:24 }}>
      {METRICS.map(m=>{
        const isOn=active===m.key;
        return (
          <button key={m.key} className={`mtab${isOn?" on":""}`}
            style={isOn?{background:`linear-gradient(135deg,${m.dim},${m.dim}66)`,borderColor:`${m.color}44`,color:m.color}:{}}
            onClick={()=>onChange(m.key)}>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   REP CARD — compact ranking row with hover-expand stats
═══════════════════════════════════════════════════ */
function RepCard({ rep, rank, metric, maxVal, adminMode, onEdit, onDelete, delay, isMobile, isMe }) {
  const [expanded, setExpanded] = useState(false);
  const m      = METRICS.find(x=>x.key===metric);
  const val    = mval(rep, metric);
  const sr     = showRate(rep);
  const srCol  = sr>=35?T.green:sr>=25?T.amber:T.red;
  const srTxt  = sr>=75?"Strong":sr>=55?"On Track":"Low";
  const rClass = rank===0?"r0":rank===1?"r1":rank===2?"r2":"";
  return (
    <div className={`rcard afu ${rClass}`}
      style={{
        animationDelay:`${delay}ms`, opacity:0,
        outline: isMe ? `1px solid ${T.cyan}22` : "none",
        outlineOffset:2,
        cursor:"pointer",
      }}
      onClick={()=>setExpanded(e=>!e)}>

      {rank<3 && <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${rank===0?T.r0:rank===1?T.r1:T.r2}44,transparent)`}}/>}
      {isMe && <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${T.cyan}30,transparent)`}}/>}

      {/* ── COLLAPSED ROW (always visible) ── */}
      <div style={{display:"flex",alignItems:"center",gap:isMobile?10:14,padding:isMobile?"12px 14px":"14px 20px"}}>

        {/* Rank badge */}
        {(()=>{
          const rDm  = rank===0?T.r0dm:rank===1?T.r1dm:T.r2dm;
          const rCol = rank===0?T.r0:rank===1?T.r1:T.r2;
          return (
            <div style={{
              width:32,height:32,borderRadius:9,flexShrink:0,
              background:rank<3?rDm:"transparent",
              border:`1px solid ${rank<3?rCol+"44":"rgba(255,255,255,0.04)"}`,
              backdropFilter:rank<3?"blur(8px)":"none",
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:rank<3?14:11,fontWeight:700,
              color:rank<3?rCol:T.t3,
              fontFamily:"'JetBrains Mono',monospace",
            }}>
              {rank+1}
            </div>
          );
        })()}

        {/* Avatar */}
        <Avatar name={rep.name} size={isMobile?34:38} ring={rank<3?(rank===0?T.r0:rank===1?T.r1:T.r2):null}/>

        {/* Name + rank badge */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,fontSize:isMobile?13.5:14.5,color:T.t1,letterSpacing:"-0.02em"}}>
              {rep.name}
            </span>
            {isMe && null}
            {!isMobile && <RankBadgeInline rep={rep} size="sm"/>}
          </div>
          {isMobile && <div style={{marginTop:3}}><RankBadgeInline rep={rep} size="sm"/></div>}
        </div>

        {/* Key stats — always visible */}
        {!isMobile && (
          <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
            {[
              {label:"Appts", val:rep.appts,                       color:T.t1},
              {label:"Sales", val:rep.sales,                       color:T.t1},
              {label:"kW",    val:`${rep.kw.toFixed(0)}`,          color:T.cyan},
              {label:"Show%", val:`${sr}%`,                        color:srCol},
            ].map(({label,val,color})=>(
              <div key={label} style={{
                textAlign:"center",padding:"5px 11px",
                background:"rgba(255,255,255,0.02)",border:`1px solid rgba(255,255,255,0.04)`,
                borderRadius:8,minWidth:52,
              }}>
                <div className="caps" style={{fontSize:8,marginBottom:2,color:T.t2}}>{label}</div>
                <div className="mono" style={{fontSize:13,fontWeight:700,color,lineHeight:1}}>{val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Hero metric value */}
        <div style={{
          textAlign:"right",flexShrink:0,
          padding:isMobile?"5px 10px":"7px 14px",
          background:m.dim,border:`1px solid ${m.color}28`,borderRadius:9,
        }}>
          <div className="caps" style={{color:m.color,fontSize:8,marginBottom:2}}>{m.short}</div>
          <div className="mono" style={{fontSize:isMobile?15:18,fontWeight:800,color:m.color,lineHeight:1}}>{m.fmt(val)}</div>
        </div>

        {/* Expand chevron + admin controls */}
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {adminMode && (
            <div className="admin-fns" style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
              <button className="btn-sm" onClick={()=>onEdit(rep)}>Edit</button>
              <button className="btn-del" aria-label="Delete rep" onClick={()=>onDelete(rep.id)}>✕</button>
            </div>
          )}
          <div style={{color:T.t3,fontSize:12,transition:"transform 0.2s",transform:expanded?"rotate(180deg)":"rotate(0deg)"}}>▼</div>
        </div>
      </div>

      {/* ── EXPANDED STATS PANEL ── */}
      {expanded && (
        <div style={{borderTop:`1px solid rgba(255,255,255,0.04)`,padding:isMobile?"12px 14px":"16px 20px",background:"rgba(255,255,255,0.02)"}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(5,1fr)",gap:7}}>
            {METRICS.map(mm=>{
              const v=mval(rep,mm.key); const isA=mm.key===metric;
              const displayColor = mm.key==="showRate" ? srCol : isA ? mm.color : T.t2;
              return (
                <div key={mm.key} className="spill" style={{
                  background:isA?mm.dim:"rgba(255,255,255,0.04)",
                  borderColor:isA?`${mm.color}28`:"rgba(255,255,255,0.08)",
                }}>
                  <div className="caps" style={{color:isA?mm.color:T.t2,marginBottom:5,fontSize:8.5}}>
                    {mm.key==="showRate"?"Show Rate":mm.label}
                  </div>
                  {mm.key==="showRate"
                    ? <ShowArc value={v} size={54}/>
                    : <div className="mono" style={{fontSize:15,fontWeight:700,color:isA?mm.color:T.t1,lineHeight:1}}>{mm.fmt(v)}</div>
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   ADD / EDIT MODALS
═══════════════════════════════════════════════════ */
function FieldGroup({label,children}) {
  return (
    <div>
      <div className="caps" style={{marginBottom:6}}>{label}</div>
      {children}
    </div>
  );
}

function RepModal({ initial, onSave, onClose, title, sub }) {
  const blank = { name:"", pin:"", sales:0, kw:0, revenue:0, appts:0, shows:0, sparkline:[0,0,0,0,0,0] };
  const [f,setF] = useState(initial||blank);
  const set = (k,v)=>setF(p=>({...p,[k]:v}));
  const submit = ()=>{
    if(!f.name.trim()) return;
    onSave({...f,name:f.name.trim(),id:f.id||Date.now(),sparkline:f.sparkline||[0,0,0,0,0,f.appts]});
    onClose();
  };
  return (
    <div className="moverlay" onClick={onClose}>
      <div className="mpanel" onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700,fontSize:17,color:T.t1,letterSpacing:"-0.02em",marginBottom:2}}>{title}</div>
        <div style={{fontSize:13,color:T.t3,marginBottom:22}}>{sub}</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <FieldGroup label="Full Name">
              <input className="hinput" type="text" value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Alex Johnson" autoFocus/>
            </FieldGroup>
            <FieldGroup label="PIN (4 digits)">
              <input className="hinput" type="number" value={f.pin} onChange={e=>set("pin",String(e.target.value).slice(0,4))} placeholder="e.g. 1234" maxLength={4}/>
            </FieldGroup>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
             <FieldGroup label="Sales (from deals)"><div className="hinput" style={{color:T.t3,cursor:"default"}}>{f.sales ?? "—"}</div></FieldGroup>
             <FieldGroup label="Kilowatts (from deals)"><div className="hinput" style={{color:T.t3,cursor:"default"}}>{typeof f.kw==="number"?f.kw.toFixed(1):"—"}</div></FieldGroup>
           </div>
           <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
             <FieldGroup label="Revenue (from deals)"><div className="hinput" style={{color:T.t3,cursor:"default"}}>{typeof f.revenue==="number"?`$${f.revenue.toLocaleString()}`:"—"}</div></FieldGroup>
             <FieldGroup label="Appts Set"><input className="hinput" type="number" value={f.appts} onChange={e=>set("appts",Number(e.target.value))}/></FieldGroup>
           </div>
          <FieldGroup label="Appointments Shown">
            <input className="hinput" type="number" value={f.shows} onChange={e=>set("shows",Number(e.target.value))}/>
          </FieldGroup>
          <FieldGroup label="Rank Override">
            <select value={f.rankOverride||""} onChange={e=>set("rankOverride",e.target.value||null)}
              style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:8,padding:"9px 12px",color:"rgba(255,255,255,0.85)",fontSize:13,width:"100%",outline:"none",fontFamily:"inherit"}}>
              <option value="">Auto — derived from appt count</option>
              {SETTER_RANKS.map(r=>(<option key={r.id} value={r.id}>{r.title}</option>))}
            </select>
          </FieldGroup>
        </div>
        <div style={{display:"flex",gap:10,marginTop:22}}>
          <button className="btn-cyan" style={{flex:1}} onClick={submit}>Save</button>
          <button className="btn-out" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   DEAL TRACKER
═══════════════════════════════════════════════════ */
// Appt (pipeline) stages
const APPT_STATUSES = [
  { key:"lead",      label:"Lead",       color:"#727272", bg:"rgba(114,114,114,0.1)"  },
  { key:"appt",      label:"Appt Set",   color:T.amber,   bg:T.amberDm                },
  { key:"showed",    label:"Showed",     color:T.green,   bg:T.greenDm                },
  { key:"no_showed", label:"No Show",    color:T.red,     bg:T.redDm                  },
  { key:"sold",      label:"Sold",       color:T.green,   bg:T.greenDm                },
  { key:"dq",        label:"DQ",         color:T.red,     bg:T.redDm                  },
  { key:"cancel",    label:"Cancel",     color:T.red,     bg:T.redDm                  },
  { key:"needs_rs",  label:"Needs RS",   color:T.amber,   bg:T.amberDm                },
  { key:"no_sale",   label:"No Sale",    color:T.red,     bg:T.redDm                  },
  { key:"follow_up", label:"Follow Up",  color:T.amber,   bg:T.amberDm                },
];
// Sold (post-sale) stages
const SOLD_STATUSES_LIST = [
  { key:"sold",        label:"Sold",              color:T.green,  bg:T.greenDm  },
  { key:"site_survey", label:"Site Survey",       color:T.green,  bg:T.greenDm  },
  { key:"design",      label:"Design",            color:T.green,  bg:T.greenDm  },
  { key:"engineering", label:"Engineering",       color:T.green,  bg:T.greenDm  },
  { key:"install_sched",label:"Install Sched.",   color:T.green,  bg:T.greenDm  },
  { key:"installed",   label:"Installed",         color:T.green,  bg:T.greenDm  },
];
// Combined for lookups
const STATUSES = [...APPT_STATUSES, ...SOLD_STATUSES_LIST.filter(s=>s.key!=="sold")];
const ADDERS = ["Battery","EV Charger","Roof","MPU","Generator","Smart Panel","Ground Mount"];
// Keys that mean "sold/post-sale"
const SOLD_KEYS = ["sold","site_survey","design","engineering","install_sched","installed"];
const APPT_STAGE_ORDER = ["lead","appt","showed","no_showed","sold","dq","cancel","needs_rs","no_sale","follow_up"];
const SOLD_STAGE_ORDER = ["sold","site_survey","design","engineering","install_sched","installed"];
const STATUS_ORDER = APPT_STAGE_ORDER; // legacy compat
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—";
const fmtUSD  = n => n ? `$${Number(n).toLocaleString()}` : "—";
const fmtKw   = n => n ? `${Number(n).toFixed(2)} kW` : "—";

// Smart number formatter: switches k → M → B automatically
const fmtNum = n => {
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1000) return `$${(n/1000).toFixed(1)}k`;
  return `$${n}`;
};
const fmtNumShort = n => {
  if (n >= 1e9)  return `$${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n/1e6).toFixed(1)}M`;
  if (n >= 1000) return `$${(n/1000).toFixed(0)}k`;
  return `$${n}`;
};

const SAMPLE_DEALS = {
  // Marcus Rivera — Setter Manager (48 appts, 38% SR) — 14 sales, full pipeline
  1:[
    {id:101,customer:"Sarah Mitchell",    phone:"(602)555-1010",email:"sarah.m@email.com",    address:"4821 Sunridge Blvd, Phoenix AZ 85001",      kw:8.4, price:38200,commission:3820,monthlyBill:310,lastContacted:"2026-02-10",apptDate:"2026-02-10",closeDate:"2026-02-12",status:"installed",     adders:["Battery","EV Charger"],notes:"Great install, referral expected"},
    {id:102,customer:"Tom & Linda Park",  phone:"(480)555-1112",email:"tompark@gmail.com",    address:"912 Desert Rose Ln, Scottsdale AZ 85251",    kw:11.2,price:51500,commission:5150,monthlyBill:420,lastContacted:"2026-02-18",apptDate:"2026-02-18",closeDate:"2026-02-20",status:"installed",     adders:["Battery"],             notes:"PTO approved"},
    {id:103,customer:"Kevin Walsh",       phone:"(602)555-1415",email:"kwalsh@email.com",     address:"7712 Palm Crest Dr, Peoria AZ 85345",        kw:7.2, price:33000,commission:3300,monthlyBill:265,lastContacted:"2026-03-01",apptDate:"2026-03-03",closeDate:"2026-03-04",status:"installed",     adders:[],                      notes:""},
    {id:104,customer:"Nicole Hayes",      phone:"(602)555-0912",email:"nhayes@icloud.com",    address:"8901 Cactus Rd, Scottsdale AZ 85260",        kw:12.0,price:55200,commission:5520,monthlyBill:380,lastContacted:"2026-02-20",apptDate:"2026-02-01",closeDate:"2026-02-22",status:"installed",     adders:["Battery","EV Charger"],notes:"Referral pending"},
    {id:105,customer:"Ashley Turner",     phone:"(623)555-0789",email:"ashley.t@email.com",   address:"7712 Palm Crest Dr, Peoria AZ 85345",        kw:9.8, price:45000,commission:4500,monthlyBill:320,lastContacted:"2026-03-10",apptDate:"2026-03-10",closeDate:"2026-03-10",status:"install_sched",adders:["Battery"],             notes:"Install Mar 20"},
    {id:106,customer:"Lisa Fontaine",     phone:"(480)555-1516",email:"lfontaine@gmail.com",  address:"445 Rio Verde Dr, Fountain Hills AZ 85268",  kw:10.0,price:46500,commission:4650,monthlyBill:390,lastContacted:"2026-03-12",apptDate:"2026-03-12",closeDate:"2026-03-13",status:"install_sched",adders:["Battery"],             notes:"Install Mar 22"},
    {id:107,customer:"Rachel Nguyen",     phone:"(520)555-1314",email:"rnguyen@yahoo.com",    address:"550 Cactus Wren Way, Gilbert AZ 85234",      kw:9.1, price:42000,commission:4200,monthlyBill:285,lastContacted:"2026-03-08",apptDate:"2026-03-08",closeDate:"2026-03-09",status:"engineering",   adders:["Roof"],                notes:"HOA approved"},
    {id:108,customer:"James Okafor",      phone:"(623)555-1213",email:"jokafor@hotmail.com",  address:"2201 Mesa View Dr, Tempe AZ 85281",          kw:6.6, price:29800,commission:2980,monthlyBill:240,lastContacted:"2026-03-05",apptDate:"2026-03-05",closeDate:"2026-03-06",status:"design",         adders:[],                      notes:"Financing approved"},
    {id:109,customer:"Greg Hollis",       phone:"(480)555-1620",email:"ghollis@email.com",    address:"331 W Glendale Ave, Phoenix AZ 85021",       kw:8.8, price:40400,commission:4040,monthlyBill:295,lastContacted:"2026-03-14",apptDate:"2026-03-14",closeDate:"2026-03-15",status:"sold",           adders:["EV Charger"],          notes:"Quick close"},
    {id:110,customer:"Tamara Osei",       phone:"(602)555-1721",email:"tosei@gmail.com",      address:"6209 N 15th Ave, Phoenix AZ 85015",          kw:7.6, price:34800,commission:3480,monthlyBill:270,lastContacted:"2026-03-11",apptDate:"2026-03-11",closeDate:"2026-03-12",status:"sold",           adders:[],                      notes:"Battery add-on possible"},
    {id:111,customer:"Derek Yuen",        phone:"(480)555-1822",email:"dyuen@hotmail.com",    address:"2440 E Thomas Rd, Phoenix AZ 85016",         kw:9.5, price:43500,commission:4350,monthlyBill:340,lastContacted:"2026-03-13",apptDate:"2026-03-13",closeDate:null,status:"site_survey",    adders:["Battery"],             notes:""},
    {id:112,customer:"Fiona Blake",       phone:"(623)555-1923",email:"fblake@yahoo.com",     address:"19210 N 31st Ave, Phoenix AZ 85027",         kw:6.2, price:28400,commission:2840,monthlyBill:225,lastContacted:"2026-03-14",apptDate:"2026-03-14",closeDate:null,status:"showed",         adders:[],                      notes:"Deciding between loan and lease"},
    {id:113,customer:"Marcus Jr. Rivera", phone:"(602)555-2024",email:"mjr@email.com",        address:"5801 W Camelback Rd, Phoenix AZ 85031",      kw:10.5,price:48200,commission:4820,monthlyBill:360,lastContacted:"2026-03-15",apptDate:"2026-03-15",closeDate:null,status:"appt",           adders:["Battery","EV Charger"],notes:"Referral from Sarah M."},
    {id:114,customer:"Elena Vasquez",     phone:"(480)555-2125",email:"evasquez@gmail.com",   address:"1050 N Dobson Rd, Mesa AZ 85201",            kw:7.8, price:35700,commission:3570,monthlyBill:280,lastContacted:"2026-03-15",apptDate:"2026-03-15",closeDate:null,status:"appt",           adders:[],                      notes:""},
  ],
  // Jade Thompson — Setter Captain (38 appts, 37% SR) — 11 sales
  2:[
    {id:201,customer:"Mike Brennan",      phone:"(602)555-2010",email:"mbrennan@email.com",   address:"1104 Oak Hill Rd, Chandler AZ 85224",        kw:7.8, price:35400,commission:3540,monthlyBill:295,lastContacted:"2026-02-14",apptDate:"2026-02-14",closeDate:"2026-02-15",status:"installed",     adders:["EV Charger"],          notes:""},
    {id:202,customer:"Diana Torres",      phone:"(480)555-2112",email:"dtorres@gmail.com",    address:"3308 Sunset Blvd, Mesa AZ 85201",            kw:10.5,price:47800,commission:4780,monthlyBill:365,lastContacted:"2026-02-20",apptDate:"2026-02-20",closeDate:"2026-02-21",status:"installed",     adders:[],                      notes:"Battery add-on confirmed"},
    {id:203,customer:"Sandra Chen",       phone:"(602)555-0181",email:"sandra.chen@email.com",address:"4821 Sunridge Blvd, Phoenix AZ 85001",      kw:8.2, price:37600,commission:3760,monthlyBill:280,lastContacted:"2026-02-28",apptDate:"2026-02-28",closeDate:"2026-03-01",status:"installed",     adders:["Battery"],             notes:"Referral expected"},
    {id:204,customer:"Paul Merritt",      phone:"(602)555-2215",email:"pmerritt@email.com",   address:"2108 W Mariposa St, Phoenix AZ 85015",      kw:9.0, price:41400,commission:4140,monthlyBill:315,lastContacted:"2026-03-09",apptDate:"2026-03-09",closeDate:"2026-03-10",status:"install_sched",adders:["Battery","Roof"],       notes:"Reroofed last month"},
    {id:205,customer:"Nina Patel",        phone:"(520)555-2314",email:"npatel@icloud.com",    address:"234 S Rural Rd, Tempe AZ 85281",             kw:8.8, price:40300,commission:4030,monthlyBill:340,lastContacted:"2026-03-07",apptDate:"2026-03-07",closeDate:"2026-03-08",status:"engineering",   adders:["Roof"],                notes:""},
    {id:206,customer:"Frank Gutierrez",   phone:"(623)555-2213",email:"fgutierrez@yahoo.com", address:"890 W Bell Rd, Glendale AZ 85308",           kw:6.0, price:27600,commission:2760,monthlyBill:220,lastContacted:"2026-03-03",apptDate:"2026-03-03",closeDate:"2026-03-04",status:"design",         adders:[],                      notes:""},
    {id:207,customer:"Erin Cole",         phone:"(602)555-2416",email:"ecole@gmail.com",      address:"6712 N 19th Ave, Phoenix AZ 85015",          kw:7.4, price:33900,commission:3390,monthlyBill:255,lastContacted:"2026-03-10",apptDate:"2026-03-10",closeDate:"2026-03-11",status:"sold",           adders:["EV Charger"],          notes:""},
    {id:208,customer:"Marcus Webb",       phone:"(480)555-2517",email:"mwebb@hotmail.com",    address:"3320 W Greenway Rd, Phoenix AZ 85053",      kw:8.5, price:39000,commission:3900,monthlyBill:300,lastContacted:"2026-03-15",apptDate:"2026-03-15",closeDate:"2026-03-15",status:"sold",           adders:[],                      notes:"Cash deal"},
    {id:209,customer:"Lucia Vargas",      phone:"(623)555-2618",email:"lvargas@email.com",    address:"14202 N 43rd Ave, Glendale AZ 85306",       kw:9.2, price:42200,commission:4220,monthlyBill:325,lastContacted:"2026-03-13",apptDate:"2026-03-13",closeDate:null,status:"site_survey",    adders:["Battery"],             notes:"Excellent roof"},
    {id:210,customer:"Henry Marsh",       phone:"(602)555-2719",email:"hmarsh@yahoo.com",     address:"11033 N 28th Dr, Phoenix AZ 85029",         kw:6.8, price:31200,commission:3120,monthlyBill:245,lastContacted:"2026-03-14",apptDate:"2026-03-14",closeDate:null,status:"showed",         adders:[],                      notes:""},
    {id:211,customer:"Tina Holt",         phone:"(480)555-2820",email:"tholt@gmail.com",      address:"1240 S Alma School Rd, Mesa AZ 85210",      kw:8.0, price:36800,commission:3680,monthlyBill:290,lastContacted:"2026-03-15",apptDate:"2026-03-15",closeDate:null,status:"appt",           adders:["Battery"],             notes:""},
  ],
  // Casey Lin — Setter Captain (36 appts, 36% SR) — 9 sales
  3:[
    {id:301,customer:"Carlos Reyes",      phone:"(602)555-3010",email:"creyes@email.com",     address:"678 N 32nd St, Phoenix AZ 85018",            kw:9.5, price:43500,commission:4350,monthlyBill:355,lastContacted:"2026-02-12",apptDate:"2026-02-12",closeDate:"2026-02-14",status:"installed",     adders:["Battery"],             notes:""},
    {id:302,customer:"Amy Kowalski",      phone:"(480)555-3112",email:"akowalski@gmail.com",  address:"321 E Indian School, Phoenix AZ 85016",     kw:7.4, price:34000,commission:3400,monthlyBill:280,lastContacted:"2026-02-19",apptDate:"2026-02-21",closeDate:"2026-02-22",status:"installed",     adders:[],                      notes:""},
    {id:303,customer:"James Park",        phone:"(520)555-0445",email:"jpark@yahoo.com",      address:"550 Cactus Wren Way, Gilbert AZ 85234",      kw:14.4,price:66000,commission:6600,monthlyBill:410,lastContacted:"2026-02-25",apptDate:"2026-02-20",closeDate:"2026-02-26",status:"installed",     adders:["Battery","EV Charger","Roof"],notes:"Fast close"},
    {id:304,customer:"Tanya Brooks",      phone:"(520)555-3314",email:"tbrooks@yahoo.com",    address:"555 E Chandler Blvd, Chandler AZ 85225",    kw:8.1, price:37200,commission:3720,monthlyBill:300,lastContacted:"2026-03-08",apptDate:"2026-03-08",closeDate:"2026-03-09",status:"install_sched",adders:[],                      notes:""},
    {id:305,customer:"David Kim",         phone:"(623)555-3213",email:"dkim@hotmail.com",     address:"987 W Thomas Rd, Phoenix AZ 85013",          kw:5.8, price:26500,commission:2650,monthlyBill:210,lastContacted:"2026-03-04",apptDate:"2026-03-04",closeDate:"2026-03-05",status:"design",         adders:[],                      notes:""},
    {id:306,customer:"Renee Dupont",      phone:"(602)555-3415",email:"rdupont@email.com",    address:"4530 E McDowell Rd, Phoenix AZ 85008",      kw:8.6, price:39500,commission:3950,monthlyBill:305,lastContacted:"2026-03-12",apptDate:"2026-03-12",closeDate:"2026-03-13",status:"sold",           adders:["EV Charger"],          notes:""},
    {id:307,customer:"Kwame Asante",      phone:"(480)555-3516",email:"kasante@gmail.com",    address:"1805 E Osborn Rd, Phoenix AZ 85016",        kw:7.0, price:32100,commission:3210,monthlyBill:255,lastContacted:"2026-03-15",apptDate:"2026-03-15",closeDate:"2026-03-15",status:"sold",           adders:[],                      notes:""},
    {id:308,customer:"Irene Santos",      phone:"(623)555-3617",email:"isantos@hotmail.com",  address:"16215 N 28th Ave, Phoenix AZ 85053",        kw:9.3, price:42700,commission:4270,monthlyBill:320,lastContacted:"2026-03-13",apptDate:"2026-03-13",closeDate:null,status:"site_survey",    adders:["Battery"],             notes:""},
    {id:309,customer:"Will Paxton",       phone:"(602)555-3718",email:"wpaxton@yahoo.com",    address:"3202 W Thunderbird Rd, Phoenix AZ 85053",   kw:6.5, price:29800,commission:2980,monthlyBill:235,lastContacted:"2026-03-14",apptDate:"2026-03-14",closeDate:null,status:"showed",         adders:[],                      notes:""},
  ],
  // Devon Okafor — Setter (28 appts, 32% SR) — 7 sales
  4:[
    {id:401,customer:"Steven Clark",      phone:"(602)555-4010",email:"sclark@email.com",     address:"1234 N 7th St, Phoenix AZ 85006",            kw:6.4, price:29200,commission:2920,monthlyBill:235,lastContacted:"2026-02-15",apptDate:"2026-02-15",closeDate:"2026-02-16",status:"installed",     adders:[],                      notes:""},
    {id:402,customer:"Robert Vega",       phone:"(480)555-0234",email:"rvega@gmail.com",      address:"912 Desert Rose Ln, Scottsdale AZ 85251",    kw:11.2,price:51500,commission:5150,monthlyBill:420,lastContacted:"2026-02-22",apptDate:"2026-02-22",closeDate:"2026-02-24",status:"installed",     adders:["Battery","EV Charger"],notes:"HOA approval done"},
    {id:403,customer:"Brian Nakamura",    phone:"(623)555-4213",email:"bnakamura@yahoo.com",  address:"4821 Sunridge Blvd, Glendale AZ 85301",      kw:7.0, price:32000,commission:3200,monthlyBill:258,lastContacted:"2026-03-06",apptDate:"2026-03-06",closeDate:"2026-03-07",status:"install_sched",adders:[],                      notes:""},
    {id:404,customer:"Megan Ross",        phone:"(480)555-4112",email:"mross@gmail.com",      address:"567 E Camelback, Scottsdale AZ 85251",       kw:9.8, price:44800,commission:4480,monthlyBill:375,lastContacted:"2026-03-04",apptDate:"2026-03-04",closeDate:"2026-03-05",status:"design",         adders:["Battery"],             notes:""},
    {id:405,customer:"Jerome Whitfield",  phone:"(602)555-4415",email:"jwhitfield@email.com", address:"9508 W Peoria Ave, Peoria AZ 85345",         kw:7.5, price:34400,commission:3440,monthlyBill:272,lastContacted:"2026-03-11",apptDate:"2026-03-11",closeDate:"2026-03-12",status:"sold",           adders:[],                      notes:""},
    {id:406,customer:"Alicia Crane",      phone:"(480)555-4516",email:"acrane@gmail.com",     address:"8104 E Indian School, Scottsdale AZ 85251",  kw:8.2, price:37600,commission:3760,monthlyBill:290,lastContacted:"2026-03-13",apptDate:"2026-03-13",closeDate:null,status:"site_survey",    adders:["EV Charger"],          notes:""},
    {id:407,customer:"Pete Connors",      phone:"(623)555-4617",email:"pconnors@hotmail.com", address:"3716 W Northern Ave, Phoenix AZ 85051",      kw:6.8, price:31200,commission:3120,monthlyBill:248,lastContacted:"2026-03-14",apptDate:"2026-03-14",closeDate:null,status:"showed",         adders:[],                      notes:"Considering battery add-on"},
  ],
  // Priya Nair — Rookie Setter (22 appts, 27% SR) — 4 sales
  5:[
    {id:501,customer:"Patricia Lane",     phone:"(602)555-5010",email:"plane@email.com",      address:"9012 S 48th St, Phoenix AZ 85044",           kw:5.5, price:25000,commission:2500,monthlyBill:195,lastContacted:"2026-02-18",apptDate:"2026-02-18",closeDate:"2026-02-20",status:"installed",     adders:[],                      notes:""},
    {id:502,customer:"Omar Shaikh",       phone:"(480)555-5112",email:"oshaikh@gmail.com",    address:"1456 W Guadalupe, Mesa AZ 85202",            kw:7.2, price:33000,commission:3300,monthlyBill:268,lastContacted:"2026-03-05",apptDate:"2026-03-05",closeDate:"2026-03-06",status:"install_sched",adders:["EV Charger"],          notes:""},
    {id:503,customer:"Gina Rosario",      phone:"(602)555-5213",email:"grosario@email.com",   address:"2915 E Roosevelt St, Phoenix AZ 85008",      kw:6.0, price:27500,commission:2750,monthlyBill:215,lastContacted:"2026-03-10",apptDate:"2026-03-10",closeDate:"2026-03-11",status:"sold",           adders:[],                      notes:"First sale this month"},
    {id:504,customer:"Terrell Mason",     phone:"(480)555-5314",email:"tmason@gmail.com",     address:"4250 E Baseline Rd, Gilbert AZ 85234",       kw:7.8, price:35700,commission:3570,monthlyBill:278,lastContacted:"2026-03-13",apptDate:"2026-03-13",closeDate:null,status:"site_survey",    adders:["Battery"],             notes:""},
    {id:505,customer:"Yolanda Cruz",      phone:"(623)555-5415",email:"ycruz@hotmail.com",    address:"12002 W Olive Ave, Peoria AZ 85381",         kw:5.8, price:26600,commission:2660,monthlyBill:205,lastContacted:"2026-03-14",apptDate:"2026-03-14",closeDate:null,status:"showed",         adders:[],                      notes:"Needs cosigner"},
  ],
  // Tyler Moss — Rookie Setter (16 appts, 25% SR) — 2 sales
  6:[
    {id:601,customer:"Denise Fowler",     phone:"(602)555-6010",email:"dfowler@email.com",    address:"2789 E McDowell, Phoenix AZ 85008",          kw:6.8, price:31000,commission:3100,monthlyBill:252,lastContacted:"2026-02-20",apptDate:"2026-02-20",closeDate:"2026-02-22",status:"installed",     adders:[],                      notes:""},
    {id:602,customer:"Brian Foster",      phone:"(480)555-1023",email:"bfoster@outlook.com",  address:"445 Rio Verde Dr, Fountain Hills AZ 85268",  kw:5.2, price:23800,commission:2380,monthlyBill:188,lastContacted:"2026-03-09",apptDate:"2026-03-09",closeDate:"2026-03-10",status:"sold",           adders:[],                      notes:"Learning deal"},
    {id:603,customer:"Hannah Price",      phone:"(602)555-6213",email:"hprice@email.com",     address:"7203 N 43rd Ave, Glendale AZ 85301",         kw:6.0, price:27500,commission:2750,monthlyBill:218,lastContacted:"2026-03-14",apptDate:"2026-03-14",closeDate:null,status:"showed",         adders:[],                      notes:"First month in field"},
  ],
};

function StatusPill({ status }) {
  const all = [...APPT_STATUSES, ...SOLD_STATUSES_LIST];
  const s = all.find(x=>x.key===status) || APPT_STATUSES[0];
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:5,
      padding:"3px 9px",borderRadius:5,
      fontSize:11,fontWeight:700,letterSpacing:"0.03em",
      background:s.bg,color:s.color,border:`1px solid ${s.color}33`,
      whiteSpace:"nowrap",
    }}>
      {s.label}
    </span>
  );
}

function PipelineProgress({ status }) {
  const isSold = SOLD_KEYS.includes(status) && status !== "sold" ? true : false;
  const apptVis = ["lead","appt","showed","sold"];
  const soldVis = SOLD_STAGE_ORDER;
  const stageList = SOLD_KEYS.includes(status) && status!=="lead" ? soldVis : apptVis;
  const allStatuses = [...APPT_STATUSES, ...SOLD_STATUSES_LIST];
  const idx = stageList.indexOf(status);
  const pct = idx>=0 ? ((idx+1)/stageList.length)*100 : 0;
  const col = allStatuses.find(x=>x.key===status)?.color || T.t2;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        {stageList.map((s,i)=>{
          const st=allStatuses.find(x=>x.key===s)||{color:T.t2,label:s};
          const done=i<=idx;
          const isCurrent=i===idx;
          // Completed stages always green; current stage uses its own color
          const dotColor = done ? T.green : "rgba(255,255,255,0.08)";
          const dotBg    = done ? `${T.green}22` : "rgba(255,255,255,0.04)";
          const labelColor = isCurrent ? T.green : done ? `${T.green}99` : T.t3;
          return (
            <div key={s} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flex:1}}>
              <div style={{
                width:20,height:20,borderRadius:"50%",
                background:dotBg,
                border:`2px solid ${dotColor}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:8,color:done?T.green:T.t3,fontWeight:700,
                transition:"all 0.3s",
                boxShadow:isCurrent?`0 0 8px ${T.green}55`:"none",
              }}>{done?"✓":"·"}</div>
              <span style={{fontSize:8,color:labelColor,fontWeight:isCurrent?700:done?500:400,textAlign:"center",lineHeight:1.2}}>
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.04)",overflow:"hidden",margin:"0 8px"}}>
        <div style={{
          height:"100%",width:`${pct}%`,borderRadius:2,
          background:`linear-gradient(90deg,${T.green}88,${T.green})`,
          transition:"width 0.8s cubic-bezier(0.22,1,0.36,1)",
          boxShadow:`0 0 8px ${T.green}44`,
        }}/>
      </div>
    </div>
  );
}

function DealModal({ deal, onSave, onClose }) {
  const blank = {customer:"",address:"",kw:"",price:"",commission:"",apptDate:"",status:"lead",adders:[],notes:""};
  const [f,setF] = useState(deal||blank);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const toggleAdder=a=>setF(p=>({...p,adders:p.adders.includes(a)?p.adders.filter(x=>x!==a):[...p.adders,a]}));
  const submit=()=>{
    if(!f.customer.trim()) return;
    onSave({...f,id:f.id||Date.now(),kw:Number(f.kw)||0,price:Number(f.price)||0,commission:Number(f.commission)||0});
    onClose();
  };
  return (
    <div className="moverlay" onClick={onClose}>
      <div className="mpanel" onClick={e=>e.stopPropagation()} style={{maxWidth:520}}>
        <div style={{fontWeight:700,fontSize:17,color:T.t1,letterSpacing:"-0.02em",marginBottom:2}}>
          {deal?.id?"Edit Deal":"New Deal"}
        </div>
        <div style={{fontSize:13,color:T.t3,marginBottom:22}}>Track a customer deal through your pipeline</div>

        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* customer + address */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:6}}>Customer Name</div>
              <input className="hinput" type="text" value={f.customer} onChange={e=>set("customer",e.target.value)} placeholder="Jane Smith" autoFocus/></div>
            <div><div className="caps" style={{marginBottom:6}}>Appointment Date</div>
              <input className="hinput" type="date" value={f.apptDate} onChange={e=>set("apptDate",e.target.value)}/></div>
          </div>
          <div><div className="caps" style={{marginBottom:6}}>Property Address</div>
            <input className="hinput" type="text" value={f.address} onChange={e=>set("address",e.target.value)} placeholder="123 Solar St, Phoenix AZ 85001"/></div>

          {/* financial */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:6}}>System Size (kW)</div>
              <input className="hinput" type="number" step="0.1" value={f.kw} onChange={e=>set("kw",e.target.value)} placeholder="8.4"/></div>
            <div><div className="caps" style={{marginBottom:6}}>Sale Price ($)</div>
              <input className="hinput" type="number" value={f.price} onChange={e=>set("price",e.target.value)} placeholder="38000"/></div>
            <div><div className="caps" style={{marginBottom:6}}>Commission ($)</div>
              <input className="hinput" type="number" value={f.commission} onChange={e=>set("commission",e.target.value)} placeholder="3800"/></div>
          </div>

          {/* status */}
          <div>
            <div className="caps" style={{marginBottom:8}}>Appointment Stage</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
              {APPT_STATUSES.filter(s=>!SOLD_KEYS.includes(s.key)).map(s=>{
                const apptOrder = ["lead","appt","showed","no_showed","sold","dq","cancel","needs_rs","no_sale","follow_up"];
                const curIdx = apptOrder.indexOf(f.status);
                const sIdx   = apptOrder.indexOf(s.key);
                const isActive  = f.status === s.key;
                const isPast    = sIdx < curIdx && sIdx >= 0 && curIdx >= 0 && !["dq","cancel","no_sale","no_showed"].includes(f.status);
                const activeStyle = isActive
                  ? {background:s.bg, color:s.color, border:`1px solid ${s.color}44`}
                  : isPast
                  ? {background:`${T.green}15`, color:`${T.green}99`, border:`1px solid ${T.green}33`}
                  : {};
                return (
                  <button key={s.key} className={`stage-btn${isActive?" active":""}`}
                    style={{...activeStyle, padding:"6px 10px", fontSize:11.5}}
                    onClick={()=>set("status",s.key)}>
                    {isPast && "✓ "}{s.label}
                  </button>
                );
              })}
            </div>
            <div className="caps" style={{marginBottom:8}}>Sold Stage</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {SOLD_STATUSES_LIST.map(s=>{
                const curIdx = SOLD_STAGE_ORDER.indexOf(f.status);
                const sIdx   = SOLD_STAGE_ORDER.indexOf(s.key);
                const isActive = f.status === s.key;
                const isPast   = sIdx < curIdx && sIdx >= 0 && curIdx >= 0;
                const activeStyle = isActive
                  ? {background:s.bg, color:s.color, border:`1px solid ${s.color}44`}
                  : isPast
                  ? {background:`${T.green}15`, color:`${T.green}99`, border:`1px solid ${T.green}33`}
                  : {};
                return (
                  <button key={s.key} className={`stage-btn${isActive?" active":""}`}
                    style={{...activeStyle, padding:"6px 10px", fontSize:11.5}}
                    onClick={()=>set("status",s.key)}>
                    {isPast && "✓ "}{s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* adders */}
          <div>
            <div className="caps" style={{marginBottom:8}}>Commission Adders</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {ADDERS.map(a=>(
                <button key={a} className={`adder-chip${f.adders.includes(a)?" on":""}`}
                  onClick={()=>toggleAdder(a)}>
                  {f.adders.includes(a)&&<span style={{fontSize:10}}>✓</span>}{a}
                </button>
              ))}
            </div>
          </div>

          {/* notes */}
          <div><div className="caps" style={{marginBottom:6}}>Notes</div>
            <textarea className="hinput" rows={2} value={f.notes} onChange={e=>set("notes",e.target.value)}
              placeholder="Any notes about this deal…"
              style={{resize:"vertical",minHeight:60}}/></div>
        </div>

        <div style={{display:"flex",gap:10,marginTop:22}}>
          <button className="btn-cyan" style={{flex:1}} onClick={submit}>
            {deal?.id?"Save Changes":"Add Deal"}
          </button>
          <button className="btn-out" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DealCard({ deal, onEdit, onDelete, isMobile, onMarkSold }) {
  const [expanded,setExpanded]=useState(false);
  const s=STATUSES.find(x=>x.key===deal.status)||STATUSES[0];
  const projComm=deal.commission+(deal.adders.length*500);

  return (
    <div className="deal-card" style={{padding:isMobile?"14px 16px":"18px 22px"}}>
      {/* header row */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:10,marginBottom:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:isMobile?14:15,color:T.t1,letterSpacing:"-0.01em",marginBottom:4}}>
            {deal.customer}
          </div>
          <div style={{fontSize:12,color:T.t3,display:"flex",alignItems:"center",gap:5}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deal.address||"No address"}</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <StatusPill status={deal.status}/>
          <button style={{background:"none",border:"none",cursor:"pointer",color:T.t3,fontSize:16,padding:4,lineHeight:1,transition:"color 0.15s"}}
            onClick={()=>setExpanded(x=>!x)}>{expanded?"▲":"▼"}</button>
        </div>
      </div>

      {/* pipeline progress */}
      <div style={{marginBottom:12}}>
        <PipelineProgress status={deal.status}/>
      </div>

      {/* stat row — different fields for appt vs sold stage */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:7,marginBottom:expanded?12:0}}>
        {(SOLD_KEYS.includes(deal.status)
          ? [
              {label:"System Size",val:fmtKw(deal.kw),color:T.cyan},
              {label:"Sale Price", val:fmtUSD(deal.price),color:T.green},
              {label:"Base Comm.", val:fmtUSD(deal.commission),color:T.green},
              {label:"Proj. Comm.",val:fmtUSD(projComm),color:T.greenLt},
            ]
          : [
              {label:"Monthly Bill",      val:deal.monthlyBill?`$${deal.monthlyBill}/mo`:"—",    color:T.amber},
              {label:"Date Last Contacted",val:deal.lastContacted?fmtDate(deal.lastContacted):"—",color:T.t2},
            ]
        ).map(({label,val,color})=>(
          <div key={label} className="deal-stat-box">
            <div className="caps" style={{fontSize:9.5}}>{label}</div>
            <div className="mono" style={{fontSize:14,fontWeight:700,color,lineHeight:1}}>{val}</div>
          </div>
        ))}
      </div>

      {/* expanded details */}
      {expanded && (
        <div style={{borderTop:`1px solid rgba(255,255,255,0.04)`,paddingTop:14}}>
          {SOLD_KEYS.includes(deal.status) ? (
            <>
              {/* Sold deal: show adders */}
              {deal.adders.length>0 && (
                <div style={{marginBottom:12}}>
                  <div className="caps" style={{marginBottom:7}}>Commission Adders (+${deal.adders.length*500} est.)</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {deal.adders.map(a=>(
                      <span key={a} style={{padding:"3px 9px",borderRadius:5,fontSize:11,fontWeight:600,background:T.goldDm,color:T.gold,border:"1px solid rgba(240,165,0,0.3)"}}>✓ {a}</span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <div>
                  <div className="caps" style={{marginBottom:3,fontSize:9.5}}>Appointment Date</div>
                  <div className="mono" style={{fontSize:13,color:T.t1}}>{fmtDate(deal.apptDate)}</div>
                </div>
                {deal.notes && (
                  <div style={{flex:1,minWidth:160}}>
                    <div className="caps" style={{marginBottom:3,fontSize:9.5}}>Notes</div>
                    <div style={{fontSize:13,color:T.t2,lineHeight:1.5}}>{deal.notes}</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Appt deal: show contact details */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:12}}>
                {[
                  {label:"Phone",   val:deal.phone   ||"—", icon:"📞"},
                  {label:"Email",   val:deal.email   ||"—", icon:"✉"},
                  {label:"Address", val:deal.address ||"—", icon:"📍"},
                ].map(({label,val,icon})=>(
                  <div key={label} style={{background:"rgba(255,255,255,0.02)",border:`1px solid rgba(255,255,255,0.04)`,borderRadius:9,padding:"9px 12px"}}>
                    <div className="caps" style={{marginBottom:3,fontSize:8.5}}>{icon} {label}</div>
                    <div style={{fontSize:12.5,color:T.t1,fontWeight:500,wordBreak:"break-word"}}>{val}</div>
                  </div>
                ))}
                {deal.notes && (
                  <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid rgba(255,255,255,0.04)`,borderRadius:9,padding:"9px 12px",gridColumn:isMobile?"1":"1 / -1"}}>
                    <div className="caps" style={{marginBottom:3,fontSize:8.5}}>📝 Notes</div>
                    <div style={{fontSize:12.5,color:T.t2,lineHeight:1.6}}>{deal.notes}</div>
                  </div>
                )}
              </div>
            </>
          )}
          {/* actions */}
          <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
            {onMarkSold && !SOLD_KEYS.includes(deal.status) && (
              <button onClick={()=>onMarkSold(deal)} style={{
                background:T.greenDm,border:"1px solid rgba(48,209,88,0.3)",
                borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:600,
                color:T.green,cursor:"pointer",transition:"all 0.15s",
                fontFamily:"'Inter',system-ui,sans-serif",
              }}>✓ Mark as Sold</button>
            )}
            <button className="btn-sm" style={{fontSize:12}} onClick={()=>onEdit(deal)}>Edit</button>
            <button className="btn-del" onClick={()=>onDelete(deal.id)}>Remove</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MyDeals({ user, isMobile, deals, setDeals }) {
  const [modal,    setModal]    = useState(null);
  const [editDeal, setEditDeal] = useState(null);
  const [dealTab,  setDealTab]  = useState("appts"); // "appts" | "sold"

  const addDeal    = d => setDeals(p=>[...p,d]);
  const updateDeal = d => setDeals(p=>p.map(x=>x.id===d.id?d:x));
  const deleteDeal = id=> setDeals(p=>p.filter(x=>x.id!==id));
  const openEdit   = d => { setEditDeal(d); setModal("edit"); };

  // Split by stage group
  const apptDeals = deals.filter(d=>!SOLD_KEYS.includes(d.status));
  const soldDeals = deals.filter(d=>SOLD_KEYS.includes(d.status));
  const [apptFilter, setApptFilter] = useState("all");
  const [soldFilter, setSoldFilter] = useState("all");
  const filteredAppts = apptFilter==="all" ? apptDeals : apptDeals.filter(d=>d.status===apptFilter);
  const filteredSold  = soldFilter==="all"  ? soldDeals  : soldDeals.filter(d=>d.status===soldFilter);
  const activeList    = dealTab==="appts" ? filteredAppts : filteredSold;

  // summary stats (always across all deals)
  const totalRev  = deals.reduce((s,d)=>s+d.price,0);
  const totalKw   = deals.reduce((s,d)=>s+d.kw,0);
  const totalComm = deals.reduce((s,d)=>s+d.commission+(d.adders.length*500),0);

  return (
    <div className="afu" style={{opacity:0}}>
      {/* summary cards */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {[
          {label:"Appts Set",     val:apptDeals.length,  sub:`${apptDeals.filter(d=>d.status==="appt").length} confirmed`,  color:T.amber},
          {label:"Sold Deals",    val:soldDeals.length,  sub:`${soldDeals.filter(d=>d.status==="installed").length} installed`, color:T.green},
          {label:"Total Revenue", val:fmtUSD(totalRev),  sub:"all deals",       color:T.green},
          {label:"Proj. Earnings",val:fmtUSD(totalComm), sub:"incl. adders",    color:T.cyan},
        ].map(({label,val,sub,color})=>(
          <div key={label} style={{
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,
            padding:"18px 20px",position:"relative",overflow:"hidden",
            backdropFilter:"blur(32px)",
            boxShadow:"0 1px 0 rgba(255,255,255,0.08) inset, 0 4px 20px rgba(0,0,0,0.3)",
          }}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${color}60,transparent)`}}/>
            <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 100% 60% at 50% 0%,${color}07,transparent)`,pointerEvents:"none"}}/>
            <div className="caps" style={{marginBottom:8,fontSize:9.5,position:"relative"}}>{label}</div>
            <div className="mono" style={{fontSize:22,fontWeight:700,color,lineHeight:1,position:"relative"}}>{val}</div>
            <div style={{fontSize:11,color:T.t3,marginTop:5,position:"relative"}}>{sub}</div>
          </div>
        ))}
      </div>

      {/* tab switcher */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:10,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:4,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:3}}>
          {[
            {key:"appts", label:"Set Appointments", count:apptDeals.length},
            {key:"sold",  label:"Sold Deals",        count:soldDeals.length},
          ].map(({key,label,count})=>{
            const on=dealTab===key;
            return (
              <button key={key} style={{
                display:"flex",alignItems:"center",gap:6,
                padding:"7px 16px",borderRadius:6,border:"none",
                background:on?"rgba(255,255,255,0.08)":"transparent",
                color:on?T.t1:T.t3,
                fontWeight:on?600:400,fontSize:13,cursor:"pointer",
                transition:"all 0.15s",fontFamily:"'Inter',system-ui,sans-serif",
                boxShadow:on?"0 1px 4px rgba(0,0,0,0.3)":"none",
              }} onClick={()=>setDealTab(key)}>
                {label}
                <span style={{
                  fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:20,
                  background:on?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)",
                  color:on?T.t2:T.t3,
                }}>{count}</span>
              </button>
            );
          })}
        </div>
        {dealTab==="appts" && (
          <button className="btn-cyan" style={{fontSize:12.5,padding:"8px 18px",width:"auto",flexShrink:0}}
            onClick={()=>{ setEditDeal(null); setModal("add"); }}>
            + New Deal
          </button>
        )}
      </div>

      {/* stage filter chips */}
      <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:16,paddingBottom:2}}>
        {dealTab==="appts"
          ? [{ key:"all", label:`All (${apptDeals.length})`, color:T.t2 },
             ...APPT_STATUSES.map(s=>({ key:s.key, label:`${s.label} (${apptDeals.filter(d=>d.status===s.key).length})`, color:s.color }))
            ].map(({key,label,color})=>{
              const on=apptFilter===key;
              return (
                <button key={key} onClick={()=>setApptFilter(key)} style={{
                  padding:"5px 11px",borderRadius:6,whiteSpace:"nowrap",
                  fontSize:11.5,fontWeight:on?600:400,cursor:"pointer",
                  background:on?`${color}18`:"transparent",
                  color:on?color:T.t3,
                  border:`1px solid ${on?`${color}44`:"rgba(255,255,255,0.04)"}`,
                  fontFamily:"'Inter',system-ui,sans-serif",transition:"all 0.15s",
                }}>{label}</button>
              );
            })
          : [{ key:"all", label:`All (${soldDeals.length})`, color:T.t2 },
             ...SOLD_STATUSES_LIST.map(s=>({ key:s.key, label:`${s.label} (${soldDeals.filter(d=>d.status===s.key).length})`, color:s.color }))
            ].map(({key,label,color})=>{
              const on=soldFilter===key;
              return (
                <button key={key} onClick={()=>setSoldFilter(key)} style={{
                  padding:"5px 11px",borderRadius:6,whiteSpace:"nowrap",
                  fontSize:11.5,fontWeight:on?600:400,cursor:"pointer",
                  background:on?`${color}18`:"transparent",
                  color:on?color:T.t3,
                  border:`1px solid ${on?`${color}44`:"rgba(255,255,255,0.04)"}`,
                  fontFamily:"'Inter',system-ui,sans-serif",transition:"all 0.15s",
                }}>{label}</button>
              );
            })
        }
      </div>

      {/* deal cards */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {activeList.map((deal,i)=>(
          <div key={deal.id} className="afu" style={{animationDelay:`${i*45}ms`,opacity:0}}>
            <DealCard deal={deal} onEdit={openEdit} onDelete={deleteDeal} isMobile={isMobile}
              onMarkSold={dealTab==="appts" ? (d)=>updateDeal({...d,status:"sold"}) : null}
            />
          </div>
        ))}
        {activeList.length===0 && (
          <div style={{
            textAlign:"center",padding:"60px 0",
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,
          }}>
            <div style={{fontWeight:600,fontSize:14,color:T.t2,marginBottom:6}}>
              {dealTab==="appts" ? "No appointments in this stage" : "No deals in this stage"}
            </div>
            <div style={{fontSize:13,color:T.t3,marginBottom:20}}>
              {dealTab==="appts"
                ? "Add your first appointment to start tracking"
                : "Mark deals as sold to see them here"}
            </div>
            {dealTab==="appts" && (
              <button className="btn-cyan" style={{width:"auto",fontSize:13,padding:"9px 22px"}}
                onClick={()=>{ setEditDeal(null); setModal("add"); }}>+ Add Deal</button>
            )}
          </div>
        )}
      </div>

      {modal==="add"  && <DealModal onSave={addDeal}    onClose={()=>setModal(null)}/>}
      {modal==="edit" && editDeal && <DealModal deal={editDeal} onSave={updateDeal} onClose={()=>{setModal(null);setEditDeal(null);}}/>}
    </div>
  );
}



/* ═══════════════════════════════════════════════════
   PROMOTION TAB  (standalone)
═══════════════════════════════════════════════════ */
function PromotionTab({ user, reps, isMobile }) {
  const myRep = reps.find(r => r.id === user?.id);
  if (!myRep) return null;

  const myRankObj   = getRepRank(myRep);
  const rankIdx     = SETTER_RANKS.findIndex(r => r.id === myRankObj.id);
  const sr          = mvalPromo(myRep, "showRate");
  const { nextRank, promo: nextPromo } = getNextRankPromo(myRep);

  const fmtVal = (c, val) => c.fmt ? c.fmt(val) : `${val}`;

  return (
    <div className="afu" style={{opacity:0,maxWidth:700}}>

      {/* Header card — current rank + progress bar */}
      <div style={{
        padding:"20px 24px",marginBottom:20,
        background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",
        borderRadius:16,backdropFilter:"blur(32px)",position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:1,
          background:`linear-gradient(90deg,transparent,${myRankObj.color}55,transparent)`}}/>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
          <div style={{
            width:44,height:44,borderRadius:10,flexShrink:0,
            background:myRankObj.bg,border:`1px solid ${myRankObj.border}`,
            display:"flex",alignItems:"center",justifyContent:"center",color:myRankObj.color,
          }}>
            {typeof myRankObj.logo==="function" && myRankObj.logo(20)}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:700,color:T.t1,letterSpacing:"-0.02em",lineHeight:1,marginBottom:4}}>{myRankObj.title}</div>
            <div style={{fontSize:12,color:T.t2}}>{myRankObj.comp.label}</div>
          </div>
          <div style={{display:"flex",gap:16,flexShrink:0}}>
            <div style={{textAlign:"right"}}>
              <div className="mono" style={{fontSize:18,fontWeight:700,color:T.t1,lineHeight:1}}>{myRep.appts}</div>
              <div style={{fontSize:10,color:T.t3,marginTop:2}}>Appts</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div className="mono" style={{fontSize:18,fontWeight:700,
                color:sr>=70?T.green:sr>=60?T.amber:T.red,lineHeight:1}}>{sr}%</div>
              <div style={{fontSize:10,color:T.t3,marginTop:2}}>Show Rate</div>
            </div>
          </div>
        </div>
        <RankProgressBar rep={myRep}/>
      </div>

      {/* Ladder */}
      <div style={{
        background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:16,overflow:"hidden",marginBottom:24,
      }}>
        <div style={{padding:"14px 22px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.t1}}>Promotion Ladder</div>
          <div style={{fontSize:11,color:T.t3,marginTop:2}}>Comp plan and requirements at each tier</div>
        </div>

        {SETTER_RANKS.map((rank, i) => {
          const isCurrent = rank.id === myRankObj.id;
          const isBelow   = i < rankIdx;
          const isNext    = i === rankIdx + 1;
          const isAbove   = i > rankIdx;
          // Show progress panel only on the CURRENT rank row, toward the next rank
          const showProgress = isCurrent && nextPromo;

          // Vertical connector height — taller if progress panel will show
          const connectorH = showProgress ? 32 : 24;

          return (
            <div key={rank.id} style={{
              borderBottom: i < SETTER_RANKS.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              background: isCurrent ? `${rank.color}09` : "transparent",
            }}>
              <div style={{display:"flex",alignItems:"flex-start",gap:16,padding:"18px 22px"}}>

                {/* Icon + connector */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0,paddingTop:2}}>
                  <div style={{
                    width:38,height:38,borderRadius:10,
                    background:isBelow?"rgba(48,209,88,0.1)":isCurrent?`${rank.color}18`:"rgba(255,255,255,0.03)",
                    border:`1px solid ${isBelow?"rgba(48,209,88,0.25)":isCurrent?`${rank.color}44`:"rgba(255,255,255,0.07)"}`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    color:isBelow?T.green:isCurrent?rank.color:T.t3,
                  }}>
                    {isBelow
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : typeof rank.logo==="function" ? rank.logo(16) : null
                    }
                  </div>
                  {i < SETTER_RANKS.length-1 && (
                    <div style={{width:1,height:connectorH,marginTop:6,
                      background:isBelow?"rgba(48,209,88,0.3)":"rgba(255,255,255,0.07)"}}/>
                  )}
                </div>

                {/* Content */}
                <div style={{flex:1,minWidth:0}}>
                  {/* Title + badges */}
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7,flexWrap:"wrap"}}>
                    <span style={{
                      fontSize:14,fontWeight:isCurrent?700:500,letterSpacing:"-0.01em",
                      color:isBelow?T.t2:isCurrent?rank.color:T.t3,
                    }}>{rank.title}</span>
                    {isBelow  && <span style={{fontSize:9.5,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",color:T.green,background:"rgba(48,209,88,0.1)",border:"1px solid rgba(48,209,88,0.2)",borderRadius:4,padding:"2px 7px"}}>Achieved</span>}
                    {isCurrent && <span style={{fontSize:9.5,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",color:rank.color,background:rank.bg,border:`1px solid ${rank.border}`,borderRadius:4,padding:"2px 7px"}}>Current</span>}
                    {isNext   && <span style={{fontSize:9.5,color:T.t3,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:4,padding:"2px 7px"}}>Up Next</span>}
                  </div>

                  {/* Comp */}
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6,flexWrap:"wrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span className="caps" style={{fontSize:8.5,color:T.t3}}>Commission</span>
                      <span className="mono" style={{fontSize:13,fontWeight:700,color:isBelow?T.t2:isCurrent?rank.color:T.t3}}>{rank.comp.pct}</span>
                    </div>
                    <div style={{width:1,height:12,background:"rgba(255,255,255,0.08)"}}/>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span className="caps" style={{fontSize:8.5,color:T.t3}}>Upfront</span>
                      <span className="mono" style={{fontSize:13,fontWeight:700,color:isBelow?T.t2:isCurrent?rank.color:T.t3}}>{rank.comp.upfront}</span>
                    </div>
                  </div>

                  {/* Requirements line */}
                  {rank.req && (
                    <div style={{fontSize:11.5,color:isBelow?T.t3:isCurrent?T.t2:T.t3,marginBottom:showProgress?12:0}}>
                      {rank.req}
                    </div>
                  )}

                  {/* Progress toward next rank — shown only on current rank row */}
                  {showProgress && nextRank && (() => {
                    // Build logical sections: standalone criteria, then OR groups
                    const sections = [];
                    const seenGroups = new Set();
                    nextPromo.criteria.forEach(c => {
                      if (!c.orGroup) {
                        sections.push({ type:"single", c });
                      } else if (!seenGroups.has(c.orGroup)) {
                        seenGroups.add(c.orGroup);
                        const members = nextPromo.criteria.filter(x => x.orGroup === c.orGroup);
                        sections.push({ type:"or", members });
                      }
                    });
                    return (
                      <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10}}>
                        <div style={{fontSize:11,color:T.t3,marginBottom:12}}>
                          Progress toward <span style={{color:nextRank.color,fontWeight:600}}>{nextRank.title}</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          {sections.map((section, si) => {
                            if (section.type === "single") {
                              const c = section.c;
                              const val  = mvalPromo(myRep, c.metric);
                              const pct  = Math.min(100, Math.round((val / (c.goal || 1)) * 100));
                              const done = val >= c.goal;
                              return (
                                <div key={c.label}>
                                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                                    <span className="caps" style={{fontSize:8.5,color:T.t3}}>{c.label}</span>
                                    <span className="mono" style={{fontSize:12,fontWeight:600,color:done?nextRank.color:T.t2}}>
                                      {fmtVal(c,val)} / {fmtVal(c,c.goal)}{done?" ✓":""}
                                    </span>
                                  </div>
                                  <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.07)",overflow:"hidden"}}>
                                    <div style={{height:"100%",width:`${pct}%`,borderRadius:2,background:done?nextRank.color:`${nextRank.color}55`,transition:"width 0.8s cubic-bezier(0.22,1,0.36,1)"}}/>
                                  </div>
                                </div>
                              );
                            }
                            // OR group — show each member, "OR" divider between them
                            const { members } = section;
                            const groupDone = members.some(c => mvalPromo(myRep, c.metric) >= c.goal);
                            return (
                              <div key={`or-${si}`} style={{
                                border:`1px solid ${groupDone?"rgba(48,209,88,0.2)":"rgba(255,255,255,0.06)"}`,
                                borderRadius:8,overflow:"hidden",
                                background:groupDone?"rgba(48,209,88,0.04)":"transparent",
                              }}>
                                {members.map((c, mi) => {
                                  const val  = mvalPromo(myRep, c.metric);
                                  const pct  = Math.min(100, Math.round((val / (c.goal || 1)) * 100));
                                  const done = val >= c.goal;
                                  return (
                                    <div key={c.label}>
                                      {mi > 0 && (
                                        <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 10px"}}>
                                          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.05)"}}/>
                                          <span style={{fontSize:9,fontWeight:700,color:T.t3,letterSpacing:"0.08em"}}>OR</span>
                                          <div style={{flex:1,height:1,background:"rgba(255,255,255,0.05)"}}/>
                                        </div>
                                      )}
                                      <div style={{padding:"8px 10px"}}>
                                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                                          <span className="caps" style={{fontSize:8.5,color:done?nextRank.color:T.t3}}>{c.label}</span>
                                          <span className="mono" style={{fontSize:12,fontWeight:600,color:done?nextRank.color:T.t2}}>
                                            {fmtVal(c,val)} / {fmtVal(c,c.goal)}{done?" ✓":""}
                                          </span>
                                        </div>
                                        <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.07)",overflow:"hidden"}}>
                                          <div style={{height:"100%",width:`${pct}%`,borderRadius:2,background:done?nextRank.color:`${nextRank.color}55`,transition:"width 0.8s cubic-bezier(0.22,1,0.36,1)"}}/>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Top rank — no next level */}
                  {isCurrent && !nextPromo && (
                    <div style={{fontSize:11.5,color:T.amber,marginTop:4}}>Top rank achieved — talk to your manager about next steps.</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{fontSize:11,color:T.t3,lineHeight:1.8}}>
        Promotions reviewed monthly by your manager. All criteria based on cumulative monthly numbers.
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   INCENTIVES & PROMOTIONS
═══════════════════════════════════════════════════ */

// Sample incentive data (admin would set these)
const INCENTIVES_DATA = [
  {
    id:"inc1", type:"rank", title:"Cabo Trip 🏖️", subtitle:"Top 3 reps this month fly to Cabo",
    description:"All-inclusive 4-night trip for the top 3 performers ranked by total appointments set.",
    prize:"All-Inclusive Cabo Trip", icon:"↗", color:T.amber, endDate:"2026-06-30",
    metric:"appts", rankCutoff:3,
  },
  {
    id:"inc2", type:"cash", title:"$2,000 Bonus", subtitle:"Close 10+ sales this month",
    description:"Hit 10 closed sales in the calendar month and earn a $2,000 cash bonus on your next paycheck.",
    prize:"$2,000 Cash", icon:"$", color:T.green, endDate:"2026-06-30",
    metric:"sales", goal:10,
  },
  {
    id:"inc3", type:"prize", title:"iPhone 16 Pro", subtitle:"Most kW sold this month wins",
    description:"The rep who sells the most total kilowatts this month takes home a brand new iPhone 16 Pro.",
    prize:"iPhone 16 Pro", icon:"◻", color:T.gold, endDate:"2026-06-30",
    metric:"kw", rankCutoff:1,
  },
  {
    id:"inc4", type:"cash", title:"$500 Spiff", subtitle:"Set 20+ appointments this week",
    description:"Any rep who books 20 or more appointments in a single week earns a $500 instant spiff.",
    prize:"$500 Cash", icon:"+", color:T.gold, endDate:"2026-03-31",
    metric:"appts", goal:20,
  },
  {
    id:"inc5", type:"tiered", title:"Monthly Bonus Tiers", subtitle:"Hit milestones, stack your earnings",
    description:"Three tiers of cash bonuses based on deals closed. Stack multiple tiers in one month.",
    prize:"Up to $5,000", icon:"◈", color:T.red, endDate:"2026-06-30",
    metric:"sales",
    tiers:[
      {label:"Bronze", threshold:5,  reward:"$500",  color:"#b87333"},
      {label:"Silver", threshold:8,  reward:"$1,500",color:"#888888"},
      {label:"Gold",   threshold:12, reward:"$5,000",color:T.gold},
    ],
  },
];

const PROMOTIONS_DATA = [
  {
    id:"promo_setter", targetRankId:"setter", title:"Setter",
    color:"#7a8fa8",
    criteria:[
      {label:"Min Sets",          metric:"appts",    goal:15, fmt:v=>`${v}`},
      {label:"Elite Month Sets",  metric:"appts",    goal:30, fmt:v=>`${v}`, orGroup:"sets"},
      {label:"3-Mo Total Sets",   metric:"appts",    goal:75, fmt:v=>`${v}`, orGroup:"sets"},
      {label:"Show Rate Elite Month",    metric:"showRate", goal:30, fmt:v=>`${v}%`, orGroup:"sr"},
      {label:"Show Rate 3-Mo Total",   metric:"showRate", goal:28, fmt:v=>`${v}%`, orGroup:"sr"},
    ],
  },
  {
    id:"promo_captain", targetRankId:"setter_captain", title:"Setter Captain",
    color:T.blue,
    criteria:[
      {label:"Min Sets",          metric:"appts",    goal:25, fmt:v=>`${v}`},
      {label:"Elite Month Sets",  metric:"appts",    goal:40, fmt:v=>`${v}`, orGroup:"sets"},
      {label:"3-Mo Total Sets",   metric:"appts",    goal:105, fmt:v=>`${v}`, orGroup:"sets"},
      {label:"Show Rate Elite Month",    metric:"showRate", goal:33, fmt:v=>`${v}%`, orGroup:"sr"},
      {label:"Show Rate 3-Mo Total",   metric:"showRate", goal:32, fmt:v=>`${v}%`, orGroup:"sr"},
    ],
  },
  {
    id:"promo_manager", targetRankId:"setter_manager", title:"Setter Manager",
    color:T.amber,
    criteria:[
      {label:"Min Sets",          metric:"appts",    goal:30, fmt:v=>`${v}`},
      {label:"Elite Month Sets",  metric:"appts",    goal:50, fmt:v=>`${v}`, orGroup:"sets"},
      {label:"3-Mo Total Sets",   metric:"appts",    goal:135, fmt:v=>`${v}`, orGroup:"sets"},
      {label:"Show Rate Elite Month",    metric:"showRate", goal:35, fmt:v=>`${v}%`, orGroup:"sr"},
      {label:"Show Rate 3-Mo Total",   metric:"showRate", goal:35, fmt:v=>`${v}%`, orGroup:"sr"},
    ],
  },
];


function useCountdown(endDate) {
  const [time, setTime] = useState({d:0,h:0,m:0,s:0,expired:false});
  useEffect(()=>{
    const calc=()=>{
      const diff = new Date(endDate) - new Date();
      if(diff<=0){setTime({d:0,h:0,m:0,s:0,expired:true});return;}
      const d=Math.floor(diff/86400000);
      const h=Math.floor((diff%86400000)/3600000);
      const m=Math.floor((diff%3600000)/60000);
      const s=Math.floor((diff%60000)/1000);
      setTime({d,h,m,s,expired:false});
    };
    calc();
    const iv=setInterval(calc,1000);
    return ()=>clearInterval(iv);
  },[endDate]);
  return time;
}

function Countdown({ endDate, color }) {
  const {d,h,m,s,expired} = useCountdown(endDate);
  if(expired) return (
    <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,background:T.redDm,border:"1px solid rgba(255,69,58,0.25)"}}>
      <span style={{fontSize:12,color:T.red,fontWeight:600}}>Ended</span>
    </div>
  );
  return (
    <div style={{display:"flex",alignItems:"center",gap:3}}>
      {[{val:d,label:"d"},{val:h,label:"h"},{val:m,label:"m"},{val:s,label:"s"}].map(({val,label},i)=>(
        <div key={label} style={{display:"flex",alignItems:"center",gap:3}}>
          <div className="countdown-box" style={{borderColor:`${color}22`,minWidth:44}}>
            <span className="mono tick" style={{fontSize:16,fontWeight:700,color,lineHeight:1}}>{String(val).padStart(2,"0")}</span>
            <span style={{fontSize:9,color:T.t3,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}</span>
          </div>
          {i<3 && <span style={{color:T.t3,fontSize:13,fontWeight:300,lineHeight:1,flexShrink:0}}>:</span>}
        </div>
      ))}
    </div>
  );
}

function IncProgressBar({ value, max, color, height=8, animated=true, delay=0 }) {
  const pct=Math.min((value/(max||1))*100,100);
  const done=pct>=100;
  return (
    <div style={{position:"relative"}}>
      <div style={{height,borderRadius:height/2,background:"rgba(255,255,255,0.04)",overflow:"hidden"}}>
        <div style={{
          height:"100%",
          width:animated?`${pct}%`:0,
          borderRadius:height/2,
          background:done?`linear-gradient(90deg,${color},#34d399)`:color,
          boxShadow:done?`0 0 12px #34d39966`:`0 0 8px ${color}55`,
          animation:animated?`barGrow 1.2s cubic-bezier(0.22,1,0.36,1) ${delay}ms forwards`:"none",
          transition:"width 0.9s cubic-bezier(0.22,1,0.36,1)",
        }}/>
      </div>
      {done && (
        <div style={{position:"absolute",right:0,top:-18,fontSize:11,color:T.green,fontWeight:700}}>✓ Done!</div>
      )}
    </div>
  );
}

function TypeBadge({type,color}) {
  const map={cash:"💵 Cash Bonus",trip:"✈️ Trip",prize:"🎁 Prize",rank:"🏆 Competition",tiered:"🏅 Tiered"};
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:4,
      padding:"3px 9px",borderRadius:20,fontSize:10.5,fontWeight:600,
      background:`${color}18`,color,border:`1px solid ${color}33`,letterSpacing:"0.02em",
    }}>{map[type]||type}</span>
  );
}

function RaceBoard({ incentive, reps, user }) {
  const sorted = sortBy(reps, incentive.metric);
  const cutoff = incentive.rankCutoff||3;
  const maxV   = mval(sorted[0]||{appts:1,sales:1,kw:1,revenue:1,shows:1,showRate:1}, incentive.metric)||1;
  const m      = METRICS.find(x=>x.key===incentive.metric);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div className="caps" style={{fontSize:9.5}}>Race Standing · {m?.label}</div>
        <div style={{fontSize:11,color:T.t3}}>Top {cutoff} win</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {sorted.map((rep,i)=>{
          const val=mval(rep,incentive.metric);
          const pct=Math.min((val/maxV)*100,100);
          const inPrize=i<cutoff;
          const isMe=rep.id===user?.id;
          const podLabels=["1st","2nd","3rd"];
          return (
            <div key={rep.id} className={`rep-race-row${isMe?" is-me":""}`}>
              <div style={{width:24,textAlign:"center",fontSize:i<3?13:11,color:i<3?[T.r0,T.r1,T.r2][i]:T.t3,fontWeight:700,flexShrink:0,fontFamily:"'JetBrains Mono',monospace"}}>
                {i+1}
              </div>
              <Avatar name={rep.name} size={32}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                  <span style={{fontSize:12.5,fontWeight:isMe?700:500,color:isMe?T.cyan:T.t1,letterSpacing:"-0.01em"}}>
                    {rep.name.split(" ")[0]} {rep.name.split(" ")[1]?.[0]}.
                  </span>
                  {isMe && <span style={{display:"none"}}></span>}
                  {inPrize && <span style={{fontSize:9,background:`${incentive.color}18`,color:incentive.color,border:`1px solid ${incentive.color}33`,borderRadius:20,padding:"1px 7px",fontWeight:700}}>Prize zone</span>}
                </div>
                <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,0.04)",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,borderRadius:2,background:inPrize?incentive.color:T.t3,boxShadow:"none",animation:"barGrow 1s cubic-bezier(0.22,1,0.36,1) forwards"}}/>
                </div>
              </div>
              <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:13,fontWeight:700,color:inPrize?incentive.color:T.t2,flexShrink:0}}>
                {m?.fmt(val)||val}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IncentiveCard({ inc, reps, user, isMobile }) {
  const [open,setOpen]=useState(false);
  const myRep  = reps.find(r=>r.id===user?.id);
  const myVal  = myRep ? mval(myRep, inc.metric) : 0;
  const isRank = inc.type==="rank"||inc.type==="prize";
  const isTiered = inc.type==="tiered";
  const sorted = sortBy(reps, inc.metric);
  const myRank = sorted.findIndex(r=>r.id===user?.id);
  const inPrize= isRank && myRank < (inc.rankCutoff||3);
  const hitGoal= !isRank && !isTiered && myVal >= (inc.goal||1);

  // Tiered current tier
  let currentTier=null, nextTier=null;
  if(isTiered && inc.tiers){
    const earned=inc.tiers.filter(t=>myVal>=t.threshold);
    currentTier=earned[earned.length-1]||null;
    const remaining=inc.tiers.filter(t=>myVal<t.threshold);
    nextTier=remaining[0]||null;
  }

  const statusColor = hitGoal||inPrize ? T.green : inc.color;

  return (
    <div className="inc-card" style={{
      borderColor: hitGoal||inPrize ? "rgba(48,209,88,0.3)" : "rgba(255,255,255,0.08)",
      boxShadow: hitGoal||inPrize ? `0 0 30px ${T.greenDm}` : "none",
    }}>
      {/* color accent top bar */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,transparent,${inc.color},transparent)`}}/>
      {/* ambient glow */}
      <div style={{display:"none"}}/>

      <div style={{padding:isMobile?"18px 18px 16px":"24px 24px 20px",position:"relative"}}>

        {/* header */}
        <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:16}}>
          <div style={{
            width:isMobile?42:50,height:isMobile?42:50,borderRadius:14,
            background:`${inc.color}18`,border:`1px solid ${inc.color}33`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?20:24,flexShrink:0,
          }}>{inc.icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
              <span style={{fontWeight:700,fontSize:isMobile?15:17,color:T.t1,letterSpacing:"-0.02em"}}>{inc.title}</span>
              <TypeBadge type={inc.type} color={inc.color}/>
              {(hitGoal||inPrize) && <span style={{fontSize:10,fontWeight:600,color:T.green,background:T.greenDm,border:"1px solid rgba(48,209,88,0.25)",borderRadius:4,padding:"2px 8px"}}>✓ Qualifying!</span>}
            </div>
            <div style={{fontSize:12.5,color:T.t2}}>{inc.subtitle}</div>
          </div>
          {!isMobile && (
            <div style={{flexShrink:0}}>
              <Countdown endDate={inc.endDate} color={inc.color}/>
            </div>
          )}
        </div>

        {/* mobile countdown */}
        {isMobile && (
          <div style={{marginBottom:14}}>
            <div className="caps" style={{marginBottom:7,fontSize:9.5}}>Time Remaining</div>
            <Countdown endDate={inc.endDate} color={inc.color}/>
          </div>
        )}

        {/* prize callout */}
        <div style={{
          display:"flex",alignItems:"center",gap:10,
          background:`${inc.color}0d`,border:`1px solid ${inc.color}22`,
          borderRadius:10,padding:"10px 14px",marginBottom:16,
        }}>
          
          <div>
            <div className="caps" style={{color:inc.color,fontSize:9,marginBottom:2}}>Prize</div>
            <div style={{fontWeight:700,fontSize:14,color:T.t1,letterSpacing:"-0.01em"}}>{inc.prize}</div>
          </div>
        </div>

        {/* TIERED */}
        {isTiered && inc.tiers && (
          <div style={{marginBottom:16}}>
            <div className="caps" style={{marginBottom:10,fontSize:9.5}}>Your Progress Through Tiers</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {inc.tiers.map((tier,ti)=>{
                const hit=myVal>=tier.threshold;
                const isNext=!hit && (ti===0 || myVal>=inc.tiers[ti-1].threshold);
                const pct=Math.min((myVal/tier.threshold)*100,100);
                return (
                  <div key={tier.label} style={{
                    background:hit?T.greenDm:isNext?`${tier.color}0a`:"rgba(255,255,255,0.02)",
                    border:`1px solid ${hit?"rgba(48,209,88,0.25)":isNext?`${tier.color}33`:"rgba(255,255,255,0.04)"}`,
                    borderRadius:10,padding:"11px 14px",
                  }}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span className="tier-badge" style={{background:`${tier.color}18`,color:tier.color,border:`1px solid ${tier.color}33`}}>
                          {tier.label}
                        </span>
                        <span style={{fontSize:12,color:T.t2}}>{METRICS.find(x=>x.key===inc.metric)?.fmt(tier.threshold)||tier.threshold}+ {inc.metric}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <span style={{fontFamily:"'JetBrains Mono', monospace",fontSize:14,fontWeight:700,color:tier.color}}>{tier.reward}</span>
                        {hit && <span style={{fontSize:14}}>✅</span>}
                      </div>
                    </div>
                    <IncProgressBar value={myVal} max={tier.threshold} color={tier.color} delay={ti*80}/>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                      <span style={{fontSize:11,color:T.t3}}>Your current: <span style={{color:T.t1,fontWeight:600}}>{METRICS.find(x=>x.key===inc.metric)?.fmt(myVal)||myVal}</span></span>
                      {!hit && <span style={{fontSize:11,color:tier.color,fontWeight:600}}>{tier.threshold - myVal} more to unlock</span>}
                      {hit && <span style={{fontSize:11,color:T.green,fontWeight:700}}>Unlocked! 🎉</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GOAL-BASED (cash/prize single threshold) */}
        {!isRank && !isTiered && (
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:7}}>
              <div>
                <div className="caps" style={{marginBottom:3,fontSize:9.5}}>Your Progress</div>
                <div style={{display:"flex",alignItems:"baseline",gap:4}}>
                  <span style={{fontFamily:"'JetBrains Mono', monospace",fontSize:22,fontWeight:700,color:statusColor,lineHeight:1}}>
                    {METRICS.find(x=>x.key===inc.metric)?.fmt(myVal)||myVal}
                  </span>
                  <span style={{fontSize:13,color:T.t3}}>/ {METRICS.find(x=>x.key===inc.metric)?.fmt(inc.goal)||inc.goal}</span>
                </div>
              </div>
              <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:20,fontWeight:700,color:statusColor}}>
                {Math.round(Math.min((myVal/(inc.goal||1))*100,100))}%
              </div>
            </div>
            <IncProgressBar value={myVal} max={inc.goal||1} color={inc.color} height={10}/>
            {!hitGoal && (
              <div style={{fontSize:12,color:T.t3,marginTop:6}}>
                <span style={{color:inc.color,fontWeight:600}}>{METRICS.find(x=>x.key===inc.metric)?.fmt((inc.goal||1)-myVal)||((inc.goal||1)-myVal)}</span> more to earn the bonus
              </div>
            )}
          </div>
        )}

        {/* RANK-BASED my position */}
        {isRank && (
          <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
            <div style={{
              flex:1,minWidth:140,padding:"12px 16px",
              background:inPrize?T.greenDm:inc.color+"0d",
              border:`1px solid ${inPrize?"rgba(48,209,88,0.25)":inc.color+"22"}`,borderRadius:10,
            }}>
              <div className="caps" style={{marginBottom:4,fontSize:9.5,color:inPrize?T.green:inc.color}}>Your Rank</div>
              <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:28,fontWeight:700,color:inPrize?T.green:inc.color,lineHeight:1}}>
                #{myRank+1}
              </div>
              <div style={{fontSize:11,color:T.t3,marginTop:3}}>
                {inPrize?`✓ In top ${inc.rankCutoff} — you're winning!`:`Need top ${inc.rankCutoff} to win`}
              </div>
            </div>
            <div style={{
              flex:1,minWidth:140,padding:"12px 16px",
              background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,
            }}>
              <div className="caps" style={{marginBottom:4,fontSize:9.5}}>Your {METRICS.find(x=>x.key===inc.metric)?.label}</div>
              <div style={{fontFamily:"'JetBrains Mono', monospace",fontSize:22,fontWeight:700,color:T.t1,lineHeight:1}}>
                {METRICS.find(x=>x.key===inc.metric)?.fmt(myVal)||myVal}
              </div>
              {myRank>0 && (
                <div style={{fontSize:11,color:T.t3,marginTop:3}}>
                  {(() => {
                    const above=sorted[myRank-1];
                    const gap=mval(above,inc.metric)-myVal;
                    return <>Gap to #{myRank}: <span style={{color:inc.color,fontWeight:600}}>{METRICS.find(x=>x.key===inc.metric)?.fmt(gap)||gap}</span></>;
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* expand / collapse race board */}
        <button style={{
          display:"flex",alignItems:"center",gap:7,width:"100%",
          background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:9,padding:"9px 14px",cursor:"pointer",transition:"all 0.16s",
          fontFamily:"'Inter',system-ui,sans-serif",fontSize:12.5,fontWeight:500,color:T.t2,
        }} onClick={()=>setOpen(o=>!o)}>
          <span style={{flex:1,textAlign:"left"}}>{open?"Hide":"Show"} full team race</span>
          <span style={{fontSize:11,transition:"transform 0.2s",transform:open?"rotate(180deg)":"none"}}>▼</span>
        </button>

        {open && (
          <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
            <RaceBoard incentive={inc} reps={reps} user={user}/>
          </div>
        )}
      </div>
    </div>
  );
}

function PromotionCard({ promo, rep, allReps, isMobile }) {
  const criteria = promo.criteria.map(c=>{
    const val = mval(rep, c.metric);
    const pct = Math.min((val/(c.goal||1))*100,100);
    const done = val >= c.goal;
    return {...c, val, pct, done};
  });
  const allDone  = criteria.every(c=>c.done);
  const progress = Math.round(criteria.reduce((s,c)=>s+c.pct,0)/criteria.length);
  const myRank   = sortBy(allReps,"appts").findIndex(r=>r.id===rep.id)+1;

  return (
    <div className="promo-card" style={{
      borderColor: allDone?`rgba(48,209,88,0.3)`:"rgba(255,255,255,0.08)",
      boxShadow: allDone?`0 0 30px ${T.greenDm}`:"none",
    }}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${promo.color},transparent)`}}/>
      <div style={{display:"none"}}/>

      <div style={{padding:isMobile?"18px":"24px",position:"relative"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:18}}>
          <div style={{
            width:isMobile?44:52,height:isMobile?44:52,borderRadius:14,
            background:`${promo.color}18`,border:`1px solid ${promo.color}33`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?22:26,flexShrink:0,
          }}>
            {(() => {
              const r = SETTER_RANKS.find(rk=>rk.title===promo.title);
              return r ? <span style={{color:r.color}}>{r.logo(isMobile?22:26)}</span> : promo.icon;
            })()}
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
              <span style={{fontWeight:700,fontSize:isMobile?15:17,color:T.t1,letterSpacing:"-0.02em"}}>{promo.title}</span>
              {allDone && <span style={{fontSize:10,fontWeight:600,color:T.green,background:T.greenDm,border:"1px solid rgba(48,209,88,0.25)",borderRadius:4,padding:"2px 8px"}}>✓ Completed</span>}
            </div>
            <div style={{fontSize:12.5,color:T.t2}}>{promo.description}</div>
          </div>
          {/* overall progress ring */}
          <div style={{flexShrink:0,textAlign:"center"}}>
            <svg width={isMobile?48:56} height={isMobile?48:56} viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke={"rgba(255,255,255,0.04)"} strokeWidth="5"/>
              <circle cx="28" cy="28" r="22" fill="none" stroke={allDone?T.green:promo.color} strokeWidth="5"
                strokeLinecap="round" strokeDasharray={`${2*Math.PI*22}`}
                strokeDashoffset={`${2*Math.PI*22*(1-progress/100)}`}
                style={{transformOrigin:"center",transform:"rotate(-90deg)",transition:"stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)",filter:`drop-shadow(0 0 5px ${allDone?T.green:promo.color}88)`}}/>
              <text x="28" y="33" textAnchor="middle" fill={allDone?T.green:promo.color} fontSize="12" fontWeight="700" fontFamily="'JetBrains Mono', monospace">{progress}%</text>
            </svg>
          </div>
        </div>

        {/* criteria */}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
          {criteria.map((c,i)=>(
            <div key={c.label} style={{
              background:c.done?T.greenDm:"rgba(255,255,255,0.02)",
              border:`1px solid ${c.done?"rgba(48,209,88,0.2)":"rgba(255,255,255,0.04)"}`,
              borderRadius:9,padding:"10px 13px",
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                <span style={{fontSize:12.5,color:c.done?T.green:T.t2,fontWeight:c.done?600:400}}>
                  {c.done ? "✓ Completed" : c.label}
                </span>
                <span style={{fontFamily:"'JetBrains Mono', monospace",fontSize:12,fontWeight:700,color:c.done?T.green:promo.color}}>
                  {METRICS.find(m=>m.key===c.metric)?.fmt(c.val)||c.val} / {METRICS.find(m=>m.key===c.metric)?.fmt(c.goal)||c.goal}
                </span>
              </div>
              <IncProgressBar value={c.val} max={c.goal} color={c.done?T.green:promo.color} height={5} delay={i*60}/>
            </div>
          ))}
        </div>

        {/* current rank callout */}
        <div style={{
          display:"flex",alignItems:"center",gap:10,
          background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:9,padding:"10px 14px",
        }}>
          
          <div>
            <div className="caps" style={{fontSize:9.5,marginBottom:2}}>Current Overall Rank</div>
            <div style={{fontSize:14,color:T.t1,fontWeight:600}}>
              #{myRank} out of {allReps.length} reps
              {myRank<=3 && <span style={{marginLeft:8,fontSize:11,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:T.r0}}>{["1st","2nd","3rd"][myRank-1]}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   INCENTIVES ADMIN — create & manage contests
═══════════════════════════════════════════════════ */
function IncentivesAdmin({ incentives, onSave, isMobile }) {
  const blank = { id:"", type:"rank", title:"", subtitle:"", description:"", prize:"", icon:"🏆", color:T.cyan, endDate:"", metric:"appts", rankCutoff:3, goal:0, active:true };
  const [editing, setEditing] = useState(null); // null = list, object = editing
  const [form, setForm] = useState(blank);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const saveContest = () => {
    if (!form.title || !form.endDate) return;
    const isNew = !form.id;
    const entry = isNew ? {...form, id:`inc${Date.now()}`} : form;
    onSave(p => isNew ? [...p, entry] : p.map(x=>x.id===entry.id?entry:x));
    setEditing(null);
  };

  const deleteContest = (id) => {
    if (!window.confirm("Delete this contest?")) return;
    onSave(p => p.filter(x=>x.id!==id));
  };

  const METRIC_OPTS = [{k:"appts",l:"Appointments"},{k:"sales",l:"Sales Closed"},{k:"kw",l:"Kilowatts"},{k:"revenue",l:"Revenue"},{k:"shows",l:"Shows"}];

  if (editing !== null) {
    return (
      <div className="afu" style={{opacity:0,maxWidth:540}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button className="btn-out" style={{padding:"6px 14px",fontSize:12.5}} onClick={()=>setEditing(null)}>← Back</button>
          <div style={{fontWeight:700,fontSize:16,color:T.t1,letterSpacing:"-0.02em"}}>{form.id?"Edit Contest":"New Contest"}</div>
        </div>
        <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"22px 24px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:5}}>Title</div><input className="hinput" value={form.title} onChange={e=>set("title",e.target.value)} placeholder="Cabo Trip 🏖️" autoFocus/></div>
            <div><div className="caps" style={{marginBottom:5}}>Subtitle</div><input className="hinput" value={form.subtitle} onChange={e=>set("subtitle",e.target.value)} placeholder="Top 3 this month"/></div>
          </div>
          <div><div className="caps" style={{marginBottom:5}}>Prize Description</div><input className="hinput" value={form.prize} onChange={e=>set("prize",e.target.value)} placeholder="All-Inclusive Cabo Trip"/></div>
          <div><div className="caps" style={{marginBottom:5}}>Details</div><input className="hinput" value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Full contest rules..."/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:5}}>Metric</div>
              <select className="hinput" value={form.metric} onChange={e=>set("metric",e.target.value)} style={{cursor:"pointer"}}>
                {METRIC_OPTS.map(m=><option key={m.k} value={m.k}>{m.l}</option>)}
              </select>
            </div>
            <div><div className="caps" style={{marginBottom:5}}>Type</div>
              <select className="hinput" value={form.type} onChange={e=>set("type",e.target.value)} style={{cursor:"pointer"}}>
                {["rank","cash","prize","tiered"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div><div className="caps" style={{marginBottom:5}}>End Date</div><input className="hinput" type="date" value={form.endDate} onChange={e=>set("endDate",e.target.value)}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {form.type==="rank"&&<div><div className="caps" style={{marginBottom:5}}>Top N win</div><input className="hinput" type="number" min="1" value={form.rankCutoff||3} onChange={e=>set("rankCutoff",Number(e.target.value))}/></div>}
            {(form.type==="cash"||form.type==="prize")&&<div><div className="caps" style={{marginBottom:5}}>Goal (number)</div><input className="hinput" type="number" min="0" value={form.goal||0} onChange={e=>set("goal",Number(e.target.value))}/></div>}
            <div><div className="caps" style={{marginBottom:5}}>Icon / Emoji</div><input className="hinput" value={form.icon} onChange={e=>set("icon",e.target.value)} placeholder="🏆"/></div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:8}}>
            <button className="btn-cyan" style={{flex:1}} disabled={!form.title||!form.endDate} onClick={saveContest}>{form.id?"Save Changes":"Create Contest"}</button>
            <button className="btn-out" onClick={()=>setEditing(null)}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="afu" style={{opacity:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:16,color:T.t1,letterSpacing:"-0.02em"}}>🏆 Contests & Incentives</div>
        <button className="btn-cyan" style={{width:"auto",padding:"7px 18px",fontSize:12.5}} onClick={()=>{setForm({...blank});setEditing("new");}}>+ New Contest</button>
      </div>
      {incentives.length===0 && (
        <div style={{textAlign:"center",padding:"48px 0",color:T.t3,fontSize:13}}>No contests yet — create one to motivate your team</div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {incentives.map(inc=>{
          const isActive = new Date(inc.endDate) >= new Date();
          const stage = stageInfo ? null : null;
          return (
            <div key={inc.id} style={{display:"flex",alignItems:"center",gap:14,background:"rgba(255,255,255,0.04)",border:`1px solid ${isActive?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.05)"}`,borderRadius:12,padding:"14px 18px",opacity:isActive?1:0.55}}>
              <div style={{width:38,height:38,borderRadius:9,flexShrink:0,background:`${inc.color||T.cyan}18`,border:`1px solid ${inc.color||T.cyan}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{inc.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:13.5,color:T.t1,marginBottom:2}}>{inc.title}</div>
                <div style={{fontSize:12,color:T.t3}}>{inc.subtitle} · ends {inc.endDate}</div>
              </div>
              <span style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:5,background:isActive?"rgba(48,209,88,0.1)":"rgba(255,255,255,0.04)",color:isActive?T.green:T.t3,border:`1px solid ${isActive?"rgba(48,209,88,0.25)":"rgba(255,255,255,0.06)"}`,flexShrink:0}}>{isActive?"Active":"Ended"}</span>
              <button className="btn-sm" onClick={()=>{setForm({...inc});setEditing(inc.id);}}>Edit</button>
              <button className="btn-del" aria-label="Delete contest" onClick={()=>deleteContest(inc.id)}>✕</button>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:16,fontSize:11.5,color:T.t3,lineHeight:1.7,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:12}}>
        Contests you create here appear in your reps' Incentives tab. Ended contests stay visible as history.
      </div>
    </div>
  );
}

function Incentives({ user, reps, isMobile, incentives=INCENTIVES_DATA }) {
  const myRep = reps.find(r=>r.id===user?.id);
  if(!myRep) return null;

  const now = new Date();
  const activeIncentives = incentives.filter(inc=>new Date(inc.endDate) >= now);
  const endedIncentives  = incentives.filter(inc=>new Date(inc.endDate) < now);

  return (
    <div className="afu" style={{opacity:0}}>

      {/* active incentives */}
      {activeIncentives.length>0 && (
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{height:1,flex:1,background:"rgba(255,255,255,0.04)"}}/>
            <span className="caps" style={{fontSize:9.5,color:T.cyan}}>Active — {activeIncentives.length}</span>
            <div style={{height:1,flex:1,background:"rgba(255,255,255,0.04)"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {activeIncentives.map((inc,i)=>(
              <div key={inc.id} className="afu" style={{animationDelay:`${i*60}ms`,opacity:0}}>
                <IncentiveCard inc={inc} reps={reps} user={user} isMobile={isMobile}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeIncentives.length===0 && (
        <div style={{
          textAlign:"center",padding:"40px 0 28px",
          color:T.t3,fontSize:13,
        }}>No active incentives right now</div>
      )}

      {/* ended incentives */}
      {endedIncentives.length>0 && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{height:1,flex:1,background:"rgba(255,255,255,0.04)"}}/>
            <span className="caps" style={{fontSize:9.5}}>Ended — {endedIncentives.length}</span>
            <div style={{height:1,flex:1,background:"rgba(255,255,255,0.04)"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10,opacity:0.55}}>
            {endedIncentives.map((inc,i)=>(
              <div key={inc.id} style={{
                display:"flex",alignItems:"center",gap:14,
                background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.05)",
                borderRadius:10,padding:"13px 16px",
              }}>
                <div style={{
                  width:36,height:36,borderRadius:8,flexShrink:0,
                  background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:16,color:T.t3,
                }}>{inc.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13.5,color:T.t2,letterSpacing:"-0.01em",marginBottom:2}}>{inc.title}</div>
                  <div style={{fontSize:12,color:T.t3}}>{inc.subtitle}</div>
                </div>
                <span style={{
                  fontSize:10,fontWeight:600,color:T.t3,
                  background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.06)",
                  borderRadius:4,padding:"3px 9px",flexShrink:0,
                }}>Ended</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   INCOME TAB
═══════════════════════════════════════════════════ */
function IncomeTab({ user, reps, setReps, postedLog, isMobile }) {
  const myRep = reps.find(r=>r.id===user?.id);
  if(!myRep) return null;

  const [showDealBreakdown, setShowDealBreakdown] = useState(false);
  const [selectedStubIdx,   setSelectedStubIdx]   = useState(0);

  const rank = getRepRank(myRep);
  const RANK_COMP = {
    rookie:         { pct:0.25, upfront:500,  label:"25% commission", upfrontLabel:"$500 upfront" },
    setter:         { pct:0.30, upfront:500,  label:"30% commission", upfrontLabel:"$500 upfront" },
    setter_captain: { pct:0.40, upfront:750,  label:"40% commission", upfrontLabel:"$750 upfront" },
    setter_manager: { pct:0.50, upfront:1000, label:"50% commission", upfrontLabel:"$1,000 upfront" },
  };
  const comp = RANK_COMP[rank.id] || RANK_COMP.rookie;

  const commPaid    = myRep.commPaid    || 0;
  const commPending = myRep.commPending || 0;

  // My stubs — newest first
  const myStubs = postedLog.filter(e => e.repId === myRep.id);
  const totalStubs = myStubs.length;

  // Clamp index whenever stubs length changes
  const safeIdx = Math.min(selectedStubIdx, Math.max(0, totalStubs - 1));
  const stub = myStubs[safeIdx] || null;

  const goNext = () => { setSelectedStubIdx(i => Math.max(0, i-1)); setShowDealBreakdown(false); };
  const goPrev = () => { setSelectedStubIdx(i => Math.min(totalStubs-1, i+1)); setShowDealBreakdown(false); };

  const fmtUSD = n => `$${Number(n||0).toLocaleString()}`;

  // Build full deal entry list for selected stub
  const buildEntries = s => {
    if (!s) return [];
    const entries = [];
    (s.upfronts||[]).forEach(d => entries.push({ type:"upfront",    customer:d.customer, amt:d.amt,  sign:"+", label:"Upfront" }));
    (s.installs||[]).forEach(d => entries.push({ type:"install",    customer:d.customer, amt:d.comm, sign:"+", label:"Install Balance" }));
    (s.chargebacks||[]).forEach(d => entries.push({ type:"chargeback",customer:d.customer, amt:d.amt, sign:"-", label:"Chargeback" }));
    return entries;
  };

  const entries = buildEntries(stub);

  return (
    <div className="afu" style={{opacity:0}}>

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:10,marginBottom:24}}>
        {[
          { label:"Total Paid Out",     val:fmtUSD(commPaid),    sub:"posted paystubs YTD" },
          { label:"Commission Pending", val:fmtUSD(commPending), sub:"installs awaiting payout" },
          { label:"Pipeline Value",     val:fmtUSD(Math.round(myRep.revenue*comp.pct*0.35)), sub:"projected from open pipeline" },
          { label:"Rank",               val:rank.title,          sub:comp.label },
        ].map(({label,val,sub})=>(
          <div key={label} style={{
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:12,padding:"16px 18px",backdropFilter:"blur(24px)",
          }}>
            <div className="caps" style={{marginBottom:6,fontSize:9}}>{label}</div>
            <div className="mono" style={{fontSize:20,fontWeight:700,color:T.t1,lineHeight:1}}>{val}</div>
            <div style={{fontSize:10.5,color:T.t3,marginTop:5}}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Paystub panel */}
      <div style={{
        background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",
        borderRadius:16,overflow:"hidden",marginBottom:20,backdropFilter:"blur(32px)",
      }}>

        {/* Header with week nav */}
        <div style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"16px 22px",borderBottom:"1px solid rgba(255,255,255,0.06)",gap:10,
        }}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:15,color:T.t1,letterSpacing:"-0.01em"}}>My Paystubs</div>
            <div style={{fontSize:11,color:T.t3,marginTop:2}}>
              {totalStubs > 0 ? `${totalStubs} paystub${totalStubs!==1?"s":""} posted` : "Posted by your manager"}
            </div>
          </div>

          {/* Week navigator */}
          {totalStubs > 0 && (
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <button onClick={goPrev} disabled={safeIdx >= totalStubs-1} style={{
                width:30,height:30,borderRadius:7,border:"1px solid rgba(255,255,255,0.12)",
                background:"rgba(255,255,255,0.06)",color:safeIdx>=totalStubs-1?T.t3:T.t1,
                cursor:safeIdx>=totalStubs-1?"default":"pointer",fontSize:14,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"'Inter',system-ui,sans-serif",opacity:safeIdx>=totalStubs-1?0.35:1,
              }}aria-label="Previous paystub">‹</button>
              <div style={{textAlign:"center",minWidth:90}}>
                <div style={{fontSize:13,fontWeight:600,color:T.t1}}>{stub?.postedAt}</div>
                <div style={{fontSize:10,color:T.t3,marginTop:1}}>{safeIdx+1} of {totalStubs}</div>
              </div>
              <button onClick={goNext} disabled={safeIdx <= 0} style={{
                width:30,height:30,borderRadius:7,border:"1px solid rgba(255,255,255,0.12)",
                background:"rgba(255,255,255,0.06)",color:safeIdx<=0?T.t3:T.t1,
                cursor:safeIdx<=0?"default":"pointer",fontSize:14,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"'Inter',system-ui,sans-serif",opacity:safeIdx<=0?0.35:1,
              }}aria-label="Next paystub">›</button>
            </div>
          )}
        </div>

        {/* No stubs */}
        {totalStubs === 0 && (
          <div style={{padding:"48px",textAlign:"center"}}>
            <div style={{fontSize:13,color:T.t3,fontStyle:"italic"}}>No paystubs posted yet — your manager will post your weekly pay here</div>
          </div>
        )}

        {/* Paystub summary view */}
        {stub && !showDealBreakdown && (
          <div>
            {[
              { label:"Upfront Payout",  val:fmtUSD(stub.upfront),  note:`${(stub.upfronts||[]).length} deal${(stub.upfronts||[]).length!==1?"s":""} closed this week` },
              { label:"Install Payout",  val:(stub.installs||[]).length>0 ? fmtUSD((stub.installs||[]).reduce((s,d)=>s+d.comm,0)) : "—", note:(stub.installs||[]).length>0?`${stub.installs.length} install${stub.installs.length!==1?"s":""} confirmed`:"No installs this period" },
              { label:"Chargebacks",     val:stub.cbTotal>0?`-${fmtUSD(stub.cbTotal)}`:"—", note:stub.cbTotal>0?`${(stub.chargebacks||[]).length} deal${(stub.chargebacks||[]).length!==1?"s":""} cancelled`:"None", negative:stub.cbTotal>0 },
              { label:"Total Pay",       val:fmtUSD(stub.total), note:"Upfronts + installs − chargebacks", bold:true },
            ].map(({label,val,note,negative,bold})=>(
              <div key={label} style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                padding:"15px 22px",borderBottom:"1px solid rgba(255,255,255,0.04)",
                background:bold?"rgba(255,255,255,0.03)":"transparent",
              }}>
                <div>
                  <div style={{fontSize:13,fontWeight:bold?700:500,color:T.t1}}>{label}</div>
                  <div style={{fontSize:11,color:T.t3,marginTop:1}}>{note}</div>
                </div>
                <div className="mono" style={{fontSize:bold?22:15,fontWeight:bold?800:600,color:negative?T.red:T.t1}}>{val}</div>
              </div>
            ))}

            {stub.note && (
              <div style={{padding:"11px 22px",borderBottom:"1px solid rgba(255,255,255,0.04)",background:"rgba(255,255,255,0.02)"}}>
                <div style={{fontSize:11,color:T.t3}}>Note: <span style={{color:T.t2,fontStyle:"italic"}}>{stub.note}</span></div>
              </div>
            )}

            {/* Deal entries — always shown */}
            <button onClick={()=>setShowDealBreakdown(true)} style={{
              display:"flex",alignItems:"center",justifyContent:"space-between",
              width:"100%",padding:"13px 22px",
              background:"transparent",border:"none",borderTop:"1px solid rgba(255,255,255,0.04)",
              cursor:"pointer",fontFamily:"'Inter',system-ui,sans-serif",
            }}>
              <div>
                <span style={{fontSize:13,fontWeight:500,color:T.t2}}>Deal Entries</span>
                <span style={{fontSize:11,color:T.t3,marginLeft:8}}>{entries.length} line item{entries.length!==1?"s":""}</span>
              </div>
              <span style={{fontSize:13,color:T.t3}}>›</span>
            </button>
          </div>
        )}

        {/* Deal entries detail view */}
        {stub && showDealBreakdown && (
          <div>
            {/* Back header */}
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 22px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <button onClick={()=>setShowDealBreakdown(false)} style={{
                background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:7,padding:"5px 12px",color:T.t2,fontSize:12,fontWeight:500,
                cursor:"pointer",fontFamily:"'Inter',system-ui,sans-serif",
              }}>← Back</button>
              <div>
                <span style={{fontSize:14,fontWeight:600,color:T.t1}}>Deal Entries</span>
                <span style={{fontSize:12,color:T.t3,marginLeft:8}}>{stub.postedAt}</span>
              </div>
            </div>

            {/* Column headers */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 120px 90px",padding:"9px 22px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <div className="caps" style={{fontSize:8.5,color:T.t3}}>Customer</div>
              <div className="caps" style={{fontSize:8.5,color:T.t3}}>Type</div>
              <div className="caps" style={{fontSize:8.5,color:T.t3,textAlign:"right"}}>Amount</div>
            </div>

            {entries.length === 0 && (
              <div style={{padding:"20px 22px"}}>
                <div style={{fontSize:12,color:T.t3,fontStyle:"italic"}}>No deal entries for this paystub</div>
              </div>
            )}

            {entries.map((e,i)=>(
              <div key={i} style={{
                display:"grid",gridTemplateColumns:"1fr 120px 90px",
                padding:"13px 22px",borderBottom:"1px solid rgba(255,255,255,0.04)",
                alignItems:"center",
                background:e.type==="chargeback"?"rgba(255,69,58,0.04)":"transparent",
              }}>
                <div style={{fontSize:13,fontWeight:500,color:e.type==="chargeback"?T.red:T.t1}}>{e.customer}</div>
                <div style={{fontSize:11,color:e.type==="chargeback"?T.red:T.t3}}>{e.label}</div>
                <div className="mono" style={{
                  fontSize:13,fontWeight:600,textAlign:"right",
                  color:e.type==="chargeback"?T.red:T.t1,
                }}>{e.sign === "-" ? "-" : ""}{fmtUSD(e.amt)}</div>
              </div>
            ))}

            {/* Totals footer */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 120px 90px",padding:"14px 22px",background:"rgba(255,255,255,0.03)",borderTop:"1px solid rgba(255,255,255,0.08)",alignItems:"center"}}>
              <div style={{fontSize:13,fontWeight:700,color:T.t1}}>Total Pay</div>
              <div/>
              <div className="mono" style={{fontSize:15,fontWeight:800,color:T.t1,textAlign:"right"}}>{fmtUSD(stub.total)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Commission tiers */}
      <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:16,overflow:"hidden",marginBottom:20}}>
        <div style={{padding:"16px 22px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{fontSize:13,fontWeight:700,color:T.t1}}>Commission Structure</div>
        </div>
        {[
          {id:"rookie",         label:"Rookie Setter",  pct:"25%", upfront:"$500"},
          {id:"setter",         label:"Setter",         pct:"30%", upfront:"$500"},
          {id:"setter_captain", label:"Setter Captain", pct:"40%", upfront:"$750"},
          {id:"setter_manager", label:"Setter Manager", pct:"50%", upfront:"$1,000"},
        ].map((tier,i,arr)=>{
          const isActive = tier.id === rank.id;
          return (
            <div key={tier.id} style={{
              display:"flex",alignItems:"center",padding:"13px 22px",
              borderBottom:i<arr.length-1?"1px solid rgba(255,255,255,0.04)":"none",
              background:isActive?"rgba(255,255,255,0.04)":"transparent",
            }}>
              <div style={{width:6,height:6,borderRadius:"50%",flexShrink:0,marginRight:12,
                background:isActive?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.15)"}}/>
              <div style={{flex:1,fontSize:13,fontWeight:isActive?600:400,color:isActive?T.t1:T.t2}}>{tier.label}</div>
              <div className="mono" style={{fontSize:13,fontWeight:isActive?700:400,color:isActive?T.t1:T.t3,marginRight:20}}>{tier.pct}</div>
              <div style={{fontSize:12,color:T.t3}}>{tier.upfront} upfront</div>
            </div>
          );
        })}
      </div>

      <div style={{fontSize:11,color:T.t3,lineHeight:1.8,borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:14}}>
        All reps are 1099 independent contractors. Upfronts paid same Friday deal closes and are never subject to deduction. Chargebacks on cancelled deals are deducted from install balance payouts only.
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   CRM + POWER DIALER — APEX SOLAR ALL-IN-ONE
═══════════════════════════════════════════════════════════════════ */

const mkLead = (o) => ({
  id:"", firstName:"", lastName:"", phone:"", email:"", address:"", city:"Phoenix", state:"AZ", zip:"",
  utilityBill:0, roofAge:0, roofType:"Comp Shingle", shade:"Low", homeowner:true, hoa:false, creditScore:"Good",
  stage:"appt_set", setterId:null, closerId:null, notes:"", source:"door_knock", tags:[],
  created:"2026-03-01", apptDate:"", apptTime:"", installDate:"", closeDate:"", followUpDate:"",
  kw:0, salePrice:0, setterCommission:0, closerCommission:0, financing:"loan", lender:"", adders:[], activity:[],
  ...o,
});

const CRM_LEADS_INIT = [
  mkLead({id:"L001",firstName:"Sarah",  lastName:"Mitchell",  phone:"(602)555-1010",email:"sarah.m@email.com",   address:"4821 Sunridge Blvd",   city:"Phoenix",      zip:"85001",utilityBill:310,roofAge:8, roofType:"Comp Shingle",shade:"Low",  creditScore:"Good",    stage:"installed",   setterId:1,notes:"Referral expected",  source:"door_knock",apptDate:"2026-02-10",apptTime:"2:00 PM",closeDate:"2026-02-12",installDate:"2026-03-01",kw:8.4, salePrice:38200,setterCommission:9550, closerCommission:28650,financing:"loan", lender:"GreenSky",adders:["Battery","EV Charger"],activity:[{type:"created",text:"Lead created",time:"Feb 1, 2026",by:"System"}]}),
  mkLead({id:"L002",firstName:"Robert", lastName:"Vega",      phone:"(480)555-0234",email:"rvega@gmail.com",      address:"912 Desert Rose Ln",   city:"Scottsdale",   zip:"85251",utilityBill:340,roofAge:3, roofType:"Tile",        shade:"None", creditScore:"Excellent",stage:"installed",   setterId:4,notes:"HOA came through",   source:"referral",  apptDate:"2026-02-22",apptTime:"10:00 AM",closeDate:"2026-02-24",installDate:"2026-03-05",kw:11.2,salePrice:51500,setterCommission:12875,closerCommission:38625,financing:"loan", lender:"Sunlight",adders:["Battery","EV Charger"],activity:[{type:"created",text:"Lead created",time:"Feb 5, 2026",by:"System"}],hoa:true}),
  mkLead({id:"L003",firstName:"Ashley", lastName:"Turner",    phone:"(623)555-0789",email:"ashley.t@email.com",   address:"7712 Palm Crest Dr",   city:"Peoria",       zip:"85345",utilityBill:320,roofAge:4, roofType:"Tile",        shade:"None", creditScore:"Excellent",stage:"install_sched",setterId:1,notes:"Install Mar 20",      source:"referral",  apptDate:"2026-03-10",apptTime:"1:00 PM",closeDate:"2026-03-10",installDate:"2026-03-20",kw:9.8, salePrice:45000,setterCommission:11250,closerCommission:33750,financing:"loan", lender:"GreenSky",adders:["Battery"],activity:[{type:"created",text:"Lead created",time:"Mar 1, 2026",by:"System"}]}),
  mkLead({id:"L004",firstName:"James",  lastName:"Park",      phone:"(520)555-0445",email:"jpark@yahoo.com",      address:"550 Cactus Wren Way",  city:"Gilbert",      zip:"85234",utilityBill:410,roofAge:5, roofType:"Tile",        shade:"None", creditScore:"Excellent",stage:"engineering",  setterId:3,notes:"Fast close",          source:"canvass",   apptDate:"2026-02-20",apptTime:"3:00 PM",closeDate:"2026-02-26",kw:14.4,salePrice:66000,setterCommission:16500,closerCommission:49500,financing:"cash",lender:"",adders:["Battery","EV Charger","Roof"],activity:[{type:"created",text:"Lead created",time:"Feb 8, 2026",by:"System"}]}),
  mkLead({id:"L005",firstName:"Greg",   lastName:"Hollis",    phone:"(480)555-1620",email:"ghollis@email.com",    address:"331 W Glendale Ave",   city:"Phoenix",      zip:"85021",utilityBill:295,roofAge:6, roofType:"Tile",        shade:"None", creditScore:"Good",    stage:"sold",        setterId:1,notes:"Quick close",         source:"referral",  apptDate:"2026-03-14",apptTime:"11:00 AM",closeDate:"2026-03-15",kw:8.8, salePrice:40400,setterCommission:10100,closerCommission:30300,financing:"loan", lender:"Sunlight",adders:["EV Charger"],activity:[{type:"created",text:"Lead created",time:"Mar 10, 2026",by:"System"},{type:"stage",text:"Marked Sold · $40,400 · 8.8kW",time:"Mar 15, 2026",by:"Admin"}]}),
  mkLead({id:"L006",firstName:"Marcus", lastName:"Webb",      phone:"(480)555-2517",email:"mwebb@hotmail.com",    address:"3320 W Greenway Rd",   city:"Phoenix",      zip:"85053",utilityBill:300,roofAge:4, roofType:"Tile",        shade:"None", creditScore:"Excellent",stage:"sold",        setterId:2,notes:"Cash deal",           source:"door_knock",apptDate:"2026-03-15",apptTime:"2:00 PM",closeDate:"2026-03-15",kw:8.5, salePrice:39000,setterCommission:11700,closerCommission:27300,financing:"cash",lender:"",adders:[],activity:[{type:"created",text:"Lead created",time:"Mar 5, 2026",by:"System"},{type:"stage",text:"Marked Sold · $39,000 · 8.5kW",time:"Mar 15, 2026",by:"Admin"}]}),
  mkLead({id:"L007",firstName:"Fiona",  lastName:"Blake",     phone:"(623)555-1923",email:"fblake@yahoo.com",    address:"19210 N 31st Ave",     city:"Phoenix",      zip:"85027",utilityBill:225,roofAge:13,roofType:"Comp Shingle",shade:"Medium",creditScore:"Good",    stage:"appt_set",    setterId:1,notes:"Loan vs lease",         source:"door_knock",apptDate:"2026-03-18",apptTime:"10:00 AM",activity:[{type:"created",text:"Lead created",time:"Mar 12, 2026",by:"System"}]}),
  mkLead({id:"L008",firstName:"Tina",   lastName:"Holt",      phone:"(480)555-2820",email:"tholt@gmail.com",     address:"1240 S Alma School Rd",city:"Mesa",         zip:"85210",utilityBill:290,roofAge:6, roofType:"Comp Shingle",shade:"Low",  creditScore:"Good",    stage:"appt_set",    setterId:2,notes:"",                     source:"web_lead",  apptDate:"2026-03-19",apptTime:"3:00 PM",tags:["warm"],activity:[{type:"created",text:"Lead created",time:"Mar 13, 2026",by:"System"}]}),
  mkLead({id:"L009",firstName:"Marcus", lastName:"Rivera Jr.",phone:"(602)555-2024",email:"mjr@email.com",       address:"5801 W Camelback Rd",  city:"Phoenix",      zip:"85031",utilityBill:360,roofAge:4, roofType:"Tile",        shade:"None", creditScore:"Excellent",stage:"appt_set",    setterId:1,notes:"Referral from Sarah M.",source:"referral",  apptDate:"2026-03-20",apptTime:"1:00 PM",tags:["hot","referral"],activity:[{type:"created",text:"Lead created",time:"Mar 13, 2026",by:"System"}]}),
  mkLead({id:"L010",firstName:"Derek",  lastName:"Yuen",      phone:"(480)555-1822",email:"dyuen@hotmail.com",   address:"2440 E Thomas Rd",     city:"Phoenix",      zip:"85016",utilityBill:340,roofAge:5, roofType:"Tile",        shade:"None", creditScore:"Good",    stage:"follow_up",   setterId:1,notes:"",                     source:"referral",  apptDate:"2026-03-10",followUpDate:"2026-03-16",tags:["warm"],activity:[{type:"stage",text:"No Show → Follow Up",time:"Mar 10, 2026",by:"Admin"},{type:"created",text:"Lead created",time:"Mar 5, 2026",by:"System"}]}),
  mkLead({id:"L011",firstName:"Lucia",  lastName:"Vargas",    phone:"(623)555-2618",email:"lvargas@email.com",   address:"14202 N 43rd Ave",     city:"Glendale",     zip:"85306",utilityBill:325,roofAge:3, roofType:"Tile",        shade:"None", creditScore:"Good",    stage:"follow_up",   setterId:2,notes:"Excellent roof",         source:"door_knock",apptDate:"2026-03-08",followUpDate:"2026-03-14",hoa:true,activity:[{type:"stage",text:"No Show → Follow Up",time:"Mar 8, 2026",by:"Admin"},{type:"created",text:"Lead created",time:"Mar 1, 2026",by:"System"}]}),
  mkLead({id:"L012",firstName:"Elena",  lastName:"Vasquez",   phone:"(480)555-2125",email:"evasquez@gmail.com",  address:"1050 N Dobson Rd",     city:"Mesa",         zip:"85201",utilityBill:280,roofAge:8, roofType:"Comp Shingle",shade:"Low",  creditScore:"Good",    stage:"appt_set",    setterId:1,notes:"",                     source:"canvass",   apptDate:"2026-03-22",apptTime:"2:00 PM",activity:[{type:"created",text:"Lead created",time:"Mar 14, 2026",by:"System"}]}),
];

const CRM_STAGES = [
  { key:"appt_set",      label:"Appt Set",         color:"#c9922a", pipeline:true  },
  { key:"no_show",       label:"No Show",           color:"#c05060", pipeline:false },
  { key:"follow_up",     label:"Follow Up",         color:"#5a85c8", pipeline:false },
  { key:"sold",          label:"Sold",              color:"#06d6f0", pipeline:true  },
  { key:"site_survey",   label:"Site Survey",       color:"#c9922a", pipeline:true  },
  { key:"engineering",   label:"Engineering",       color:"#c9922a", pipeline:true  },
  { key:"install_sched", label:"Install Scheduled", color:"#bf5af2", pipeline:true  },
  { key:"installed",     label:"Installed",         color:"#30d158", pipeline:true  },
  { key:"pto",           label:"PTO",               color:"#ffd60a", pipeline:true  },
  { key:"cancelled",     label:"Cancelled",         color:"#ff453a", pipeline:false },
  { key:"dq",            label:"Disqualified",      color:"#48484a", pipeline:false },
];

const DIALER_DISPOSITIONS = [
  { key:"appointment",   label:"Appointment",    color:"#3d9e6a", hot:true,  icon:"📅", needsForm:true  },
  { key:"callback",      label:"Callback",       color:"#c9922a", hot:false, icon:"🔁", needsForm:true  },
  { key:"not_interested",label:"Not Interested", color:"#c05060", hot:false, icon:"✗",  needsForm:false },
  { key:"not_owner",     label:"Not Owner",      color:"#727272", hot:false, icon:"🚫", needsForm:false },
  { key:"spanish",       label:"Spanish",        color:"#5a85c8", hot:false, icon:"🌐", needsForm:false },
  { key:"hung_up",       label:"Hung Up",        color:"#c05060", hot:false, icon:"📵", needsForm:false },
  { key:"wrong_number",  label:"Wrong Number",   color:"#727272", hot:false, icon:"#",  needsForm:false },
  { key:"wrong_address", label:"Wrong Address",  color:"#727272", hot:false, icon:"📍", needsForm:false },
  { key:"has_solar",     label:"Has Solar",      color:"#c05060", hot:false, icon:"☀",  needsForm:false },
];
// Which dispositions permanently remove the lead (not just for this session)
const FINAL_DISPOSITIONS = new Set(["appointment","not_interested","not_owner","wrong_number","wrong_address","has_solar"]);
// Which need lead removed from shared queue temporarily (callback re-enters later)
const TEMP_REMOVE_DISPOSITIONS = new Set(["callback","hung_up","spanish"]);

const LEAD_SOURCES = ["door_knock","canvass","referral","web_lead","facebook","google","direct_mail","event","cold_call"];
const SOLAR_ADDERS = ["Battery","EV Charger","Roof","MPU","Generator","Smart Panel","Ground Mount"];

const DIALER_QUEUE_INIT = [
  { id:"Q001", name:"Tom Bradley",   phone:"(602)555-1101", address:"1234 N 7th St, Phoenix AZ",        billEst:290, source:"web_lead",   attempts:0, status:"queued" },
  { id:"Q002", name:"Karen White",   phone:"(480)555-1202", address:"567 E Camelback, Scottsdale AZ",   billEst:340, source:"door_knock", attempts:1, status:"queued" },
  { id:"Q003", name:"Mike Johnson",  phone:"(623)555-1303", address:"890 W Bell Rd, Glendale AZ",       billEst:210, source:"facebook",   attempts:0, status:"queued" },
  { id:"Q004", name:"Susan Davis",   phone:"(520)555-1404", address:"234 S Rural Rd, Tempe AZ",         billEst:375, source:"referral",   attempts:2, status:"queued" },
  { id:"Q005", name:"Paul Martinez", phone:"(602)555-1505", address:"678 N 32nd St, Phoenix AZ",        billEst:255, source:"canvass",    attempts:0, status:"queued" },
  { id:"Q006", name:"Lisa Anderson", phone:"(480)555-1606", address:"321 E Indian School, Phoenix AZ",  billEst:420, source:"web_lead",   attempts:1, status:"queued" },
  { id:"Q007", name:"James Wilson",  phone:"(623)555-1707", address:"987 W Thomas Rd, Phoenix AZ",      billEst:180, source:"door_knock", attempts:0, status:"queued" },
  { id:"Q008", name:"Amy Taylor",    phone:"(602)555-1808", address:"555 E Chandler Blvd, Chandler AZ", billEst:310, source:"google",     attempts:3, status:"queued" },
];

const stageInfo   = key => CRM_STAGES.find(s=>s.key===key) || CRM_STAGES[0];
const fmtDate2    = d => d ? new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "—";
const srcLabel    = s => ({door_knock:"Door Knock",canvass:"Canvass",referral:"Referral",web_lead:"Web Lead",facebook:"Facebook",google:"Google",direct_mail:"Direct Mail",event:"Event",cold_call:"Cold Call"}[s]||s);
const fmtTimer    = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const fmtApptTime = t => {
  if (!t) return "";
  const [h,m] = t.split(":").map(Number);
  if (isNaN(h)) return t; // legacy free-text fallback
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m||0).padStart(2,"0")} ${period} MST`;
};

/* ── Campaign CSV parser ── */
const parseCampaignCSV = (text, campaignId) => {
  const lines = text.trim().split('\n');
  if (!lines.length) return [];
  const hdr = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''));
  return lines.slice(1).filter(l => l.trim()).map((row, i) => {
    const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g,''));
    const obj  = {};
    hdr.forEach((h, j) => { obj[h] = cols[j] || ''; });
    return mkDialerLead({
      id: `${campaignId}L${Date.now()}_${i}`,
      name:    obj.name || `${obj.first_name||''} ${obj.last_name||''}`.trim() || 'Unknown',
      phone:   obj.phone || obj.phone_number || '',
      address: obj.address || `${obj.street||''} ${obj.city||''} ${obj.state||''}`.trim(),
      billEst: Number(obj.bill || obj.utility_bill || obj.monthly_bill || 0),
      source:  obj.source || 'csv_upload',
    });
  }).filter(l => l.phone);
};

/* ══════════════════════════════════════════════════════════════════
   CAMPAIGNS TAB — admin only
══════════════════════════════════════════════════════════════════ */
const CAMPAIGN_STATUSES = [
  { key:"draft",     label:"Draft",     color:"#98989f" },
  { key:"active",    label:"Active",    color:"#30d158" },
  { key:"paused",    label:"Paused",    color:"#ff9f0a" },
  { key:"completed", label:"Completed", color:"#0a84ff" },
];

function CampaignStatusPill({ status }) {
  const s = CAMPAIGN_STATUSES.find(x => x.key===status) || CAMPAIGN_STATUSES[0];
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5,
      padding:"3px 10px", borderRadius:20,
      fontSize:11, fontWeight:700, letterSpacing:"0.04em",
      background:`${s.color}15`, color:s.color,
      border:`1px solid ${s.color}30`,
    }}>
      <span style={{width:5,height:5,borderRadius:"50%",background:s.color,display:"inline-block"}}/>
      {s.label}
    </span>
  );
}

function CampaignFormModal({ initial, reps, onSave, onClose }) {
  const blank = { name:"", status:"draft", assignedReps:[], script:"", leads:[] };
  const [f, setF]       = useState(initial || blank);
  const [csvErr, setCsvErr] = useState("");
  const [csvFile, setCsvFile] = useState(null);
  const id = f.id || `C${Date.now()}`;

  const toggleRep = rid => setF(p => ({
    ...p,
    assignedReps: p.assignedReps.includes(rid)
      ? p.assignedReps.filter(x => x !== rid)
      : [...p.assignedReps, rid],
  }));

  const handleCSVFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = parseCampaignCSV(ev.target.result, id);
        if (!parsed.length) { setCsvErr("No valid rows found. Check CSV has a 'phone' column."); return; }
        setF(p => ({ ...p, leads: [...p.leads, ...parsed] }));
        setCsvErr(`✓ Loaded ${parsed.length} leads`);
      } catch(err) { setCsvErr("Parse error: " + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const submit = () => {
    if (!f.name.trim()) return;
    onSave({ ...f, id, createdAt: f.createdAt || new Date().toISOString().slice(0,10), stats: f.stats || {calls:0,connects:0,appts:0,callbacks:0} });
    onClose();
  };

  return (
    <div className="moverlay" onClick={onClose}>
      <div className="mpanel" onClick={e => e.stopPropagation()} style={{maxWidth:520}}>
        <div style={{fontWeight:700,fontSize:17,color:T.t1,letterSpacing:"-0.02em",marginBottom:4}}>
          {initial ? "Edit Campaign" : "New Campaign"}
        </div>
        <div style={{fontSize:12.5,color:T.t3,marginBottom:22}}>Configure your campaign, assign reps, and upload leads.</div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Name */}
          <div>
            <div className="caps" style={{marginBottom:6}}>Campaign Name</div>
            <input className="hinput" value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="Phoenix West — Web Leads" autoFocus/>
          </div>

          {/* Status */}
          <div>
            <div className="caps" style={{marginBottom:8}}>Status</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {CAMPAIGN_STATUSES.map(s => (
                <button key={s.key} onClick={()=>setF(p=>({...p,status:s.key}))} style={{
                  padding:"6px 14px",borderRadius:20,border:`1px solid ${f.status===s.key?s.color+"60":"rgba(255,255,255,0.1)"}`,
                  background:f.status===s.key?`${s.color}18`:"transparent",
                  color:f.status===s.key?s.color:T.t3,
                  fontFamily:"'Inter',system-ui,sans-serif",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s",
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          {/* Assign reps */}
          <div>
            <div className="caps" style={{marginBottom:8}}>Assigned Reps</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:180,overflowY:"auto"}}>
              {reps.map(r => {
                const on = f.assignedReps.includes(r.id);
                return (
                  <button key={r.id} onClick={()=>toggleRep(r.id)} style={{
                    display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderRadius:12,
                    border:`1px solid ${on?"rgba(6,214,240,0.35)":"rgba(255,255,255,0.08)"}`,
                    background:on?"rgba(6,214,240,0.08)":"rgba(255,255,255,0.03)",
                    cursor:"pointer",textAlign:"left",fontFamily:"'Inter',system-ui,sans-serif",
                    transition:"all 0.15s",
                  }}>
                    <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${on?T.cyan:"rgba(255,255,255,0.2)"}`,background:on?T.cyan:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                      {on && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#021014" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{fontSize:13,fontWeight:on?600:400,color:on?T.t1:T.t2}}>{r.name}</span>
                  </button>
                );
              })}
            </div>
            {f.assignedReps.length===0 && <div style={{fontSize:11,color:T.t3,marginTop:5}}>No reps assigned — they won't see this campaign.</div>}
          </div>

          {/* Script */}
          <div>
            <div className="caps" style={{marginBottom:6}}>Call Script</div>
            <textarea className="hinput" rows={3} value={f.script}
              onChange={e=>setF(p=>({...p,script:e.target.value}))}
              placeholder="Hi {firstName}, this is {rep} with Apex Solar…"
              style={{resize:"vertical",minHeight:70}}/>
            <div style={{fontSize:10.5,color:T.t3,marginTop:4}}>Variables: {"{firstName}"}, {"{rep}"}, {"{city}"}, {"{bill}"}</div>
          </div>

          {/* CSV Upload */}
          <div>
            <div className="caps" style={{marginBottom:8}}>Lead List — CSV Upload</div>
            <label style={{
              display:"flex",alignItems:"center",gap:12,padding:"14px 18px",
              background:"rgba(255,255,255,0.03)",border:`2px dashed ${f.leads.length?"rgba(6,214,240,0.3)":"rgba(255,255,255,0.12)"}`,
              borderRadius:12,cursor:"pointer",transition:"all 0.18s",
            }}>
              <div style={{fontSize:24,opacity:0.5}}>📥</div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:T.t1}}>
                  {csvFile ? csvFile : "Drop CSV or click to browse"}
                </div>
                <div style={{fontSize:11,color:T.t3,marginTop:2}}>
                  {f.leads.length ? `${f.leads.filter(l=>l.status==="queued").length} queued · ${f.leads.length} total` : "Required columns: name, phone. Optional: address, bill, source"}
                </div>
              </div>
              <input type="file" accept=".csv,.txt" onChange={handleCSVFile} style={{display:"none"}}/>
            </label>
              <div style={{marginTop:8,padding:"8px 12px",borderRadius:8,fontSize:12,fontWeight:600,
                background:csvErr.startsWith("✓")?T.greenDm:T.redDm,
                border:`1px solid ${csvErr.startsWith("✓")?"rgba(48,209,88,0.3)":"rgba(255,69,58,0.3)"}`,
                color:csvErr.startsWith("✓")?T.green:T.red,
              }}>{csvErr}</div>
            )}
          </div>
        </div>

        <div style={{display:"flex",gap:10,marginTop:24}}>
          <button className="btn-cyan" style={{flex:1}} onClick={submit}>
            {initial ? "Save Changes" : "Create Campaign"}
          </button>
          <button className="btn-out" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function CampaignsTab({ campaigns, setCampaigns, reps, isMobile }) {
  const [modal, setModal]   = useState(null);   // null | "add" | "edit"
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null); // campaign id for detail view

  const addCampaign    = c  => setCampaigns(p => [...p, c]);
  const updateCampaign = c  => setCampaigns(p => p.map(x => x.id===c.id ? c : x));
  const deleteCampaign = id => { setCampaigns(p => p.filter(x => x.id!==id)); if(selected===id) setSelected(null); };

  const sel = campaigns.find(c => c.id===selected);

  const statColor = s => s==="active"?T.green:s==="paused"?T.amber:s==="completed"?T.blue:T.t3;

  return (
    <div className="afu" style={{opacity:0}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{fontWeight:700,fontSize:18,color:T.t1,letterSpacing:"-0.02em"}}>Campaigns</div>
          <div style={{fontSize:13,color:T.t3,marginTop:2}}>{campaigns.length} total · {campaigns.filter(c=>c.status==="active").length} active</div>
        </div>
        <button className="btn-cyan" style={{width:"auto",padding:"9px 20px",fontSize:13}} onClick={()=>setModal("add")}>
          + New Campaign
        </button>
      </div>

      {/* Summary row */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:10,marginBottom:24}}>
        {[
          {label:"Total Leads",   val:campaigns.reduce((s,c)=>s+c.leads.length,0),                                        color:T.t1},
          {label:"Queued",        val:campaigns.reduce((s,c)=>s+c.leads.filter(l=>l.status==="queued").length,0),          color:T.amber},
          {label:"Appointments",  val:campaigns.reduce((s,c)=>s+c.stats.appts,0),                                         color:T.green},
          {label:"Connect Rate",  val:`${Math.round((campaigns.reduce((s,c)=>s+c.stats.connects,0)/Math.max(campaigns.reduce((s,c)=>s+c.stats.calls,0),1))*100)}%`, color:T.cyan},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 18px",position:"relative",overflow:"hidden",backdropFilter:"blur(24px)",boxShadow:"0 1px 0 rgba(255,255,255,0.07) inset"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${color}50,transparent)`}}/>
            <div className="caps" style={{marginBottom:6,fontSize:9}}>{label}</div>
            <div className="mono" style={{fontSize:22,fontWeight:700,color,lineHeight:1}}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:sel&&!isMobile?"1fr 360px":"1fr",gap:14,alignItems:"start"}}>
        {/* Campaign list */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {campaigns.length===0 && (
            <div style={{textAlign:"center",padding:"60px 0",color:T.t3}}>
              <div style={{fontSize:36,marginBottom:12,opacity:0.3}}>📋</div>
              <div style={{fontWeight:600,fontSize:14,color:T.t2,marginBottom:4}}>No campaigns yet</div>
              <div style={{fontSize:12}}>Create your first campaign to start dialing</div>
            </div>
          )}
          {campaigns.map(c => {
            const queued    = c.leads.filter(l=>l.status==="queued"&&!l.lockedBy).length;
            const locked    = c.leads.filter(l=>l.lockedBy).length;
            const done      = c.leads.filter(l=>l.status==="done").length;
            const callbacks = c.leads.filter(l=>l.status==="callback").length;
            const pct       = c.leads.length ? Math.round((done/c.leads.length)*100) : 0;
            const assignedRepNames = reps.filter(r=>c.assignedReps.includes(r.id)).map(r=>r.name.split(" ")[0]);
            const isSel = selected===c.id;
            return (
              <div key={c.id} onClick={()=>setSelected(isSel?null:c.id)} style={{
                background:isSel?"rgba(6,214,240,0.06)":"rgba(255,255,255,0.04)",
                border:`1px solid ${isSel?"rgba(6,214,240,0.3)":"rgba(255,255,255,0.08)"}`,
                borderRadius:16,padding:"18px 20px",cursor:"pointer",transition:"all 0.2s",
                backdropFilter:"blur(24px)",position:"relative",overflow:"hidden",
                boxShadow:isSel?"0 1px 0 rgba(255,255,255,0.09) inset,0 0 24px rgba(6,214,240,0.06)":"0 1px 0 rgba(255,255,255,0.06) inset",
              }}>
                {isSel && <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(6,214,240,0.5),transparent)"}}/>}
                <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                      <span style={{fontWeight:700,fontSize:15,color:T.t1,letterSpacing:"-0.02em"}}>{c.name}</span>
                      <CampaignStatusPill status={c.status}/>
                    </div>
                    <div style={{display:"flex",gap:16,fontSize:12,color:T.t3,marginBottom:12,flexWrap:"wrap"}}>
                      <span>{c.leads.length} leads</span>
                      <span style={{color:T.amber}}>{queued} queued</span>
                      {locked>0 && <span style={{color:T.cyan}}>⚡ {locked} live</span>}
                      {callbacks>0 && <span>{callbacks} callbacks</span>}
                      <span style={{color:T.green}}>{done} done</span>
                    </div>
                    {/* Progress bar */}
                    <div style={{height:3,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden",marginBottom:10}}>
                      <div style={{height:"100%",width:`${pct}%`,borderRadius:2,background:`linear-gradient(90deg,${statColor(c.status)},${statColor(c.status)}aa)`,transition:"width 0.8s cubic-bezier(0.22,1,0.36,1)"}}/>
                    </div>
                    {/* Assigned reps */}
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{display:"flex",gap:4}}>
                        {reps.filter(r=>c.assignedReps.includes(r.id)).slice(0,5).map(r=>(
                          <Avatar key={r.id} name={r.name} size={22}/>
                        ))}
                        {c.assignedReps.length>5 && <div style={{width:22,height:22,borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:T.t3,fontWeight:700}}>+{c.assignedReps.length-5}</div>}
                      </div>
                      <span style={{fontSize:11,color:T.t3}}>
                        {assignedRepNames.length===0?"No reps assigned":assignedRepNames.slice(0,3).join(", ")+(assignedRepNames.length>3?` +${assignedRepNames.length-3}`:"")}</span>
                    </div>
                  </div>
                  {/* Stats */}
                  <div style={{display:"flex",gap:8,flexShrink:0}}>
                    {[
                      {label:"Calls", val:c.stats.calls, color:T.t1},
                      {label:"Appts", val:c.stats.appts, color:T.green},
                    ].map(({label,val,color})=>(
                      <div key={label} style={{textAlign:"center",padding:"8px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,minWidth:54}}>
                        <div className="caps" style={{fontSize:8,marginBottom:3}}>{label}</div>
                        <div className="mono" style={{fontSize:15,fontWeight:700,color,lineHeight:1}}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {sel && (
          <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:18,padding:"20px",backdropFilter:"blur(32px)",boxShadow:"0 1px 0 rgba(255,255,255,0.08) inset",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)"}}/>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,gap:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:T.t1,letterSpacing:"-0.02em",marginBottom:4}}>{sel.name}</div>
                <CampaignStatusPill status={sel.status}/>
              </div>
              <div style={{display:"flex",gap:6}}>
                <button className="btn-sm" onClick={e=>{e.stopPropagation();setEditing(sel);setModal("edit");}}>Edit</button>
                <button className="btn-del" onClick={e=>{e.stopPropagation();if(window.confirm(`Delete "${sel.name}"?`))deleteCampaign(sel.id);}}>✕</button>
              </div>
            </div>

            {/* Status controls */}
            <div style={{display:"flex",gap:5,marginBottom:16,flexWrap:"wrap"}}>
              {CAMPAIGN_STATUSES.filter(s=>s.key!==sel.status).map(s=>(
                <button key={s.key} onClick={e=>{e.stopPropagation();updateCampaign({...sel,status:s.key});}} style={{
                  padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",
                  border:`1px solid ${s.color}40`,background:`${s.color}12`,color:s.color,
                  fontFamily:"'Inter',system-ui,sans-serif",transition:"all 0.15s",
                }}>→ {s.label}</button>
              ))}
            </div>

            {/* Lead stats */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {[
                {label:"Total Leads",  val:sel.leads.length,                                    color:T.t1},
                {label:"Queued",       val:sel.leads.filter(l=>l.status==="queued"&&!l.lockedBy).length, color:T.amber},
                {label:"In Progress",  val:sel.leads.filter(l=>l.lockedBy).length,               color:T.cyan},
                {label:"Callbacks",    val:sel.leads.filter(l=>l.status==="callback").length,    color:T.amber},
                {label:"Appointments", val:sel.stats.appts,                                      color:T.green},
                {label:"Completed",    val:sel.leads.filter(l=>l.status==="done").length,        color:T.green},
              ].map(({label,val,color})=>(
                <div key={label} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"10px 12px"}}>
                  <div className="caps" style={{fontSize:8,marginBottom:4}}>{label}</div>
                  <div className="mono" style={{fontSize:16,fontWeight:700,color,lineHeight:1}}>{val}</div>
                </div>
              ))}
            </div>

            {/* Assigned reps list */}
            <div style={{marginBottom:16}}>
              <div className="caps" style={{marginBottom:10,fontSize:9}}>Assigned Reps</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {reps.filter(r=>sel.assignedReps.includes(r.id)).map(r=>{
                  const myLeads   = sel.leads.filter(l=>l.assignedTo===r.id||l.callbackRepId===r.id);
                  const myAppts   = sel.leads.filter(l=>l.disposition==="appointment"&&l.assignedTo===r.id).length;
                  return (
                    <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10}}>
                      <Avatar name={r.name} size={28}/>
                      <span style={{flex:1,fontSize:12.5,fontWeight:500,color:T.t1}}>{r.name}</span>
                      <span style={{fontSize:11,color:T.green,fontWeight:700}}>{myAppts} appts</span>
                    </div>
                  );
                })}
                {sel.assignedReps.length===0 && <div style={{fontSize:12,color:T.t3}}>No reps assigned yet.</div>}
              </div>
            </div>

            {/* Lead list preview */}
            <div>
              <div className="caps" style={{marginBottom:10,fontSize:9}}>Recent Leads</div>
              <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:200,overflowY:"auto"}}>
                {sel.leads.slice(0,20).map(l=>{
                  const dispInfo = DIALER_DISPOSITIONS.find(d=>d.key===l.disposition);
                  const statusColor = l.lockedBy?T.amber:l.status==="done"?T.green:l.status==="callback"?T.amber:T.t3;
                  return (
                    <div key={l.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)",borderRadius:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:T.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.name}</div>
                        <div style={{fontSize:10.5,color:T.t3}}>{l.phone}</div>
                      </div>
                      <div style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:`${statusColor}15`,color:statusColor,border:`1px solid ${statusColor}30`,whiteSpace:"nowrap",flexShrink:0}}>
                        {l.lockedBy?"Live":l.status==="done"?(dispInfo?.label||"Done"):l.status==="callback"?"Callback":"Queued"}
                      </div>
                    </div>
                  );
                })}
                {sel.leads.length>20 && <div style={{fontSize:11,color:T.t3,textAlign:"center",padding:"6px 0"}}>+{sel.leads.length-20} more</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {modal==="add"  && <CampaignFormModal reps={reps} onSave={c=>{addCampaign(c);setModal(null);}} onClose={()=>setModal(null)}/>}
      {modal==="edit" && editing && <CampaignFormModal initial={editing} reps={reps} onSave={c=>{updateCampaign(c);setModal(null);setEditing(null);}} onClose={()=>{setModal(null);setEditing(null);}}/>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CAMPAIGN SELECTOR — shown to reps in the dialer to pick campaign
══════════════════════════════════════════════════════════════════ */
function CampaignSelector({ campaigns, repId, activeCampaignId, onSelect }) {
  const available = campaigns.filter(c => c.status==="active" && c.assignedReps.includes(repId));
  if (available.length===0) return (
    <div style={{textAlign:"center",padding:"48px 20px",color:T.t3}}>
      <div style={{fontSize:36,marginBottom:12,opacity:0.3}}>📋</div>
      <div style={{fontWeight:600,fontSize:14,color:T.t2,marginBottom:4}}>No active campaigns</div>
      <div style={{fontSize:12}}>Ask your admin to assign you to an active campaign.</div>
    </div>
  );
  return (
    <div>
      <div style={{fontWeight:700,fontSize:15,color:T.t1,letterSpacing:"-0.02em",marginBottom:4}}>Select Campaign</div>
      <div style={{fontSize:12.5,color:T.t3,marginBottom:20}}>Choose which campaign queue to dial from.</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {available.map(c=>{
          const queued = c.leads.filter(l=>l.status==="queued"&&!l.lockedBy).length;
          const isSel  = activeCampaignId===c.id;
          return (
            <button key={c.id} onClick={()=>onSelect(c.id)} style={{
              display:"flex",alignItems:"center",gap:16,padding:"16px 20px",borderRadius:16,
              border:`1px solid ${isSel?"rgba(6,214,240,0.4)":"rgba(255,255,255,0.09)"}`,
              background:isSel?"rgba(6,214,240,0.08)":"rgba(255,255,255,0.04)",
              cursor:"pointer",textAlign:"left",fontFamily:"'Inter',system-ui,sans-serif",
              backdropFilter:"blur(20px)",transition:"all 0.2s",
              boxShadow:isSel?"0 1px 0 rgba(255,255,255,0.1) inset,0 0 20px rgba(6,214,240,0.08)":"0 1px 0 rgba(255,255,255,0.06) inset",
            }}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,color:T.t1,marginBottom:4,letterSpacing:"-0.01em"}}>{c.name}</div>
                <div style={{display:"flex",gap:12,fontSize:12,color:T.t3}}>
                  <span style={{color:T.amber,fontWeight:600}}>{queued} leads queued</span>
                  <span>{c.stats.appts} appts set</span>
                  <span>{c.stats.calls} calls made</span>
                </div>
              </div>
              {isSel
                ? <div style={{width:22,height:22,borderRadius:"50%",background:T.cyan,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5l3.5 3.5 5.5-7" stroke="#021014" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                : <div style={{width:22,height:22,borderRadius:"50%",border:"1.5px solid rgba(255,255,255,0.15)",flexShrink:0}}/>
              }
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CRM KANBAN — drag-and-drop pipeline board
══════════════════════════════════════════════════════════════════ */
function CRMKanban({ leads, setLeads, reps, onClickLead, onStageChange, isMobile }) {
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const PIPELINE = CRM_STAGES.filter(s => s.pipeline);
  const OUTCOMES = CRM_STAGES.filter(s => !s.pipeline);

  const handleDrop = (e, stageKey) => {
    e.preventDefault();
    if (!dragId) return;
    onStageChange(dragId, stageKey);
    setDragId(null); setOverStage(null);
  };

  return (
    <div style={{overflowX:"auto", paddingBottom:8}}>
      {/* ── Main pipeline columns ── */}
      <div style={{display:"flex", gap:10, minWidth:isMobile?1000:"auto"}}>
        {PIPELINE.map(stage => {
          const sl = leads.filter(l => l.stage === stage.key);
          const isOver = overStage === stage.key;
          return (
            <div key={stage.key} style={{flex:1, minWidth:148, maxWidth:200}}
              onDragOver={e=>{e.preventDefault(); setOverStage(stage.key);}}
              onDragLeave={()=>setOverStage(null)}
              onDrop={e=>handleDrop(e, stage.key)}>
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                marginBottom:8, padding:"7px 11px",
                background:isOver?`rgba(6,214,240,0.08)`:"rgba(255,255,255,0.04)",
                border:`1px solid ${isOver?"rgba(6,214,240,0.4)":"rgba(255,255,255,0.08)"}`,
                borderRadius:9, transition:"all 0.15s",
              }}>
                <div style={{display:"flex", alignItems:"center", gap:6}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:stage.color,boxShadow:`0 0 6px ${stage.color}88`}}/>
                  <span style={{fontSize:10,fontWeight:700,color:isOver?T.cyan:T.t2,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{stage.label}</span>
                </div>
                <span className="mono" style={{fontSize:11,color:T.t3,fontWeight:600}}>{sl.length}</span>
              </div>
              <div style={{
                display:"flex", flexDirection:"column", gap:6, minHeight:dragId?60:0,
                borderRadius:10,
                border:isOver&&dragId?`2px dashed rgba(6,214,240,0.5)`:"2px dashed transparent",
                padding:isOver&&dragId?4:0,
                background:isOver&&dragId?"rgba(6,214,240,0.03)":"transparent",
                transition:"all 0.15s",
              }}>
                {sl.map(lead => {
                  const setter = reps.find(r => r.id === lead.setterId);
                  const isDraggingThis = dragId === lead.id;
                  return (
                    <div key={lead.id}
                      draggable
                      onDragStart={e=>{setDragId(lead.id); e.dataTransfer.effectAllowed="move"; setTimeout(()=>{},0);}}
                      onDragEnd={()=>{setDragId(null); setOverStage(null);}}
                      onClick={()=>{if(!dragId) onClickLead(lead);}}
                      style={{
                        background:isDraggingThis?"rgba(6,214,240,0.07)":"rgba(255,255,255,0.035)",
                        border:`1px solid ${isDraggingThis?"rgba(6,214,240,0.5)":"rgba(255,255,255,0.08)"}`,
                        borderRadius:10, padding:"10px 12px", cursor:"grab",
                        transition:"all 0.15s", backdropFilter:"blur(16px)",
                        opacity:isDraggingThis?0.7:1, userSelect:"none",
                        position:"relative",
                      }}
                      onMouseEnter={e=>{if(!dragId){e.currentTarget.style.borderColor="rgba(255,255,255,0.16)";e.currentTarget.style.transform="translateY(-1px)";}}}
                      onMouseLeave={e=>{if(!dragId){e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.transform="none";}}}
                    >
                      <div style={{fontWeight:700,fontSize:12.5,color:T.t1,marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lead.firstName} {lead.lastName}</div>
                      <div style={{fontSize:10,color:T.t3,marginBottom:6,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lead.address||lead.city}</div>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:4}}>
                        <span style={{fontSize:11,color:T.amber,fontWeight:600}}>${lead.utilityBill}/mo</span>
                        {lead.kw>0 && <span style={{fontSize:10,color:T.cyan,fontWeight:600}}>{lead.kw}kW</span>}
                      </div>
                      {lead.apptDate && (
                        <div style={{fontSize:10,color:T.t3,marginTop:4}}>
                          📅 {new Date(lead.apptDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                          {lead.apptTime && ` @ ${fmtApptTime(lead.apptTime)}`}
                        </div>
                      )}
                      {setter && (
                        <div style={{fontSize:10,color:T.t3,marginTop:2}}>Set by {setter.name.split(" ")[0]}</div>
                      )}
                    </div>
                  );
                })}
                {sl.length===0 && (
                  <div style={{padding:"20px 8px",textAlign:"center",color:isOver?T.cyan:T.t3,fontSize:11,border:`1px dashed ${isOver?"rgba(6,214,240,0.4)":"rgba(255,255,255,0.04)"}`,borderRadius:10,transition:"all 0.15s"}}>
                    {isOver?"Drop here":"Empty"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Outcome columns — drag cards here to disposition them ── */}
      <div style={{marginTop:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{height:1,flex:1,background:"rgba(255,255,255,0.06)"}}/>
          <span style={{fontSize:9,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:T.t3}}>Outcomes</span>
          <div style={{height:1,flex:1,background:"rgba(255,255,255,0.06)"}}/>
        </div>
        <div style={{display:"flex",gap:10,minWidth:isMobile?600:"auto"}}>
          {OUTCOMES.map(stage => {
            const sl = leads.filter(l => l.stage === stage.key);
            const isOver = overStage === stage.key;
            return (
              <div key={stage.key} style={{flex:1,minWidth:120}}
                onDragOver={e=>{e.preventDefault(); setOverStage(stage.key);}}
                onDragLeave={()=>setOverStage(null)}
                onDrop={e=>handleDrop(e, stage.key)}>
                <div style={{
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                  marginBottom:6,padding:"6px 10px",
                  background:isOver?`rgba(6,214,240,0.08)`:`${stage.color}0a`,
                  border:`1px solid ${isOver?"rgba(6,214,240,0.4)":`${stage.color}30`}`,
                  borderRadius:8,transition:"all 0.15s",
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:stage.color}}/>
                    <span style={{fontSize:10,fontWeight:700,color:isOver?T.cyan:stage.color,letterSpacing:"0.05em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{stage.label}</span>
                  </div>
                  <span className="mono" style={{fontSize:10,color:T.t3,fontWeight:600}}>{sl.length}</span>
                </div>
                <div style={{
                  display:"flex",flexDirection:"column",gap:5,minHeight:dragId?40:0,
                  borderRadius:8,
                  border:isOver&&dragId?`2px dashed rgba(6,214,240,0.5)`:"2px dashed transparent",
                  padding:isOver&&dragId?4:0,
                  background:isOver&&dragId?"rgba(6,214,240,0.03)":"transparent",
                  transition:"all 0.15s",
                }}>
                  {sl.slice(0,5).map(lead => {
                    const setter = reps.find(r => r.id === lead.setterId);
                    return (
                      <div key={lead.id}
                        draggable
                        onDragStart={e=>{setDragId(lead.id); e.dataTransfer.effectAllowed="move";}}
                        onDragEnd={()=>{setDragId(null); setOverStage(null);}}
                        onClick={()=>{if(!dragId) onClickLead(lead);}}
                        style={{
                          background:"rgba(255,255,255,0.03)",
                          border:`1px solid ${stage.color}22`,
                          borderRadius:8,padding:"7px 10px",cursor:"grab",
                          transition:"all 0.15s",userSelect:"none",
                        }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=`${stage.color}44`}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=`${stage.color}22`}>
                        <div style={{fontWeight:600,fontSize:11.5,color:T.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lead.firstName} {lead.lastName}</div>
                        {setter&&<div style={{fontSize:10,color:T.t3,marginTop:1}}>Set by {setter.name.split(" ")[0]}</div>}
                      </div>
                    );
                  })}
                  {sl.length>5&&<div style={{fontSize:10,color:T.t3,textAlign:"center",padding:"4px 0"}}>+{sl.length-5} more</div>}
                  {sl.length===0&&(
                    <div style={{padding:"12px 8px",textAlign:"center",color:isOver?T.cyan:T.t3,fontSize:10,border:`1px dashed ${isOver?"rgba(6,214,240,0.4)":"rgba(255,255,255,0.04)"}`,borderRadius:8,transition:"all 0.15s"}}>
                      {isOver?"Drop here":"Empty"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CRM TAB — rebuilt with unified pipeline, calendar, reminders
══════════════════════════════════════════════════════════════════ */
function CRMTab({ reps, setReps, isMobile, crmLeads, setCrmLeads, allDeals, setAllDeals, user }) {
  const [view,        setView]        = useState("pipeline");
  const [activeLead,  setActiveLead]  = useState(null);
  const [filterRep,   setFilterRep]   = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [search,      setSearch]      = useState("");
  const [modal,       setModal]       = useState(false);
  const [editLead,    setEditLead]    = useState(null);
  const [soldModal,   setSoldModal]   = useState(null); // lead being marked sold
  const [noShowModal, setNoShowModal] = useState(null); // lead being marked no-show
  const [apptDisp,    setApptDisp]    = useState(null); // two-step appt disposition
  const [calWeek,     setCalWeek]     = useState(() => { const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d; });
  const [calMode,     setCalMode]     = useState("month");   // "month" | "day"
  const [calType,     setCalType]     = useState("appts");   // "appts" | "postsale"
  const [calMonth,    setCalMonth]    = useState(() => { const d=new Date(); return {year:d.getFullYear(),month:d.getMonth()}; });
  const [calDayDate,  setCalDayDate]  = useState(null); // ISO string of selected day

  const leads = crmLeads;
  const setLeads = setCrmLeads;

  // Sync a CRM lead's stage change back to allDeals for leaderboard
  const syncDealStage = (leadId, newStage, extraFields={}) => {
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      const updated = {...l, stage:newStage, ...extraFields};
      if (updated.setterId && setAllDeals) {
        setAllDeals(p => {
          const repDeals = p[updated.setterId] || [];
          const existIdx = repDeals.findIndex(d => d.dialerLeadId===leadId || d.id===leadId || d.id===Number(leadId));
          if (existIdx >= 0) {
            // Update existing deal in allDeals
            const updated2 = repDeals.map((d,i) => i===existIdx ? {...d, status:newStage, ...extraFields} : d);
            return {...p, [updated.setterId]: updated2};
          } else {
            // CRM lead not yet in allDeals — insert it now so leaderboard sees it
            const soldKeys = ["sold","site_survey","design","engineering","install_sched","install_sched","installed","pto"];
            if (soldKeys.includes(newStage)) {
              const newDeal = {
                id: leadId,
                customer: `${updated.firstName} ${updated.lastName}`,
                phone: updated.phone||"",
                email: updated.email||"",
                address: `${updated.address}, ${updated.city} ${updated.state}`,
                kw: updated.kw || extraFields.kw || 0,
                price: updated.salePrice || extraFields.salePrice || 0,
                commission: updated.setterCommission || 0,
                monthlyBill: updated.utilityBill || 0,
                lastContacted: new Date().toISOString().slice(0,10),
                apptDate: updated.apptDate||"",
                closeDate: updated.closeDate || extraFields.closeDate || new Date().toISOString().slice(0,10),
                status: newStage,
                adders: updated.adders||[],
                notes: updated.notes||"",
                source: updated.source||"crm",
                setterId: updated.setterId,
                crmLeadId: leadId,
                createdAt: updated.created||new Date().toISOString(),
                ...extraFields,
              };
              return {...p, [updated.setterId]: [newDeal, ...repDeals]};
            }
            return p;
          }
        });
      }
      return updated;
    }));
  };

  const handleStageChange = (leadId, newStage) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // appt_set leads → always go through two-step showed/no-show disposition
    // Triggered by "disposition" key or any stage change on an appt_set lead
    if (lead.stage === "appt_set" && !["appt_set","cancelled","dq"].includes(newStage)) {
      setApptDisp({lead, pendingStage: newStage});
      return;
    }
    // Direct disposition trigger
    if (newStage === "disposition") {
      setApptDisp({lead, pendingStage: null});
      return;
    }

    // Sold → prompt for kW, price, closer
    if (newStage === "sold" && lead.stage !== "sold") {
      setSoldModal({...lead, pendingStage:"sold"});
      return;
    }
    // No Show → (legacy path — now handled via apptDisp above, kept as fallback)
    if (newStage === "no_show") {
      setNoShowModal(lead);
      return;
    }
    // Cancelled → apply chargeback to both setter and closer
    if (newStage === "cancelled" && lead.stage !== "cancelled") {
      const setterRep = reps.find(r => r.id === lead.setterId);
      const closerRep = reps.find(r => r.id === lead.closerId);
      const setterCB  = lead.setterCommission || 0;
      const closerCB  = lead.closerCommission || 0;
      if ((setterRep || closerRep) && (setterCB > 0 || closerCB > 0)) {
        const names = [setterRep?.name.split(" ")[0], closerRep?.name.split(" ")[0]].filter(Boolean).join(" & ");
        if (!window.confirm(`Mark as Cancelled? This will log chargebacks:\n${setterRep?`${setterRep.name}: $${setterCB.toLocaleString()}`:""}${closerRep?`\n${closerRep.name}: $${closerCB.toLocaleString()}`:""}. Stats are NOT removed.`)) return;
        if (setterRep && setterCB > 0) setReps(prev => prev.map(r => r.id === setterRep.id ? {...r, chargebacksTotal:(r.chargebacksTotal||0)+setterCB} : r));
        if (closerRep && closerCB > 0) setReps(prev => prev.map(r => r.id === closerRep.id ? {...r, chargebacksTotal:(r.chargebacksTotal||0)+closerCB} : r));
      }
    }
    syncDealStage(leadId, newStage);
  };

  const saveLead = lead => {
    if (lead.id && leads.find(l=>l.id===lead.id)) setLeads(p=>p.map(l=>l.id===lead.id?lead:l));
    else setLeads(p=>[{...lead, id:`L${Date.now()}`, created:new Date().toISOString().slice(0,10), activity:[{type:"created",text:"Lead created",time:new Date().toLocaleString(),by:"Admin"}]}, ...p]);
    setModal(false); setEditLead(null);
  };

  const deleteLead = id => { setLeads(p=>p.filter(l=>l.id!==id)); if(activeLead?.id===id) setActiveLead(null); };

  const addActivity = (leadId, entry) => {
    setLeads(prev => prev.map(l => l.id===leadId ? {...l, activity:[entry, ...(l.activity||[])]} : l));
  };

  const setFollowUpDate = (leadId, date) => {
    setLeads(prev => prev.map(l => l.id===leadId ? {...l, followUpDate:date} : l));
  };

  const filtered = leads.filter(l => {
    if (filterRep !== "all" && l.setterId !== Number(filterRep) && l.closerId !== Number(filterRep)) return false;
    if (filterStage !== "all" && l.stage !== filterStage) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!`${l.firstName} ${l.lastName} ${l.phone} ${l.address} ${l.city}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Stats
  const soldStages = new Set(["sold","site_survey","design","engineering","install_sched","installed","pto"]);
  const totalSold    = leads.filter(l => soldStages.has(l.stage)).length;
  const totalRev     = leads.filter(l => soldStages.has(l.stage) && l.salePrice>0).reduce((s,l)=>s+l.salePrice,0);
  const totalKw      = leads.filter(l => soldStages.has(l.stage) && l.kw>0).reduce((s,l)=>s+l.kw,0);
  const pipeline     = leads.filter(l => l.stage==="appt_set").length;
  const todayStr     = new Date().toISOString().slice(0,10);
  const todayAppts   = leads.filter(l => l.apptDate===todayStr).length;
  const overdue      = leads.filter(l => l.followUpDate && l.followUpDate < todayStr && !["installed","pto","cancelled","dq"].includes(l.stage)).length;

  // Calendar helpers
  const weekDays = Array.from({length:7},(_,i)=>{ const d=new Date(calWeek); d.setDate(d.getDate()+i); return d; });
  const fmtCalDay = d => d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
  const leadsOnDay = d => {
    const ds = d.toISOString().slice(0,10);
    return leads.filter(l => l.apptDate===ds || l.installDate===ds || l.followUpDate===ds);
  };

  // Installs view
  const installLeads = leads.filter(l => l.stage==="install_sched"||l.stage==="installed")
    .sort((a,b)=>(a.installDate||"zzz").localeCompare(b.installDate||"zzz"));

  // Reminders
  const reminders = leads.filter(l => l.followUpDate && !["installed","pto","cancelled","dq"].includes(l.stage))
    .sort((a,b)=>a.followUpDate.localeCompare(b.followUpDate));

  if (activeLead) {
    const lead = leads.find(l=>l.id===activeLead.id)||activeLead;
    return <LeadDetail
      lead={lead} reps={reps} user={user}
      onBack={()=>setActiveLead(null)}
      onSave={saveLead} onDelete={deleteLead}
      onStageChange={handleStageChange}
      onAddActivity={addActivity}
      onSetFollowUp={setFollowUpDate}
      isMobile={isMobile}
    />;
  }

  return (
    <div className="afu" style={{opacity:0}}>

      {/* Stats strip */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(6,1fr)",gap:8,marginBottom:18}}>
        {[
          {label:"Appts Set",    val:pipeline,              color:T.amber},
          {label:"Today's Appts",val:todayAppts,            color:T.cyan},
          {label:"Deals Closed", val:totalSold,             color:T.green},
          {label:"Total Revenue",val:fmtNumShort(totalRev), color:T.green},
          {label:"Total kW",     val:`${totalKw.toFixed(1)}kW`,   color:T.cyan},
          {label:"Follow-ups Due",val:overdue,              color:overdue>0?T.red:T.t3},
        ].map(({label,val,color})=>(
          <div key={label} style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:12,padding:"12px 14px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${color}44,transparent)`}}/>
            <div className="caps" style={{marginBottom:5,fontSize:9}}>{label}</div>
            <div className="mono" style={{fontSize:18,fontWeight:700,color,lineHeight:1}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <div className="pgroup">
          {[{k:"pipeline",l:"Pipeline"},{k:"list",l:"List"},{k:"calendar",l:"📅 Calendar"},{k:"reminders",l:`Reminders${overdue>0?` (${overdue})`:""}`}].map(({k,l})=>(
            <button key={k} className={`pbtn${view===k?" on":""}`} onClick={()=>setView(k)} style={k==="reminders"&&overdue>0?{color:T.red}:{}}>{l}</button>
          ))}
        </div>
        <div className="swrap" style={{flex:1,minWidth:130}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.t3} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input className="sinput" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select value={filterRep} onChange={e=>setFilterRep(e.target.value)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:T.rad,color:T.t2,padding:"7px 11px",fontSize:12,fontFamily:"'Inter',system-ui,sans-serif",outline:"none"}}>
          <option value="all">All Reps</option>
          {reps.map(r=><option key={r.id} value={r.id}>{r.name.split(" ")[0]}</option>)}
        </select>
        <select value={filterStage} onChange={e=>setFilterStage(e.target.value)} style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:T.rad,color:T.t2,padding:"7px 11px",fontSize:12,fontFamily:"'Inter',system-ui,sans-serif",outline:"none"}}>
          <option value="all">All Stages</option>
          {CRM_STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button className="btn-cyan" style={{width:"auto",padding:"7px 16px",fontSize:12.5}} onClick={()=>{setEditLead(null);setModal(true);}}>+ Add Lead</button>
      </div>

      {/* ── PIPELINE VIEW ── */}
      {view==="pipeline" && (
        <CRMKanban leads={filtered} setLeads={setLeads} reps={reps} onClickLead={setActiveLead} onStageChange={handleStageChange} isMobile={isMobile}/>
      )}

      {/* ── LIST VIEW ── */}
      {view==="list" && (
        <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:14,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 80px 80px":"2fr 1.4fr 100px 90px 80px 80px 80px",padding:"9px 16px",borderBottom:`1px solid rgba(255,255,255,0.08)`,background:"rgba(255,255,255,0.02)"}}>
            {(isMobile?["Lead","Stage","Bill"]:["Lead","Address","Stage","Setter","Bill","kW","Appt"]).map(h=>(
              <div key={h} className="caps" style={{fontSize:9}}>{h}</div>
            ))}
          </div>
          {filtered.length===0 && <div style={{textAlign:"center",padding:40,color:T.t3,fontSize:13}}>No leads found</div>}
          {filtered.map((lead,i)=>{
            const stage   = stageInfo(lead.stage);
            const setter  = reps.find(r=>r.id===lead.setterId);
            const isOverdue = lead.followUpDate && lead.followUpDate < todayStr;
            return (
              <div key={lead.id} onClick={()=>setActiveLead(lead)}
                style={{display:"grid",gridTemplateColumns:isMobile?"1fr 80px 80px":"2fr 1.4fr 100px 90px 80px 80px 80px",
                  padding:"11px 16px",borderBottom:i<filtered.length-1?`1px solid rgba(255,255,255,0.04)`:"none",
                  cursor:"pointer",transition:"background 0.13s",background:isOverdue?"rgba(255,69,58,0.04)":"transparent"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                onMouseLeave={e=>e.currentTarget.style.background=isOverdue?"rgba(255,69,58,0.04)":"transparent"}>
                <div>
                  <div style={{fontWeight:600,fontSize:13,color:T.t1}}>{lead.firstName} {lead.lastName}</div>
                  <div style={{fontSize:10.5,color:T.t3,marginTop:1}}>{lead.city}{isOverdue?<span style={{color:T.red,marginLeft:6,fontWeight:600}}>· Follow-up overdue</span>:""}</div>
                </div>
                {!isMobile && <div style={{fontSize:12,color:T.t2,alignSelf:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lead.address}</div>}
                <div style={{alignSelf:"center"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:5,background:`${stage.color}18`,color:stage.color,border:`1px solid ${stage.color}33`}}>{stage.label}</span></div>
                {!isMobile && <div style={{fontSize:12,color:T.t2,alignSelf:"center"}}>{setter?.name?.split(" ")[0]||"—"}</div>}
                <div style={{fontSize:12,color:T.amber,fontWeight:600,alignSelf:"center"}}>${lead.utilityBill}/mo</div>
                {!isMobile && <div style={{fontSize:12,color:T.cyan,alignSelf:"center"}}>{lead.kw>0?`${lead.kw}kW`:"—"}</div>}
                {!isMobile && <div style={{fontSize:11,color:T.t3,alignSelf:"center"}}>{lead.apptDate?new Date(lead.apptDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view==="calendar" && (() => {
        // ── Calendar helpers ──
        const APPT_STAGES    = ["appt_set"]; // only confirmed upcoming appts
        const POSTSALE_STAGES= ["sold","site_survey","engineering","install_sched","installed","pto","cancelled"];

        // Events for a given ISO date string
        const eventsOnDate = (ds) => {
          const events = [];
          leads.forEach(l => {
            if (calType === "appts") {
              // Only show confirmed upcoming appointments — not follow-ups or no-shows
              if (l.apptDate === ds && l.stage === "appt_set") {
                events.push({lead:l, type:"appt", color:T.amber, label: l.apptTime ? fmtApptTime(l.apptTime) : "Appt"});
              }
            } else {
              if (l.installDate === ds)  events.push({lead:l, type:"install",  color:T.green,  label:"Install"});
              if (l.apptDate === ds && POSTSALE_STAGES.includes(l.stage)) events.push({lead:l, type:"site", color:T.cyan, label: stageInfo(l.stage).label});
            }
          });
          return events.sort((a,b)=>(a.lead.apptTime||"").localeCompare(b.lead.apptTime||""));
        };

        // Month grid data
        const { year, month } = calMonth;
        const firstDay  = new Date(year, month, 1);
        const lastDay   = new Date(year, month+1, 0);
        const startDow  = firstDay.getDay(); // 0=Sun
        const daysInMonth = lastDay.getDate();
        const monthName = firstDay.toLocaleDateString("en-US",{month:"long",year:"numeric"});

        // All grid cells (pad with nulls before first day)
        const gridCells = [];
        for (let i=0; i<startDow; i++) gridCells.push(null);
        for (let d=1; d<=daysInMonth; d++) gridCells.push(d);

        const prevMonth = () => setCalMonth(p => {
          const m = p.month === 0 ? 11 : p.month-1;
          const y = p.month === 0 ? p.year-1 : p.year;
          return {year:y,month:m};
        });
        const nextMonth = () => setCalMonth(p => {
          const m = p.month === 11 ? 0 : p.month+1;
          const y = p.month === 11 ? p.year+1 : p.year;
          return {year:y,month:m};
        });
        const goToday = () => { const n=new Date(); setCalMonth({year:n.getFullYear(),month:n.getMonth()}); setCalMode("month"); };

        // Day view helpers
        const dayViewDate  = calDayDate ? new Date(calDayDate+"T12:00:00") : new Date();
        const dayViewDS    = calDayDate || todayStr;
        const dayViewEvts  = eventsOnDate(dayViewDS);
        const daySlots     = getMSTSlots ? getMSTSlots() : [];

        return (
          <div>
            {/* ── Header ── */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              {/* Calendar type toggle */}
              <div className="pgroup">
                <button className={`pbtn${calType==="appts"?" on":""}`} onClick={()=>setCalType("appts")}>📅 Appointments</button>
                <button className={`pbtn${calType==="postsale"?" on":""}`} onClick={()=>setCalType("postsale")}>🔧 Post-Sale</button>
              </div>
              <div style={{flex:1}}/>
              {/* Month nav */}
              {calMode==="month" && <>
                <button className="btn-out" style={{padding:"5px 12px",fontSize:12}} onClick={prevMonth}>←</button>
                <div style={{fontWeight:700,fontSize:14,color:T.t1,minWidth:160,textAlign:"center"}}>{monthName}</div>
                <button className="btn-out" style={{padding:"5px 12px",fontSize:12}} onClick={nextMonth}>→</button>
              </>}
              {calMode==="day" && <>
                <button className="btn-out" style={{padding:"5px 12px",fontSize:12}} onClick={()=>{
                  const d=new Date(dayViewDate); d.setDate(d.getDate()-1);
                  setCalDayDate(d.toISOString().slice(0,10));
                }}>←</button>
                <div style={{fontWeight:700,fontSize:14,color:T.t1,minWidth:180,textAlign:"center"}}>
                  {dayViewDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
                </div>
                <button className="btn-out" style={{padding:"5px 12px",fontSize:12}} onClick={()=>{
                  const d=new Date(dayViewDate); d.setDate(d.getDate()+1);
                  setCalDayDate(d.toISOString().slice(0,10));
                }}>→</button>
              </>}
              <button className="btn-sm" onClick={goToday}>Today</button>
              {/* Mode toggle */}
              <div className="pgroup">
                <button className={`pbtn${calMode==="month"?" on":""}`} onClick={()=>setCalMode("month")}>Month</button>
                <button className={`pbtn${calMode==="day"?" on":""}`} onClick={()=>{ if(!calDayDate)setCalDayDate(todayStr); setCalMode("day"); }}>Day</button>
              </div>
            </div>

            {/* ── MONTH VIEW ── */}
            {calMode==="month" && (
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,overflow:"hidden"}}>
                {/* Day of week headers */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
                    <div key={d} style={{textAlign:"center",padding:"8px 0",fontSize:11,fontWeight:700,color:T.t3,letterSpacing:"0.06em",textTransform:"uppercase"}}>{d}</div>
                  ))}
                </div>
                {/* Day cells */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                  {gridCells.map((day,i)=>{
                    if (!day) return <div key={`e${i}`} style={{minHeight:90,borderRight:"1px solid rgba(255,255,255,0.04)",borderBottom:"1px solid rgba(255,255,255,0.04)",background:"rgba(0,0,0,0.08)"}}/>;
                    const ds      = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                    const isToday = ds === todayStr;
                    const isSel   = ds === calDayDate && calMode==="day";
                    const evts    = eventsOnDate(ds);
                    const MAX_SHOW = 3;
                    return (
                      <div key={day}
                        onClick={()=>{ setCalDayDate(ds); setCalMode("day"); }}
                        style={{
                          minHeight:90,borderRight:`1px solid rgba(255,255,255,0.04)`,borderBottom:`1px solid rgba(255,255,255,0.04)`,
                          padding:"6px 6px",cursor:"pointer",position:"relative",
                          background:isToday?"rgba(6,214,240,0.05)":"transparent",
                          transition:"background 0.13s",
                        }}
                        onMouseEnter={e=>e.currentTarget.style.background=isToday?"rgba(6,214,240,0.08)":"rgba(255,255,255,0.04)"}
                        onMouseLeave={e=>e.currentTarget.style.background=isToday?"rgba(6,214,240,0.05)":"transparent"}>
                        <div style={{
                          display:"inline-flex",alignItems:"center",justifyContent:"center",
                          width:22,height:22,borderRadius:"50%",marginBottom:4,
                          background:isToday?T.cyan:"transparent",
                          fontSize:11.5,fontWeight:isToday?800:500,
                          color:isToday?"#000":T.t2,
                        }}>{day}</div>
                        <div style={{display:"flex",flexDirection:"column",gap:2}}>
                          {evts.slice(0,MAX_SHOW).map((ev,ei)=>(
                            <div key={ei}
                              onClick={e=>{e.stopPropagation();setActiveLead(ev.lead);}}
                              style={{
                                fontSize:10,fontWeight:600,padding:"1px 5px",borderRadius:4,
                                background:`${ev.color}20`,color:ev.color,
                                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
                                border:`1px solid ${ev.color}30`,cursor:"pointer",
                              }}
                              title={`${ev.lead.firstName} ${ev.lead.lastName} · ${ev.label}`}>
                              {ev.lead.firstName} {ev.lead.lastName.slice(0,1)}.
                            </div>
                          ))}
                          {evts.length>MAX_SHOW && (
                            <div style={{fontSize:9,color:T.t3,fontWeight:600,paddingLeft:4}}>+{evts.length-MAX_SHOW} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── DAY VIEW ── */}
            {calMode==="day" && (
              <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"280px 1fr",gap:12}}>
                {/* Time slots column */}
                <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,overflow:"hidden"}}>
                  <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(255,255,255,0.02)"}}>
                    <div style={{fontWeight:700,fontSize:13,color:T.t1}}>{dayViewDate.toLocaleDateString("en-US",{weekday:"long"})}</div>
                    <div style={{fontSize:11,color:T.t3,marginTop:1}}>
                      {dayViewEvts.length>0 ? `${dayViewEvts.length} event${dayViewEvts.length!==1?"s":""}` : "Nothing scheduled"}
                    </div>
                  </div>
                  {calType==="appts" ? (
                    // Appointment day view — show time slots with bookings
                    <div>
                      {(getMSTSlots ? getMSTSlots() : []).map(slot=>{
                        const slotKey = `${String(slot.startH).padStart(2,"0")}:${String(slot.startM).padStart(2,"0")}`;
                        const booked  = dayViewEvts.filter(ev=>ev.lead.apptTime===slotKey);
                        const isEmpty = booked.length===0;
                        return (
                          <div key={slot.id} style={{
                            display:"flex",gap:10,padding:"10px 14px",
                            borderBottom:"1px solid rgba(255,255,255,0.04)",
                            background:booked.length>0?"rgba(6,214,240,0.04)":"transparent",
                          }}>
                            <div style={{width:70,flexShrink:0}}>
                              <div style={{fontSize:11,fontWeight:600,color:isEmpty?T.t3:T.cyan}}>{slot.mstLabel.split("–")[0].trim()}</div>
                              <div style={{fontSize:9,color:T.t3}}>MST</div>
                            </div>
                            <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
                              {booked.length===0 && <div style={{fontSize:11,color:T.t3,fontStyle:"italic",opacity:0.5}}>Open</div>}
                              {booked.map((ev,ei)=>(
                                <div key={ei} onClick={()=>setActiveLead(ev.lead)} style={{
                                  background:`${ev.color}15`,border:`1px solid ${ev.color}30`,
                                  borderRadius:7,padding:"5px 9px",cursor:"pointer",
                                }}>
                                  <div style={{fontSize:12,fontWeight:700,color:ev.color}}>{ev.lead.firstName} {ev.lead.lastName}</div>
                                  <div style={{fontSize:10.5,color:T.t3}}>{ev.lead.address}</div>
                                </div>
                              ))}
                              {booked.length===2 && <div style={{fontSize:10,color:T.red,fontWeight:600}}>Full</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Post-sale day view — list events
                    <div>
                      {dayViewEvts.length===0 && <div style={{padding:"32px 14px",textAlign:"center",color:T.t3,fontSize:12}}>Nothing scheduled</div>}
                      {dayViewEvts.map((ev,i)=>(
                        <div key={i} onClick={()=>setActiveLead(ev.lead)} style={{
                          display:"flex",gap:10,padding:"12px 14px",
                          borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",
                          transition:"background 0.13s",
                        }}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:ev.color,flexShrink:0,marginTop:5}}/>
                          <div>
                            <div style={{fontSize:12.5,fontWeight:700,color:T.t1}}>{ev.lead.firstName} {ev.lead.lastName}</div>
                            <div style={{fontSize:11,color:ev.color,fontWeight:600,marginTop:1}}>{ev.label}</div>
                            <div style={{fontSize:10.5,color:T.t3}}>{ev.lead.address}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Details panel */}
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {/* Mini month for navigation */}
                  <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"12px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <button className="btn-sm" onClick={prevMonth}>←</button>
                      <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{monthName}</div>
                      <button className="btn-sm" onClick={nextMonth}>→</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1}}>
                      {["S","M","T","W","T","F","S"].map((d,i)=>(
                        <div key={i} style={{textAlign:"center",fontSize:9,fontWeight:700,color:T.t3,paddingBottom:3}}>{d}</div>
                      ))}
                      {gridCells.map((day,i)=>{
                        if (!day) return <div key={`e${i}`}/>;
                        const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                        const isToday = ds===todayStr;
                        const isSel = ds===calDayDate;
                        const hasEvts = eventsOnDate(ds).length>0;
                        return (
                          <div key={day} onClick={()=>setCalDayDate(ds)} style={{
                            textAlign:"center",fontSize:11,borderRadius:5,padding:"2px 0",cursor:"pointer",
                            background: isSel?T.cyan:isToday?"rgba(6,214,240,0.2)":"transparent",
                            color: isSel?"#000":isToday?T.cyan:T.t2,
                            fontWeight: isSel||isToday?700:400,
                            position:"relative",
                          }}>
                            {day}
                            {hasEvts&&!isSel&&<div style={{position:"absolute",bottom:1,left:"50%",transform:"translateX(-50%)",width:3,height:3,borderRadius:"50%",background:isToday?T.cyan:T.t3}}/>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Event summary cards */}
                  {dayViewEvts.length>0 && (
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"12px 14px"}}>
                      <div style={{fontSize:11,fontWeight:700,color:T.t3,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>
                        {calType==="appts"?"Appointments":"Post-Sale Events"} · {dayViewDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {dayViewEvts.map((ev,i)=>(
                          <div key={i} onClick={()=>setActiveLead(ev.lead)} style={{
                            display:"flex",alignItems:"center",gap:10,
                            padding:"8px 10px",borderRadius:9,cursor:"pointer",
                            background:`${ev.color}0d`,border:`1px solid ${ev.color}28`,
                          }}>
                            <div style={{width:6,height:6,borderRadius:"50%",background:ev.color,flexShrink:0}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,fontWeight:700,color:T.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.lead.firstName} {ev.lead.lastName}</div>
                              <div style={{fontSize:10.5,color:ev.color,fontWeight:600}}>{ev.label}{calType==="appts"&&ev.lead.apptTime?` · ${fmtApptTime(ev.lead.apptTime)}`:""}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── INSTALLS VIEW ── */}
      {view==="installs" && (
        <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:14,overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid rgba(255,255,255,0.06)`}}>
            <div style={{fontWeight:700,fontSize:14,color:T.t1}}>Upcoming & Recent Installs</div>
            <div style={{fontSize:11,color:T.t3,marginTop:2}}>{installLeads.length} deals in install pipeline</div>
          </div>
          {installLeads.length===0 && <div style={{padding:40,textAlign:"center",color:T.t3,fontSize:13}}>No installs scheduled yet</div>}
          {installLeads.map((lead,i)=>{
            const stage   = stageInfo(lead.stage);
            const setter  = reps.find(r=>r.id===lead.setterId);
            const daysUntil = lead.installDate ? Math.ceil((new Date(lead.installDate+"T12:00:00")-new Date())/86400000) : null;
            return (
              <div key={lead.id} onClick={()=>setActiveLead(lead)}
                style={{display:"flex",alignItems:"center",gap:14,padding:"13px 18px",borderBottom:i<installLeads.length-1?`1px solid rgba(255,255,255,0.04)`:"none",cursor:"pointer",transition:"background 0.13s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.04)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {/* Days until badge */}
                <div style={{width:52,height:52,borderRadius:12,flexShrink:0,background:`${stage.color}18`,border:`1px solid ${stage.color}33`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  {daysUntil!==null ? (
                    <>
                      <div className="mono" style={{fontSize:17,fontWeight:700,color:stage.color,lineHeight:1}}>{daysUntil<0?Math.abs(daysUntil):daysUntil}</div>
                      <div style={{fontSize:9,color:stage.color,opacity:0.7}}>{daysUntil<0?"ago":"days"}</div>
                    </>
                  ) : <div style={{fontSize:11,color:T.t3}}>TBD</div>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13.5,color:T.t1}}>{lead.firstName} {lead.lastName}</div>
                  <div style={{fontSize:11.5,color:T.t3,marginTop:1}}>{lead.address}, {lead.city}</div>
                  <div style={{display:"flex",gap:10,marginTop:4,flexWrap:"wrap"}}>
                    {lead.kw>0&&<span style={{fontSize:11,color:T.cyan,fontWeight:600}}>{lead.kw} kW</span>}
                    {lead.salePrice>0&&<span style={{fontSize:11,color:T.green,fontWeight:600}}>${lead.salePrice.toLocaleString()}</span>}
                    {setter&&<span style={{fontSize:11,color:T.t3}}>Set by {setter.name.split(" ")[0]}</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:6,background:`${stage.color}18`,color:stage.color,border:`1px solid ${stage.color}33`}}>{stage.label}</span>
                  {lead.installDate&&<div style={{fontSize:11,color:T.t3,marginTop:4}}>{new Date(lead.installDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── REMINDERS VIEW ── */}
      {view==="reminders" && (
        <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:14,overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid rgba(255,255,255,0.06)`,display:"flex",alignItems:"center",gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14,color:T.t1}}>Follow-up Reminders</div>
              <div style={{fontSize:11,color:T.t3,marginTop:2}}>{reminders.length} leads with follow-up dates</div>
            </div>
            {overdue>0&&<div style={{fontSize:12,fontWeight:700,color:T.red,background:"rgba(255,69,58,0.1)",border:"1px solid rgba(255,69,58,0.25)",borderRadius:8,padding:"4px 12px"}}>{overdue} overdue</div>}
          </div>
          {reminders.length===0 && <div style={{padding:40,textAlign:"center",color:T.t3,fontSize:13}}>No follow-up reminders set — open a lead and set a follow-up date</div>}
          {reminders.map((lead,i)=>{
            const isOverdueL = lead.followUpDate < todayStr;
            const stage      = stageInfo(lead.stage);
            const setter     = reps.find(r=>r.id===lead.setterId);
            const daysStr    = (() => {
              const d = Math.ceil((new Date(lead.followUpDate+"T12:00:00")-new Date())/86400000);
              if (d<0) return `${Math.abs(d)}d overdue`;
              if (d===0) return "Today";
              return `In ${d}d`;
            })();
            return (
              <div key={lead.id} onClick={()=>setActiveLead(lead)}
                style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",borderBottom:i<reminders.length-1?`1px solid rgba(255,255,255,0.04)`:"none",cursor:"pointer",background:isOverdueL?"rgba(255,69,58,0.04)":"transparent",transition:"background 0.13s"}}
                onMouseEnter={e=>e.currentTarget.style.background=isOverdueL?"rgba(255,69,58,0.07)":"rgba(255,255,255,0.04)"}
                onMouseLeave={e=>e.currentTarget.style.background=isOverdueL?"rgba(255,69,58,0.04)":"transparent"}>
                <div style={{width:8,height:8,borderRadius:"50%",background:isOverdueL?T.red:T.amber,flexShrink:0,boxShadow:isOverdueL?`0 0 6px ${T.red}88`:"none"}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:T.t1}}>{lead.firstName} {lead.lastName}</div>
                  <div style={{fontSize:11,color:T.t3,marginTop:1}}>{setter?`Set by ${setter.name.split(" ")[0]} · `:""}<span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:4,background:`${stage.color}18`,color:stage.color}}>{stage.label}</span></div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:isOverdueL?T.red:T.amber}}>{daysStr}</div>
                  <div style={{fontSize:10,color:T.t3,marginTop:2}}>{new Date(lead.followUpDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SOLD MODAL ── */}
      {soldModal && (
        <SoldModal
          lead={soldModal}
          reps={reps}
          onConfirm={(kw, price, closerId, setterCut, closerCut, installDate) => {
            const setterRank = reps.find(r=>r.id===soldModal.setterId);
            syncDealStage(soldModal.id, "sold", {
              kw, salePrice:price, closerId,
              setterCommission: setterCut,
              closerCommission: closerCut,
              closeDate: new Date().toISOString().slice(0,10),
              installDate: installDate||null,
            });
            addActivity(soldModal.id, {
              type:"stage", text:`Marked Sold · $${price.toLocaleString()} · ${kw}kW`,
              time:new Date().toLocaleString(), by:"Admin",
            });
            setSoldModal(null);
          }}
          onClose={()=>setSoldModal(null)}
        />
      )}

      {/* ── APPOINTMENT DISPOSITION — two-step showed / no show ── */}
      {apptDisp && (() => {
        const { lead, pendingStage } = apptDisp;
        const [step,    setStep]    = React.useState("attendance"); // attendance | showed_outcome | noshow_outcome | reschedule
        const [nsDate,  setNsDate]  = React.useState(lead.apptDate||"");
        const [nsTime,  setNsTime]  = React.useState(lead.apptTime||"");

        const finish = (finalStage, activityText, extraFields={}) => {
          // If they showed, increment the rep's show count
          const showedFirst = step === "showed_outcome" || (step==="attendance" && finalStage==="sold");
          syncDealStage(lead.id, finalStage, extraFields);
          addActivity(lead.id, {type:"stage", text:activityText, time:new Date().toLocaleString(), by:"Admin"});
          // Track the showed fact on the lead for show-rate stats
          if (showedFirst) {
            setLeads(prev => prev.map(l => l.id===lead.id ? {...l, showed:true} : l));
          }
          setApptDisp(null);
        };

        const optionBtn = (label, sub, action, color) => (
          <button key={label} onClick={action} style={{
            display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,
            background:`${color}10`,border:`1px solid ${color}30`,borderRadius:12,
            padding:"13px 16px",cursor:"pointer",fontFamily:"'Inter',system-ui,sans-serif",transition:"all 0.14s",width:"100%",
          }}
          onMouseEnter={e=>e.currentTarget.style.background=`${color}20`}
          onMouseLeave={e=>e.currentTarget.style.background=`${color}10`}>
            <span style={{fontWeight:700,fontSize:13,color}}>{label}</span>
            {sub && <span style={{fontSize:11.5,color:T.t3}}>{sub}</span>}
          </button>
        );

        return (
          <div className="moverlay" onClick={()=>setApptDisp(null)}>
            <div className="mpanel" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>

              {/* Lead header */}
              <div style={{marginBottom:16}}>
                <div style={{fontWeight:800,fontSize:17,color:T.t1,letterSpacing:"-0.02em"}}>{lead.firstName} {lead.lastName}</div>
                <div style={{fontSize:12,color:T.t3,marginTop:2}}>{lead.address}{lead.apptDate?` · Appt ${new Date(lead.apptDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}${lead.apptTime?" @ "+fmtApptTime(lead.apptTime):""}`:""}</div>
              </div>

              {/* Step indicator */}
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:18}}>
                {[
                  {id:"attendance", label:"Attendance"},
                  {id:"outcome",    label:"Outcome"},
                ].map((s,i)=>{
                  const active = s.id==="attendance" ? step==="attendance" : step!=="attendance";
                  const done   = s.id==="attendance" && step!=="attendance";
                  return (
                    <React.Fragment key={s.id}>
                      {i>0 && <div style={{flex:1,height:1,background:"rgba(255,255,255,0.1)"}}/>}
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <div style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,
                          background:done?T.green:active?T.cyan:"rgba(255,255,255,0.06)",
                          color:done||active?"#000":T.t3,border:`1px solid ${done?T.green:active?T.cyan:"rgba(255,255,255,0.1)"}`}}>
                          {done?"✓":i+1}
                        </div>
                        <span style={{fontSize:11,fontWeight:600,color:active||done?T.t1:T.t3}}>{s.label}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* ── STEP 1: Did they show? ── */}
              {step==="attendance" && (
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:T.t2,marginBottom:14}}>Did the homeowner show up?</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {optionBtn("✅ Showed", "Homeowner was present for the appointment", ()=>setStep("showed_outcome"), T.green)}
                    {optionBtn("❌ No Show", "Homeowner wasn't home / didn't answer", ()=>setStep("noshow_outcome"), T.red)}
                    <button className="btn-out" style={{marginTop:4}} onClick={()=>setApptDisp(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── STEP 2a: Showed outcomes ── */}
              {step==="showed_outcome" && (
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                    <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:5,background:T.greenDm,color:T.green,border:`1px solid rgba(48,209,88,0.3)`}}>✅ Showed</span>
                    <span style={{fontSize:13,fontWeight:600,color:T.t2}}>What was the result?</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {optionBtn("💰 Sold", "Deal closed — enter kW and price", ()=>{
                      setApptDisp(null);
                      // Record showed first, then open sold modal
                      setLeads(prev => prev.map(l => l.id===lead.id ? {...l, showed:true} : l));
                      addActivity(lead.id, {type:"stage",text:"Showed",time:new Date().toLocaleString(),by:"Admin"});
                      setSoldModal({...lead, pendingStage:"sold"});
                    }, T.cyan)}
                    {optionBtn("📋 Follow Up", "Interested but needs more time", ()=>
                      finish("follow_up","Showed → Follow Up"), T.amber)}
                    {optionBtn("🚫 Disqualified", "Not a fit — bad credit, renter, shading, etc.", ()=>
                      finish("dq","Showed → Disqualified"), T.red)}
                    {optionBtn("💬 No Sale", "Ran the full pitch, homeowner passed", ()=>
                      finish("follow_up","Showed → No Sale (Follow Up)"), T.t3)}
                    <button className="btn-out" style={{marginTop:4}} onClick={()=>setStep("attendance")}>← Back</button>
                  </div>
                </div>
              )}

              {/* ── STEP 2b: No Show outcomes ── */}
              {step==="noshow_outcome" && (
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                    <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:5,background:T.redDm||"rgba(255,69,58,0.12)",color:T.red,border:`1px solid rgba(255,69,58,0.3)`}}>❌ No Show</span>
                    <span style={{fontSize:13,fontWeight:600,color:T.t2}}>What happened?</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {optionBtn("📅 Reschedule", "Set a new appointment date", ()=>setStep("reschedule"), T.cyan)}
                    {optionBtn("📋 Follow Up", "Mark for future follow-up", ()=>
                      finish("follow_up","No Show → Follow Up"), T.amber)}
                    {optionBtn("🚫 Disqualified", "Checked the property — not a fit", ()=>
                      finish("dq","No Show → Disqualified"), T.red)}
                    <button className="btn-out" style={{marginTop:4}} onClick={()=>setStep("attendance")}>← Back</button>
                  </div>
                </div>
              )}

              {/* ── STEP 2c: Reschedule ── */}
              {step==="reschedule" && (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{fontSize:12.5,color:T.t3}}>Set the new appointment date and time:</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <div className="caps" style={{marginBottom:5,fontSize:8.5}}>New Date</div>
                      <input className="hinput" type="date" value={nsDate} onChange={e=>setNsDate(e.target.value)} min={new Date().toISOString().slice(0,10)} autoFocus/>
                    </div>
                    <div>
                      <div className="caps" style={{marginBottom:5,fontSize:8.5}}>Time (optional)</div>
                      <select className="hinput" value={nsTime} onChange={e=>setNsTime(e.target.value)} style={{cursor:"pointer"}}>
                        <option value="">— pick a time —</option>
                        {getMSTSlots().map(s=>(
                          <option key={s.id} value={`${String(s.startH).padStart(2,"0")}:${String(s.startM).padStart(2,"0")}`}>{s.mstLabel} MST</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button className="btn-cyan" style={{flex:1}} disabled={!nsDate} onClick={()=>{
                      syncDealStage(lead.id, "appt_set", {apptDate:nsDate, apptTime:nsTime});
                      addActivity(lead.id, {type:"stage",text:`No Show → Rescheduled for ${nsDate}${nsTime?" @ "+fmtApptTime(nsTime):""}`,time:new Date().toLocaleString(),by:"Admin"});
                      setApptDisp(null);
                    }}>Confirm Reschedule</button>
                    <button className="btn-out" onClick={()=>setStep("noshow_outcome")}>← Back</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* ── NO SHOW MODAL ── */}
      {noShowModal && (() => {
        const [nsDate, setNsDate] = React.useState(noShowModal.apptDate||"");
        const [nsTime, setNsTime] = React.useState(noShowModal.apptTime||"");
        const [nsView, setNsView] = React.useState("pick"); // pick | reschedule
        return (
          <div className="moverlay" onClick={()=>setNoShowModal(null)}>
            <div className="mpanel" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
              <div style={{fontWeight:800,fontSize:17,color:T.t1,marginBottom:4,letterSpacing:"-0.02em"}}>No Show — {noShowModal.firstName} {noShowModal.lastName}</div>
              <div style={{fontSize:12.5,color:T.t3,marginBottom:20}}>What happened next?</div>
              {nsView==="pick" ? (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[
                    {label:"Reschedule Appt", sub:"Set a new appointment date", action:()=>setNsView("reschedule"), color:T.cyan},
                    {label:"Follow Up", sub:"Mark for future follow-up", action:()=>{
                      syncDealStage(noShowModal.id, "follow_up");
                      addActivity(noShowModal.id, {type:"stage",text:"No Show → Follow Up",time:new Date().toLocaleString(),by:"Admin"});
                      setNoShowModal(null);
                    }, color:T.amber},
                    {label:"Disqualify", sub:"Lead is not a good fit", action:()=>{
                      if(!window.confirm("Disqualify this lead?")) return;
                      syncDealStage(noShowModal.id, "dq");
                      addActivity(noShowModal.id, {type:"stage",text:"No Show → Disqualified",time:new Date().toLocaleString(),by:"Admin"});
                      setNoShowModal(null);
                    }, color:T.red},
                  ].map(({label,sub,action,color})=>(
                    <button key={label} onClick={action} style={{
                      display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,
                      background:`${color}10`,border:`1px solid ${color}30`,borderRadius:12,
                      padding:"13px 16px",cursor:"pointer",fontFamily:"'Inter',system-ui,sans-serif",
                      transition:"all 0.14s",
                    }}
                    onMouseEnter={e=>e.currentTarget.style.background=`${color}20`}
                    onMouseLeave={e=>e.currentTarget.style.background=`${color}10`}>
                      <span style={{fontWeight:700,fontSize:13,color}}>{label}</span>
                      <span style={{fontSize:11.5,color:T.t3}}>{sub}</span>
                    </button>
                  ))}
                  <button className="btn-out" style={{marginTop:4}} onClick={()=>setNoShowModal(null)}>Cancel</button>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  <div style={{fontSize:12.5,color:T.t3,marginBottom:4}}>Set the new appointment date and time:</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <div>
                      <div className="caps" style={{marginBottom:5,fontSize:8.5}}>New Date</div>
                      <input className="hinput" type="date" value={nsDate} onChange={e=>setNsDate(e.target.value)} autoFocus/>
                    </div>
                    <div>
                      <div className="caps" style={{marginBottom:5,fontSize:8.5}}>Time (optional)</div>
                      <select className="hinput" value={nsTime} onChange={e=>setNsTime(e.target.value)} style={{cursor:"pointer"}}>
                        <option value="">— pick a time —</option>
                        {getMSTSlots().map(s=>(
                          <option key={s.id} value={`${String(s.startH).padStart(2,"0")}:${String(s.startM).padStart(2,"0")}`}>{s.mstLabel} MST</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:4}}>
                    <button className="btn-cyan" style={{flex:1}} disabled={!nsDate} onClick={()=>{
                      syncDealStage(noShowModal.id, "appt_set", {apptDate:nsDate, apptTime:nsTime});
                      addActivity(noShowModal.id, {type:"stage",text:`No Show → Rescheduled for ${nsDate}${nsTime?" @ "+nsTime:""}`,time:new Date().toLocaleString(),by:"Admin"});
                      setNoShowModal(null);
                    }}>Confirm Reschedule</button>
                    <button className="btn-out" onClick={()=>setNsView("pick")}>Back</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {modal && <LeadModal lead={editLead} reps={reps} onSave={saveLead} onClose={()=>{setModal(false);setEditLead(null);}}/>}
    </div>
  );
}

/* ── SOLD MODAL ── */
function SoldModal({ lead, reps, onConfirm, onClose }) {
  const [kw,       setKw]       = useState(lead.kw||"");
  const [price,    setPrice]    = useState(lead.salePrice||"");
  const [closerId, setCloserId] = useState(lead.closerId||"admin");
  const [installDate, setInstallDate] = useState(lead.installDate||"");

  const setterRep  = reps.find(r=>r.id===lead.setterId);
  const setterRank = setterRep ? SETTER_RANKS.find(r=>r.id===getRepRank(setterRep).id) : null;
  const setterPct  = setterRank ? parseFloat(setterRank.comp.pct)/100 : 0.25;
  const setterCut  = price ? Math.round(Number(price)*setterPct) : 0;
  const closerCut  = price ? Number(price)-setterCut : 0;

  const valid = kw && price && Number(price)>0 && Number(kw)>0;

  return (
    <div className="moverlay" onClick={onClose}>
      <div className="mpanel" onClick={e=>e.stopPropagation()} style={{maxWidth:460}}>
        <div style={{fontWeight:800,fontSize:17,color:T.t1,marginBottom:2,letterSpacing:"-0.02em"}}>Mark as Sold</div>
        <div style={{fontSize:12.5,color:T.t3,marginBottom:18}}>{lead.firstName} {lead.lastName} · {lead.address}</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div className="caps" style={{marginBottom:5}}>System Size (kW)</div>
              <input className="hinput" type="number" step="0.1" value={kw} onChange={e=>setKw(e.target.value)} placeholder="8.4" autoFocus/>
            </div>
            <div>
              <div className="caps" style={{marginBottom:5}}>Sale Price ($)</div>
              <input className="hinput" type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="38000"/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div>
              <div className="caps" style={{marginBottom:5}}>Closer (Rep)</div>
              <select className="hinput" value={closerId} onChange={e=>setCloserId(e.target.value)} style={{cursor:"pointer"}}>
                <option value="admin">Admin (You)</option>
                {reps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <div className="caps" style={{marginBottom:5}}>Install Date (optional)</div>
              <input className="hinput" type="date" value={installDate} onChange={e=>setInstallDate(e.target.value)}/>
            </div>
          </div>

          {/* Commission breakdown */}
          {price>0 && (
            <div style={{background:"rgba(6,214,240,0.06)",border:"1px solid rgba(6,214,240,0.2)",borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:11,fontWeight:700,color:T.cyan,marginBottom:8,letterSpacing:"0.04em",textTransform:"uppercase"}}>Commission Split</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {setterRep && (
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:12,color:T.t2}}>{setterRep.name.split(" ")[0]} (Setter · {setterRank?.comp.pct||"25%"})</span>
                    <span style={{fontSize:12,fontWeight:700,color:T.green}}>${setterCut.toLocaleString()}</span>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,color:T.t2}}>Closer (remainder)</span>
                  <span style={{fontSize:12,fontWeight:700,color:T.green}}>${closerCut.toLocaleString()}</span>
                </div>
                <div style={{height:1,background:"rgba(255,255,255,0.08)",margin:"2px 0"}}/>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,color:T.t1,fontWeight:600}}>Total</span>
                  <span style={{fontSize:12,fontWeight:700,color:T.t1}}>${Number(price).toLocaleString()}</span>
                </div>
                <div style={{height:1,background:"rgba(255,255,255,0.06)",margin:"2px 0"}}/>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,color:T.amber}}>10% held until PTO (admin only)</span>
                  <span style={{fontSize:11,fontWeight:600,color:T.amber}}>-${Math.round(Number(price)*0.10).toLocaleString()}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,color:T.t3}}>Paid at install</span>
                  <span style={{fontSize:11,fontWeight:600,color:T.t2}}>${Math.round(Number(price)*0.90).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div style={{display:"flex",gap:10,marginTop:6}}>
            <button className="btn-cyan" style={{flex:1}} disabled={!valid}
              onClick={()=>onConfirm(Number(kw),Number(price),closerId,setterCut,closerCut,installDate)}>
              ✓ Confirm Sale
            </button>
            <button className="btn-out" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── LEAD DETAIL ── */
function LeadDetail({ lead, reps, user, onBack, onSave, onDelete, onStageChange, onAddActivity, onSetFollowUp, isMobile }) {
  const [editing,     setEditing]    = useState(false);
  const [newNote,     setNewNote]    = useState("");
  const [followInput, setFollowInput]= useState(lead.followUpDate||"");
  const stage   = stageInfo(lead.stage);
  const setter  = reps.find(r=>r.id===lead.setterId);
  const closer  = reps.find(r=>r.id===lead.closerId);
  const activity = lead.activity || [];
  const todayStr = new Date().toISOString().slice(0,10);

  const logNote = () => {
    if (!newNote.trim()) return;
    onAddActivity(lead.id, {type:"note", text:newNote.trim(), time:new Date().toLocaleString(), by:user?.isAdmin?"Admin":user?.name||"Rep"});
    setNewNote("");
  };

  if (editing) return <LeadModal lead={lead} reps={reps} onSave={l=>{onSave(l);setEditing(false);}} onClose={()=>setEditing(false)}/>;

  return (
    <div className="afu" style={{opacity:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <button className="btn-out" aria-label="Back to leads list" style={{padding:"7px 14px",fontSize:12.5}} onClick={onBack}>← Back</button>
        <div style={{flex:1}}/>
        <button className="btn-sm" onClick={()=>setEditing(true)}>Edit</button>
        <button className="btn-del" onClick={()=>{if(window.confirm("Delete this lead?"))onDelete(lead.id);}}>Delete</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"2fr 1fr",gap:14}}>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Header */}
          <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:14,padding:"20px 22px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${stage.color}55,transparent)`}}/>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div>
                <div style={{fontWeight:800,fontSize:22,color:T.t1,letterSpacing:"-0.03em",marginBottom:4}}>{lead.firstName} {lead.lastName}</div>
                <div style={{fontSize:12.5,color:T.t3,marginBottom:10}}>{lead.address}, {lead.city}, {lead.state} {lead.zip}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <a href={`tel:${lead.phone}`} style={{display:"flex",alignItems:"center",gap:6,background:T.greenDm,border:`1px solid rgba(48,209,88,0.3)`,borderRadius:7,padding:"6px 14px",textDecoration:"none",color:T.green,fontSize:12.5,fontWeight:600}}>📞 {lead.phone}</a>
                  {lead.email&&<a href={`mailto:${lead.email}`} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.06)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:7,padding:"6px 14px",textDecoration:"none",color:T.t2,fontSize:12.5}}>✉ {lead.email}</a>}
                </div>
              </div>
              <div>
                <div className="caps" style={{marginBottom:5,fontSize:8.5}}>Stage</div>
                <select value={lead.stage} onChange={e=>onStageChange(lead.id,e.target.value)} style={{background:`${stage.color}18`,border:`1px solid ${stage.color}44`,borderRadius:8,color:stage.color,padding:"7px 13px",fontSize:12,fontWeight:700,fontFamily:"'Inter',system-ui,sans-serif",outline:"none",cursor:"pointer"}} aria-label="Change deal stage">
                  {CRM_STAGES.filter(s=>{
                    // Once past new_lead, hide "new" as a regression option
                    if(s.key==="new" && lead.stage!=="new") return false;
                    return true;
                  }).map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Solar Profile */}
          <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:14,padding:"18px 20px"}}>
            <div style={{fontWeight:700,fontSize:13,color:T.t1,marginBottom:13,letterSpacing:"-0.01em"}}>Solar Profile</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[
                {label:"Monthly Bill",  val:`$${lead.utilityBill}/mo`,             color:lead.utilityBill>=300?T.green:T.amber},
                {label:"Roof Age",      val:lead.roofAge?`${lead.roofAge} yrs`:"—",color:lead.roofAge&&lead.roofAge<=10?T.green:T.amber},
                {label:"Roof Type",     val:lead.roofType||"—",                    color:T.t1},
                {label:"Shade",         val:lead.shade||"—",                       color:lead.shade==="None"?T.green:lead.shade==="Low"?T.amber:T.red},
                {label:"Homeowner",     val:lead.homeowner?"Yes":"No",             color:lead.homeowner?T.green:T.red},
                {label:"HOA",           val:lead.hoa?"Yes":"No",                   color:lead.hoa?T.amber:T.green},
                {label:"Credit",        val:lead.creditScore||"—",                 color:lead.creditScore==="Excellent"?T.green:lead.creditScore==="Good"?T.amber:T.red},
                {label:"System Size",   val:lead.kw?`${lead.kw} kW`:"TBD",        color:T.cyan},
                {label:"Sale Price",    val:lead.salePrice?`$${lead.salePrice.toLocaleString()}`:"TBD", color:T.green},
              ].map(({label,val,color})=>(
                <div key={label} style={{background:"rgba(255,255,255,0.02)",border:`1px solid rgba(255,255,255,0.04)`,borderRadius:9,padding:"9px 11px"}}>
                  <div className="caps" style={{fontSize:8,marginBottom:3}}>{label}</div>
                  <div style={{fontSize:13,fontWeight:700,color}}>{val}</div>
                </div>
              ))}
            </div>
            {lead.adders?.length>0&&(
              <div style={{marginTop:11}}>
                <div className="caps" style={{marginBottom:6}}>Add-ons</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {lead.adders.map(a=><span key={a} style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:6,background:T.goldDm,color:T.gold,border:`1px solid rgba(240,165,0,0.3)`}}>{a}</span>)}
                </div>
              </div>
            )}
            {/* Commission breakdown — visible if sold */}
            {lead.salePrice>0&&(lead.setterCommission||lead.closerCommission)&&(
              <div style={{marginTop:12,background:"rgba(6,214,240,0.05)",border:"1px solid rgba(6,214,240,0.15)",borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:10,fontWeight:700,color:T.cyan,marginBottom:7,letterSpacing:"0.06em",textTransform:"uppercase"}}>Commission Split</div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {setter&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:T.t2}}>{setter.name.split(" ")[0]} (Setter)</span><span style={{fontSize:12,fontWeight:700,color:T.green}}>${(lead.setterCommission||0).toLocaleString()}</span></div>}
                  {closer&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:T.t2}}>{closer.name.split(" ")[0]} (Closer)</span><span style={{fontSize:12,fontWeight:700,color:T.green}}>${(lead.closerCommission||0).toLocaleString()}</span></div>}
                  {!closer&&<div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:T.t2}}>Closer (Admin)</span><span style={{fontSize:12,fontWeight:700,color:T.green}}>${(lead.closerCommission||0).toLocaleString()}</span></div>}
                  <div style={{height:1,background:"rgba(255,255,255,0.08)",margin:"2px 0"}}/>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:T.t1,fontWeight:600}}>Total Deal</span>
                    <span style={{fontSize:11,fontWeight:700,color:T.t1}}>${lead.salePrice.toLocaleString()}</span>
                  </div>
                  <div style={{height:1,background:"rgba(255,255,255,0.06)",margin:"2px 0"}}/>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:T.amber}}>10% held until PTO</span>
                    <span style={{fontSize:11,fontWeight:600,color:T.amber}}>-${Math.round(lead.salePrice*0.10).toLocaleString()}</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{fontSize:11,color:T.t3}}>Paid at install</span>
                    <span style={{fontSize:11,fontWeight:600,color:T.t2}}>${Math.round(lead.salePrice*0.90).toLocaleString()}</span>
                  </div>
                  {lead.stage==="pto"&&(
                    <div style={{marginTop:4,display:"flex",justifyContent:"space-between",background:"rgba(255,214,10,0.08)",border:"1px solid rgba(255,214,10,0.2)",borderRadius:6,padding:"4px 8px"}}>
                      <span style={{fontSize:11,color:T.gold,fontWeight:700}}>✓ PTO — fully paid out</span>
                      <span style={{fontSize:11,fontWeight:700,color:T.gold}}>${lead.salePrice.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:14,padding:"18px 20px"}}>
            <div style={{fontWeight:700,fontSize:13,color:T.t1,marginBottom:12,letterSpacing:"-0.01em"}}>Activity</div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <input className="hinput" value={newNote} onChange={e=>setNewNote(e.target.value)} onKeyDown={e=>e.key==="Enter"&&logNote()} placeholder="Add a note…" style={{flex:1,fontSize:12.5}}/>
              <button className="btn-cyan" style={{width:"auto",padding:"7px 16px",fontSize:12}} onClick={logNote}>Log</button>
            </div>
            {activity.length===0&&<div style={{color:T.t3,fontSize:12,textAlign:"center",padding:"12px 0"}}>No activity yet</div>}
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {activity.map((act,i)=>{
                const icons={call:"📞",sms:"💬",stage:"↗",note:"📝",created:"✦"};
                const cols ={call:T.green,sms:T.amber,stage:T.cyan,note:T.t2,created:T.t3};
                return (
                  <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:i<activity.length-1?`1px solid rgba(255,255,255,0.04)`:"none"}}>
                    <div style={{width:28,height:28,borderRadius:7,background:"rgba(255,255,255,0.06)",border:`1px solid rgba(255,255,255,0.04)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{icons[act.type]||"📝"}</div>
                    <div>
                      <div style={{fontSize:12.5,color:cols[act.type]||T.t2,fontWeight:500}}>{act.text}</div>
                      <div style={{fontSize:10.5,color:T.t3,marginTop:2}}>{act.time} · {act.by}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>

          {/* People */}
          <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:12,padding:"15px"}}>
            <div className="caps" style={{marginBottom:9,fontSize:8.5}}>People</div>
            {setter&&(
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <Avatar name={setter.name} size={32}/>
                <div><div style={{fontSize:12,color:T.t1,fontWeight:600}}>{setter.name}</div><div style={{fontSize:10.5,color:T.t3}}>Setter</div></div>
              </div>
            )}
            {closer&&(
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Avatar name={closer.name} size={32}/>
                <div><div style={{fontSize:12,color:T.t1,fontWeight:600}}>{closer.name}</div><div style={{fontSize:10.5,color:T.t3}}>Closer</div></div>
              </div>
            )}
            {!setter&&!closer&&<div style={{color:T.t3,fontSize:12}}>No reps assigned</div>}
          </div>

          {/* Key dates */}
          <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:12,padding:"15px"}}>
            <div className="caps" style={{marginBottom:9,fontSize:8.5}}>Key Dates</div>
            {[
              {label:"Created",      val:lead.created?fmtDate2(lead.created):"—"},
              {label:"Appt Date",    val:lead.apptDate?`${fmtDate2(lead.apptDate)}${lead.apptTime?" · "+fmtApptTime(lead.apptTime):""}` : "Not set"},
              {label:"Close Date",   val:lead.closeDate?fmtDate2(lead.closeDate):"—"},
              {label:"Install Date", val:lead.installDate?fmtDate2(lead.installDate):"—"},
              {label:"Source",       val:srcLabel(lead.source)||"—"},
              {label:"Financing",    val:lead.financing||"TBD"},
            ].map(({label,val})=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                <span style={{fontSize:11.5,color:T.t3}}>{label}</span>
                <span style={{fontSize:11.5,color:T.t1,fontWeight:500}}>{val}</span>
              </div>
            ))}
          </div>

          {/* Follow-up reminder */}
          <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:12,padding:"15px"}}>
            <div className="caps" style={{marginBottom:9,fontSize:8.5}}>Follow-up Reminder</div>
            {lead.followUpDate&&lead.followUpDate<todayStr&&(
              <div style={{fontSize:11,fontWeight:700,color:T.red,marginBottom:8}}>⚠ Overdue — {fmtDate2(lead.followUpDate)}</div>
            )}
            <input className="hinput" type="date" value={followInput} onChange={e=>{setFollowInput(e.target.value);}}
              style={{marginBottom:8,fontSize:12}}/>
            <button className="btn-cyan" style={{width:"100%",padding:"7px",fontSize:12}}
              onClick={()=>{ onSetFollowUp(lead.id, followInput); }}>
              {lead.followUpDate?"Update Reminder":"Set Reminder"}
            </button>
            {lead.followUpDate&&(
              <button className="btn-out" style={{width:"100%",padding:"6px",fontSize:11.5,marginTop:6}}
                onClick={()=>{ onSetFollowUp(lead.id,""); setFollowInput(""); }}>Clear Reminder</button>
            )}
          </div>

          {/* Quick actions */}
          <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:12,padding:"15px"}}>
            <div className="caps" style={{marginBottom:9,fontSize:8.5}}>Quick Actions</div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              <a href={`tel:${lead.phone}`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,background:T.greenDm,border:`1px solid rgba(48,209,88,0.3)`,borderRadius:8,padding:"9px",color:T.green,fontWeight:700,fontSize:13,textDecoration:"none",fontFamily:"'Inter',system-ui,sans-serif"}}>📞 Call Now</a>
              {lead.stage==="appt_set" && (
                <button className="btn-cyan" style={{width:"100%",padding:"9px",fontSize:13,fontWeight:700}} onClick={()=>onStageChange(lead.id,"disposition")}>📋 Disposition Appointment</button>
              )}
              {lead.stage!=="appt_set"&&lead.stage!=="sold"&&<button className="btn-out" style={{width:"100%",padding:"8px",fontSize:12.5}} onClick={()=>onStageChange(lead.id,"sold")}>💰 Mark as Sold</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadModal({ lead, reps, onSave, onClose }) {
  const blank = {firstName:"",lastName:"",phone:"",email:"",address:"",city:"Phoenix",state:"AZ",zip:"",utilityBill:0,roofAge:0,roofType:"Comp Shingle",shade:"Low",homeowner:true,hoa:false,creditScore:"Good",stage:"appt_set",setterId:reps[0]?.id||1,closerId:null,notes:"",source:"door_knock",tags:[],created:new Date().toISOString().slice(0,10),apptDate:"",apptTime:"",installDate:"",closeDate:"",kw:0,salePrice:0,setterCommission:0,closerCommission:0,financing:"loan",lender:"",adders:[],activity:[{type:"created",text:"Lead created",time:new Date().toLocaleString(),by:"Admin"}]};
  const [f,setF] = useState(lead||blank);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const toggleAdder = a => setF(p=>({...p,adders:(p.adders||[]).includes(a)?p.adders.filter(x=>x!==a):[...(p.adders||[]),a]}));
  return (
    <div className="moverlay" onClick={onClose}>
      <div className="mpanel" onClick={e=>e.stopPropagation()} style={{maxWidth:540}}>
        <div style={{fontWeight:700,fontSize:17,color:T.t1,marginBottom:2,letterSpacing:"-0.02em"}}>{lead?.id?"Edit Lead":"New Lead"}</div>
        <div style={{fontSize:12.5,color:T.t3,marginBottom:18}}>Solar lead profile</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:5}}>First Name</div><input className="hinput" value={f.firstName} onChange={e=>set("firstName",e.target.value)} autoFocus/></div>
            <div><div className="caps" style={{marginBottom:5}}>Last Name</div><input className="hinput" value={f.lastName} onChange={e=>set("lastName",e.target.value)}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:5}}>Phone</div><input className="hinput" value={f.phone} onChange={e=>set("phone",e.target.value)} placeholder="(602)555-0000"/></div>
            <div><div className="caps" style={{marginBottom:5}}>Email</div><input className="hinput" value={f.email} onChange={e=>set("email",e.target.value)}/></div>
          </div>
          <div><div className="caps" style={{marginBottom:5}}>Address</div><input className="hinput" value={f.address} onChange={e=>set("address",e.target.value)}/></div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:5}}>City</div><input className="hinput" value={f.city} onChange={e=>set("city",e.target.value)}/></div>
            <div><div className="caps" style={{marginBottom:5}}>State</div><input className="hinput" value={f.state} onChange={e=>set("state",e.target.value)} maxLength={2}/></div>
            <div><div className="caps" style={{marginBottom:5}}>Zip</div><input className="hinput" value={f.zip} onChange={e=>set("zip",e.target.value)}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:5}}>Monthly Bill $</div><input className="hinput" type="number" value={f.utilityBill} onChange={e=>set("utilityBill",Number(e.target.value))}/></div>
            <div><div className="caps" style={{marginBottom:5}}>Roof Age (yrs)</div><input className="hinput" type="number" value={f.roofAge} onChange={e=>set("roofAge",Number(e.target.value))}/></div>
            <div><div className="caps" style={{marginBottom:5}}>Roof Type</div>
              <select className="hinput" value={f.roofType} onChange={e=>set("roofType",e.target.value)} style={{cursor:"pointer"}}>
                {["Comp Shingle","Tile","Flat","Metal","Slate"].map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:5}}>Shade</div>
              <select className="hinput" value={f.shade} onChange={e=>set("shade",e.target.value)} style={{cursor:"pointer"}}>
                {["None","Low","Medium","High"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div><div className="caps" style={{marginBottom:5}}>Credit</div>
              <select className="hinput" value={f.creditScore} onChange={e=>set("creditScore",e.target.value)} style={{cursor:"pointer"}}>
                {["Excellent","Good","Fair","Poor"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div><div className="caps" style={{marginBottom:5}}>Source</div>
              <select className="hinput" value={f.source} onChange={e=>set("source",e.target.value)} style={{cursor:"pointer"}}>
                {LEAD_SOURCES.map(s=><option key={s} value={s}>{srcLabel(s)}</option>)}
              </select>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:5}}>Appt Date</div><input className="hinput" type="date" value={f.apptDate} onChange={e=>set("apptDate",e.target.value)}/></div>
            <div><div className="caps" style={{marginBottom:5}}>Appt Time</div><input className="hinput" type="time" value={f.apptTime} onChange={e=>set("apptTime",e.target.value)}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><div className="caps" style={{marginBottom:5}}>Setter Rep</div>
              <select className="hinput" value={f.setterId||""} onChange={e=>set("setterId",Number(e.target.value))} style={{cursor:"pointer"}}>
                <option value="">None</option>
                {reps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div><div className="caps" style={{marginBottom:5}}>Stage</div>
              <select className="hinput" value={f.stage} onChange={e=>set("stage",e.target.value)} style={{cursor:"pointer"}}>
                {CRM_STAGES.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="caps" style={{marginBottom:6}}>Add-ons</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {SOLAR_ADDERS.map(a=>(
                <button key={a} className={`adder-chip${(f.adders||[]).includes(a)?" on":""}`} onClick={()=>toggleAdder(a)}>
                  {(f.adders||[]).includes(a)&&"✓ "}{a}
                </button>
              ))}
            </div>
          </div>
          <div><div className="caps" style={{marginBottom:5}}>Notes</div><textarea className="hinput" rows={2} value={f.notes} onChange={e=>set("notes",e.target.value)} style={{resize:"vertical",minHeight:52}}/></div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:18}}>
          <button className="btn-cyan" style={{flex:1}} onClick={()=>{if(f.firstName.trim())onSave({...f})}}>{lead?.id?"Save Changes":"Add Lead"}</button>
          <button className="btn-out" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}




/* ═══════════════════════════════════════════════════
   PAYROLL TAB — ADMIN ONLY
═══════════════════════════════════════════════════ */

function PayrollTab({ reps, setReps, allDeals, updateDeal, postedLog, setPostedLog, isMobile, crmLeads=[] }) {
  const [selectedRep,   setSelectedRep]   = useState(null);
  const [activeSection, setActiveSection] = useState("pending");
  const [stubs,         setStubs]         = useState({});
  const [editingComm,   setEditingComm]   = useState({});

  const RANK_COMP = {
    rookie:         { pct:0.25, upfront:500  },
    setter:         { pct:0.30, upfront:500  },
    setter_captain: { pct:0.40, upfront:750  },
    setter_manager: { pct:0.50, upfront:1000 },
  };

  const getComp      = rep => RANK_COMP[getRepRank(rep).id] || RANK_COMP.rookie;
  // Merge allDeals + crmLeads so payroll sees all deals regardless of source
  const getDeals = rep => {
    const fromAllDeals = allDeals[rep.id] || [];
    const fromCRM = crmLeads
      .filter(l => (l.setterId === rep.id || l.closerId === rep.id) && l.salePrice > 0)
      .filter(l => !fromAllDeals.some(d => d.id === l.id || d.crmLeadId === l.id))
      .map(l => ({
        id: l.id,
        customer: `${l.firstName} ${l.lastName}`,
        phone: l.phone||"",
        address: `${l.address}, ${l.city}`,
        kw: l.kw||0,
        price: l.salePrice||0,
        commission: l.setterId===rep.id ? (l.setterCommission||0) : (l.closerCommission||0),
        monthlyBill: l.utilityBill||0,
        status: l.stage,
        closeDate: l.closeDate||"",
        adders: l.adders||[],
        source: "crm",
        crmLeadId: l.id,
      }));
    return [...fromAllDeals, ...fromCRM];
  };
  // Installed deals = eligible for install payout picker
  const getInstalled = rep => getDeals(rep).filter(d => ["installed","install_sched"].includes(d.status));
  // Closed deals eligible for upfront — excludes deals whose upfront already paid
  const getClosed    = rep => {
    const paid = new Set(rep.paidUpfrontIds || []);
    return getDeals(rep).filter(d =>
      ["sold","site_survey","design","engineering","install_sched","installed"].includes(d.status)
      && !paid.has(d.id)
    );
  };

  const initStub = rep => ({
    selectedUpfronts: new Set(),   // deal ids getting upfront this week
    selectedInstalls: new Set(),   // deal ids getting install balance this week
    selectedChargebacks: new Set(),// deal ids being charged back
    note: "",
  });

  const getStub    = rep => stubs[rep.id] || initStub(rep);
  const updateStub = (repId, update) =>
    setStubs(p => ({ ...p, [repId]: { ...(p[repId] || initStub(reps.find(r=>r.id===repId))), ...update } }));

  const toggleSet = (rep, field, dealId) => {
    const stub = getStub(rep);
    const next = new Set(stub[field]);
    next.has(dealId) ? next.delete(dealId) : next.add(dealId);
    updateStub(rep.id, { [field]: next });
  };

  const calcTotals = rep => {
    const stub  = getStub(rep);
    const comp  = getComp(rep);
    const deals = getDeals(rep);
    const upfrontDeals    = deals.filter(d => stub.selectedUpfronts.has(d.id));
    const installDeals    = deals.filter(d => stub.selectedInstalls.has(d.id));
    const chargebackDeals = deals.filter(d => stub.selectedChargebacks.has(d.id));
    const upfrontTotal    = upfrontDeals.length * comp.upfront;
    const installTotal    = installDeals.reduce((s,d) => {
      const editKey = `${rep.id}_${d.id}`;
      const comm    = editKey in editingComm ? editingComm[editKey] : d.commission;
      return s + (comm - comp.upfront);
    }, 0);
    const cbTotal    = chargebackDeals.length * comp.upfront;
    const installNet = Math.max(0, installTotal - cbTotal);
    return {
      upfrontTotal, installTotal, cbTotal, installNet,
      total: upfrontTotal + installNet,
      upfrontDeals, installDeals, chargebackDeals,
    };
  };

  const postStub = rep => {
    const stub  = getStub(rep);
    const comp  = getComp(rep);
    const { upfrontTotal, installNet, cbTotal, total, upfrontDeals, installDeals, chargebackDeals } = calcTotals(rep);
    if (total <= 0) return;

    // Update rep totals + track which deal upfronts have been paid
    setReps(prev => prev.map(r => r.id !== rep.id ? r : {
      ...r,
      commPaid:        (r.commPaid        || 0) + total,
      commPending:     Math.max(0, (r.commPending || 0) - installNet),
      chargebacksTotal:(r.chargebacksTotal || 0) + cbTotal,
      paidUpfrontIds:  [...(r.paidUpfrontIds || []), ...upfrontDeals.map(d=>d.id)],
    }));

    // Add to shared posted log — rep sees this in Income tab
    setPostedLog(prev => [{
      id:         Date.now(),
      repId:      rep.id,
      repName:    rep.name,
      upfront:    upfrontTotal,
      upfronts:   upfrontDeals.map(d => ({ id:d.id, customer:d.customer, amt:comp.upfront })),
      installs:   installDeals.map(d => {
        const editKey = `${rep.id}_${d.id}`;
        const comm    = editKey in editingComm ? editingComm[editKey] : d.commission;
        return { id:d.id, customer:d.customer, comm:comm-comp.upfront };
      }),
      chargebacks: chargebackDeals.map(d => ({ id:d.id, customer:d.customer, amt:comp.upfront })),
      cbTotal,
      total,
      note:       stub.note,
      postedAt:   new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}),
    }, ...prev]);

    // Reset stub
    setStubs(p => ({ ...p, [rep.id]: initStub(rep) }));
    setSelectedRep(null);
  };

  const fmtUSD  = n => `$${Number(n||0).toLocaleString()}`;
  const inputSt = {
    background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:8,padding:"8px 12px",color:T.t1,fontSize:13,
    fontFamily:"'Inter',system-ui,sans-serif",outline:"none",width:"100%",
  };
  const monoSt = {...inputSt, fontFamily:"'JetBrains Mono',monospace", fontWeight:600};

  // Reusable deal picker section
  const DealPicker = ({ rep, field, deals, label, emptyMsg, showCommEdit }) => {
    const stub = getStub(rep);
    const comp = getComp(rep);
    return (
      <div>
        <div className="caps" style={{fontSize:8.5,color:T.t3,marginBottom:8}}>{label}</div>
        {deals.length === 0 ? (
          <div style={{fontSize:12,color:T.t3,fontStyle:"italic",padding:"6px 0"}}>{emptyMsg}</div>
        ) : deals.map(deal => {
          const isSel    = stub[field].has(deal.id);
          const editKey  = `${rep.id}_${deal.id}`;
          const isEditC  = editKey in editingComm;
          const dispComm = isEditC ? editingComm[editKey] : deal.commission;
          const instPay  = dispComm - comp.upfront;
          return (
            <div key={deal.id} style={{
              borderRadius:10,marginBottom:6,overflow:"hidden",
              background:isSel?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.03)",
              border:`1px solid ${isSel?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.06)"}`,
            }}>
              <div onClick={()=>toggleSet(rep,field,deal.id)}
                style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",cursor:"pointer"}}>
                <div style={{
                  width:18,height:18,borderRadius:5,flexShrink:0,
                  background:isSel?"rgba(255,255,255,0.15)":"transparent",
                  border:`1.5px solid ${isSel?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.2)"}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>
                  {isSel && <span style={{fontSize:11,color:T.t1,lineHeight:1}}>✓</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:500,color:T.t1}}>{deal.customer}</div>
                  <div style={{fontSize:10.5,color:T.t3,marginTop:1}}>
                    {fmtUSD(deal.price)} · {deal.kw}kW
                    {deal.adders?.length>0 && <span style={{marginLeft:4}}>· {deal.adders.join(", ")}</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  {showCommEdit
                    ? <div className="mono" style={{fontSize:13,fontWeight:600,color:T.t1}}>{fmtUSD(Math.max(0,instPay))}</div>
                    : <div className="mono" style={{fontSize:13,fontWeight:600,color:T.t1}}>{fmtUSD(comp.upfront)}</div>
                  }
                </div>
              </div>
              {showCommEdit && (
                <div style={{
                  display:"flex",alignItems:"center",gap:10,padding:"7px 14px",
                  borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(0,0,0,0.12)",
                }} onClick={e=>e.stopPropagation()}>
                  <span style={{fontSize:11,color:T.t3,flexShrink:0}}>Total comm</span>
                  <div style={{display:"flex",alignItems:"center",gap:4,flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"4px 8px"}}>
                    <span style={{fontSize:12,color:T.t3}}>$</span>
                    <input type="number" value={dispComm}
                      onChange={e=>setEditingComm(p=>({...p,[editKey]:Number(e.target.value)}))}
                      onBlur={e=>{
                        updateDeal(rep.id, deal.id, {commission:Number(e.target.value)});
                        setEditingComm(p=>{const n={...p};delete n[editKey];return n;});
                      }}
                      style={{background:"transparent",border:"none",outline:"none",color:T.t1,
                        fontSize:12,fontWeight:600,width:"100%",fontFamily:"'JetBrains Mono',monospace"}}
                    />
                  </div>
                  <span style={{fontSize:11,color:T.t3,flexShrink:0}}>→ {fmtUSD(Math.max(0,instPay))} out</span>
                  {isEditC && <span style={{fontSize:10,color:T.amber,flexShrink:0}}>unsaved</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="afu" style={{opacity:0}}>

      {/* Section toggle */}
      <div style={{display:"flex",gap:6,marginBottom:24}}>
        {[{k:"pending",l:"Pending Paystubs"},{k:"history",l:"Payment History"}].map(({k,l})=>(
          <button key={k} onClick={()=>setActiveSection(k)} style={{
            padding:"7px 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",
            fontFamily:"'Inter',system-ui,sans-serif",
            background:activeSection===k?"rgba(255,255,255,0.1)":"transparent",
            border:`1px solid ${activeSection===k?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.08)"}`,
            color:activeSection===k?T.t1:T.t3,
          }}>{l}</button>
        ))}
      </div>

      {/* ── PENDING ── */}
      {activeSection === "pending" && reps.map(rep => {
        const comp      = getComp(rep);
        const rank      = getRepRank(rep);
        const stub      = getStub(rep);
        const closed    = getClosed(rep);
        const installed = getInstalled(rep);
        const isExp     = selectedRep === rep.id;
        const { upfrontTotal, installTotal, cbTotal, installNet, total, upfrontDeals, installDeals, chargebackDeals } = calcTotals(rep);

        return (
          <div key={rep.id} style={{
            background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:14,overflow:"hidden",marginBottom:10,
          }}>
            {/* Header */}
            <div onClick={()=>setSelectedRep(isExp?null:rep.id)}
              style={{display:"flex",alignItems:"center",gap:14,padding:"16px 20px",cursor:"pointer"}}>
              <Avatar name={rep.name} size={36}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:T.t1}}>{rep.name}</div>
                <div style={{fontSize:11,color:T.t3,marginTop:1}}>
                  {rank.title} · {(comp.pct*100).toFixed(0)}% · ${comp.upfront.toLocaleString()} upfront
                  {closed.length>0 && <span style={{color:T.t2,marginLeft:8}}>· {closed.length} closed deal{closed.length!==1?"s":""}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:20,alignItems:"center",flexShrink:0}}>
                <div style={{textAlign:"right"}}>
                  <div className="caps" style={{fontSize:8,color:T.t3,marginBottom:2}}>Paid Out</div>
                  <div className="mono" style={{fontSize:14,fontWeight:700,color:T.t1}}>{fmtUSD(rep.commPaid||0)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="caps" style={{fontSize:8,color:T.t3,marginBottom:2}}>Pending</div>
                  <div className="mono" style={{fontSize:14,fontWeight:700,color:T.t2}}>{fmtUSD(rep.commPending||0)}</div>
                </div>
                <div style={{color:T.t3,fontSize:16,transform:isExp?"rotate(90deg)":"none",transition:"transform 0.2s"}}>›</div>
              </div>
            </div>

            {/* Editor */}
            {isExp && (
              <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",padding:"20px"}}>
                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:20}}>

                  {/* LEFT */}
                  <div style={{display:"flex",flexDirection:"column",gap:18}}>

                    {/* Upfront picker */}
                    <DealPicker
                      rep={rep} field="selectedUpfronts" deals={closed}
                      label="Upfront Payout — Select Deals Closing This Week"
                      emptyMsg="No closed deals for this rep"
                      showCommEdit={false}
                    />

                    {/* Install picker */}
                    <DealPicker
                      rep={rep} field="selectedInstalls" deals={installed}
                      label="Install Payout — Select Deals Installing This Week"
                      emptyMsg="No installed deals for this rep"
                      showCommEdit={true}
                    />

                    {/* Chargeback picker */}
                    <div>
                      <div className="caps" style={{fontSize:8.5,color:T.t3,marginBottom:8}}>Chargebacks — Select Cancelled Deals</div>
                      {closed.length === 0 ? (
                        <div style={{fontSize:12,color:T.t3,fontStyle:"italic",padding:"6px 0"}}>No deals to charge back</div>
                      ) : closed.map(deal => {
                        const isSel = stub.selectedChargebacks.has(deal.id);
                        return (
                          <div key={deal.id} onClick={()=>toggleSet(rep,"selectedChargebacks",deal.id)}
                            style={{
                              display:"flex",alignItems:"center",gap:12,padding:"10px 14px",
                              borderRadius:10,marginBottom:5,cursor:"pointer",
                              background:isSel?"rgba(255,69,58,0.1)":"rgba(255,255,255,0.03)",
                              border:`1px solid ${isSel?"rgba(255,69,58,0.35)":"rgba(255,255,255,0.06)"}`,
                            }}>
                            <div style={{
                              width:18,height:18,borderRadius:5,flexShrink:0,
                              background:isSel?"rgba(255,69,58,0.2)":"transparent",
                              border:`1.5px solid ${isSel?"rgba(255,69,58,0.8)":"rgba(255,255,255,0.2)"}`,
                              display:"flex",alignItems:"center",justifyContent:"center",
                            }}>
                              {isSel && <span style={{fontSize:11,color:T.red,lineHeight:1}}>✓</span>}
                            </div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:500,color:isSel?T.red:T.t1}}>{deal.customer}</div>
                              <div style={{fontSize:10.5,color:T.t3,marginTop:1}}>{fmtUSD(deal.price)} · upfront will be recouped</div>
                            </div>
                            <div className="mono" style={{fontSize:13,fontWeight:600,color:T.red}}>-{fmtUSD(comp.upfront)}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Note */}
                    <div>
                      <div className="caps" style={{fontSize:8.5,color:T.t3,marginBottom:6}}>Internal Note</div>
                      <textarea value={stub.note||""} onChange={e=>updateStub(rep.id,{note:e.target.value})}
                        placeholder="Optional note…" rows={2}
                        style={{...inputSt,resize:"vertical",lineHeight:1.5}}/>
                    </div>
                  </div>

                  {/* RIGHT — live summary */}
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden"}}>
                      <div style={{padding:"13px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                        <div style={{fontSize:13,fontWeight:600,color:T.t1}}>Paystub Summary</div>
                      </div>
                      {[
                        {label:`Upfront Payout (${upfrontDeals.length} deal${upfrontDeals.length!==1?"s":""})`, val:fmtUSD(upfrontTotal)},
                        {label:`Install Payout (${installDeals.length} deal${installDeals.length!==1?"s":""})`,  val:fmtUSD(installTotal)},
                        ...(cbTotal>0?[{label:`Chargebacks (${chargebackDeals.length})`, val:`-${fmtUSD(cbTotal)}`, red:true}]:[]),
                        ...(cbTotal>0?[{label:"Net Install",  val:fmtUSD(installNet)}]:[]),
                      ].map(({label,val,red})=>(
                        <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                          <span style={{fontSize:12,color:T.t2}}>{label}</span>
                          <span className="mono" style={{fontSize:13,fontWeight:600,color:red?T.red:T.t1}}>{val}</span>
                        </div>
                      ))}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"15px 16px",background:"rgba(255,255,255,0.03)"}}>
                        <span style={{fontSize:14,fontWeight:700,color:T.t1}}>Total Payout</span>
                        <span className="mono" style={{fontSize:22,fontWeight:800,color:T.t1}}>{fmtUSD(total)}</span>
                      </div>
                    </div>

                    {/* Selected upfronts */}
                    {upfrontDeals.length > 0 && (
                      <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 14px"}}>
                        <div className="caps" style={{fontSize:8.5,color:T.t3,marginBottom:7}}>Upfronts This Paystub</div>
                        {upfrontDeals.map(d=>(
                          <div key={d.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0"}}>
                            <span style={{color:T.t2}}>{d.customer}</span>
                            <span className="mono" style={{color:T.t1}}>{fmtUSD(comp.upfront)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected installs */}
                    {installDeals.length > 0 && (
                      <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:10,padding:"12px 14px"}}>
                        <div className="caps" style={{fontSize:8.5,color:T.t3,marginBottom:7}}>Installs This Paystub</div>
                        {installDeals.map(d=>{
                          const editKey = `${rep.id}_${d.id}`;
                          const comm = editKey in editingComm ? editingComm[editKey] : d.commission;
                          return (
                            <div key={d.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0"}}>
                              <span style={{color:T.t2}}>{d.customer}</span>
                              <span className="mono" style={{color:T.t1}}>{fmtUSD(comm-comp.upfront)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Post button */}
                    <button onClick={()=>postStub(rep)} style={{
                      padding:"12px",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",
                      background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",
                      color:T.t1,fontFamily:"'Inter',system-ui,sans-serif",marginTop:"auto",
                      opacity:total>0?1:0.4,pointerEvents:total>0?"auto":"none",
                    }}>Post Paystub — {fmtUSD(total)}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ── HISTORY ── */}
      {activeSection === "history" && (
        <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,overflow:"hidden"}}>
          {postedLog.length === 0 ? (
            <div style={{padding:"48px",textAlign:"center"}}>
              <div style={{fontSize:13,color:T.t3}}>No payments posted yet</div>
            </div>
          ) : (
            <>
              <div style={{display:"grid",gridTemplateColumns:"1.4fr 80px 80px 80px 100px 90px",padding:"10px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                {["Rep","Upfront","Install","Chargeback","Total","Date"].map((h,i)=>(
                  <div key={h} className="caps" style={{fontSize:8.5,color:T.t3,textAlign:i>0?"right":"left"}}>{h}</div>
                ))}
              </div>
              {postedLog.map(entry => {
                const installPaid = entry.installs.reduce((s,d)=>s+d.comm,0);
                return (
                  <div key={entry.id}>
                    <div style={{display:"grid",gridTemplateColumns:"1.4fr 80px 80px 80px 100px 90px",padding:"13px 20px",borderBottom:"1px solid rgba(255,255,255,0.04)",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:T.t1}}>{entry.repName}</div>
                        {entry.note && <div style={{fontSize:10.5,color:T.t3,marginTop:1}}>{entry.note}</div>}
                      </div>
                      <div className="mono" style={{fontSize:12,color:T.t2,textAlign:"right"}}>{fmtUSD(entry.upfront)}</div>
                      <div className="mono" style={{fontSize:12,color:T.t2,textAlign:"right"}}>{fmtUSD(installPaid)}</div>
                      <div className="mono" style={{fontSize:12,color:entry.cbTotal>0?T.red:T.t3,textAlign:"right"}}>{entry.cbTotal>0?`-${fmtUSD(entry.cbTotal)}`:"—"}</div>
                      <div className="mono" style={{fontSize:13,fontWeight:700,color:T.t1,textAlign:"right"}}>{fmtUSD(entry.total)}</div>
                      <div style={{fontSize:11,color:T.t3,textAlign:"right"}}>{entry.postedAt}</div>
                    </div>
                    {(entry.upfronts?.length>0||entry.installs?.length>0||entry.chargebacks?.length>0) && (
                      <div style={{padding:"0 20px 10px 36px",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                        {entry.upfronts?.map((d,i)=>(
                          <div key={`u${i}`} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,padding:"1px 0"}}>
                            <span>↑ {d.customer} (upfront)</span>
                            <span className="mono">{fmtUSD(d.amt)}</span>
                          </div>
                        ))}
                        {entry.installs?.map((d,i)=>(
                          <div key={`i${i}`} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.t3,padding:"1px 0"}}>
                            <span>✓ {d.customer} (install balance)</span>
                            <span className="mono">{fmtUSD(d.comm)}</span>
                          </div>
                        ))}
                        {entry.chargebacks?.map((d,i)=>(
                          <div key={`c${i}`} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.red,padding:"1px 0"}}>
                            <span>↩ {d.customer} (chargeback)</span>
                            <span className="mono">-{fmtUSD(d.amt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{display:"grid",gridTemplateColumns:"1.4fr 80px 80px 80px 100px 90px",padding:"13px 20px",background:"rgba(255,255,255,0.03)",borderTop:"1px solid rgba(255,255,255,0.08)",alignItems:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:T.t1}}>All Time</div>
                <div className="mono" style={{fontSize:12,fontWeight:700,color:T.t1,textAlign:"right"}}>{fmtUSD(postedLog.reduce((s,e)=>s+e.upfront,0))}</div>
                <div className="mono" style={{fontSize:12,fontWeight:700,color:T.t1,textAlign:"right"}}>{fmtUSD(postedLog.reduce((s,e)=>s+e.installs.reduce((ss,d)=>ss+d.comm,0),0))}</div>
                <div className="mono" style={{fontSize:12,fontWeight:700,color:T.red,textAlign:"right"}}>{postedLog.some(e=>e.cbTotal>0)?`-${fmtUSD(postedLog.reduce((s,e)=>s+e.cbTotal,0))}`:"—"}</div>
                <div className="mono" style={{fontSize:14,fontWeight:800,color:T.t1,textAlign:"right"}}>{fmtUSD(postedLog.reduce((s,e)=>s+e.total,0))}</div>
                <div/>
              </div>
            </>
          )}
        </div>
      )}

      <div style={{fontSize:11,color:T.t3,lineHeight:1.8,borderTop:"1px solid rgba(255,255,255,0.04)",paddingTop:14,marginTop:20}}>
        Select deals from the CRM for upfronts, installs, and chargebacks. Edit commission amounts inline — changes sync to the rep's CRM view. Once posted, the rep sees the paystub immediately in their Income tab.
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   LEADERBOARD VIEW
═══════════════════════════════════════════════════ */

function Leaderboard({ user, reps, setReps, dialerLeads, setDialerLeads, campaigns, setCampaigns, postedLog, setPostedLog, allDeals, setAllDeals, onLogout, onResetData }) {
  const [crmLeadsRaw,     setCrmLeadsRaw]     = useState(() => load("apex_crm_leads", CRM_LEADS_INIT));
  const setCrmLeads = v => setCrmLeadsRaw(prev => { const next = typeof v==="function"?v(prev):v; save("apex_crm_leads", next); return next; });
  const crmLeads = crmLeadsRaw;
  const [repCallLogs,     setRepCallLogsRaw]     = useState(() => load("apex_call_logs", {}));
  const [repDialerStatus, setRepDialerStatus] = useState({});
  const setRepCallLogs = v => setRepCallLogsRaw(prev => { const next = typeof v==="function"?v(prev):v; save("apex_call_logs", next); return next; });
  const [activeTab,setActiveTab]= useState("board");
  const [metric,  setMetric]  = useState("appts");
  const [incentiveData, setIncentiveData] = useState(() => load("apex_incentives", INCENTIVES_DATA));
  const saveIncentives = v => { const next = typeof v==="function"?v(incentiveData):v; save("apex_incentives",next); setIncentiveData(next); };
  const [period,  setPeriod]  = useState("Month");
  const [search,  setSearch]  = useState("");
  const [modal,   setModal]   = useState(null);
  const [editRep, setEditRep] = useState(null);
  const [toast,   setToast]   = useState(null);
  const width    = useWidth();
  const isMobile = width < 768;
  const isAdmin  = user.isAdmin;

  const notify    = msg => setToast(msg);
  const addRep    = rep  => { setReps(p=>[...p,rep]); notify(`${rep.name} added`); };
  const updateRep = rep  => { setReps(p=>p.map(r=>r.id===rep.id?rep:r)); notify("Stats updated"); };
  const deleteRep = id   => { setReps(p=>p.filter(r=>r.id!==id)); notify("Rep removed"); };
  const openEdit  = rep  => { setEditRep(rep); setModal("edit"); };

  // Updates a single deal's fields everywhere (payroll + CRM/My Deals)
  const updateDeal = (repId, dealId, changes) =>
    setAllDeals(p => ({
      ...p,
      [repId]: (p[repId]||[]).map(d => d.id===dealId ? {...d,...changes} : d),
    }));

  // ── Period scaling ──
  // appts/shows are manually tracked monthly totals — scale them by period.
  // sales/revenue/kw are now filtered by closeDate inside deriveRepStats — no scaling needed.
  const periodMult = period==="Day" ? (1/30) : period==="Week" ? 0.25 : period==="Year" ? 12 : 1;
  const scaleRep = r => ({
    ...r,
    appts:   Math.round(r.appts * periodMult),
    shows:   Math.round(r.shows * periodMult),
  });

  // ── Single source of truth ──
  // liveReps = rep base data merged with stats derived live from allDeals.
  // Every component that displays rep metrics receives liveReps, never raw reps.
  const baseReps  = reps.map(r => deriveRepStats(r, allDeals, period.toLowerCase())); // unscaled — for promotion, rank, income
  const liveReps  = baseReps.map(r => ({
    ...scaleRep(r),
    _appts: r.appts,  // unscaled — rank always derived from monthly actuals
    _shows: r.shows,
  }));

  const ranked   = sortBy(liveReps, metric);
  const filtered = ranked.filter(r=>r.name.toLowerCase().includes(search.toLowerCase()));
  const maxVal   = ranked.length ? mval(ranked[0],metric) : 1;
  const m        = METRICS.find(x=>x.key===metric);

  const totalRev   = liveReps.reduce((s,r)=>s+r.revenue,0);
  const totalAppts = liveReps.reduce((s,r)=>s+r.appts,0);
  const totalShows = liveReps.reduce((s,r)=>s+r.shows,0);
  const teamSR     = totalAppts ? Math.round((totalShows/totalAppts)*100) : 0;
  const srCol      = teamSR>=35?T.green:teamSR>=25?T.amber:T.red;

  return (
    <div style={{ background:T.bg0, minHeight:"100vh" }}>
      {/* noise + glow */}



      <div style={{position:"relative",zIndex:1}}>
        {/* ── HEADER ── */}
        <header style={{
          background:"rgba(8,12,20,0.82)",
          borderBottom:`1px solid rgba(255,255,255,0.07)`,
          padding:isMobile?"14px 18px":"16px 36px",
          position:"sticky",top:0,zIndex:100,
          backdropFilter:"blur(40px) saturate(1.6)",WebkitBackdropFilter:"blur(40px) saturate(1.6)",
          boxShadow:"0 1px 0 rgba(255,255,255,0.05) inset",
        }}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            {/* brand */}
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <div style={{display:"flex",alignItems:"center",gap:9}}>
                <img src={APEX_LOGO_URL} alt="Apex Academy" style={{height:isMobile?28:36,width:"auto",filter:"drop-shadow(0 0 8px rgba(255,255,255,0.15))"}}/>
              </div>
            </div>

            {/* team pulse — desktop only */}
            {!isMobile && (
              <div style={{display:"flex",gap:2}}>
                {[
                  {label:"Revenue",val:fmtNumShort(totalRev),col:T.green},
                  {label:"Appts",val:totalAppts,col:T.cyan},
                  {label:"Show Rate",val:`${teamSR}%`,col:srCol},
                ].map(({label,val,col},i)=>(
                  <div key={label} style={{
                    padding:"0 20px",textAlign:"center",minWidth:110,height:52,
                    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    background:"rgba(255,255,255,0.05)",border:`1px solid rgba(255,255,255,0.09)`,
                    backdropFilter:"blur(20px)",
                    borderLeft:i>0?"none":undefined,
                    borderRadius:i===0?"10px 0 0 10px":i===2?"0 10px 10px 0":"0",
                    boxShadow:"0 1px 0 rgba(255,255,255,0.08) inset",
                  }}>
                    <div className="caps" style={{marginBottom:4,whiteSpace:"nowrap"}}>{label}</div>
                    <div className="mono" style={{fontSize:16,fontWeight:700,color:col,lineHeight:1}}>{val}</div>
                  </div>
                ))}
              </div>
            )}

            {/* right controls */}
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              {!isMobile && (
                <div className="pgroup">
                  {["Day","Week","Month","Year"].map(p=>(
                    <button key={p} className={`pbtn${period===p?" on":""}`} onClick={()=>setPeriod(p)}>{p}</button>
                  ))}
                </div>
              )}
              {isAdmin && (
                <button className="btn-cyan" style={{fontSize:12,padding:"7px 14px",width:"auto"}} onClick={()=>setModal("add")}>+ Add Rep</button>
              )}
              {isAdmin && (
                <button title="Wall Mode — fullscreen leaderboard for office TV" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:T.rad,padding:"7px 10px",cursor:"pointer",fontSize:14,color:T.t3,transition:"all 0.18s",fontFamily:"'Inter',system-ui,sans-serif"}}
                  aria-label="Toggle wall mode"
                  onClick={()=>{
                    const el = document.documentElement;
                    if (!document.fullscreenElement) { el.requestFullscreen?.(); }
                    else { document.exitFullscreen?.(); }
                    setActiveTab("board");
                  }}>⛶</button>
              )}
              <button style={{
                display:"flex",alignItems:"center",gap:8,
                background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:T.rad,
                padding:"7px 12px",cursor:"pointer",transition:"all 0.18s",
                fontFamily:"'Inter',system-ui,sans-serif",
              }} onClick={onLogout}>
                {!isAdmin && <Avatar name={user.name} size={24}/>}
                <span style={{fontSize:12.5,color:T.t2,fontWeight:500}}>
                  {isAdmin?"Admin":user.name.split(" ")[0]}
                </span>
                <span style={{fontSize:11,color:T.t3}}>·</span>
                <span style={{fontSize:11,color:T.t3}}>Sign out</span>
              </button>
            </div>
          </div>

          {/* mobile — team stats strip */}
          {isMobile && (
            <div style={{display:"flex",gap:6,marginTop:12,overflowX:"auto"}}>
              {[
                {label:"Revenue",val:fmtNumShort(totalRev),col:T.green},
                {label:"Appts",val:totalAppts,col:T.cyan},
                {label:"Show Rate",val:`${teamSR}%`,col:srCol},
              ].map(({label,val,col})=>(
                <div key={label} style={{
                  padding:"0 14px",height:44,display:"flex",flexDirection:"column",
                  alignItems:"center",justifyContent:"center",
                  background:"rgba(255,255,255,0.05)",border:`1px solid rgba(255,255,255,0.09)`,
                  backdropFilter:"blur(20px)",
                  borderRadius:10,textAlign:"center",flexShrink:0,
                  boxShadow:"0 1px 0 rgba(255,255,255,0.08) inset",
                }}>
                  <div className="caps" style={{fontSize:8.5,marginBottom:2,whiteSpace:"nowrap"}}>{label}</div>
                  <div className="mono" style={{fontSize:14,fontWeight:700,color:col,lineHeight:1}}>{val}</div>
                </div>
              ))}
              <div style={{flexGrow:1}}/>
              <div className="pgroup" style={{flexShrink:0}}>
                {["D","W","M","Y"].map((p,i)=>{
                  const full=["Day","Week","Month","Year"][i];
                  return <button key={p} className={`pbtn${period===full?" on":""}`} style={{padding:"4px 10px",fontSize:11}} onClick={()=>setPeriod(full)}>{p}</button>;
                })}
              </div>
            </div>
          )}

          {/* tab nav */}
          {(()=>{
            const myDeals = allDeals[user?.id]||[];
            const myAppts = myDeals.filter(d=>!["sold","site_survey","design","engineering","install_sched","installed","pto","cancelled","dq"].includes(d.status)).length;
            const crmOverdue = crmLeads.filter(l=>l.followUpDate&&l.followUpDate<new Date().toISOString().slice(0,10)&&!["installed","pto","cancelled","dq"].includes(l.stage)).length;
            const tabs = isAdmin
              ? [{key:"dialer",label:"⚡ Dialer"},{key:"board",label:"Dashboard"},{key:"crm",label:`CRM${crmOverdue>0?" ("+crmOverdue+")":""}`},{key:"payroll",label:"Payroll"},{key:"incentives_admin",label:"🏆 Contests"}]
              : [{key:"dialer",label:"⚡ Dialer"},{key:"board",label:"Dashboard"},{key:"deals",label:`My Deals${myAppts>0?" ("+myAppts+")":""}`},{key:"incentives",label:"Incentives"},{key:"promotion",label:"Promotion"},{key:"income",label:"Income"}];
            return (
              <div style={{display:"flex",gap:6,padding:"10px 0 0",overflowX:"auto"}}>
                {tabs.map(({key,label})=>(
                  <button key={key} className={`tab-nav-btn${activeTab===key?" on":""}`}
                    style={{fontSize:isMobile?12:13,padding:isMobile?"7px 14px":"8px 18px",color:(key==="crm"&&crmOverdue>0&&activeTab!==key)?T.red:undefined}}
                    onClick={()=>setActiveTab(key)}>{label}</button>
                ))}
              </div>
            );
          })()}
        </header>

        {/* ── BODY ── */}
        <main style={{maxWidth:["crm","dialer","payroll"].includes(activeTab)?1400:1100,margin:"0 auto",padding:isMobile?"20px 16px":"32px 28px"}}>

          {/* ── TAB CONTENT ── */}
          {(activeTab==="board") && (
            <>
              {/* Rep personal stats banner — only shown to reps, not admin */}
              {!isAdmin && (() => {
                 const me = liveReps.find(r=>r.id===user.id);
                 const meBase = baseReps.find(r=>r.id===user.id) || me;
                 if(!me) return null;
                 const mySR = me.appts ? Math.round((me.shows/me.appts)*100) : 0;
                 const srC  = mySR>=35?T.green:mySR>=25?T.amber:T.red;
                 // Thresholds scale with period (appts/shows already scaled in liveReps)
                 const apptTargets = period==="Day"  ? {green:3,amber:1}
                   : period==="Week" ? {green:15,amber:10}
                   : period==="Year" ? {green:480,amber:300} /* 40/mo × 12 */ : {green:40,amber:25};
                 const apptC = me.appts>=apptTargets.green?T.green:me.appts>=apptTargets.amber?T.amber:T.red;
                 const periodLabel = period==="Day"?"Today":period==="Week"?"This Week":period==="Year"?"This Year":"This Month";
                 return (
                  <div style={{marginBottom:24}}>
                    <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(3,1fr)",gap:10,marginBottom:12}}>
                    {[
                      {label:`Revenue (${periodLabel})`, val:fmtNum(me.revenue), color:T.green},
                      {label:`Appointments (${periodLabel})`,val:me.appts,                        color:apptC},
                      {label:"My Show Rate",               val:`${mySR}%`,                        color:srC},
                    ].map(({label,val,color})=>(
                      <div key={label} style={{
                        background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.09)`,
                        backdropFilter:"blur(32px)",
                        borderRadius:16,padding:"0 20px",
                        position:"relative",overflow:"hidden",
                        display:"flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"center",
                        height:80,
                        boxShadow:"0 1px 0 rgba(255,255,255,0.08) inset",
                      }}>
                        <div style={{position:"absolute",top:0,left:0,right:0,height:1,
                          background:`linear-gradient(90deg,transparent,${color}60,transparent)`}}/>
                        <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 80% 60% at 50% 0%,${color}08,transparent)`,pointerEvents:"none"}}/>
                        <div className="caps" style={{fontSize:9,marginBottom:8,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",position:"relative"}}>{label}</div>
                        <div className="mono" style={{fontSize:isMobile?22:26,fontWeight:800,color,lineHeight:1,position:"relative"}}>{val}</div>
                      </div>
                    ))}
                    </div>
                    <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"14px 20px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <div className="caps" style={{fontSize:9,color:T.t3}}>Promotion Ladder</div>
                        <div style={{fontSize:11,color:getRepRank(meBase).color,fontWeight:600}}>{getRepRank(meBase).title}</div>
                      </div>
                      <RankProgressBar rep={meBase}/>
                    </div>
                  </div>
                );
              })()}

              {/* metric selector */}
              <MetricSelector active={metric} onChange={setMetric} isMobile={isMobile}/>

              {/* podium */}
              {ranked.length>=2 && <Podium reps={liveReps} metric={metric} isMobile={isMobile}/>}

              {/* search + count */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:isMobile?14:18,gap:10,flexWrap:"wrap"}}>
                <div style={{fontSize:13,color:T.t2}}>
                  <span style={{fontWeight:600,color:T.t1}}>{filtered.length} reps</span>
                  {" "}— ranked by <span style={{color:m.color,fontWeight:600}}>{m.label}</span>
                </div>
                <div className="swrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.t3} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input className="sinput" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{width:isMobile?"100%":220}}/>
                </div>
              </div>

              {/* rep cards */}
              <div style={{display:"flex",flexDirection:"column",gap:isMobile?10:12}}>
                {filtered.map((rep,i)=>{
                  const trueRank=ranked.findIndex(r=>r.id===rep.id);
                  const isMe = !isAdmin && user.id===rep.id;
                  return (
                    <RepCard key={rep.id}
                      rep={rep} rank={trueRank} metric={metric} maxVal={maxVal}
                      adminMode={isAdmin} onEdit={openEdit} onDelete={deleteRep}
                      delay={i*48} isMobile={isMobile} isMe={isMe}
                    />
                  );
                })}
                {filtered.length===0 && (
                  <div style={{textAlign:"center",padding:"60px 0",color:T.t3}}>
                    <div style={{fontSize:28,marginBottom:10,opacity:0.4}}>◎</div>
                    <div style={{fontWeight:600,fontSize:14,color:T.t2,marginBottom:4}}>No results</div>
                    <div style={{fontSize:13}}>Try a different name</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* MY DEALS TAB */}
          {!isAdmin && activeTab==="deals" && (
            <MyDeals user={user} isMobile={isMobile} deals={allDeals[user.id]||[]} setDeals={deals=>setAllDeals(p=>({...p,[user.id]:deals}))}/>
          )}

          {/* INCENTIVES TAB */}
          {!isAdmin && activeTab==="incentives" && (
            <Incentives user={user} reps={liveReps} isMobile={isMobile} incentives={incentiveData}/>
          )}

          {/* PROMOTION TAB */}
          {!isAdmin && activeTab==="promotion" && (
            <PromotionTab user={user} reps={baseReps} isMobile={isMobile}/>
          )}

          {/* INCOME TAB */}
          {!isAdmin && activeTab==="income" && (
            <IncomeTab user={user} reps={baseReps} setReps={setReps} postedLog={postedLog} isMobile={isMobile}/>
          )}

          {/* CONTESTS / INCENTIVES ADMIN TAB */}
          {isAdmin && activeTab==="incentives_admin" && (
            <IncentivesAdmin incentives={incentiveData} onSave={saveIncentives} isMobile={isMobile}/>
          )}

          {/* PAYROLL TAB — admin only */}
          {isAdmin && activeTab==="payroll" && (
            <PayrollTab reps={liveReps} setReps={setReps} allDeals={allDeals} updateDeal={updateDeal} postedLog={postedLog} setPostedLog={setPostedLog} isMobile={isMobile} crmLeads={crmLeads}/>
          )}

          {/* CRM TAB — admin only */}
          {isAdmin && activeTab==="crm" && (
            <CRMTab reps={reps} setReps={setReps} isMobile={isMobile} crmLeads={crmLeads} setCrmLeads={setCrmLeads} allDeals={allDeals} setAllDeals={setAllDeals} user={user}/>
          )}

          {/* DIALER TAB — admin + reps */}
          {activeTab==="dialer" && (
            <SharedDialer
              campaigns={campaigns} setCampaigns={setCampaigns}
              dialerLeads={dialerLeads} setDialerLeads={setDialerLeads}
              user={user} reps={reps} setReps={setReps} isMobile={isMobile}
              setCrmLeads={setCrmLeads} crmLeads={crmLeads}
              allDeals={allDeals} setAllDeals={setAllDeals}
              repCallLogs={repCallLogs} setRepCallLogs={setRepCallLogs}
              repDialerStatus={repDialerStatus} setRepDialerStatus={setRepDialerStatus}
            />
          )}

          {/* footer */}
          <div style={{
            marginTop:48,paddingTop:20,borderTop:`1px solid rgba(255,255,255,0.04)`,
            display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,
            fontSize:12,color:T.t3,
          }}>
            <span>Apex Sales</span>
            <span className="mono">{new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</span>
          </div>
        </main>
      </div>

      {/* modals */}
      {modal==="add"  && <RepModal title="Add Rep" sub="Add a new rep to the leaderboard" onSave={addRep} onClose={()=>setModal(null)}/>}
      {modal==="edit" && editRep && <RepModal title={`Edit — ${editRep.name}`} sub="Update this rep's stats" initial={editRep} onSave={updateRep} onClose={()=>{setModal(null);setEditRep(null);}}/>}
      {toast && <Toast msg={toast} onClose={()=>setToast(null)}/>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROOT
═══════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
   SHARED DIALER STATE — lives at App root, passed down as props
   Architecture:
   • dialerLeads  : master list (CSV uploads + sample data)
   • lockedLeadId : the lead currently being called by ANY rep
   •               prevents two reps from claiming same lead
   • callbacks    : leads parked for a scheduled callback
   • ownedLeads   : leads assigned to a specific rep after appointment
══════════════════════════════════════════════════════════════════ */

/* ── Shared dialer utils ── */
const parseCSV = text => {
  const lines = text.trim().split('\n');
  const hdr   = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/\s+/g,'_'));
  return lines.slice(1).filter(l=>l.trim()).map((row,i)=>{
    const cols = row.split(',').map(c=>c.trim().replace(/^"|"$/g,''));
    const obj  = {};
    hdr.forEach((h,j)=>{ obj[h]=cols[j]||''; });
    // Normalise to our schema
    return {
      id: `CSV${Date.now()}_${i}`,
      name:     obj.name  || `${obj.first_name||''} ${obj.last_name||''}`.trim() || 'Unknown',
      phone:    obj.phone || obj.phone_number || '',
      address:  obj.address || `${obj.street||''} ${obj.city||''} ${obj.state||''}`.trim(),
      billEst:  Number(obj.bill||obj.utility_bill||obj.monthly_bill||0),
      source:   obj.source || 'csv_upload',
      attempts: 0,
      status:   'queued',   // queued | locked | done | callback | dq
      lockedBy: null,       // repId currently on this call
      disposition: null,    // final disposition key
      assignedTo:  null,    // repId who booked an appt
      callbackTime: null,
      callbackRepId: null,
      created: new Date().toISOString(),
    };
  }).filter(l=>l.phone);
};

const SAMPLE_DIALER_LEADS = [
  {id:"DL001",name:"Tom Bradley",   phone:"(602)555-1101",address:"1234 N 7th St, Phoenix AZ",      billEst:290,source:"web_lead",   attempts:0,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-20"},
  {id:"DL002",name:"Karen White",   phone:"(480)555-1202",address:"567 E Camelback, Scottsdale AZ", billEst:340,source:"door_knock", attempts:1,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-20"},
  {id:"DL003",name:"Mike Johnson",  phone:"(623)555-1303",address:"890 W Bell Rd, Glendale AZ",     billEst:210,source:"facebook",   attempts:0,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-20"},
  {id:"DL004",name:"Susan Davis",   phone:"(520)555-1404",address:"234 S Rural Rd, Tempe AZ",       billEst:375,source:"referral",   attempts:2,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-21"},
  {id:"DL005",name:"Paul Martinez", phone:"(602)555-1505",address:"678 N 32nd St, Phoenix AZ",      billEst:255,source:"canvass",    attempts:0,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-21"},
  {id:"DL006",name:"Lisa Anderson", phone:"(480)555-1606",address:"321 E Indian School, Phoenix AZ",billEst:420,source:"web_lead",   attempts:1,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-21"},
  {id:"DL007",name:"James Wilson",  phone:"(623)555-1707",address:"987 W Thomas Rd, Phoenix AZ",    billEst:180,source:"door_knock", attempts:0,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-21"},
  {id:"DL008",name:"Amy Taylor",    phone:"(602)555-1808",address:"555 E Chandler Blvd, Chandler AZ",billEst:310,source:"google",  attempts:3,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-21"},
  {id:"DL009",name:"Robert Chen",   phone:"(480)555-1909",address:"222 W Baseline Rd, Mesa AZ",     billEst:395,source:"referral",   attempts:0,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-22"},
  {id:"DL010",name:"Diana Flores",  phone:"(602)555-2010",address:"450 S Mill Ave, Tempe AZ",       billEst:270,source:"facebook",   attempts:0,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-22"},
  {id:"DL011",name:"Kevin O'Brien", phone:"(623)555-2111",address:"3301 N 7th Ave, Phoenix AZ",     billEst:310,source:"canvass",    attempts:1,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-22"},
  {id:"DL012",name:"Tiffany Grant", phone:"(480)555-2212",address:"789 N Hayden Rd, Scottsdale AZ", billEst:460,source:"web_lead",   attempts:0,status:"queued",lockedBy:null,disposition:null,assignedTo:null,callbackTime:null,callbackRepId:null,created:"2024-11-22"},
];

/* ══════════════════════════════════════════════════════════════════
   CAMPAIGN DATA MODEL
   Each campaign owns its lead list and tracks per-rep stats.
   Leads are embedded in the campaign so the shared queue is scoped.
   lockedBy on a lead = repId claiming it right now (optimistic lock).
══════════════════════════════════════════════════════════════════ */
const mkDialerLead = (overrides) => ({
  id: `L${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
  name:"", phone:"", address:"", billEst:0, source:"csv_upload",
  attempts:0, status:"queued", lockedBy:null,
  disposition:null, assignedTo:null,
  callbackTime:null, callbackRepId:null,
  created: new Date().toISOString(),
  ...overrides,
});

const SAMPLE_CAMPAIGNS = [
  {
    id:"C001",
    name:"Phoenix West — Web Leads",
    status:"active",          // draft | active | paused | completed
    assignedReps:[1,2,3],     // rep ids
    createdAt:"2024-11-18",
    script:"Hi, is this {firstName}? Great — this is {rep} with Apex Solar. We've been helping homeowners in {city} get their electric bill down to zero. I see yours is around ${bill}/month. Do you have just 2 minutes?",
    leads:[
      mkDialerLead({id:"C001L001",name:"Tom Bradley",   phone:"(602)555-1101",address:"1234 N 7th St, Phoenix AZ",       billEst:290,source:"web_lead",  created:"2024-11-18"}),
      mkDialerLead({id:"C001L002",name:"Karen White",   phone:"(480)555-1202",address:"567 E Camelback, Scottsdale AZ",  billEst:340,source:"web_lead",  created:"2024-11-18"}),
      mkDialerLead({id:"C001L003",name:"Mike Johnson",  phone:"(623)555-1303",address:"890 W Bell Rd, Glendale AZ",      billEst:210,source:"web_lead",  created:"2024-11-18"}),
      mkDialerLead({id:"C001L004",name:"Susan Davis",   phone:"(520)555-1404",address:"234 S Rural Rd, Tempe AZ",        billEst:375,source:"referral",  created:"2024-11-19",attempts:1}),
      mkDialerLead({id:"C001L005",name:"Paul Martinez", phone:"(602)555-1505",address:"678 N 32nd St, Phoenix AZ",       billEst:255,source:"web_lead",  created:"2024-11-19"}),
      mkDialerLead({id:"C001L006",name:"Lisa Anderson", phone:"(480)555-1606",address:"321 E Indian School, Phoenix AZ", billEst:420,source:"web_lead",  created:"2024-11-20"}),
      mkDialerLead({id:"C001L007",name:"James Wilson",  phone:"(623)555-1707",address:"987 W Thomas Rd, Phoenix AZ",     billEst:180,source:"door_knock",created:"2024-11-20"}),
      mkDialerLead({id:"C001L008",name:"Amy Taylor",    phone:"(602)555-1808",address:"555 E Chandler Blvd, Chandler AZ",billEst:310,source:"google",    created:"2024-11-20"}),
    ],
    stats:{ calls:24, connects:9, appts:3, callbacks:4 },
  },
  {
    id:"C002",
    name:"Scottsdale Referrals — Nov",
    status:"active",
    assignedReps:[4,5],
    createdAt:"2024-11-20",
    script:"Hi {firstName}, I'm {rep} from Apex Solar. Your neighbor referred us — they're saving over $200/month with solar. Do you have a minute to hear how?",
    leads:[
      mkDialerLead({id:"C002L001",name:"Robert Chen",  phone:"(480)555-1909",address:"222 W Baseline Rd, Mesa AZ",      billEst:395,source:"referral",created:"2024-11-20"}),
      mkDialerLead({id:"C002L002",name:"Diana Flores", phone:"(602)555-2010",address:"450 S Mill Ave, Tempe AZ",         billEst:270,source:"referral",created:"2024-11-20"}),
      mkDialerLead({id:"C002L003",name:"Kevin O'Brien",phone:"(623)555-2111",address:"3301 N 7th Ave, Phoenix AZ",        billEst:310,source:"referral",created:"2024-11-21"}),
      mkDialerLead({id:"C002L004",name:"Tiffany Grant",phone:"(480)555-2212",address:"789 N Hayden Rd, Scottsdale AZ",   billEst:460,source:"referral",created:"2024-11-21"}),
    ],
    stats:{ calls:8, connects:4, appts:1, callbacks:1 },
  },
  {
    id:"C003",
    name:"Canvass Follow-Up Batch",
    status:"paused",
    assignedReps:[6],
    createdAt:"2024-11-15",
    script:"Hey {firstName}, it's {rep} from Apex Solar. Someone from our team knocked on your door recently. Just following up — did you get a chance to think about your electricity bill?",
    leads:[
      mkDialerLead({id:"C003L001",name:"Frank Nguyen", phone:"(602)555-3001",address:"100 E Roosevelt St, Phoenix AZ",   billEst:195,source:"canvass",created:"2024-11-15"}),
      mkDialerLead({id:"C003L002",name:"Helen Park",   phone:"(480)555-3002",address:"800 N Dobson Rd, Mesa AZ",          billEst:225,source:"canvass",created:"2024-11-15",status:"done",disposition:"appointment"}),
    ],
    stats:{ calls:12, connects:5, appts:1, callbacks:2 },
  },
];

/* ══════════════════════════════════════════════════════════════════
   UPLOAD LEADS PANEL — proper component so hooks are valid
══════════════════════════════════════════════════════════════════ */
function UploadLeadsPanel({ campaigns, setCampaigns, dialerLeads, setDialerLeads }) {
  const [uploadCampaignId, setUploadCampaignId] = useState(
    campaigns.find(c => c.status==="active")?.id || ""
  );
  const [uploadMsg, setUploadMsg] = useState("");

  const uploadTarget = campaigns.find(c => c.id===uploadCampaignId);

  const handleUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const cid = uploadCampaignId || `C${Date.now()}`;
        const parsed = parseCampaignCSV(ev.target.result, cid);
        if (!parsed.length) { setUploadMsg("✗ No valid rows. Check CSV has a 'phone' column."); return; }
        if (uploadCampaignId) {
          setCampaigns(prev => prev.map(c => {
            if (c.id !== uploadCampaignId) return c;
            const existing = new Set(c.leads.map(l => l.phone));
            const newLeads = parsed.filter(l => !existing.has(l.phone));
            setUploadMsg(`✓ Added ${newLeads.length} leads to "${c.name}" (${parsed.length - newLeads.length} duplicates skipped)`);
            return { ...c, leads: [...c.leads, ...newLeads] };
          }));
        } else {
          const existing = new Set(dialerLeads.map(l => l.phone));
          const newLeads = parsed.filter(l => !existing.has(l.phone));
          setDialerLeads(prev => [...prev, ...newLeads]);
          setUploadMsg(`✓ Imported ${newLeads.length} leads to legacy queue`);
        }
      } catch(err) { setUploadMsg("✗ Error: " + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isOk = uploadMsg.startsWith("✓");

  return (
    <div style={{maxWidth:640}}>
      <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:16,padding:"24px",backdropFilter:"blur(24px)",boxShadow:"0 1px 0 rgba(255,255,255,0.07) inset",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)"}}/>
        <div style={{fontWeight:700,fontSize:15,color:T.t1,marginBottom:4,letterSpacing:"-0.02em"}}>Upload Leads to Campaign</div>
        <div style={{fontSize:12.5,color:T.t3,marginBottom:20}}>Upload a CSV and assign it to a campaign. The shared queue updates immediately for all assigned reps.</div>

        {/* Campaign picker */}
        <div style={{marginBottom:18}}>
          <div className="caps" style={{marginBottom:8}}>Target Campaign</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {campaigns.filter(c => c.status==="active"||c.status==="draft").map(c => {
              const on = uploadCampaignId===c.id;
              return (
                <button key={c.id} onClick={() => setUploadCampaignId(on ? "" : c.id)} style={{
                  display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,
                  border:`1px solid ${on?"rgba(6,214,240,0.35)":"rgba(255,255,255,0.08)"}`,
                  background:on?"rgba(6,214,240,0.08)":"rgba(255,255,255,0.03)",
                  cursor:"pointer",textAlign:"left",fontFamily:"'Inter',system-ui,sans-serif",transition:"all 0.15s",
                  boxShadow:on?"0 1px 0 rgba(255,255,255,0.08) inset":"none",
                }}>
                  <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${on?T.cyan:"rgba(255,255,255,0.2)"}`,background:on?T.cyan:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                    {on && <svg width="8" height="7" viewBox="0 0 8 7" fill="none"><path d="M1 3.5l2 2.5 4-5" stroke="#021014" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:on?600:400,color:on?T.t1:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                    <div style={{fontSize:11,color:T.t3,marginTop:1}}>{c.leads.filter(l=>l.status==="queued").length} queued · {c.leads.length} total</div>
                  </div>
                  <CampaignStatusPill status={c.status}/>
                </button>
              );
            })}
            {campaigns.filter(c=>c.status==="active"||c.status==="draft").length===0 && (
              <div style={{fontSize:12.5,color:T.t3,padding:"12px 14px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:9}}>
                No active campaigns. Create one in the Campaigns tab first.
              </div>
            )}
          </div>
        </div>

        {/* CSV format hint */}
        <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid rgba(255,255,255,0.04)`,borderRadius:9,padding:"10px 14px",marginBottom:16,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t3,overflowX:"auto"}}>
          <div style={{color:T.t2,marginBottom:3}}>CSV format: name, phone (required), address, bill, source</div>
          <div>John Smith,(602)555-0101,"123 Main St, Phoenix AZ",280,web_lead</div>
        </div>

        {/* Drop zone */}
        <label style={{
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          gap:10,padding:"28px 20px",cursor:uploadCampaignId?"pointer":"default",
          background:"rgba(255,255,255,0.02)",
          border:`2px dashed ${uploadCampaignId?"rgba(6,214,240,0.3)":"rgba(255,255,255,0.1)"}`,
          borderRadius:12,textAlign:"center",transition:"all 0.18s",
        }}
          onDragOver={e=>e.preventDefault()}
          onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f&&uploadCampaignId)handleUpload({target:{files:[f],value:""}});}}>
          <div style={{fontSize:28,opacity:uploadCampaignId?0.6:0.25}}>📥</div>
          <div style={{fontWeight:600,fontSize:13.5,color:uploadCampaignId?T.t1:T.t3}}>
            {uploadCampaignId ? `Upload to "${uploadTarget?.name}"` : "Select a campaign above first"}
          </div>
          <div style={{fontSize:11,color:T.t3}}>Drop CSV or click to browse · duplicates auto-skipped</div>
          <input type="file" accept=".csv,.txt" onChange={handleUpload} disabled={!uploadCampaignId} style={{display:"none"}}/>
        </label>

        {uploadMsg && (
          <div style={{
            marginTop:12,padding:"10px 14px",borderRadius:9,fontSize:12.5,fontWeight:600,
            background:isOk?T.greenDm:T.redDm,
            border:`1px solid ${isOk?"rgba(48,209,88,0.3)":"rgba(255,69,58,0.3)"}`,
            color:isOk?T.green:T.red,
          }}>{uploadMsg}</div>
        )}

        {/* Stats for selected campaign */}
        {uploadTarget && (
          <div style={{marginTop:18,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {[
              {label:"Total Leads", val:uploadTarget.leads.length,                                color:T.t1},
              {label:"Queued",      val:uploadTarget.leads.filter(l=>l.status==="queued").length, color:T.amber},
              {label:"Done",        val:uploadTarget.leads.filter(l=>l.status==="done").length,   color:T.green},
            ].map(({label,val,color})=>(
              <div key={label} style={{background:"rgba(255,255,255,0.02)",border:`1px solid rgba(255,255,255,0.04)`,borderRadius:9,padding:"10px 12px",textAlign:"center"}}>
                <div className="caps" style={{fontSize:8.5,marginBottom:4}}>{label}</div>
                <div className="mono" style={{fontSize:18,fontWeight:700,color}}>{val}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DIALER COMMAND CENTER — admin-only, global stats + recordings
══════════════════════════════════════════════════════════════════ */
function DialerCommandCenter({ reps, repCallLogs, repDialerStatus, campaigns, isMobile }) {
  const [filterPeriod,  setFilterPeriod]  = useState("today");
  const [filterDay,     setFilterDay]     = useState(() => new Date().toISOString().slice(0,10));
  const [filterStart,   setFilterStart]   = useState(() => new Date().toISOString().slice(0,10));
  const [filterEnd,     setFilterEnd]     = useState(() => new Date().toISOString().slice(0,10));
  const [filterCampaign,setFilterCampaign]= useState("all");
  const [selectedRep,   setSelectedRep]   = useState(null); // repId for drill-down
  const [playingId,     setPlayingId]     = useState(null);

  const fmtDur = s => {
    if (!s) return "0:00";
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  };
  const fmtDurLong = s => {
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const sec = s%60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
  };

  // Filter call log entries by period
  const now = Date.now();
  const periodMs = filterPeriod==="today"
    ? (() => { const d=new Date(); d.setHours(0,0,0,0); return now-d.getTime(); })()
    : filterPeriod==="custom"
    ? (() => {
        const [sy,sm,sd] = filterStart.split("-").map(Number);
        const [ey,em,ed] = filterEnd.split("-").map(Number);
        const start = new Date(sy,sm-1,sd,0,0,0,0).getTime();
        const end   = new Date(ey,em-1,ed,23,59,59,999).getTime();
        return { start, end };
      })()
    : filterPeriod==="week"  ? 7*24*60*60*1000
    : filterPeriod==="month" ? 30*24*60*60*1000
    : Infinity;

  const inPeriod = (c) => {
    const ts = c.timestamp || 0;
    if (typeof periodMs === "object") return ts >= periodMs.start && ts <= periodMs.end;
    return (now - ts) <= periodMs;
  };

  // Flatten all calls across all reps, apply period filter
  const allCalls = Object.entries(repCallLogs).flatMap(([rid, calls]) =>
    calls.filter(c => inPeriod(c))
  );

  // Derive per-rep stats
  const repStats = reps.map(rep => {
    const calls = (repCallLogs[rep.id]||[]).filter(c => inPeriod(c));
    const connects   = calls.filter(c => c.duration > 0).length;
    const appts      = calls.filter(c => c.result==="appointment").length;
    const callbacks  = calls.filter(c => c.result==="callback").length;
    const notInt     = calls.filter(c => c.result==="not_interested").length;
    const vms        = calls.filter(c => c.result==="voicemail"||c.result==="no_answer").length;
    const dnc        = calls.filter(c => c.result==="do_not_call").length;
    const totalSecs  = calls.reduce((s,c) => s+(c.duration||0), 0);
    const connectPct = calls.length ? Math.round((connects/calls.length)*100) : 0;
    const status     = repDialerStatus[rep.id] || "offline";
    return { rep, calls, connects, appts, callbacks, notInt, vms, dnc, totalSecs, connectPct, status };
  });

  // Company-wide totals
  const totals = repStats.reduce((acc, r) => ({
    calls:    acc.calls    + r.calls.length,
    connects: acc.connects + r.connects,
    appts:    acc.appts    + r.appts,
    callbacks:acc.callbacks+ r.callbacks,
    secs:     acc.secs     + r.totalSecs,
  }), {calls:0,connects:0,appts:0,callbacks:0,secs:0});

  const liveCount = repStats.filter(r => r.status==="dialing"||r.status==="oncall").length;

  const statusColor = s => s==="oncall"?"#30d158":s==="dialing"?"#06d6f0":s==="idle"?"#98989f":"#48484a";
  const statusLabel = s => s==="oncall"?"On Call":s==="dialing"?"Dialing":s==="idle"?"Idle":"Offline";
  const statusDot   = s => ({
    width:7,height:7,borderRadius:"50%",background:statusColor(s),flexShrink:0,
    ...(s==="oncall"||s==="dialing"?{boxShadow:`0 0 6px ${statusColor(s)}`}:{}),
  });

  const dispColor = r =>
    r==="appointment"?"#30d158":r==="callback"?"#ff9f0a":
    r==="not_interested"||r==="do_not_call"?"#ff453a":"#98989f";

  // Recent calls to show in recordings panel (most recent 30, across all reps)
  const recentCalls = [...allCalls]
    .sort((a,b)=>(b.timestamp||0)-(a.timestamp||0))
    .slice(0,30);

  const drillCalls = selectedRep
    ? (repCallLogs[selectedRep]||[]).filter(c=>inPeriod(c))
    : [];
  const drillRep = reps.find(r=>r.id===selectedRep);

  const card = {
    background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
    borderRadius:16,backdropFilter:"blur(20px)",
    boxShadow:"0 1px 0 rgba(255,255,255,0.06) inset",
  };

  return (
    <div>
      {/* ── Header controls ── */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:16,color:T.t1,letterSpacing:"-0.02em"}}>Command Center</div>
          <div style={{fontSize:12,color:T.t3,marginTop:2}}>
            {liveCount} rep{liveCount!==1?"s":""} active now
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <div className="pgroup">
            {[["today","Today"],["custom","Custom"],["week","Week"],["month","Month"],["all","All Time"]].map(([v,l])=>(
              <button key={v} className={`pbtn${filterPeriod===v?" on":""}`} onClick={()=>setFilterPeriod(v)}>{l}</button>
            ))}
          </div>
          {filterPeriod==="custom" && (
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input
                type="date"
                className="hinput"
                value={filterStart}
                max={filterEnd}
                onChange={e=>setFilterStart(e.target.value)}
                style={{width:"auto",padding:"5px 10px",fontSize:12}}
              />
              <span style={{fontSize:12,color:T.t3}}>→</span>
              <input
                type="date"
                className="hinput"
                value={filterEnd}
                min={filterStart}
                max={new Date().toISOString().slice(0,10)}
                onChange={e=>setFilterEnd(e.target.value)}
                style={{width:"auto",padding:"5px 10px",fontSize:12}}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Company totals strip ── */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${isMobile?2:5},1fr)`,gap:8,marginBottom:18}}>
        {[
          {label:"Total Dialed",  val:totals.calls,                        color:T.t1},
          {label:"Connections",   val:totals.connects,                     color:T.cyan},
          {label:"Appts Set",     val:totals.appts,                        color:T.green},
          {label:"Callbacks",     val:totals.callbacks,                    color:T.amber},
          {label:"Talk Time",     val:fmtDurLong(totals.secs),             color:T.t2},
        ].map(({label,val,color})=>(
          <div key={label} style={{...card,padding:"12px 14px",textAlign:"center"}}>
            <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:T.t3,marginBottom:5}}>{label}</div>
            <div className="mono" style={{fontSize:isMobile?18:22,fontWeight:700,color,lineHeight:1}}>{val}</div>
          </div>
        ))}
      </div>

      {/* ── Rep stats table ── */}
      <div style={{...card,marginBottom:18,overflow:"hidden"}}>
        {/* Table header */}
        <div style={{
          display:"grid",
          gridTemplateColumns:isMobile?"140px 70px 48px 48px 48px 60px":"180px 90px 60px 60px 60px 60px 60px 60px 80px",
          gap:0,padding:"8px 16px",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
        }}>
          {(isMobile
            ? ["Rep","Status","Dialed","Appts","Con%","Talk"]
            : ["Rep","Status","Dialed","Connects","Appts","CBs","NI","Con%","Talk Time"]
          ).map(h=>(
            <div key={h} style={{fontSize:10,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:T.t3}}>{h}</div>
          ))}
        </div>

        {repStats.map(({rep,calls,connects,appts,callbacks,notInt,totalSecs,connectPct,status})=>{
          const cols = isMobile
            ? [
                null, // rep cell handled separately
                null, // status cell
                calls.length,
                appts,
                `${connectPct}%`,
                fmtDurLong(totalSecs),
              ]
            : [
                null,
                null,
                calls.length,
                connects,
                appts,
                callbacks,
                notInt,
                `${connectPct}%`,
                fmtDurLong(totalSecs),
              ];

          const isActive = status==="dialing"||status==="oncall";
          return (
            <div
              key={rep.id}
              onClick={()=>setSelectedRep(selectedRep===rep.id?null:rep.id)}
              style={{
                display:"grid",
                gridTemplateColumns:isMobile?"140px 70px 48px 48px 48px 60px":"180px 90px 60px 60px 60px 60px 60px 60px 80px",
                gap:0,padding:"11px 16px",
                borderBottom:"1px solid rgba(255,255,255,0.04)",
                cursor:"pointer",
                background:selectedRep===rep.id?"rgba(6,214,240,0.05)":isActive?"rgba(255,255,255,0.02)":"transparent",
                transition:"background 0.15s",
              }}
            >
              {/* Rep name + avatar */}
              <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                <div style={{
                  width:28,height:28,borderRadius:"50%",flexShrink:0,
                  background:`rgba(6,214,240,0.12)`,border:"1px solid rgba(6,214,240,0.2)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,fontWeight:700,color:T.cyan,
                }}>{rep.name.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
                <span style={{fontWeight:600,fontSize:13,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {rep.name.split(" ")[0]}
                </span>
              </div>

              {/* Status badge */}
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <div style={statusDot(status)}/>
                <span style={{fontSize:11,fontWeight:500,color:statusColor(status)}}>{statusLabel(status)}</span>
              </div>

              {/* Stat columns */}
              {cols.slice(2).map((val,i)=>{
                const isAppt = (isMobile&&i===1)||(!isMobile&&i===2);
                const isPct  = (isMobile&&i===3)||(!isMobile&&i===5);
                return (
                  <div key={i} style={{
                    fontFamily:"'JetBrains Mono',monospace",
                    fontSize:13,fontWeight:isAppt?700:400,
                    color:isAppt&&val>0?T.green:isPct&&connectPct>=30?T.green:isPct&&connectPct>=20?T.amber:T.t2,
                    display:"flex",alignItems:"center",
                  }}>{val}</div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Drill-down: selected rep full analytics ── */}
      {selectedRep && drillRep && (() => {
        const calls      = drillCalls;
        const totalCalls = calls.length;
        const connects   = calls.filter(c => c.duration > 0);
        const totalTalk  = calls.reduce((s,c) => s+(c.duration||0), 0);
        const avgTalk    = connects.length ? Math.round(totalTalk / connects.length) : 0;

        // Time between calls (pause time) — gap between end of one call and start of next
        const sorted = [...calls].sort((a,b) => (a.startedAt||a.timestamp||0)-(b.startedAt||b.timestamp||0));
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i-1];
          const curr = sorted[i];
          const prevEnd   = (prev.startedAt||prev.timestamp||0) + (prev.duration||0)*1000;
          const currStart = curr.startedAt || curr.timestamp || 0;
          const gap = Math.round((currStart - prevEnd) / 1000);
          if (gap >= 0 && gap < 3600) gaps.push(gap); // ignore gaps > 1hr (offline)
        }
        const avgGap    = gaps.length ? Math.round(gaps.reduce((s,g)=>s+g,0)/gaps.length) : 0;
        const totalPause = gaps.reduce((s,g)=>s+g,0);

        // Session length — from first call start to last call end
        const firstStart = sorted[0]?.startedAt || sorted[0]?.timestamp || 0;
        const lastCall   = sorted[sorted.length-1];
        const lastEnd    = lastCall ? (lastCall.startedAt||lastCall.timestamp||0)+(lastCall.duration||0)*1000 : 0;
        const sessionLen = firstStart && lastEnd ? Math.round((lastEnd - firstStart)/1000) : 0;

        // Disposition breakdown — all types
        const DISP_TYPES = [
          {key:"appointment",   label:"Appointment",   color:T.green},
          {key:"callback",      label:"Callback",      color:T.amber},
          {key:"not_interested",label:"Not Interested",color:T.red},
          {key:"voicemail",     label:"Voicemail",     color:T.t2},
          {key:"no_answer",     label:"No Answer",     color:T.t3},
          {key:"do_not_call",   label:"Do Not Call",   color:T.red},
        ];
        const dispBreakdown = DISP_TYPES.map(d => ({
          ...d,
          count: calls.filter(c=>c.result===d.key).length,
          pct:   totalCalls ? Math.round((calls.filter(c=>c.result===d.key).length/totalCalls)*100) : 0,
        })).filter(d => d.count > 0);

        return (
          <div style={{...card,marginBottom:18,overflow:"hidden"}}>

            {/* Header */}
            <div style={{
              display:"flex",alignItems:"center",gap:12,padding:"16px 18px",
              borderBottom:"1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{
                width:36,height:36,borderRadius:"50%",flexShrink:0,
                background:"rgba(6,214,240,0.12)",border:"1px solid rgba(6,214,240,0.25)",
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,fontWeight:700,color:T.cyan,
              }}>{drillRep.name.split(" ").map(w=>w[0]).join("").slice(0,2)}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,color:T.t1,letterSpacing:"-0.02em"}}>{drillRep.name}</div>
                <div style={{fontSize:11,color:T.t3,marginTop:1}}>{totalCalls} calls · {filterPeriod==="today"?"Today":filterPeriod==="custom"?`${filterStart} → ${filterEnd}`:filterPeriod==="week"?"This Week":filterPeriod==="month"?"This Month":"All Time"}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={statusDot(repDialerStatus[selectedRep]||"offline")}/>
                <span style={{fontSize:11,color:statusColor(repDialerStatus[selectedRep]||"offline"),fontWeight:500}}>
                  {statusLabel(repDialerStatus[selectedRep]||"offline")}
                </span>
              </div>
              <button onClick={()=>setSelectedRep(null)} style={{
                background:"transparent",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:8,padding:"4px 10px",color:T.t3,fontSize:11,cursor:"pointer",
                fontFamily:"'Inter',system-ui,sans-serif",
              }}>✕</button>
            </div>

            {totalCalls === 0 ? (
              <div style={{padding:"40px",textAlign:"center",color:T.t3,fontSize:13}}>
                No calls logged this period yet
              </div>
            ) : (
              <>
                {/* Time analytics */}
                <div style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:T.t3,marginBottom:12}}>Session Analytics</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                    {[
                      {label:"Session Length", val:fmtDurLong(sessionLen), sub:"start to finish",        color:T.t1},
                      {label:"Total Talk Time", val:fmtDurLong(totalTalk), sub:`${connects.length} connected calls`, color:T.cyan},
                      {label:"Avg Talk/Call",   val:fmtDur(avgTalk),       sub:"per connected call",     color:T.green},
                      {label:"Avg Pause",       val:fmtDur(avgGap),        sub:`${fmtDurLong(totalPause)} total idle`, color:avgGap>120?T.amber:T.t2},
                    ].map(({label,val,sub,color})=>(
                      <div key={label} style={{
                        background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",
                        borderRadius:10,padding:"11px 12px",
                      }}>
                        <div style={{fontSize:9,fontWeight:600,letterSpacing:"0.07em",textTransform:"uppercase",color:T.t3,marginBottom:5}}>{label}</div>
                        <div className="mono" style={{fontSize:18,fontWeight:700,color,lineHeight:1,marginBottom:3}}>{val}</div>
                        <div style={{fontSize:10,color:T.t3}}>{sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disposition breakdown */}
                <div style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                  <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:T.t3,marginBottom:12}}>Disposition Breakdown</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {dispBreakdown.map(d=>(
                      <div key={d.key} style={{display:"flex",alignItems:"center",gap:10}}>
                        {/* Label */}
                        <div style={{width:120,fontSize:12,color:T.t2,flexShrink:0}}>{d.label}</div>
                        {/* Bar */}
                        <div style={{flex:1,height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{
                            height:"100%",borderRadius:3,
                            background:d.color,
                            width:`${d.pct}%`,
                            transition:"width 0.6s cubic-bezier(0.22,1,0.36,1)",
                          }}/>
                        </div>
                        {/* Count + pct */}
                        <div className="mono" style={{fontSize:12,fontWeight:700,color:d.color,width:28,textAlign:"right",flexShrink:0}}>{d.count}</div>
                        <div style={{fontSize:11,color:T.t3,width:34,flexShrink:0}}>{d.pct}%</div>
                      </div>
                    ))}
                    {/* Remaining: unanswered/skipped */}
                    {(() => {
                      const accounted = dispBreakdown.reduce((s,d)=>s+d.count,0);
                      const other = totalCalls - accounted;
                      if (!other) return null;
                      return (
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:120,fontSize:12,color:T.t3,flexShrink:0}}>Other / Skipped</div>
                          <div style={{flex:1,height:6,background:"rgba(255,255,255,0.06)",borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",borderRadius:3,background:"rgba(255,255,255,0.12)",width:`${Math.round(other/totalCalls*100)}%`}}/>
                          </div>
                          <div className="mono" style={{fontSize:12,fontWeight:700,color:T.t3,width:28,textAlign:"right",flexShrink:0}}>{other}</div>
                          <div style={{fontSize:11,color:T.t3,width:34,flexShrink:0}}>{Math.round(other/totalCalls*100)}%</div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Individual call log */}
                <div style={{padding:"14px 18px 6px"}}>
                  <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:T.t3,marginBottom:10}}>Call Log</div>
                </div>
                <div style={{maxHeight:280,overflowY:"auto"}}>
                  {sorted.slice().reverse().map((call,i)=>(
                    <div key={call.id||i} style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"9px 18px",
                      borderTop:"1px solid rgba(255,255,255,0.04)",
                    }}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:dispColor(call.result),flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:12.5,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          {call.name||"Unknown"} · <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:400,fontSize:12,color:T.t2}}>{call.phone}</span>
                        </div>
                        <div style={{fontSize:11,color:T.t3,marginTop:1}}>{call.time} · {fmtDur(call.duration)}</div>
                      </div>
                      <div style={{
                        fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,flexShrink:0,
                        background:`${dispColor(call.result)}18`,
                        color:dispColor(call.result),
                        border:`1px solid ${dispColor(call.result)}30`,
                      }}>{call.resultLabel||call.result}</div>
                      <button
                        onClick={()=>call.recordingUrl?setPlayingId(playingId===call.id?null:call.id):null}
                        style={{
                          display:"flex",alignItems:"center",gap:4,flexShrink:0,
                          background:call.recordingUrl?"rgba(6,214,240,0.08)":"rgba(255,255,255,0.03)",
                          border:`1px solid ${call.recordingUrl?"rgba(6,214,240,0.25)":"rgba(255,255,255,0.06)"}`,
                          borderRadius:7,padding:"4px 10px",
                          color:call.recordingUrl?T.cyan:"rgba(255,255,255,0.2)",
                          fontSize:11,fontWeight:500,
                          cursor:call.recordingUrl?"pointer":"default",
                          fontFamily:"'Inter',system-ui,sans-serif",
                        }}
                      >▶ {call.recordingUrl?"Play":"Rec"}</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── Recent recordings panel ── */}
      <div style={{...card,overflow:"hidden"}}>
        <div style={{
          display:"flex",alignItems:"center",gap:10,padding:"14px 16px",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13,color:T.t1}}>All Recent Calls</div>
            <div style={{fontSize:11,color:T.t3,marginTop:2}}>
              {recentCalls.length} calls · recordings unlock when Twilio is connected
            </div>
          </div>
        </div>

        {recentCalls.length===0 ? (
          <div style={{padding:"40px",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12,opacity:0.2}}>📞</div>
            <div style={{fontWeight:600,fontSize:14,color:T.t2,marginBottom:4}}>No calls yet this period</div>
            <div style={{fontSize:12,color:T.t3}}>Calls appear here after reps disposition them in the dialer</div>
          </div>
        ) : (
          <div style={{maxHeight:400,overflowY:"auto"}}>
            {recentCalls.map((call,i)=>{
              const repInfo = reps.find(r=>r.id===call.repId);
              const initials = repInfo?.name.split(" ").map(w=>w[0]).join("").slice(0,2)||"?";
              return (
                <div key={call.id||i} style={{
                  display:"flex",alignItems:"center",gap:10,
                  padding:"10px 16px",
                  borderBottom:"1px solid rgba(255,255,255,0.04)",
                }}>
                  {/* Rep avatar */}
                  <div style={{
                    width:30,height:30,borderRadius:"50%",flexShrink:0,
                    background:"rgba(6,214,240,0.1)",border:"1px solid rgba(6,214,240,0.2)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:10,fontWeight:700,color:T.cyan,
                  }}>{initials}</div>
                  {/* Call info */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:12.5,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {call.name||"Unknown"} · <span style={{fontFamily:"'JetBrains Mono',monospace",color:T.t2,fontWeight:400,fontSize:12}}>{call.phone}</span>
                    </div>
                    <div style={{fontSize:11,color:T.t3,marginTop:1}}>
                      {repInfo?.name||"Unknown rep"} · {call.time} · {fmtDur(call.duration)}
                    </div>
                  </div>
                  {/* Disposition */}
                  <div style={{
                    fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:5,flexShrink:0,
                    background:`${dispColor(call.result)}18`,
                    color:dispColor(call.result),
                    border:`1px solid ${dispColor(call.result)}30`,
                  }}>{call.resultLabel||call.result}</div>
                  {/* Recording */}
                  <button
                    onClick={()=>call.recordingUrl?setPlayingId(playingId===call.id?null:call.id):null}
                    style={{
                      display:"flex",alignItems:"center",gap:4,flexShrink:0,
                      background:call.recordingUrl?"rgba(6,214,240,0.08)":"rgba(255,255,255,0.03)",
                      border:`1px solid ${call.recordingUrl?"rgba(6,214,240,0.25)":"rgba(255,255,255,0.06)"}`,
                      borderRadius:7,padding:"4px 10px",
                      color:call.recordingUrl?T.cyan:"rgba(255,255,255,0.2)",
                      fontSize:11,fontWeight:500,
                      cursor:call.recordingUrl?"pointer":"default",
                      fontFamily:"'Inter',system-ui,sans-serif",
                    }}
                    title={call.recordingUrl?"Play recording":"Connect Twilio to enable recordings"}
                  >
                    ▶ {call.recordingUrl?"Play":"Recording"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Twilio notice */}
        <div style={{
          margin:"0 16px 14px",marginTop:12,
          padding:"11px 14px",
          background:"rgba(6,214,240,0.05)",border:"1px solid rgba(6,214,240,0.15)",
          borderRadius:10,fontSize:11.5,color:T.t2,lineHeight:1.6,
        }}>
          <span style={{fontWeight:700,color:T.cyan}}>Recording note: </span>
          Call recordings activate automatically once Twilio is connected in Settings. Every call — power dialer and manual — will be recorded and playable directly here.
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SHARED POWER DIALER — campaign-aware, shared queue per campaign
   Props: campaigns, setCampaigns, dialerLeads, setDialerLeads, user, reps, isMobile
══════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   MANUAL KEYPAD — lets reps dial any number by hand
══════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
   TIME SLOT PICKER
   - Slots: 8:00 AM – 8:00 PM MST, 1.5hr each (8 slots)
   - Max 2 bookings per slot
   - Displays in homeowner's timezone based on their zip/address
══════════════════════════════════════════════════════════════════ */

// MST is UTC-7 (no DST — Arizona never observes DST)
const MST_OFFSET = -7;

// Generate all 8 daily slots as { mstHour: 8|9.5|11... label: "8:00 AM" }
function getMSTSlots() {
  const slots = [];
  // 8:00 AM to 8:00 PM MST = start hours 8, 9.5, 11, 12.5, 14, 15.5, 17, 18.5
  // Last slot starts 18.5 (6:30 PM), ends 20:00 (8:00 PM)
  for (let h = 8; h < 20; h += 1.5) {
    const hrs  = Math.floor(h);
    const mins = h % 1 === 0.5 ? 30 : 0;
    const endH = h + 1.5;
    const endHrs  = Math.floor(endH);
    const endMins = endH % 1 === 0.5 ? 30 : 0;
    const fmt = (hh, mm) => {
      const period = hh >= 12 ? "PM" : "AM";
      const h12 = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
      return `${h12}:${String(mm).padStart(2,"0")} ${period}`;
    };
    slots.push({
      id: `${String(hrs).padStart(2,"0")}${String(mins).padStart(2,"0")}`,
      mstHour: h,
      mstLabel: `${fmt(hrs, mins)} – ${fmt(endHrs, endMins)}`,
      startH: hrs, startM: mins,
    });
  }
  return slots;
}

// Detect homeowner timezone from US zip code prefix
// AZ = MST (UTC-7, no DST). Other states observe DST.
function getTimezoneFromAddress(address="") {
  // Extract zip from address string
  const zipMatch = address.match(/\b(\d{5})\b/);
  const zip = zipMatch ? zipMatch[1] : "";
  const prefix = parseInt(zip.slice(0,3));

  // Simplified US timezone mapping by zip prefix
  // Pacific: 900-961 (CA, OR, WA, NV west)
  // Mountain: 800-816 (CO), 820-831 (WY), 832-838 (ID), 840-847 (UT), 850-865 (AZ - NO DST), 870-884 (NM)
  // AZ specifically: 850-865
  // Central: 700-729 (LA,AR), 730-749 (OK), 750-799 (TX), 500-528 (IA,MN), 530-549 (WI), 600-629 (IL,MO), 630-658 (KS,NE), 670-679 (KS)
  // Eastern: everything else roughly

  if (!zip) return { name: "homeowner's local time", offset: MST_OFFSET, isDST: false };

  // Arizona zips (850-865) — MST no DST
  if (prefix >= 850 && prefix <= 865) return { name: "MST", offset: -7, isDST: false };

  // Determine DST — currently in effect March–November (approx)
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const dst = month >= 3 && month <= 11; // rough DST window

  if (prefix >= 900 && prefix <= 961) return { name: `Pacific${dst?" PDT":" PST"}`, offset: dst ? -7 : -8, isDST: dst };
  if ((prefix >= 800 && prefix <= 831) || (prefix >= 832 && prefix <= 884)) return { name: `Mountain${dst?" MDT":" MST"}`, offset: dst ? -6 : -7, isDST: dst };
  if ((prefix >= 700 && prefix <= 799) || (prefix >= 500 && prefix <= 528) || (prefix >= 530 && prefix <= 629)) return { name: `Central${dst?" CDT":" CST"}`, offset: dst ? -5 : -6, isDST: dst };
  return { name: `Eastern${dst?" EDT":" EST"}`, offset: dst ? -4 : -5, isDST: dst };
}

// Convert a MST slot to the homeowner's local time label
function slotInHomeownerTZ(slot, tz) {
  const diff = tz.offset - MST_OFFSET; // how many hours to add to get from MST to their TZ
  const startH = slot.startH + diff;
  const endH   = startH + 1.5;
  const fmt = (h, m) => {
    const hh = ((h % 24) + 24) % 24;
    const period = hh >= 12 ? "PM" : "AM";
    const h12 = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
    return `${h12}:${String(m).padStart(2,"0")} ${period}`;
  };
  const endHH = Math.floor(endH);
  const endMM = endH % 1 === 0.5 ? 30 : 0;
  return `${fmt(Math.floor(startH), slot.startM)} – ${fmt(endHH, endMM)} ${tz.name}`;
}


/* ══════════════════════════════════════════════════════════════════
   DATE PICKER DROPDOWN — fully custom, no native input
   Opens an inline month calendar on click
══════════════════════════════════════════════════════════════════ */
function DatePickerDropdown({ value, onChange, minDate="" }) {
  const [open, setOpen] = React.useState(false);
  const today = new Date();
  today.setHours(0,0,0,0);

  // Parse current value or default to today's month
  const parsed = value ? new Date(value + "T12:00:00") : null;
  const [viewYear,  setViewYear]  = React.useState((parsed||today).getFullYear());
  const [viewMonth, setViewMonth] = React.useState((parsed||today).getMonth());

  const minD = minDate ? new Date(minDate + "T12:00:00") : today;

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW    = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  const firstDow   = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMo   = new Date(viewYear, viewMonth+1, 0).getDate();
  const cells      = [];
  for (let i=0; i<firstDow; i++) cells.push(null);
  for (let d=1; d<=daysInMo; d++) cells.push(d);

  const prevMonth = () => {
    if (viewMonth===0) { setViewMonth(11); setViewYear(y=>y-1); }
    else setViewMonth(m=>m-1);
  };
  const nextMonth = () => {
    if (viewMonth===11) { setViewMonth(0); setViewYear(y=>y+1); }
    else setViewMonth(m=>m+1);
  };

  const select = (day) => {
    const ds = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    onChange(ds);
    setOpen(false);
  };

  const displayVal = parsed
    ? parsed.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})
    : "Select date";

  return (
    <div style={{position:"relative",userSelect:"none"}}>
      {/* Trigger button */}
      <button type="button" onClick={()=>setOpen(o=>!o)} style={{
        width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
        background:"rgba(255,255,255,0.06)",border:`1px solid ${open?"rgba(6,214,240,0.5)":"rgba(255,255,255,0.12)"}`,
        borderRadius:8,padding:"9px 13px",cursor:"pointer",
        fontFamily:"'Inter',system-ui,sans-serif",
        color: parsed ? T.t1 : T.t3,
        fontSize:13,fontWeight: parsed ? 600 : 400,
        transition:"border-color 0.15s",
        boxShadow: open ? `0 0 0 3px rgba(6,214,240,0.08)` : "none",
      }}>
        <span>{displayVal}</span>
        <span style={{fontSize:12,color:T.t3,marginLeft:8}}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div style={{
          position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:999,
          background:"#141820",border:"1px solid rgba(255,255,255,0.14)",
          borderRadius:12,padding:"12px",
          boxShadow:"0 12px 40px rgba(0,0,0,0.6)",
        }}>
          {/* Month nav */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <button type="button" onClick={prevMonth} style={{
              background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:6,width:28,height:28,cursor:"pointer",color:T.t2,fontSize:14,
              display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",
            }}>‹</button>
            <span style={{fontWeight:700,fontSize:13,color:T.t1}}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} style={{
              background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:6,width:28,height:28,cursor:"pointer",color:T.t2,fontSize:14,
              display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",
            }}>›</button>
          </div>

          {/* Day of week headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
            {DOW.map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:T.t3,padding:"2px 0"}}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {cells.map((day,i)=>{
              if (!day) return <div key={`e${i}`}/>;
              const ds      = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const dateObj = new Date(ds+"T12:00:00");
              const isToday = ds === today.toISOString().slice(0,10);
              const isSel   = ds === value;
              const isPast  = dateObj < minD;
              const isSun   = dateObj.getDay() === 0;
              const blocked = isPast || isSun;
              return (
                <button key={day} type="button" disabled={blocked} onClick={()=>!blocked&&select(day)} style={{
                  textAlign:"center",padding:"5px 0",borderRadius:6,border:"none",
                  background: isSel ? T.cyan : isToday ? "rgba(6,214,240,0.15)" : "transparent",
                  color: blocked ? "rgba(255,255,255,0.15)" : isSel ? "#000" : isToday ? T.cyan : T.t1,
                  fontWeight: isSel||isToday ? 700 : 400,
                  fontSize:12,cursor:blocked?"not-allowed":"pointer",
                  fontFamily:"inherit",
                  transition:"background 0.1s",
                }}
                onMouseEnter={e=>{if(!blocked&&!isSel)e.currentTarget.style.background="rgba(255,255,255,0.1)";}}
                onMouseLeave={e=>{if(!blocked&&!isSel)e.currentTarget.style.background="transparent";}}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TimeSlotPicker({ date, onSelect, selected, crmLeads=[], address="" }) {
  const slots = getMSTSlots();
  const tz = getTimezoneFromAddress(address);

  // Count bookings for each slot on this date
  const bookings = {};
  if (date) {
    crmLeads.forEach(l => {
      if (l.apptDate === date && l.apptTime && ["appt_set","showed","sold","site_survey","engineering","install_sched","installed"].includes(l.stage)) {
        // apptTime stored as "HH:MM" 24hr MST
        const key = l.apptTime.replace(":","").slice(0,4);
        bookings[key] = (bookings[key]||0) + 1;
      }
    });
  }

  const MAX_PER_SLOT = 2;

  if (!date) return (
    <div style={{textAlign:"center",padding:"20px 0",color:T.t3,fontSize:12.5}}>
      Select a date first to see available time slots
    </div>
  );

  const sameAsMST = tz.offset === MST_OFFSET;

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:T.t3,letterSpacing:"0.04em",textTransform:"uppercase"}}>Available Slots</div>
        {!sameAsMST && (
          <div style={{fontSize:10,color:T.amber,fontWeight:600,background:T.goldDm,border:"1px solid rgba(240,165,0,0.25)",borderRadius:5,padding:"2px 8px"}}>
            Showing in {tz.name}
          </div>
        )}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
        {slots.map(slot => {
          const booked  = bookings[slot.id] || 0;
          const full    = booked >= MAX_PER_SLOT;
          const isSel   = selected === `${String(slot.startH).padStart(2,"0")}:${String(slot.startM).padStart(2,"0")}`;
          const homeLabel = sameAsMST ? slot.mstLabel : slotInHomeownerTZ(slot, tz);
          const mstLabel  = sameAsMST ? null : slot.mstLabel + " MST";
          return (
            <button key={slot.id}
              disabled={full}
              onClick={()=>!full && onSelect(`${String(slot.startH).padStart(2,"0")}:${String(slot.startM).padStart(2,"0")}`)}
              style={{
                display:"flex",flexDirection:"column",alignItems:"flex-start",gap:2,
                padding:"9px 12px",borderRadius:9,cursor:full?"not-allowed":"pointer",
                background: full    ? "rgba(255,255,255,0.02)"
                          : isSel   ? `rgba(6,214,240,0.12)`
                          : "rgba(255,255,255,0.04)",
                border: `1px solid ${
                  full   ? "rgba(255,255,255,0.04)"
                : isSel  ? "rgba(6,214,240,0.5)"
                : "rgba(255,255,255,0.1)"}`,
                opacity: full ? 0.4 : 1,
                transition:"all 0.14s",
                fontFamily:"'Inter',system-ui,sans-serif",
                textAlign:"left",
              }}
              onMouseEnter={e=>{if(!full&&!isSel)e.currentTarget.style.borderColor="rgba(255,255,255,0.22)";}}
              onMouseLeave={e=>{if(!full&&!isSel)e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";}}>
              <div style={{fontSize:12,fontWeight:700,color:full?T.t3:isSel?T.cyan:T.t1,lineHeight:1.2}}>{homeLabel}</div>
              {mstLabel && <div style={{fontSize:10,color:T.t3}}>{mstLabel}</div>}
              <div style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}>
                {[0,1].map(i=>(
                  <div key={i} style={{
                    width:8,height:8,borderRadius:"50%",
                    background: i < booked ? T.red : isSel && i === 0 ? T.cyan : "rgba(255,255,255,0.15)",
                    border:`1px solid ${i<booked?"rgba(255,69,58,0.5)":isSel&&i===0?"rgba(6,214,240,0.5)":"rgba(255,255,255,0.08)"}`,
                  }}/>
                ))}
                <span style={{fontSize:10,color:full?T.red:booked===1?T.amber:T.t3}}>
                  {full?"Full":`${MAX_PER_SLOT-booked} open`}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {Object.values(bookings).some(v=>v>0) && (
        <div style={{fontSize:10,color:T.t3,marginTop:8,textAlign:"center"}}>
          🔴 = booked · max {MAX_PER_SLOT} per slot
        </div>
      )}
    </div>
  );
}

function ManualKeypad({ repObj, repId, reps, setReps, setAllDeals, setCrmLeads, crmLeads=[], isMobile }) {
  const [open,        setOpen]        = useState(false);
  const [digits,      setDigits]      = useState("");
  const [name,        setName]        = useState("");
  const [callState,   setCallState]   = useState("idle"); // idle | calling | connected | hung_up
  const [timer,       setTimer]       = useState(0);
  const [showDisp,    setShowDisp]    = useState(false);
  const [showAppt,    setShowAppt]    = useState(false);
  const [showCB,      setShowCB]      = useState(false);
  const [apptData,    setApptData]    = useState({date:"",time:"",notes:""});
  const [cbData,      setCbData]      = useState({date:"",time:"",notes:""});
  const timerRef = useRef(null);

  const formatted = (() => {
    const d = digits.replace(/\D/g,"");
    if (d.length <= 3)  return d;
    if (d.length <= 6)  return `(${d.slice(0,3)}) ${d.slice(3)}`;
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}`;
  })();

  const press = (val) => {
    if (digits.replace(/\D/g,"").length >= 10) return;
    setDigits(p => p + val);
  };
  const del = () => setDigits(p => p.slice(0,-1));
  const clear = () => { setDigits(""); setName(""); };

  const canCall = digits.replace(/\D/g,"").length === 10 && callState === "idle";

  const startCall = () => {
    setCallState("calling");
    setTimer(0);
    // Simulate ring → connect after 1.5–3s
    const delay = 1500 + Math.random() * 1500;
    setTimeout(() => {
      setCallState("connected");
      // Auto-open satellite roof view in new tab
      if (digits) {
        const enc = encodeURIComponent(name || digits);
        window.open(`https://www.google.com/maps/search/?api=1&query=${enc}&layer=satellite`, "_blank", "noopener,noreferrer");
      }
      timerRef.current = setInterval(() => setTimer(t => t+1), 1000);
    }, delay);
  };

  const hangUp = () => {
    clearInterval(timerRef.current);
    setCallState("hung_up");
    setShowDisp(true);
  };

  const fmtTimer = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const applyDisp = (key, extra={}) => {
    const isAppt = key === "appointment";
    const isCB   = key === "callback";

    // Increment rep appts on leaderboard
    if (isAppt && setReps && repId) {
      setReps(prev => prev.map(r => r.id === repId ? {...r, appts:(r.appts||0)+1} : r));
    }

    // Create deal in allDeals + CRM lead on appointment
    if (isAppt && setAllDeals && repId) {
      const nameParts = (name || "Unknown").split(" ");
      const newDeal = {
        id:           Date.now(),
        customer:     name || formatted,
        phone:        formatted,
        email:        "",
        address:      "",
        kw:           0,
        price:        0,
        commission:   0,
        monthlyBill:  0,
        lastContacted:new Date().toISOString().slice(0,10),
        apptDate:     extra.date || new Date().toISOString().slice(0,10),
        status:       "appt",
        adders:       [],
        notes:        extra.notes ? `Manual call · ${extra.notes}` : `Manual call appt${extra.date?" · "+extra.date:""}${extra.time?" @ "+extra.time:""}`,
        source:       "manual_call",
        setterId:     Number(repId),
        createdAt:    new Date().toISOString(),
      };
      setAllDeals(prev => ({...prev, [Number(repId)]: [newDeal, ...(prev[Number(repId)]||[])]}));

      if (setCrmLeads) {
        setCrmLeads(prev => [{
          id:           `D${Date.now()}`,
          firstName:    nameParts[0]||"Unknown",
          lastName:     nameParts.slice(1).join(" ")||"",
          phone:        formatted,
          email:        "",
          address:      "",
          city:         "",
          state:        "AZ",
          zip:          "",
          utilityBill:  0,
          roofAge:      0,
          roofType:     "Unknown",
          shade:        "Unknown",
          homeowner:    true,
          hoa:          false,
          creditScore:  "Unknown",
          stage:        "appt_set",
          assignedTo:   Number(repId),
          notes:        extra.notes||`Manual call · Appt ${extra.date||""}${extra.time?" @ "+extra.time:""}`,
          source:       "manual_call",
          tags:         ["manual"],
          lastContact:  new Date().toISOString().slice(0,10),
          apptDate:     extra.date||"",
          kw:0, salePrice:0, financing:"loan", lender:"", adders:[],
          created:      new Date().toISOString().slice(0,10),
        }, ...prev]);
      }
    }

    // Reset all state
    clearInterval(timerRef.current);
    setCallState("idle"); setShowDisp(false); setShowAppt(false); setShowCB(false);
    setApptData({date:"",time:"",notes:""}); setCbData({date:"",time:"",notes:""});
    setDigits(""); setName(""); setTimer(0);
  };

  const KEYS = [
    ["1","",""],["2","ABC",""],["3","DEF",""],
    ["4","GHI",""],["5","JKL",""],["6","MNO",""],
    ["7","PQRS",""],["8","TUV",""],["9","WXYZ",""],
    ["*","",""],["0","+",""],["#","",""],
  ];

  const DISPS = [
    {key:"appointment", label:"Appointment", color:T.green,  hot:true},
    {key:"callback",    label:"Callback",    color:T.amber,  hot:false},
    {key:"not_interested",label:"Not Interested",color:T.red,hot:false},
    {key:"voicemail",   label:"Voicemail",   color:T.t2,     hot:false},
    {key:"no_answer",   label:"No Answer",   color:T.t3,     hot:false},
    {key:"do_not_call", label:"Do Not Call", color:T.red,    hot:false},
  ];

  return (
    <div style={{marginTop:16}}>
      {/* Toggle button */}
      <button
        onClick={()=>setOpen(o=>!o)}
        style={{
          width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:14,padding:"11px 20px",color:T.t2,fontSize:13,fontWeight:500,
          cursor:"pointer",fontFamily:"'Inter',system-ui,sans-serif",
          backdropFilter:"blur(20px)",transition:"all 0.15s",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="9" y2="7"/><line x1="12" y1="7" x2="12" y2="7"/><line x1="15" y1="7" x2="15" y2="7"/>
          <line x1="9" y1="11" x2="9" y2="11"/><line x1="12" y1="11" x2="12" y2="11"/><line x1="15" y1="11" x2="15" y2="11"/>
          <line x1="9" y1="15" x2="9" y2="15"/><line x1="12" y1="15" x2="12" y2="15"/><line x1="15" y1="15" x2="15" y2="15"/>
        </svg>
        {open ? "Hide Keypad" : "Manual Call — Enter Number"}
        <span style={{marginLeft:"auto",fontSize:11,opacity:0.5}}>{open?"▲":"▼"}</span>
      </button>

      {open && (
        <div style={{
          marginTop:10,
          background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:20,padding:"24px 20px",backdropFilter:"blur(40px)",
          boxShadow:"0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.25)",
          position:"relative",overflow:"hidden",
        }}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.12) 50%,transparent)"}}/>

          {/* Name field */}
          <div style={{marginBottom:12}}>
            <input
              className="hinput"
              placeholder="Contact name (optional)"
              value={name}
              onChange={e=>setName(e.target.value)}
              disabled={callState!=="idle"}
              style={{textAlign:"center",fontSize:13}}
            />
          </div>

          {/* Number display */}
          <div style={{
            textAlign:"center",marginBottom:16,
            fontFamily:"'JetBrains Mono',monospace",
            fontSize: digits ? (isMobile?26:30) : 16,
            fontWeight:700,color:digits?T.t1:T.t3,
            letterSpacing:"0.04em",minHeight:40,
            display:"flex",alignItems:"center",justifyContent:"center",gap:8,
          }}>
            {callState==="calling" && <span style={{fontSize:13,color:T.amber,fontFamily:"'Inter',system-ui",fontWeight:600,animation:"pulse 1s ease infinite"}}>Ringing…</span>}
            {callState==="connected" && <span style={{fontSize:13,color:T.green,fontFamily:"'Inter',system-ui",fontWeight:600}}>{fmtTimer(timer)}</span>}
            {callState==="hung_up" && <span style={{fontSize:13,color:T.t3,fontFamily:"'Inter',system-ui"}}>Call ended · {fmtTimer(timer)}</span>}
            {callState==="idle" && (formatted || <span style={{opacity:0.3}}>Enter number</span>)}
          </div>

          {/* Keypad grid — only show when idle */}
          {callState==="idle" && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16,maxWidth:280,margin:"0 auto 16px"}}>
              {KEYS.map(([main,sub],i)=>(
                <button
                  key={i}
                  className="pin-key"
                  onClick={()=> main==="*"||main==="#" ? null : press(main==="0"?main:main)}
                  style={{
                    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    height:56,borderRadius:12,gap:2,
                    background:"rgba(255,255,255,0.06)",
                    border:"1px solid rgba(255,255,255,0.1)",
                    cursor: main==="*"||main==="#" ? "default" : "pointer",
                    opacity: main==="*"||main==="#" ? 0.3 : 1,
                  }}
                >
                  <span style={{fontSize:20,fontWeight:600,color:T.t1,fontFamily:"'JetBrains Mono',monospace",lineHeight:1}}>{main}</span>
                  {sub && <span style={{fontSize:8,fontWeight:600,color:T.t3,letterSpacing:"0.1em"}}>{sub}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Action row */}
          {callState==="idle" && (
            <div style={{display:"flex",gap:8,maxWidth:280,margin:"0 auto"}}>
              <button
                onClick={del}
                style={{
                  flex:"0 0 52px",height:52,borderRadius:12,
                  background:"transparent",border:"1px solid rgba(255,255,255,0.08)",
                  color:T.t3,fontSize:20,cursor:"pointer",
                  fontFamily:"'Inter',system-ui,sans-serif",
                }}
              >⌫</button>
              <button
                className="btn-cyan"
                onClick={startCall}
                disabled={!canCall}
                style={{flex:1,height:52,fontSize:15,borderRadius:12,padding:0,margin:0}}
              >
                📞 Call
              </button>
            </div>
          )}

          {/* Live call — hang up */}
          {callState==="connected" && (
            <div style={{maxWidth:280,margin:"0 auto"}}>
              <div style={{textAlign:"center",marginBottom:12}}>
                <span style={{fontSize:13,color:T.t1,fontWeight:600}}>{name||formatted}</span>
                {name && <div style={{fontSize:12,color:T.t3,marginTop:2,fontFamily:"'JetBrains Mono',monospace"}}>{formatted}</div>}
              </div>
              <button onClick={hangUp} style={{
                width:"100%",height:52,borderRadius:12,
                background:"rgba(255,69,58,0.15)",border:"1px solid rgba(255,69,58,0.35)",
                color:T.red,fontSize:14,fontWeight:700,cursor:"pointer",
                fontFamily:"'Inter',system-ui,sans-serif",
              }}>■ End Call</button>
            </div>
          )}

          {/* Calling — cancel */}
          {callState==="calling" && (
            <div style={{maxWidth:280,margin:"0 auto"}}>
              <button onClick={()=>{setCallState("idle");setTimer(0);}} style={{
                width:"100%",height:52,borderRadius:12,
                background:"transparent",border:"1px solid rgba(255,255,255,0.1)",
                color:T.t3,fontSize:13,fontWeight:500,cursor:"pointer",
                fontFamily:"'Inter',system-ui,sans-serif",
              }}>Cancel</button>
            </div>
          )}

          {/* Disposition panel */}
          {showDisp && !showAppt && !showCB && (
            <div style={{marginTop:20,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:20}}>
              <div style={{fontSize:12,fontWeight:600,color:T.t2,textAlign:"center",marginBottom:14,letterSpacing:"0.04em",textTransform:"uppercase"}}>How did it go?</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {DISPS.map(d=>(
                  <button key={d.key}
                    onClick={()=>{
                      if(d.key==="appointment") { setShowDisp(false); setShowAppt(true); return; }
                      if(d.key==="callback")    { setShowDisp(false); setShowCB(true);   return; }
                      applyDisp(d.key);
                    }}
                    style={{
                      padding:"11px 8px",borderRadius:10,fontSize:12.5,fontWeight:d.hot?700:500,
                      color:d.color,cursor:"pointer",fontFamily:"'Inter',system-ui,sans-serif",
                      background:d.hot?"rgba(48,209,88,0.1)":"rgba(255,255,255,0.04)",
                      border:`1px solid ${d.hot?"rgba(48,209,88,0.3)":"rgba(255,255,255,0.08)"}`,
                    }}
                  >{d.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Appointment form */}
          {showAppt && (
            <div style={{marginTop:20,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:20}}>
              <div style={{fontSize:12,fontWeight:700,color:T.green,textAlign:"center",marginBottom:14,textTransform:"uppercase",letterSpacing:"0.04em"}}>📅 Book Appointment</div>
              <div style={{display:"flex",flexDirection:"column",gap:0,maxHeight:"65vh",overflowY:"auto"}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:T.red,marginBottom:8}}>Required</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  <div>
                    <div style={{fontSize:11,color:T.t3,marginBottom:4}}>Avg Monthly Bill <span style={{color:T.red}}>*</span></div>
                    <div style={{position:"relative"}}>
                      <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.t3,fontSize:13,fontWeight:600,pointerEvents:"none"}}>$</span>
                      <input className="hinput" type="number" min="0" value={apptData.ub} onChange={e=>setApptData(p=>({...p,ub:e.target.value}))} placeholder="280" style={{paddingLeft:20}}/>
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:T.t3,marginBottom:4}}>Utility Company <span style={{color:T.red}}>*</span></div>
                    <input className="hinput" value={apptData.utilityCompany} onChange={e=>setApptData(p=>({...p,utilityCompany:e.target.value}))} placeholder="APS, SRP, TEP…"/>
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:T.t3,marginBottom:4}}>Property Address <span style={{color:T.red}}>*</span></div>
                  <input className="hinput" value={apptData.address!==undefined?apptData.address:name} onChange={e=>setApptData(p=>({...p,address:e.target.value}))} placeholder="Street address"/>
                </div>
                <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:10}}/>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,color:T.t3,marginBottom:4}}>Date <span style={{color:T.red}}>*</span></div>
                  <DatePickerDropdown
                    value={apptData.date}
                    onChange={d=>setApptData(p=>({...p,date:d,time:""}))}
                    minDate={new Date().toISOString().slice(0,10)}
                  />
                </div>
                <div style={{marginBottom:10}}>
                  <TimeSlotPicker
                    date={apptData.date}
                    selected={apptData.time}
                    onSelect={t=>setApptData(p=>({...p,time:t}))}
                    crmLeads={crmLeads}
                    address={apptData.address!==undefined?apptData.address:name}
                  />
                </div>
                <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:8}}/>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:T.t3,marginBottom:6}}>Call Notes <span style={{color:T.red}}>*</span></div>
                <textarea className="hinput" rows={2} value={apptData.callNotes} onChange={e=>setApptData(p=>({...p,callNotes:e.target.value}))} placeholder="Objections, warm signals, roof condition…" style={{resize:"vertical",minHeight:52}}/>
              </div>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button className="btn-cyan" style={{flex:1}}
                  disabled={!apptData.date||!apptData.time||!apptData.ub||!apptData.utilityCompany||!apptData.callNotes||!(apptData.address!==undefined?apptData.address:name)}
                  onClick={()=>applyDisp("appointment",{...apptData,address:apptData.address!==undefined?apptData.address:name})}>
                  Set Appointment
                </button>
                <button className="btn-out" onClick={()=>{setShowAppt(false);setShowDisp(true);}}>← Back</button>
              </div>
            </div>
          )}

          {/* Callback form */}
          {showCB && (
            <div style={{marginTop:20,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:20}}>
              <div style={{fontSize:12,fontWeight:700,color:T.amber,textAlign:"center",marginBottom:14,textTransform:"uppercase",letterSpacing:"0.04em"}}>🔁 Schedule Callback</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div>
                    <div style={{fontSize:11,color:T.t3,marginBottom:5}}>Date</div>
                    <input className="hinput" type="date" value={cbData.date} onChange={e=>setCbData(p=>({...p,date:e.target.value}))}/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:T.t3,marginBottom:5}}>Time</div>
                    <input className="hinput" type="time" value={cbData.time} onChange={e=>setCbData(p=>({...p,time:e.target.value}))}/>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:11,color:T.t3,marginBottom:5}}>Notes</div>
                  <textarea className="hinput" rows={2} value={cbData.notes} onChange={e=>setCbData(p=>({...p,notes:e.target.value}))} placeholder="Call after 5pm, asked about battery…" style={{resize:"vertical",minHeight:52}}/>
                </div>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <button className="btn-cyan" style={{flex:1}} disabled={!cbData.date||!cbData.time} onClick={()=>applyDisp("callback",cbData)}>
                    Schedule Callback
                  </button>
                  <button className="btn-out" onClick={()=>{setShowCB(false);setShowDisp(true);}}>← Back</button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

function SharedDialer({ campaigns, setCampaigns, dialerLeads, setDialerLeads, user, reps, setReps, isMobile, setCrmLeads, crmLeads=[], allDeals, setAllDeals, repCallLogs, setRepCallLogs, repDialerStatus, setRepDialerStatus }) {
  const repId      = user?.isAdmin ? null : user?.id;
  const isAdmin    = !!user?.isAdmin;

  // Campaign selection (reps must pick one; admin can pick or use legacy queue)
  const [activeCampaignId, setActiveCampaignId] = useState(() => {
    if (isAdmin) return null;
    // Auto-select first active campaign assigned to this rep
    return null;
  });

  // Derive the active campaign object + its lead list
  const activeCampaign = campaigns.find(c => c.id === activeCampaignId);

  // Helpers to mutate campaign leads (shared queue)
  const setCampaignLeads = (campaignId, updater) => {
    setCampaigns(prev => prev.map(c => c.id !== campaignId ? c : {
      ...c,
      leads: typeof updater === 'function' ? updater(c.leads) : updater,
    }));
  };

  const updateCampaignStats = (campaignId, patch) => {
    setCampaigns(prev => prev.map(c => c.id !== campaignId ? c : {
      ...c, stats: { ...c.stats, ...patch },
    }));
  };

  // Multi-line dialer state — replaces old single-line state
  const [activeLines,   setActiveLines]  = useState([]);   // [{id,lead,state,timer,fromNumber}]
  const [connectedLine, setConnectedLine]= useState(null); // lineId of the live call
  const [callHistory,   setCallHistory]  = useState([]);
  const [sessionStats,  setSessionStats] = useState(()=>{
    const today = new Date().toISOString().slice(0,10);
    const saved = (() => { try { return JSON.parse(localStorage.getItem("apex_session_stats")||"{}"); } catch(e) { return {}; } })();
    return saved.date===today ? saved.stats : {calls:0,connects:0,appts:0,callbacks:0,vms:0};
  });
  const saveSession = (stats) => {
    const today = new Date().toISOString().slice(0,10);
    try { localStorage.setItem("apex_session_stats", JSON.stringify({date:today,stats})); } catch(e) {}
  };
  const [linesCount,    setLinesCount]   = useState(3);

  const [showDisp,     setShowDisp]    = useState(false);
  const [showApptForm, setShowApptForm]= useState(false);
  const [showCBForm,   setShowCBForm]  = useState(false);
  const [apptData,     setApptData]    = useState({date:"",time:"",notes:""});
  const [cbData,       setCbData]      = useState({date:"",time:"",notes:""});

  const [dialerSubTab, setDialerSubTab]= useState(isAdmin ? "command" : "dialer");
  const [telnyxKey,    setTelnyxKey]   = useState("");
  const [gmapsKey,     setGmapsKey]    = useState(() => { try { return localStorage.getItem("apex_gmaps_key")||"AIzaSyD9cYH3DhX2pcbWsSAhD5xCJsOb70fiCd8"; } catch(e) { return "AIzaSyD9cYH3DhX2pcbWsSAhD5xCJsOb70fiCd8"; } });
  const [fromNumber,   setFromNumber]  = useState("(602) 555-0100");
  const DEFAULT_SCRIPT = "Hi, is this {firstName}? Great — this is {rep} with Apex Solar. We've been helping homeowners in {city} get their electric bill down to zero. I see yours is around $" + "{bill}/month. Do you have just 2 minutes?";
  const [callScript,   setCallScript]  = useState(activeCampaign?.script || DEFAULT_SCRIPT);
  const [csvError,     setCsvError]    = useState("");

  // Caller ID pool — one distinct number per line
  const CALLER_IDS = ["(602) 555-0100","(480) 555-0200","(623) 555-0300"];

  // Legacy aliases — derived from activeLines so modals / scriptFilled still work
  const currentLead = activeLines.find(l => l.id === connectedLine)?.lead || null;
  const dialerState = connectedLine
    ? (activeLines.find(l => l.id === connectedLine)?.state || "idle")
    : activeLines.length > 0 ? "calling" : "idle";
  const callTimer   = activeLines.find(l => l.id === connectedLine)?.timer || 0;
  const isHungUp   = dialerState === 'hung_up';
  const timerRef      = useRef(null);
  const lineTimeouts  = useRef({});  // lineId -> setTimeout id

  /* ── Connected-line timer ── */
  useEffect(()=>{
    if(connectedLine){
      timerRef.current = setInterval(()=>{
        setActiveLines(prev => prev.map(l =>
          l.id === connectedLine ? {...l, timer:(l.timer||0)+1} : l
        ));
      },1000);
    } else {
      clearInterval(timerRef.current);
    }
    return ()=>clearInterval(timerRef.current);
  },[connectedLine]);

  /* ── Update script when campaign changes ── */
  useEffect(()=>{
    if(activeCampaign?.script) setCallScript(activeCampaign.script);
  },[activeCampaignId]);

  /* ── Fire N simultaneous lines with AMD simulation ── */
  const startDialingRef = useRef(null);

  const startDialing = () => {
    const alreadyDialingIds = new Set(activeLines.map(l => l.lead.id));
    const available = activeQueue.filter(q => !alreadyDialingIds.has(q.id));
    if (!available.length) return;

    const slots = linesCount - activeLines.filter(l => l.state === "calling").length;
    if (slots <= 0) return;

    const toFire = available.slice(0, slots);
    const newLines = [];

    toFire.forEach((lead, idx) => {
      const locked = lockLead(lead);
      if (!locked) return;

      const lineId    = `line-${Date.now()}-${idx}`;
      const callerNum = CALLER_IDS[idx % CALLER_IDS.length];
      newLines.push({ id:lineId, lead, state:"calling", timer:0, fromNumber:callerNum });

      // AMD outcome: 45% human, 25% voicemail, 30% no_answer
      const rand    = Math.random();
      const outcome = rand < 0.45 ? "human" : rand < 0.70 ? "voicemail" : "no_answer";
      const delay   = outcome === "human"     ? 1800 + Math.random() * 3000
                    : outcome === "voicemail" ? 3000 + Math.random() * 2000
                    :                          4000 + Math.random() * 4000;

      lineTimeouts.current[lineId] = setTimeout(()=>{
        if (outcome === "human") {
          // ── HUMAN DETECTED — connect rep, drop all other calling lines ──
          setActiveLines(prev => {
            prev.filter(l => l.id !== lineId && l.state === "calling").forEach(l => {
              clearTimeout(lineTimeouts.current[l.id]);
              delete lineTimeouts.current[l.id];
              unlockLead(l.lead.id);
            });
            return prev
              .filter(l => l.id === lineId || l.state !== "calling")
              .map(l => l.id === lineId ? {...l, state:"connected"} : l);
          });
          setConnectedLine(lineId);
          setSessionStats(s=>{ const n={...s,connects:s.connects+1}; saveSession(n); return n; });
          // Auto-open satellite roof view in new tab
          if (gmapsKey && lead?.address) {
            const enc = encodeURIComponent(lead.address);
            window.open(`https://www.google.com/maps/search/?api=1&query=${enc}&layer=satellite`, "_blank", "noopener,noreferrer");
          }
          if (usingCampaign) updateCampaignStats(activeCampaignId, {connects:(activeCampaign.stats.connects||0)+1});
          if (repId && setRepDialerStatus) setRepDialerStatus(prev=>({...prev,[Number(repId)]:"oncall"}));

        } else {
          // ── VM or NO ANSWER — silently drop, fire replacement ──
          const isVM = outcome === "voicemail";
          unlockLead(lead.id);
          delete lineTimeouts.current[lineId];
          setActiveLines(prev => prev.filter(l => l.id !== lineId));
          if (isVM) setSessionStats(s=>{ const n={...s,vms:(s.vms||0)+1}; saveSession(n); return n; });
          // Trigger top-up via ref (safe — outside React state setter)
          setTimeout(()=>{ startDialingRef.current?.(); }, 50);
        }
      }, delay);
    });

    if (newLines.length > 0) {
      setActiveLines(prev => [...prev, ...newLines]);
      setSessionStats(s=>{ const n={...s,calls:s.calls+newLines.length}; saveSession(n); return n; });
      if (usingCampaign) updateCampaignStats(activeCampaignId, {calls:(activeCampaign.stats.calls||0)+newLines.length});
      if (repId && setRepDialerStatus) setRepDialerStatus(prev=>({...prev,[Number(repId)]:"dialing"}));
    }
  };

  // Keep ref current so async callbacks always call the latest version
  useEffect(()=>{ startDialingRef.current = startDialing; });

  /* ── Hang up one specific line (skip — no disposition) ── */
  const hangUpLine = (lineId) => {
    clearTimeout(lineTimeouts.current[lineId]);
    delete lineTimeouts.current[lineId];
    setActiveLines(prev => {
      const line = prev.find(l => l.id === lineId);
      if (line) unlockLead(line.lead.id);
      return prev.filter(l => l.id !== lineId);
    });
    if (connectedLine === lineId) {
      clearInterval(timerRef.current);
      setConnectedLine(null);
    }
  };

  /* ── Hang up connected call — stops timer, shows disposition panel ── */
  const hangUpConnected = () => {
    if (!connectedLine) return;
    clearInterval(timerRef.current);
    // Mark line as hung_up — keeps lead data visible for disposition
    setActiveLines(prev => prev.map(l =>
      l.id === connectedLine ? {...l, state:"hung_up"} : l
    ));
    setShowDisp(true);
  };

  /* ── Apply disposition to connected lead ── */
  const applyDisposition = (key, extraData={}) => {
    const line = activeLines.find(l => l.id === connectedLine);
    if (!line) return;
    const lead = line.lead;

    clearInterval(timerRef.current);
    clearTimeout(lineTimeouts.current[connectedLine]);
    delete lineTimeouts.current[connectedLine];

    const isFinal = FINAL_DISPOSITIONS.has(key);
    const isCB    = key==="callback";
    const isAppt  = key==="appointment";
    const dispInfo = DIALER_DISPOSITIONS.find(d=>d.key===key);

    setCallHistory(h=>[{
      ...lead, duration:line.timer||0,
      result:key, resultLabel:dispInfo?.label||key,
      time:new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}),
      repName:repObj?.name||"Admin",
      repId: repId || "admin",
      recordingUrl: null, // Twilio will populate this later
      ...(isAppt?{apptDate:extraData.date,apptTime:extraData.time,apptNotes:extraData.notes}:{}),
      ...(isCB  ?{cbDate:extraData.date,  cbTime:extraData.time,  cbNotes:extraData.notes}:{}),
    },...h].slice(0,100));

    // ── Push into global call log (admin Command Center reads this) ──
    if (repId && setRepCallLogs) {
      const entry = {
        id: `call-${Date.now()}`,
        name:       lead.name || "Unknown",
        phone:      lead.phone || "",
        address:    lead.address || "",
        duration:   line.timer || 0,
        result:     key,
        resultLabel:dispInfo?.label || key,
        time:       new Date().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}),
        timestamp:  Date.now(),
        startedAt:  Date.now() - ((line.timer||0) * 1000),
        repName:    repObj?.name || "Rep",
        repId:      Number(repId),
        recordingUrl: null,
        ...(isAppt?{apptDate:extraData.date,apptTime:extraData.time}:{}),
        ...(isCB  ?{cbDate:extraData.date,  cbTime:extraData.time} :{}),
      };
      setRepCallLogs(prev => ({
        ...prev,
        [Number(repId)]: [entry, ...(prev[Number(repId)] || [])].slice(0, 500),
      }));
    }

    // ── Update rep live status back to idle ──
    if (repId && setRepDialerStatus) {
      setRepDialerStatus(prev => ({...prev, [Number(repId)]: "idle"}));
    }

    const leadUpdate = l => {
      if (l.id !== lead.id) return l;
      if (isFinal) return {...l, lockedBy:null, status:"done", disposition:key,
        assignedTo:isAppt?(repId||"admin"):l.assignedTo,
        apptDate:isAppt?extraData.date:l.apptDate,
        apptTime:isAppt?extraData.time:l.apptTime,
        apptNotes:isAppt?extraData.notes:l.apptNotes,
      };
      if (isCB) return {...l, lockedBy:null, status:"callback", disposition:key,
        callbackTime:`${extraData.date}T${extraData.time}`,
        callbackRepId:repId||"admin", callbackNotes:extraData.notes,
        attempts:(l.attempts||0)+1,
      };
      return {...l, lockedBy:null, status:"queued", attempts:(l.attempts||0)+1, disposition:key};
    };

    if (usingCampaign) {
      setCampaignLeads(activeCampaignId, prev => prev.map(leadUpdate));
      if (isAppt) updateCampaignStats(activeCampaignId, {appts:(activeCampaign.stats.appts||0)+1});
      if (isCB)   updateCampaignStats(activeCampaignId, {callbacks:(activeCampaign.stats.callbacks||0)+1});
    } else {
      setDialerLeads(prev => prev.map(leadUpdate));
    }

    if(isAppt) setSessionStats(s=>{ const n={...s,appts:s.appts+1}; saveSession(n); return n; });
    if(isCB)   setSessionStats(s=>{ const n={...s,callbacks:s.callbacks+1}; saveSession(n); return n; });

    // ── Increment rep's global appts count (single source of truth) ──
    if (isAppt && setReps && repId) {
      setReps(prev => prev.map(r => r.id === repId
        ? { ...r, appts: (r.appts || 0) + 1 }
        : r
      ));
    }

    // ── Push appointment into CRM ──
    if (isAppt && setCrmLeads) {
      const nameParts = lead.name?.split(" ") || ["Unknown"];
      const newCrmLead = {
        id: `D${Date.now()}`,
        firstName:    nameParts[0] || "Unknown",
        lastName:     nameParts.slice(1).join(" ") || "",
        phone:        lead.phone || "",
        email:        "",
        address:      extraData.address ? extraData.address.split(",")[0]?.trim() : (lead.address?.split(",")[0] || ""),
        city:         extraData.address ? (extraData.address.split(",")[1]?.trim()||"") : (lead.address?.split(",")[1]?.trim() || ""),
        state:        extraData.address ? (extraData.address.split(",")[2]?.trim()?.split(" ")[0]||"AZ") : "AZ",
        zip:          extraData.address ? (extraData.address.match(/\b\d{5}\b/)?.[0]||"") : "",
        utilityBill:  lead.billEst || 0,
        roofAge:      0,
        roofType:     "Unknown",
        shade:        "Unknown",
        homeowner:    true,
        hoa:          false,
        creditScore:  "Unknown",
        stage:        "appt_set",
        assignedTo:   repId ? Number(repId) : (reps[0]?.id || 1),
        notes:        extraData.notes || `Appt set via dialer${extraData.date ? " · " + extraData.date : ""}${extraData.time ? " @ " + extraData.time : ""}`,
        source:       lead.source || "dialer",
        tags:         ["dialer"],
        lastContact:  new Date().toISOString().slice(0,10),
        apptDate:     extraData.date || "",
        kw:           0,
        salePrice:    0,
        financing:    "loan",
        lender:       "",
        adders:       [],
        created:      new Date().toISOString().slice(0,10),
      };
      setCrmLeads(prev => [newCrmLead, ...prev]);

      // ── Also create a deal in allDeals so it appears in the setter's Deals tab
      //    and is immediately counted in leaderboard stats (appts, revenue pipeline)
      if (setAllDeals && repId) {
        const setterId = Number(repId);
        const newDeal = {
          id:            Date.now(),
          customer:      [nameParts[0], nameParts.slice(1).join(" ")].filter(Boolean).join(" ") || "Unknown",
          phone:         lead.phone || "",
          email:         "",
          address:       lead.address || "",
          kw:            0,
          price:         0,
          commission:    0,
          monthlyBill:   extraData.ub ? Number(extraData.ub) : (lead.billEst || 0),
          lastContacted: new Date().toISOString().slice(0,10),
          apptDate:      extraData.date || new Date().toISOString().slice(0,10),
          status:        "appt",           // enters pipeline at Appt Set stage
          adders:        [],
          notes:        [extraData.utilityCompany ? `Utility: ${extraData.utilityCompany}` : "",extraData.ub ? `$${extraData.ub}/mo` : "",extraData.callNotes || extraData.notes || ""].filter(Boolean).join(" · ") || `Set via dialer${extraData.date ? " · Appt " + extraData.date : ""}`,
          source:        lead.source || "dialer",
          setterId:      setterId,          // permanent link back to the setter
          dialerLeadId:  lead.id,          // traceability back to the original lead
          createdAt:     new Date().toISOString(),
        };
        setAllDeals(prev => ({
          ...prev,
          [setterId]: [newDeal, ...(prev[setterId] || [])],
        }));
      }
    }

    setActiveLines(prev => prev.filter(l => l.id !== connectedLine));
    setConnectedLine(null);
    setShowDisp(false); setShowApptForm(false); setShowCBForm(false);
    setApptData({date:"",time:"",notes:""}); setCbData({date:"",time:"",notes:""});
    // Auto-restart dialing
    setTimeout(()=>{ startDialingRef.current?.(); }, 400);
  };

  /* ── Skip connected lead ── */
  const skipLead = () => {
    if (connectedLine) { hangUpLine(connectedLine); return; }
    const first = activeLines[0];
    if (first) hangUpLine(first.id);
  };

  /* ── Re-queue callback ── */
  const reQueueCallback = (leadId) => {
    const patch = {status:"queued",callbackTime:null,callbackRepId:null,disposition:null};
    if (usingCampaign) {
      setCampaignLeads(activeCampaignId, prev => prev.map(l => l.id===leadId?{...l,...patch}:l));
    } else {
      setDialerLeads(prev => prev.map(l => l.id===leadId?{...l,...patch}:l));
    }
  };

  /* ── CSV Upload ── */
  const handleCSV = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target.result);
        if(!parsed.length){ setCsvError("No valid rows. Check CSV has a 'phone' column."); return; }
        const existing = new Set(dialerLeads.map(l=>l.phone));
        const newLeads = parsed.filter(l=>!existing.has(l.phone));
        setDialerLeads(prev=>[...prev,...newLeads]);
        setCsvError(`✓ Imported ${newLeads.length} leads (${parsed.length-newLeads.length} duplicates skipped)`);
      } catch(err) { setCsvError("Error: "+err.message); }
    };
    reader.readAsText(file);
    e.target.value='';
  };

  /* ── Update script when campaign changes ── */
  useEffect(()=>{
    if(activeCampaign?.script) setCallScript(activeCampaign.script);
  },[activeCampaignId]);

  /* ── Compute the active queue ──
     Campaign mode: use campaign leads (shared queue, per-campaign)
     Admin legacy mode (no campaign selected): use top-level dialerLeads
  */
  const campaignLeads  = activeCampaign?.leads || [];
  const usingCampaign  = !!activeCampaign;
  const showDialerContent = !!(isAdmin || activeCampaignId);

  const activeQueue = usingCampaign
    ? campaignLeads.filter(l => l.status==="queued" && !l.lockedBy && !FINAL_DISPOSITIONS.has(l.disposition))
    : dialerLeads.filter(l => l.status==="queued" && l.lockedBy===null && !FINAL_DISPOSITIONS.has(l.disposition));

  const myCallbacks = usingCampaign
    ? campaignLeads.filter(l => l.status==="callback" && l.callbackRepId===(repId||"admin"))
    : dialerLeads.filter(l => l.status==="callback" && l.callbackRepId===(repId||"admin"));

  const allCallbacks = usingCampaign
    ? campaignLeads.filter(l => l.status==="callback")
    : dialerLeads.filter(l => l.status==="callback");

  const repObj = reps.find(r => r.id===repId);

  /* ── Lock a lead (optimistic — check then set) ── */
  const lockLead = (lead) => {
    if (usingCampaign) {
      const fresh = activeCampaign.leads.find(l => l.id===lead.id);
      if (!fresh || fresh.lockedBy !== null) return false;
      setCampaignLeads(activeCampaignId, prev => prev.map(l => l.id===lead.id ? {...l, lockedBy:repId||"admin"} : l));
      return true;
    } else {
      const fresh = dialerLeads.find(l => l.id===lead.id);
      if (!fresh || fresh.lockedBy !== null) return false;
      setDialerLeads(prev => prev.map(l => l.id===lead.id ? {...l, lockedBy:repId||"admin"} : l));
      return true;
    }
  };

  const unlockLead = (leadId) => {
    if (usingCampaign) {
      setCampaignLeads(activeCampaignId, prev => prev.map(l => l.id===leadId ? {...l, lockedBy:null} : l));
    } else {
      setDialerLeads(prev => prev.map(l => l.id===leadId ? {...l, lockedBy:null} : l));
    }
  };

  const connectRate = sessionStats.calls>0?Math.round((sessionStats.connects/sessionStats.calls)*100):0;
  const isDialing   = activeLines.length > 0;
  const isConnected = !!connectedLine;  // true for both "connected" and "hung_up"

  const scriptFilled = (activeCampaign?.script || callScript)
    .replace(/{firstName}/g, currentLead?.name?.split(" ")[0]||"there")
    .replace(/{rep}/g,       repObj?.name?.split(" ")[0]||"your rep")
    .replace(/{city}/g,      currentLead?.address?.split(",").slice(-2,-1)[0]?.trim()||"your area")
    .replace(/\${bill}/g,    currentLead?.billEst||0)
    .replace(/{bill}/g,      currentLead?.billEst||0);

  /* ════════════════════════════════════════
     RENDER
  ════════════════════════════════════════ */
  return (
    <div className="afu" style={{opacity:0}}>

      {/* ── Rep: must pick a campaign before dialing ── */}
      {!isAdmin && !activeCampaignId && (
        <CampaignSelector campaigns={campaigns} repId={repId} activeCampaignId={activeCampaignId} onSelect={setActiveCampaignId}/>
      )}

      {/* ── Rep: has a campaign selected ── */}
      {!isAdmin && activeCampaignId && (
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"10px 16px",background:"rgba(6,214,240,0.06)",border:"1px solid rgba(6,214,240,0.2)",borderRadius:12,backdropFilter:"blur(20px)"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:T.cyan,animation:"pulse 2s ease infinite",flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:T.cyan,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{activeCampaign?.name||"Campaign"}</div>
            <div style={{fontSize:11,color:T.t3,marginTop:1}}>{activeQueue.length} leads queued · shared queue</div>
          </div>
          <button onClick={()=>{if(!isDialing){activeLines.forEach(l=>unlockLead(l.lead.id));setActiveLines([]);setConnectedLine(null);setActiveCampaignId(null);}}} style={{fontSize:11,color:T.t3,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"5px 11px",cursor:"pointer",fontFamily:"'Inter',system-ui,sans-serif",flexShrink:0}}>Switch</button>
        </div>
      )}

      {/* ── Dialer content: shown when rep has campaign or is admin ── */}

      {/* ── Sub-tab nav ── */}
      <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",borderBottom:`1px solid rgba(255,255,255,0.04)`,paddingBottom:12}}>
        {(isAdmin
          ? [{k:"command",l:"📡 Command Center"},{k:"campaigns",l:"📋 Campaigns"},{k:"upload",l:"📥 Upload"},{k:"settings",l:"⚙ Settings"}]
          : [{k:"dialer",l:"⚡ Dialer"},{k:"callbacks",l:`🔁 My Callbacks${myCallbacks.length?` (${myCallbacks.length})`:""}`}]
        ).map(({k,l})=>(
          <button key={k} className={`tab-nav-btn${dialerSubTab===k?" on":""}`} style={{fontSize:12.5,padding:"6px 14px"}} onClick={()=>setDialerSubTab(k)}>{l}</button>
        ))}
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 11px",borderRadius:20,background:telnyxKey?T.cyanDm:T.redDm,border:`1px solid ${telnyxKey?T.cyan:T.red}33`,fontSize:11,fontWeight:600,color:telnyxKey?T.cyan:T.red,flexShrink:0}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:telnyxKey?T.cyan:T.red}}/>
          {telnyxKey?"Live":"Demo Mode"}
        </div>
      </div>

      {/* ══ COMMAND CENTER SUB-TAB (admin only) ══ */}
      {dialerSubTab==="command" && isAdmin && (
        <DialerCommandCenter
          reps={reps}
          repCallLogs={repCallLogs}
          repDialerStatus={repDialerStatus}
          campaigns={campaigns}
          isMobile={isMobile}
        />
      )}

      {/* ══ CAMPAIGNS SUB-TAB (admin only) ══ */}
      {dialerSubTab==="campaigns" && isAdmin && (
        <CampaignsTab campaigns={campaigns} setCampaigns={setCampaigns} reps={reps} isMobile={isMobile}/>
      )}

      {/* ══ DIALER SUB-TAB ══ */}
      {dialerSubTab==="dialer" && !isAdmin && (
        <div style={{maxWidth:560,margin:"0 auto",width:"100%"}}>

          {/* Session stats strip */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
            {[
              {label:"Dialed",    val:sessionStats.calls,   color:T.t1},
              {label:"Humans",    val:sessionStats.connects, color:T.green},
              {label:"Appts",     val:sessionStats.appts,    color:T.green},
              {label:"VMs Dropped", val:sessionStats.vms||0, color:T.t3},
            ].map(({label,val,color})=>(
              <div key={label} style={{
                background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:12,padding:"10px 12px",textAlign:"center",
                backdropFilter:"blur(20px)",boxShadow:"0 1px 0 rgba(255,255,255,0.06) inset",
              }}>
                <div className="caps" style={{fontSize:8,marginBottom:4,color:T.t3}}>{label}</div>
                <div className="mono" style={{fontSize:20,fontWeight:700,color,lineHeight:1}}>{val}</div>
              </div>
            ))}
          </div>

          {/* ── IDLE ── */}
          {!isDialing && !isConnected && (
            <div style={{
              background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:24,padding:"48px 32px",textAlign:"center",
              backdropFilter:"blur(40px)",
              boxShadow:"0 1px 0 rgba(255,255,255,0.07) inset, 0 8px 32px rgba(0,0,0,0.3)",
              position:"relative",overflow:"hidden",
            }}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.14) 50%,transparent)"}}/>
              <div style={{fontSize:48,marginBottom:16,opacity:0.2}}>📞</div>
              <div style={{fontWeight:800,fontSize:20,color:T.t1,marginBottom:8,letterSpacing:"-0.03em"}}>
                Power Dialer
              </div>
              <div style={{fontSize:13,color:T.t3,marginBottom:6}}>
                {activeQueue.length} leads in queue
              </div>
              <div style={{fontSize:11,color:T.t3,opacity:0.6,marginBottom:28}}>
                Simultaneously dials {linesCount} numbers · voicemails skipped automatically · humans connected instantly
              </div>
              {activeQueue.length===0
                ? <div style={{fontSize:13,color:T.t3,padding:"12px 20px",background:"rgba(255,255,255,0.03)",borderRadius:10,display:"inline-block",border:"1px solid rgba(255,255,255,0.06)"}}>
                    Queue empty — upload leads or check campaign
                  </div>
                : <button className="btn-cyan" onClick={startDialing} style={{maxWidth:280,margin:"0 auto",fontSize:15,padding:"15px 28px"}}>
                    ▶ Start Dialing
                  </button>
              }
            </div>
          )}

          {/* ── MANUAL KEYPAD — visible when idle or dialing (not on live call) ── */}
          {!isConnected && <ManualKeypad repObj={repObj} repId={repId} reps={reps} setReps={setReps} setAllDeals={setAllDeals} setCrmLeads={setCrmLeads} crmLeads={crmLeads} isMobile={isMobile}/>}

          {/* ── DIALING (AMD running, no human yet) ── */}
          {isDialing && !isConnected && (
            <div style={{
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.08)",
              borderRadius:24,padding:"48px 32px",textAlign:"center",
              backdropFilter:"blur(40px)",
              boxShadow:"0 1px 0 rgba(255,255,255,0.07) inset, 0 8px 32px rgba(0,0,0,0.3)",
              position:"relative",overflow:"hidden",
            }}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,
                background:"linear-gradient(90deg,transparent,rgba(6,214,240,0.6) 50%,transparent)",
                animation:"barGrow 0.6s ease"}}/>
              {/* Animated pulse rings */}
              <div style={{position:"relative",width:80,height:80,margin:"0 auto 20px"}}>
                <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(6,214,240,0.3)",animation:"ping 1.4s ease-out infinite"}}/>
                <div style={{position:"absolute",inset:8,borderRadius:"50%",border:"2px solid rgba(6,214,240,0.5)",animation:"ping 1.4s ease-out infinite 0.4s"}}/>
                <div style={{
                  position:"absolute",inset:18,borderRadius:"50%",
                  background:"rgba(6,214,240,0.12)",border:"2px solid rgba(6,214,240,0.6)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
                }}>📞</div>
              </div>
              <div style={{fontWeight:800,fontSize:22,color:T.cyan,marginBottom:8,letterSpacing:"-0.03em"}}>
                Dialing…
              </div>
              <div style={{fontSize:12,color:T.t3,marginBottom:6}}>
                Scanning {activeLines.length} line{activeLines.length!==1?"s":""} · detecting human voice
              </div>
              <div style={{fontSize:11,color:T.t3,opacity:0.5,marginBottom:28}}>
                Voicemails are automatically skipped
              </div>
              <button onClick={()=>{
                activeLines.forEach(l=>{
                  clearTimeout(lineTimeouts.current[l.id]);
                  delete lineTimeouts.current[l.id];
                  unlockLead(l.lead.id);
                });
                setActiveLines([]);
                setConnectedLine(null);
              }} style={{
                background:"transparent",border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:10,padding:"9px 22px",color:T.t3,fontSize:12,fontWeight:500,
                cursor:"pointer",fontFamily:"'Inter',system-ui,sans-serif",
              }}>■ Stop</button>
            </div>
          )}

          {/* ── HUMAN DETECTED — live call ── */}
          {isConnected && currentLead && (
            <div style={{
              background:"rgba(255,255,255,0.04)",
              border:`1px solid ${isHungUp?"rgba(255,255,255,0.12)":T.green+"55"}`,
              borderRadius:24,padding:"28px",
              backdropFilter:"blur(40px)",
              boxShadow:isHungUp
                ? "0 1px 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.3)"
                : `0 1px 0 rgba(255,255,255,0.08) inset, 0 0 48px rgba(48,209,88,0.1), 0 8px 32px rgba(0,0,0,0.3)`,
              position:"relative",overflow:"hidden",
              animation:"fadeUp 0.35s ease",
            }}>
              {/* Top bar */}
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,
                background:isHungUp
                  ? "linear-gradient(90deg,transparent,rgba(255,255,255,0.2) 50%,transparent)"
                  : `linear-gradient(90deg,transparent,${T.green} 50%,transparent)`}}/>

              {/* Status badge */}
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:18}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:isHungUp?T.t3:T.green,animation:isHungUp?"none":"pulse 1.5s ease infinite"}}/>
                <span style={{fontSize:10.5,fontWeight:700,color:isHungUp?T.t3:T.green,letterSpacing:"0.08em"}}>
                  {isHungUp ? "CALL ENDED — LOG DISPOSITION" : "HUMAN DETECTED — LIVE"}
                </span>
                <div style={{flex:1}}/>
                <div className="mono" style={{fontSize:22,fontWeight:800,color:isHungUp?T.t3:T.green}}>{fmtTimer(callTimer)}</div>
              </div>

              {/* Homeowner info card */}
              <div style={{
                background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:16,padding:"18px 20px",marginBottom:18,
              }}>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                  {/* Avatar */}
                  <div style={{
                    width:52,height:52,borderRadius:14,flexShrink:0,
                    background:T.greenDm,border:`2px solid ${T.green}44`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:17,fontWeight:800,color:T.green,
                    fontFamily:"'JetBrains Mono',monospace",
                  }}>
                    {currentLead.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:20,color:T.t1,letterSpacing:"-0.03em",marginBottom:2}}>{currentLead.name}</div>
                    <div style={{fontSize:13,color:T.t2}}>{currentLead.phone}</div>
                  </div>
                </div>

                {/* Address — large and prominent */}
                {currentLead.address && (
                  <div style={{
                    background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",
                    borderRadius:10,padding:"10px 14px",marginBottom:10,
                  }}>
                    <div className="caps" style={{fontSize:8,color:T.t3,marginBottom:4}}>Property Address</div>
                    <div style={{fontWeight:700,fontSize:16,color:T.t1,letterSpacing:"-0.01em",lineHeight:1.3}}>{currentLead.address}</div>
                  </div>
                )}

                {/* Roof satellite view — iframe on Vercel, links in claude.ai sandbox */}
                {currentLead.address && (() => {
                  const enc        = encodeURIComponent(currentLead.address);
                  const isSandbox  = !window.location.hostname || window.location.hostname === "" || window.location.hostname.includes("claude.ai");
                  const embedUrl   = gmapsKey ? `https://www.google.com/maps/embed/v1/place?key=${gmapsKey}&q=${enc}&maptype=satellite&zoom=20` : null;
                  const mapsUrl    = `https://www.google.com/maps/search/?api=1&query=${enc}&layer=satellite`;
                  const streetUrl  = `https://www.google.com/maps/@?api=1&map_action=pano&parameters=4h${enc}`;
                  const linkStyle  = (bg, border, color) => ({
                    flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                    background:bg, border:`1px solid ${border}`, borderRadius:8, padding:"7px 10px",
                    color, fontWeight:700, fontSize:12, textDecoration:"none",
                    fontFamily:"'Inter',system-ui,sans-serif",
                  });
                  return (
                    <div style={{marginBottom:12}}>
                      {gmapsKey && !isSandbox ? (
                        <div style={{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)"}}>
                          <iframe
                            title="Roof satellite view"
                            src={embedUrl}
                            width="100%" height="200"
                            style={{border:"none",display:"block"}}
                            loading="eager"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                            style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,0.7)",borderRadius:5,padding:"3px 9px",color:"rgba(255,255,255,0.85)",fontSize:10,textDecoration:"none",fontFamily:"'Inter',system-ui,sans-serif"}}>
                            Open in Maps ↗
                          </a>
                        </div>
                      ) : gmapsKey && isSandbox ? (
                        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px"}}>
                          <div style={{fontSize:10.5,color:T.amber,fontWeight:600,marginBottom:8}}>🛰 Satellite view will load inline once deployed to Vercel</div>
                          <div style={{display:"flex",gap:7}}>
                            <a href={mapsUrl}   target="_blank" rel="noopener noreferrer" style={linkStyle("rgba(6,214,240,0.08)","rgba(6,214,240,0.25)",T.cyan)}>🛰 Satellite</a>
                            <a href={streetUrl} target="_blank" rel="noopener noreferrer" style={linkStyle("rgba(255,255,255,0.05)","rgba(255,255,255,0.1)",T.t2)}>📍 Street View</a>
                          </div>
                        </div>
                      ) : (
                        <div style={{display:"flex",gap:7}}>
                          <a href={mapsUrl}   target="_blank" rel="noopener noreferrer" style={linkStyle("rgba(6,214,240,0.08)","rgba(6,214,240,0.25)",T.cyan)}>🛰 Satellite View</a>
                          <a href={streetUrl} target="_blank" rel="noopener noreferrer" style={linkStyle("rgba(255,255,255,0.05)","rgba(255,255,255,0.1)",T.t2)}>📍 Street View</a>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Key stats — bill + attempts only */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[
                    {label:"Monthly Bill", val:`$${currentLead.billEst||"—"}`, color:(currentLead.billEst||0)>=300?T.green:T.amber},
                    {label:"Attempts",     val:currentLead.attempts||0,        color:(currentLead.attempts||0)>=3?T.red:(currentLead.attempts||0)>0?T.amber:T.green},
                  ].map(({label,val,color})=>(
                    <div key={label} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:10,padding:"9px 12px",textAlign:"center"}}>
                      <div className="caps" style={{fontSize:8,marginBottom:4,color:T.t3}}>{label}</div>
                      <div style={{fontSize:13,fontWeight:700,color}}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live script */}
              <div style={{
                background:"rgba(48,209,88,0.05)",border:"1px solid rgba(48,209,88,0.15)",
                borderRadius:12,padding:"14px 16px",marginBottom:18,
              }}>
                <div className="caps" style={{fontSize:8,color:T.green,marginBottom:6}}>Live Script</div>
                <div style={{fontSize:13,color:T.t2,lineHeight:1.8,fontStyle:"italic"}}>"{scriptFilled}"</div>
              </div>

              {/* Action buttons */}
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setShowDisp(true)} style={{
                  flex:1,background:isHungUp?"rgba(255,255,255,0.08)":T.green,border:isHungUp?"1px solid rgba(255,255,255,0.15)":"none",borderRadius:12,padding:"15px",
                  color:isHungUp?T.t1:"#021014",fontWeight:800,fontSize:15,cursor:"pointer",
                  fontFamily:"'Inter',system-ui,sans-serif",letterSpacing:"-0.01em",
                  boxShadow:isHungUp?"none":`0 4px 20px rgba(48,209,88,0.35)`,
                }}>✓ {isHungUp ? "Log Disposition" : "Disposition Call"}</button>
                {!isHungUp && (
                  <button onClick={hangUpConnected} style={{
                    background:T.redDm,border:`1px solid ${T.red}44`,borderRadius:12,
                    padding:"15px 18px",color:T.red,fontWeight:700,fontSize:13,cursor:"pointer",
                    fontFamily:"'Inter',system-ui,sans-serif",whiteSpace:"nowrap",
                  }}>✕ Hang Up</button>
                )}
                <button onClick={()=>{ hangUpLine(connectedLine); setTimeout(()=>startDialingRef.current?.(), 300); }} style={{
                  background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,
                  padding:"15px 14px",color:T.t3,fontWeight:600,fontSize:12,cursor:"pointer",
                  fontFamily:"'Inter',system-ui,sans-serif",whiteSpace:"nowrap",
                }} title="Skip — hang up without dispositioning and keep dialing">⏭</button>
              </div>
            </div>
          )}

          {/* Session log */}
          {callHistory.length>0 && !isConnected && (
            <div style={{
              marginTop:12,background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"16px",
            }}>
              <div style={{fontWeight:700,fontSize:12,color:T.t2,marginBottom:10,letterSpacing:"-0.01em"}}>
                Session Log <span className="mono" style={{fontSize:11,color:T.t3,fontWeight:400}}>({callHistory.length})</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:200,overflowY:"auto"}}>
                {callHistory.map((call,i)=>{
                  const d=DIALER_DISPOSITIONS.find(x=>x.key===call.result);
                  const col=d?.color||T.t3;
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12.5,fontWeight:600,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{call.name}</div>
                        <div style={{fontSize:10.5,color:T.t3}}>{call.time}</div>
                      </div>
                      <span className="mono" style={{fontSize:11,color:T.t3,flexShrink:0}}>{fmtTimer(call.duration||0)}</span>
                      <span style={{fontSize:10.5,fontWeight:700,padding:"2px 8px",borderRadius:5,
                        background:`${col}18`,color:col,border:`1px solid ${col}33`,flexShrink:0}}>
                        {d?.icon||""} {call.resultLabel||call.result}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ CALLBACKS SUB-TAB ══ */}
      {dialerSubTab==="callbacks" && !isAdmin && (
        <CallbacksView
          callbacks={isAdmin?allCallbacks:myCallbacks}
          reps={reps}
          isAdmin={isAdmin}
          repId={repId}
          onReQueue={reQueueCallback}
          onDisposition={(leadId,key)=>{
            const patch = {status:"done",disposition:key,lockedBy:null,
              assignedTo: key==="appointment"?(repId||"admin"):undefined};
            if (usingCampaign) {
              setCampaignLeads(activeCampaignId, prev=>prev.map(l=>l.id!==leadId?l:{...l,...patch}));
            } else {
              setDialerLeads(prev=>prev.map(l=>l.id!==leadId?l:{...l,...patch}));
            }
          }}
          isMobile={isMobile}
        />
      )}

      {/* ══ CSV UPLOAD SUB-TAB (admin only) ══ */}
      {dialerSubTab==="upload" && isAdmin && (
        <UploadLeadsPanel
          campaigns={campaigns}
          setCampaigns={setCampaigns}
          dialerLeads={dialerLeads}
          setDialerLeads={setDialerLeads}
        />
      )}

      {/* ══ SETTINGS SUB-TAB (admin only) ══ */}
      {dialerSubTab==="settings" && isAdmin && (
        <div style={{maxWidth:540}}>
          <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:14,padding:"24px"}}>
            <div style={{fontWeight:700,fontSize:15,color:T.t1,marginBottom:4,letterSpacing:"-0.02em"}}>Dialer Settings</div>
            <div style={{fontSize:12.5,color:T.t3,marginBottom:20}}>Telnyx API & script configuration</div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div className="caps" style={{marginBottom:5}}>Telnyx API Key</div>
                <input className="hinput" type="password" value={telnyxKey} onChange={e=>setTelnyxKey(e.target.value)} placeholder="KEY017xxxxxxxxxxxxxxxx"/>
                <div style={{fontSize:11,color:T.t3,marginTop:4}}>Find in your Telnyx portal → API Keys</div>
              </div>
              <div>
                <div className="caps" style={{marginBottom:5}}>Google Maps API Key</div>
                <input className="hinput" type="password" value={gmapsKey}
                  onChange={e=>{ setGmapsKey(e.target.value); try{localStorage.setItem("apex_gmaps_key",e.target.value);}catch(err){} }}
                  placeholder="AIzaSy…"/>
                <div style={{fontSize:11,color:T.t3,marginTop:4}}>
                  Enables live satellite roof view on every connected call.{" "}
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={{color:T.cyan,textDecoration:"none"}}>Get a free key →</a>
                  {" "}Enable "Maps Static API" in your Google Cloud console.
                </div>
              </div>
              <div>
                <div className="caps" style={{marginBottom:5}}>Outbound Caller ID</div>
                <input className="hinput" value={fromNumber} onChange={e=>setFromNumber(e.target.value)} placeholder="(602) 555-0100"/>
              </div>
              <div>
                <div className="caps" style={{marginBottom:5}}>Call Opener Script</div>
                <div style={{fontSize:10.5,color:T.t3,marginBottom:5}}>Variables: <span style={{color:T.amber}}>{"{firstName}"} {"{rep}"} {"{city}"} {"{bill}"}</span></div>
                <textarea className="hinput" rows={4} value={callScript} onChange={e=>setCallScript(e.target.value)} style={{resize:"vertical",minHeight:88,fontSize:12.5}}/>
              </div>
              <button className="btn-cyan" onClick={()=>setDialerSubTab("dialer")}>Save & Return to Dialer</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DISPOSITION MODAL ══ */}
      {showDisp && currentLead && (
        <div className="moverlay" onClick={()=>setShowDisp(false)}>
          <div className="mpanel" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            <div style={{fontWeight:800,fontSize:18,color:T.t1,marginBottom:2,letterSpacing:"-0.03em"}}>Disposition Call</div>
            <div style={{fontSize:12.5,color:T.t3,marginBottom:18}}>
              {currentLead.name} · {currentLead.phone} · <span className="mono" style={{color:T.amber}}>{fmtTimer(callTimer)}</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {DIALER_DISPOSITIONS.map(d=>(
                <button key={d.key} onClick={()=>{
                  setShowDisp(false);
                  if(d.key==="appointment"){ setShowApptForm(true); return; }
                  if(d.key==="callback")  { setShowCBForm(true);   return; }
                  applyDisposition(d.key);
                }} style={{
                  padding:"14px 10px",borderRadius:11,
                  border:`1px solid ${d.color}44`,
                  background:d.hot?`${d.color}20`:`${d.color}0e`,
                  color:d.color,fontWeight:700,fontSize:13,cursor:"pointer",
                  fontFamily:"'Inter',system-ui,sans-serif",transition:"all 0.14s",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                  boxShadow:d.hot?`0 0 0 1px ${d.color}33 inset`:"none",
                }}>
                  <span style={{fontSize:18}}>{d.icon}</span>
                  <span>{d.label}</span>
                </button>
              ))}
            </div>
            <button className="btn-out" style={{width:"100%",marginTop:14}} onClick={()=>setShowDisp(false)}>← Back to Call</button>
          </div>
        </div>
      )}

      {/* ══ APPOINTMENT FORM MODAL ══ */}
      {showApptForm && currentLead && (
        <div className="moverlay">
          <div className="mpanel" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:40,height:40,borderRadius:10,background:T.cyanDm,border:`1px solid rgba(6,214,240,0.35)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📅</div>
              <div>
                <div style={{fontWeight:800,fontSize:16,color:T.t1,letterSpacing:"-0.02em"}}>Book Appointment</div>
                <div style={{fontSize:12,color:T.t3}}>{currentLead.name} · {currentLead.phone}</div>
              </div>
            </div>
            <div style={{background:T.cyanDm,border:`1px solid rgba(6,214,240,0.25)`,borderRadius:9,padding:"10px 14px",marginBottom:16}}>
              <div style={{fontSize:12,color:T.cyan,fontWeight:600}}>✓ This lead will be assigned to you and added to your lead list.</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:0,maxHeight:"68vh",overflowY:"auto",paddingRight:2}}>

              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:T.red,marginBottom:10}}>Required</div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <div className="caps" style={{marginBottom:5}}>Avg Monthly Bill <span style={{color:T.red}}>*</span></div>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:T.t3,fontSize:13,fontWeight:600,pointerEvents:"none"}}>$</span>
                    <input className="hinput" type="number" min="0" value={apptData.ub} onChange={e=>setApptData(p=>({...p,ub:e.target.value}))} placeholder="280" style={{paddingLeft:22}} autoFocus/>
                  </div>
                </div>
                <div>
                  <div className="caps" style={{marginBottom:5}}>Utility Company <span style={{color:T.red}}>*</span></div>
                  <input className="hinput" value={apptData.utilityCompany} onChange={e=>setApptData(p=>({...p,utilityCompany:e.target.value}))} placeholder="APS, SRP, TEP…"/>
                </div>
              </div>

              <div style={{marginBottom:14}}>
                <div className="caps" style={{marginBottom:5}}>Property Address <span style={{color:T.red}}>*</span></div>
                <input className="hinput" value={apptData.address !== undefined ? apptData.address : (currentLead?.address||"")}
                  onChange={e=>setApptData(p=>({...p,address:e.target.value}))}
                  placeholder={currentLead?.address||"Street address"}/>
                {currentLead?.address && apptData.address === "" && (
                  <div style={{fontSize:10,color:T.t3,marginTop:3}}>Pre-filled from lead — edit if the address is different</div>
                )}
              </div>

              <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:14}}/>

              <div style={{marginBottom:12}}>
                <div className="caps" style={{marginBottom:5}}>Appointment Date <span style={{color:T.red}}>*</span></div>
                <DatePickerDropdown
                  value={apptData.date}
                  onChange={d=>setApptData(p=>({...p,date:d,time:""}))}
                  minDate={new Date().toISOString().slice(0,10)}
                />
              </div>

              <div style={{marginBottom:14}}>
                <TimeSlotPicker
                  date={apptData.date}
                  selected={apptData.time}
                  onSelect={t=>setApptData(p=>({...p,time:t}))}
                  crmLeads={crmLeads}
                  address={apptData.address || currentLead?.address || ""}
                />
              </div>

              <div style={{height:1,background:"rgba(255,255,255,0.06)",marginBottom:14}}/>

              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:T.t3,marginBottom:10}}>Call Notes <span style={{color:T.red}}>*</span></div>
              <textarea className="hinput" rows={3} value={apptData.callNotes} onChange={e=>setApptData(p=>({...p,callNotes:e.target.value}))}
                placeholder="How'd the call go? Objections, warm signals, family situation, roof condition…"
                style={{resize:"vertical",minHeight:72}}/>
            </div>

            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button className="btn-cyan" style={{flex:1}}
                disabled={!apptData.date||!apptData.time||!apptData.ub||!apptData.utilityCompany||!apptData.callNotes||(!(apptData.address!==undefined?apptData.address:currentLead?.address))}
                onClick={()=>applyDisposition("appointment",{...apptData, address:apptData.address!==undefined?apptData.address:(currentLead?.address||"")})}>
                ✓ Confirm Appointment
              </button>
              <button className="btn-out" onClick={()=>{setShowApptForm(false);setShowDisp(true);}}>← Back</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CALLBACK FORM MODAL ══ */}
      {showCBForm && currentLead && (
        <div className="moverlay">
          <div className="mpanel" onClick={e=>e.stopPropagation()} style={{maxWidth:400}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:40,height:40,borderRadius:10,background:T.goldDm,border:`1px solid rgba(240,165,0,0.35)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🔁</div>
              <div>
                <div style={{fontWeight:800,fontSize:16,color:T.t1,letterSpacing:"-0.02em"}}>Schedule Callback</div>
                <div style={{fontSize:12,color:T.t3}}>{currentLead.name} · {currentLead.phone}</div>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <div className="caps" style={{marginBottom:5}}>Callback Date</div>
                  <input className="hinput" type="date" value={cbData.date} onChange={e=>setCbData(p=>({...p,date:e.target.value}))} min={new Date().toISOString().slice(0,10)}/>
                </div>
                <div>
                  <div className="caps" style={{marginBottom:5}}>Callback Time</div>
                  <input className="hinput" type="time" value={cbData.time} onChange={e=>setCbData(p=>({...p,time:e.target.value}))}/>
                </div>
              </div>
              <div>
                <div className="caps" style={{marginBottom:5}}>Notes</div>
                <textarea className="hinput" rows={2} value={cbData.notes} onChange={e=>setCbData(p=>({...p,notes:e.target.value}))} placeholder="Call after 5pm, asked about battery…" style={{resize:"vertical",minHeight:52}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:18}}>
              <button className="btn-cyan" style={{flex:1}} disabled={!cbData.date||!cbData.time}
                onClick={()=>applyDisposition("callback",cbData)}>
                Schedule Callback
              </button>
              <button className="btn-out" onClick={()=>{setShowCBForm(false);setShowDisp(true);}}>← Back</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CALLBACKS VIEW
══════════════════════════════════════════════════════════════════ */
function CallbacksView({ callbacks, reps, isAdmin, repId, onReQueue, onDisposition, isMobile }) {
  const now = new Date();
  const sorted = [...callbacks].sort((a,b)=>new Date(a.callbackTime)-new Date(b.callbackTime));
  const overdue  = sorted.filter(c=>c.callbackTime && new Date(c.callbackTime)<now);
  const upcoming = sorted.filter(c=>c.callbackTime && new Date(c.callbackTime)>=now);

  const fmtCBTime = t => {
    if(!t) return "—";
    const d = new Date(t);
    return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
  };

  const RepBadge = ({repId: rid}) => {
    const r = reps.find(x=>x.id===Number(rid));
    return r ? <span style={{fontSize:11,color:T.t2,fontWeight:500}}>{r.name.split(" ")[0]}</span> : null;
  };

  if(!callbacks.length) return (
    <div style={{textAlign:"center",padding:"60px 0",color:T.t3}}>
      <div style={{fontSize:36,marginBottom:10,opacity:0.3}}>🔁</div>
      <div style={{fontWeight:600,fontSize:14,color:T.t2,marginBottom:4}}>No scheduled callbacks</div>
      <div style={{fontSize:12}}>When you schedule a callback from the dialer, it will appear here</div>
    </div>
  );

  const CBCard = ({cb, isOverdue}) => {
    const rep = reps.find(r=>r.id===Number(cb.callbackRepId));
    return (
      <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${isOverdue?T.red+"44":"rgba(255,255,255,0.08)"}`,borderRadius:12,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
        {isOverdue && <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${T.red},transparent)`}}/>}
        <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
              <span style={{fontWeight:700,fontSize:14.5,color:T.t1}}>{cb.name}</span>
              {isOverdue && <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:4,background:T.redDm,color:T.red,border:`1px solid ${T.red}33`}}>OVERDUE</span>}
            </div>
            <div style={{fontSize:12,color:T.t3,marginBottom:2}}>{cb.phone} · {cb.address}</div>
            {cb.callbackNotes && <div style={{fontSize:12,color:T.t2,marginTop:4,fontStyle:"italic"}}>"{cb.callbackNotes}"</div>}
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:12,color:isOverdue?T.red:T.amber,fontWeight:700}}>{fmtCBTime(cb.callbackTime)}</div>
            {isAdmin && rep && <RepBadge repId={cb.callbackRepId}/>}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <a href={`tel:${cb.phone}`} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:T.greenDm,border:`1px solid rgba(48,209,88,0.3)`,borderRadius:8,padding:"9px",color:T.green,fontWeight:700,fontSize:13,textDecoration:"none",fontFamily:"'Inter',system-ui,sans-serif"}}>
            📞 Call Now
          </a>
          <button onClick={()=>onReQueue(cb.id)} style={{flex:1,background:T.goldDm,border:`1px solid rgba(240,165,0,0.3)`,borderRadius:8,padding:"9px",color:T.gold,fontWeight:600,fontSize:12.5,cursor:"pointer",fontFamily:"'Inter',system-ui,sans-serif"}}>
            ↩ Re-queue
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {overdue.length>0 && (
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{height:1,flex:1,background:T.redDm}}/>
            <span className="caps" style={{fontSize:9,color:T.red}}>Overdue — {overdue.length}</span>
            <div style={{height:1,flex:1,background:T.redDm}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {overdue.map(cb=><CBCard key={cb.id} cb={cb} isOverdue={true}/>)}
          </div>
        </div>
      )}
      {upcoming.length>0 && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{height:1,flex:1,background:"rgba(255,255,255,0.04)"}}/>
            <span className="caps" style={{fontSize:9,color:T.amber}}>Upcoming — {upcoming.length}</span>
            <div style={{height:1,flex:1,background:"rgba(255,255,255,0.04)"}}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {upcoming.map(cb=><CBCard key={cb.id} cb={cb} isOverdue={false}/>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Persistent state helpers — module scope so Leaderboard and App can both use them ──
const load = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
};
const save = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
};

export default function App() {
  useEffect(()=>{ injectCSS(); },[]);

  // ── Persistent state helpers ──

  const [reps,      setRepsRaw]    = useState(() => load("apex_reps",      REPS_DATA));
  const [postedLog, setPostedLogRaw] = useState(() => load("apex_posted",  []));
  // Version stamp — bump this whenever SAMPLE_DEALS shape changes to bust stale cache
  const DEALS_VERSION = "v2";
  useEffect(() => {
    if (localStorage.getItem("apex_deals_version") !== DEALS_VERSION) {
      localStorage.removeItem("apex_deals");
      localStorage.setItem("apex_deals_version", DEALS_VERSION);
      setAllDealsRaw(SAMPLE_DEALS);
    }
  }, []);

  const [allDeals,  setAllDealsRaw]  = useState(() => load("apex_deals",   SAMPLE_DEALS));

  // Wrap setters to also persist
  const setReps      = v => setRepsRaw(prev => { const next = typeof v==="function"?v(prev):v; save("apex_reps",    next); return next; });
  const setPostedLog = v => setPostedLogRaw(prev => { const next = typeof v==="function"?v(prev):v; save("apex_posted", next); return next; });
  const setAllDeals  = v => setAllDealsRaw(prev => { const next = typeof v==="function"?v(prev):v; save("apex_deals",  next); return next; });

  const [user,         setUser]        = useState(null);
  const [dialerLeads,  setDialerLeads] = useState(SAMPLE_DIALER_LEADS);
  const [campaigns,    setCampaigns]   = useState(SAMPLE_CAMPAIGNS);

  if (!user) return <LoginScreen reps={reps} onLogin={setUser}/>;
  return (
    <Leaderboard
      user={user} reps={reps} setReps={setReps}
      dialerLeads={dialerLeads} setDialerLeads={setDialerLeads}
      campaigns={campaigns} setCampaigns={setCampaigns}
      postedLog={postedLog} setPostedLog={setPostedLog}
      allDeals={allDeals} setAllDeals={setAllDeals}
      onLogout={()=>setUser(null)}
      onResetData={()=>{
        ["apex_reps","apex_posted","apex_deals"].forEach(k=>localStorage.removeItem(k));
        setRepsRaw(REPS_DATA); setPostedLogRaw([]); setAllDealsRaw(SAMPLE_DEALS);
      }}
    />
  );
}
