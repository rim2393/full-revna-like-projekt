import json
import os
import time
import urllib.error
import urllib.request


BASE = os.environ.get("LUMEN_LIVE_PANEL_API", "https://panel.89-185-85-184.sslip.io/api/v1")
KEY = os.environ["LUMEN_BOOTSTRAP_ADMIN_API_KEY"]
HEADERS = {"X-Lumen-Api-Key": KEY, "Content-Type": "application/json"}


def request(method, path, body=None, *, raw=False, allow_404=False):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            payload = resp.read()
            if raw:
                return resp.status, dict(resp.headers), payload
            if not payload:
                return {}
            return json.loads(payload.decode() or "{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        if allow_404 and exc.code == 404:
            return {"missing": True}
        raise RuntimeError(f"{method} {path} -> {exc.code}: {detail[:700]}") from exc


def find_live_node():
    nodes = request("GET", "/nodes")["items"]
    active = [node for node in nodes if node.get("status") == "active"]
    if active:
        return active[0]
    if nodes:
        return nodes[0]
    raise RuntimeError("no live node available")


def create_live_objects():
    suffix = str(int(time.time()))
    node = find_live_node()
    user = request(
        "POST",
        "/users",
        {
            "email": f"live-squad-{suffix}@lumentech.tel",
            "username": f"live-squad-{suffix}",
            "tags": ["live-parity"],
            "metadata_json": {"live_validation": "squads"},
        },
    )
    first_squad = request(
        "POST",
        "/squads",
        {
            "name": f"Live Squad Matrix A {suffix}",
            "kind": "internal",
            "metadata_json": {"purpose": "live-parity", "order": 1000},
        },
    )
    second_squad = request(
        "POST",
        "/squads",
        {
            "name": f"Live Squad Matrix B {suffix}",
            "kind": "external",
            "metadata_json": {"purpose": "live-parity", "order": 1001},
        },
    )
    membership = request("POST", f"/squads/{first_squad['id']}/users", {"user_ids": [user["id"]]})
    profile = request(
        "POST",
        "/profiles",
        {
            "name": f"Live Squad Matrix Profile {suffix}",
            "node_id": node["id"],
            "squad_id": first_squad["id"],
            "adapter": "vless-ws",
            "status": "active",
            "config_json": {
                "network": "ws",
                "path": f"/live-squad-{suffix}",
                "host": "panel.89-185-85-184.sslip.io",
            },
            "port_reservations": [
                {
                    "address": "0.0.0.0",
                    "port": 18510,
                    "protocol": "tcp",
                    "exclusive": True,
                }
            ],
            "credentials_ref": f"vault://subscriptions/live-squad-{suffix}/creds",
            "metadata_json": {"liveValidation": True, "matrix": "squads"},
            "allow_port_conflicts": True,
        },
    )
    host = request(
        "POST",
        "/hosts",
        {
            "name": f"Live Squad Matrix Host {suffix}",
            "hostname": f"live-squad-{suffix}.panel.89-185-85-184.sslip.io",
            "node_id": node["id"],
            "protocol_profile_id": profile["id"],
            "squad_id": first_squad["id"],
            "status": "active",
            "tags": ["live-parity"],
            "port": 18510,
            "inbound_tag": f"LIVE_SQUAD_{suffix}",
            "metadata_json": {"liveValidation": True},
        },
    )
    return {
        "node": node,
        "user": user,
        "first_squad": first_squad,
        "second_squad": second_squad,
        "membership": membership,
        "profile": profile,
        "host": host,
        "suffix": suffix,
    }


def validate_live_objects(objects):
    first_squad = objects["first_squad"]
    second_squad = objects["second_squad"]
    user = objects["user"]
    profile = objects["profile"]
    host = objects["host"]
    node = objects["node"]
    suffix = objects["suffix"]

    detail = request("GET", f"/squads/{first_squad['id']}/detail")
    if [item["id"] for item in detail["users"]] != [user["id"]]:
        raise RuntimeError("squad detail did not expose live membership")
    if [item["id"] for item in detail["profiles"]] != [profile["id"]]:
        raise RuntimeError("squad detail did not expose live profile")
    if [item["id"] for item in detail["hosts"]] != [host["id"]]:
        raise RuntimeError("squad detail did not expose live host")
    if not any(item.get("id") == node["id"] for item in detail["nodes"]):
        raise RuntimeError("squad detail did not expose live node")
    inbound = next(
        (item for item in detail["inbound_matrix"] if item.get("profile_id") == profile["id"]),
        None,
    )
    if inbound is None:
        raise RuntimeError("squad detail did not expose live inbound matrix")
    expected_tag = f"LIVE_SQUAD_{suffix}"
    if inbound.get("tag") != expected_tag:
        raise RuntimeError(f"inbound tag mismatch: {inbound.get('tag')}")
    if inbound.get("protocol") != "vless" or inbound.get("transport") != "ws":
        raise RuntimeError(f"inbound protocol/transport mismatch: {inbound}")

    computed = request("GET", f"/profiles/{profile['id']}/computed-config")
    computed_inbound = computed["computed_config"]["inbounds"][0]
    if computed_inbound.get("tag") != expected_tag:
        raise RuntimeError("computed config does not use host inbound tag")
    if computed_inbound.get("settings", {}).get("clientsRef") != profile["credentials_ref"]:
        raise RuntimeError("computed config does not preserve credentialsRef")

    reorder = request(
        "POST",
        "/squads/actions/reorder",
        {"ids": [second_squad["id"], first_squad["id"]]},
    )
    if reorder.get("updated") != 2:
        raise RuntimeError(f"squad reorder did not update both records: {reorder}")
    listing = request("GET", "/squads")
    live_order = [
        item["id"]
        for item in listing["items"]
        if item["id"] in {first_squad["id"], second_squad["id"]}
    ]
    if live_order != [second_squad["id"], first_squad["id"]]:
        raise RuntimeError(f"squad reorder not persisted: {live_order}")

    removed = request("POST", f"/squads/{first_squad['id']}/users/remove", {"user_ids": [user["id"]]})
    if removed.get("metadata_json", {}).get("user_ids") not in ([], None):
        raise RuntimeError("squad membership removal was not persisted")

    return {
        "detail": {
            "users": len(detail["users"]),
            "profiles": len(detail["profiles"]),
            "hosts": len(detail["hosts"]),
            "nodes": len(detail["nodes"]),
            "inbounds": len(detail["inbound_matrix"]),
            "inbound_tag_matches": True,
        },
        "computed_config": {
            "inbounds": len(computed["computed_config"]["inbounds"]),
            "tag_matches": True,
            "has_clients_ref": True,
        },
        "reorder": {"updated": reorder["updated"], "persisted": True},
        "membership_remove": {"persisted": True},
    }


def cleanup(objects):
    cleanup_results = []
    for label, method, path in [
        ("host", "DELETE", f"/hosts/{objects['host']['id']}"),
        ("profile", "DELETE", f"/profiles/{objects['profile']['id']}"),
        ("first_squad", "DELETE", f"/squads/{objects['first_squad']['id']}"),
        ("second_squad", "DELETE", f"/squads/{objects['second_squad']['id']}"),
        ("user", "DELETE", f"/users/{objects['user']['id']}"),
    ]:
        try:
            request(method, path, raw=True, allow_404=True)
            cleanup_results.append({"resource": label, "removed": True})
        except Exception as exc:  # noqa: BLE001 - live cleanup must report every resource.
            cleanup_results.append({"resource": label, "removed": False, "error": str(exc)[:180]})
    return cleanup_results


def redact_id(value):
    text = str(value)
    if len(text) <= 10:
        return text
    return f"{text[:6]}...{text[-4:]}"


def main():
    objects = create_live_objects()
    validation = None
    try:
        validation = validate_live_objects(objects)
    finally:
        cleanup_results = cleanup(objects)
    print(
        json.dumps(
            {
                "scope": "squads-inbound-matrix-live",
                "node_id": redact_id(objects["node"]["id"]),
                "squad_id": redact_id(objects["first_squad"]["id"]),
                "profile_id": redact_id(objects["profile"]["id"]),
                "host_id": redact_id(objects["host"]["id"]),
                "validation": validation,
                "cleanup": cleanup_results,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
