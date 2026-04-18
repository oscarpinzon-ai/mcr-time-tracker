// Shared utilities: time math, formatting, aggregations.

(function () {
  const AVAILABLE_HOURS_PER_DAY = 8;

  function pausesFor(entryId, allPauses) {
    return allPauses.filter((p) => p.entry_id === entryId);
  }

  function workedMinutes(entry, allPauses) {
    const end = entry.clock_out || window.MCR_DATA.TODAY_NOW || new Date();
    const gross = (end - entry.clock_in) / 60000;
    const p = pausesFor(entry.id, allPauses).reduce(
      (s, pp) => s + (pp.pause_end - pp.pause_start) / 60000, 0
    );
    return Math.max(0, gross - p);
  }

  function fmtDuration(mins) {
    if (mins == null || isNaN(mins)) return '—';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h + 'h ' + String(m).padStart(2, '0') + 'm';
  }

  function fmtHM(date) {
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = ((h + 11) % 12) + 1;
    return hh + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  function fmtDateShort(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function fmtDow(d) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }

  // Filter entries by tech ids (empty = all) and job type ids (empty = all).
  function applyFilters(entries, techIds, jobTypeIds) {
    return entries.filter((e) => {
      if (techIds.length && !techIds.includes(e.employee_id)) return false;
      if (jobTypeIds.length && !jobTypeIds.includes(e.job_type)) return false;
      return true;
    });
  }

  function aggregateByTech(entries, pauses, techs) {
    const byTech = techs.map((t) => ({
      ...t,
      minutes: 0,
      jobs: 0,
      days: new Set(),
      entries: [],
    }));
    const map = new Map(byTech.map((t) => [t.id, t]));
    entries.forEach((e) => {
      const t = map.get(e.employee_id);
      if (!t) return;
      t.minutes += workedMinutes(e, pauses);
      t.jobs += 1;
      t.days.add(e.day.toDateString());
      t.entries.push(e);
    });
    byTech.forEach((t) => {
      t.daysWorked = t.days.size;
      t.utilization = t.daysWorked > 0
        ? (t.minutes / 60) / (t.daysWorked * AVAILABLE_HOURS_PER_DAY) * 100
        : 0;
    });
    return byTech;
  }

  function aggregateByJobType(entries, pauses, jobTypes) {
    const out = jobTypes.map((jt) => ({ ...jt, minutes: 0, jobs: 0 }));
    const map = new Map(out.map((j) => [j.id, j]));
    entries.forEach((e) => {
      const j = map.get(e.job_type);
      if (!j) return;
      j.minutes += workedMinutes(e, pauses);
      j.jobs += 1;
    });
    return out;
  }

  function aggregateByDay(entries, pauses, techs) {
    const map = new Map();
    entries.forEach((e) => {
      const k = e.day.toDateString();
      if (!map.has(k)) {
        map.set(k, { day: e.day, minutes: 0, jobs: 0, techs: new Set() });
      }
      const r = map.get(k);
      r.minutes += workedMinutes(e, pauses);
      r.jobs += 1;
      r.techs.add(e.employee_id);
    });
    const rows = Array.from(map.values()).sort((a, b) => a.day - b.day);
    rows.forEach((r) => {
      r.techCount = r.techs.size;
      r.utilization = r.techCount > 0
        ? (r.minutes / 60) / (r.techCount * AVAILABLE_HOURS_PER_DAY) * 100
        : 0;
    });
    return rows;
  }

  function utilizationBand(pct) {
    if (pct >= 85) return 'high';   // > target, excellent
    if (pct >= 65) return 'mid';    // on target
    return 'low';                   // under target
  }

  // Build per-tech day × utilization matrix (for heatmap).
  function techDayMatrix(entries, pauses, techs, workdays) {
    return techs.map((t) => ({
      ...t,
      days: workdays.map((d) => {
        const dayEntries = entries.filter(
          (e) => e.employee_id === t.id && sameDay(e.day, d)
        );
        const mins = dayEntries.reduce((s, e) => s + workedMinutes(e, pauses), 0);
        return {
          day: d,
          minutes: mins,
          utilization: (mins / 60) / AVAILABLE_HOURS_PER_DAY * 100,
        };
      }),
    }));
  }

  window.MCR_LIB = {
    AVAILABLE_HOURS_PER_DAY,
    workedMinutes,
    pausesFor,
    fmtDuration,
    fmtHM,
    fmtDateShort,
    fmtDow,
    sameDay,
    applyFilters,
    aggregateByTech,
    aggregateByJobType,
    aggregateByDay,
    utilizationBand,
    techDayMatrix,
  };
})();
