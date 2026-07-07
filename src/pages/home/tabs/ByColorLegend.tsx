import React, { useMemo, useRef } from "react";
import { Table, Tag, Typography, Card, Button, Badge } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import {
  FileExcelOutlined,
  FilePdfOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import dashboardService from "../../../services/dashboardService";
import nameFormat from "../../../utils/nameFormat";

// Third-Party Data Export Tools
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { usePrint } from "../../../hooks/documents/usePrint";
import { useResponsiveLayout } from "../../../hooks/useResponsiveLayout"; // Imported your hook

const { Text } = Typography;

const getRandomColor = (index?: number) => {
  const colors = [
    "#E11D48",
    "#008080",
    "#6D28D9",
    "#D97706",
    "#4D7C0F",
    "#1E6091",
    "#C2410C",
    "#0891B2",
    "#059669",
    "#B45309",
    "#BE185D",
    "#2563EB",
    "#4338CA",
    "#C026D3",
    "#15803D",
    "#0284C7",
    "#7C3AED",
    "#DB2777",
  ];
  if (index || index === 0) return colors[index % colors.length];
  return colors[Math.floor(Math.random() * colors.length)];
};

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const hexToRgbArray = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return [r, g, b];
};

interface FlattenedPersonnel {
  key?: number | null;
  serialNumber?: string | null;
  fullName?: string | null;
  email?: string | null;
  rankName?: string | null;
  rankCode?: string | null;
  rankLevel?: number | null;
  groupType?: "Officer" | "Non-Officer" | null;
  currentActivity?: string | null;
}

