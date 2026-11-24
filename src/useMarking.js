import { useRef } from 'react';
import { useData } from './context/DataContext';
import { useToast } from './context/Toast';
import { commitChange, undoEntry } from './lib/admin';
import { ABSENT, DONE, applyAbsence, applyStatus, markAllDone, subOf } from './lib/groups';
import { errMsg } from './hooks';

// Azioni dell'admin per segnare interrogati / assenti (usate da "Segna" e dalla Cartina).
export function useMarking() {
  const { groups, groupsById, studentsById, currentPid, nameOf, history, groupLabel } = useData();
  const toast = useToast();
  const histRef = useRef(history);
  histRef.current = history;

  // dopo il commit lo storico si aggiorna da solo: al tap si annulla la voce più recente
  const undoLatest = () => {
    const e = histRef.current.find((h) => h.by === 'admin' && !h.undone && h.prev);
    if (e) undoEntry(e).then(() => toast('Azione annullata.')).catch((er) => toast(errMsg(er), { error: true }));
  };

  async function commit(changed, entry, msg) {
    await commitChange({ changed, entry, groupsById, studentsById, pid: currentPid });
    toast(msg, { action: { label: 'Annulla', onClick: undoLatest } });
  }

  // Anteprima di cosa succede se il posto viene segnato assente.
  function absencePreview(gid, pos) {
    const g = groupsById[gid];
    const sid = g.seats[pos];
    const { changed, info } = applyAbsence(groups, gid, pos);
    void changed;
    if (!info.subSid) return `Nessun sostituto disponibile: ${nameOf(sid)} resta segnato assente.`;
    return `Al posto di ${nameOf(sid)} entra ${nameOf(info.subSid)} (sostituto). ${nameOf(sid)} va nel ${groupLabel(info.toGroup)}, al posto di ${nameOf(info.subSid)}.`;
  }

  async function setStatus(gid, pos, status) {
    const sid = groupsById[gid].seats[pos];
    try {
      if (status === ABSENT) {
        const { changed, info } = applyAbsence(groups, gid, pos);
        await commit(changed, info, info.subSid
          ? `${nameOf(sid)} assente: entra ${nameOf(info.subSid)}, ${nameOf(sid)} passa nel gruppo successivo.`
          : `${nameOf(sid)} assente (nessun sostituto).`);
      } else {
        await commit(applyStatus(groups, gid, pos, status),
          { type: status === DONE ? 'interrogato' : 'attesa', sid, group: gid },
          status === DONE ? `${nameOf(sid)} interrogato ✔` : `${nameOf(sid)} rimesso in attesa.`);
      }
      return true;
    } catch (e) {
      toast(errMsg(e), { error: true });
      return false;
    }
  }

  async function groupDone(gid) {
    try {
      await commit(markAllDone(groups, gid), { type: 'gruppo_fatto', group: gid },
        `${groupLabel(gid)} segnato come interrogato ✔`);
      return true;
    } catch (e) {
      toast(errMsg(e), { error: true });
      return false;
    }
  }

  return { setStatus, groupDone, absencePreview, subOf: (g) => subOf(groups, g) };
}
