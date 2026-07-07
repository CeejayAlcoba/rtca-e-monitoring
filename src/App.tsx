import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./App.css";
import MainRoute from "./route/MainRoute";
import { ConfigProvider } from "antd"; // Added Grid
import type { Usertbl } from "./@types/Usertbl";
import { useState } from "react";
import { UserContext } from "./context/UserContext";
import { useResponsiveLayout } from "./hooks/useResponsiveLayout";

// CRITICAL FIX: Move QueryClient outside the component
// to prevent losing your React Query cache on re-renders.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [user, setUser] = useState<Usertbl | null>(null);
  const { isMobile } = useResponsiveLayout();
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#044989",
            borderRadius: 8,
            fontFamily:
              "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
            colorInfo: "#1677ff",
          },
          components: {
            Table: {
              borderColor: "#C0C0C0",
              headerBg: "#E5E4E2",
              headerColor: "#1f1f1f",
              headerBorderRadius: 8,
            },
            Button: {
              colorPrimary: "#044989",
              colorPrimaryHover: "#0650b7",
              controlHeightLG: 45,
            },
            Card: {
              paddingLG: isMobile ? 2 : 24,
              boxShadow: isMobile
                ? "0 2px 6px rgba(0,0,0,0.05)"
                : "0 4px 12px rgba(0,0,0,0.08)",
            },
          },
        }}
      >
        <UserContext.Provider value={{ user, setUser }}>
          <MainRoute />
        </UserContext.Provider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

export default App;
