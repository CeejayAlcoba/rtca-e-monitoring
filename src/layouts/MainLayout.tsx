import { useState, useEffect } from "react";
import { Layout, notification } from "antd";

import SidebarLayout from "./content/SidebarLayout";
import HeaderLayout from "./content/HeaderLayout";
import ContentLayout from "./content/ContentLayout";
import { SidebarContext } from "./context/SidebarContext";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import nameFormat from "../utils/nameFormat";
import { useQuery } from "@tanstack/react-query";
import personnelActivityService from "../services/personnelActivityService";
import { useAuth } from "../context/UserContext";
import { useNavigate } from "react-router-dom";

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const { user } = useAuth();
  const { isMobile } = useResponsiveLayout();
  const [api, contextHolder] = notification.useNotification();
  const navigate = useNavigate();
  const {
    data: activities = [],
  } = useQuery({
    queryKey: ["personnelActivities", user?.userId],
    queryFn: async () => {
      const res = await personnelActivityService.getPendingActivities(
        user?.userId
      );

      return res.filter(
        (c) =>
          c.status === "Pending Approval" ||
          c.status === "Appeal"
      );
    },
    enabled: !!user?.userId
  });

  useEffect(() => {
    if (!activities?.length) return;

    api.info({
      message: "Activity Requests",
      description: (
        <>
          {activities.map((activity) => (
            <div key={activity.personnelActivityId} style={{ marginBottom: 8 }}>
              <strong>{nameFormat(activity.personnel)}</strong>
              <br />
              {activity.activityType?.activityTypeName} | {activity.days} day
              {(activity.days ?? 0) > 1 ? "s" : ""}
            </div>
          ))}

          <a onClick={() => navigate("/activity-approval")}>
            Click to review the request.
          </a>
        </>
      ),
      placement: "topRight",
      duration: 0,
    });
  }, [activities]);
  useEffect(() => {
    if (isMobile) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  }, [isMobile]);

  return (
    <>
      {contextHolder}
      <SidebarContext value={{ collapsed, setCollapsed }}>
        <Layout style={{ minHeight: "100vh" }}>
          {/* Cleaned up prop since you have SidebarContext */}
          <SidebarLayout collapsed={collapsed} />

          <Layout className="site-layout">
            <HeaderLayout />
            <ContentLayout />
          </Layout>
        </Layout>
      </SidebarContext>
    </>

  );
}
