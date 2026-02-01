
ARG ELIXIR_VERSION=1.19.5
ARG OTP_VERSION=28.3.1
ARG DEBIAN_VERSION=bookworm-20250113-slim
ARG BUILDER_IMAGE="hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="debian:${DEBIAN_VERSION}"
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
RUN apt-get update -y && \
    apt-get install -y libstdc++6 openssl libncurses5 locales ca-certificates curl \
    && apt-get clean && rm -f /var/lib/apt/lists/*_*
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8
WORKDIR /app
RUN chown nobody /app
ENV MIX_ENV=prod
ENV PHX_SERVER=true
COPY --from=builder --chown=nobody:root /app/_build/prod/rel/presence ./
USER nobody
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-4000}/health || exit 1
EXPOSE 4000
CMD ["bin/presence", "start"]
