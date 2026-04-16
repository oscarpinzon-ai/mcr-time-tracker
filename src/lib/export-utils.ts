import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportData {
  dateRange: { from: string; to: string };
  totalToday: string;
  totalWeek: string;
  totalMonth: string;
  avgPerTechPerDay: string;
  hoursByTech: Array<{ name: string; hours: number }>;
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
  const margin = 15;
  let yPosition = margin;

  // Header
  pdf.setFillColor(26, 26, 26); // Black header
  pdf.rect(0, 0, pageWidth, 25, 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.text('Tech Performance Tool — Report', margin, 10);
  pdf.setFontSize(10);
  pdf.text(`${data.dateRange.from} to ${data.dateRange.to}`, margin, 18);

  yPosition = 35;

  // Summary section
  pdf.setTextColor(26, 26, 26);
  pdf.setFontSize(12);
  pdf.text('Summary', margin, yPosition);
  yPosition += 8;

  const summaryData = [
    ['Metric', 'Value'],
    ['Total Hours Today', data.totalToday],
    ['Total Hours This Week', data.totalWeek],
    ['Total Hours This Month', data.totalMonth],
    ['Avg Hours / Tech / Day', data.avgPerTechPerDay],
  ];

  autoTable(pdf, {
    startY: yPosition,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [245, 166, 35], textColor: 26 },
    bodyStyles: { textColor: 26 },
    footStyles: { textColor: 26 },
  });

  yPosition = (pdf as any).lastAutoTable.finalY + 10;

  // Hours by Technician table
  pdf.setFontSize(12);
  pdf.text('Hours by Technician', margin, yPosition);
  yPosition += 8;

  const techData = [
    ['Technician', 'Hours'],
    ...data.hoursByTech.map(t => [t.name, t.hours.toString()]),
  ];

  autoTable(pdf, {
    startY: yPosition,
    head: [techData[0]],
    body: techData.slice(1),
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [245, 166, 35], textColor: 26 },
  });

  yPosition = (pdf as any).lastAutoTable.finalY + 10;

  // Hours by Job Type table
  pdf.setFontSize(12);
  pdf.text('Hours by Job Type', margin, yPosition);
  yPosition += 8;

  const typeData = [
    ['Job Type', 'Hours'],
    ...data.hoursByType.map(t => [t.name, t.hours.toString()]),
  ];

  autoTable(pdf, {
    startY: yPosition,
    head: [typeData[0]],
    body: typeData.slice(1),
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [245, 166, 35], textColor: 26 },
  });

  yPosition = (pdf as any).lastAutoTable.finalY + 10;

  // Daily Breakdown table
  if (yPosition > pdf.internal.pageSize.getHeight() - 30) {
    pdf.addPage();
    yPosition = margin;
  }

  pdf.setFontSize(12);
  pdf.text('Daily Breakdown', margin, yPosition);
  yPosition += 8;

  const dailyData = [
    ['Date', 'Technician', 'Jobs', 'Hours', 'Utilization %'],
    ...data.dailyRows.map(row => [
      row.date,
      row.tech,
      row.jobs.toString(),
      (row.minutes / 60).toFixed(2),
      row.utilization.toFixed(0),
    ]),
  ];

  autoTable(pdf, {
    startY: yPosition,
    head: [dailyData[0]],
    body: dailyData.slice(1),
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [245, 166, 35], textColor: 26 },
  });

  // Footer
  const pageCount = (pdf as any).internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setTextColor(74, 74, 74);
    pdf.setFontSize(9);
    pdf.text(
      `Generated on ${new Date().toLocaleString()} · Modern Compactor Repair · Austin, TX`,
      margin,
      pdf.internal.pageSize.getHeight() - 10
    );
    pdf.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pdf.internal.pageSize.getHeight() - 10);
  }

  // Download
  pdf.save(`MCR_Performance_Report_${data.dateRange.from}_${data.dateRange.to}.pdf`);
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
