import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { formatDate } from '../lib/dates';
import { WAIT, pidOf } from '../lib/groups';
import { colorOf } from './GroupCard';
import SubTransfer from './SubTransfer';
import { setSubRequestStatus } from '../lib/substitute';
import Icon from './Icon';
import { myEntries, mySubstitutions, nextEntry, progSummary, whenLabel } from '../lib/dashboard';

const STATO = { attesa: 'da fare', interrogato: 'interrogato ✓', assente: 'assente' };

// Parte alta della Cartina: prossima interrogazione, tutte le tue, riepilogo delle materie.
export default function Dashboard({ openPid, onToggle, renderOpen, onSwap }) {
  const { allGroups, programmate, mySid, today, nameOf, currentPid, incoming, isLive, subjectOf, groupLabel, subIn, subOut, subLive } = useData();
  const [passSub, setPassSub] = useState(null);
  const richieste = mySid ? incoming.filter(isLive) : [];
  const subRichieste = mySid ? subIn.filter(subLive) : [];
  const mioPending = (gid) => subOut.find((r) => r.gid === gid && subLive(r));   // richiesta di passaggio già inviata
  const entries = mySid ? myEntries(allGroups, programmate, mySid, today) : [];
  const next = nextEntry(entries);
  const subs = mySid ? mySubstitutions(allGroups, programmate, mySid, today) : [];
  // programmata per cui chiedere lo scambio: quella della prossima interrogazione, altrimenti la prima in cui sono
  const swapPid = (next || entries[0])?.prog.id;

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
              {next.mates.length > 0 && (
                <div className="mates">
                  {next.mates.map((s) => <span key={s} className="mate">{nameOf(s)}</span>)}
                </div>
              )}
              {subs.length > 0 && (
                <p className="hero-note">
                  {mioPending(subs[0].group.id) ? (
                    <>
                      <span>Hai chiesto a {nameOf(mioPending(subs[0].group.id).toSid)} di fare il sostituto: aspetta che accetti.</span>
                      <button className="hero-link" onClick={() => setSubRequestStatus(mioPending(subs[0].group.id).id, 'cancelled')}>Annulla</button>
                    </>
                  ) : (
                    <>
                      <span>Sei anche sostituto: {subs[0].prog.subject}, Gruppo {subs[0].group.number}{subs[0].days !== null ? ` (${whenLabel(subs[0].days)})` : ''}</span>
                      <button className="hero-link" onClick={() => setPassSub(subs[0])}>Passa il ruolo</button>
                    </>
                  )}
                </p>
              )}
            </>
          ) : (
            <>
              <small>La tua prossima interrogazione</small>
              <div className="hero-top"><span className="hero-mat">{entries.length ? 'Tutto fatto' : 'Nessuna in programma'}</span></div>
              <div className="hero-meta"><span>{entries.length ? 'Non hai altre interrogazioni da fare.' : 'Non sei in nessun gruppo delle programmate.'}</span></div>
            </>
          )}
        </section>
      )}

      {mySid && (
        <section className="reqbox">
          <header>
            <b>Scambi{richieste.length + subRichieste.length > 0 && <span className="reqcount on">{richieste.length + subRichieste.length}</span>}</b>
            {onSwap && swapPid !== undefined && (
              <button className="small primary" onClick={() => onSwap(swapPid)}><Icon n="swap" size={16} /> Chiedi scambio</button>
            )}
          </header>
          <div className="reqlist">
            {richieste.length + subRichieste.length === 0 ? (
              <p className="reqempty">Nessuna richiesta ricevuta.</p>
            ) : (
              <>
              {subRichieste.map((r) => (
                <Link key={r.id} to="/scambi" className="reqrow">
                  <span className="rq-txt">
                    <b>{nameOf(r.fromSid)}</b>
                    <small>Ti chiede di fare il sostituto · {subjectOf(r.gid) ? `${subjectOf(r.gid)} · ` : ''}{groupLabel(r.gid)}</small>
                  </span>
                  <span className="r-go">Rispondi →</span>
                </Link>
              ))}
              {richieste.map((r) => (
                <Link key={r.id} to="/scambi" className="reqrow">
                  <span className="rq-txt">
                    <b>{nameOf(r.fromSid)}</b>
                    <small>
                      {subjectOf(r.fromGroup) ? `${subjectOf(r.fromGroup)} · ` : ''}{groupLabel(r.fromGroup)} ↔ {groupLabel(r.toGroup)}
                    </small>
                  </span>
                  <span className="r-go">Rispondi →</span>
                </Link>
              ))}
              </>
            )}
          </div>
        </section>
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
                  <span className={`mc-chev ${open ? 'up' : ''}`}><Icon n="chevron" size={18} /></span>
                </span>
                {sum.next ? (
                  <span className={`cg ${colorOf(sum.next.number)}`}>
                    <span className="cg-num">{sum.next.number}</span>
                    <span className="cg-txt">
                      <small>{sum.next.date === today ? 'Oggi tocca al' : 'Ora tocca al'}</small>
                      <b>Gruppo {sum.next.number}</b>
                    </span>
                    {sum.nextDays !== null && (
                      <span className={`cg-when ${sum.nextDays === 0 ? 'oggi' : ''}`}>{whenLabel(sum.nextDays)}</span>
                    )}
                  </span>
                ) : (
                  <span className="mc-sub">{sum.total ? 'Tutti i gruppi fatti ✓' : 'Nessun gruppo'}</span>
                )}
                {mine ? (
                  <span className="mc-mine small">
                    Il tuo: <b>Gruppo {mine.group.number}</b>
                    {mine.group.date && <> · {formatDate(mine.group.date)}</>}
                    {(mine.days !== null || !mine.upcoming) && (
                      <span className={`pill ${mine.days === 0 && mine.upcoming ? 'oggi-pill' : ''}`}>
                        {mine.upcoming ? whenLabel(mine.days) : STATO[mine.status] || 'fatto'}
                      </span>
                    )}
                  </span>
                ) : mySid ? (
                  <span className="mc-sub">Non sei in questa programmata</span>
                ) : null}
              </button>
              {open && renderOpen(p.id)}
            </div>
          );
        })}
      </div>
          {passSub && <SubTransfer entry={passSub} onClose={() => setPassSub(null)} />}
    </>
  );
}
