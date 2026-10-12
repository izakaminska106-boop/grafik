import React, { useEffect, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Search,
  Bell,
  ArrowUpRight,
  Check,
  X,
  Clock3,
  ArrowRight,
  History,
  LockKeyhole,
  Copy,
  Undo2,
  Radio,
  Info,
  TriangleAlert,
  Menu,
  FileText,
  Sun,
  Moon,
} from "lucide-react";
import { DateTime } from "luxon";
import {
  slots,
  absenceCodes,
  dates,
  nominal,
  minutes,
  summarize,
  validate,
  coverage,
  candidates,
  holidays,
  effectiveAbsence,
  coverageIntervals,
} from "./domain.js";
import "@fontsource/dm-sans/latin-ext-400.css";
import "@fontsource/dm-sans/latin-ext-500.css";
import "@fontsource/dm-sans/latin-ext-600.css";
import "@fontsource/manrope/latin-ext-700.css";
import "@fontsource/manrope/latin-ext-800.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "./style.css";
import { demoRequest, exportDemo, DEMO_STORAGE_KEY } from "./browser-demo.js";
const githubPages = import.meta.env.VITE_GITHUB_PAGES === "true";
const fmt = (n) =>
  (n / 60).toLocaleString("pl-PL", { maximumFractionDigits: 1 });
