import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportData {
  dateRange: { from: string; to: string };
  totalToday: string;
  totalWeek: string;
  totalMonth: string;
  avgPerTechPerDay: string;
  crewUtilization?: number;
  jobsCompleted?: number;
  activeTechs?: number;
  hoursByTech: Array<{ name: string; hours: number; utilization?: number }>;
  hoursByType: Array<{ name: string; hours: number }>;
  dailyRows: Array<{
    date: string;
    tech: string;
    jobs: number;
    minutes: number;
    utilization: number;
  }>;
}

export function exportToPDF(data: ExportData) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = 0;

  // PAGE 1: HEADER + KPIs + CHARTS

  // Header with MCR branding
  pdf.setFillColor(26, 26, 26); // Black
  pdf.rect(0, 0, pageWidth, 30, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont(undefined, 'bold');
  pdf.text('MCR Tech Performance Tool', margin, 12);

  pdf.setFontSize(10);
  pdf.setFont(undefined, 'normal');
  pdf.text(`Report Period: ${data.dateRange.from} to ${data.dateRange.to}`, margin, 20);
  pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 40, 20);

  yPosition = 42;

  // KPI Cards
  const kpiY = yPosition;
  const kpiWidth = (pageWidth - margin * 2 - 9) / 4; // 4 columns, 3 gaps
  const kpiHeight = 20;

  const kpis = [
    { label: 'Crew Utilization', value: `${(data.crewUtilization || 0).toFixed(0)}%`, sub: 'Target: 85%', color: [245, 166, 35] },
    { label: 'Billable Hours', value: data.totalWeek, sub: `${data.activeTechs || 0} active techs` },
    { label: 'Jobs Completed', value: data.jobsCompleted || 0, sub: 'Total period' },
    { label: 'Avg Job Duration', value: data.avgPerTechPerDay, sub: '' }
  ];

  kpis.forEach((kpi, idx) => {
    const xPos = margin + idx * (kpiWidth + 3);
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.rect(xPos, kpiY, kpiWidth, kpiHeight);

    if (kpi.color) {
      pdf.setFillColor(...kpi.color);
      pdf.rect(xPos, kpiY, kpiWidth, 3, 'F');
    }

    pdf.setTextColor(26, 26, 26);
    pdf.setFontSize(7);
    pdf.setFont(undefined, 'bold');
    pdf.text(kpi.label, xPos + 2, kpiY + 5);

    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text(String(kpi.value), xPos + 2, kpiY + 12);

    pdf.setFontSize(6);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(kpi.sub, xPos + 2, kpiY + 17);
  });

  yPosition = kpiY + kpiHeight + 12;

  // Hours by Technician chart
  if (yPosition > pageHeight - 80) {
    pdf.addPage();
    yPosition = margin;
  }

  pdf.setTextColor(26, 26, 26);
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text('Utilization by Technician', margin, yPosition);
  yPosition += 8;

  drawHorizontalBarChart(pdf, data.hoursByTech.slice(0, 8), margin, yPosition, pageWidth - 2 * margin, 40);
  yPosition += 50;

  // Hours by Job Type pie
  if (yPosition > pageHeight - 60) {
    pdf.addPage();
    yPosition = margin;
  }

  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text('Time Distribution by Job Type', margin, yPosition);
  yPosition += 8;

  drawPieChart(pdf, data.hoursByType, margin + 10, yPosition + 20, 25);

  const typeTableX = margin + 65;
  const typeTableData = [
    ['Job Type', 'Hours', '%'],
    ...data.hoursByType.map(t => {
      const total = data.hoursByType.reduce((s, j) => s + j.hours, 0);
      return [t.name, t.hours.toFixed(1), ((t.hours / total) * 100).toFixed(0)];
    })
  ];

  autoTable(pdf, {
    startY: yPosition,
    startX: typeTableX,
    head: [typeTableData[0]],
    body: typeTableData.slice(1),
    margin: { left: typeTableX, right: margin },
    theme: 'grid',
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 20 }, 2: { cellWidth: 15 } },
    headStyles: { fillColor: [26, 26, 26], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
  });

  yPosition += 50;

  // PAGE 2: DETAILED TABLES

  if (yPosition > pageHeight - 50) {
    pdf.addPage();
    yPosition = margin;
  }

  // Daily Breakdown table
  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text('Daily Breakdown', margin, yPosition);
  yPosition += 8;

  const dailyData = [
    ['Date', 'Techs', 'Jobs', 'Hours', 'Utilization'],
    ...data.dailyRows.map(row => [
      row.date,
      row.tech,
      row.jobs.toString(),
      (row.minutes / 60).toFixed(1),
      `${row.utilization.toFixed(0)}%`,
    ]),
  ];

  autoTable(pdf, {
    startY: yPosition,
    head: [dailyData[0]],
    body: dailyData.slice(1),
    margin: { left: margin, right: margin },
    theme: 'grid',
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 18 },
      2: { cellWidth: 18 },
      3: { cellWidth: 25 },
      4: { cellWidth: 30 }
    },
    headStyles: { fillColor: [26, 26, 26], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
  });

  yPosition = (pdf as any).lastAutoTable.finalY + 10;

  // Hours by Technician detailed table
  if (yPosition > pageHeight - 80) {
    pdf.addPage();
    yPosition = margin;
  }

  pdf.setFontSize(11);
  pdf.setFont(undefined, 'bold');
  pdf.text('Hours by Technician (Detailed)', margin, yPosition);
  yPosition += 8;

  const techData = [
    ['Technician', 'Hours', 'Utilization'],
    ...data.hoursByTech.map(t => [
      t.name,
      t.hours.toFixed(1),
      `${(t.utilization || 0).toFixed(0)}%`
    ]),
  ];

  autoTable(pdf, {
    startY: yPosition,
    head: [techData[0]],
    body: techData.slice(1),
    margin: { left: margin, right: margin },
    theme: 'grid',
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 30 }, 2: { cellWidth: 30 } },
    headStyles: { fillColor: [26, 26, 26], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
  });

  // Footer on all pages
  const pageCount = (pdf as any).internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setTextColor(150, 150, 150);
    pdf.setFontSize(8);
    pdf.text(
      'Modern Compactor Repair · Austin, TX',
      margin,
      pageHeight - 8
    );
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 8);
  }

  pdf.save(`MCR_Performance_Report_${data.dateRange.from}_${data.dateRange.to}.pdf`);
}

