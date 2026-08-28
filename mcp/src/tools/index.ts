/**
 * Registro central de tools. Agregar una tool = un archivo + una línea aquí.
 * No es un barril (no reexporta un módulo entero): es el punto único donde el
 * servidor aprende qué sabe hacer.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { askAssistantTool } from "./ask-assistant";
import { compareProductsTool } from "./compare-products";
import { findRelatedProductsTool } from "./find-related-products";
import { getOrderStatusTool } from "./get-order-status";
import { getProductTool } from "./get-product";
import { getStoreStatsTool } from "./get-store-stats";
import { listCategoriesTool } from "./list-categories";
import { searchProductsTool } from "./search-products";
import { semanticSearchProductsTool } from "./semantic-search-products";
import { summarizeReviewsTool } from "./summarize-reviews";

const TOOLS = [
  searchProductsTool,
  getProductTool,
  listCategoriesTool,
  semanticSearchProductsTool,
  askAssistantTool,
  compareProductsTool,
  findRelatedProductsTool,
  summarizeReviewsTool,
  getStoreStatsTool,
  getOrderStatusTool,
];

export function registerTools(server: McpServer): number {
  for (const tool of TOOLS) {
    // El SDK tipa el handler contra el inputSchema concreto de cada tool; el
    // arreglo las mezcla y ese enlace se pierde. La forma real la garantizan
    // los tipos del handler de cada archivo, ya verificados por tsc.
    server.registerTool(tool.name, tool.config, tool.handler as never);
  }
  return TOOLS.length;
}
