import { jsPDF } from 'jspdf';
import { DiaryEntry, DiarySettings } from '../types';

export interface PdfExportOptions {
  includeTitlePage: boolean;
  includeTableOfContents: boolean;
  includeMetadata: boolean;
  paperStyle: 'classic' | 'ivory' | 'clean';
  fontSize: 'standard' | 'large';
  authorName?: string;
  diaryTitle?: string;
}

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  includeTitlePage: true,
  includeTableOfContents: true,
  includeMetadata: true,
  paperStyle: 'classic',
  fontSize: 'standard',
  authorName: 'Ash',
  diaryTitle: "Ash's Personal Diary"
};

/**
 * Strips or structures HTML content for printable display
 */
export function extractTextBlocks(html: string): Array<{ type: 'p' | 'quote' | 'bullet' | 'header'; text: string }> {
  if (!html) return [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blocks: Array<{ type: 'p' | 'quote' | 'bullet' | 'header'; text: string }> = [];

    const nodes = Array.from(doc.body.childNodes);
    if (nodes.length === 0 && doc.body.textContent) {
      return [{ type: 'p', text: doc.body.textContent.trim() }];
    }

    nodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const text = el.textContent?.trim() || '';
        if (!text) return;

        if (tag === 'blockquote') {
          blocks.push({ type: 'quote', text });
        } else if (tag === 'ul' || tag === 'ol') {
          el.querySelectorAll('li').forEach((li) => {
            const liText = li.textContent?.trim();
            if (liText) blocks.push({ type: 'bullet', text: liText });
          });
        } else if (['h1', 'h2', 'h3', 'h4'].includes(tag)) {
          blocks.push({ type: 'header', text });
        } else {
          blocks.push({ type: 'p', text });
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim() || '';
        if (text) blocks.push({ type: 'p', text });
      }
    });

    return blocks.length > 0 ? blocks : [{ type: 'p', text: doc.body.textContent?.trim() || '' }];
  } catch {
    // Fallback if DOMParser fails
    const clean = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return [{ type: 'p', text: clean }];
  }
}

/**
 * Generates and downloads a clean, printable PDF document of selected diary entries.
 */
