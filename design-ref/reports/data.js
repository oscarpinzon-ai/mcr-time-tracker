// Mock data for MCR Reports redesign
// Simulates the shape of time_entries + pause_logs + hcp_jobs_cache joined.
// Month to date: April 2026 (workdays Mon–Sat).

(function () {
  const TECHS = [
    { id: 't1', name: 'Miguel Reyes',  initials: 'MR', color: 'oklch(0.70 0.14 50)'  },
    { id: 't2', name: 'Darnell Price', initials: 'DP', color: 'oklch(0.70 0.14 150)' },
    { id: 't3', name: 'Jorge Villa',   initials: 'JV', color: 'oklch(0.70 0.14 250)' },
    { id: 't4', name: 'Sam Okafor',    initials: 'SO', color: 'oklch(0.70 0.14 320)' },
    { id: 't5', name: 'Tyler Hanes',   initials: 'TH', color: 'oklch(0.70 0.14 20)'  },
    { id: 't6', name: 'Rafael Ortiz',  initials: 'RO', color: 'oklch(0.70 0.14 200)' },
  ];

  const JOB_TYPES = [
    { id: 'service',      label: 'Service Call / Repair',  hue: 80  },
    { id: 'yard',         label: 'Yard Work',              hue: 150 },
    { id: 'installation', label: 'Installation / Removal', hue: 250 },
  ];

  const CUSTOMERS = [
    'H-E-B Mueller', 'Target Domain', 'Whole Foods Lamar', 'Costco Cedar Park',
    'Walmart Round Rock', 'Randalls Bee Cave', 'Sprouts South Lamar',
    'Trader Joe\u2019s Seaholm', 'Central Market North', 'Tom Thumb Riverside',
    'CVS 38th', 'Walgreens Anderson', 'AISD Admin Bldg', 'St. David\u2019s South',
    'The Domain Tower', '2nd Street District', 'Brodie Oaks', 'Southpark Meadows',
  ];

  const ADDRESSES = [
    '4001 N Lamar Blvd', '11410 Century Oaks Ter', '525 N Lamar Blvd',
    '1201 S Mopac Expy', '201 University Oaks', '12407 N Mopac',
    '4301 W William Cannon', '2805 Lamar Blvd', '4001 N Lamar',
    '6001 W Parmer Ln', '3201 Bee Caves Rd', '9070 Research Blvd',
  ];

  // Deterministic PRNG so the mock is stable between reloads.
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // April 18, 2026 is "today" in the mock (Saturday).
  const TODAY = new Date(2026, 3, 18);
  const MONTH_START = new Date(2026, 3, 1);

  function isWorkday(d) {
    const dow = d.getDay();
    return dow !== 0; // Mon–Sat
  }

  function workdaysInRange(start, end) {
    const out = [];
    const d = new Date(start);
    while (d <= end) {
      if (isWorkday(d)) out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  // Produce time_entries + pause_logs.
  const rng = mulberry32(42);
  const entries = [];
  const pauses = [];
  let entryId = 1;
  let pauseId = 1;

  const days = workdaysInRange(MONTH_START, TODAY);
  days.forEach((day, dayIdx) => {
    TECHS.forEach((tech, tIdx) => {
      // Each tech skips ~10% of days (sick / off / route).
      if (rng() < 0.08) return;

      // Start between 7:00 and 8:15 am.
      const startMins = 7 * 60 + Math.floor(rng() * 75);
      // End between 4:30 and 7:00 pm — auto-clock-out caps at 7.
      const endMins = 16 * 60 + 30 + Math.floor(rng() * 150);

      // 2–5 jobs per day.
      const numJobs = 2 + Math.floor(rng() * 4);
      const dayLen = endMins - startMins;
      // Allocate each job roughly evenly, with some jitter.
      const segments = [];
      let remaining = dayLen;
      for (let i = 0; i < numJobs; i++) {
        const share = i === numJobs - 1 ? remaining : Math.floor(remaining / (numJobs - i) * (0.7 + rng() * 0.6));
        segments.push(Math.max(30, share));
        remaining -= share;
      }

      let cursor = startMins;
      for (let i = 0; i < numJobs; i++) {
        const jobStart = cursor;
        const jobEnd = Math.min(endMins, cursor + segments[i]);
        // Gap / pause between jobs (drive time). 5–25 min.
        const driveGap = 5 + Math.floor(rng() * 20);

        const jt = JOB_TYPES[Math.floor(rng() * JOB_TYPES.length)];
        const customer = CUSTOMERS[Math.floor(rng() * CUSTOMERS.length)];
        const address = ADDRESSES[Math.floor(rng() * ADDRESSES.length)];

        const clockIn = new Date(day);
        clockIn.setHours(0, jobStart, 0, 0);
        const clockOut = new Date(day);
        clockOut.setHours(0, jobEnd, 0, 0);

        // Maybe 1 pause per job (lunch, break) — ~30% chance.
        const entryPauses = [];
        if (rng() < 0.35 && (jobEnd - jobStart) > 45) {
          const pStart = jobStart + 20 + Math.floor(rng() * Math.max(1, (jobEnd - jobStart - 40)));
          const pLen = 10 + Math.floor(rng() * 30);
          const pEnd = Math.min(jobEnd, pStart + pLen);
          const ps = new Date(day); ps.setHours(0, pStart, 0, 0);
          const pe = new Date(day); pe.setHours(0, pEnd, 0, 0);
          entryPauses.push({ id: pauseId++, entry_id: entryId, pause_start: ps, pause_end: pe });
        }

        const pauseTotal = entryPauses.reduce(
          (s, p) => s + (p.pause_end - p.pause_start) / 60000, 0
        );
        const totalMinutes = Math.round((jobEnd - jobStart) - pauseTotal);

        // "Today" for active tech 0: leave last entry open.
        const isToday = day.getTime() === TODAY.getTime();
        const lastOfDay = i === numJobs - 1;
        const leaveOpen = isToday && lastOfDay && (tIdx === 0 || tIdx === 2);

        entries.push({
          id: entryId,
          employee_id: tech.id,
          job_number: 'J' + String(10000 + dayIdx * 30 + tIdx * 5 + i),
          customer_name: customer,
          job_type: jt.id,
          job_address: address,
          clock_in: clockIn,
          clock_out: leaveOpen ? null : clockOut,
          status: leaveOpen ? 'active' : 'completed',
          total_minutes: leaveOpen ? null : totalMinutes,
          day: new Date(day),
        });
        pauses.push(...entryPauses);

        entryId++;
        cursor = jobEnd + driveGap;
        if (cursor >= endMins) break;
      }
    });
  });

  // Expose.
  window.MCR_DATA = {
    TECHS,
    JOB_TYPES,
    TODAY,
    MONTH_START,
    entries,
    pauses,
    workdays: days,
  };
})();
