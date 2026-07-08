import { useState } from "react";
import { Table, Space, Button, Tooltip } from "antd";
import {
  FileExcelOutlined,
  FilePdfOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { PersonnelActivity } from "../../@types/PersonnelActivity";
import { formatDateToMilitary } from "../../utils/formatDateToMilitary";
import StatusTag from "../../componets/statusTag";
import { useQuery } from "@tanstack/react-query";
import personnelActivityService from "../../services/personnelActivityService";
import YearSelect from "../../componets/YearSelect";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Personnel } from "../../@types/Personnel";
import nameFormat from "../../utils/nameFormat";
import { ApprovalStageDisplay } from "../../componets/ApprovalStageDisplay";

type PersonnelActivitiesTableProps = {
  selectedPersonnel?: Personnel | null;
  year?: number | null;
};

export default function PersonnelActivitiesTable({
  selectedPersonnel,
  year,
}: PersonnelActivitiesTableProps) {
  const [selectedYear, setSelectedYear] = useState<number | null | undefined>(
    year || new Date().getFullYear(),
  );

  const { data: personnelActivities, isFetching } = useQuery({
    queryKey: [
      "activities",
      selectedPersonnel?.personnelId,
      year,
      selectedYear,
    ],
    queryFn: async () =>
      await personnelActivityService.getByPersonnelId(
        selectedPersonnel?.personnelId,
        year ?? selectedYear,
      ),
    enabled: true,
    initialData: [],
  });
  const getFileName = (extension: string) => {
    const name = nameFormat(selectedPersonnel) || "Personnel";
    const yearLabel = year ?? selectedYear;
    const safeName = name.replace(/[^a-z0-9]/gi, "_");
    return `${safeName}_Leave_History_${yearLabel}.${extension}`;
  };
  // --- Export Functions ---

  const exportToExcel = () => {
    const data = personnelActivities.map((a) => ({
      Type: a.activityType?.activityTypeName,
      Title: a.title,
      Start: a.startDate ? formatDateToMilitary(a.startDate) : "-",
      End: a.endDate ? formatDateToMilitary(a.endDate) : "-",
      Result: a.result,
      Status: a.status,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leave History");
    XLSX.writeFile(workbook, getFileName("xlsx"));
  };

  const exportToPDF = (isPrint = false) => {
    const doc = new jsPDF();
    doc.text("Personnel Leave History", 14, 15);

    const tableColumn = ["Type", "Title", "Start", "End", "Result", "Status"];
    const tableRows = personnelActivities.map((a) => [
      a.activityType?.activityTypeName || "-",
      a.title || "-",
      a.startDate ? formatDateToMilitary(a.startDate) : "-",
      a.endDate ? formatDateToMilitary(a.endDate) : "-",
      a.result || "-",
      a.status || "-",
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });

    if (isPrint) {
      doc.autoPrint();
      window.open(doc.output("bloburl"), "_blank");
    } else {
      doc.save(getFileName("pdf"));
    }
  };

  const activityColumns: ColumnsType<PersonnelActivity> = [
    {
      title: "Type",
      dataIndex: ["activityType", "activityTypeName"],
      key: "type",
    },
    { title: "Title", dataIndex: "title", key: "title" },
    {
      title: "Start",
      dataIndex: "startDate",
      key: "startDate",
      render: (d) => (d ? formatDateToMilitary(d) : "-"),
    },
    {
      title: "End",
      dataIndex: "endDate",
      key: "endDate",
      render: (d) => (d ? formatDateToMilitary(d) : "-"),
    },
    { title: "Day/s", dataIndex: "days", key: "days" },
    { title: "Remarks", dataIndex: "remarks", key: "remarks", ellipsis: true },

    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status, record) => {
        if (!record.isFullyApproved)
          return (
            <>
              <StatusTag status={status} />

              <ApprovalStageDisplay
                status={status}
                currentStage={record.approvalProccess?.currentStage}
                isOfficer={
                  record.personnel?.rank?.rankCategory?.name === "Officer"
                }
              />
            </>
          );
        return <StatusTag status={status} />;
      },
    },
  ];

  return (
    <Table
      loading={isFetching}
      scroll={{ x: 1000 }}
      title={() => (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <strong className="text-lg font-semibold">Leave History</strong>
            <Space>
              <Tooltip title="Download Excel">
                <Button icon={<FileExcelOutlined />} onClick={exportToExcel}>
                  Excel
                </Button>
              </Tooltip>
              <Tooltip title="Download PDF">
                <Button
                  icon={<FilePdfOutlined />}
                  onClick={() => exportToPDF(false)}
                >
                  PDF
                </Button>
              </Tooltip>
              <Tooltip title="Print">
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => exportToPDF(true)}
                >
                  Print
                </Button>
              </Tooltip>
            </Space>
          </div>
          {!year && (
            <Space>
              <span className="font-medium">Filter Year:</span>
              <YearSelect
                value={selectedYear}
                onChange={(val) => setSelectedYear(val)}
              />
            </Space>
          )}
        </div>
      )}
      size="small"
      rowKey="personnelActivityId"
      columns={activityColumns}
      dataSource={personnelActivities || []}
    />
  );
}
