/** One-page PDF of a saved result. jsPDF is loaded only when someone asks for a download. */

import { formatDate, formatDuration } from './format.js';

/** jsPDF's built-in fonts only cover basic Latin, so swap typographic characters for plain ones. */
export function toPdfText(text) {
  return String(text ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7e\n]/g, '');
}

export async function downloadResultPdf(result) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  const width = 210 - margin * 2;
  let y = margin;

  const write = (text, { size = 11, bold = false, color = [29, 29, 31], gap = 3, indent = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(toPdfText(text), width - indent)) {
      if (y > 280) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin + indent, y);
      y += size * 0.45 + 1.4;
    }
    y += gap;
  };

  write('SecuSim', { size: 11, bold: true, color: [0, 122, 112], gap: 1 });
  write(`${result.scenarioNumber ? `Scenario ${result.scenarioNumber}` : 'Custom scenario'}: ${result.scenarioTitle}`, { size: 18, bold: true, gap: 4 });
  write(result.passed ? 'Passed' : 'Not passed', { size: 14, bold: true, color: result.passed ? [26, 127, 70] : [196, 34, 27], gap: 2 });
  write(`${result.met} of ${result.total} requirements met`, { color: [110, 110, 115], gap: 1 });
  write(`Time used: ${formatDuration(result.secondsUsed)} of ${formatDuration(result.timeLimit)}${result.finishedBy === 'timeout' ? ' (time ran out)' : ''}`, { color: [110, 110, 115], gap: 1 });
  write(`Saved: ${formatDate(result.createdAt)}`, { color: [110, 110, 115], gap: 8 });

  write('Requirements', { size: 13, bold: true, gap: 3 });
  for (const c of result.checks) {
    write(`${c.ok ? 'MET' : 'NOT MET'}   ${c.label}`, { bold: true, color: c.ok ? [26, 127, 70] : [196, 34, 27], gap: 0.5 });
    write(c.detail, { size: 10, color: [110, 110, 115], gap: 3, indent: 16 });
  }

  const stamp = new Date(result.createdAt).toISOString().slice(0, 10);
  doc.save(`secusim-scenario-${result.scenarioNumber ?? 'custom'}-${stamp}.pdf`);
}
