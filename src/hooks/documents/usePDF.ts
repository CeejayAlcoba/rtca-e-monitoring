
import html2pdf from "html2pdf.js";

type UsePDFOptions = {
  ref: React.RefObject<HTMLDivElement | null>;
  delay?: number;
  onBeforeDownload?: () => Promise<void> | void;
  orientation?: "portrait" | "landscape" | undefined
};

export function usePDF({ ref, delay = 500, onBeforeDownload,orientation = "portrait" }: UsePDFOptions) {

  const handleDownloadPDF = async (title?: string) => {
    const element = ref?.current;
    if (!element) return;

    if (onBeforeDownload) {
      await onBeforeDownload();
    }

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    html2pdf()
      .from(element)
      .set({
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `${title || "document"}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: "in", format: "a4", orientation },
      })
      .save();
  };

  return { handleDownloadPDF };
}