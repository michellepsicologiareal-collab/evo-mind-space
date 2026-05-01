import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock lucide-react to avoid import issues
vi.mock("lucide-react", () => ({
  Loader2: (props: any) => <div data-testid="loader" {...props} />,
  Clock: (props: any) => <div {...props} />,
}));

const renderProtected = (initialRoute = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/auth" element={<div data-testid="auth-page">Auth</div>} />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <div data-testid="protected-content">Conteúdo protegido</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe("ProtectedRoute", () => {
  it("shows loader while loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, isApproved: null, signOut: vi.fn() });
    renderProtected();
    expect(screen.getByTestId("loader")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to /auth", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, isApproved: null, signOut: vi.fn() });
    renderProtected();
    expect(screen.getByTestId("auth-page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("blocks unapproved users with pending message", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "test@test.com" },
      loading: false,
      isApproved: false,
      signOut: vi.fn(),
    });
    renderProtected();
    expect(screen.getByText(/pendente de aprovação/i)).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("allows approved users to see protected content", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "test@test.com" },
      loading: false,
      isApproved: true,
      signOut: vi.fn(),
    });
    renderProtected();
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("allows users on /admin route even if not approved", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "admin@test.com" },
      loading: false,
      isApproved: false,
      signOut: vi.fn(),
    });
    renderProtected("/admin");
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("shows sign-out button for unapproved users", () => {
    const signOutMock = vi.fn();
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "test@test.com" },
      loading: false,
      isApproved: false,
      signOut: signOutMock,
    });
    renderProtected();
    const btn = screen.getByRole("button", { name: /sair/i });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(signOutMock).toHaveBeenCalled();
  });
});
