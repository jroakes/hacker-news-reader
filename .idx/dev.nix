# To learn more about how to use Nix to configure your environment
# see: https://developers.google.com/idx/guides/customize-idx-env
{ pkgs, ... }: {
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Create a Python environment with required packages
  packages = [
    (pkgs.python311.withPackages (ps: [
      ps.ipykernel  # Required for Jupyter notebooks
      ps.pip        # Include pip
      ps.virtualenv # Add virtualenv
      # Add any other Python packages you need here
      ps.pandas
      ps.numpy
      ps.matplotlib
      ps.requests
      ps.jupyter
    ]))
    pkgs.nodejs_20
  ];

  # Sets environment variables in the workspace
  env = {
    PYTHONPATH = "${pkgs.python311Packages.ipykernel}/lib/python3.11/site-packages";
    VIRTUAL_ENV = ".venv";  # Name of the virtual environment
  };

  idx = {
    # Search for the extensions you want on https://open-vsx.org/ and use "publisher.id"
    extensions = [
      # "vscodevim.vim"
    ];

    workspace = {
      # Runs when a workspace is first created with this `dev.nix` file
      onCreate = {
        npm-install = "npm ci --no-audit --prefer-offline --no-progress --timing";
        setup-python = ''
          python -m virtualenv .venv
          . .venv/bin/activate
          pip install repocoder
        '';
      };
      # To run something each time the workspace is (re)started, use the `onStart` hook
      onStart = {
        activate-venv = ". .venv/bin/activate";
      };
    };

    # Enable previews and customize configuration
    previews = {
      enable = false;
      previews = {
        web = {
          command = ["npm" "run" "dev" "--" "--port" "$PORT"];
          manager = "web";
        };
      };
    };
  };
}