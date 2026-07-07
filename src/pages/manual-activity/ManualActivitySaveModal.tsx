import React, { useEffect, useMemo, useState } from "react";
import { Form, type FormInstance } from "antd";
// ... (other imports)
import dayService from "../../services/dayService"; // Import the new service
import personnelActivityService from "../../services/personnelActivityService";
import dayjs from "dayjs";
import type { PersonnelActivity } from "../../@types/PersonnelActivity";
import { useQuery } from "@tanstack/react-query";
import activityTypeService from "../../services/activityTypeService";
import PersonnelActivitySaveModal from "../personnel-activity/PersonnelActivitySaveModal";

type SaveModalProps = {
  form: FormInstance<PersonnelActivity>;
  setIsModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  selectedActivity: PersonnelActivity | null;
  isModalVisible: boolean;
  onAfterSave: () => void;
};
export default function ManualActivitySaveModal({
  form,
  selectedActivity,
  isModalVisible,
  setIsModalVisible,
  onAfterSave,
}: SaveModalProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [serverDays, setServerDays] = useState<number>(0);

  const startDate = Form.useWatch("startDate", form);
  const endDate = Form.useWatch("endDate", form);
  const activityTypeId = Form.useWatch("activityTypeId", form);

  // 1. Fetch Activity Types
  const { data: activityTypes } = useQuery({
    queryKey: ["activities", isModalVisible],
    queryFn: async () => await activityTypeService.getAll(),
    initialData: [],
  });

  // 2. Identify if the selected type is Mandatory
  const selectedTypeObj = useMemo(
    () => activityTypes.find((t) => t.activityTypeId === activityTypeId),
    [activityTypes, activityTypeId],
  );

  // 3. EFFECT: Call the API to compute days exactly like the backend
  useEffect(() => {
    const fetchDays = async () => {
      if (startDate && endDate) {
        setIsCalculating(true);
        try {
          // Use .startOf('day') to avoid hours/minutes causing logic errors
          const formattedStart = dayjs(startDate)
            .startOf("day")
            .format("YYYY-MM-DD");
          const formattedEnd = dayjs(endDate)
            .startOf("day")
            .format("YYYY-MM-DD");

          const days = await dayService.computeDays(
            formattedStart,
            formattedEnd,
            selectedTypeObj?.isMandatoryLeave ?? false,
            selectedTypeObj?.activityTypeId == 6,
          );

          setServerDays(days);
        } catch (err) {
          console.error("Calculation error", err);
        } finally {
          setIsCalculating(false);
        }
      } else {
        setServerDays(0);
      }
    };

    fetchDays();
  }, [startDate, endDate, selectedTypeObj]);

  const handleOk = async () => {
    try {
      setIsSubmitting(true);
      const values = await form.validateFields();
      const payload: PersonnelActivity = {
        ...selectedActivity,
        ...values,
        endDate: dayjs(values.endDate)?.format("YYYY-MM-DD"),
        startDate: dayjs(values.startDate)?.format("YYYY-MM-DD"),
        days: serverDays, // Send the server-calculated value
      };

      if (selectedActivity?.personnelActivityId) {
        await personnelActivityService.update({
          ...payload,
          personnelActivityId: selectedActivity.personnelActivityId,
        });
      } else {
        await personnelActivityService.insertManualLeave(payload);
      }

      setIsModalVisible(false);
      onAfterSave();
    } catch (err) {
      console.log("Save failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => setIsModalVisible(false);

  return (
    <PersonnelActivitySaveModal
      form={form}
      showPersonnelSelection={true}
      setIsModalVisible={setIsModalVisible}
      selectedActivity={selectedActivity}
      isModalVisible={isModalVisible}
      modalProps={{
        title: selectedActivity ? "Edit Activity" : "Add Activity",
        onOk: handleOk,
        onCancel: handleClose,
        okButtonProps: { loading: isCalculating || isSubmitting },
      }}
      activityTypes={activityTypes}
    />
  );
}
