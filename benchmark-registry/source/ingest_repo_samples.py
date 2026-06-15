#!/usr/bin/env python3
"""Ingest exact sample rows from public GitHub benchmark repositories."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "src" / "data" / "registry.json"
ROWS_PER_BENCHMARK = 5


def clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def compact(value: Any, limit: int = 800) -> str:
    text = " ".join(clean(value).split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "..."


def sample(
    benchmark_id: str,
    source: str,
    row_index: int,
    task: str,
    text: str,
    *,
    input_text: str = "",
    answer: str = "",
    artifact: str = "",
) -> dict[str, Any]:
    item: dict[str, Any] = {
        "sample_id": f"{benchmark_id}:github:{row_index}",
        "benchmark_id": benchmark_id,
        "task": task,
        "text": text,
        "source_url": source,
        "row_index": row_index,
        "provenance": "Public GitHub repository file",
    }
    if input_text:
        item["input"] = input_text
    if answer:
        item["answer"] = answer
    if artifact:
        item["artifact"] = artifact
    return item


def github_url(repo: str, branch: str, path: str) -> str:
    return f"https://github.com/{repo}/blob/{branch}/{path}"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def webarena_rows() -> list[dict[str, Any]]:
    path = Path("/tmp/benchrepo-webarena/config_files/test.raw.json")
    rows = load_json(path)[:ROWS_PER_BENCHMARK]
    url = github_url("web-arena-x/webarena", "main", "config_files/test.raw.json")
    out = []
    for i, row in enumerate(rows):
        out.append(
            sample(
                "webarena",
                url,
                i,
                "web_navigation_task",
                clean(row.get("intent")),
                input_text=(
                    f"task_id: {row.get('task_id')}\nsites: {row.get('sites')}\nstart_url: {row.get('start_url')}\n"
                    f"require_login: {row.get('require_login')}\neval_types: {row.get('eval', {}).get('eval_types')}"
                ),
                answer=compact(row.get("eval", {}).get("reference_answers") or row.get("eval", {}).get("reference_url")),
                artifact="WebArena task config with start URL, site list, and evaluation spec",
            )
        )
    return out


def webvoyager_rows() -> list[dict[str, Any]]:
    rel = "data/WebVoyager_data.jsonl"
    rows = load_jsonl(Path("/tmp/benchrepo-webvoyager") / rel)[:ROWS_PER_BENCHMARK]
    url = github_url("MinorJerry/WebVoyager", "main", rel)
    return [
        sample(
            "webvoyager",
            url,
            i,
            "open_web_navigation",
            clean(row.get("ques")),
            input_text=f"id: {row.get('id')}\nweb_name: {row.get('web_name')}\nweb: {row.get('web')}",
            artifact="WebVoyager website task row",
        )
        for i, row in enumerate(rows)
    ]


def tau_bench_rows() -> list[dict[str, Any]]:
    rel = "few_shot_data/MockRetailDomainEnv-few_shot.jsonl"
    rows = load_jsonl(Path("/tmp/benchrepo-tau") / rel)[:ROWS_PER_BENCHMARK]
    url = github_url("sierra-research/tau-bench", "main", rel)
    return [
        sample(
            "tau-bench",
            url,
            i,
            "customer_service_tool_use",
            compact(row.get("messages_display"), 1200),
            artifact="Few-shot retail-domain dialogue with tool calls",
        )
        for i, row in enumerate(rows)
    ]


def toolbench_rows() -> list[dict[str, Any]]:
    files = [
        "data_example/instruction/G1_query.json",
        "data_example/instruction/G2_query.json",
        "data_example/instruction/G3_query.json",
    ]
    rows: list[tuple[str, dict[str, Any]]] = []
    for rel in files:
        for row in load_json(Path("/tmp/benchrepo-toolbench") / rel):
            rows.append((rel, row))
    out = []
    for i, (rel, row) in enumerate(rows[:ROWS_PER_BENCHMARK]):
        url = github_url("OpenBMB/ToolBench", "master", rel)
        apis = row.get("relevant APIs") or [
            [api.get("tool_name"), api.get("api_name")] for api in row.get("api_list", [])[:6]
        ]
        out.append(
            sample(
                "toolbench",
                url,
                i,
                "tool_api_use",
                clean(row.get("query")),
                input_text=f"query_id: {row.get('query_id')}\nrelevant_apis: {apis}",
                artifact="ToolBench API-use query with available API list",
            )
        )
    return out


def mle_bench_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-mle/mlebench/competitions")
    rels = [
        "AI4Code/config.yaml",
        "aerial-cactus-identification/config.yaml",
        "aptos2019-blindness-detection/config.yaml",
        "bms-molecular-translation/config.yaml",
        "cassava-leaf-disease-classification/config.yaml",
    ]
    out = []
    for i, rel in enumerate(rels):
        cfg = yaml.safe_load((root / rel).read_text())
        desc_rel = cfg.get("description", "")
        desc_path = Path("/tmp/benchrepo-mle") / desc_rel
        description = desc_path.read_text() if desc_path.exists() else cfg.get("name", "")
        url = github_url("openai/mle-bench", "main", f"mlebench/competitions/{rel}")
        out.append(
            sample(
                "mle-bench",
                url,
                i,
                "kaggle_ml_competition",
                compact(description, 1200),
                input_text=(
                    f"id: {cfg.get('id')}\nname: {cfg.get('name')}\ncompetition_type: {cfg.get('competition_type')}\n"
                    f"grader: {cfg.get('grader', {}).get('name')}\ndataset: {cfg.get('dataset')}"
                ),
                answer=clean(cfg.get("grader", {}).get("name")),
                artifact="MLE-bench competition config and description",
            )
        )
    return out


def main() -> None:
    registry = json.loads(REGISTRY_PATH.read_text())
    batches = [
        webarena_rows(),
        webvoyager_rows(),
        tau_bench_rows(),
        toolbench_rows(),
        mle_bench_rows(),
    ]
    rows = [row for batch in batches for row in batch]
    target_ids = {row["benchmark_id"] for row in rows}
    samples = [sample for sample in registry.get("samples", []) if sample["benchmark_id"] not in target_ids]
    samples.extend(rows)
    samples.sort(key=lambda row: (row["benchmark_id"], row["sample_id"]))
    registry["samples"] = samples
    counts: dict[str, int] = {}
    for row in samples:
        counts[row["benchmark_id"]] = counts.get(row["benchmark_id"], 0) + 1
    for benchmark in registry["benchmarks"]:
        benchmark["sample_count"] = counts.get(benchmark["benchmark_id"], 0)
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")
    for benchmark_id in sorted(target_ids):
        print(f"{benchmark_id}: {counts[benchmark_id]}")
    print(f"total samples: {len(samples)}")


if __name__ == "__main__":
    main()