export const ByColorLegend: React.FC = () => {
  const { isMobile } = useResponsiveLayout(); // Detect viewport scales dynamically

  const { data: personnelActivityData = [], isLoading } = useQuery({
    queryKey: ["personnelActivityData"],
    queryFn: async () => await dashboardService.getPersonnelByActivityType(),
    initialData: [],
    refetchInterval: 30000,
  });

  const ref = useRef<HTMLDivElement | null>(null);
  const { handlePrint } = usePrint({ ref, orientation: "portrait" });

  const activityMetrics = useMemo(() => {
    const metrics: Record<string, { color: string; count: number }> = {};
    personnelActivityData?.forEach((group, index) => {
      if (group?.activity) {
        const normalizedKey = group.activity.toUpperCase();
        const personnelCount = group?.info?.length || 0;

        if (metrics[normalizedKey]) {
          metrics[normalizedKey].count += personnelCount;
        } else {
          let assignedColor = getRandomColor(index);
          if (normalizedKey === "RESTRICTED") {
            assignedColor = "#E11D48";
          }
          metrics[normalizedKey] = {
            color: assignedColor,
            count: personnelCount,
          };
        }
      }
    });
    return metrics;
  }, [personnelActivityData]);

  const processedGroups = useMemo(() => {
    const officers: FlattenedPersonnel[] = [];
    const nonOfficers: FlattenedPersonnel[] = [];

    personnelActivityData?.forEach((group) => {
      group?.info?.forEach((item) => {
        const p = item?.name;
        if (!p) return;

        const fullName = nameFormat(p);
        let groupType: "Officer" | "Non-Officer" =
          p?.rank?.rankCategoryId === 1 ? "Officer" : "Non-Officer";

        const priorityActivity = p?.personnelActivities?.find(
          (a) => a.isFullyApproved && a?.personnel?.rank?.rankCategory?.name,
        );

        if (priorityActivity?.personnel?.rank?.rankCategory?.name) {
          const typeCheck = priorityActivity.personnel.rank.rankCategory.name;
          if (typeCheck === "Officer" || typeCheck === "Non-Officer") {
            groupType = typeCheck;
          }
        }

        const data: FlattenedPersonnel = {
          key: p.personnelId,
          serialNumber: p.serialNumber,
          fullName: fullName,
          email: p.email,
          rankName: p?.rank?.rankName,
          rankCode: p?.rank?.rankCode,
          rankLevel: p?.rank?.rankLevel,
          groupType: groupType,
          currentActivity: group.activity,
        };

        if (groupType === "Officer") {
          officers.push(data);
        } else {
          nonOfficers.push(data);
        }
      });
    });

    const sortByRankThenSerialNumber = (
      a: FlattenedPersonnel,
      b: FlattenedPersonnel,
    ) => {
      const levelA = a?.rankLevel ?? 0;
      const levelB = b?.rankLevel ?? 0;
      if (levelA !== levelB) return levelA - levelB;

      const cleanA = (a?.serialNumber ?? "").replace(/\D/g, "");
      const cleanB = (b?.serialNumber ?? "").replace(/\D/g, "");
      const numA = parseInt(cleanA, 10) || 0;
      const numB = parseInt(cleanB, 10) || 0;
      return numA - numB;
    };

    return {
      Officers: officers.sort(sortByRankThenSerialNumber),
      NonOfficers: nonOfficers.sort(sortByRankThenSerialNumber),
    };
  }, [personnelActivityData]);

  // Export handlers remain exactly as they were...
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();
    const mapToExcelData = (list: FlattenedPersonnel[]) =>
      list.map((p, index) => ({
        "Nr.": index + 1,
        "Full Name": p.fullName ?? "N/A",
        "Rank Level": p.rankLevel ?? 0,
        "Serial Number": p.serialNumber ?? "N/A",
        "Rank Designation": p.rankName
          ? `${p.rankName} (${p.rankCode})`
          : "N/A",
        "Email Address": p.email ?? "N/A",
        "Current Status Activity": p.currentActivity?.toUpperCase() ?? "N/A",
      }));

    if (processedGroups.Officers.length > 0) {
      const officerSheet = XLSX.utils.json_to_sheet(
        mapToExcelData(processedGroups.Officers),
      );
      XLSX.utils.book_append_sheet(workbook, officerSheet, "Officers Division");
    }
    if (processedGroups.NonOfficers.length > 0) {
      const nonOfficerSheet = XLSX.utils.json_to_sheet(
        mapToExcelData(processedGroups.NonOfficers),
      );
      XLSX.utils.book_append_sheet(
        workbook,
        nonOfficerSheet,
        "Non-Officers Division",
      );
    }

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const fileBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });
    saveAs(
      fileBlob,
      `Personnel_Ledger_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handleExportPdf = () => {
    const doc = new jsPDF("p", "pt", "a4");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("PERSONNEL ACTIVITY SUMMARY REPORT", 40, 45);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 65);

    const pdfColumns = ["Nr.", "Full Name", "Status Activity"];
    const mapToPdfRows = (list: FlattenedPersonnel[]) =>
      list.map((p, index) => [
        index + 1,
        p.fullName ?? "N/A",
        (p.currentActivity ?? "N/A").toUpperCase(),
      ]);

    let finalY = 80;

    if (processedGroups.Officers.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(
        `1. Officers Table (${processedGroups.Officers.length} Records)`,
        40,
        finalY,
      );

      autoTable(doc, {
        startY: finalY + 10,
        head: [pdfColumns],
        body: mapToPdfRows(processedGroups.Officers),
        styles: { font: "helvetica", fontSize: 9 },
        headStyles: { fillColor: [30, 96, 145], textColor: [255, 255, 255] },
        theme: "grid",
        didParseCell: (data) => {
          if (data.section === "body") {
            const rowIndex = data.row.index;
            const item = processedGroups.Officers[rowIndex];
            if (item?.currentActivity) {
              const actKey = item.currentActivity.toUpperCase();
              if (actKey !== "ON DUTY" && activityMetrics[actKey]) {
                const hexColor = activityMetrics[actKey].color;
                const rgb = hexToRgbArray(hexColor);
                data.cell.styles.fillColor = [
                  Math.round(rgb[0] + (255 - rgb[0]) * 0.55),
                  Math.round(rgb[1] + (255 - rgb[1]) * 0.55),
                  Math.round(rgb[2] + (255 - rgb[2]) * 0.55),
                ];
                data.cell.styles.textColor = [0, 0, 0];
              }
            }
          }
        },
      });
      finalY = (doc as any).lastAutoTable.finalY + 30;
    }

    if (processedGroups.NonOfficers.length > 0) {
      if (finalY > 750) {
        doc.addPage();
        finalY = 50;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(
        `2. Non-Officers Table (${processedGroups.NonOfficers.length} Records)`,
        40,
        finalY,
      );

      autoTable(doc, {
        startY: finalY + 10,
        head: [pdfColumns],
        body: mapToPdfRows(processedGroups.NonOfficers),
        styles: { font: "helvetica", fontSize: 9 },
        headStyles: { fillColor: [0, 128, 128], textColor: [255, 255, 255] },
        theme: "grid",
        didParseCell: (data) => {
          if (data.section === "body") {
            const rowIndex = data.row.index;
            const item = processedGroups.NonOfficers[rowIndex];
            if (item?.currentActivity) {
              const actKey = item.currentActivity.toUpperCase();
              if (actKey !== "ON DUTY" && activityMetrics[actKey]) {
                const hexColor = activityMetrics[actKey].color;
                const rgb = hexToRgbArray(hexColor);
                data.cell.styles.fillColor = [
                  Math.round(rgb[0] + (255 - rgb[0]) * 0.55),
                  Math.round(rgb[1] + (255 - rgb[1]) * 0.55),
                  Math.round(rgb[2] + (255 - rgb[2]) * 0.55),
                ];
                data.cell.styles.textColor = [0, 0, 0];
              }
            }
          }
        },
      });
    }
    doc.save(
      `Personnel_Ledger_Matrix_${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  const columns: ColumnsType<FlattenedPersonnel> = [
    {
      title: "#",
      key: "NR",
      width: 50,
      render: (_, __, index) => (
        <span style={{ color: "#000000", fontWeight: 600 }}>{index + 1}</span>
      ),
    },
    {
      title: "Full Name",
      dataIndex: "fullName",
      key: "fullName",
      render: (text, record) => (
        <span style={{ color: "#000000", fontWeight: 600 }}>
          {text}
          <span
            className="print-only-activity-text"
            style={{
              display: "none",
              marginLeft: "8px",
              fontWeight: "normal",
              color: "#000000",
            }}
          >
            {` [${(record.currentActivity ?? "").toUpperCase()}]`}
          </span>
        </span>
      ),
    },
    {
      title: "Status Activity",
      dataIndex: "currentActivity",
      key: "currentActivity",
      className: "hide-column-on-print",
      width: isMobile ? 130 : undefined, // Explicit bounds on tiny screens
      render: (activity: string) => {
        if (!activity) return null;
        const baseColor =
          activityMetrics[activity.toUpperCase()]?.color || "#cbd5e1";
        return (
          <Tag
            color={baseColor}
            style={{
              fontWeight: "900",
              color: "#000000",
              border: "1px solid rgba(0,0,0,0.35)",
              marginRight: 0,
            }}
          >
            {activity.toUpperCase()}
          </Tag>
        );
      },
    },
  ];

  const getRowClassName = (record: FlattenedPersonnel) => {
    if (!record?.currentActivity) return "";
    return `row-activity-${record.currentActivity.replace(/\s+/g, "-").toLowerCase()}`;
  };

  const dynamicStyles = useMemo(() => {
    let stylesString = "";
    Object.entries(activityMetrics).forEach(([activity, data]) => {
      const className = activity.replace(/\s+/g, "-").toLowerCase();
      if (className === "on-duty") return;

      const bgNormal = hexToRgba(data.color, 0.45);
      const bgHover = hexToRgba(data.color, 0.65);

      stylesString += `
        .row-activity-${className} td { background-color: ${bgNormal} !important; }
        .row-activity-${className}:hover td { background-color: ${bgHover} !important; }
      `;
    });
    return <style>{stylesString}</style>;
  }, [activityMetrics]);

  return (
    <div
      style={{
        padding: isMobile ? "12px" : "24px",
        background: "#cbd5e1",
        minHeight: "100vh",
      }}
    >
      {dynamicStyles}

      <Card
        className="no-print-zone"
        size="small"
        style={{ marginBottom: "20px" }}
      >
        {/* Tailwind structural changes for responsive grid/flex layout shifts */}
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
          {/* Badge Legend Container */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(activityMetrics).map(([activity, data]) => (
              <div
                key={activity}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "4px 8px",
                  background: "#ffffff",
                  borderRadius: "4px",
                  border: "1px solid #cbd5e1",
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: data.color,
                    borderRadius: "3px",
                    border: "1px solid rgba(0,0,0,0.2)",
                  }}
                />
                <Text strong style={{ fontSize: "12px", color: "#000000" }}>
                  {activity}
                </Text>
                <Badge
                  count={data.count}
                  style={{
                    backgroundColor: "#f1f5f9",
                    color: "#334155",
                    fontSize: "11px",
                    fontWeight: 700,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Action Buttons Container */}
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              className="flex-1 lg:flex-none"
              style={{
                backgroundColor: "#1c5bb9",
                borderColor: "#1c5bb9",
                fontWeight: 600,
              }}
            >
              Print
            </Button>
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              className="flex-1 lg:flex-none"
              style={{
                backgroundColor: "#15803D",
                borderColor: "#15803D",
                fontWeight: 600,
              }}
            >
              Excel
            </Button>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              onClick={handleExportPdf}
              className="flex-1 lg:flex-none"
              style={{
                backgroundColor: "#B91C1C",
                borderColor: "#B91C1C",
                fontWeight: 600,
              }}
            >
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Table Document Canvas Wrapper */}
      <div ref={ref} className="flex flex-col gap-6">
        {/* Officers Table */}
        <Table
          title={() => (
            <span
              style={{ fontWeight: 800, fontSize: "15px", color: "#000000" }}
            >
              Officers ({processedGroups.Officers.length})
            </span>
          )}
          columns={columns}
          dataSource={processedGroups.Officers}
          pagination={false}
          rowClassName={getRowClassName}
          loading={isLoading}
          scroll={{ x: isMobile ? 400 : undefined }} // Enables elastic side-scroll on small views
          size={"small"}
          bordered
        />

        {/* Non-Officers Table */}
        <Table
          title={() => (
            <span
              style={{ fontWeight: 800, fontSize: "15px", color: "#000000" }}
            >
              Non-Officers ({processedGroups.NonOfficers.length})
            </span>
          )}
          columns={columns}
          dataSource={processedGroups.NonOfficers}
          pagination={false}
          rowClassName={getRowClassName}
          loading={isLoading}
          scroll={{ x: isMobile ? 400 : undefined }} // Enables elastic side-scroll on small views
          size="small"
          bordered
        />
      </div>
    </div>
  );
};

export default ByColorLegend;
