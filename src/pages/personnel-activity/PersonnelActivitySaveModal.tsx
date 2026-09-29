import React, { useEffect, useMemo, useState } from "react";
import {
  Form,
  Input,
  InputNumber, // <-- Added AntD InputNumber
  Modal,
  Select,
  Typography,
  Alert,
  Spin,
  type FormInstance,
  type ModalProps,
} from "antd";
import dayService from "../../services/dayService";
import DateRangeComponent from "../../componets/DateRangeComponent";
import personnelActivityService from "../../services/personnelActivityService";
import dayjs from "dayjs";
import type { PersonnelActivity } from "../../@types/PersonnelActivity";
import personelService from "../../services/personelService";
import { useQuery } from "@tanstack/react-query";
import activityTypeService from "../../services/activityTypeService";
import { emptyValues } from "./PersonnelActivityIndex";
import type { AxiosError } from "axios";
import { formatDateToMilitary } from "../../utils/formatDateToMilitary";
import type { ActivityType } from "../../@types/ActivityType";
import { useAuth } from "../../context/UserContext";
import PersonnelSelectComponent from "../../componets/PersonnelSelectComponent";

const { Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

type SaveModalProps = {
  form: FormInstance<PersonnelActivity>;
  setIsModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  selectedActivity: PersonnelActivity | null;
  isModalVisible: boolean;
  onAfterSave?: () => void;
  modalProps?: ModalProps;
  activityTypes?: ActivityType[];
  showPersonnelSelection?: boolean;
};

const STATUS_DESCRIPTIONS: Record<string, string> = {
  "Pending Approval": "is currently pending approval for another request",
  Scheduled: "is already scheduled for an assignment",
  Ongoing: "has an ongoing activity running",
  Suspended: "is under suspension status during this timeframe",
  Inactive: "is marked as inactive during these dates",
  Appeal: "has a pending schedule appeal",
  Declined: "had an assignment conflict (declined status)",
};

export default function PersonnelActivitySaveModal({
  form,
  selectedActivity,
  isModalVisible,
  setIsModalVisible,
  onAfterSave,
  modalProps,
  activityTypes,
  showPersonnelSelection = false
}: SaveModalProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [serverDays, setServerDays] = useState<number>(0);
  const [overlapError, setOverlapError] = useState<
    PersonnelActivity | null | undefined
  >(null);

  const { user } = useAuth();
  const startDate = Form.useWatch("startDate", form);
  const endDate = Form.useWatch("endDate", form);
  const activityTypeId = Form.useWatch("activityTypeId", form);
  const personnelId = Form.useWatch("personnelId", form);

  // Watch the form instance's manual day changes to dynamically adapt the credit deduction calculations
  const formDaysInput = Form.useWatch("days", form);

  // 1. Fetch Activity Types
  const { data: fetchedActivities } = useQuery({
    queryKey: ["activityTypes", activityTypes],
    queryFn: async () => {
      if (activityTypes) return activityTypes;
      const types = await activityTypeService.getAll();
      return types?.filter(
        (t) =>
          t.activityTypeName != "SCHOOLING" &&
          t.activityTypeName != "RESTRICTED",
      );
    },
    initialData: [],
  });

  // 2. Identify if the selected type is Mandatory
  const selectedTypeObj = useMemo(
    () => fetchedActivities.find((t) => t.activityTypeId === activityTypeId),
    [fetchedActivities, activityTypeId],
  );

  // 3. EFFECT: Call the API to compute recommended days
  useEffect(() => {
    const fetchDays = async () => {
      if (startDate && endDate) {
        setIsCalculating(true);
        try {
          const formattedStart = dayjs(startDate).startOf("day").format("YYYY-MM-DD");
          const formattedEnd = dayjs(endDate).startOf("day").format("YYYY-MM-DD");

          const days = await dayService.computeDays(
            formattedStart,
            formattedEnd,
            selectedTypeObj?.isMandatoryLeave ?? false,
            selectedTypeObj?.activityTypeId == 6,
          );
          setServerDays(days);

          // Fallback: If creating a new record, automatically load the calculated value as the input value
          if (!selectedActivity) {
            form.setFieldsValue({ days: days });
          }
        } catch (err) {
          console.error("Calculation error", err);
        } finally {
          setIsCalculating(false);
        }
      } else {
        setServerDays(0);
        if (!selectedActivity) {
          form.setFieldsValue({ days: undefined });
        }
      }
    };

    fetchDays();
  }, [startDate, endDate, selectedTypeObj, form, selectedActivity]);

  // Set initial value during editing mode once selectedActivity data wraps into context
  useEffect(() => {
    if (selectedActivity?.days) {
      form.setFieldsValue({ days: selectedActivity.days });
    }
  }, [selectedActivity, form]);

  // 4. Fetch Credits
  const { data: creditsData } = useQuery({
    queryKey: ["personnelCredits", personnelId, activityTypeId, startDate],
    queryFn: () =>
      personelService.getPersonnelCredits(
        personnelId,
        dayjs().year(),
        activityTypeId,
        startDate,
      ),
    enabled: !!personnelId && !!activityTypeId,
  });

  // 5. Final Calculation for Balance Deductions (Utilizing manual form inputs if populated)
  const calculation = useMemo(() => {
    const currentCredit = creditsData?.find(
      (c) => c.activityTypeId === activityTypeId
    );
    let remaining = currentCredit?.remainingCredits ?? 0;
    console.log(remaining)
    // Refund logic for editing
    if (
      selectedActivity &&
      selectedActivity.personnelActivityId &&
      selectedActivity.activityTypeId === activityTypeId
    ) {
      remaining += selectedActivity.days ?? 0;
    }

    const workingDaysCount = formDaysInput ?? serverDays ?? 0;

    return {
      daysPicked: workingDaysCount,
      balanceAfter: remaining - workingDaysCount,
      totalAvailable: remaining,
    };
  }, [serverDays, formDaysInput, creditsData, activityTypeId, selectedActivity]);

  const handleOverlap = async () => {
    const values = form.getFieldsValue();
    let selectedPersonnelId = user?.personnelId ?? values.personnelId;

    if (selectedPersonnelId && values.startDate && values.endDate) {
      try {
        const payload: PersonnelActivity = {
          ...values,
          personnelId: selectedPersonnelId,
          endDate: dayjs(values.endDate)?.format("YYYY-MM-DD"),
          startDate: dayjs(values.startDate)?.format("YYYY-MM-DD"),
          personnelActivityId: selectedActivity?.personnelActivityId ?? undefined,
        };

        const res = await personnelActivityService.checkOverlap(payload);
        if (res.data && !res.data.hasOverlap) {
          setOverlapError(null);
        }
      } catch (err) {
        const axiosError = err as AxiosError<{
          hasOverlap?: boolean;
          message?: string;
          activity?: PersonnelActivity;
        }>;

        if (axiosError.response?.data?.hasOverlap) {
          setOverlapError(axiosError.response.data.activity);
        } else {
          console.error("System pipeline execution error:", err);
        }
      }
    } else {
      setOverlapError(null);
    }
  };

  const handleOk = async () => {
    try {
      setIsSubmitting(true);
      setOverlapError(null);

      const values = await form.validateFields();

      console.log('days', values)
      const payload: PersonnelActivity = {
        ...values,
        personnelId: user?.personnelId,
        status: "Pending Approval",
        endDate: dayjs(values.endDate)?.format("YYYY-MM-DD"),
        startDate: dayjs(values.startDate)?.format("YYYY-MM-DD"),
        personnelActivityId: selectedActivity?.personnelActivityId ?? undefined,
      };

      if (selectedActivity?.personnelActivityId) {
        await personnelActivityService.update({
          ...payload,
          personnelActivityId: selectedActivity.personnelActivityId,
        });
      } else {
        await personnelActivityService.add(payload);
      }

      setIsModalVisible(false);
      onAfterSave && onAfterSave();
    } catch (err) {
      console.log("Save failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOverlapError(null);
    setIsModalVisible(false);
  };

  const computedAlertMessage = useMemo(() => {
    if (!overlapError) return "";

    const statusText = overlapError.status
      ? STATUS_DESCRIPTIONS[overlapError.status] || `is marked as '${overlapError.status}'`
      : "has a conflict";
    const rawTypeName = overlapError.activityType?.activityTypeName;
    const titleLabel = overlapError.title ? ` for '${overlapError.title}'` : "";

    const start = overlapError.startDate ? formatDateToMilitary(overlapError.startDate) : "";
    const end = overlapError.endDate ? formatDateToMilitary(overlapError.endDate) : "";
    const rangeLabel = start && end ? ` from ${start} to ${end}` : " during this timeframe";

    return `${rawTypeName} Conflict: ${statusText}${titleLabel}${rangeLabel}.`;
  }, [overlapError]);

  return (
    <Modal
      title={selectedActivity ? "Edit Leave" : "Request Leave"}
      open={isModalVisible}
      onOk={handleOk}
      okText={selectedActivity ? "Update" : "Submit"}
      onCancel={handleClose}
      okButtonProps={{
        loading: isSubmitting,
        disabled: isCalculating || calculation.balanceAfter! < 0 || !!overlapError,
      }}
      destroyOnClose
      width={600}
      {...modalProps}
    >
      <Form
        form={form}
        initialValues={selectedActivity || emptyValues}
        layout="vertical"
        onValuesChange={(changedValues) => {
          if (
            "startDate" in changedValues ||
            "endDate" in changedValues ||
            "personnelId" in changedValues
          ) {
            setOverlapError(null);
          }
        }}
      >
        <div style={{ display: showPersonnelSelection ? "block" : "none" }}>
          <PersonnelSelectComponent
            defaultValue={showPersonnelSelection ? selectedActivity?.personnelId : user?.personnelId}
            name="personnelId"
            label="Personnel"
            onChange={() => handleOverlap()}
          />
        </div>

        <Form.Item
          name="activityTypeId"
          label="Type"
          rules={[{ required: true, message: "Please select activity type" }]}
        >
          <Select placeholder="Select Activity Type" allowClear>
            {fetchedActivities.map((a) => (
              <Option key={a.activityTypeId} value={a.activityTypeId}>
                {a.activityTypeName}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <DateRangeComponent
          form={form}
          onChangeEnd={() => handleOverlap()}
          onChangeStart={() => handleOverlap()}
        />

        {startDate && endDate && (
          <Form.Item

            name="days"
            label="Days Count Allocation"
            extra={serverDays > 0 ? `System Recommendation: ${serverDays} Day(s) based on system calendar logic.` : ""}
            rules={[{ required: true, message: "Please input or accept day allocations" }]}
          >
            <InputNumber readOnly min={0} style={{ width: "100%" }} placeholder="Input days amount" />
          </Form.Item>
        )}

        {/* Display Server-Calculated Credits & Active Warnings */}
        {((startDate && endDate) || overlapError) && (
          <div
            style={{
              marginBottom: 16,
              padding: "16px",
              background: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            {overlapError && (
              <Alert
                message="Schedule Conflict Detected"
                description={computedAlertMessage}
                type="error"
                showIcon
                style={{ marginBottom: 12 }}
              />
            )}

            {!overlapError && startDate && endDate && (
              <Spin spinning={isCalculating}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text>Days Deducting:</Text>
                  <Text strong>{calculation.daysPicked} Day(s)</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text>Available Credits:</Text>
                  <Text strong style={{ color: "#1677ff" }}>
                    {calculation.totalAvailable} Day(s)
                  </Text>
                </div>
                <hr style={{ border: "0.5px solid #e2e8f0", margin: "8px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text><b>Remaining After:</b></Text>
                  <Text
                    strong
                    type={calculation.balanceAfter! < 0 ? "danger" : "success"}
                  >
                    {calculation.balanceAfter} Day(s)
                  </Text>
                </div>

                {calculation.balanceAfter! < 0 && (
                  <Alert
                    message="Insufficient Credits"
                    description="You do not have enough leave credits for this request."
                    type="error"
                    showIcon
                    style={{ marginTop: 12 }}
                  />
                )}
              </Spin>
            )}
          </div>
        )}

        <Form.Item
          name="reason"
          label="Reason for Action"
          rules={[
            {
              required: true,
              message: "Please provide a reason for this action.",
            },
          ]}
        >
          <TextArea
            rows={4}
            placeholder="State your reason here..."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}