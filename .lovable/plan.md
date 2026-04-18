
Need to change `AVAILABLE_HOURS_PER_DAY` from 13 to 8 in `src/components/admin/ReportsTab.tsx`. This affects the UI table and the data passed to PDF/Excel exports (utilization field).

## Plan

Change the utilization base from 13 to 8 hours.

**File:** `src/components/admin/ReportsTab.tsx`
- Update the `AVAILABLE_HOURS_PER_DAY` constant from `13` to `8`.

That's the only change. Nothing else (colors, layout, other metrics, exports formatting) will be touched. The PDF and Excel exports will automatically reflect the new value because they receive the already-computed `utilization` field.
