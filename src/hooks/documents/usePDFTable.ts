import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CellHookData, UserOptions } from "jspdf-autotable";
import { renderToStaticMarkup } from "react-dom/server";
import Logo from "../../../public/RTC_Aurora_Logo.png"

type AutoTableStyles = NonNullable<UserOptions["styles"]>;

export interface PDFColumn<T = any> {
  header: string;
  dataKey: keyof T | string;
  render?: (value: any, record: T, index: number) => string;
}

type UsePDFOptions<T = any> = {
  columns: PDFColumn<T>[];
  data: T[];
  orientation?: "portrait" | "landscape";
  titleNode?: React.ReactNode;
  onBeforeDownload?: () => Promise<void> | void;
  fileName?: string;
  getRowStyle?: (record: T, index: number) => AutoTableStyles | undefined;
  headerMode?: "allPages" | "firstPageOnly";
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
};

export function usePDFTable<T = any>({
  columns,
  data,
  orientation = "portrait",
  titleNode,
  onBeforeDownload,
  fileName = "Document",
  getRowStyle,
  headerMode = "allPages"
}: UsePDFOptions<T>) {

  const handleDownloadPDF = async () => {
    if (onBeforeDownload) {
      await onBeforeDownload();
    }

    let parsedTitle = fileName;
    const hasTitle = Boolean(titleNode);

    if (titleNode) {
      const staticHtmlString = renderToStaticMarkup(titleNode as any);
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = staticHtmlString;
      parsedTitle = tempDiv.textContent || tempDiv.innerText || fileName;
    }

    let logoImageElement: HTMLImageElement | null = null;
    try {
      logoImageElement = await loadImage(Logo);
    } catch (error) {
      console.error("Failed to pre-load RTC Aurora Logo Image asset:", error);
    }

    // --- DYNAMIC SPACING CALCULATIONS ---
    // If a title node exists, we shift the table down slightly to avoid overlaps.
    const dynamicStartY = hasTitle ? 2.15 : 1.85;
    
    // Page break margins tracking header behavior overrides
    let dynamicMarginTop = 0.5; // Default safe margin for pages without a header stack
    if (headerMode === "allPages") {
      dynamicMarginTop = hasTitle ? 2.05 : 1.75;
    }
    // ------------------------------------

    const doc = new jsPDF({ orientation, unit: "in", format: "a4" });
    const tableHeaders = columns.map(col => col.header);
    const tableRows = data.map((item, rIdx) =>
      columns.map(col => col.render ? col.render(item[col.dataKey as keyof T], item, rIdx) : String(item[col.dataKey as keyof T] ?? ""))
    );

    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: dynamicStartY, // Dynamically computed ceiling 
      margin: {
        top: dynamicMarginTop, // Dynamically computed page wrapping margin
        bottom: 1.0,
        left: 0.5,
        right: 0.5
      },
      theme: "grid",
      headStyles: { fillColor: [4, 73, 137], textColor: [255, 255, 255] },

      didParseCell: (cellData: CellHookData) => {
        if (cellData.section === "body" && getRowStyle) {
          const rowIndex = cellData.row.index;
          const record = data[rowIndex];

          const customStyles = getRowStyle(record, rowIndex);
          if (customStyles) {
            cellData.cell.styles = {
              ...cellData.cell.styles,
              ...customStyles
            };
          }
        }
      },

      didDrawPage: (dataBlock) => {
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height || pageSize.getHeight();
        const pageWidth = pageSize.width || pageSize.getWidth();
        const centerX = pageWidth / 2;
        const isFirstPage = dataBlock.pageNumber === 1;

        if (headerMode === "allPages" || isFirstPage) {

          // DRAW IMAGE LOGO CENTERED
          if (logoImageElement) {
            const imgWidth = 0.65;
            const imgHeight = 0.65;
            const imgX = centerX - (imgWidth / 2);
            const imgY = 0.3;

            doc.addImage(logoImageElement, "PNG", imgX, imgY, imgWidth, imgHeight);
          }

          // STATIONERY TEXT STACK
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(60, 60, 60);
          doc.text("Philippine Coast Guard", centerX, 1.15, { align: "center" });
          doc.text("Coast Guard Education, Training and Doctrine Command", centerX, 1.28, { align: "center" });

          doc.setFont("Helvetica", "bold");
          doc.setFontSize(10.5);
          doc.setTextColor(15, 23, 42);
          doc.text("REGIONAL TRAINING CENTER AURORA", centerX, 1.45, { align: "center" });

          doc.setFont("Helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text("Brgy. Mijares, Dipaculao, Aurora", centerX, 1.58, { align: "center" });

          // Render the subtitle text just above our calculated dynamic boundaries
          if (titleNode) {
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(30, 30, 30);
            doc.text(parsedTitle.toUpperCase(), centerX, 1.95, { align: "center" });
          }
        }

        // FOOTER RUNTIMES
        doc.setLineWidth(0.01);
        doc.setDrawColor(220, 220, 220);
        doc.line(0.5, pageHeight - 0.7, pageWidth - 0.5, pageHeight - 0.7);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(`System Data Pull Date: ${new Date().toLocaleString()}`, 0.5, pageHeight - 0.4);
        doc.text(`Page ${dataBlock.pageNumber}`, pageWidth - 0.5, pageHeight - 0.4, { align: "right" });
      }
    });

    const cleanFileName = parsedTitle.trim().replace(/[^a-zA-Z0-9]/g, "_");
    doc.save(`${cleanFileName}.pdf`);
  };

  return { handleDownloadPDF };
}