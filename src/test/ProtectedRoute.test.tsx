import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const renderWithRouter = (initialRoute = "/dashboard") =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ProtectedRoute>
        <div data-testid="protected-content">Conteúdo protegido</div>
      </ProtectedRoute>
    </MemoryRouter>
  );

describe("ProtectedRoute", () => {
  it("shows loader while loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      isApproved: null,
      signOut: vi.fn(),
    });
    const { container } = renderWithRouter();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to /auth", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      isApproved: null,
      signOut: vi.fn(),
    });
    renderWithRouter();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("blocks unapproved users with pending message", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "test@test.com" },
      loading: false,
      isApproved: false,
      signOut: vi.fn(),
    });
    renderWithRouter();
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
    renderWithRouter();
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("allows unapproved users on /admin route", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "admin@test.com" },
      loading: false,
      isApproved: false,
      signOut: vi.fn(),
    });
    renderWithRouter("/admin");
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
    renderWithRouter();
    const btn = screen.getByRole("button", { name: /sair/i });
    expect(btn).toBeInTheDocument();
    btn.click();
    expect(signOutMock).toHaveBeenCalled();
  });
});
