import { formatDate } from '../lib/dates';
import { ABSENT, DONE, subOf } from '../lib/groups';
import Icon from './Icon';

const COLORS = ['arancione', 'blu', 'verde', 'viola', 'giallo', 'rosa'];
export const colorOf = (n) => COLORS[(n - 1 + COLORS.length * 10) % COLORS.length];

// Card di un gruppo (stile "foglio"): data, 4 nomi con quadratino, sostituto.
export default function GroupCard({ group, groups, studentsById, today, mySid, onSeat, canTap, footerExtra }) {
  const sub = subOf(groups, group);
  const isToday = group.date === today;
  const past = group.date && group.date < today;
  const cls = ['gcard', colorOf(group.number), isToday && 'oggi', group.done && 'fatto', past && !group.done && 'passato']
    .filter(Boolean).join(' ');
  return (
    <section className={cls} id={`gruppo-${group.number}`}>
      <header>
        <h3>Gruppo {group.number}</h3>
        <div className="data">
          {isToday && <span className="pill oggi-pill">OGGI</span>}
          {group.done && <span className="pill">fatto</span>}
          <span className={group.date ? '' : 'nodate'}>{formatDate(group.date)}</span>
        </div>
      </header>
      <ul>
        {group.seats.map((sid, i) => {
          if (!sid) return <li key={i} className="seat libero"><span className="box" />posto libero</li>;
          const st = group.status[i];
          const mine = sid === mySid;
          const s = studentsById[sid];
          const tappable = canTap?.(group, i);
          const Tag = tappable ? 'button' : 'div';
          return (
            <li key={i} className={`seat ${mine ? 'mia' : ''} ${st === DONE ? 'ok' : ''} ${st === ABSENT ? 'ass' : ''}`}>
              <Tag className="seat-in" {...(tappable ? { type: 'button', onClick: () => onSeat(group, i) } : {})}>
                <span className="box">{st === DONE ? <Icon n="check" size={14} /> : st === ABSENT ? <Icon n="x" size={14} /> : null}</span>
                <span className="nome">{s?.name || '(?)'}</span>
                {mine && <span className="tu">tu</span>}
                {tappable && <span className="swap-ico"><Icon n="swap" size={14} /></span>}
              </Tag>
            </li>
          );
        })}
      </ul>
      <footer>
        <span>Sostituto: <b>{sub ? studentsById[sub]?.name : '—'}</b></span>
        {footerExtra}
      </footer>
    </section>
  );
}
