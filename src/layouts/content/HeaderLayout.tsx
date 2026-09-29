import { Button, Layout, Dropdown, Avatar, type MenuProps } from "antd";
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";
import useSidebarContext from "../context/SidebarContext";
import { useAuth } from "../../context/UserContext";
import imageUtility from "../../utils/imageUtility";

const { Header } = Layout;

export default function HeaderLayout() {
  const { setCollapsed, collapsed } = useSidebarContext();
  const { user, setUser } = useAuth(); // Assuming your auth context provides a logout function

  const menuItems: MenuProps["items"] = [
    {
      key: "logout",
      label: "Log Out",
      icon: <LogoutOutlined />,
      danger:   true,
      onClick: () => {
        setUser(null);
        localStorage.clear();
      },
    },
  ];

  return (
    <Header
      style={{
        padding: "0 24px 0 0",
        background: "#e0e0e0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed(!collapsed)}
          style={{
            fontSize: "14px",
            width: 64,
            height: 64,
          }}
        />
        <span style={{ fontWeight: "bold", marginLeft: "8px" }}>
          RTC AURORA E-MONITORING
        </span>
      </div>

      {/* Right side: Clickable Profile Dropdown */}
      <Dropdown
        menu={{ items: menuItems }}
        trigger={["click"]}
        placement="bottomRight"
      >
        <div className="cursor-pointer flex items-center justify-center transition-opacity hover:opacity-80">
          <Avatar
            size={48} // Approximately h-12/w-12 matching your structural look
            src={imageUtility.getProfile(user?.personnel?.profile)}
            icon={<UserOutlined />} // Fallback icon if no profile image exists
            style={{
              border: "2px solid white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          />
        </div>
      </Dropdown>
    </Header>
  );
}
