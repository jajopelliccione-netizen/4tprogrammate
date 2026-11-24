import { useData } from '../context/DataContext';
import { formatDate } from '../lib/dates';
import { WAIT, pidOf } from '../lib/groups';
import { myEntries, mySubstitutions, nextEntry, progSummary, whenLabel } from '../lib/dashboard';

const STATO = { attesa: 'da fare', interrogato: 'interrogato ✓', assente: 'assente' };

// Parte alta della Cartina: prossima interrogazione, tutte le tue, riepilogo delle materie.
export default function Dashboard({ onPickProg }) {
  const { allGroups, programmate, mySid, today, nameOf, currentPid } = useData();
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
                <span>{formatDate(next.group.date, true)}</span>
              </div>
              <div className="hero-with">
                <small>Con</small>
                <div className="mates">
                  {next.mates.length ? next.mates.map((s) => <span key={s} className="mate">{nameOf(s)}</span>) : <span className="mate">nessun altro</span>}
                </div>
              </div>
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

      {subs.length > 0 && (
        <div className="subbox">
          <b>Sei sostituto</b>
          {subs.slice(0, 3).map((s) => (
            <span key={s.group.id}>{s.prog.subject} · Gruppo {s.group.number} ({whenLabel(s.days)})</span>
          ))}
        </div>
      )}

      {entries.length > 1 && (
        <>
          <h2>Le tue interrogazioni</h2>
          <ul className="mine-list">
            {entries.map((e) => (
              <li key={e.group.id} className={e.upcoming ? '' : 'passata'}>
                <button onClick={() => onPickProg(e.prog.id)}>
                  <span className="ml-mat">{e.prog.subject}</span>
                  <span className="ml-det">Gruppo {e.group.number} · {formatDate(e.group.date)}</span>
                  <span className={`pill ${e.days === 0 && e.upcoming ? 'oggi-pill' : ''}`}>
                    {e.upcoming ? whenLabel(e.days) : STATO[e.status] || 'fatto'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Tutte le materie</h2>
      {programmate.length === 0 && <p className="muted">Le programmate non sono ancora state create.</p>}
      <div className="materie">
        {programmate.map((p) => {
          const groups = allGroups.filter((g) => pidOf(g) === p.id);
          const sum = progSummary(groups, today);
          const mine = entries.find((e) => e.prog.id === p.id);
          const pct = sum.people ? Math.round((sum.interrogati / sum.people) * 100) : 0;
          return (
            <button key={p.id || 'x'} className={`matcard ${p.id === currentPid ? 'on' : ''}`} onClick={() => onPickProg(p.id)}>
              <span className="mc-title">{p.subject}</span>
              <span className="mc-sub">
                {sum.next ? `Prossimo: Gruppo ${sum.next.number} · ${whenLabel(sum.nextDays)}` : sum.total ? 'Tutti i gruppi fatti' : 'Nessun gruppo'}
              </span>
              <span className="bar"><i style={{ width: `${pct}%` }} /></span>
              <span className="mc-foot">
                <span>{sum.done}/{sum.total} gruppi · {sum.interrogati}/{sum.people} interrogati</span>
                {mine && <span className="pill">Tu: Gruppo {mine.group.number}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
