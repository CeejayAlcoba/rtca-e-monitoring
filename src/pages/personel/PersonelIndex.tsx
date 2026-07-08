import React, { useRef, useState } from "react";
import {
  Table,
  Button,
  Space,
  Popconfirm,
  Form,
  Tooltip,
  Image,
  Dropdown,
  type MenuProps,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Personnel } from "../../@types/Personnel";
import { useQuery } from "@tanstack/react-query";
import personelService from "../../services/personelService";
import PersonelSaveModal from "./PersonelSaveModal";
import dayjs, { Dayjs } from "dayjs";
import { formatDateToMilitary } from "../../utils/formatDateToMilitary";
import DebounceInput from "../../componets/DebounceInput";

import {
  EditOutlined,
  DeleteOutlined,
  HistoryOutlined,
  UserOutlined,
  UserAddOutlined,
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  PrinterOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import CreditsModal from "../leave-history/CreditsModal";
import imageUtility from "../../utils/imageUtility";
import PersonnelActivitiesTable from "../leave-history/PersonnelActivitiesTable";
import UserSaveModal from "../user/UserSaveModal";
import type { Usertbl } from "../../@types/Usertbl";
import PersonnelDutyStatusModal from "./PersonnelDutyStatusModal";
import departmentService from "../../services/departmentService";

// Export Utilities
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import nameFormat from "../../utils/nameFormat";
import { usePrint } from "../../hooks/documents/usePrint";

export type PersonnelForm = Omit<
  Personnel,
  "dateEnlisted" | "dateEnteredService" | "dateOfLastPromotion"
> & {
  dateEnlisted?: Dayjs | null;
  dateEnteredService?: Dayjs | null;
  dateOfLastPromotion?: Dayjs | null;
};

export const emptyPersonnel: Personnel = {
  personnelId: null,
  profile: null,
  serialNumber: null,
  firstName: null,
  middleName: null,
  lastName: null,
  rankId: null,
  rank: null,
  email: null,
  employmentStatus: "Active",
  dateEnlisted: null,
  dateEnteredService: null,
  dateOfLastPromotion: null,
  personnelActivities: [],
};

const PersonnelIndex: React.FC = () => {
  const [isDocummenting, setIsDocumenting] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const { handlePrint } = usePrint({
    ref,
    orientation: "landscape",
    onBeforePrint: async () => await setIsDocumenting(true),
    onAfterPrint: async () => await setIsDocumenting(false),
  });
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(
    null,
  );
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [filteredData, setFilteredData] = useState<Personnel[]>([]);
  const [leaveHistoryModal, setLeaveHistoryModal] = useState<boolean>(false);
  const [form] = Form.useForm<PersonnelForm>();
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [userForm] = Form.useForm<Usertbl>();
  const [isStatusModalVisible, setIsStatusModalVisible] = useState(false);
  const [statusForm] = Form.useForm();

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => await departmentService.getAll(),
  });

  const {
    data: personnelList,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const data = await personelService.getAllOnly();
      setFilteredData(data);
      return data;
    },
    initialData: [],
  });

  // Current dataset active in view
  const currentData = filteredData.length ? filteredData : personnelList;

  // Helper to format designation column string safely for downloads and prints
  const getDesignationString = (record: Personnel) => {
    const primaryDeptName = record.department?.departmentName || "";
    const hasOtherDepts =
      record.otherDepartmentIds && record.otherDepartmentIds.length > 0;
    const otherDeptNames = hasOtherDepts
      ? departments
          ?.filter((dept) =>
            record.otherDepartmentIds?.includes(dept.departmentId ?? 0),
          )
          ?.map((dept) => dept.departmentName)
          ?.join(", ")
      : "";

    if (!primaryDeptName && !otherDeptNames) return "";
    if (primaryDeptName && otherDeptNames)
      return `${primaryDeptName} (Other: ${otherDeptNames})`;
    return primaryDeptName || otherDeptNames || "";
  };

  // --- EXPORT FUNCTIONALITIES ---

  const exportToExcel = () => {
    const fileType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8";
    const fileExtension = ".xlsx";

    const excelData = currentData.map((item, index) => ({
      Nr: index + 1,
      Name: nameFormat(item),
      Designation: getDesignationString(item),
      Email: item.email || "",
      "Date Entered Service": item.dateEnteredService
        ? formatDateToMilitary(item.dateEnteredService)
        : "",
      "Date Enlisted/Commissioned": item.dateEnlisted
        ? formatDateToMilitary(item.dateEnlisted)
        : "",
      "Last Promotion": item.dateOfLastPromotion
        ? formatDateToMilitary(item.dateOfLastPromotion)
        : "",
      "Has Account": item.hasAccount ? "Yes" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = { Sheets: { Personnel: ws }, SheetNames: ["Personnel"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: fileType });
    saveAs(
      data,
      `Personnel_Report_${dayjs().format("YYYY-MM-DD")}${fileExtension}`,
    );
  };

  const exportToPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    doc.setFontSize(16);
    doc.text("Personnel List Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${dayjs().format("YYYY-MM-DD HH:mm")}`, 14, 22);

    // Explicitly omitting "Has Account" / "Account"
    const tableColumn = [
      "Nr",
      "Name",
      "Designation",
      "Email",
      "Date Entered Service",
      "Date Enlisted / Commissioned",
      "Last Promotion",
    ];

    const tableRows: any = currentData.map((item, index) => [
      index + 1,
      nameFormat(item),
      getDesignationString(item),
      item.email || "",
      item.dateEnteredService
        ? formatDateToMilitary(item.dateEnteredService)
        : "",
      item.dateEnlisted ? formatDateToMilitary(item.dateEnlisted) : "",
      item.dateOfLastPromotion
        ? formatDateToMilitary(item.dateOfLastPromotion)
        : "",
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: "striped",
      styles: { fontSize: 9, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 45 },
        2: { cellWidth: 55 },
        3: { cellWidth: 50 },
        4: { cellWidth: 35 },
        5: { cellWidth: 35 },
        6: { cellWidth: 35 },
      },
    });

    doc.save(`Personnel_Report_${dayjs().format("YYYY-MM-DD")}.pdf`);
  };

  const exportMenuItems: MenuProps["items"] = [
    {
      key: "excel",
      label: "Export to Excel",
      icon: <FileExcelOutlined className="text-green-600" />,
      onClick: exportToExcel,
    },
    {
      key: "pdf",
      label: "Export to PDF",
      icon: <FilePdfOutlined className="text-red-500" />,
      onClick: exportToPDF,
    },
    {
      key: "print",
      label: "Print Table",
      icon: <PrinterOutlined className="text-blue-500" />,
      onClick: () => handlePrint(),
    },
  ];

  const openModal = (personnel?: Personnel) => {
    if (personnel) {
      form.setFieldsValue({
        ...personnel,
        dateEnlisted: personnel.dateEnlisted
          ? dayjs(personnel.dateEnlisted)
          : null,
        dateEnteredService: personnel.dateEnteredService
          ? dayjs(personnel.dateEnteredService)
          : null,
        dateOfLastPromotion: personnel.dateOfLastPromotion
          ? dayjs(personnel.dateOfLastPromotion)
          : null,
      });
      setSelectedPersonnel(personnel);
    } else {
      form.setFieldsValue(emptyPersonnel);
      setSelectedPersonnel(null);
    }
    setIsModalVisible(true);
  };

  const handleDelete = async (personnelId?: number) => {
    await personelService.delete(personnelId);
    refetch();
  };

  const openHistoryModal = (record: Personnel) => {
    setSelectedPersonnel(record);
    setLeaveHistoryModal(true);
  };

  const openUserModal = (personnel: Personnel) => {
    setSelectedPersonnel(personnel);
    setIsUserModalVisible(true);
    userForm.resetFields();
    userForm.setFieldsValue({
      personnelId: personnel.personnelId || undefined,
      email: personnel.email || undefined,
    });
  };

  const columns: ColumnsType<Personnel> = [
  {
    title: "Nr",
    width: 30,
    align: "center",
    render: (_, __, index) => index + 1,
  },
  {
    title: "Profile",
    key: "personnelProfile",
    ellipsis:false,
    render: (_, record: Personnel) => (
      <div 
        style={{ 
          cursor: "pointer", 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center",
          gap: "4px", 
          textAlign: "center",
          padding: "4px 0"
        }}
      >
        {/* 1. Profile Image */}
        <Image
          width={80}
          height={80}
          style={{ objectFit: "cover", borderRadius: "4px" }}
          src={imageUtility.getProfile(record.profile)}
          fallback="https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
          placeholder={
            <div
              style={{
                width: 80,
                height: 80,
                background: "#f5f5f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserOutlined style={{ fontSize: 24, color: "#bfbfbf" }} />
            </div>
          }
          preview={{
            mask: <div style={{ fontSize: 12 }}>View</div>,
          }}
        />
        
        {/* 2. Bold Name Format */}
        <span style={{ fontSize: "14px", fontWeight: 600, lineHeight: "1.2", color: "#262626" }}>
          {nameFormat(record)}
        </span>

        {/* 3. Gray Encoded Email Address */}
        {record.email && (
          <span style={{ fontSize: "12px", color: "#8c8c8c", lineHeight: "1" }}>
            {record.email}
          </span>
        )}
      </div>
    ),
  },
  {
    title: "Designation",
    key: "departmentsCombination",
    width: 200,
    render: (_, record: Personnel) => {
      const primaryDeptName = record.department?.departmentName;
      const hasOtherDepts =
        record.otherDepartmentIds && record.otherDepartmentIds.length > 0;

      const otherDeptNames = hasOtherDepts
        ? departments
            ?.filter((dept) =>
              record.otherDepartmentIds?.includes(dept.departmentId ?? 0),
            )
            ?.map((dept) => dept.departmentName)
            ?.join(", ")
        : "";

      if (!primaryDeptName && !otherDeptNames) return "";

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {primaryDeptName && (
            <span style={{ color: "#1890ff", fontWeight: 700 }}>
              {primaryDeptName}
            </span>
          )}
          {otherDeptNames && (
            <span style={{ color: "#8c8c8c", fontSize: "12px" }}>
              {primaryDeptName ? (
                <>
                  <b>Other:</b> {otherDeptNames}
                </>
              ) : (
                otherDeptNames
              )}
            </span>
          )}
        </div>
      );
    },
  },
  {
    title: "Date Entered Service",
    dataIndex: "dateEnteredService",
    key: "dateEnteredService",
    render: (value) => (value ? formatDateToMilitary(value) : ""),
  },
  {
    title: "Date Enlisted/Commissioned",
    dataIndex: "dateEnlisted",
    key: "dateEnlisted",
    render: (value) => (value ? formatDateToMilitary(value) : ""),
  },
  {
    title: "Last Promotion",
    dataIndex: "dateOfLastPromotion",
    key: "dateOfLastPromotion",
    render: (value) => (value ? formatDateToMilitary(value) : ""),
  },
  {
    title: "Has Account",
    key: "hasAccount",
    dataIndex: "hasAccount",
    width: 100,
    align: "center",
    filters: [
      { text: "Yes", value: true },
      { text: "No", value: false },
    ],
    render: (value) => {
      return value ? (
        <CheckOutlined style={{ color: "#52c41a", fontSize: "16px", fontWeight: "bold" }} />
      ) : (
        <CloseOutlined style={{ color: "#ff4d4f", fontSize: "16px", fontWeight: "bold" }} />
      );
    },
  },
  {
    title: "Actions",
    key: "actions",
    fixed: "left",
    render: (_, record) => (
      <Space>
        <Tooltip title="View Leave Credits">
          <Button
            type="text"
            icon={<HistoryOutlined />}
            onClick={() => openHistoryModal(record)}
          />
        </Tooltip>
        {!record.hasAccount && (
          <Tooltip title="Create System Account">
            <Button
              type="text"
              style={{ color: "#722ed1" }}
              icon={<UserAddOutlined />}
              onClick={() => openUserModal(record)}
            />
          </Tooltip>
        )}
        <Tooltip title="Edit">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          />
        </Tooltip>
        <Tooltip title="Delete">
          <Popconfirm
            title="Are you sure to delete?"
            onConfirm={() => handleDelete(record?.personnelId ?? 0)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Tooltip>
      </Space>
    ),
  },
];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Space size="middle">
          <Button type="primary" onClick={() => openModal()}>
            Add Personnel
          </Button>

          <Dropdown menu={{ items: exportMenuItems }} placement="bottomLeft">
            <Button icon={<DownloadOutlined />}>Export / Print</Button>
          </Dropdown>
        </Space>

        <DebounceInput
          placeholder="Search Name..."
          style={{ width: 250 }}
          onChange={(value) => {
            const keyword = value.toLowerCase().trim();

            if (!keyword) {
              setFilteredData(personnelList);
              return;
            }

            const result = personnelList.filter((item) => {
              const name = nameFormat(item || {}).toLowerCase();
              return name.includes(keyword);
            });

            setFilteredData(result);
          }}
        />
      </div>
      <div ref={ref}>
        <Table
          sticky
          scroll={{ x: "max-content" }}
          pagination={false}
          size="small"
          columns={columns.filter(
            (x) =>
              !isDocummenting ||
              (x.title !== "Actions" && x.title !== "Has Account"),
          )}
          dataSource={currentData}
          rowKey="personnelId"
          loading={isFetching}
          expandable={{
            expandedRowRender: (record) => (
              <PersonnelActivitiesTable selectedPersonnel={record} />
            ),
            rowExpandable: (record) =>
              (record.personnelActivities?.length || 0) > 0,
          }}
        />
      </div>

      <UserSaveModal
        form={userForm}
        isModalVisible={isUserModalVisible}
        setIsModalVisible={setIsUserModalVisible}
        selectedUser={{
          personnel: selectedPersonnel,
          personnelId: selectedPersonnel?.personnelId,
        }}
        onAfterSave={() => refetch()}
      />
      <CreditsModal
        open={leaveHistoryModal}
        onClose={() => setLeaveHistoryModal(false)}
        selectedPersonnel={selectedPersonnel}
      />
      <PersonelSaveModal
        form={form}
        setIsModalVisible={setIsModalVisible}
        selectedPersonnel={selectedPersonnel}
        isModalVisible={isModalVisible}
        onAfterSave={() => refetch()}
      />
      <PersonnelDutyStatusModal
        form={statusForm}
        isModalVisible={isStatusModalVisible}
        setIsModalVisible={setIsStatusModalVisible}
        selectedPersonnel={selectedPersonnel}
        onAfterSave={() => refetch()}
        onUpdate={async () => {
          if (selectedPersonnel?.personnelId) {
            // update handling logic
          }
        }}
      />
    </div>
  );
};

export default PersonnelIndex;
