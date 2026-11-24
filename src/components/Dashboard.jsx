import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { formatDate } from '../lib/dates';
import { WAIT, pidOf } from '../lib/groups';
import { myEntries, mySubstitutions, nextEntry, progSummary, whenLabel } from '../lib/dashboard';

const STATO = { attesa: 'da fare', interrogato: 'interrogato ✓', assente: 'assente' };

// Parte alta della Cartina: prossima interrogazione, tutte le tue, riepilogo delle materie.
export default function Dashboard({ openPid, onToggle, renderOpen, onSwap }) {
  const { allGroups, programmate, mySid, today, nameOf, currentPid, incoming, isLive, subjectOf, groupLabel } = useData();
  const richieste = mySid ? incoming.filter(isLive) : [];
  const entries = mySid ? myEntries(allGroups, programmate, mySid, today) : [];
  const next = nextEntry(entries);
  const subs = mySid ? mySubstitutions(allGroups, programmate, mySid, today) : [];

  return (
    <>
      {mySid && (
        <section className={`hero ${next?.days === 0 ? 'oggi' : ''}`}>
          {next ? (
            <>
              <small>La tua prossima interrogazione</small>
              <div className="hero-top">
                <span className="hero-mat">{next.prog.subject}</span>
                <span className="hero-when">{whenLabel(next.days)}</span>
              </div>
              <div className="hero-meta">
                <b>Gruppo {next.group.number}</b>
                {next.group.date && <span>{formatDate(next.group.date, true)}</span>}
              </div>
              <div className="hero-with">
                <small>Con</small>
                <div className="mates">
                  {next.mates.length ? next.mates.map((s) => <span key={s} className="mate">{nameOf(s)}</span>) : <span className="mate">nessun altro</span>}
                </div>
              </div>
              {onSwap && next.upcoming && (
                <button className="hero-btn" onClick={() => onSwap(next.prog.id)}>🔄 Chiedi uno scambio</button>
              )}
            </>
          ) : (
            <>
              <small>La tua prossima interrogazione</small>
              <div className="hero-top"><span className="hero-mat">{entries.length ? 'Tutto fatto 🎉' : 'Nessuna in programma'}</span></div>
              <div className="hero-meta"><span>{entries.length ? 'Non hai altre interrogazioni da fare.' : 'Non sei in nessun gruppo delle programmate.'}</span></div>
            </>
          )}
        </section>
      )}

      {mySid && (
        <section className="reqbox">
          <header>
            <b>Richieste di scambio</b>
            <span className={`reqcount ${richieste.length ? 'on' : ''}`}>{richieste.length}</span>
          </header>
          <div className="reqlist">
            {richieste.length === 0 ? (
              <p className="reqempty">Non hai richieste di scambio.</p>
            ) : (
              richieste.map((r) => (
                <Link key={r.id} to="/scambi" className="reqrow">
                  <span className="rq-txt">
                    <b>{nameOf(r.fromSid)}</b>
                    <small>
                      {subjectOf(r.fromGroup) ? `${subjectOf(r.fromGroup)} · ` : ''}{groupLabel(r.fromGroup)} ⇄ {groupLabel(r.toGroup)}
                    </small>
                  </span>
                  <span className="r-go">Rispondi →</span>
                </Link>
              ))
            )}
          </div>
        </section>
      )}

      {subs.length > 0 && (
        <div className="subbox">
          <b>Sei sostituto</b>
          {subs.slice(0, 3).map((s) => (
            <span key={s.group.id}>{s.prog.subject} · Gruppo {s.group.number} ({whenLabel(s.days)})</span>
          ))}
        </div>
      )}

      <h2>Le programmate</h2>
      {programmate.length === 0 && <p className="muted">Le programmate non sono ancora state create.</p>}
      <div className="materie">
        {[...programmate].sort((a, b) => Number(!entries.some((e) => e.prog.id === a.id)) - Number(!entries.some((e) => e.prog.id === b.id))).map((p) => {
          const groups = allGroups.filter((g) => pidOf(g) === p.id);
          const sum = progSummary(groups, today);
          const mine = entries.find((e) => e.prog.id === p.id);
          const open = p.id === openPid;
          return (
            <div key={p.id || 'x'} className="matwrap">
              <button className={`matcard ${open ? 'on' : ''} ${mySid && !mine ? 'light' : ''}`} aria-expanded={open} onClick={() => onToggle(p.id)}>
                <span className="mc-head">
                  <span className="mc-title">{p.subject}</span>
                  <span className="mc-chev">{open ? '▲' : '▼'}</span>
                </span>
                {mine ? (
                  <span className="mc-mine">
                    Tu: <b>Gruppo {mine.group.number}</b> · {formatDate(mine.group.date)}
                    <span className={`pill ${mine.days === 0 && mine.upcoming ? 'oggi-pill' : ''}`}>
                      {mine.upcoming ? whenLabel(mine.days) : STATO[mine.status] || 'fatto'}
                    </span>
                  </span>
                ) : null}
                <span className="mc-sub">
                  {mySid && !mine ? 'Non sei in questa programmata · ' : ''}
                  {sum.next ? `Prossimo: Gruppo ${sum.next.number}, ${whenLabel(sum.nextDays)}` : sum.total ? 'Tutti i gruppi fatti' : 'Nessun gruppo'}
                </span>
              </button>
              {open && renderOpen(p.id)}
            </div>
          );
        })}
      </div>
    </>
  );
}