export async function exportEntriesToPdf(
  entries: DiaryEntry[],
  settings?: DiarySettings,
  options: Partial<PdfExportOptions> = {}
): Promise<void> {
  if (!entries || entries.length === 0) {
    throw new Error('No diary entries selected for export.');
  }

  const mergedOptions: PdfExportOptions = {
    ...DEFAULT_PDF_OPTIONS,
    diaryTitle: settings?.title || DEFAULT_PDF_OPTIONS.diaryTitle,
    authorName: settings?.authorName || DEFAULT_PDF_OPTIONS.authorName,
    ...options
  };

  // Sort entries in book order
  const sortedEntries = [...entries].sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));

  // Initialize PDF (A4: 210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 22;
  const contentWidth = pageWidth - margin * 2;

  // Paper styling colors
  const styles = {
    classic: {
      bg: [247, 243, 233] as [number, number, number],
      text: [43, 36, 29] as [number, number, number],
      muted: [120, 107, 92] as [number, number, number],
      gold: [168, 134, 52] as [number, number, number],
      rule: [210, 198, 178] as [number, number, number],
      quoteBg: [240, 234, 220] as [number, number, number]
    },
    ivory: {
      bg: [252, 251, 248] as [number, number, number],
      text: [35, 33, 30] as [number, number, number],
      muted: [115, 110, 105] as [number, number, number],
      gold: [150, 120, 45] as [number, number, number],
      rule: [225, 220, 212] as [number, number, number],
      quoteBg: [245, 243, 238] as [number, number, number]
    },
    clean: {
      bg: [255, 255, 255] as [number, number, number],
      text: [25, 25, 28] as [number, number, number],
      muted: [100, 100, 108] as [number, number, number],
      gold: [140, 110, 40] as [number, number, number],
      rule: [220, 220, 225] as [number, number, number],
      quoteBg: [248, 248, 250] as [number, number, number]
    }
  }[mergedOptions.paperStyle];

  let currentPageNumber = 1;

  // Helper to draw parchment background
  const drawPageBackground = () => {
    doc.setFillColor(...styles.bg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Subtle outer border
    doc.setDrawColor(...styles.rule);
    doc.setLineWidth(0.35);
    doc.rect(margin - 6, margin - 6, contentWidth + 12, pageHeight - (margin - 6) * 2);

    // Inner fine line
    doc.setLineWidth(0.15);
    doc.rect(margin - 4.5, margin - 4.5, contentWidth + 9, pageHeight - (margin - 4.5) * 2);
  };

  // Helper to draw running header & footer
  const drawPageDecorations = (runningTitle: string, showPageNumber: boolean = true) => {
    // Header
    doc.setFont('times', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...styles.muted);
    doc.text(runningTitle.toUpperCase(), pageWidth / 2, margin - 9, { align: 'center' });

    // Header divider line
    doc.setDrawColor(...styles.rule);
    doc.setLineWidth(0.2);
    doc.line(margin, margin - 7, pageWidth - margin, margin - 7);

    // Footer
    if (showPageNumber) {
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...styles.muted);
      doc.text(`— ${currentPageNumber} —`, pageWidth / 2, pageHeight - margin + 8, { align: 'center' });
    }
  };

  // 1. Title Cover Page
  if (mergedOptions.includeTitlePage) {
    drawPageBackground();

    // Decorative emblem / heading
    let y = 65;
    doc.setFont('times', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...styles.gold);
    doc.text(mergedOptions.diaryTitle || "Ash's Personal Diary", pageWidth / 2, y, { align: 'center' });

    y += 10;
    doc.setDrawColor(...styles.gold);
    doc.setLineWidth(0.4);
    doc.line(pageWidth / 2 - 30, y, pageWidth / 2 + 30, y);

    y += 14;
    doc.setFont('times', 'italic');
    doc.setFontSize(13);
    doc.setTextColor(...styles.muted);
    doc.text('Selected Memoirs & Inscribed Thoughts', pageWidth / 2, y, { align: 'center' });

    y += 60;
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...styles.text);
    doc.text(`Written and Inscribed by`, pageWidth / 2, y, { align: 'center' });

    y += 7;
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text(mergedOptions.authorName || 'Ash', pageWidth / 2, y, { align: 'center' });

    y += 35;
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...styles.muted);
    doc.text(`Printed Collection of ${sortedEntries.length} Inscribed Entries`, pageWidth / 2, y, { align: 'center' });

    y += 6;
    const exportDateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Exported on ${exportDateStr}`, pageWidth / 2, y, { align: 'center' });

    // Next page
    doc.addPage();
    currentPageNumber++;
  }

  // 2. Table of Contents
  if (mergedOptions.includeTableOfContents && sortedEntries.length > 1) {
    drawPageBackground();
    drawPageDecorations(mergedOptions.diaryTitle || 'Diary Index', true);

    let y = margin + 12;
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...styles.gold);
    doc.text('TABLE OF CONTENTS', pageWidth / 2, y, { align: 'center' });

    y += 5;
    doc.setDrawColor(...styles.rule);
    doc.setLineWidth(0.3);
    doc.line(pageWidth / 2 - 25, y, pageWidth / 2 + 25, y);

    y += 14;
    sortedEntries.forEach((entry, idx) => {
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...styles.text);

      const numStr = String(idx + 1).padStart(2, '0');
      doc.text(`${numStr}.`, margin + 4, y);

      const titleText = entry.title || 'Untitled Entry';
      doc.text(titleText, margin + 14, y);

      const entryDate = entry.date ? new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      doc.setFont('times', 'italic');
      doc.setFontSize(9.5);
      doc.setTextColor(...styles.muted);
      doc.text(entryDate, pageWidth - margin - 4, y, { align: 'right' });

      // Dotted leader line
      doc.setDrawColor(...styles.rule);
      doc.setLineDashPattern([0.8, 1.2], 0);
      doc.line(margin + 60, y - 0.5, pageWidth - margin - 35, y - 0.5);
      doc.setLineDashPattern([], 0); // reset

      y += 9;
      if (y > pageHeight - margin - 15) {
        doc.addPage();
        currentPageNumber++;
        drawPageBackground();
        drawPageDecorations('Table of Contents', true);
        y = margin + 12;
      }
    });

    doc.addPage();
    currentPageNumber++;
  }

  // 3. Render Each Diary Entry
  sortedEntries.forEach((entry, entryIdx) => {
    drawPageBackground();
    drawPageDecorations(mergedOptions.diaryTitle || 'Diary Entry', true);

    let y = margin + 8;

    // Entry Number / Chapter
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...styles.gold);
    doc.text(`ENTRY ${String(entryIdx + 1).padStart(2, '0')}`, margin, y);

    // Entry Date
    if (entry.date) {
      const formattedDate = new Date(entry.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.setFont('times', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(...styles.muted);
      doc.text(formattedDate, pageWidth - margin, y, { align: 'right' });
    }

    y += 7;

    // Entry Title
    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...styles.text);
    const titleLines = doc.splitTextToSize(entry.title || 'Untitled Entry', contentWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 7;

    // Metadata line (Mood, Location, Tags)
    if (mergedOptions.includeMetadata) {
      const metaParts: string[] = [];
      if (entry.mood) metaParts.push(`Mood: ${entry.mood}`);
      if (entry.location) metaParts.push(`Location: ${entry.location}`);
      if (entry.tags && entry.tags.length > 0) metaParts.push(`Tags: #${entry.tags.join(' #')}`);

      if (metaParts.length > 0) {
        doc.setFont('times', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...styles.muted);
        doc.text(metaParts.join('   •   '), margin, y);
        y += 6;
      }
    }

    // Divider ornament
    doc.setDrawColor(...styles.rule);
    doc.setLineWidth(0.35);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Entry Content
    const baseFontSize = mergedOptions.fontSize === 'large' ? 12 : 10.5;
    const lineHeight = mergedOptions.fontSize === 'large' ? 6.2 : 5.4;
    const blocks = extractTextBlocks(entry.content);

    blocks.forEach((block) => {
      // Check for page break
      if (y > pageHeight - margin - 22) {
        doc.addPage();
        currentPageNumber++;
        drawPageBackground();
        drawPageDecorations(`${entry.title} (Continued)`, true);
        y = margin + 12;
      }

      if (block.type === 'quote') {
        doc.setFont('times', 'italic');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(...styles.text);

        const quoteWidth = contentWidth - 14;
        const quoteLines = doc.splitTextToSize(block.text, quoteWidth);
        const blockHeight = quoteLines.length * lineHeight + 4;

        // Quote background and left accent bar
        doc.setFillColor(...styles.quoteBg);
        doc.rect(margin, y - 2, contentWidth, blockHeight, 'F');
        doc.setFillColor(...styles.gold);
        doc.rect(margin, y - 2, 1.5, blockHeight, 'F');

        doc.text(quoteLines, margin + 7, y + 3);
        y += blockHeight + 5;
      } else if (block.type === 'bullet') {
        doc.setFont('times', 'normal');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(...styles.text);

        const bulletLines = doc.splitTextToSize(block.text, contentWidth - 8);
        doc.text('•', margin + 2, y);
        doc.text(bulletLines, margin + 7, y);
        y += bulletLines.length * lineHeight + 2;
      } else if (block.type === 'header') {
        y += 2;
        doc.setFont('times', 'bold');
        doc.setFontSize(baseFontSize + 2);
        doc.setTextColor(...styles.text);
        const hLines = doc.splitTextToSize(block.text, contentWidth);
        doc.text(hLines, margin, y);
        y += hLines.length * (lineHeight + 1) + 3;
      } else {
        // Standard paragraph
        doc.setFont('times', 'normal');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(...styles.text);

        const paraLines = doc.splitTextToSize(block.text, contentWidth);
        doc.text(paraLines, margin, y);
        y += paraLines.length * lineHeight + 4;
      }
    });

    // Add page if more entries remain
    if (entryIdx < sortedEntries.length - 1) {
      doc.addPage();
      currentPageNumber++;
    }
  });

  // Save the PDF file
  const filename = `ashs-diary-export-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/**
 * Generates an HTML printable window / triggers print dialog with book styling.
 */
export function printEntriesDirectly(
  entries: DiaryEntry[],
  settings?: DiarySettings,
  options: Partial<PdfExportOptions> = {}
): void {
  if (!entries || entries.length === 0) {
    throw new Error('No diary entries selected to print.');
  }

  const sortedEntries = [...entries].sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
  const title = settings?.title || "Ash's Personal Diary";
  const author = settings?.authorName || 'Ash';

  // Create an iframe to safely isolate printing without navigating away
  const printIframe = document.createElement('iframe');
  printIframe.style.position = 'fixed';
  printIframe.style.right = '0';
  printIframe.style.bottom = '0';
  printIframe.style.width = '0';
  printIframe.style.height = '0';
  printIframe.style.border = '0';
  document.body.appendChild(printIframe);

  const doc = printIframe.contentWindow?.document;
  if (!doc) return;

  const entriesHtml = sortedEntries.map((entry, idx) => {
    const formattedDate = entry.date
      ? new Date(entry.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : '';

    return `
      <section class="diary-print-entry">
        <header class="entry-header">
          <div class="entry-sub">
            <span class="entry-num">ENTRY ${String(idx + 1).padStart(2, '0')}</span>
            <span class="entry-date">${formattedDate}</span>
          </div>
          <h1 class="entry-title">${entry.title || 'Untitled Entry'}</h1>
          <div class="entry-meta">
            ${entry.mood ? `<span class="badge">Mood: ${entry.mood}</span>` : ''}
            ${entry.location ? `<span class="badge">Location: ${entry.location}</span>` : ''}
            ${entry.tags && entry.tags.length > 0 ? `<span class="badge">Tags: #${entry.tags.join(' #')}</span>` : ''}
          </div>
        </header>
        <hr class="entry-divider" />
        <div class="entry-content">
          ${entry.content || ''}
        </div>
        <footer class="entry-footer">
          <span>${title}</span>
          <span>Page ${idx + 1}</span>
        </footer>
      </section>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} — Printable PDF</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 18mm 18mm 20mm 18mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Cormorant Garamond', Georgia, serif;
            color: #1a1612;
            background: #fff;
            margin: 0;
            padding: 0;
            line-height: 1.6;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .cover-page {
            height: 90vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            page-break-after: always;
            break-after: page;
            border: 2px solid #d4af37;
            padding: 40px;
            margin: 20px 0;
          }
          .cover-title {
            font-family: 'Cinzel', serif;
            font-size: 32px;
            color: #8c6e28;
            margin-bottom: 12px;
            letter-spacing: 2px;
            text-transform: uppercase;
          }
          .cover-sub {
            font-size: 18px;
            font-style: italic;
            color: #665b4c;
            margin-bottom: 50px;
          }
          .cover-author {
            font-size: 16px;
            color: #2b241d;
            margin-top: 40px;
          }
          .diary-print-entry {
            page-break-after: always;
            break-after: page;
            min-height: 92vh;
            display: flex;
            flex-direction: column;
            padding: 10px 0;
          }
          .diary-print-entry:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .entry-header {
            margin-bottom: 14px;
          }
          .entry-sub {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #8c6e28;
            font-family: 'Cinzel', serif;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .entry-title {
            font-size: 26px;
            font-weight: 700;
            color: #1a1612;
            margin: 4px 0 10px 0;
            line-height: 1.25;
          }
          .entry-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            font-size: 12px;
            color: #6e6456;
            font-style: italic;
          }
          .entry-divider {
            border: 0;
            border-top: 1px solid #d4af37;
            margin: 12px 0 20px 0;
            opacity: 0.7;
          }
          .entry-content {
            font-size: 15px;
            line-height: 1.75;
            color: #24201b;
            flex: 1;
          }
          .entry-content p {
            margin-bottom: 14px;
          }
          .entry-content blockquote {
            border-left: 3px solid #d4af37;
            background: #faf7f0;
            padding: 10px 16px;
            margin: 16px 0;
            font-style: italic;
          }
          .entry-content img {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            margin: 12px 0;
          }
          .entry-footer {
            margin-top: auto;
            padding-top: 16px;
            border-top: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #8c8273;
            font-family: 'Cinzel', serif;
            letter-spacing: 1px;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="cover-page">
          <h1 class="cover-title">${title}</h1>
          <div class="cover-sub">Chronicles of Thought & Quiet Hours</div>
          <div class="cover-author">Inscribed by ${author}</div>
          <div style="font-size: 13px; color: #887e70; margin-top: 12px;">
            ${sortedEntries.length} Recorded Entries • Printed Collection
          </div>
        </div>
        ${entriesHtml}
      </body>
    </html>
  `;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  printIframe.contentWindow?.focus();
  setTimeout(() => {
    printIframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(printIframe);
    }, 2000);
  }, 500);
}
