# Supermemory self-hosted server — custom image.
#
# Supermemory ships a single self-contained server binary (glibc) and has no
# official Docker image, so we package the binary ourselves.
# Docs: https://supermemory.ai/docs/self-hosting/overview
#
# Configuration is injected via env vars at runtime (see
# local/supermemory/.env.example):
#   - LLM for extraction: OPENAI_BASE_URL / OPENAI_API_KEY / OPENAI_MODEL
#     (any OpenAI-compatible endpoint; Lumen points it at GeneralCompute)
#   - Custom embedder: SUPERMEMORY_EMBEDDING_PROVIDER=gemini +
#     SUPERMEMORY_EMBEDDING_MODEL / SUPERMEMORY_EMBEDDING_DIMENSIONS /
#     GEMINI_API_KEY
#   - Persistence: SUPERMEMORY_DATA_DIR (default /data, mounted as a volume)
#
# The API key is generated on first boot and printed to stdout:
#   docker logs <container> | grep "api key"
# Copy it (sm_...) into apps/workers/.env as SUPERMEMORY_API_KEY.

# --- download stage --------------------------------------------------------
FROM debian:bookworm-slim AS download

ARG SUPERMEMORY_VERSION=server-v0.0.8
ARG TARGETARCH=amd64

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  mkdir -p /out; \
  case "${TARGETARCH}" in \
    amd64) arch="x64" ;; \
    arm64) arch="arm64" ;; \
    *) echo "unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
  esac; \
  release_url="https://github.com/supermemoryai/supermemory/releases/download/${SUPERMEMORY_VERSION}"; \
  curl -fsSL "${release_url}/supermemory-server-linux-${arch}" -o /out/supermemory-server; \
  curl -fsSL "${release_url}/manifest.json" -o /out/manifest.json; \
  expected="$(sed -n '/"linux-'"${arch}"'"/s/.*"checksum": "\([0-9a-f]\{64\}\)".*/\1/p' /out/manifest.json | head -1)"; \
  [ -n "${expected}" ] || { echo "could not resolve checksum for linux-${arch}" >&2; exit 1; }; \
  actual="$(sha256sum /out/supermemory-server | awk '{print $1}')"; \
  [ "${actual}" = "${expected}" ] || { echo "checksum mismatch: ${actual} != ${expected}" >&2; exit 1; }; \
  chmod +x /out/supermemory-server

# --- runtime stage ---------------------------------------------------------
FROM debian:bookworm-slim

# curl is only used for the healthcheck
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=download /out/supermemory-server /usr/local/bin/supermemory-server

ENV SUPERMEMORY_DATA_DIR=/data \
    PORT=6767

# Run as an unprivileged user — the graph engine's data lives in /data
RUN useradd --create-home --uid 10001 supermemory \
  && mkdir -p /data \
  && chown -R supermemory:supermemory /data \
  && chmod -R u+rwX,go-rwx /data

# Graph engine data, auth secret, embedding model cache
VOLUME ["/data"]

USER supermemory

EXPOSE 6767

# Same semantics as `supermemory local status`: any HTTP response (including
# 401/404) means the server is up; only connection failures fail the check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -sS -o /dev/null http://127.0.0.1:6767/ || exit 1

CMD ["supermemory-server"]
