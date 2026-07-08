import { Avatar, Button, Card, Progress, Tag, Upload, message, Spin } from "antd";
import PersonnelActivitiesTable from "./PersonnelActivitiesTable";
import getRandomColor from "../../utils/getRandomColor";
import type { Personnel } from "../../@types/Personnel";
import imageUtility from "../../utils/imageUtility";
import { UserOutlined, UploadOutlined } from "@ant-design/icons";
import nameFormat from "../../utils/nameFormat";
import YearSelect from "../../componets/YearSelect";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import personelService from "../../services/personelService";
import dayjs from "dayjs";
import { useAuth } from "../../context/UserContext";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import activityTypeService from "../../services/activityTypeService";
import personnelActivityService from "../../services/personnelActivityService";

type LeaveCreditsFormatType = {
  selectedPersonnel?: Personnel | null;
};

export default function LeaveCreditsFormat({
  selectedPersonnel,
}: LeaveCreditsFormatType) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedYear, setYear] = useState<number | null>(
    dayjs().year(),
  );

  const { isMobile } = useResponsiveLayout(1025);
  const { setUser, user } = useAuth();

  // 1. Fetch All Activity Types
  const { data: activityTypes, isLoading: isLoadingTypes } = useQuery({
    queryKey: ["activityTypes"],
    queryFn: async () => await activityTypeService.getAll(),
    enabled: !!selectedPersonnel?.personnelId,
  });

  // 2. Fetch raw activities history for the target personnel to aggregate credits locally
  const { data: rawPersonnelActivities, isLoading: isLoadingActivities } = useQuery({
    queryKey: ["personnelActivitiesRaw", selectedPersonnel?.personnelId],
    queryFn: async () => {
      const res = await personnelActivityService.getAll(); 
      return res || [];
    },
    enabled: !!selectedPersonnel?.personnelId,
  });

  // Global card area loading status flag
  const isCardSectionLoading = isLoadingTypes || isLoadingActivities;

  // 3. Compute limits, used, and remaining metrics purely on the client side
  const aggregatedCredits = useMemo(() => {
    if (!activityTypes) return [];

    const currentYearActivities = (rawPersonnelActivities || []).filter((act: any) => {
      const matchPersonnel = act.personnelId === selectedPersonnel?.personnelId;
      const matchYear = act.startDate ? dayjs(act.startDate).year() === selectedYear : false;
      const isValidStatus = act.status !== "Declined" && act.status !== "Cancelled"; 
      return matchPersonnel && matchYear && isValidStatus;
    });

    return activityTypes.map((type: any) => {
      const usedCredits = currentYearActivities
        .filter((act: any) => act.activityTypeId === type.activityTypeId)
        .reduce((sum: number, act: any) => sum + (Number(act.days) || 0), 0);

      const maxCredits = Number(type.maxCredits) || Number(type.limit) || 0;
      const remainingCredits = Math.max(0, maxCredits - usedCredits);

      return {
        ...type,
        maxCredits,
        usedCredits,
        remainingCredits,
      };
    });
  }, [activityTypes, rawPersonnelActivities, selectedPersonnel, selectedYear]);

  useEffect(() => {
    if (selectedPersonnel) {
      setPreview(imageUtility.getProfile(selectedPersonnel.profile) ?? "");
    }
  }, [selectedPersonnel]);

  const handleOk = async () => {
    setUploading(true);
    if (!selectedPersonnel) return;
    try {
      const formData = new FormData();

      (
        Object.keys(selectedPersonnel) as (keyof typeof selectedPersonnel)[]
      ).forEach((key) => {
        const value = selectedPersonnel[key];

        if (value === null || value === undefined) return;

        if (dayjs.isDayjs(value)) {
          formData.append(key as string, value.format("YYYY-MM-DD"));
        } else {
          formData.append(key as string, String(value));
        }
      });

      if (file) {
        formData.append("profileImage", file);
      }

      if (selectedPersonnel?.personnelId) {
        formData.append(
          "personnelId",
          selectedPersonnel.personnelId.toString(),
        );
        const updatedPersonnel = await personelService.update(
          formData,
          selectedPersonnel?.personnelId,
        );
        if (user?.personnelId == selectedPersonnel.personnelId) {
          setUser((prev) => ({
            ...prev,
            personnel: {
              ...prev?.personnel,
              profile: updatedPersonnel.profile,
            },
          }));
        }
      }
      message.success("Profile successfully uploaded");
      setFile(null);
    } catch {}
    setUploading(false);
  };

  return (
    <>
      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* Left Side: Profile Info */}
        <div className="col-span-12 lg:col-span-3 flex flex-col items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <Avatar
            shape="square"
            size={isMobile ? 200 : 300}
            src={
              preview
                ? preview
                : imageUtility.getProfile(selectedPersonnel?.profile)
            }
            icon={!preview && <UserOutlined />}
          />

          <Upload
            accept="image/png, image/jpeg"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(file) => {
              const isImage =
                file.type === "image/png" || file.type === "image/jpeg";

              if (!isImage) {
                message.error("Only PNG/JPG files are allowed!");
                return Upload.LIST_IGNORE;
              }

              setFile(file);
              const reader = new FileReader();
              reader.onload = (e) => {
                setPreview(e.target?.result as string);
              };
              reader.readAsDataURL(file);

              return false;
            }}
            onChange={() => handleOk()}
          >
            <div className="flex">
              <Button htmlType="button" loading={uploading}>
                {uploading ? (
                  "Uploading..."
                ) : (
                  <>
                    {" "}
                    <UploadOutlined /> Upload
                  </>
                )}
              </Button>
            </div>
          </Upload>

          <div className="mt-4 text-center">
            <h2 className="text-2xl font-bold text-gray-800 m-0">
              {nameFormat(selectedPersonnel)}
            </h2>
            <p className="text-gray-500 uppercase tracking-wider text-xs font-semibold mt-1">
              Personnel Profile
            </p>
          </div>

          <div className="w-full mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 font-medium">Reporting Year:</span>
              <YearSelect
                value={selectedYear}
                onChange={(val) => setYear(val)}
              />
            </div>
          </div>
        </div>

        {/* Right Side: Generated Credits Aggregation Grid wrapped in loading element */}
        <div className="col-span-12 lg:col-span-9">
          <Spin spinning={isCardSectionLoading} tip="Updating allocation aggregates...">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 min-h-[200px]">
              {!isCardSectionLoading && aggregatedCredits.length === 0 && (
                <div className="col-span-full flex items-center justify-center text-gray-400 py-12">
                  No activity types configured.
                </div>
              )}
              
              {aggregatedCredits?.map((leave: any, index: number) => {
                const percent =
                  leave.maxCredits > 0
                    ? (leave.usedCredits / leave.maxCredits) * 100
                    : 0;
                const color = getRandomColor(index);

                return (
                  <Card
                    key={index}
                    hoverable
                    bodyStyle={{ padding: "16px" }}
                    className="rounded-xl border-l-4 overflow-hidden shadow-sm"
                    style={{ borderLeftColor: color }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <strong className="font-bold text-gray-700 m-0 truncate pr-2">
                        {leave.activityTypeName}
                      </strong>
                      <Tag color={color} className="mr-0 rounded-full font-bold">
                        {leave.remainingCredits} Left
                      </Tag>
                    </div>

                    <div className="flex justify-between text-xs mb-1 text-gray-500">
                      <span>Used: {leave.usedCredits}</span>
                      <span>Limit: {leave.maxCredits}</span>
                    </div>

                  <Progress
                    percent={Math.round(percent)}
                    strokeColor={percent > 90 ? "#ff4d4f" : color}
                    status={percent > 90 ? "exception" : "active"}
                    showInfo={false}
                    strokeWidth={10}
                  />

                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">
                        Usage Status
                      </span>
                      <span className="text-xs font-semibold">
                        {Math.round(percent)}%
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </Spin>
        </div>
      </div>

      {/* Bottom Section: Table Breakdown */}
      <div className="mt-8 pt-6 border-t border-gray-100">
        <div className="flex items-center mb-4">
          <div className="h-6 w-1 bg-blue-500 rounded-full mr-2"></div>
          <strong className="text-lg font-bold text-gray-800 m-0">
            Activity Breakdown
          </strong>
        </div>
        <PersonnelActivitiesTable
          selectedPersonnel={selectedPersonnel}
          year={selectedYear}
        />
      </div>
    </>
  );
}