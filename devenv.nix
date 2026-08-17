{
  pkgs,
  config,
  lib,
  ...
}:

{
  env.PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines_7}/bin/schema-engine";

  languages.javascript = {
    enable = true;
    bun.enable = true;
    nodejs.enable = true;
  };

  languages.elixir = {
    enable = true;
    package = pkgs.elixir_1_19;
  };

  languages.rust.enable = true;

  packages = with pkgs; [
    git
    docker
    docker-compose
    jq
    postgresql
    redis
    openssl
    pkg-config
    python3
    gcc
    glib
    gtk3
    webkitgtk_4_1
    gdk-pixbuf
    cairo
    pango
    librsvg
    libsoup_3
    gsettings-desktop-schemas
    dbus
    libayatana-appindicator
  ];

  env.PKG_CONFIG_PATH = lib.makeSearchPath "lib/pkgconfig" (
    with pkgs;
    [
      glib
      gtk3
      webkitgtk_4_1
      gdk-pixbuf
      cairo
      pango
      librsvg
      libsoup_3
      dbus
      libayatana-appindicator
      openssl.dev
    ]
  );

  enterShell = ''
    echo "Lumen dev environment ready."
  '';
}
