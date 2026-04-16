# TextureForge MCP Server

Generate seamless PBR textures with AI through any MCP-compatible AI assistant.

## What is TextureForge?

[TextureForge](https://textureforge.art) generates publication-quality seamless textures for 3D art, game development, and architectural visualization. Describe any material in natural language and get a tileable albedo texture plus a full PBR map suite (normal, roughness, height, AO).

## Tools

| Tool | Description |
|------|-------------|
| `generate_texture` | Generate a seamless albedo texture from a description |
| `generate_pbr_maps` | Derive normal, roughness, height, AO maps from albedo (Pro) |
| `browse_gallery` | Browse public texture gallery by material type |
| `list_models` | List available AI generation models |

## Quick Start

```bash
npx textureforge-mcp
```

### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "textureforge": {
      "command": "npx",
      "args": ["-y", "textureforge-mcp"],
      "env": {
        "TEXTUREFORGE_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Usage Examples

- "Generate a weathered red brick wall texture"
- "Create a polished marble texture with gold veins"
- "Generate PBR maps for this wood floor texture"
- "Browse the gallery for metal textures"

## Free Tier

- 3 texture generations per day
- Gallery browsing unlimited
- PBR maps require Pro ($7.99/mo) at [textureforge.art/pricing](https://textureforge.art/pricing)

## License

MIT
