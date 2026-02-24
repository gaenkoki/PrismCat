# 🐱 PrismCat

[English](./README.md) | [简体中文](./README_CN.md)

![GitHub Release](https://img.shields.io/github/v/release/paopaoandlingyia/PrismCat) ![License](https://img.shields.io/github/license/paopaoandlingyia/PrismCat) ![Docker Image](https://img.shields.io/badge/image-ghcr.io%2Fpaopaoandlingyia%2Fprismcat-blue)

**PrismCat** is a lightweight, local-first **LLM API Transparent Proxy & Traffic Observability Tool** designed for developers.

Stop guessing what's happening behind your LLM SDKs. PrismCat lets you observe every byte sent to upstream providers, supports full streaming (SSE) logging, and provides a Postman-like **Replay** feature—usually with only a `base_url` change.

---

## ✨ Key Features

- 🚀 **Transparent Reverse Proxy**: Route-by-Subdomain (e.g., `openai.localhost`). Just change your `baseURL` and keep your SDKs as-is.
- 📊 **Full Traffic Observability**:
    - Complete request/response logging with pretty-printing for JSON and Text.
    - **SSE/Streaming Support**: Real-time logging of streaming responses without adding latency.
    - **Smart Base64 Folding**: Automatically collapses huge image Base64 strings in the UI to keep your logs clean.
- 🏷️ **Log Tagging**: Simply add `X-PrismCat-Tag: your-tag` to your client request headers to categorize logs. Perfect for differentiating sessions or users in a shared environment.
- 🎮 **Developer Toolbox**: Built-in **Playground** for replaying requests, real-time stats dashboard, and full i18n support.
- 🔐 **Privacy & Security**:
    - Local-first storage using **SQLite**. No third-party servers involved.
    - Automatic sensitive header masking (`Authorization`, `api-key`).
- 📦 **High Performance**: Single-binary deployment with asynchronous log writing and automatic log retention/cleanup.

---

## 🎯 When PrismCat Helps

- Debug **hidden system prompts**, request mutations, or unexpected gateway behaviour.
- Inspect **streaming (SSE)** responses in real time (and keep them for later).
- Reproduce bugs faster with **Replay** (tweak params/prompt and resend from the UI).
- Tag traffic with `X-PrismCat-Tag` to separate sessions/projects in a shared proxy.

---

## 🤔 PrismCat vs. Alternatives

- **mitmproxy / browser DevTools**: powerful but low-level; streaming + long-term log browsing/replay is painful.
- **Langfuse / Helicone / etc.**: great for production observability, but often needs SDK instrumentation or a hosted backend.
- **PrismCat**: local-first, transparent proxy, single-binary, and optimized specifically for LLM API traffic.

---

## 🛠️ Quick Start

### 1. Run Binary (Recommended)
Download the pre-compiled binary for your system from [Releases](https://github.com/paopaoandlingyia/PrismCat/releases).
- **Windows**: Run `prismcat.exe`. It will stay in your system tray. Right-click to open the dashboard.
- **Linux/macOS**: Run `./prismcat` in your terminal.

Open the dashboard at `http://localhost:8080`.

### 2. Run with Docker
```yaml
services:
  prismcat:
    image: ghcr.io/paopaoandlingyia/prismcat:latest
    container_name: prismcat
    ports:
      - "8080:8080"
    environment:
      - PRISMCAT_UI_HOSTS=localhost,127.0.0.1
      - PRISMCAT_PROXY_DOMAINS=localhost,example.com
      - PRISMCAT_UI_PASSWORD=your_strong_password
      - PRISMCAT_RETENTION_DAYS=7
    volumes:
      - ./data:/app/data
    restart: always
```

---

## 🏗️ How it Works: Subdomain Routing

PrismCat uses **Subdomain Routing** to ensure maximum compatibility with any SDK.

**Example Scenario:**
Assume your upstream is named `openai` and your proxy domain is `localhost`:

Simply modify your `base_url` in your code:
```python
# OpenAI Python SDK Example
client = OpenAI(
    base_url="http://openai.localhost:8080/v1", # Pointing to PrismCat
    api_key="sk-..."
)
```

---

## ⚙️ Configure Upstreams

The config file lives at `data/config.yaml` (created on first start). PrismCat routes by **subdomain**, so you define upstreams like:

```yaml
upstreams:
  openai:
    target: "https://api.openai.com"
    timeout: 120

  gemini:
    target: "https://generativelanguage.googleapis.com"
    timeout: 120
```

With the config above, requests to `openai.localhost` will be forwarded to `https://api.openai.com`.

---

## 🌐 Production Deployment (Nginx)

For public-facing deployments, we recommend using a wildcard domain (e.g., `*.prismcat.example.com`) with an Nginx reverse proxy:

```nginx
server {
    listen 80;
    server_name prismcat.example.com *.prismcat.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host; # Required: pass original Host for PrismCat routing
        
        # SSE / Streaming optimization
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        
        client_max_body_size 50M;
    }
}
```

> **Note:** `proxy_buffering off` and `proxy_http_version 1.1` are critical for responsive streaming and fast UI loading. Without them, Nginx may buffer entire responses before forwarding, causing noticeable latency in the dashboard.

---

## 🧩 Troubleshooting

- If `openai.localhost` doesn't resolve on your system, add it to your hosts file or use your own wildcard domain (see the Nginx section).
- If streaming feels "stuck" behind a reverse proxy, ensure `proxy_buffering off` and `proxy_http_version 1.1` are set.
- If you want to see request bodies before the upstream responds, keep `logging.early_request_body_snapshot` enabled (default). Disabling it may improve throughput, but request bodies will only appear after a request completes.

---

## 🛡️ License

[MIT License](LICENSE)
