import { Button, Table, Select, Space, Input, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import personelService from "../../services/personelService";
import nameFormat from "../../utils/nameFormat";
import { useState, useMemo, useRef } from "react";
import LeaveCreditModal from "./CreditsModal";
import activityTypeService from "../../services/activityTypeService";
import { formatDateRange } from "../../utils/formatDateRange";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { AllPersonnelLeaveDto } from "../../@types/nonTable/AllPersonnelLeaveDto";
import dashboardService from "../../services/dashboardService";
import dayjs from "dayjs";
import { usePrint } from "../../hooks/documents/usePrint";
import getRandomColor from "../../utils/getRandomColor";
import ActivityChart from "../statistic/charts/ActivityChart";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";

export default function ActivityHistoryPage() {
  const [selectedPersonnel, setSelectedPersonnel] =
    useState<AllPersonnelLeaveDto | null>(null);
  const [openLeaveCreditModal, setOpenLeaveCreditModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | "All">("All");
  const [searchText, setSearchText] = useState<string>("");
  const [isDocumenting, setIsDocumenting] = useState<boolean>(false);

  const { isMobile } = useResponsiveLayout();
  // --- API Queries ---
  const { data: personnelLeaveData, isLoading: loadingData } = useQuery<
    AllPersonnelLeaveDto[]
  >({
    queryKey: ["personnelLeaveData", selectedYear],
    queryFn: async () => {
      const yearParam = selectedYear === "All" ? undefined : selectedYear;
      return await personelService.getAllPersonnelCredits(yearParam);
    },
    initialData: [],
  });

  const { data: activityData } = useQuery({
    queryKey: ["activityData"],
    queryFn: async () => await dashboardService.getPersonnelByActivityType(),
    initialData: [],
  });

  const { data: activityTypes, isLoading: loadingTypes } = useQuery({
    queryKey: ["activityTypes"],
    queryFn: async () => await activityTypeService.getAll(),
    initialData: [],
  });

  // --- Extract Unique Years ---
  const yearOptions = useMemo(() => {
    const yearsSet = new Set<number>();
    personnelLeaveData.forEach((p) => {
      p.personnelActivities?.forEach((pa) => {
        if (pa.startDate) {
          const year = dayjs(pa.startDate).year();
          if (!isNaN(year)) yearsSet.add(year);
        }
        if (pa.endDate) {
          const year = dayjs(pa.endDate).year();
          if (!isNaN(year)) yearsSet.add(year);
        }
      });
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    return [
      { value: "All", label: "All Years" },
      ...sortedYears.map((year) => ({ value: year, label: `${year}` })),
    ];
  }, [personnelLeaveData]);

  const renderDutyStatusBadge = (dutyStatus?: string | null) => {
    const normalizedStatus = dutyStatus?.trim();

    if (normalizedStatus === "On Duty") {
      return (
        <Tag
          color="success"
          icon={<CheckCircleOutlined />}
          className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase"
        >
          On Duty
        </Tag>
      );
    }

    return (
      <Tag
        color="error"
        icon={<ClockCircleOutlined />}
        className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase max-w-[180px] truncate"
        title={normalizedStatus}
      >
        {normalizedStatus}
      </Tag>
    );
  };

  // --- Filtered Personnel Data ---
  const filteredPersonnels = useMemo(() => {
    if (!searchText.trim()) return personnelLeaveData;
    const lowerSearch = searchText.toLowerCase();
    return personnelLeaveData.filter((p) =>
      nameFormat(p).toLowerCase().includes(lowerSearch),
    );
  }, [personnelLeaveData, searchText]);

  // --- Filter Out Active Activities Globally ---
  const activeActivityTypes = useMemo(() => {
    return activityTypes.filter((type) => {
      return filteredPersonnels.some((person) => {
        const matchingLogs = (person.personnelActivities || []).filter((pa) => {
          const matchesType =
            String(pa.activityTypeId) === String(type.activityTypeId);
          if (!matchesType) return false;
          if (selectedYear === "All") return true;

          const startYear = pa.startDate ? dayjs(pa.startDate).year() : null;
          const endYear = pa.endDate ? dayjs(pa.endDate).year() : null;
          return startYear === selectedYear || endYear === selectedYear;
        });
        return matchingLogs.length > 0;
      });
    });
  }, [activityTypes, filteredPersonnels, selectedYear]);

  // --- Dynamic Columns Construction ---
  const dynamicColumns = useMemo(() => {
    const baseColumns: ColumnsType<AllPersonnelLeaveDto> = [
      {
        title: "Personnel",
        key: "personnel",
        fixed: "left",
        width: isMobile ? 100 : 240,
        render: (_, record) => (
          <div className="flex flex-col gap-1.5 py-1">
            <span className="text-xs font-semibold text-gray-900 break-words">
              {nameFormat(record)}
            </span>
            <div>{renderDutyStatusBadge(record.dutyStatus)}</div>
          </div>
        ),
      },
    ];

    const activityColumns: ColumnsType<AllPersonnelLeaveDto> =
      activeActivityTypes.map((type) => {
        return {
          title: `${type.activityTypeName} (${type.maxCredits || 0})`,
          key: `group-${type.activityTypeId}`,
          align: "center",
          children: [
            {
              title: "Logs",
              key: `logs-${type.activityTypeId}`,
              width: 180,
              render: (_, record) => {
                const filteredActivities = (
                  record.personnelActivities || []
                ).filter((pa) => {
                  if (!pa.isFullyApproved) return;
                  const matchesType =
                    String(pa.activityTypeId) === String(type.activityTypeId);
                  if (!matchesType) return false;
                  if (selectedYear === "All") return true;

                  const startYear = pa.startDate
                    ? dayjs(pa.startDate).year()
                    : null;
                  const endYear = pa.endDate ? dayjs(pa.endDate).year() : null;
                  return startYear === selectedYear || endYear === selectedYear;
                });

                if (filteredActivities.length === 0) {
                  return (
                    <span className="text-gray-500 text-xs block text-center font-medium">
                      -
                    </span>
                  );
                }

                return (
                  <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {filteredActivities.map((pa, idx) => (
                      <div
                        key={pa.personnelActivityId || idx}
                        className="flex flex-col border-b border-black/10 last:border-0 pb-1 last:pb-0"
                      >
                        {pa.title && (
                          <span className="font-bold text-gray-900 text-[11px] truncate">
                            {pa.title}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-800 font-semibold">
                          {formatDateRange(pa.startDate, pa.endDate)}
                          {pa.days && (
                            <span className="text-gray-700 font-medium ml-1">
                              ({pa.days}d)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              },
            },
            {
              title: "",
              key: `credits-${type.activityTypeId}`,
              align: "center",
              render: (_, record) => {
                const creditInfo = record.leaveCredits?.find(
                  (lc) =>
                    String(lc.activityTypeId) === String(type.activityTypeId),
                );
                const remainingCredits = creditInfo
                  ? creditInfo.remainingCredits
                  : (type.maxCredits ?? 0);

                return (
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      remainingCredits <= 0
                        ? "bg-red-200 text-red-800 border-red-400"
                        : "bg-white/80 text-green-800 border-green-400"
                    }`}
                  >
                    {remainingCredits}
                  </span>
                );
              },
            },
          ],
        };
      });

    const actionColumn: ColumnsType<AllPersonnelLeaveDto> = [
      {
        title: "Action",
        key: "action",
        fixed: isMobile ? false : "right",
        width: 50,
        align: "center",
        render: (_, record) => (
          <Button
            type="primary"
            size="small"
            onClick={() => {
              setSelectedPersonnel(record);
              setOpenLeaveCreditModal(true);
            }}
          >
            Credits
          </Button>
        ),
      },
    ];

    return [...baseColumns, ...activityColumns, ...actionColumn];
  }, [activeActivityTypes]);

  const ref = useRef<HTMLDivElement | null>(null);

  const { handlePrint } = usePrint({
    ref,
    orientation: "landscape",
    onBeforePrint: async () => await setIsDocumenting(true),
    onAfterPrint: async () => await setIsDocumenting(false),
  });

  const isLoading = loadingData || loadingTypes;

  return (
    <>
      {/* 
        Injecting a small style layer to clean up AntD's internal cell properties.
        This forces fixed left/right columns to respect the row background color rule.
      */}
      <style>{`
        .custom-row-colored td {
          background-color: inherit !important;
        }
      `}</style>

      <LeaveCreditModal
        open={openLeaveCreditModal}
        onClose={() => setOpenLeaveCreditModal(false)}
        selectedPersonnel={selectedPersonnel}
      />

      <div className="flex flex-col gap-4 bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        {/* Filter Toolbar */}

        <div ref={ref}>
          <ActivityChart showChart={false} />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <span className="font-semibold text-gray-700 text-sm">
              Activity & Credit Logs
            </span>
            <Space wrap size="middle">
              <Button onClick={() => handlePrint()} loading={isDocumenting}>
                Print
              </Button>

              <Input
                placeholder="Search by name..."
                size="small"
                className="w-48"
                allowClear
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Space size="small" className="">
                <span className="text-xs text-gray-500 font-medium">
                  Filter Year:
                </span>
                <Select
                  className="w-32"
                  size="small"
                  value={selectedYear}
                  options={yearOptions}
                  onChange={(value) => setSelectedYear(value)}
                  loading={loadingData}
                />
              </Space>
            </Space>
          </div>

          {/* Master Personnel Leave Matrix */}
          <Table
            size="small"
            bordered
            sticky
            dataSource={filteredPersonnels}
            columns={dynamicColumns.filter(
              (x) => x.title !== "Action" || !isDocumenting,
            )}
            rowKey="personnelId"
            loading={isLoading}
            scroll={{
              x: !isDocumenting ? "max-content" : undefined,
            }}
            pagination={false}
            onRow={(record) => {
              const dutyStatus = record.dutyStatus?.trim().toLowerCase();
              const isOnDuty = dutyStatus === "on duty";

              // Find index corresponding to the specific custom status matching the legend sequence
              const statusColorIndex = activityData.findIndex(
                (ad) => ad.activity?.trim().toLowerCase() === dutyStatus,
              );

              // Use legend color if matched, otherwise fall back to layout sequence zero helper
              const targetBgColor = isOnDuty
                ? "#ffffff"
                : getRandomColor(
                    statusColorIndex !== -1 ? statusColorIndex : 0,
                  );

              return {
                className: "custom-row-colored",
                style: {
                  backgroundColor: targetBgColor,
                },
              };
            }}
          />
        </div>
      </div>
    </>
  );
}