function drawHorizontalBarChart(pdf: jsPDF, data: Array<{ name: string; hours: number }>, x: number, y: number, width: number, height: number) {
  const maxHours = Math.max(...data.map(d => d.hours), 1);
  const barHeight = Math.min(5, height / data.length);

  data.forEach((item, idx) => {
    const barY = y + idx * (barHeight + 2);
    const barWidth = (item.hours / maxHours) * (width - 80);

    // Label
    pdf.setFontSize(7);
    pdf.setTextColor(26, 26, 26);
    pdf.text(item.name, x, barY + 3);

    // Bar background
    pdf.setFillColor(220, 220, 220);
    pdf.rect(x + 75, barY, barWidth, barHeight, 'F');

    // Bar fill (yellow gradient effect with color)
    pdf.setFillColor(245, 166, 35);
    pdf.rect(x + 75, barY, barWidth * 0.9, barHeight, 'F');

    // Value
    pdf.setTextColor(26, 26, 26);
    pdf.text(item.hours.toFixed(1) + 'h', x + 75 + barWidth + 5, barY + 3);
  });
}

function drawPieChart(pdf: jsPDF, data: Array<{ name: string; hours: number }>, centerX: number, centerY: number, radius: number) {
  const total = data.reduce((s, d) => s + d.hours, 0);
  const colors = [
    [245, 166, 35],   // Yellow (MCR)
    [26, 26, 26],     // Black
    [100, 100, 100],  // Gray
    [200, 200, 200],  // Light gray
  ];

  data.forEach((item, idx) => {
    const color = colors[idx % colors.length];
    const pct = ((item.hours / total) * 100).toFixed(0);

    pdf.setFillColor(...color);
    pdf.rect(centerX - 20, centerY - 15 + idx * 8, 3, 3, 'F');

    pdf.setFontSize(7);
    pdf.setTextColor(26, 26, 26);
    pdf.text(`${item.name}: ${pct}%`, centerX - 15, centerY - 12 + idx * 8);
  });
}

export function exportToExcel(data: ExportData) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['MCR Tech Performance Report'],
    [data.dateRange.from, 'to', data.dateRange.to],
    [],
    ['Metric', 'Value'],
    ['Total Hours Today', data.totalToday],
    ['Total Hours This Week', data.totalWeek],
    ['Total Hours This Month', data.totalMonth],
    ['Avg Hours / Tech / Day', data.avgPerTechPerDay],
  ]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Sheet 2: By Technician
  const techSheet = XLSX.utils.aoa_to_sheet([
    ['Technician', 'Total Hours', 'Jobs Completed', 'Avg Hours/Job'],
    ...data.hoursByTech.map(t => [t.name, t.hours, '', '']),
  ]);
  XLSX.utils.book_append_sheet(workbook, techSheet, 'By Technician');

  // Sheet 3: By Job Type
  const typeSheet = XLSX.utils.aoa_to_sheet([
    ['Job Type', 'Total Hours', 'Entry Count'],
    ...data.hoursByType.map(t => [t.name, t.hours, '']),
  ]);
  XLSX.utils.book_append_sheet(workbook, typeSheet, 'By Job Type');

  // Sheet 4: Daily Breakdown
  const dailySheet = XLSX.utils.aoa_to_sheet([
    ['Date', 'Technician', 'Jobs', 'Total Hours', 'Utilization %'],
    ...data.dailyRows.map(r => [
      r.date,
      r.tech,
      r.jobs,
      (r.minutes / 60).toFixed(2),
      r.utilization.toFixed(0),
    ]),
  ]);
  XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Breakdown');

  // Download
  XLSX.writeFile(workbook, `MCR_Performance_Report_${data.dateRange.from}_${data.dateRange.to}.xlsx`);
}
