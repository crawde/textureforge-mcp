#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.TEXTUREFORGE_API_URL || "https://textureforge.art";
const API_KEY = process.env.TEXTUREFORGE_API_KEY || "";

const headers = (extra?: Record<string, string>) => ({
  "Content-Type": "application/json",
  ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  ...extra,
});

const server = new McpServer({
  name: "textureforge",
  version: "0.1.0",
});

server.tool(
  "generate_texture",
  "Generate a seamless, tileable texture from a natural language description. Returns a high-quality albedo texture image ready for 3D use.",
  {
    prompt: z.string().describe("Description of the texture material, e.g. 'weathered red brick wall', 'polished marble with gold veins', 'mossy forest floor'"),
    model: z.enum(["flux", "sdxl", "sd3"]).optional().describe("AI model to use. flux = fastest/best quality, sdxl = good detail, sd3 = experimental. Default: flux"),
  },
  async ({ prompt, model }) => {
    const fullPrompt = `seamless ${prompt} texture, tileable, high resolution, photorealistic, PBR ready`;

    const res = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ prompt: fullPrompt, model }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }));
      const errMsg = error.error || res.statusText;

      if (res.status === 402 || errMsg.includes("limit")) {
        return {
          content: [{
            type: "text",
            text: `Free texture limit reached (3/day). Upgrade to Pro ($7.99/mo) at https://textureforge.art/pricing\n\nSetup: Add TEXTUREFORGE_API_KEY to your MCP config env vars.`,
          }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Error: ${errMsg}` }],
        isError: true,
      };
    }

    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    return {
      content: [
        {
          type: "image",
          data: base64,
          mimeType: "image/jpeg",
        },
        {
          type: "text",
          text: `Seamless texture generated for: "${prompt}"\nModel: ${model || "flux"}\n\nUse generate_pbr_maps to derive normal, roughness, height, and AO maps from this texture.`,
        },
      ],
    };
  }
);

server.tool(
  "generate_pbr_maps",
  "Generate a full PBR map suite (normal, roughness, height, ambient occlusion) from an albedo texture. Pro feature.",
  {
    image: z.string().describe("Base64-encoded albedo texture image to derive PBR maps from"),
  },
  async ({ image }) => {
    const res = await fetch(`${API_BASE}/api/pbr-maps`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ image }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }));
      const errMsg = error.error || res.statusText;

      if (res.status === 402 || errMsg.includes("Pro")) {
        return {
          content: [{
            type: "text",
            text: `PBR map generation requires Pro ($7.99/mo). Upgrade at https://textureforge.art/pricing`,
          }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Error: ${errMsg}` }],
        isError: true,
      };
    }

    const data = await res.json();

    const content: Array<{type: "image"; data: string; mimeType: string} | {type: "text"; text: string}> = [];

    if (data.normal) {
      content.push({ type: "image", data: data.normal, mimeType: "image/png" });
      content.push({ type: "text", text: "Normal Map" });
    }
    if (data.roughness) {
      content.push({ type: "image", data: data.roughness, mimeType: "image/png" });
      content.push({ type: "text", text: "Roughness Map" });
    }
    if (data.height) {
      content.push({ type: "image", data: data.height, mimeType: "image/png" });
      content.push({ type: "text", text: "Height Map" });
    }
    if (data.ao) {
      content.push({ type: "image", data: data.ao, mimeType: "image/png" });
      content.push({ type: "text", text: "Ambient Occlusion Map" });
    }

    content.push({
      type: "text",
      text: `PBR map suite generated: ${[data.normal && "Normal", data.roughness && "Roughness", data.height && "Height", data.ao && "AO"].filter(Boolean).join(", ")}`,
    });

    return { content };
  }
);

server.tool(
  "browse_gallery",
  "Browse the public texture gallery to find existing textures by material type.",
  {
    material: z.string().optional().describe("Filter by material type, e.g. 'brick', 'wood', 'marble', 'metal'"),
    limit: z.number().optional().describe("Number of results to return. Default: 12"),
    offset: z.number().optional().describe("Pagination offset. Default: 0"),
  },
  async ({ material, limit, offset }) => {
    const params = new URLSearchParams();
    if (material) params.set("material", material);
    if (limit) params.set("limit", String(limit));
    if (offset) params.set("offset", String(offset));

    const res = await fetch(`${API_BASE}/api/gallery?${params}`, {
      headers: headers(),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }));
      return {
        content: [{ type: "text", text: `Error: ${error.error || res.statusText}` }],
        isError: true,
      };
    }

    const data = await res.json();
    const items = data.items || data;

    if (!items.length) {
      return {
        content: [{ type: "text", text: `No textures found${material ? ` for "${material}"` : ""}. Try a different material or generate a new texture.` }],
      };
    }

    const listing = items.map((item: any, i: number) =>
      `${i + 1}. **${item.prompt || item.material || "Untitled"}** — ${item.model || "flux"}`
    ).join("\n");

    return {
      content: [{
        type: "text",
        text: `Texture Gallery${material ? ` — "${material}"` : ""} (${items.length} results):\n\n${listing}`,
      }],
    };
  }
);

server.tool(
  "list_models",
  "List available AI models for texture generation with descriptions.",
  {},
  async () => {
    const models = [
      { key: "flux", desc: "FLUX.1-schnell — Fastest, best overall quality. Recommended for most textures." },
      { key: "sdxl", desc: "Stable Diffusion XL — Great detail and texture fidelity. Good for photorealistic materials." },
      { key: "sd3", desc: "Stable Diffusion 3 — Experimental. Can produce unique artistic textures." },
    ];

    return {
      content: [{
        type: "text",
        text: models.map((m) => `**${m.key}**: ${m.desc}`).join("\n"),
      }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
