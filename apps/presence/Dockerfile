ARG BUILDER_IMAGE="hexpm/elixir:1.19-erlang-28.2-ubuntu-jammy-20251013"
ARG RUNNER_IMAGE="debian:bookworm-20250113-slim"
FROM ${BUILDER_IMAGE} AS builder
RUN apt-get update -y && apt-get install -y build-essential git \
    && apt-get clean && rm -f /var/lib/apt/lists/*_*
WORKDIR /app
ENV MIX_ENV=prod
RUN mix local.hex --force && \
    mix local.rebar --force
COPY mix.exs mix.lock ./
COPY config config
RUN mix deps.get --only $MIX_ENV
RUN mix deps.compile
COPY lib lib
RUN mix compile
RUN mix release

FROM ${RUNNER_IMAGE}
ENV PORT=4000
RUN apt-get update -y && \
    apt-get install -y libstdc++6 openssl libncurses6 locales ca-certificates curl \
    && apt-get clean && rm -f /var/lib/apt/lists/*_*
ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8
WORKDIR /app
RUN chown nobody /app
ENV MIX_ENV=prod
ENV PHX_SERVER=true
COPY --from=builder --chown=nobody:root /app/_build/prod/rel/presence ./
USER nobody
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f -H "Origin: http://localhost:3000" http://localhost:${PORT:-4000}/health || exit 1
EXPOSE 4000
CMD ["bin/presence", "start"]
