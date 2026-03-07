// PDF generation from appeal text using jsPDF with Cyrillic support

import { jsPDF } from 'jspdf';
import { ROBOTO_BASE64 } from './roboto-font';

const PAGE_WIDTH = 210; // A4 mm
const MARGIN = 20;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_SIZE = 12;
const LINE_HEIGHT = 6;

export function generatePdf(text: string, filename = 'обращение.pdf'): File {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Register Cyrillic font
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_BASE64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(FONT_SIZE);

  // Split text into lines that fit page width
  const lines = doc.splitTextToSize(text, TEXT_WIDTH) as string[];

  let y = MARGIN;
  const pageHeight = 297 - MARGIN; // A4 height minus bottom margin

  for (const line of lines) {
    if (y + LINE_HEIGHT > pageHeight) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT;
  }

  const blob = doc.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
}
