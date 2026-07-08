import { Button, Spin, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { convertUtcToPhDateShort } from "../../../utils/convertUtcToPhDateShort";
import nameFormat from "../../../utils/nameFormat";
import { useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import dashboardService from "../../../services/dashboardService";

// Excel
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";


import { type NameDTO } from "../../../@types/dashboardGraphs/ActivityData";
import { formatDateToMilitary } from "../../../utils/formatDateToMilitary";
import getRandomColor from "../../../utils/getRandomColor";
import { usePDFTable, type PDFColumn } from "../../../hooks/documents/usePDFTable";

// Define the interface shape for the flattened list configuration 
interface FlattenedPersonnel extends NameDTO {
  parentActivity: string;
}

function ActivityStatus() {
  const printRef = useRef<HTMLDivElement>(null);

  const { data: personnelActivityData, isLoading } = useQuery({
    queryKey: ["personnelActivityData"],
    queryFn: async () => await dashboardService.getPersonnelByActivityType(),
    initialData: [],
    refetchInterval: 30000,
  });

  // ---------------- FLAT DATA PREPARATION FOR LEDGER REPORT ----------------
  const combinedPdfData = useMemo<FlattenedPersonnel[]>(() => {
    if (!personnelActivityData) return [];
    const elements: FlattenedPersonnel[] = [];

    personnelActivityData.forEach((actBlock) => {
      actBlock.info.forEach((person) => {
        elements.push({
          ...person,
          parentActivity: actBlock.activity,
        });
      });
    });
    return elements;
  }, [personnelActivityData]);

  // ---------------- THE usePDFTable CONFIGURATION ----------------
  const pdfColumns: PDFColumn<FlattenedPersonnel>[] = [
    {
      header: "Nr",
      dataKey: "nr",
      render: (_, __, idx) => String(idx + 1),
    },
    {
      header: "Status",
      dataKey: "parentActivity",
      render: (val) => String(val).toUpperCase(),
    },
    {
      header: "Rank",
      dataKey: "rank",
      render: (_, record) => record.name?.rank?.rankCode ?? "",
    },
    {
      header: "Name",
      dataKey: "fullName",
      render: (_, record) => nameFormat(record.name),
    },
    {
      header: "Serial",
      dataKey: "serialNumber",
      render: (_, record) => record.name?.serialNumber ?? "",
    },
    {
      header: "Title / Duration",
      dataKey: "title",
      render: (_, record) => {
        if (record.parentActivity.toLowerCase() === "on duty") return "";
        if (!record.startDate || !record.endDate) return record.title ?? "";
        return `${record.title} (${convertUtcToPhDateShort(record.startDate)} - ${convertUtcToPhDateShort(record.endDate)})`;
      },
    },
  ];

  const { handleDownloadPDF } = usePDFTable<FlattenedPersonnel>({
    columns: pdfColumns,
    data: combinedPdfData,
    orientation: "portrait",
    fileName: "Personnel_Activity_Summary_Report",
    headerMode: "firstPageOnly",
    titleNode: <div>
      Activity Report ({formatDateToMilitary(new Date())})
    </div>,
    getRowStyle: (record) => {
      return {
        lineWidth: 0.013,
        lineColor: [0, 0, 0],
        fontStyle: record.name?.rank?.rankLevel && record.name.rank.rankLevel <= 5 ? "bold" : "normal",
      };
    },
  });

  // ---------------- ANTD INLINE TABLE COLUMNS ----------------
  const columns = (activity: string): ColumnsType<NameDTO> => [
    {
      title: "Nr",
      key: "nr",
      align: "center",
      width: 5,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "Name",
      render: (record: NameDTO) => nameFormat(record.name),
      align: "center",
    },
    {
      title: "Title / Duration",
      align: "center",
      render: (record) => {
        if (activity.toLowerCase() === "on duty") return "";
        if (!record.startDate || !record.endDate) return record.title;

        return (
          <div className="grid grid-cols-1">
            <strong>{record.title}</strong>
            <div>
              {convertUtcToPhDateShort(record.startDate)} - {convertUtcToPhDateShort(record.endDate)}
            </div>
          </div>
        );
      },
    },
  ];

  const getColumns = (activity: string) => {
    if (activity === "On duty")
      return columns(activity).filter((c) => c.title !== "Title / Duration");
    return columns(activity);
  };

  // ---------------- EXCEL EXPORT ----------------
  const handleExportExcel = () => {
    const excelData: any[] = [];

    personnelActivityData.forEach((activity) => {
      activity.info.forEach((info) => {
        excelData.push({
          Activity: activity.activity,
          Personnel: nameFormat(info.name),
          Title: info.title ?? "",
          SerialNumber: info.name.serialNumber,
          StartDate: info.startDate ? convertUtcToPhDateShort(info.startDate) : "",
          EndDate: info.endDate ? convertUtcToPhDateShort(info.endDate) : "",
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Data");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "ActivityData.xlsx");
  };

  // ---------------- PRINT ----------------
  const handlePrint = () => {
    if (!printRef.current) return;
    const printContents = printRef.current.innerHTML;
    const printWindow = window.open("", "", "width=900,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
      <head>
      <title>Personnel by Activity Report ${new Date()}</title>
      <style>
      body { font-family: Arial; padding:20px }
      h1,h4 { text-align:center; color:#5B8FF9 }
      table { border-collapse:collapse; width:100% }
      th,td { border:1px solid black; padding:6px }
      </style>
      </head>
      <body>
      <h1>Activity Report (${formatDateToMilitary(new Date())})</h1>
      ${printContents}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button style={{ marginRight: 8 }} onClick={handlePrint}>
          Print
        </Button>

        <Button
          type="primary"
          style={{ marginRight: 8 }}
          onClick={handleExportExcel}
        >
          Export Excel
        </Button>

        <Button type="primary" onClick={handleDownloadPDF}>
          Export PDF
        </Button>
      </div>

      <Spin spinning={isLoading}>
        <div ref={printRef}>
          <div className="grid md:grid-cols-1 text-center sm:grid-cols-1 gap-4">
            {personnelActivityData.map((activity, index) => {
              return (
                <Table
                  scroll={{ x: 400 }}
                  size="small"
                  key={activity.activity}
                  rowKey={(record) => record.name.personnelId ?? 0}
                  columns={getColumns(activity.activity)}
                  dataSource={[...activity.info].sort(
                    (a, b) =>
                      (a.name?.rank?.rankLevel ?? 0) - (b.name?.rank?.rankLevel ?? 0)
                  )}
                  pagination={false}
                  bordered
                  showHeader={false}
                  title={() => (
                    <div
                      style={{
                        background: getRandomColor(index),
                        padding: "8px",
                        fontWeight: "bold",
                        textAlign: "center",
                        borderRadius: "6px",
                      }}
                    >
                      {activity.activity} ({activity.personnel})
                    </div>
                  )}
                />
              );
            })}
          </div>
        </div>
      </Spin>
    </>
  );
}

export default ActivityStatus;