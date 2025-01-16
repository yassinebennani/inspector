import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "./button";
import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";

describe("Button", () => {
  it("renders children correctly", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("handles click events", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText("Click me"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies different variants correctly", () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    expect(screen.getByText("Default")).toHaveClass("bg-primary");

    rerender(<Button variant="outline">Outline</Button>);
    expect(screen.getByText("Outline")).toHaveClass("border-input");

    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByText("Secondary")).toHaveClass("bg-secondary");
  });

  it("applies different sizes correctly", () => {
    const { rerender } = render(<Button size="default">Default</Button>);
    expect(screen.getByText("Default")).toHaveClass("h-9");

    rerender(<Button size="sm">Small</Button>);
    expect(screen.getByText("Small")).toHaveClass("h-8");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByText("Large")).toHaveClass("h-10");
  });

  it("forwards ref correctly", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Button with ref</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("renders as a different element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="#">Link Button</a>
      </Button>,
    );
    expect(screen.getByText("Link Button").tagName).toBe("A");
  });
});
