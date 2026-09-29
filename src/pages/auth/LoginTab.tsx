import { Button, Form, Input, message, Typography } from "antd";
import { MailOutlined, LockOutlined, LoginOutlined } from "@ant-design/icons";
import { useState } from "react";
import authService from "../../services/authService";
import type { Login } from "../../@types/nonTable/Login";
import { useAuth } from "../../context/UserContext";
import { useNavigate } from "react-router-dom";
import ForgotPasswordModal from "./ForgotPassword";

const { Title, Text } = Typography;

export default function LoginTab() {
  // Login Form States
  const [loading, setLoading] = useState<boolean>(false);
  const [form] = Form.useForm();
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // Forgot Password Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Login handler
  const onFinishLogin = async (values: Login) => {
    try {
      setLoading(true);
      const { user, token } = await authService.login(values);

      setUser(user);
      localStorage.setItem("jwt_token", token ?? "");
      localStorage.setItem("user", JSON.stringify(user) ?? "");
      navigate(user?.role?.indexPath ?? "/");
      form.resetFields();
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        "Invalid credentials. Please try again.";
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* --- Header Section --- */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center bg-blue-50 text-blue-600 rounded-2xl mb-4 p-3">
          <LoginOutlined style={{ fontSize: "32px" }} />
        </div>
        <Title level={2} style={{ marginBottom: 8 }}>
          Welcome Back
        </Title>
        <Text type="secondary">
          Enter your credentials to access your account
        </Text>
      </div>

      <Form<Login>
        form={form}
        name="login"
        onFinish={onFinishLogin}
        layout="vertical"
        size="large"
        requiredMark={false}
      >
        <Form.Item
          name="usernameOrEmail"
          label={
            <Text strong className="text-gray-600">
              Username or Email
            </Text>
          }
          rules={[
            {
              required: true,
              message: "Please enter your username or email address",
            },
          ]}
        >
          <Input
            prefix={<MailOutlined className="text-gray-400" />}
            placeholder="e.g. john.doe@company.com"
            className="rounded-lg h-12"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label={
            <div className="flex justify-between w-full items-center">
              <Text strong className="text-gray-600">
                Password
              </Text>
            </div>
          }
          rules={[{ required: true, message: "Password required" }]}
          className="mb-6"
        >
          <Input.Password
            prefix={<LockOutlined className="text-gray-400" />}
            placeholder="••••••••"
            className="rounded-lg h-12"
          />
        </Form.Item>
        <a
          onClick={(e) => {
            e.preventDefault();
            setIsModalOpen(true); // Opens local modal directly
          }}
          className="text-xs font-semibold text-blue-500 hover:text-blue-600 select-none transition-colors cursor-pointer"
        >
          Forgot Password?
        </a>
        <Form.Item className="mt-8">
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            className="h-12 bg-blue-600 hover:bg-blue-700 rounded-lg text-lg font-semibold border-none shadow-md"
          >
            Sign In
          </Button>
        </Form.Item>
      </Form>

      <div className="text-center">
        <Text type="secondary" className="text-xs">
          Secure Login System &copy; {new Date().getFullYear()}
        </Text>
      </div>

      {/* ========================================================================= */}
      {/* LOCAL FORGOT PASSWORD MODAL CONTAINER                                    */}
      {/* ========================================================================= */}
      <ForgotPasswordModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
