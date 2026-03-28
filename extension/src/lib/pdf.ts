// PDF generation from appeal text using jsPDF + merge with power of attorney via pdf-lib

import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { ROBOTO_BASE64 } from './roboto-font';
import { POWER_OF_ATTORNEY_BASE64 } from './power-of-attorney';

const PAGE_WIDTH = 210; // A4 mm
const MARGIN = 20;
const TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_SIZE = 12;
const LINE_HEIGHT = 6;

function generateAppealPdfBytes(text: string): ArrayBuffer {
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

  return doc.output('arraybuffer');
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function generatePdf(text: string, filename = 'обращение.pdf'): Promise<File> {
  const appealBytes = generateAppealPdfBytes(text);

  // Merge: appeal pages + power of attorney page
  const merged = await PDFDocument.create();

  const appealDoc = await PDFDocument.load(appealBytes);
  const appealPages = await merged.copyPages(appealDoc, appealDoc.getPageIndices());
  for (const page of appealPages) {
    merged.addPage(page);
  }

  const poaBytes = base64ToBytes(POWER_OF_ATTORNEY_BASE64);
  const poaDoc = await PDFDocument.load(poaBytes);
  const poaPages = await merged.copyPages(poaDoc, poaDoc.getPageIndices());
  for (const page of poaPages) {
    merged.addPage(page);
  }

  const mergedBytes = await merged.save();
  return new File([mergedBytes.buffer as ArrayBuffer], filename, { type: 'application/pdf' });
}
