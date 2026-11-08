import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

import app as appmod  # noqa: E402

SECRETS = ["NODE_SECRET", "HUB_TOKEN", "VIEWER_SECRET", "MCP_TOKEN", "ADMIN_PASSWORD", "HUB_ORIGIN"]


@pytest.fixture()
def clean_env(monkeypatch):
    for k in SECRETS + ["RENDER", "SETU_ENV"]:
        monkeypatch.delenv(k, raising=False)
    return monkeypatch


def test_dev_still_starts_with_insecure_defaults_and_warns(clean_env, capsys):
    cfg = appmod.Config.from_env(college_id="ngit")
    assert cfg.hub_token == "dev-hub-token"
    assert "insecure dev defaults" in capsys.readouterr().err


@pytest.mark.parametrize("flag", [("SETU_ENV", "production"), ("RENDER", "true")])
def test_production_refuses_to_start_on_dev_secrets(clean_env, flag):
    clean_env.setenv(*flag)
    with pytest.raises(SystemExit) as e:
        appmod.Config.from_env(college_id="ngit")
    assert "HUB_TOKEN" in str(e.value)


def test_production_starts_when_every_secret_is_set(clean_env):
    clean_env.setenv("SETU_ENV", "production")
    for k in SECRETS:
        clean_env.setenv(k, f"real-{k.lower()}")
    assert appmod.Config.from_env(college_id="ngit").hub_token == "real-hub_token"