const nav = [
  ["dashboard", "Pulpit", LayoutDashboard],
  ["schedule", "Grafik emisji", CalendarDays],
  ["people", "Zespół", Users],
  ["absence", "Nieobecności", BriefcaseBusiness],
  ["tasks", "Zadania emisji", Radio],
  ["validation", "Walidacja", ShieldCheck],
];
const codeLabel = {
  R: "Ranna",
  P: "Popołudniowa",
  WER: "Weekend · rano",
  WEP: "Weekend · popołudnie",
  WEN: "Weekend · noc",
  CUSTOM: "Własna zmiana",
  U: "Urlop wypoczynkowy",
  UŻ: "Urlop na żądanie",
  CH: "Choroba",
  UB: "Urlop bezpłatny",
  IN: "Inna nieobecność",
  W: "Dzień wolny",
};
function App() {
  const [state, setState] = useState(null),
    [page, setPage] = useState("dashboard"),
    [month, setMonth] = useState("2026-10"),
    [role, setRole] = useState("manager"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [loading, setLoading] = useState(false),
    [history, setHistory] = useState([]),
    [query, setQuery] = useState(""),
    [mode, setMode] = useState("month"),
    [week, setWeek] = useState(0),
    [metric, setMetric] = useState("plan"),
    [sidebar, setSidebar] = useState(false),
    [undo, setUndo] = useState(null);
  const api = async (path, options = {}) => {
    if (githubPages) return demoRequest(path, options, role);
    let r = await fetch("/api/" + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-demo-role": role,
        ...options.headers,
      },
    });
    let data = await r.json();
    if (!r.ok) throw Error(data.error || "Nie udało się wykonać operacji");
    return data;
  };
  const load = () =>
    api("state")
      .then(setState)
      .catch((e) => setToast(e.message));
  useEffect(() => {
    load();
    if (!githubPages) return;
    const update = (e) => {
      if (e.key === DEMO_STORAGE_KEY) load();
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [role]);
  useEffect(() => {
    if (toast) {
      let t = setTimeout(() => setToast(""), 6500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const stats = useMemo(
    () => (state ? summarize(state, month) : []),
    [state, month],
  );
  const issues = useMemo(
    () => (state ? validate(state, month) : []),
    [state, month],
  );
  const cov = useMemo(
    () => (state ? coverage(state, month) : []),
    [state, month],
  );
  async function change(kind, payload, reason) {
    setLoading(true);
    try {
      const old = state;
      const next = await api("change", {
        method: "POST",
        body: JSON.stringify({
          revision: state.revision,
          kind,
          payload,
          reason,
        }),
      });
      setState(next);
      if (kind === "shift" || kind === "delete") setUndo(old);
      setModal(null);
      setToast("Zapisano zmiany w grafiku");
      return true;
    } catch (e) {
      setToast(e.message);
      if (e.message.includes("Odśwież")) load();
      return false;
    } finally {
      setLoading(false);
    }
  }
  function navigate(p) {
    setPage(p);
    setSidebar(false);
    setQuery("");
    if (p === "history")
      api("audit")
        .then(setHistory)
        .catch((e) => setToast(e.message));
  }
  function move(n) {
    setMonth(
      DateTime.fromISO(month + "-01")
        .plus({ months: n })
        .toFormat("yyyy-MM"),
    );
    setWeek(0);
  }
  function edit(employeeId, date, s) {
    if (!editable) return setToast("Ten widok ma dostęp tylko do odczytu.");
    setModal({
      type: "shift",
      data: s
        ? { ...s }
        : {
            employeeId,
            date,
            code: "R",
            start: "07:00",
            end: "15:00",
            actualMinutes: null,
            locked: false,
            freeReason: "",
          },
    });
  }
  async function exportXlsx() {
    try {
      let blob;
      if (githubPages) blob = await exportDemo(month, role);
      else {
        const r = await fetch("/api/export?month=" + month, {
          headers: { "x-demo-role": role },
        });
        if (!r.ok) throw Error("Błąd eksportu");
        blob = await r.blob();
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `Grafik-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setToast("Wyeksportowano grafik i raport walidacji");
    } catch (e) {
      setToast(e.message);
    }
  }
  if (!state)
    return (
      <div className="loading">
        <Radio size={32} />
        <h2>Otwieramy przestrzeń emisji…</h2>
        {toast && <p>{toast}</p>}
      </div>
    );
  const editable = ["manager", "hr"].includes(role),
    total = stats.reduce((a, s) => a + s.planned, 0),
    required = cov.reduce((a, c) => a + c.required, 0),
    covered = cov.reduce((a, c) => a + c.covered, 0),
    gap = required - covered,
    errors = issues.filter((x) => x.severity === "error"),
    monthLabel = DateTime.fromISO(month + "-01")
      .setLocale("pl")
      .toFormat("LLLL yyyy"),
    team = state.employees.filter((e) =>
      e.name.toLowerCase().includes(query.toLowerCase()),
    );
  const monthControl = (
    <div className="month-control">
      <button aria-label="Poprzedni miesiąc" onClick={() => move(-1)}>
        <ChevronLeft size={17} />
      </button>
      <CalendarDays size={16} />
      <span>{monthLabel}</span>
      <button aria-label="Następny miesiąc" onClick={() => move(1)}>
        <ChevronRight size={17} />
      </button>
    </div>
  );
  const scheduleTable = (compact = false) => {
    const ds = dates(month).slice(
      compact ? 12 : mode === "week" ? week * 7 : 0,
      compact ? 19 : mode === "week" ? week * 7 + 7 : undefined,
    );
    return (
      <div className="table-scroll">
        <table className={"schedule-table " + (compact ? "compact" : "")}>
          <thead>
            <tr>
              <th className="employee-col">
                Pracownik <span>{team.length} osób</span>
              </th>
              {ds.map((d) => (
                <th
                  key={d}
                  className={DateTime.fromISO(d).weekday > 5 ? "weekend" : ""}
                >
                  <span>
                    {DateTime.fromISO(d)
                      .setLocale("pl")
                      .toFormat("ccc")
                      .replace(".", "")}
                  </span>
                  <strong>{Number(d.slice(-2))}</strong>
                  {d === "2026-10-14" && <i />}
                </th>
              ))}
              {!compact && <th>Plan / wymiar</th>}
            </tr>
          </thead>
          <tbody>
            {team.map((e) => (
              <tr key={e.id}>
                <td className="employee-col">
                  <div className="person">
                    <span className={"avatar a" + e.id.slice(1)}>
                      {e.initials}
                    </span>
                    <div>
                      <b>{e.name}</b>
                      <small>{e.role}</small>
                    </div>
                  </div>
                </td>
                {ds.map((d) => {
                  const ss = state.shifts.filter(
                    (s) => s.employeeId === e.id && s.date === d,
                  );
                  const bad = issues.some(
                    (v) =>
                      v.severity === "error" &&
                      v.employee === e.name &&
                      v.date === d,
                  );
                  return (
                    <td
                      key={d}
                      className={
                        DateTime.fromISO(d).weekday > 5 ? "weekend" : ""
                      }
                    >
                      {ss.length ? (
                        ss.map((s) => (
                          <button
                            key={s.id}
                            className={
                              "shift code-" + s.code + (bad ? " invalid" : "")
                            }
                            onClick={() => edit(e.id, d, s)}
                            title={`${codeLabel[s.code]} ${s.start}–${s.end}${bad ? " · naruszenie reguł" : ""}`}
                          >
                            <b>{s.code === "CUSTOM" ? "WŁ" : s.code}</b>
                            <small>
                              {s.code === "W" ? "wolne" : `${s.start}–${s.end}`}
                            </small>
                            {s.locked && <LockKeyhole size={9} />}
                          </button>
                        ))
                      ) : (
                        <button
                          className="empty-shift"
                          onClick={() => edit(e.id, d)}
                          aria-label={`Dodaj zmianę: ${e.name}, ${d}`}
                        >
                          —
                        </button>
                      )}
                    </td>
                  );
                })}
                {!compact && (
                  <td className="sumcell">
                    <b>{fmt(stats.find((x) => x.id === e.id).planned)} h</b>
                    <small>/ {fmt(nominal(month, e.fte))} h</small>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  const legend = (
    <div className="legend">
      {["R", "P", "WER", "WEP", "WEN", "U", "W"].map((c) => (
        <span key={c}>
          <i className={"code-" + c} />
          <b>{c}</b> {codeLabel[c]}
        </span>
      ))}
      <span>
        <i className="invalid-key" />
        Naruszenie reguły
      </span>
    </div>
  );
  return (
    <div className="app">
      <aside className={sidebar ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-icon">
            <Radio size={23} />
          </span>
          <span>
            grafik<span className="brand-dot">.</span>
            <small>PRZESTRZEŃ EMISJI</small>
          </span>
        </a>
        <div className="workspace">
          <span className="workspace-symbol">E</span>
          <div>
            <b>Zespół emisji</b>
            <small>Przestrzeń demonstracyjna</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <p className="nav-label">ORGANIZACJA PRACY</p>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              className={page === id ? "active" : ""}
              aria-label={label}
              key={id}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
              {id === "validation" && (
                <span className="nav-count">{errors.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-box">
            <span className="live-dot" />
            <b>Dobry plan. Spokojna emisja.</b>
            <p>
              Cały zespół i wszystkie zmiany
              <br />w jednym miejscu.
            </p>
          </div>
          <button onClick={() => navigate("history")}>
            <History size={18} />
            Historia zmian
          </button>
          <button onClick={() => navigate("settings")}>
            <Settings size={18} />
            Ustawienia
          </button>
          <div className="profile">
            <span className="avatar profile-avatar">IK</span>
            <div>
              <b>Izabela Kamińska</b>
              <select
                aria-label="Rola demonstracyjna"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="manager">Kierownik emisji</option>
                <option value="hr">Kadry</option>
                <option value="employee">Pracownik · odczyt</option>
                <option value="viewer">Odbiorca raportów</option>
              </select>
            </div>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu"
              onClick={() => setSidebar(!sidebar)}
              aria-label="Menu"
            >
              <Menu size={20} />
            </button>
            <span>Zespół emisji</span>
            <ChevronRight size={13} />
            <b>
              {nav.find((x) => x[0] === page)?.[1] ||
                { history: "Historia zmian", settings: "Ustawienia" }[page]}
            </b>
          </div>
          <div>
            <span className="demo-badge">DANE DEMONSTRACYJNE</span>
            <button
              className="notification"
              onClick={() => navigate("validation")}
              aria-label="Powiadomienia"
            >
              <Bell size={19} />
              <i />
            </button>
            <span className="avatar profile-avatar small">IK</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">TWOJA PRZESTRZEŃ PRACY</div>
              <h1>
                {page === "dashboard"
                  ? "Pulpit zespołu"
                  : nav.find((x) => x[0] === page)?.[1] ||
                    { history: "Historia zmian", settings: "Ustawienia" }[page]}
              </h1>
              <p>
                {
                  {
                    dashboard:
                      "Dobry dzień zaczyna się od dobrego planu. Oto sytuacja w Twoim zespole.",
                    schedule:
                      "Planuj zmiany, sprawdzaj obsadę i dbaj o równowagę zespołu.",
                    people:
                      "Sześć osób, wspólny rytm. Godziny, dostępność i obciążenie.",
                    absence:
                      "Nieobecności i salda urlopowe bez utraty pierwotnego planu.",
                    tasks:
                      "Zaplanuj wydarzenia i rozdziel obciążenie merytoryczne.",
                    validation:
                      "Konkretne reguły, jasne wyniki i wskazówki do poprawy.",
                    history:
                      "Każda zmiana ma swoją historię. Poprzednie dane pozostają zachowane.",
                    settings: "Profil zakładowy i zapotrzebowanie na obsadę.",
                  }[page]
                }
              </p>
            </div>
            <div className="heading-actions">
              {monthControl}
              {page === "schedule" && (
                <button
                  className="primary"
                  onClick={() => edit("e0", month + "-01")}
                >
                  <Plus size={17} />
                  Dodaj zmianę
                </button>
              )}
            </div>
          </div>
          {githubPages && (
            <div className="info-strip">
              <Info size={17} />
              <span>
                Demo GitHub Pages · Twoje zmiany pozostają tylko w tej
                przeglądarce. Używaj danych testowych.
              </span>
            </div>
          )}
          {page === "dashboard" && (
            <>
              <div className="overview-banner">
                <div>
                  <span className="banner-icon">
                    <Sun size={26} />
                  </span>
                  <div>
                    <span>PLAN NA {monthLabel.toUpperCase()}</span>
                    <h2>Wszystko zaczyna się od zespołu.</h2>
                    <p>
                      {state.employees.length} pracowników ·{" "}
                      {fmt(stats.reduce((a, x) => a + x.nominal, 0))} godzin
                      wymiaru · miesięczny okres rozliczeniowy
                    </p>
                  </div>
                </div>
                <button onClick={() => navigate("schedule")}>
                  Otwórz grafik <ArrowUpRight size={18} />
                </button>
                <div className="banner-lines" />
              </div>
              <div className="kpi-grid">
                <Kpi
                  icon={Clock3}
                  label="Zaplanowane godziny"
                  value={fmt(total)}
                  unit="h"
                  foot={`z ${fmt(stats.reduce((a, x) => a + x.nominal - x.absent, 0))} h dostępności zespołu`}
                  progress={
                    total / stats.reduce((a, x) => a + x.nominal - x.absent, 0)
                  }
                />
                <Kpi
                  icon={Users}
                  label="Pokrycie obsady"
                  value={
                    required ? Math.round((covered / required) * 100) : 100
                  }
                  unit="%"
                  foot={`${fmt(covered)} z ${fmt(required)} wymaganych osobogodzin`}
                  progress={required ? covered / required : 1}
                />
                <Kpi
                  icon={CalendarDays}
                  label="Luki w obsadzie"
                  value={fmt(gap)}
                  unit="h"
                  foot={
                    gap
                      ? "Wymagają uzupełnienia planu"
                      : "Wszystkie przedziały obsadzone"
                  }
                  tone="amber"
                  onClick={() => navigate("schedule")}
                />
                <Kpi
                  icon={ShieldCheck}
                  label="Walidacja grafiku"
                  value={errors.length}
                  unit="naruszeń"
                  foot="Niepełna · dane sąsiednich okresów"
                  tone="red"
                  onClick={() => navigate("validation")}
                />
              </div>
              <div className="dashboard-columns">
                <section className="card chart-card">
                  <div className="card-heading">
                    <div>
                      <h2>Godziny pracy w zespole</h2>
                      <p>Plan względem wymiaru · {monthLabel}</p>
                    </div>
                    <select
                      value={metric}
                      onChange={(e) => setMetric(e.target.value)}
                      aria-label="Seria godzin"
                    >
                      <option value="plan">Plan</option>
                      <option value="actual">Wykonanie</option>
                    </select>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="green" />
                      {metric === "plan" ? "Zaplanowane" : "Wykonane"}
                    </span>
                    <span>
                      <i className="pale" />
                      Wymiar
                    </span>
                    <span>
                      <i className="purple" />
                      Nieobecności
                    </span>
                    <b>godziny</b>
                  </div>
                  <div className="bars">
                    {stats.map((s) => (
                      <div className="bar-group" key={s.id}>
                        <div className="bar-value">
                          {fmt(metric === "plan" ? s.planned : s.actual)} h
                        </div>
                        <div className="bar-tracks">
                          <div
                            className="bar pale"
                            style={{ height: s.nominal / 90 + "px" }}
                          />
                          <div
                            className="bar green"
                            style={{
                              height:
                                (metric === "plan" ? s.planned : s.actual) /
                                  90 +
                                "px",
                            }}
                          />
                          <div
                            className="bar purple"
                            style={{
                              height: Math.max(2, s.absent / 240) + "px",
                            }}
                          />
                        </div>
                        <span>{s.name.split(" ")[0]}</span>
                        <small>{s.name.split(" ")[1]}</small>
                      </div>
                    ))}
                  </div>
                  <details className="data-table">
                    <summary>Tabela danych</summary>
                    <table>
                      <thead>
                        <tr>
                          <th>Osoba</th>
                          <th>Wymiar h</th>
                          <th>Plan h</th>
                          <th>Wykonanie h</th>
                          <th>Nieobecność h</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map((s) => (
                          <tr key={s.id}>
                            <td>{s.name}</td>
                            <td>{fmt(s.nominal)}</td>
                            <td>{fmt(s.planned)}</td>
                            <td>{fmt(s.actual)}</td>
                            <td>{fmt(s.absent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </section>
                <section className="card attention-card">
                  <div className="card-heading">
                    <h2>Warto sprawdzić</h2>
                    <span className="count-badge">{issues.length}</span>
                  </div>
                  <div className="attention-item">
                    <span className="attention-icon amber">
                      <Info size={18} />
                    </span>
                    <div>
                      <b>Walidacja jest niepełna</b>
                      <p>
                        Uzupełnij dane sąsiednich okresów, aby sprawdzić
                        odpoczynki i wolne niedziele.
                      </p>
                      <button onClick={() => navigate("validation")}>
                        Zobacz szczegóły <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="attention-item">
                    <span className="attention-icon red">
                      <TriangleAlert size={18} />
                    </span>
                    <div>
                      <b>{errors.length} naruszeń w planie</b>
                      <p>
                        Sprawdź odpoczynki i bilans godzin przed zatwierdzeniem
                        grafiku.
                      </p>
                      <button onClick={() => navigate("validation")}>
                        Przejdź do walidacji <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="attention-item">
                    <span className="attention-icon purple">
                      <BriefcaseBusiness size={18} />
                    </span>
                    <div>
                      <b>
                        {stats.reduce((a, s) => a + s.leave / 60, 0)} h
                        zaplanowanego urlopu
                      </b>
                      <p>
                        Sprawdź dostępność zespołu i zastępstwa w dniach
                        nieobecności.
                      </p>
                      <button onClick={() => navigate("absence")}>
                        Zobacz nieobecności <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
              <section className="card schedule-preview">
                <div className="card-heading">
                  <div>
                    <h2>Najbliższy tydzień</h2>
                    <p>
                      13–19{" "}
                      {DateTime.fromISO(month + "-01")
                        .setLocale("pl")
                        .toFormat("LLLL")}{" "}
                      · podgląd grafiku
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setMode("week");
                      setWeek(1);
                      navigate("schedule");
                    }}
                  >
                    Pełny grafik <ArrowUpRight size={16} />
                  </button>
                </div>
                {scheduleTable(true)}
                {legend}
              </section>
              <div className="dashboard-columns bottom-grid">
                <Coverage
                  cov={cov}
                  monthLabel={monthLabel}
                  onDay={(d) => {
                    setMode("week");
                    setWeek(Math.floor((Number(d.slice(-2)) - 1) / 7));
                    navigate("schedule");
                  }}
                />
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>Na antenie i za kulisami</h2>
                      <p>Nadchodzące zadania emisji</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("tasks")}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </div>
                  {state.tasks
                    .filter((t) => t.date.startsWith(month))
                    .map((t) => (
                      <div className="task-row" key={t.id}>
                        <span className="task-date">
                          <b>{t.date.slice(-2)}</b>PAŹ
                        </span>
                        <div>
                          <b>{t.name}</b>
                          <small>
                            {t.start} · {t.hours} h ·{" "}
                            {
                              state.employees.find((e) => e.id === t.employeeId)
                                ?.name
                            }
                          </small>
                        </div>
                        <span className="points">{t.hours * t.weight} pkt</span>
                      </div>
                    ))}
                </section>
              </div>
            </>
          )}
          {page === "schedule" && (
            <>
              <div className="info-strip">
                <Info size={17} />
                <span>
                  Szkic · niepełna walidacja. {errors.length} naruszeń wymaga
                  korekty.
                </span>
                <button onClick={() => navigate("validation")}>
                  Sprawdź plan <ArrowRight size={14} />
                </button>
              </div>
              <section className="card full-schedule">
                <div className="schedule-toolbar">
                  <div className="segmented">
                    {[
                      ["month", "Miesiąc"],
                      ["week", "Tydzień"],
                      ["timeline", "Oś czasu"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={mode === id ? "selected" : ""}
                        onClick={() => setMode(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="toolbar-right">
                    <label className="search">
                      <Search size={16} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Szukaj pracownika"
                      />
                    </label>
                    <button
                      className="icon-button"
                      disabled={!undo}
                      onClick={() => setModal({ type: "undo" })}
                      title="Cofnij ostatnią zmianę"
                    >
                      <Undo2 size={17} />
                    </button>
                    <button className="secondary" onClick={exportXlsx}>
                      <Download size={16} />
                      Eksport XLSX
                    </button>
                    <button
                      className="secondary"
                      onClick={() => window.print()}
                    >
                      <FileText size={16} />
                      PDF / druk
                    </button>
                  </div>
                </div>
                {mode === "week" && (
                  <div className="week-nav">
                    <button disabled={!week} onClick={() => setWeek(week - 1)}>
                      <ChevronLeft size={16} />
                    </button>
                    Tydzień {week + 1}
                    <button
                      disabled={(week + 1) * 7 >= dates(month).length}
                      onClick={() => setWeek(week + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
                {mode === "timeline" ? (
                  <div className="timeline">
                    <div className="timeline-label">
                      Oś czasu · zmiany w całym miesiącu, Europe/Warsaw
                    </div>
                    {state.shifts
                      .filter(
                        (s) =>
                          s.date.startsWith(month) &&
                          team.some((e) => e.id === s.employeeId),
                      )
                      .sort((a, b) =>
                        (a.date + a.start).localeCompare(b.date + b.start),
                      )
                      .map((s) => (
                        <button
                          className="timeline-row"
                          key={s.id}
                          onClick={() => edit(s.employeeId, s.date, s)}
                        >
                          <span>{s.date}</span>
                          <b>
                            {
                              state.employees.find((e) => e.id === s.employeeId)
                                ?.name
                            }
                          </b>
                          <span className={"pill code-" + s.code}>
                            {s.code}
                          </span>
                          <span>
                            {s.start} → {s.end}
                          </span>
                          <span>{fmt(minutes(s))} h</span>
                          {s.locked && <LockKeyhole size={14} />}
                        </button>
                      ))}
                  </div>
                ) : (
                  scheduleTable()
                )}
                {legend}
                <div className="schedule-footer">
                  <span>
                    <span className="live-dot" /> Zapisano w bazie · wersja{" "}
                    {state.revision}
                  </span>
                  <span>
                    Strefa Europe/Warsaw · godziny faktycznie upływające
                  </span>
                </div>
              </section>
              <Coverage
                cov={cov}
                monthLabel={monthLabel}
                onDay={(d) => setModal({ type: "coverage", data: d })}
              />
              <div className="approval-panel">
                <div>
                  <h3>Gotowy do kolejnego kroku?</h3>
                  <p>
                    Zatwierdzenie wymaga pełnej walidacji i profilu
                    zatwierdzonego przez kadry.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => change("approve", { month })}
                >
                  <ShieldCheck size={17} />
                  Sprawdź i zatwierdź
                </button>
              </div>
            </>
          )}
          {page === "people" && (
            <>
              <div className="people-grid">
                {stats.map((s) => (
                  <section className="card person-card" key={s.id}>
                    <div className="person">
                      <span className={"avatar large a" + s.id.slice(1)}>
                        {s.initials}
                      </span>
                      <div>
                        <h2>{s.name}</h2>
                        <p>
                          {s.role} · {s.fte.toLocaleString("pl")} etatu
                        </p>
                      </div>
                    </div>
                    <div className="skill-list">
                      {s.skills.map((k) => (
                        <span key={k}>{k}</span>
                      ))}
                    </div>
                    <div className="person-metrics">
                      <div>
                        <small>Plan / wymiar</small>
                        <b>
                          {fmt(s.planned)} / {fmt(s.nominal)} h
                        </b>
                      </div>
                      <div>
                        <small>Wykonanie</small>
                        <b>{fmt(s.actual)} h</b>
                      </div>
                      <div>
                        <small>Godziny nocne</small>
                        <b>{fmt(s.night)} h</b>
                      </div>
                      <div>
                        <small>Weekendy</small>
                        <b>{s.weekends} zmian</b>
                      </div>
                      <div>
                        <small>Obciążenie</small>
                        <b>{s.points} pkt</b>
                      </div>
                      <div>
                        <small>Saldo wykonania*</small>
                        <b>{fmt(s.actual - (s.nominal - s.absent))} h</b>
                      </div>
                    </div>
                    <p className="small-note">
                      * Saldo nie stanowi wyliczenia nadgodzin.
                    </p>
                    <button
                      className="secondary wide"
                      onClick={() =>
                        setModal({ type: "employee", data: { ...s } })
                      }
                    >
                      Otwórz kartę pracownika <ArrowRight size={15} />
                    </button>
                  </section>
                ))}
              </div>
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Rozkład i obciążenie</h2>
                    <p>
                      {monthLabel} · plan · punkty na godzinę zaplanowanej pracy
                    </p>
                  </div>
                </div>
                <div className="report-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Pracownik</th>
                        <th>Punkty</th>
                        <th>pkt / h planu</th>
                        <th>Noce h</th>
                        <th>Weekendy</th>
                        <th>Długie zmiany</th>
                        <th>Saldo planu h</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map((s) => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{s.points}</td>
                          <td>
                            {s.planned
                              ? (s.points / (s.planned / 60)).toFixed(2)
                              : "—"}
                          </td>
                          <td>{fmt(s.night)}</td>
                          <td>{s.weekends}</td>
                          <td>
                            {
                              state.shifts.filter(
                                (x) =>
                                  x.employeeId === s.id &&
                                  x.date.startsWith(month) &&
                                  minutes(x) > 480 &&
                                  !absenceCodes.includes(x.code),
                              ).length
                            }
                          </td>
                          <td>{fmt(s.planned - (s.nominal - s.absent))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {page === "people" && (
            <PeriodCharts state={state} stats={stats} month={month} />
          )}
          {page === "absence" && (
            <>
              <div className="section-actions">
                <span>
                  Planowe godziny nieobecności są zachowane w rozliczeniu.
                </span>
                {editable && (
                  <button
                    className="primary"
                    onClick={() =>
                      setModal({
                        type: "shift",
                        data: {
                          employeeId: "e0",
                          date: month + "-01",
                          code: "U",
                          start: "07:00",
                          end: "15:00",
                          actualMinutes: 0,
                          locked: false,
                        },
                      })
                    }
                  >
                    <Plus size={17} />
                    Dodaj nieobecność
                  </button>
                )}
              </div>
              <div className="leave-balances">
                {stats.map((s) => (
                  <section className="card leave-card" key={s.id}>
                    <div className="person">
                      <span className={"avatar a" + s.id.slice(1)}>
                        {s.initials}
                      </span>
                      <b>{s.name}</b>
                    </div>
                    <small>Saldo urlopu po planie w roku</small>
                    <h2>
                      {s.leaveBalance !== undefined
                        ? fmt(
                            s.leaveBalance -
                              state.shifts
                                .filter(
                                  (x) =>
                                    x.employeeId === s.id &&
                                    x.date.startsWith(month.slice(0, 4)) &&
                                    ["U", "UŻ"].includes(x.code),
                                )
                                .reduce((a, x) => a + minutes(x), 0),
                          )
                        : "—"}{" "}
                      <span>h</span>
                    </h2>
                    <p>
                      UŻ: {s.uz + (s.uzUsed || 0)} / 4 dni · CH: {s.ill} dni w
                      miesiącu
                    </p>
                  </section>
                ))}
              </div>
              <section className="card">
                <div className="card-heading">
                  <h2>Nieobecności · {monthLabel}</h2>
                  <span className="pill">Plan i wykonanie osobno</span>
                </div>
                <div className="report-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Pracownik</th>
                        <th>Data</th>
                        <th>Rodzaj</th>
                        <th>Podstawa godzinowa</th>
                        <th>Status</th>
                        <th>Zastępstwo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.shifts
                        .filter(
                          (s) =>
                            s.date.startsWith(month) &&
                            absenceCodes.includes(s.code),
                        )
                        .map((s) => (
                          <tr key={s.id}>
                            <td>
                              {
                                state.employees.find(
                                  (e) => e.id === s.employeeId,
                                )?.name
                              }
                            </td>
                            <td>{s.date}</td>
                            <td>
                              <button
                                className={"pill code-" + s.code}
                                onClick={() => edit(s.employeeId, s.date, s)}
                              >
                                {codeLabel[s.code]}
                              </button>
                            </td>
                            <td>
                              {fmt(minutes(s))} h · {s.start}–{s.end}
                            </td>
                            <td>
                              {s.code === "CH"
                                ? "Potwierdzona nieobecność"
                                : s.requestStatus || "zaakceptowany"}
                            </td>
                            <td>
                              <button
                                className="text-button"
                                onClick={() =>
                                  setModal({ type: "replacement", data: s })
                                }
                              >
                                Znajdź osobę <ArrowRight size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!state.shifts.some(
                    (s) =>
                      s.date.startsWith(month) && absenceCodes.includes(s.code),
                  ) && (
                    <div className="empty-state">
                      Brak nieobecności w tym miesiącu.
                    </div>
                  )}
                </div>
              </section>
              <div className="info-strip">
                <Info size={18} />
                Nieobecność nie zwiększa przepracowanych godzin ani punktów.
                Choroba nie ma puli „do wykorzystania”.
              </div>
            </>
          )}
          {page === "tasks" && (
            <>
              <div className="section-actions">
                <span>
                  Punkty = aktywny czas × trudność 1–5. To model obciążenia, nie
                  ocena pracownika.
                </span>
                {editable && (
                  <button
                    className="primary"
                    onClick={() =>
                      setModal({
                        type: "task",
                        data: {
                          name: "",
                          date: month + "-14",
                          start: "19:00",
                          hours: 2,
                          weight: 3,
                          employeeId: "e0",
                          skill: "Emisja",
                        },
                      })
                    }
                  >
                    <Plus size={17} />
                    Nowe zadanie
                  </button>
                )}
              </div>
              <div className="task-grid">
                {state.tasks
                  .filter((t) => t.date.startsWith(month))
                  .map((t) => (
                    <section className="card task-card" key={t.id}>
                      <div className="task-card-top">
                        <span className="pill">{t.skill}</span>
                        <span className="points">{t.hours * t.weight} pkt</span>
                      </div>
                      <h2>{t.name}</h2>
                      <p>
                        <CalendarDays size={15} />
                        {t.date} <Clock3 size={15} />
                        {t.start} · {t.hours} h
                      </p>
                      <div className="difficulty">
                        Trudność <b>{t.weight} / 5</b>
                        <div>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <i
                              className={i <= t.weight ? "filled" : ""}
                              key={i}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="person">
                        <span className="avatar">
                          {
                            state.employees.find((e) => e.id === t.employeeId)
                              ?.initials
                          }
                        </span>
                        <b>
                          {
                            state.employees.find((e) => e.id === t.employeeId)
                              ?.name
                          }
                        </b>
                      </div>
                      <button
                        className="secondary wide"
                        onClick={() =>
                          setModal({ type: "task", data: { ...t } })
                        }
                      >
                        Edytuj zadanie
                      </button>
                    </section>
                  ))}
              </div>
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Rozłożenie obciążenia</h2>
                    <p>
                      {monthLabel} · punkty tylko na dniach zaplanowanej pracy
                    </p>
                  </div>
                </div>
                {stats.map((s) => (
                  <div className="horizontal-bar" key={s.id}>
                    <span>{s.name}</span>
                    <div>
                      <i
                        style={{
                          width:
                            Math.min(
                              100,
                              (s.points /
                                Math.max(1, ...stats.map((x) => x.points))) *
                                100,
                            ) + "%",
                        }}
                      />
                    </div>
                    <b>{s.points} pkt</b>
                  </div>
                ))}
              </section>
            </>
          )}
          {page === "validation" && (
            <>
              <div className="info-strip">
                <ShieldCheck size={18} />
                <span>
                  Reguły {state.settings.rulesVersion} · prototyp ·{" "}
                  {errors.length} błędów blokujących
                </span>
                <b>Niepełna walidacja</b>
              </div>
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Raport walidacji</h2>
                    <p>
                      {monthLabel} · {issues.length} wyników · każda zmiana
                      przelicza reguły
                    </p>
                  </div>
                  <button className="secondary" onClick={exportXlsx}>
                    <Download size={16} />
                    Eksport raportu
                  </button>
                </div>
                <div className="validation-list">
                  {issues.map((v, i) => (
                    <article className="validation-row" key={i}>
                      <span
                        className={
                          "attention-icon " +
                          (v.severity === "error" ? "red" : "amber")
                        }
                      >
                        <TriangleAlert size={18} />
                      </span>
                      <div>
                        <div>
                          <span className={"severity " + v.severity}>
                            {v.severity === "error" ? "BŁĄD" : "OSTRZEŻENIE"}
                          </span>
                          <span>
                            {v.employee} · {v.date}
                          </span>
                        </div>
                        <h3>{v.rule}</h3>
                        <p>{v.detail}</p>
                        <small>{v.basis}</small>
                        <div className="fix">
                          <ArrowRight size={14} />
                          {v.fix}
                        </div>
                      </div>
                      {v.employee !== "Cały zespół" && v.date.length === 10 && (
                        <button
                          className="secondary"
                          onClick={() => {
                            const e = state.employees.find(
                              (e) => e.name === v.employee,
                            );
                            edit(
                              e.id,
                              v.date,
                              state.shifts.find(
                                (s) =>
                                  s.employeeId === e.id && s.date === v.date,
                              ),
                            );
                          }}
                        >
                          Popraw wpis
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
          {page === "history" && (
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>Dziennik zmian</h2>
                  <p>
                    Poprzednia wersja danych jest zachowywana przy każdej
                    operacji.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => api("audit").then(setHistory)}
                >
                  Odśwież
                </button>
              </div>
              {history.length ? (
                history.map((h) => (
                  <div className="history-row" key={h.id}>
                    <span className="attention-icon">
                      <History size={18} />
                    </span>
                    <div>
                      <b>{h.action}</b>
                      <p>
                        {DateTime.fromISO(h.time)
                          .setZone("Europe/Warsaw")
                          .toFormat("dd.MM.yyyy HH:mm")}{" "}
                        · {h.role} · wersja #{h.id}
                      </p>
                    </div>
                    {editable && (
                      <button
                        className="secondary"
                        onClick={() => setModal({ type: "restore", data: h })}
                      >
                        Przywróć poprzedni stan
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  Tu pojawią się zapisane zmiany. Edytuj pierwszy wpis grafiku.
                </div>
              )}
            </section>
          )}
          {page === "settings" && (
            <>
              <section className="card settings-card">
                <div className="card-heading">
                  <div>
                    <h2>Profil i reguły zakładowe</h2>
                    <p>Zmiany ustawień dostępne dla roli Kadry.</p>
                  </div>
                  <span className="pill amber">Oczekuje na odbiór kadrowy</span>
                </div>
                <SettingsForm
                  settings={state.settings}
                  disabled={role !== "hr"}
                  onSave={(data) => change("settings", data)}
                />
              </section>
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Zakres prototypu</h2>
                    <p>Przygotowany na podstawie PRD Grafik Emisji v1.0</p>
                  </div>
                </div>
                <div className="scope-note">
                  {githubPages ? "Zapis w przeglądarce" : "Trwały zapis SQLite"}
                  , wersjonowanie i kontrola konfliktu edycji działają. Role
                  demonstracyjne nie zastępują logowania. Produkcja wymaga
                  uwierzytelniania, uprawnień do konkretnych zespołów, pełnego
                  rozliczenia prawnego, polityki kopii zapasowych i odbioru
                  kadrowego. Nie przechowuj tutaj rzeczywistych danych
                  zdrowotnych. Generator, import XLSX i integracje należą do
                  kolejnych etapów.
                </div>
              </section>
            </>
          )}
          <footer className="footer">
            <span>
              grafik. <span>Więcej porządku. Lepszy rytm pracy.</span>
            </span>
            <span>
              <span className="live-dot" /> Dane syntetyczne ·{" "}
              {githubPages ? "zapis w przeglądarce" : "zapis lokalny SQLite"}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Info size={18} />
          {toast}
          <button
            aria-label="Zamknij powiadomienie"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edycja danych"
          >
            <button
              className="modal-close"
              onClick={() => setModal(null)}
              aria-label="Zamknij"
            >
              <X size={22} />
            </button>
            {modal.type === "coverage" && (
              <>
                <div className="eyebrow">POKRYCIE OBSADY</div>
                <h2>{modal.data}</h2>
                <p>
                  Zapotrzebowanie niezależne od długości przydzielonych zmian.
                </p>
                <div className="report-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Przedział</th>
                        <th>Potrzeba</th>
                        <th>Dostępne</th>
                        <th>Brak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coverageIntervals(state, modal.data).map((r, i) => (
                        <tr key={i}>
                          <td>
                            {DateTime.fromMillis(r.start)
                              .setZone("Europe/Warsaw")
                              .toFormat("dd.MM HH:mm")}
                            –
                            {DateTime.fromMillis(r.end)
                              .setZone("Europe/Warsaw")
                              .toFormat("HH:mm")}
                          </td>
                          <td>{r.required}</td>
                          <td>{r.available}</td>
                          <td>{Math.max(0, r.required - r.available)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="modal-actions">
                  <button
                    className="primary"
                    onClick={() => edit("e0", modal.data)}
                  >
                    Dodaj obsadę
                  </button>
                </div>
              </>
            )}
            {modal.type === "shift" && (
              <ShiftForm
                data={modal.data}
                employees={state.employees}
                loading={loading}
                onSave={(d) => change("shift", d)}
                onDelete={(id) => change("delete", { id })}
                onCopy={(d) =>
                  setModal({
                    type: "shift",
                    data: {
                      ...d,
                      id: undefined,
                      date: DateTime.fromISO(d.date)
                        .plus({ days: 1 })
                        .toISODate(),
                      locked: false,
                    },
                  })
                }
              />
            )}{" "}
            {modal.type === "employee" && (
              <EmployeeForm
                data={modal.data}
                disabled={role !== "hr"}
                onSave={(d) => change("employee", d)}
              />
            )}{" "}
            {modal.type === "task" && (
              <TaskForm
                data={modal.data}
                employees={state.employees}
                disabled={!editable}
                onSave={(d) => change("task", d)}
              />
            )}{" "}
            {modal.type === "replacement" && (
              <>
                <div className="eyebrow">ZASTĘPSTWO</div>
                <h2>Dostępne osoby</h2>
                <p>
                  {modal.data.date} · {modal.data.start}–{modal.data.end}
                </p>
                {candidates(state, {
                  ...modal.data,
                  code: modal.data.originalCode || "R",
                }).map((e) => (
                  <div className="replacement-row" key={e.id}>
                    <span className="avatar">{e.initials}</span>
                    <b>{e.name}</b>
                    <button
                      className="secondary"
                      disabled={!editable}
                      onClick={() =>
                        change("shift", {
                          ...modal.data,
                          id: undefined,
                          code: modal.data.originalCode || "R",
                          employeeId: e.id,
                          actualMinutes: null,
                        })
                      }
                    >
                      Przydziel
                    </button>
                  </div>
                ))}
                {!candidates(state, {
                  ...modal.data,
                  code: modal.data.originalCode || "R",
                }).length && (
                  <div className="empty-state">
                    Brak kandydatów spełniających sprawdzane reguły. Zmień
                    organizację pracy, aby uzupełnić obsadę.
                  </div>
                )}
                <p className="small-note">
                  Podpowiedź nie oznacza pełnej zgodności prawnej. Sprawdź
                  kompetencje i pełny raport.
                </p>
              </>
            )}{" "}
            {modal.type === "restore" && (
              <ReasonForm
                title="Przywróć poprzedni stan"
                text="Przywrócenie obejmuje cały stan przed wybraną operacją. Obecny stan pozostanie w historii."
                onSave={(reason) =>
                  change("restore", { id: modal.data.id }, reason)
                }
              />
            )}{" "}
            {modal.type === "undo" && (
              <ReasonForm
                title="Cofnij ostatnią zmianę"
                text="Przywrócony zostanie stan przed ostatnią edycją. Operacja pozostanie w historii."
                onSave={async (reason) => {
                  const a = await api("audit");
                  if (a.length) {
                    const ok = await change("restore", { id: a[0].id }, reason);
                    if (ok) setUndo(null);
                  }
                }}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Kpi({
  icon: Icon,
  label,
  value,
  unit,
  foot,
  progress,
  tone = "",
  onClick,
}) {
  return (
    <section className={"card kpi " + tone} onClick={onClick}>
      <div>
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <h2>
        {value}
        <small>{unit}</small>
      </h2>
      {progress !== undefined && (
        <div className="progress-track">
          <i style={{ width: Math.min(100, progress * 100) + "%" }} />
        </div>
      )}
      <p>
        {tone && <span className={"status-dot " + tone} />} {foot}
        {onClick && <ArrowUpRight size={13} />}
      </p>
    </section>
  );
}
function Coverage({ cov, monthLabel, onDay }) {
  return (
    <section className="card coverage-card">
      <div className="card-heading">
        <div>
          <h2>Mapa obsady</h2>
          <p>{monthLabel} · pokrycie wymaganych osobogodzin · plan</p>
        </div>
        <Users size={20} />
      </div>
      <div className="heatmap">
        {cov.map((c) => (
          <button
            key={c.date}
            className={
              c.ratio === 1
                ? "complete"
                : c.ratio >= 0.5
                  ? "partial"
                  : "missing"
            }
            onClick={() => onDay(c.date)}
            title={`${c.date}: ${fmt(c.covered)} / ${fmt(c.required)} h, luka ${fmt(c.gap)} h`}
          >
            <b>{Number(c.date.slice(-2))}</b>
            <small>{Math.round(c.ratio * 100)}%</small>
          </button>
        ))}
      </div>
      <div className="chart-legend">
        <span>
          <i className="green" />
          Pełna obsada
        </span>
        <span>
          <i className="amber" />
          Częściowa
        </span>
        <span>
          <i className="red" />
          Poniżej 50%
        </span>
      </div>
      <details className="data-table">
        <summary>Tabela obsady · godziny</summary>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Wymagane</th>
              <th>Obsadzone</th>
              <th>Luka</th>
              <th>Nadmiar</th>
            </tr>
          </thead>
          <tbody>
            {cov.map((c) => (
              <tr key={c.date}>
                <td>{c.date}</td>
                <td>{fmt(c.required)}</td>
                <td>{fmt(c.covered)}</td>
                <td>{fmt(c.gap)}</td>
                <td>{fmt(c.excess)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
function ShiftForm({ data, employees, onSave, onDelete, onCopy, loading }) {
  const [d, setD] = useState(data);
  const update = (key, value) => setD((x) => ({ ...x, [key]: value }));
  const isAbs = absenceCodes.includes(d.code);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(d);
      }}
    >
      <div className="eyebrow">GRAFIK EMISJI</div>
      <h2>{d.id ? "Edytuj wpis" : "Nowy wpis w grafiku"}</h2>
      <p>Plan i wykonanie są zapisywane oddzielnie.</p>
      <label>
        Pracownik
        <select
          value={d.employeeId}
          onChange={(e) => update("employeeId", e.target.value)}
        >
          {employees.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          Data
          <input
            type="date"
            required
            value={d.date}
            onChange={(e) => update("date", e.target.value)}
          />
        </label>
        <label>
          Rodzaj wpisu
          <select
            value={d.code}
            onChange={(e) => {
              const code = e.target.value;
              setD((x) => ({
                ...x,
                code,
                originalCode: isAbs ? x.originalCode : x.code,
                originalActualMinutes: isAbs
                  ? x.originalActualMinutes
                  : x.actualMinutes,
                ...(slots[code]
                  ? { start: slots[code][0], end: slots[code][1] }
                  : {}),
                actualMinutes: absenceCodes.includes(code)
                  ? 0
                  : x.actualMinutes,
              }));
            }}
          >
            {Object.entries(codeLabel).map(([c, label]) => (
              <option key={c} value={c}>
                {c} · {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          {isAbs ? "Pierwotny plan od" : "Początek"}
          <input
            type="time"
            required
            value={d.start}
            onChange={(e) => update("start", e.target.value)}
          />
        </label>
        <label>
          {isAbs ? "Pierwotny plan do" : "Koniec"}
          <input
            type="time"
            required
            value={d.end}
            onChange={(e) => update("end", e.target.value)}
          />
        </label>
      </div>
      {!isAbs && d.code !== "W" && (
        <div className="presets">
          {[4, 6, 8, 10, 12].map((h) => (
            <button
              type="button"
              key={h}
              onClick={() => {
                const [a, b] = d.start.split(":").map(Number);
                update(
                  "end",
                  String((a + h) % 24).padStart(2, "0") +
                    ":" +
                    String(b).padStart(2, "0"),
                );
              }}
            >
              {h} h
            </button>
          ))}
        </div>
      )}
      <div className="form-info">
        <Clock3 size={17} />
        {fmt(minutes(d))} h rzeczywistego czasu · Europe/Warsaw
        {d.end <= d.start && d.code !== "W" ? " · koniec następnego dnia" : ""}
      </div>
      {d.code === "W" && (
        <label>
          Powód rozliczeniowy
          <select
            required
            value={d.freeReason || ""}
            onChange={(e) => update("freeReason", e.target.value)}
          >
            <option value="">Wybierz kategorię</option>
            {[
              "Przeciętnie pięciodniowy tydzień",
              "Równoważenie przedłużonej pracy",
              "Rekompensata niedzieli",
              "Rekompensata święta",
              "Rekompensata nadgodzin",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      )}
      {isAbs && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={d.originalCode === "W"}
            onChange={(e) =>
              update("originalCode", e.target.checked ? "W" : "R")
            }
          />
          Nieobecność w dniu pierwotnie wolnym (0 h)
        </label>
      )}
      {isAbs && d.code !== "CH" && (
        <label>
          Status wniosku
          <select
            value={d.requestStatus || "zaakceptowany"}
            onChange={(e) => update("requestStatus", e.target.value)}
          >
            {["zgłoszony", "zaakceptowany", "odrzucony", "wycofany"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </label>
      )}
      {!isAbs && d.code !== "W" && (
        <label>
          Faktyczne wykonanie (minuty; puste = brak danych)
          <input
            type="number"
            min="0"
            max="2880"
            value={d.actualMinutes ?? ""}
            onChange={(e) =>
              update(
                "actualMinutes",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </label>
      )}
      <label>
        Notatka / powód zmiany
        <input
          value={d.note || ""}
          onChange={(e) => update("note", e.target.value)}
          placeholder="Bez diagnoz i danych zdrowotnych"
          maxLength={300}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={d.locked}
          onChange={(e) => {
            update("locked", e.target.checked);
            if (data.locked) update("unlock", true);
          }}
        />
        Zablokuj wpis przed zmianą
      </label>
      <div className="modal-actions">
        {d.id && (
          <>
            <button
              type="button"
              className="danger-button"
              onClick={() => onDelete(d.id)}
            >
              Usuń
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => onCopy(d)}
            >
              <Copy size={15} />
              Kopiuj na jutro
            </button>
          </>
        )}
        <button disabled={loading} className="primary" type="submit">
          <Check size={16} />
          {loading ? "Zapisuję…" : "Zapisz wpis"}
        </button>
      </div>
    </form>
  );
}
function EmployeeForm({ data, disabled, onSave }) {
  const [d, setD] = useState(data);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(d);
      }}
    >
      <div className="eyebrow">KARTA PRACOWNIKA</div>
      <h2>{d.name}</h2>
      <p>Profil prawny i salda edytują Kadry.</p>
      <label>
        Imię i nazwisko
        <input
          required
          disabled={disabled}
          value={d.name}
          onChange={(e) =>
            setD({
              ...d,
              name: e.target.value,
              initials: e.target.value
                .split(" ")
                .map((x) => x[0])
                .join(""),
            })
          }
        />
      </label>
      <div className="form-grid">
        <label>
          Wymiar etatu
          <input
            disabled={disabled}
            type="number"
            min="0.1"
            max="1"
            step="0.1"
            value={d.fte}
            onChange={(e) => setD({ ...d, fte: Number(e.target.value) })}
          />
        </label>
        <label>
          Saldo urlopu (h)
          <input
            disabled={disabled}
            type="number"
            min="0"
            value={d.leaveBalance !== undefined ? d.leaveBalance / 60 : ""}
            onChange={(e) =>
              setD({ ...d, leaveBalance: Number(e.target.value) * 60 })
            }
          />
        </label>
        <label>
          UŻ wykorzystane poza planem (dni)
          <input
            disabled={disabled}
            type="number"
            min="0"
            max="4"
            value={d.uzUsed || 0}
            onChange={(e) => setD({ ...d, uzUsed: Number(e.target.value) })}
          />
        </label>
        <label>
          Limit planowej zmiany
          <select
            disabled={disabled}
            value={d.maxDaily || 720}
            onChange={(e) => setD({ ...d, maxDaily: Number(e.target.value) })}
          >
            <option value="720">12 h</option>
            <option value="480">8 h</option>
            <option value="420">7 h</option>
          </select>
        </label>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          disabled={disabled}
          checked={d.noNight || false}
          onChange={(e) => setD({ ...d, noNight: e.target.checked })}
        />
        Ograniczenie pracy w porze nocnej
      </label>
      <div className="modal-actions">
        <button className="primary" disabled={disabled}>
          Zapisz profil
        </button>
      </div>
    </form>
  );
}
function TaskForm({ data, employees, disabled, onSave }) {
  const [d, setD] = useState(data);
  const u = (k, v) => setD({ ...d, [k]: v });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(d);
      }}
    >
      <div className="eyebrow">ZADANIA EMISJI</div>
      <h2>{d.id ? "Edytuj zadanie" : "Nowe zadanie"}</h2>
      <label>
        Nazwa
        <input
          required
          value={d.name}
          onChange={(e) => u("name", e.target.value)}
        />
      </label>
      <div className="form-grid">
        <label>
          Data
          <input
            required
            type="date"
            value={d.date}
            onChange={(e) => u("date", e.target.value)}
          />
        </label>
        <label>
          Początek
          <input
            required
            type="time"
            value={d.start}
            onChange={(e) => u("start", e.target.value)}
          />
        </label>
        <label>
          Aktywne zaangażowanie (h)
          <input
            required
            type="number"
            min="0.25"
            max="24"
            step="0.25"
            value={d.hours}
            onChange={(e) => u("hours", Number(e.target.value))}
          />
        </label>
        <label>
          Trudność
          <select
            value={d.weight}
            onChange={(e) => u("weight", Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Właściciel
        <select
          value={d.employeeId}
          onChange={(e) => u("employeeId", e.target.value)}
        >
          {employees.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Wymagana kompetencja
        <select value={d.skill} onChange={(e) => u("skill", e.target.value)}>
          {["Emisja", "LIVE", "Koordynacja"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <div className="form-info">
        Obciążenie: {d.hours * d.weight} pkt · godziny pracy bez zmian
      </div>
      <div className="modal-actions">
        <button className="primary" disabled={disabled}>
          Zapisz zadanie
        </button>
      </div>
    </form>
  );
}
function SettingsForm({ settings, disabled, onSave }) {
  const [d, setD] = useState(settings);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(d);
      }}
    >
      <div className="form-grid">
        <label>
          Okres rozliczeniowy
          <input disabled value="Miesięczny (prototyp)" readOnly />
        </label>
        <label>
          Początek 8-godzinnej pory nocnej
          <select
            disabled={disabled}
            value={d.nightStart}
            onChange={(e) => setD({ ...d, nightStart: e.target.value })}
          >
            {["21:00", "22:00", "23:00"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      {[
        ["weekdayDemand", "Dni powszednie"],
        ["weekendDemand", "Weekend"],
        ["holidayDemand", "Święta (oddzielna obsada)"],
      ].map(([key, label]) => (
        <div className="demand-editor" key={key}>
          <h3>{label}</h3>
          {d[key].map((r, i) => (
            <div className="demand-row" key={i}>
              <input
                aria-label="Od"
                disabled={disabled}
                type="time"
                value={r.start}
                onChange={(e) =>
                  setD({
                    ...d,
                    [key]: d[key].map((x, j) =>
                      j === i ? { ...x, start: e.target.value } : x,
                    ),
                  })
                }
              />
              <span>—</span>
              <input
                aria-label="Do"
                disabled={disabled}
                type="time"
                value={r.end}
                onChange={(e) =>
                  setD({
                    ...d,
                    [key]: d[key].map((x, j) =>
                      j === i ? { ...x, end: e.target.value } : x,
                    ),
                  })
                }
              />
              <input
                aria-label="Liczba osób"
                disabled={disabled}
                type="number"
                min="1"
                max="6"
                value={r.count}
                onChange={(e) =>
                  setD({
                    ...d,
                    [key]: d[key].map((x, j) =>
                      j === i ? { ...x, count: Number(e.target.value) } : x,
                    ),
                  })
                }
              />
              <span>osób</span>
              <button
                className="icon-button"
                type="button"
                disabled={disabled}
                onClick={() =>
                  setD({ ...d, [key]: d[key].filter((_, j) => i !== j) })
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            disabled={disabled}
            className="text-button"
            type="button"
            onClick={() =>
              setD({
                ...d,
                [key]: [...d[key], { start: "07:00", end: "15:00", count: 1 }],
              })
            }
          >
            <Plus size={15} />
            Dodaj przedział
          </button>
        </div>
      ))}
      <div className="form-info">
        <Info size={18} />
        WEP i WEN nakładają się 22:00–23:00. Przerwa 06:00–07:00 wymaga decyzji
        kierownika.
      </div>
      <button className="primary" disabled={disabled}>
        Zapisz ustawienia
      </button>
    </form>
  );
}
function ReasonForm({ title, text, onSave }) {
  const [reason, setReason] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(reason);
      }}
    >
      <h2>{title}</h2>
      <p>{text}</p>
      <label>
        Powód
        <input
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="modal-actions">
        <button className="primary">Przywróć i zapisz historię</button>
      </div>
    </form>
  );
}
function PeriodCharts({ state, stats, month }) {
  const [person, setPerson] = useState("e0"),
    [kind, setKind] = useState("plan");
  const ds = dates(month),
    e = state.employees.find((x) => x.id === person);
  let total = 0,
    benchmark = 0;
  const series = ds.map((date) => {
    let shifts = state.shifts.filter(
      (s) =>
        s.employeeId === person &&
        s.date === date &&
        !absenceCodes.includes(s.code) &&
        s.code !== "W",
    );
    total += shifts.reduce(
      (a, s) => a + (kind === "plan" ? minutes(s) : (s.actualMinutes ?? 0)),
      0,
    );
    if (
      DateTime.fromISO(date).weekday <= 5 &&
      !holidays(Number(month.slice(0, 4))).includes(date)
    )
      benchmark += 480 * e.fte;
    return { date, total, benchmark };
  });
  const max = Math.max(1, ...series.flatMap((x) => [x.total, x.benchmark]));
  const points = (key) =>
    series
      .map(
        (v, i) =>
          `${30 + (i * 640) / (series.length - 1)},${170 - (v[key] / max) * 140}`,
      )
      .join(" ");
  const abs = stats.map((e) => {
    const ss = state.shifts.filter(
      (s) =>
        s.employeeId === e.id &&
        s.date.startsWith(month) &&
        effectiveAbsence(s),
    );
    return {
      ...e,
      u: ss.filter((x) => x.code === "U").reduce((a, s) => a + minutes(s), 0),
      uzHours: ss
        .filter((x) => x.code === "UŻ")
        .reduce((a, s) => a + minutes(s), 0),
      ch: ss.filter((x) => x.code === "CH").reduce((a, s) => a + minutes(s), 0),
    };
  });
  return (
    <div className="dashboard-columns reports">
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Narastający bilans okresu</h2>
            <p>{month} · godziny · linia odniesienia według dni roboczych</p>
          </div>
        </div>
        <div className="report-filters">
          <select
            aria-label="Osoba na wykresie"
            value={person}
            onChange={(event) => setPerson(event.target.value)}
          >
            {state.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Plan lub wykonanie bilansu"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="plan">Plan</option>
            <option value="actual">Wykonanie</option>
          </select>
        </div>
        <svg
          className="balance-svg"
          viewBox="0 0 700 205"
          role="img"
          aria-label={`Bilans godzin ${e.name}`}
        >
          <line x1="30" y1="170" x2="670" y2="170" stroke="#e3eade" />
          <line x1="30" y1="30" x2="670" y2="30" stroke="#edf2e8" />
          <polyline
            points={points("benchmark")}
            fill="none"
            stroke="#b4c2a9"
            strokeWidth="2"
            strokeDasharray="5 5"
          />
          <polyline
            points={points("total")}
            fill="none"
            stroke="#548468"
            strokeWidth="3"
          />
          <text x="30" y="194">
            1
          </text>
          <text x="650" y="194">
            {ds.length}
          </text>
          <text x="5" y="170">
            0
          </text>
          <text x="30" y="23">
            {fmt(max)} h
          </text>
        </svg>
        <div className="chart-legend">
          <span>
            <i className="green" />
            {kind === "plan" ? "Plan" : "Wykonanie"} narastająco
          </span>
          <span>
            <i className="pale" />
            Wymiar · odniesienie
          </span>
        </div>
        <details className="data-table">
          <summary>Tabela bilansu · godziny</summary>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>{kind === "plan" ? "Plan" : "Wykonanie"}</th>
                <th>Wymiar</th>
                <th>Różnica</th>
              </tr>
            </thead>
            <tbody>
              {series.map((x) => (
                <tr key={x.date}>
                  <td>{x.date}</td>
                  <td>{fmt(x.total)}</td>
                  <td>{fmt(x.benchmark)}</td>
                  <td>{fmt(x.total - x.benchmark)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Nieobecności w godzinach</h2>
            <p>{month} · plan nieobecności · oddzielnie od pracy</p>
          </div>
        </div>
        <div className="absence-bars">
          {abs.map((s) => (
            <div className="absence-bar-row" key={s.id}>
              <span>{s.name.split(" ")[0]}</span>
              <div>
                <i
                  className="code-U"
                  style={{
                    width:
                      (s.u /
                        Math.max(
                          480,
                          ...abs.map((x) => x.u + x.uzHours + x.ch),
                        )) *
                        100 +
                      "%",
                  }}
                />
                <i
                  className="code-UŻ"
                  style={{
                    width:
                      (s.uzHours /
                        Math.max(
                          480,
                          ...abs.map((x) => x.u + x.uzHours + x.ch),
                        )) *
                        100 +
                      "%",
                  }}
                />
                <i
                  className="code-CH"
                  style={{
                    width:
                      (s.ch /
                        Math.max(
                          480,
                          ...abs.map((x) => x.u + x.uzHours + x.ch),
                        )) *
                        100 +
                      "%",
                  }}
                />
              </div>
              <b>{fmt(s.u + s.uzHours + s.ch)} h</b>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <span>
            <i className="code-U" />U · h
          </span>
          <span>
            <i className="code-UŻ" />
            UŻ · h
          </span>
          <span>
            <i className="code-CH" />
            CH · h
          </span>
        </div>
        <details className="data-table">
          <summary>Tabela godzin i oddzielnych liczników dni</summary>
          <table>
            <thead>
              <tr>
                <th>Osoba</th>
                <th>U h</th>
                <th>UŻ h</th>
                <th>CH h</th>
                <th>UŻ dni</th>
                <th>CH dni</th>
              </tr>
            </thead>
            <tbody>
              {abs.map((x) => (
                <tr key={x.id}>
                  <td>{x.name}</td>
                  <td>{fmt(x.u)}</td>
                  <td>{fmt(x.uzHours)}</td>
                  <td>{fmt(x.ch)}</td>
                  <td>{x.uz}</td>
                  <td>{x.ill}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
