import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { DiaryEntry, DiarySettings } from '../types';

export interface PdfExportOptions {
  includeTitlePage: boolean;
  includeTableOfContents: boolean;
  includeMetadata: boolean;
  paperStyle: 'classic' | 'ivory' | 'clean';
  fontSize: 'standard' | 'large';
  renderMode?: 'canvas-hd' | 'vector';
  authorName?: string;
  diaryTitle?: string;
  onProgress?: (current: number, total: number, message: string) => void;
}

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  includeTitlePage: true,
  includeTableOfContents: true,
  includeMetadata: true,
  paperStyle: 'classic',
  fontSize: 'standard',
  renderMode: 'canvas-hd',
  authorName: 'Ash Wickramasinghe',
  diaryTitle: "Ash's Personal Diary"
};

// Cached font Base64 strings to avoid re-fetching
let cachedAbhayaRegularBase64: string | null = null;
let cachedAbhayaBoldBase64: string | null = null;

/**
 * Fetches a font file and converts it into a Base64 string for jsPDF
 */
async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load font from ${url} (status ${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Loads and registers Sinhala fonts (Abhaya Libre Regular & Bold) into jsPDF VFS
 */
async function registerSinhalaFontsInDoc(doc: jsPDF): Promise<boolean> {
  try {
    if (!cachedAbhayaRegularBase64) {
      cachedAbhayaRegularBase64 = await fetchFontAsBase64('/fonts/AbhayaLibre-Regular.ttf');
    }
    if (!cachedAbhayaBoldBase64) {
      try {
        cachedAbhayaBoldBase64 = await fetchFontAsBase64('/fonts/AbhayaLibre-Bold.ttf');
      } catch {
        cachedAbhayaBoldBase64 = cachedAbhayaRegularBase64;
      }
    }

    if (cachedAbhayaRegularBase64) {
      doc.addFileToVFS('AbhayaLibre-Regular.ttf', cachedAbhayaRegularBase64);
      doc.addFont('AbhayaLibre-Regular.ttf', 'AbhayaLibre', 'normal');
    }

    if (cachedAbhayaBoldBase64) {
      doc.addFileToVFS('AbhayaLibre-Bold.ttf', cachedAbhayaBoldBase64);
      doc.addFont('AbhayaLibre-Bold.ttf', 'AbhayaLibre', 'bold');
    }

    return true;
  } catch (err) {
    console.warn('Could not embed local Sinhala TrueType font into jsPDF VFS:', err);
    return false;
  }
}

/**
 * Extracts structured blocks from entry HTML content
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
    const clean = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return [{ type: 'p', text: clean }];
  }
}

/**
 * Color palettes for printable pages
 */
const PAPER_THEMES = {
  classic: {
    bg: '#f7f3e9',
    text: '#2b241d',
    muted: '#786b5c',
    gold: '#a88634',
    rule: '#d2c6b2',
    quoteBg: '#efe8dc'
  },
  ivory: {
    bg: '#fcfbf8',
    text: '#23211e',
    muted: '#736e69',
    gold: '#96782d',
    rule: '#e1dcd4',
    quoteBg: '#f5f3ee'
  },
  clean: {
    bg: '#ffffff',
    text: '#19191c',
    muted: '#64646c',
    gold: '#8c6e28',
    rule: '#dcdce1',
    quoteBg: '#f8f8fa'
  }
};

/**
 * Generates and downloads a formatted PDF document of selected diary entries.
 * Defaults to High-Fidelity Canvas rendering for full Sinhala font shaping and ligatures.
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

  if (mergedOptions.renderMode === 'vector') {
    await exportViaVectorPdf(entries, mergedOptions);
  } else {
    // Default: High-Definition Canvas Rendering (preserves 100% of Sinhala font ligatures & styling)
    await exportViaCanvasHdPdf(entries, mergedOptions);
  }
}

/**
 * High-Definition Canvas-Rendered PDF Export:
 * Renders each diary page into a styled DOM element with full browser HarfBuzz font shaping,
 * capturing 100% accurate Sinhala characters, vowel ligatures (kombuva), conjunct consonants,
 * and vintage parchment styling at 2x resolution.
 */
async function exportViaCanvasHdPdf(
  entries: DiaryEntry[],
  options: PdfExportOptions
): Promise<void> {
  const sortedEntries = [...entries].sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));
  const theme = PAPER_THEMES[options.paperStyle];

  // Wait for browser fonts to load (including Abhaya Libre and Noto Serif Sinhala)
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('Font loading check timed out or not supported:', e);
    }
  }

  // Create isolated offscreen container for page rendering
  const scratchpad = document.createElement('div');
  scratchpad.id = 'diary-pdf-export-scratchpad';
  scratchpad.style.position = 'fixed';
  scratchpad.style.left = '-9999px';
  scratchpad.style.top = '0';
  scratchpad.style.width = '794px'; // 210mm at 96 DPI A4 width
  scratchpad.style.zIndex = '-9999';
  scratchpad.style.opacity = '0';
  scratchpad.style.pointerEvents = 'none';
  document.body.appendChild(scratchpad);

  const pagesToRender: HTMLElement[] = [];
  let pageCounter = 1;

  // Helper to create an A4 page element with borders & headers
  const createPageElement = (headerText: string = '', showFooter: boolean = true): { page: HTMLElement; content: HTMLElement } => {
    const page = document.createElement('div');
    page.style.width = '794px';
    page.style.height = '1123px'; // 297mm at 96 DPI A4 height
    page.style.backgroundColor = theme.bg;
    page.style.color = theme.text;
    page.style.fontFamily = "'Abhaya Libre', 'Noto Serif Sinhala', 'Cormorant Garamond', 'Iskoola Pota', Georgia, serif";
    page.style.boxSizing = 'border-box';
    page.style.padding = '48px 56px';
    page.style.position = 'relative';
    page.style.display = 'flex';
    page.style.flexDirection = 'column';
    page.style.overflow = 'hidden';

    // Outer double border
    const borderOuter = document.createElement('div');
    borderOuter.style.position = 'absolute';
    borderOuter.style.inset = '24px';
    borderOuter.style.border = `1px solid ${theme.rule}`;
    borderOuter.style.pointerEvents = 'none';
    page.appendChild(borderOuter);

    const borderInner = document.createElement('div');
    borderInner.style.position = 'absolute';
    borderInner.style.inset = '28px';
    borderInner.style.border = `0.5px solid ${theme.rule}`;
    borderInner.style.opacity = '0.7';
    borderInner.style.pointerEvents = 'none';
    page.appendChild(borderInner);

    // Running Header
    if (headerText) {
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'center';
      header.style.alignItems = 'center';
      header.style.marginBottom = '24px';
      header.style.paddingBottom = '10px';
      header.style.borderBottom = `1px solid ${theme.rule}`;
      header.style.fontSize = '12px';
      header.style.letterSpacing = '2px';
      header.style.color = theme.muted;
      header.style.textTransform = 'uppercase';
      header.style.fontFamily = "'Cinzel', 'Abhaya Libre', serif";
      header.textContent = headerText;
      page.appendChild(header);
    }

    // Main content area
    const content = document.createElement('div');
    content.style.flex = '1';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.minHeight = '0';
    page.appendChild(content);

    // Running Footer
    if (showFooter) {
      const footer = document.createElement('div');
      footer.style.marginTop = 'auto';
      footer.style.paddingTop = '14px';
      footer.style.borderTop = `1px solid ${theme.rule}`;
      footer.style.display = 'flex';
      footer.style.justifyContent = 'space-between';
      footer.style.alignItems = 'center';
      footer.style.fontSize = '11px';
      footer.style.color = theme.muted;
      footer.style.fontStyle = 'italic';

      const titleSpan = document.createElement('span');
      titleSpan.textContent = options.diaryTitle || "Ash's Personal Diary";
      footer.appendChild(titleSpan);

      const numSpan = document.createElement('span');
      numSpan.textContent = `— ${pageCounter} —`;
      footer.appendChild(numSpan);

      page.appendChild(footer);
      pageCounter++;
    }

    return { page, content };
  };

  try {
    // 1. Cover Page
    if (options.includeTitlePage) {
      const { page, content } = createPageElement('', false);
      content.style.justifyContent = 'center';
      content.style.alignItems = 'center';
      content.style.textAlign = 'center';
      content.style.padding = '40px 20px';

      const emblem = document.createElement('div');
      emblem.style.width = '72px';
      emblem.style.height = '72px';
      emblem.style.margin = '0 auto 26px auto';
      emblem.style.border = `2px solid ${theme.gold}`;
      emblem.style.borderRadius = '50%';
      emblem.style.overflow = 'hidden';
      emblem.style.backgroundColor = '#000000';
      emblem.innerHTML = `<img src="/logo.png" style="width:100%;height:100%;object-fit:cover;" />`;
      content.appendChild(emblem);

      const titleEl = document.createElement('h1');
      titleEl.style.fontFamily = "'Abhaya Libre', 'Noto Serif Sinhala', 'Cinzel', serif";
      titleEl.style.fontSize = '34px';
      titleEl.style.fontWeight = '700';
      titleEl.style.color = theme.gold;
      titleEl.style.margin = '0 0 12px 0';
      titleEl.style.lineHeight = '1.25';
      titleEl.textContent = options.diaryTitle || "Ash's Personal Diary";
      content.appendChild(titleEl);

      const divider = document.createElement('div');
      divider.style.width = '90px';
      divider.style.height = '1.5px';
      divider.style.backgroundColor = theme.gold;
      divider.style.margin = '14px auto 18px auto';
      content.appendChild(divider);

      const subEl = document.createElement('div');
      subEl.style.fontSize = '16px';
      subEl.style.fontStyle = 'italic';
      subEl.style.color = theme.muted;
      subEl.style.marginBottom = '70px';
      subEl.textContent = 'Selected Memoirs & Inscribed Thoughts';
      content.appendChild(subEl);

      const byEl = document.createElement('div');
      byEl.style.fontSize = '13px';
      byEl.style.textTransform = 'uppercase';
      byEl.style.letterSpacing = '2px';
      byEl.style.color = theme.muted;
      byEl.style.marginBottom = '8px';
      byEl.textContent = 'Authored and Inscribed by';
      content.appendChild(byEl);

      const authorEl = document.createElement('div');
      authorEl.style.fontSize = '22px';
      authorEl.style.fontWeight = '700';
      authorEl.style.color = theme.text;
      authorEl.style.marginBottom = '80px';
      authorEl.textContent = options.authorName || 'Ash Wickramasinghe';
      content.appendChild(authorEl);

      const dateEl = document.createElement('div');
      dateEl.style.fontSize = '12px';
      dateEl.style.color = theme.muted;
      const exportDateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      dateEl.textContent = `${sortedEntries.length} Recorded Entries • Inscribed on ${exportDateStr}`;
      content.appendChild(dateEl);

      scratchpad.appendChild(page);
      pagesToRender.push(page);
    }

    // 2. Table of Contents
    if (options.includeTableOfContents && sortedEntries.length > 1) {
      const { page, content } = createPageElement('Table of Contents', true);

      const tocTitle = document.createElement('h2');
      tocTitle.style.fontFamily = "'Cinzel', 'Abhaya Libre', serif";
      tocTitle.style.fontSize = '20px';
      tocTitle.style.fontWeight = '700';
      tocTitle.style.color = theme.gold;
      tocTitle.style.textAlign = 'center';
      tocTitle.style.margin = '10px 0 20px 0';
      tocTitle.textContent = 'TABLE OF CONTENTS';
      content.appendChild(tocTitle);

      const tocList = document.createElement('div');
      tocList.style.display = 'flex';
      tocList.style.flexDirection = 'column';
      tocList.style.gap = '14px';

      sortedEntries.forEach((entry, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'baseline';
        row.style.gap = '8px';
        row.style.fontSize = '14px';

        const numSpan = document.createElement('span');
        numSpan.style.fontFamily = "'Cinzel', serif";
        numSpan.style.color = theme.gold;
        numSpan.style.fontWeight = '700';
        numSpan.style.minWidth = '28px';
        numSpan.textContent = `${String(idx + 1).padStart(2, '0')}.`;
        row.appendChild(numSpan);

        const titleSpan = document.createElement('span');
        titleSpan.style.fontWeight = '600';
        titleSpan.style.color = theme.text;
        titleSpan.style.flex = '1';
        titleSpan.style.whiteSpace = 'nowrap';
        titleSpan.style.overflow = 'hidden';
        titleSpan.style.textOverflow = 'ellipsis';
        titleSpan.textContent = entry.title || 'Untitled Entry';
        row.appendChild(titleSpan);

        const dateSpan = document.createElement('span');
        dateSpan.style.fontSize = '12px';
        dateSpan.style.fontStyle = 'italic';
        dateSpan.style.color = theme.muted;
        dateSpan.textContent = entry.date ? new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        row.appendChild(dateSpan);

        tocList.appendChild(row);
      });

      content.appendChild(tocList);
      scratchpad.appendChild(page);
      pagesToRender.push(page);
    }

    // 3. Render Each Diary Entry
    for (let entryIdx = 0; entryIdx < sortedEntries.length; entryIdx++) {
      const entry = sortedEntries[entryIdx];
      let { page, content } = createPageElement(options.diaryTitle || 'Diary Entry', true);

      // Entry Header
      const headerBar = document.createElement('div');
      headerBar.style.display = 'flex';
      headerBar.style.justifyContent = 'space-between';
      headerBar.style.alignItems = 'baseline';
      headerBar.style.marginBottom = '6px';

      const entryNum = document.createElement('span');
      entryNum.style.fontFamily = "'Cinzel', serif";
      entryNum.style.color = theme.gold;
      entryNum.style.fontSize = '12px';
      entryNum.style.fontWeight = '700';
      entryNum.style.letterSpacing = '1px';
      entryNum.textContent = `ENTRY ${String(entryIdx + 1).padStart(2, '0')}`;
      headerBar.appendChild(entryNum);

      if (entry.date) {
        const entryDate = document.createElement('span');
        entryDate.style.fontSize = '13px';
        entryDate.style.fontStyle = 'italic';
        entryDate.style.color = theme.muted;
        entryDate.textContent = new Date(entry.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        headerBar.appendChild(entryDate);
      }
      content.appendChild(headerBar);

      // Entry Title (With full Sinhala & Serif typography)
      const entryTitleEl = document.createElement('h1');
      entryTitleEl.style.fontFamily = "'Abhaya Libre', 'Noto Serif Sinhala', 'Cormorant Garamond', serif";
      entryTitleEl.style.fontSize = '26px';
      entryTitleEl.style.fontWeight = '700';
      entryTitleEl.style.color = theme.text;
      entryTitleEl.style.lineHeight = '1.35';
      entryTitleEl.style.margin = '4px 0 10px 0';
      entryTitleEl.textContent = entry.title || 'Untitled Entry';
      content.appendChild(entryTitleEl);

      // Metadata line (Mood, Location, Tags)
      if (options.includeMetadata) {
        const metaContainer = document.createElement('div');
        metaContainer.style.display = 'flex';
        metaContainer.style.flexWrap = 'wrap';
        metaContainer.style.gap = '14px';
        metaContainer.style.fontSize = '12px';
        metaContainer.style.fontStyle = 'italic';
        metaContainer.style.color = theme.muted;
        metaContainer.style.marginBottom = '12px';

        if (entry.mood) {
          const moodBadge = document.createElement('span');
          moodBadge.textContent = `Mood: ${entry.mood}`;
          metaContainer.appendChild(moodBadge);
        }
        if (entry.location) {
          const locBadge = document.createElement('span');
          locBadge.textContent = `Location: ${entry.location}`;
          metaContainer.appendChild(locBadge);
        }
        if (entry.tags && entry.tags.length > 0) {
          const tagBadge = document.createElement('span');
          tagBadge.textContent = `Tags: #${entry.tags.join(' #')}`;
          metaContainer.appendChild(tagBadge);
        }
        if (metaContainer.childNodes.length > 0) {
          content.appendChild(metaContainer);
        }
      }

      // Divider line
      const line = document.createElement('div');
      line.style.height = '1px';
      line.style.backgroundColor = theme.gold;
      line.style.opacity = '0.5';
      line.style.marginBottom = '18px';
      content.appendChild(line);

      // Entry Text Blocks
      const blocks = extractTextBlocks(entry.content);
      const contentContainer = document.createElement('div');
      contentContainer.style.fontSize = options.fontSize === 'large' ? '16px' : '14.5px';
      contentContainer.style.lineHeight = '1.75';
      contentContainer.style.color = theme.text;
      contentContainer.style.display = 'flex';
      contentContainer.style.flexDirection = 'column';
      contentContainer.style.gap = '14px';

      blocks.forEach((block) => {
        if (block.type === 'quote') {
          const quoteEl = document.createElement('blockquote');
          quoteEl.style.margin = '6px 0';
          quoteEl.style.padding = '10px 16px';
          quoteEl.style.backgroundColor = theme.quoteBg;
          quoteEl.style.borderLeft = `3.5px solid ${theme.gold}`;
          quoteEl.style.fontStyle = 'italic';
          quoteEl.style.borderRadius = '0 6px 6px 0';
          quoteEl.textContent = block.text;
          contentContainer.appendChild(quoteEl);
        } else if (block.type === 'bullet') {
          const liEl = document.createElement('div');
          liEl.style.display = 'flex';
          liEl.style.gap = '8px';
          liEl.innerHTML = `<span style="color:${theme.gold}; font-weight:bold">•</span><span>${block.text}</span>`;
          contentContainer.appendChild(liEl);
        } else if (block.type === 'header') {
          const hEl = document.createElement('h3');
          hEl.style.fontSize = '18px';
          hEl.style.fontWeight = '700';
          hEl.style.color = theme.gold;
          hEl.style.margin = '8px 0 2px 0';
          hEl.textContent = block.text;
          contentContainer.appendChild(hEl);
        } else {
          const pEl = document.createElement('p');
          pEl.style.margin = '0';
          pEl.textContent = block.text;
          contentContainer.appendChild(pEl);
        }
      });

      content.appendChild(contentContainer);
      scratchpad.appendChild(page);
      pagesToRender.push(page);
    }

    // Now render each page to Canvas and generate jsPDF document
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const totalPages = pagesToRender.length;
    for (let i = 0; i < totalPages; i++) {
      const pageEl = pagesToRender[i];
      if (options.onProgress) {
        options.onProgress(i + 1, totalPages, `Rendering page ${i + 1} of ${totalPages}…`);
      }

      const canvas = await html2canvas(pageEl, {
        scale: 2, // Crisp 300 DPI equivalent
        useCORS: true,
        logging: false,
        backgroundColor: null
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.94);
      if (i > 0) {
        doc.addPage();
      }
      doc.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    const filename = `ashs-diary-export-${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
  } finally {
    // Clean up temporary DOM elements
    if (scratchpad.parentNode) {
      document.body.removeChild(scratchpad);
    }
  }
}

/**
 * Direct Vector PDF export with embedded Abhaya Libre Sinhala TrueType font
 */
async function exportViaVectorPdf(
  entries: DiaryEntry[],
  options: PdfExportOptions
): Promise<void> {
  const sortedEntries = [...entries].sort((a, b) => (a.pageOrder || 0) - (b.pageOrder || 0));

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 22;
  const contentWidth = pageWidth - margin * 2;

  // Embed Sinhala fonts into jsPDF
  const fontsLoaded = await registerSinhalaFontsInDoc(doc);
  const fontName = fontsLoaded ? 'AbhayaLibre' : 'times';

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
  }[options.paperStyle];

  let currentPageNumber = 1;

  const drawPageBackground = () => {
    doc.setFillColor(...styles.bg);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(...styles.rule);
    doc.setLineWidth(0.35);
    doc.rect(margin - 6, margin - 6, contentWidth + 12, pageHeight - (margin - 6) * 2);
    doc.setLineWidth(0.15);
    doc.rect(margin - 4.5, margin - 4.5, contentWidth + 9, pageHeight - (margin - 4.5) * 2);
  };

  const drawPageDecorations = (runningTitle: string, showPageNumber: boolean = true) => {
    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...styles.muted);
    doc.text(runningTitle.toUpperCase(), pageWidth / 2, margin - 9, { align: 'center' });

    doc.setDrawColor(...styles.rule);
    doc.setLineWidth(0.2);
    doc.line(margin, margin - 7, pageWidth - margin, margin - 7);

    if (showPageNumber) {
      doc.text(`— ${currentPageNumber} —`, pageWidth / 2, pageHeight - margin + 8, { align: 'center' });
    }
  };

  // 1. Cover
  if (options.includeTitlePage) {
    drawPageBackground();
    let y = 65;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(26);
    doc.setTextColor(...styles.gold);
    doc.text(options.diaryTitle || "Ash's Personal Diary", pageWidth / 2, y, { align: 'center' });

    y += 10;
    doc.setDrawColor(...styles.gold);
    doc.setLineWidth(0.4);
    doc.line(pageWidth / 2 - 30, y, pageWidth / 2 + 30, y);

    y += 14;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(13);
    doc.setTextColor(...styles.muted);
    doc.text('Selected Memoirs & Inscribed Thoughts', pageWidth / 2, y, { align: 'center' });

    y += 60;
    doc.setFontSize(11);
    doc.setTextColor(...styles.text);
    doc.text('Written and Inscribed by', pageWidth / 2, y, { align: 'center' });

    y += 7;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(15);
    doc.text(options.authorName || 'Ash', pageWidth / 2, y, { align: 'center' });

    y += 35;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...styles.muted);
    doc.text(`Printed Collection of ${sortedEntries.length} Inscribed Entries`, pageWidth / 2, y, { align: 'center' });

    doc.addPage();
    currentPageNumber++;
  }

  // 2. Entries
  sortedEntries.forEach((entry, entryIdx) => {
    drawPageBackground();
    drawPageDecorations(options.diaryTitle || 'Diary Entry', true);

    let y = margin + 8;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...styles.gold);
    doc.text(`ENTRY ${String(entryIdx + 1).padStart(2, '0')}`, margin, y);

    if (entry.date) {
      const formattedDate = new Date(entry.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.setFont(fontName, 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...styles.muted);
      doc.text(formattedDate, pageWidth - margin, y, { align: 'right' });
    }

    y += 8;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...styles.text);
    const titleLines = doc.splitTextToSize(entry.title || 'Untitled Entry', contentWidth);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 7;

    if (options.includeMetadata) {
      const metaParts: string[] = [];
      if (entry.mood) metaParts.push(`Mood: ${entry.mood}`);
      if (entry.location) metaParts.push(`Location: ${entry.location}`);
      if (entry.tags && entry.tags.length > 0) metaParts.push(`Tags: #${entry.tags.join(' #')}`);

      if (metaParts.length > 0) {
        doc.setFont(fontName, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...styles.muted);
        doc.text(metaParts.join('   •   '), margin, y);
        y += 6;
      }
    }

    doc.setDrawColor(...styles.rule);
    doc.setLineWidth(0.35);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const baseFontSize = options.fontSize === 'large' ? 12 : 10.5;
    const lineHeight = options.fontSize === 'large' ? 6.2 : 5.4;
    const blocks = extractTextBlocks(entry.content);

    blocks.forEach((block) => {
      if (y > pageHeight - margin - 22) {
        doc.addPage();
        currentPageNumber++;
        drawPageBackground();
        drawPageDecorations(`${entry.title} (Continued)`, true);
        y = margin + 12;
      }

      if (block.type === 'quote') {
        doc.setFont(fontName, 'normal');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(...styles.text);

        const quoteWidth = contentWidth - 14;
        const quoteLines = doc.splitTextToSize(block.text, quoteWidth);
        const blockHeight = quoteLines.length * lineHeight + 4;

        doc.setFillColor(...styles.quoteBg);
        doc.rect(margin, y - 2, contentWidth, blockHeight, 'F');
        doc.setFillColor(...styles.gold);
        doc.rect(margin, y - 2, 1.5, blockHeight, 'F');

        doc.text(quoteLines, margin + 7, y + 3);
        y += blockHeight + 5;
      } else if (block.type === 'bullet') {
        doc.setFont(fontName, 'normal');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(...styles.text);

        const bulletLines = doc.splitTextToSize(block.text, contentWidth - 8);
        doc.text('•', margin + 2, y);
        doc.text(bulletLines, margin + 7, y);
        y += bulletLines.length * lineHeight + 2;
      } else {
        doc.setFont(fontName, 'normal');
        doc.setFontSize(baseFontSize);
        doc.setTextColor(...styles.text);

        const lines = doc.splitTextToSize(block.text, contentWidth);
        doc.text(lines, margin, y);
        y += lines.length * lineHeight + 4;
      }
    });

    if (entryIdx < sortedEntries.length - 1) {
      doc.addPage();
      currentPageNumber++;
    }
  });

  const filename = `ashs-diary-export-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/**
 * Generates an HTML printable window / triggers print dialog with book styling
 * including full native support for Sinhala and complex script typography.
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
    <html lang="si">
      <head>
        <meta charset="utf-8" />
        <title>${title} — Printable PDF</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Abhaya+Libre:wght@400;500;600;700;800&family=Cinzel:wght@500;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Noto+Serif+Sinhala:wght@400;600;700&family=Noto+Sans+Sinhala:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 portrait;
            margin: 18mm 18mm 20mm 18mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Abhaya Libre', 'Noto Serif Sinhala', 'Cormorant Garamond', 'Iskoola Pota', Georgia, serif;
            color: #1a1612;
            background: #fff;
            margin: 0;
            padding: 0;
            line-height: 1.7;
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
            font-family: 'Abhaya Libre', 'Noto Serif Sinhala', 'Cinzel', serif;
            font-size: 34px;
            font-weight: 700;
            color: #8c6e28;
            margin-bottom: 12px;
          }
          .cover-sub {
            font-size: 18px;
            font-style: italic;
            color: #665b4c;
            margin-bottom: 50px;
          }
          .cover-author {
            font-size: 17px;
            color: #2b241d;
            margin-top: 40px;
            font-weight: 600;
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
            font-family: 'Abhaya Libre', 'Noto Serif Sinhala', 'Cormorant Garamond', serif;
            font-size: 26px;
            font-weight: 700;
            color: #1a1612;
            margin: 4px 0 10px 0;
            line-height: 1.35;
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
            line-height: 1.8;
            color: #24201b;
            flex: 1;
          }
          .entry-content p {
            margin-bottom: 14px;
          }
          .entry-content blockquote {
            border-left: 3.5px solid #d4af37;
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
      if (printIframe.parentNode) {
        document.body.removeChild(printIframe);
      }
    }, 2000);
  }, 600);
}
