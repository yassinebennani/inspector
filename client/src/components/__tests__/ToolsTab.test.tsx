import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, jest } from "@jest/globals";
import "@testing-library/jest-dom";
import ToolsTab from "../ToolsTab";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Tabs } from "@/components/ui/tabs";
import * as schemaUtils from "@/utils/schemaUtils";

// Mock the schemaUtils module
// Note: hasOutputSchema checks if a tool's output schema validator has been compiled and cached
// by cacheToolOutputSchemas. In these tests, we mock it to avoid needing to call
// cacheToolOutputSchemas for every test that uses tools with output schemas.
// This keeps the tests focused on the component's behavior rather than schema compilation.
jest.mock("@/utils/schemaUtils", () => ({
  ...jest.requireActual("@/utils/schemaUtils"),
  hasOutputSchema: jest.fn(),
  validateToolOutput: jest.fn(),
}));

describe("ToolsTab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default behavior
    (schemaUtils.hasOutputSchema as jest.Mock).mockImplementation(
      (toolName) => {
        // Only tools with outputSchema property should return true
        return false;
      },
    );
    (schemaUtils.validateToolOutput as jest.Mock).mockReturnValue({
      isValid: true,
      error: null,
    });
  });

  const mockTools: Tool[] = [
    {
      name: "tool1",
      description: "First tool",
      inputSchema: {
        type: "object" as const,
        properties: {
          num: { type: "number" as const },
        },
      },
    },
    {
      name: "tool3",
      description: "Integer tool",
      inputSchema: {
        type: "object" as const,
        properties: {
          count: { type: "integer" as const },
        },
      },
    },
    {
      name: "tool2",
      description: "Second tool",
      inputSchema: {
        type: "object" as const,
        properties: {
          num: { type: "number" as const },
        },
      },
    },
  ];

  const defaultProps = {
    tools: mockTools,
    listTools: jest.fn(),
    clearTools: jest.fn(),
    callTool: jest.fn(async () => {}),
    selectedTool: null,
    setSelectedTool: jest.fn(),
    toolResult: null,
    nextCursor: "",
    error: null,
  };

  const renderToolsTab = (props = {}) => {
    return render(
      <Tabs defaultValue="tools">
        <ToolsTab {...defaultProps} {...props} />
      </Tabs>,
    );
  };

  it("should reset input values when switching tools", async () => {
    const { rerender } = renderToolsTab({
      selectedTool: mockTools[0],
    });

    // Enter a value in the first tool's input
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "42" } });
    });
    expect(input.value).toBe("42");

    // Switch to second tool
    rerender(
      <Tabs defaultValue="tools">
        <ToolsTab {...defaultProps} selectedTool={mockTools[2]} />
      </Tabs>,
    );

    // Verify input is reset
    const newInput = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(newInput.value).toBe("");
  });

  it("should handle integer type inputs", async () => {
    renderToolsTab({
      selectedTool: mockTools[1], // Use the tool with integer type
    });

    const input = screen.getByRole("spinbutton", {
      name: /count/i,
    }) as HTMLInputElement;
    expect(input).toHaveProperty("type", "number");
    fireEvent.change(input, { target: { value: "42" } });
    expect(input.value).toBe("42");

    const submitButton = screen.getByRole("button", { name: /run tool/i });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(defaultProps.callTool).toHaveBeenCalledWith(mockTools[1].name, {
      count: 42,
    });
  });

  it("should disable button and change text while tool is running", async () => {
    // Create a promise that we can resolve later
    let resolvePromise: ((value: unknown) => void) | undefined;
    const mockPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    // Mock callTool to return our promise
    const mockCallTool = jest.fn().mockReturnValue(mockPromise);

    renderToolsTab({
      selectedTool: mockTools[0],
      callTool: mockCallTool,
    });

    const submitButton = screen.getByRole("button", { name: /run tool/i });
    expect(submitButton.getAttribute("disabled")).toBeNull();

    // Click the button and verify immediate state changes
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Verify button is disabled and text changed
    expect(submitButton.getAttribute("disabled")).not.toBeNull();
    expect(submitButton.textContent).toBe("Running...");

    // Resolve the promise to simulate tool completion
    await act(async () => {
      if (resolvePromise) {
        await resolvePromise({});
      }
    });

    expect(submitButton.getAttribute("disabled")).toBeNull();
  });

  describe("Output Schema Display", () => {
    const toolWithOutputSchema: Tool = {
      name: "weatherTool",
      description: "Get weather",
      inputSchema: {
        type: "object" as const,
        properties: {
          city: { type: "string" as const },
        },
      },
      outputSchema: {
        type: "object" as const,
        properties: {
          temperature: { type: "number" as const },
          humidity: { type: "number" as const },
        },
        required: ["temperature", "humidity"],
      },
    };

    it("should display output schema when tool has one", () => {
      renderToolsTab({
        tools: [toolWithOutputSchema],
        selectedTool: toolWithOutputSchema,
      });

      expect(screen.getByText("Output Schema:")).toBeInTheDocument();
      // Check for expand/collapse button
      expect(
        screen.getByRole("button", { name: /expand/i }),
      ).toBeInTheDocument();
    });

    it("should not display output schema section when tool doesn't have one", () => {
      renderToolsTab({
        selectedTool: mockTools[0], // Tool without outputSchema
      });

      expect(screen.queryByText("Output Schema:")).not.toBeInTheDocument();
    });

    it("should toggle output schema expansion", () => {
      renderToolsTab({
        tools: [toolWithOutputSchema],
        selectedTool: toolWithOutputSchema,
      });

      const toggleButton = screen.getByRole("button", { name: /expand/i });

      // Click to expand
      fireEvent.click(toggleButton);
      expect(
        screen.getByRole("button", { name: /collapse/i }),
      ).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(toggleButton);
      expect(
        screen.getByRole("button", { name: /expand/i }),
      ).toBeInTheDocument();
    });
  });

  describe("Structured Output Results", () => {
    const toolWithOutputSchema: Tool = {
      name: "weatherTool",
      description: "Get weather",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
      outputSchema: {
        type: "object" as const,
        properties: {
          temperature: { type: "number" as const },
        },
        required: ["temperature"],
      },
    };

    it("should display structured content when present", () => {
      // Mock hasOutputSchema to return true for this tool
      (schemaUtils.hasOutputSchema as jest.Mock).mockReturnValue(true);

      const structuredResult = {
        content: [],
        structuredContent: {
          temperature: 25,
        },
      };

      renderToolsTab({
        selectedTool: toolWithOutputSchema,
        toolResult: structuredResult,
      });

      expect(screen.getByText("Structured Content:")).toBeInTheDocument();
      expect(
        screen.getByText(/Valid according to output schema/),
      ).toBeInTheDocument();
    });

    it("should show validation error for invalid structured content", () => {
      // Mock hasOutputSchema to return true for this tool
      (schemaUtils.hasOutputSchema as jest.Mock).mockReturnValue(true);
      // Mock the validation to fail
      (schemaUtils.validateToolOutput as jest.Mock).mockReturnValue({
        isValid: false,
        error: "temperature must be number",
      });

      const invalidResult = {
        content: [],
        structuredContent: {
          temperature: "25", // String instead of number
        },
      };

      renderToolsTab({
        selectedTool: toolWithOutputSchema,
        toolResult: invalidResult,
      });

      expect(screen.getByText(/Validation Error:/)).toBeInTheDocument();
    });

    it("should show error when tool with output schema doesn't return structured content", () => {
      // Mock hasOutputSchema to return true for this tool
      (schemaUtils.hasOutputSchema as jest.Mock).mockReturnValue(true);

      const resultWithoutStructured = {
        content: [{ type: "text", text: "some result" }],
        // No structuredContent
      };

      renderToolsTab({
        selectedTool: toolWithOutputSchema,
        toolResult: resultWithoutStructured,
      });

      expect(
        screen.getByText(
          /Tool has an output schema but did not return structured content/,
        ),
      ).toBeInTheDocument();
    });

    it("should show unstructured content title when both structured and unstructured exist", () => {
      // Mock hasOutputSchema to return true for this tool
      (schemaUtils.hasOutputSchema as jest.Mock).mockReturnValue(true);

      const resultWithBoth = {
        content: [{ type: "text", text: '{"temperature": 25}' }],
        structuredContent: { temperature: 25 },
      };

      renderToolsTab({
        selectedTool: toolWithOutputSchema,
        toolResult: resultWithBoth,
      });

      expect(screen.getByText("Structured Content:")).toBeInTheDocument();
      expect(screen.getByText("Unstructured Content:")).toBeInTheDocument();
    });

    it("should not show unstructured content title when only unstructured exists", () => {
      const resultWithUnstructuredOnly = {
        content: [{ type: "text", text: "some result" }],
      };

      renderToolsTab({
        selectedTool: mockTools[0], // Tool without output schema
        toolResult: resultWithUnstructuredOnly,
      });

      expect(
        screen.queryByText("Unstructured Content:"),
      ).not.toBeInTheDocument();
    });

    it("should show compatibility check when tool has output schema", () => {
      // Mock hasOutputSchema to return true for this tool
      (schemaUtils.hasOutputSchema as jest.Mock).mockReturnValue(true);

      const compatibleResult = {
        content: [{ type: "text", text: '{"temperature": 25}' }],
        structuredContent: { temperature: 25 },
      };

      renderToolsTab({
        selectedTool: toolWithOutputSchema,
        toolResult: compatibleResult,
      });

      // Should show compatibility result
      expect(
        screen.getByText(
          /matches structured content|not a single text block|not valid JSON|does not match/,
        ),
      ).toBeInTheDocument();
    });

    it("should not show compatibility check when tool has no output schema", () => {
      const resultWithBoth = {
        content: [{ type: "text", text: '{"data": "value"}' }],
        structuredContent: { different: "data" },
      };

      renderToolsTab({
        selectedTool: mockTools[0], // Tool without output schema
        toolResult: resultWithBoth,
      });

      // Should not show any compatibility messages
      expect(
        screen.queryByText(
          /matches structured content|not a single text block|not valid JSON|does not match/,
        ),
      ).not.toBeInTheDocument();
    });
  });
});
