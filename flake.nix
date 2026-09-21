{
  description = "OpenCode V2 plugin for GPT Image 2 generation";

  inputs = {
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.2605";

    git-hooks = {
      url = "https://flakehub.com/f/cachix/git-hooks.nix/0.1";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    nixpkgs,
    git-hooks,
    bun2nix,
    ...
  }: let
    systems = [
      "aarch64-darwin"
      "aarch64-linux"
      "x86_64-darwin"
      "x86_64-linux"
    ];
    forAllSystems = nixpkgs.lib.genAttrs systems;
    projectVersion = (builtins.fromJSON (builtins.readFile ./package.json)).version;
    perSystem = system: let
      pkgs = import nixpkgs {inherit system;};
      bun2nixPackage = bun2nix.packages.${system}.default;
      source = pkgs.lib.cleanSource ./.;
      bunDeps = bun2nixPackage.fetchBunDeps {bunNix = ./bun.nix;};
      mkCheck = name: command:
        bun2nixPackage.mkDerivation {
          pname = "opencode-gpt-imagegen-${name}";
          version = projectVersion;
          src = source;
          inherit bunDeps;
          buildPhase = ''
            runHook preBuild
            ${command}
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            touch $out
            runHook postInstall
          '';
        };
      lintCheck =
        pkgs.runCommand "opencode-gpt-imagegen-lint-${projectVersion}" {
          nativeBuildInputs = [pkgs.biome];
        } ''
          cp -r ${source} source
          chmod -R u+w source
          cd source
          biome ci .
          touch $out
        '';
      plugin = bun2nixPackage.mkDerivation {
        pname = "opencode-gpt-imagegen";
        version = projectVersion;
        src = source;
        inherit bunDeps;
        buildPhase = ''
          runHook preBuild
          bun run build
          runHook postBuild
        '';
        installPhase = ''
          runHook preInstall
          mkdir -p $out
          cp -r dist $out/
          cp README.md LICENSE $out/
          runHook postInstall
        '';
      };
      preCommitCheck = git-hooks.lib.${system}.run {
        package = pkgs.prek;
        src = ./.;
        hooks = {
          actionlint.enable = true;
          alejandra.enable = true;
          biome.enable = true;
          check-json.enable = true;
          check-yaml.enable = true;
          deadnix = {
            enable = true;
            excludes = ["bun.nix"];
          };
          markdownlint.enable = true;
          shellcheck.enable = true;
          statix.enable = true;
        };
      };
    in {
      inherit plugin preCommitCheck;
      checks = {
        build = plugin;
        typecheck = mkCheck "typecheck" "bun run typecheck";
        lint = lintCheck;
        unit = mkCheck "unit" "bun run test";
        pre-commit = preCommitCheck;
      };
      devShell = pkgs.mkShell {
        packages =
          [
            pkgs.bun
            bun2nixPackage
          ]
          ++ preCommitCheck.enabledPackages;
        inherit (preCommitCheck) shellHook;
      };
      formatter = pkgs.writeShellApplication {
        name = "format";
        runtimeInputs = [pkgs.alejandra];
        text = "alejandra .";
      };
    };
  in {
    packages = forAllSystems (system: {
      default = (perSystem system).plugin;
    });
    checks = forAllSystems (system: (perSystem system).checks);
    devShells = forAllSystems (system: {
      default = (perSystem system).devShell;
    });
    formatter = forAllSystems (system: (perSystem system).formatter);
  };
}
