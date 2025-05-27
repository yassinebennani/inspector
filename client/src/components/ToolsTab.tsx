import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import DynamicJsonForm from "./DynamicJsonForm";
import type { JsonValue, JsonSchemaType } from "@/utils/jsonUtils";
import { generateDefaultValue, validateToolOutput, hasOutputSchema } from "@/utils/schemaUtils";
import {
  CallToolResultSchema,
  CompatibilityCallToolResult,
  ListToolsResult,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Loader2, Send, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import ListPane from "./ListPane";
import JsonView from "./JsonView";

const ToolsTab = ({
  tools,
  listTools,
  clearTools,
  callTool,
  selectedTool,
  setSelectedTool,
  toolResult,
  nextCursor,
}: {
  tools: Tool[];
  listTools: () => void;
  clearTools: () => void;
  callTool: (name: string, params: Record<string, unknown>) => Promise<void>;
  selectedTool: Tool | null;
  setSelectedTool: (tool: Tool | null) => void;
  toolResult: CompatibilityCallToolResult | null;
  nextCursor: ListToolsResult["nextCursor"];
  error: string | null;
}) => {
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [isToolRunning, setIsToolRunning] = useState(false);
  const [isOutputSchemaExpanded, setIsOutputSchemaExpanded] = useState(false);

  useEffect(() => {
    const params = Object.entries(
      selectedTool?.inputSchema.properties ?? [],
    ).map(([key, value]) => [
      key,
      generateDefaultValue(value as JsonSchemaType),
    ]);
    setParams(Object.fromEntries(params));
  }, [selectedTool]);

  // Check compatibility between structured and unstructured content
  const checkContentCompatibility = (
    structuredContent: unknown,
    unstructuredContent: Array<{ type: string; text?: string; [key: string]: unknown }>
  ): { isCompatible: boolean; message: string } => {
    // Check if unstructured content is a single text block
    if (unstructuredContent.length !== 1 || unstructuredContent[0].type !== "text") {
      return {
        isCompatible: false,
        message: "Unstructured content is not a single text block"
      };
    }

    const textContent = unstructuredContent[0].text;
    if (!textContent) {
      return {
        isCompatible: false,
        message: "Text content is empty"
      };
    }

    try {
      // Try to parse the text as JSON
      const parsedContent = JSON.parse(textContent);
      
      // Deep equality check
      const isEqual = JSON.stringify(parsedContent) === JSON.stringify(structuredContent);
      
      if (isEqual) {
        return {
          isCompatible: true,
          message: "Unstructured content matches structured content"
        };
      } else {
        return {
          isCompatible: false,
          message: "Parsed JSON does not match structured content"
        };
      }
    } catch (e) {
      return {
        isCompatible: false,
        message: "Unstructured content is not valid JSON"
      };
    }
  };

  const renderToolResult = () => {
    if (!toolResult) return null;

    if ("content" in toolResult) {
      const parsedResult = CallToolResultSchema.safeParse(toolResult);
      if (!parsedResult.success) {
        return (
          <>
            <h4 className="font-semibold mb-2">Invalid Tool Result:</h4>
            <JsonView data={toolResult} />
            <h4 className="font-semibold mb-2">Errors:</h4>
            {parsedResult.error.errors.map((error, idx) => (
              <JsonView data={error} key={idx} />
            ))}
          </>
        );
      }
      const structuredResult = parsedResult.data;
      const isError = structuredResult.isError ?? false;

      // Validate structured content if present and tool has output schema
      let validationResult = null;
      const toolHasOutputSchema = selectedTool && hasOutputSchema(selectedTool.name);
      
      if (toolHasOutputSchema) {
        if (!structuredResult.structuredContent && !isError) {
          // Tool has output schema but didn't return structured content (and it's not an error)
          validationResult = {
            isValid: false,
            error: "Tool has an output schema but did not return structured content"
          };
        } else if (structuredResult.structuredContent) {
          // Validate the structured content
          validationResult = validateToolOutput(selectedTool.name, structuredResult.structuredContent);
        }
      }

      // Check compatibility if both structured and unstructured content exist
      // AND the tool has an output schema
      let compatibilityResult = null;
      if (structuredResult.structuredContent && 
          structuredResult.content.length > 0 && 
          selectedTool && 
          hasOutputSchema(selectedTool.name)) {
        compatibilityResult = checkContentCompatibility(
          structuredResult.structuredContent,
          structuredResult.content
        );
      }

      return (
        <>
          <h4 className="font-semibold mb-2">
            Tool Result:{" "}
            {isError ? (
              <span className="text-red-600 font-semibold">Error</span>
            ) : (
              <span className="text-green-600 font-semibold">Success</span>
            )}
          </h4>
          {structuredResult.structuredContent && (
            <div className="mb-4">
              <h5 className="font-semibold mb-2 text-sm">Structured Content:</h5>
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                <JsonView data={structuredResult.structuredContent} />
                {validationResult && (
                  <div className={`mt-2 p-2 rounded text-sm ${
                    validationResult.isValid 
                      ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" 
                      : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                  }`}>
                    {validationResult.isValid ? (
                      "✓ Valid according to output schema"
                    ) : (
                      <>
                        ✗ Validation Error: {validationResult.error}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {!structuredResult.structuredContent && validationResult && !validationResult.isValid && (
            <div className="mb-4">
              <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-2 rounded text-sm">
                ✗ Validation Error: {validationResult.error}
              </div>
            </div>
          )}
          {structuredResult.content.length > 0 && (
            <div className="mb-4">
              {structuredResult.structuredContent && (
                <>
                  <h5 className="font-semibold mb-2 text-sm">Unstructured Content:</h5>
                  {compatibilityResult && (
                    <div className={`mb-2 p-2 rounded text-sm ${
                      compatibilityResult.isCompatible 
                        ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200" 
                        : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                    }`}>
                      {compatibilityResult.isCompatible ? "✓" : "⚠"} {compatibilityResult.message}
                    </div>
                  )}
                </>
              )}
              {structuredResult.content.map((item, index) => (
                <div key={index} className="mb-2">
                  {item.type === "text" && (
                    <JsonView data={item.text} isError={isError} />
                  )}
              {item.type === "image" && (
                <img
                  src={`data:${item.mimeType};base64,${item.data}`}
                  alt="Tool result image"
                  className="max-w-full h-auto"
                />
              )}
              {item.type === "resource" &&
                (item.resource?.mimeType?.startsWith("audio/") ? (
                  <audio
                    controls
                    src={`data:${item.resource.mimeType};base64,${item.resource.blob}`}
                    className="w-full"
                  >
                    <p>Your browser does not support audio playback</p>
                  </audio>
                ) : (
                  <JsonView data={item.resource} />
                ))}
                </div>
              ))}
            </div>
          )}
        </>
      );
    } else if ("toolResult" in toolResult) {
      return (
        <>
          <h4 className="font-semibold mb-2">Tool Result (Legacy):</h4>

          <JsonView data={toolResult.toolResult} />
        </>
      );
    }
  };

  return (
    <TabsContent value="tools">
      <div className="grid grid-cols-2 gap-4">
        <ListPane
          items={tools}
          listItems={listTools}
          clearItems={() => {
            clearTools();
            setSelectedTool(null);
          }}
          setSelectedItem={setSelectedTool}
          renderItem={(tool) => (
            <div className="flex flex-col items-start">
              <span className="flex-1">{tool.name}</span>
              <span className="text-sm text-gray-500 text-left">
                {tool.description}
              </span>
            </div>
          )}
          title="Tools"
          buttonText={nextCursor ? "List More Tools" : "List Tools"}
          isButtonDisabled={!nextCursor && tools.length > 0}
        />

        <div className="bg-card rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="font-semibold">
              {selectedTool ? selectedTool.name : "Select a tool"}
            </h3>
          </div>
          <div className="p-4">
            {selectedTool ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  {selectedTool.description}
                </p>
                {Object.entries(selectedTool.inputSchema.properties ?? []).map(
                  ([key, value]) => {
                    const prop = value as JsonSchemaType;
                    return (
                      <div key={key}>
                        <Label
                          htmlFor={key}
                          className="block text-sm font-medium text-gray-700"
                        >
                          {key}
                        </Label>
                        {prop.type === "boolean" ? (
                          <div className="flex items-center space-x-2 mt-2">
                            <Checkbox
                              id={key}
                              name={key}
                              checked={!!params[key]}
                              onCheckedChange={(checked: boolean) =>
                                setParams({
                                  ...params,
                                  [key]: checked,
                                })
                              }
                            />
                            <label
                              htmlFor={key}
                              className="text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                              {prop.description || "Toggle this option"}
                            </label>
                          </div>
                        ) : prop.type === "string" ? (
                          <Textarea
                            id={key}
                            name={key}
                            placeholder={prop.description}
                            value={(params[key] as string) ?? ""}
                            onChange={(e) =>
                              setParams({
                                ...params,
                                [key]: e.target.value,
                              })
                            }
                            className="mt-1"
                          />
                        ) : prop.type === "object" || prop.type === "array" ? (
                          <div className="mt-1">
                            <DynamicJsonForm
                              schema={{
                                type: prop.type,
                                properties: prop.properties,
                                description: prop.description,
                                items: prop.items,
                              }}
                              value={
                                (params[key] as JsonValue) ??
                                generateDefaultValue(prop)
                              }
                              onChange={(newValue: JsonValue) => {
                                setParams({
                                  ...params,
                                  [key]: newValue,
                                });
                              }}
                            />
                          </div>
                        ) : prop.type === "number" ||
                          prop.type === "integer" ? (
                          <Input
                            type="number"
                            id={key}
                            name={key}
                            placeholder={prop.description}
                            value={(params[key] as string) ?? ""}
                            onChange={(e) =>
                              setParams({
                                ...params,
                                [key]: Number(e.target.value),
                              })
                            }
                            className="mt-1"
                          />
                        ) : (
                          <div className="mt-1">
                            <DynamicJsonForm
                              schema={{
                                type: prop.type,
                                properties: prop.properties,
                                description: prop.description,
                                items: prop.items,
                              }}
                              value={params[key] as JsonValue}
                              onChange={(newValue: JsonValue) => {
                                setParams({
                                  ...params,
                                  [key]: newValue,
                                });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  },
                )}
                {selectedTool.outputSchema && (
                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold">Output Schema:</h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsOutputSchemaExpanded(!isOutputSchemaExpanded)}
                        className="h-6 px-2"
                      >
                        {isOutputSchemaExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Collapse
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Expand
                          </>
                        )}
                      </Button>
                    </div>
                    <div className={`transition-all ${
                      isOutputSchemaExpanded ? "" : "max-h-[8rem] overflow-y-auto"
                    }`}>
                      <JsonView data={selectedTool.outputSchema} />
                    </div>
                  </div>
                )}
                <Button
                  onClick={async () => {
                    try {
                      setIsToolRunning(true);
                      await callTool(selectedTool.name, params);
                    } finally {
                      setIsToolRunning(false);
                    }
                  }}
                  disabled={isToolRunning}
                >
                  {isToolRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Run Tool
                    </>
                  )}
                </Button>
                {toolResult && renderToolResult()}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  Select a tool from the list to view its details and run it
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </TabsContent>
  );
};

export default ToolsTab;
