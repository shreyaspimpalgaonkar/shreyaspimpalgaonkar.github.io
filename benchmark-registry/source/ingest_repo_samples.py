#!/usr/bin/env python3
"""Ingest exact sample rows from public GitHub benchmark repositories."""

from __future__ import annotations

import csv
import ast
import json
import inspect
from pathlib import Path
from typing import Any

import tomllib
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


def load_json_or_jsonl(path: Path) -> list[dict[str, Any]]:
    text = path.read_text()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    return data if isinstance(data, list) else list(data.values())


def read_optional(path: Path, limit: int = 1200) -> str:
    if not path.exists():
        return ""
    return compact(path.read_text(errors="ignore"), limit)


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


def visualwebarena_rows() -> list[dict[str, Any]]:
    repo_root = Path("/tmp/benchrepo-vwa")
    rels = [
        "config_files/vwa/test_reddit.raw.json",
        "config_files/vwa/test_shopping.raw.json",
        "config_files/vwa/test_classifieds.raw.json",
    ]
    rows: list[tuple[str, dict[str, Any]]] = []
    for rel in rels:
        for row in load_json(repo_root / rel):
            rows.append((rel, row))
    out = []
    for i, (rel, row) in enumerate(rows[:ROWS_PER_BENCHMARK]):
        url = github_url("web-arena-x/visualwebarena", "main", rel)
        eval_spec = row.get("eval", {})
        image = clean(row.get("image"))
        out.append(
            sample(
                "visualwebarena",
                url,
                i,
                "visual_web_navigation",
                clean(row.get("intent")),
                input_text=(
                    f"task_id: {row.get('task_id')}\nsites: {row.get('sites')}\nstart_url: {row.get('start_url')}\n"
                    f"image: {image or 'none'}\nrequire_login: {row.get('require_login')}\neval_types: {eval_spec.get('eval_types')}"
                ),
                answer=compact(eval_spec.get("reference_answers") or eval_spec.get("reference_url") or eval_spec.get("program_html")),
                artifact=image or "VisualWebArena browser task config",
            )
        )
    return out


def intercode_rows() -> list[dict[str, Any]]:
    rel = "data/nl2bash/test_queries.json"
    rows = load_json(Path("/tmp/benchrepo-intercode") / rel)[:ROWS_PER_BENCHMARK]
    url = github_url("princeton-nlp/intercode", "master", rel)
    return [
        sample(
            "intercode",
            url,
            i,
            "nl_to_bash_interactive_task",
            clean(row.get("query")),
            answer=clean(row.get("gold")),
            artifact="InterCode Bash test query with gold command",
        )
        for i, row in enumerate(rows)
    ]


def terminal_bench_3_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-terminal3/tasks")
    task_dirs = [p for p in sorted(root.iterdir()) if p.is_dir() and (p / "instruction.md").exists()]
    out = []
    for i, task_dir in enumerate(task_dirs[:ROWS_PER_BENCHMARK]):
        rel = f"tasks/{task_dir.name}/instruction.md"
        task_toml_rel = f"tasks/{task_dir.name}/task.toml"
        meta = toml_load(task_dir / "task.toml")
        metadata = meta.get("metadata", {})
        verifier = meta.get("verifier", {})
        environment = meta.get("environment", {})
        out.append(
            sample(
                "terminal-bench-3",
                github_url("harbor-framework/terminal-bench-3", "main", rel),
                i,
                "terminal_environment_task",
                clean((task_dir / "instruction.md").read_text()),
                input_text=(
                    f"task: {task_dir.name}\ncategory: {metadata.get('category')}\ndifficulty: {metadata.get('difficulty')}\n"
                    f"tags: {metadata.get('tags')}\nexpert_time_estimate_hours: {metadata.get('expert_time_estimate_hours')}\n"
                    f"agent_timeout_sec: {meta.get('agent', {}).get('timeout_sec')}\n"
                    f"verifier_timeout_sec: {verifier.get('timeout_sec')}\n"
                    f"environment: cpus={environment.get('cpus')}, memory_mb={environment.get('memory_mb')}, "
                    f"gpus={environment.get('gpus')}, allow_internet={environment.get('allow_internet')}\n"
                    f"task_toml_url: {github_url('harbor-framework/terminal-bench-3', 'main', task_toml_rel)}"
                ),
                artifact="Terminal-Bench 3 public task folder with instruction, task.toml metadata, Docker environment, tests, verifier, and solution",
            )
        )
    return out


def terminal_bench_2_1_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-terminal")
    files = sorted((root / "original-tasks").glob("*/task.yaml"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, path in enumerate(files):
        cfg = yaml.safe_load(path.read_text())
        rel = str(path.relative_to(root))
        task_dir = path.parent
        out.append(
            sample(
                "terminal-bench-2-1",
                github_url("laude-institute/terminal-bench", "main", rel),
                i,
                "terminal_environment_task",
                clean(cfg.get("instruction")),
                input_text=(
                    f"task: {task_dir.name}\ncategory: {cfg.get('category')}\ndifficulty: {cfg.get('difficulty')}\n"
                    f"tags: {cfg.get('tags')}\nparser: {cfg.get('parser_name')}\n"
                    f"expert_time_estimate_min: {cfg.get('expert_time_estimate_min')}\n"
                    f"junior_time_estimate_min: {cfg.get('junior_time_estimate_min')}"
                ),
                artifact="Terminal-Bench task folder with instruction, Docker Compose environment, tests, and solution metadata",
            )
        )
    return out


def eval_static_prompt(node: ast.AST, constants: dict[str, str]) -> str:
    if isinstance(node, ast.Constant):
        return "" if node.value is None else str(node.value)
    if isinstance(node, ast.Name):
        return constants.get(node.id, "")
    if isinstance(node, ast.Attribute):
        return constants.get(node.attr, "")
    if isinstance(node, ast.JoinedStr):
        return "".join(eval_static_prompt(value, constants) for value in node.values)
    if isinstance(node, ast.FormattedValue):
        return eval_static_prompt(node.value, constants)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return eval_static_prompt(node.left, constants) + eval_static_prompt(node.right, constants)
    return ""


def agentdojo_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-agentdojo")
    suite_root = root / "src/agentdojo/default_suites/v1"
    files = [
        suite_root / "slack/user_tasks.py",
        suite_root / "travel/user_tasks.py",
        suite_root / "banking/user_tasks.py",
        suite_root / "workspace/user_tasks.py",
    ]
    rows: list[tuple[Path, str, str, dict[str, str]]] = []
    for path in files:
        tree = ast.parse(path.read_text())
        domain = path.parent.name
        for cls in [node for node in tree.body if isinstance(node, ast.ClassDef)]:
            if not cls.name.startswith("UserTask"):
                continue
            constants: dict[str, str] = {}
            prompt = ""
            difficulty = ""
            for stmt in cls.body:
                if not isinstance(stmt, ast.Assign) or not stmt.targets or not isinstance(stmt.targets[0], ast.Name):
                    continue
                name = stmt.targets[0].id
                value = eval_static_prompt(stmt.value, constants)
                if name == "PROMPT":
                    prompt = value
                elif name == "DIFFICULTY" and isinstance(stmt.value, ast.Attribute):
                    difficulty = stmt.value.attr.lower()
                elif value:
                    constants[name] = value
            if prompt:
                rows.append((path, domain, prompt, {"class": cls.name, "difficulty": difficulty}))
    out = []
    for i, (path, domain, prompt, meta) in enumerate(rows[:ROWS_PER_BENCHMARK]):
        rel = str(path.relative_to(root))
        out.append(
            sample(
                "agentdojo",
                github_url("ethz-spylab/agentdojo", "main", rel),
                i,
                "agent_tool_use_with_prompt_injection_risk",
                clean(prompt),
                input_text=f"suite: {domain}\nclass: {meta.get('class')}\ndifficulty: {meta.get('difficulty')}",
                artifact="AgentDojo default-suite user task Python class with prompt, tools, ground-truth function calls, and utility check",
            )
        )
    return out


def toml_load(path: Path) -> dict[str, Any]:
    import tomllib

    return tomllib.loads(path.read_text())


def re_bench_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-rebench")
    manifests = sorted(root.glob("*/manifest.yaml"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, manifest in enumerate(manifests):
        rel = str(manifest.relative_to(root))
        cfg = yaml.safe_load(manifest.read_text())
        meta = cfg.get("meta", {})
        task_meta = next(iter(cfg.get("tasks", {}).values())).get("meta", {})
        readme = read_optional(manifest.parent / "README.md", 900)
        out.append(
            sample(
                "re-bench",
                github_url("METR/RE-Bench", "main", rel),
                i,
                "ai_rd_engineering_task",
                clean(task_meta.get("task_description") or meta.get("name")),
                input_text=(
                    f"name: {meta.get('name')}\nexpertise: {meta.get('expertise')}\nversion: {cfg.get('version')}\n"
                    f"readme_excerpt: {readme}"
                ),
                artifact="RE-Bench task manifest and README",
            )
        )
    return out


def theagentcompany_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-tac/workspaces/tasks")
    task_dirs = [p for p in sorted(root.iterdir()) if p.is_dir() and (p / "task.md").exists()]
    out = []
    for i, task_dir in enumerate(task_dirs[:ROWS_PER_BENCHMARK]):
        rel = f"workspaces/tasks/{task_dir.name}/task.md"
        checkpoints = read_optional(task_dir / "checkpoints.md", 900)
        out.append(
            sample(
                "theagentcompany",
                github_url("TheAgentCompany/TheAgentCompany", "main", rel),
                i,
                "enterprise_workspace_agent_task",
                clean((task_dir / "task.md").read_text()),
                input_text=f"task: {task_dir.name}\ncheckpoints_excerpt: {checkpoints}",
                artifact="TheAgentCompany task folder with task.md, evaluator, checkpoints, and environment dependencies",
            )
        )
    return out


def windowsagentarena_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-waa/src/win-arena-container/client/evaluation_examples_windows/examples")
    files = sorted(root.glob("*/*.json"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, path in enumerate(files):
        row = load_json(path)
        rel = str(path.relative_to(Path("/tmp/benchrepo-waa")))
        out.append(
            sample(
                "windowsagentarena",
                github_url("microsoft/WindowsAgentArena", "main", rel),
                i,
                "windows_desktop_agent_task",
                clean(row.get("instruction")),
                input_text=(
                    f"id: {row.get('id')}\nsnapshot: {row.get('snapshot')}\nrelated_apps: {row.get('related_apps')}\n"
                    f"source: {row.get('source')}\nevaluator: {compact(row.get('evaluator'), 500)}"
                ),
                artifact="WindowsAgentArena task JSON with VM setup config and evaluator",
            )
        )
    return out


def cybench_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-cybench")
    files = sorted((root / "benchmark").glob("**/metadata/metadata.json"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, path in enumerate(files):
        row = load_json(path)
        rel = str(path.relative_to(root))
        challenge_dir = path.parents[1]
        out.append(
            sample(
                "cybench",
                github_url("andyzorigin/cybench", "main", rel),
                i,
                "cybersecurity_ctf_task",
                clean(row.get("hard_prompt") or row.get("easy_prompt")),
                input_text=(
                    f"challenge: {challenge_dir.name}\ncategories: {row.get('categories')}\ndifficulty: {row.get('difficulty')}\n"
                    f"target_host: {row.get('target_host')}\ntools: {row.get('tools')}\nstateful_shell: {row.get('stateful_shell')}"
                ),
                answer=compact([sub.get("question") for sub in row.get("subtasks", [])[:3]]),
                artifact="CyBench challenge metadata with prompts, tool constraints, and subtasks",
            )
        )
    return out


def aider_polyglot_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-aider")
    docs = sorted(root.glob("go/exercises/practice/*/.docs/instructions.md"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, doc in enumerate(docs):
        exercise = doc.parents[1]
        rel = str(doc.relative_to(root))
        cfg_path = exercise / ".meta" / "config.json"
        cfg = load_json(cfg_path) if cfg_path.exists() else {}
        out.append(
            sample(
                "aider-polyglot",
                github_url("Aider-AI/polyglot-benchmark", "main", rel),
                i,
                "polyglot_code_editing_exercise",
                clean(doc.read_text()),
                input_text=(
                    f"language: go\nexercise: {exercise.name}\nblurb: {cfg.get('blurb')}\n"
                    f"solution_files: {cfg.get('files', {}).get('solution')}\ntest_files: {cfg.get('files', {}).get('test')}"
                ),
                artifact="Aider Polyglot exercise instructions with source/test file references",
            )
        )
    return out


def devbench_like_rows(benchmark_id: str, repo: str, repo_dir: str) -> list[dict[str, Any]]:
    root = Path(repo_dir)
    configs = sorted(root.glob("benchmark_data/*/*/repo_config.json"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, cfg_path in enumerate(configs):
        cfg = load_json(cfg_path)
        project_dir = cfg_path.parent
        rel = str(cfg_path.relative_to(root))
        prd_rel = cfg.get("PRD", "")
        prd = read_optional(project_dir / prd_rel, 1000) if prd_rel else ""
        out.append(
            sample(
                benchmark_id,
                github_url(repo, "main", rel),
                i,
                "software_development_project_task",
                prd or f"Implement and test the {project_dir.name} project.",
                input_text=(
                    f"project: {project_dir.name}\nlanguage: {cfg.get('language')}\nunit_tests: {cfg.get('unit_tests')}\n"
                    f"acceptance_tests: {cfg.get('acceptance_tests')}\nrequired_files: {cfg.get('required_files')}\n"
                    f"unit_test_script: {cfg.get('unit_test_script')}\nacceptance_test_script: {cfg.get('acceptance_test_script')}"
                ),
                artifact="DevBench/DevEval repo_config plus project PRD, tests, and required files",
            )
        )
    return out


def bfcl_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-gorilla/berkeley-function-call-leaderboard/bfcl_eval/data")
    rel = "BFCL_v4_simple_python.json"
    rows = load_json_or_jsonl(root / rel)[:ROWS_PER_BENCHMARK]
    answer_rows = load_json_or_jsonl(root / "possible_answer" / rel)
    answers = {row.get("id"): row for row in answer_rows}
    out = []
    for i, row in enumerate(rows):
        messages = row.get("question", [[]])[0]
        text = "\n".join(f"{msg.get('role')}: {msg.get('content')}" for msg in messages)
        out.append(
            sample(
                "bfcl",
                github_url("ShishirPatil/gorilla", "main", f"berkeley-function-call-leaderboard/bfcl_eval/data/{rel}"),
                i,
                "function_calling",
                clean(text),
                input_text=f"id: {row.get('id')}\nfunctions: {compact(row.get('function'), 1200)}",
                answer=compact(answers.get(row.get("id"), {}).get("ground_truth"), 900),
                artifact="BFCL task row with available function schema and possible answer file",
            )
        )
    return out


def dsbench_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-dsbench")
    rows = load_jsonl(root / "data_analysis/data.json")[:ROWS_PER_BENCHMARK]
    out = []
    for i, row in enumerate(rows):
        out.append(
            sample(
                "dsbench",
                github_url("LiqiangJing/DSBench", "main", "data_analysis/data.json"),
                i,
                "data_analysis_exam",
                f"{row.get('name')} ({row.get('year')})",
                input_text=f"id: {row.get('id')}\nurl: {row.get('url')}\nquestions: {row.get('questions')}\ntext_excerpt: {compact(row.get('txt'), 1000)}",
                answer=compact(row.get("answers"), 900),
                artifact="DSBench data-analysis row with source URL, question ids, and answers",
            )
        )
    return out


def mlgym_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-mlgym")
    files = sorted((root / "configs/tasks").glob("*.yaml"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, path in enumerate(files):
        cfg = yaml.safe_load(path.read_text())
        rel = str(path.relative_to(root))
        out.append(
            sample(
                "mlgym",
                github_url("facebookresearch/MLGym", "main", rel),
                i,
                "ml_engineering_task",
                clean(cfg.get("description")),
                input_text=(
                    f"id: {cfg.get('id')}\nname: {cfg.get('name')}\ndataset_configs: {cfg.get('dataset_configs')}\n"
                    f"task_entrypoint: {cfg.get('task_entrypoint')}\ntraining_timeout: {cfg.get('training_timeout')}\n"
                    f"starter_code: {cfg.get('starter_code')}\nevaluation_paths: {cfg.get('evaluation_paths')}"
                ),
                answer=compact(cfg.get("baseline_scores"), 500),
                artifact="MLGym task YAML with starter code, datasets, evaluator paths, and baseline scores",
            )
        )
    return out


def osworld_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-osworld")
    files = sorted((root / "evaluation_examples/examples").glob("*/*.json"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, path in enumerate(files):
        row = load_json(path)
        rel = str(path.relative_to(root))
        out.append(
            sample(
                "osworld",
                github_url("xlang-ai/OSWorld", "main", rel),
                i,
                "desktop_os_task",
                clean(row.get("instruction")),
                input_text=(
                    f"id: {row.get('id')}\nsnapshot: {row.get('snapshot')}\nrelated_apps: {row.get('related_apps')}\n"
                    f"source: {row.get('source')}\nconfig: {compact(row.get('config'), 700)}"
                ),
                answer=compact(row.get("evaluator"), 900),
                artifact="OSWorld task JSON with desktop snapshot, setup config, and evaluator",
            )
        )
    return out


def paperbench_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-preparedness")
    paper_root = root / "project/paperbench/data/papers"
    configs = sorted(paper_root.glob("*/config.yaml"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, cfg_path in enumerate(configs):
        cfg = yaml.safe_load(cfg_path.read_text())
        paper_dir = cfg_path.parent
        rubric = load_json(paper_dir / "rubric.json")
        rel = str(cfg_path.relative_to(root))
        paper_excerpt = read_optional(paper_dir / "paper.md", 900)
        top_requirements = [
            compact(task.get("requirements"), 180)
            for task in rubric.get("sub_tasks", [])[:4]
            if clean(task.get("requirements"))
        ]
        out.append(
            sample(
                "paperbench",
                github_url("openai/preparedness", "main", rel),
                i,
                "ai_research_paper_replication",
                clean(rubric.get("requirements") or f'Reproduce "{cfg.get("title")}".'),
                input_text=(
                    f"id: {cfg.get('id')}\ntitle: {cfg.get('title')}\n"
                    f"top_rubric_requirements: {top_requirements}\npaper_excerpt: {paper_excerpt}"
                ),
                answer=compact(rubric, 900),
                artifact="PaperBench paper folder with paper PDF/Markdown, assets, config.yaml, blacklist, and rubric.json",
            )
        )
    return out


def swe_lancer_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-preparedness")
    issue_root = root / "project/swelancer/issues"
    files = sorted(issue_root.glob("*/issue_data.json"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, path in enumerate(files):
        row = load_json(path)
        issue_dir = path.parent
        rel = str(path.relative_to(root))
        repro = row.get("issue_repro_steps") or row.get("issue_repo_steps") or ""
        out.append(
            sample(
                "swe-lancer",
                github_url("openai/preparedness", "main", rel),
                i,
                "freelance_software_engineering_issue",
                clean(row.get("title")),
                input_text=(
                    f"issue_id: {issue_dir.name}\nprice: {row.get('price')}\n"
                    f"repro_steps: {compact(repro, 900)}\nhtml_description_excerpt: {compact(row.get('html_description'), 900)}"
                ),
                artifact="SWE-Lancer issue folder with issue_data.json, bug reintroduction patch, tests, commit id, and captured flow",
            )
        )
    return out


def mlcommons_medperf_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-medperf")
    rels = [
        "examples/BraTS2024/data_prep/mlcube/mlcube.yaml",
        "examples/BraTS2024/dummy_model/mlcube/mlcube.yaml",
        "examples/BraTS2023/data_prep/mlcube/mlcube.yaml",
        "examples/BraTS2023/dummy_model/mlcube/mlcube.yaml",
        "examples/BraTS2023/inpainting_metrics/mlcube/mlcube.yaml",
    ]
    out = []
    for i, rel in enumerate(rels):
        path = root / rel
        cfg = yaml.safe_load(path.read_text())
        readme = read_optional(path.parents[1] / "README.md", 900) or read_optional(path.parents[2] / "README.md", 900)
        tasks = cfg.get("tasks", {})
        out.append(
            sample(
                "mlcommons-medperf",
                github_url("mlcommons/medperf", "main", rel),
                i,
                "medical_benchmark_mlcube",
                clean(cfg.get("description") or cfg.get("name")),
                input_text=(
                    f"name: {cfg.get('name')}\nauthors: {cfg.get('authors')}\nplatform: {cfg.get('platform')}\n"
                    f"docker: {cfg.get('docker')}\ntasks: {compact(tasks, 1200)}\nreadme_excerpt: {readme}"
                ),
                artifact="MLCommons MedPerf example benchmark MLCube with task interface, Docker image metadata, parameters, and README context",
            )
        )
    return out


def robolab_rows() -> list[dict[str, Any]]:
    root = Path("/home/shreyas/research/mm/cosmos-framework")
    rel = "inputs/omni/action_policy_batch.jsonl"
    rows = load_jsonl(root / rel)[:ROWS_PER_BENCHMARK]
    out = []
    for i, row in enumerate(rows):
        out.append(
            sample(
                "robolab",
                github_url("NVIDIA/cosmos-framework", "main", rel),
                i,
                "robotics_or_av_action_policy",
                clean(row.get("prompt")),
                input_text=(
                    f"name: {row.get('name')}\ndomain_name: {row.get('domain_name')}\nmodel_mode: {row.get('model_mode')}\n"
                    f"action_chunk_size: {row.get('action_chunk_size')}\nfps: {row.get('fps')}\nimage_size: {row.get('image_size')}\n"
                    f"view_point: {row.get('view_point')}\nvision_path: {row.get('vision_path')}\naction_path: {row.get('action_path')}\n"
                    f"extra: {row.get('extra')}"
                ),
                artifact="Cosmos/RoboLab action-policy input row with video artifact, action JSON artifact, and golden metric thresholds",
            )
        )
    return out


def healthadminbench_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-healthadminbench")
    files = sorted((root / "benchmark/v3/tasks").glob("*/*.json"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, path in enumerate(files):
        row = load_json(path)
        rel = str(path.relative_to(root))
        out.append(
            sample(
                "healthadminbench",
                github_url("som-shahlab/healthadminbench", "main", rel),
                i,
                "healthcare_admin_gui_task",
                clean(row.get("goal")),
                input_text=(
                    f"id: {row.get('id')}\nwebsite: {row.get('website')}\ndifficulty: {row.get('difficulty')}\n"
                    f"category: {row.get('category')}\nchallenge_type: {row.get('challengeType')}\npoints: {row.get('points')}\n"
                    f"config: {compact(row.get('config'), 700)}\nmetadata: {compact(row.get('metadata'), 900)}"
                ),
                answer=compact(row.get("evals"), 900),
                artifact="HealthAdminBench raw task JSON with hosted GUI environment, task goal, verifier/evaluator specs, config, and metadata",
            )
        )
    return out


def lab_bench_figqa_rows() -> list[dict[str, Any]]:
    root = Path("/tmp/benchrepo-labbench")
    rel = "FigQA/figqa-v1-public.jsonl"
    rows = load_jsonl(root / rel)[:ROWS_PER_BENCHMARK]
    out = []
    for i, row in enumerate(rows):
        figure_path = row.get("figure-path")
        figure_url = github_url("Future-House/LAB-Bench", "main", f"FigQA/{figure_path}") if figure_path else ""
        out.append(
            sample(
                "lab-bench-figqa",
                github_url("Future-House/LAB-Bench", "main", rel),
                i,
                "biology_figure_question_answering",
                clean(row.get("question")),
                input_text=(
                    f"id: {row.get('id')}\ntag: {row.get('tag')}\nversion: {row.get('version')}\n"
                    f"source: {row.get('source')}\nfigure_path: {figure_path}\nfigure_url: {figure_url}\n"
                    f"distractors: {row.get('distractors')}"
                ),
                answer=clean(row.get("ideal")),
                artifact=figure_url or "LAB-Bench FigQA public JSONL row with associated figure image",
            )
        )
    return out


def automationbench_rows() -> list[dict[str, Any]]:
    repo_root = Path("/tmp/benchrepo-automationbench")
    domains = ["sales", "marketing", "operations", "support", "finance"]
    selected: list[tuple[str, str, dict[str, Any], int]] = []

    for domain in domains:
        rel = f"automationbench/domains/{domain}/tasks.py"
        path = repo_root / rel
        source = path.read_text()
        source = "\n".join(
            line
            for line in source.splitlines()
            if not line.startswith("from datasets import Dataset")
            and not line.startswith("from automationbench.domains.")
        )
        namespace: dict[str, Any] = {
            "__name__": f"automationbench_sample_loader_{domain}",
            "Dataset": object,
            "apply_noise": lambda state, *args, **kwargs: state,
        }
        exec(compile(source, str(path), "exec"), namespace)
        functions = sorted(
            (
                (name, value)
                for name, value in namespace.items()
                if name.startswith("get_") and name.endswith("_task") and callable(value)
            ),
            key=lambda item: inspect.getsourcelines(item[1])[1],
        )
        name, fn = functions[0]
        row = fn()
        line_no = inspect.getsourcelines(fn)[1]
        selected.append((rel, name, row, line_no))

    out = []
    for i, (rel, name, row, line_no) in enumerate(selected):
        messages = row.get("prompt", [])
        user_prompt = "\n".join(clean(message.get("content")) for message in messages if message.get("role") == "user")
        info = row.get("info", {})
        source = f"{github_url('zapier/AutomationBench', 'main', rel)}#L{line_no}"
        out.append(
            sample(
                "automationbench",
                source,
                i,
                "cross_application_workflow_automation",
                user_prompt,
                input_text=(
                    f"function: {name}\nexample_id: {row.get('example_id')}\ntask: {row.get('task')}\n"
                    f"zapier_tools: {info.get('zapier_tools')}\n"
                    f"initial_state_excerpt: {compact(info.get('initial_state'), 1500)}"
                ),
                answer=compact(row.get("answer"), 900),
                artifact="AutomationBench public Python task definition with prompt, initial simulated SaaS state, tool list, and rubric/checker metadata",
            )
        )
    return out


def harvey_lab_rows() -> list[dict[str, Any]]:
    repo_root = Path("/tmp/benchrepo-harvey-labs")
    task_paths = sorted((repo_root / "tasks").glob("*/*/task.json"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, path in enumerate(task_paths):
        row = load_json(path)
        rel = path.relative_to(repo_root).as_posix()
        document_paths = sorted(p.relative_to(repo_root).as_posix() for p in path.parent.glob("documents/*"))
        criteria = row.get("criteria") or []
        if isinstance(criteria, list):
            criteria_excerpt = [
                {
                    "id": item.get("id"),
                    "title": item.get("title"),
                    "match_criteria": item.get("match_criteria"),
                }
                for item in criteria[:5]
            ]
        else:
            criteria_excerpt = criteria
        out.append(
            sample(
                "legal-agent-benchmark",
                github_url("harveyai/harvey-labs", "main", rel),
                i,
                "legal_agent_work_product",
                clean(row.get("instructions")),
                input_text=(
                    f"title: {row.get('title')}\nwork_type: {row.get('work_type')}\ntags: {row.get('tags')}\n"
                    f"deliverables: {compact(row.get('deliverables'), 700)}\n"
                    f"documents: {compact(document_paths, 1000)}"
                ),
                answer=compact(criteria_excerpt, 1400),
                artifact="Harvey LAB public legal-agent task with matter documents, deliverable spec, and all-pass grading criteria",
            )
        )
    return out


def blueprint_bench_rows() -> list[dict[str, Any]]:
    repo_root = Path("/tmp/benchrepo-blueprint")
    apartment = "example_house"
    img_dir = repo_root / "dataset" / apartment / "imgs"
    images = sorted(path.name for path in img_dir.glob("*.jpg"))
    image_urls = [
        github_url("AndonLabs/Blueprint-Bench-generation", "main", f"dataset/{apartment}/imgs/{name}")
        for name in images
    ]
    floorplan_url = github_url("AndonLabs/Blueprint-Bench-generation", "main", f"dataset/{apartment}/floorplan.png")
    ground_truth_url = github_url("AndonLabs/Blueprint-Bench-generation", "main", f"dataset/{apartment}/ground_truth.png")
    config_url = github_url("AndonLabs/Blueprint-Bench-generation", "main", "config.py")
    return [
        sample(
            "blueprint-bench-2",
            config_url,
            0,
            "apartment_photo_to_floorplan",
            "Create a precise architectural floor plan from these apartment images.",
            input_text=(
                f"apartment: {apartment}\nimage_count: {len(images)}\n"
                f"image_urls: {compact(image_urls, 1600)}\nfloorplan_url: {floorplan_url}"
            ),
            answer=ground_truth_url,
            artifact=ground_truth_url,
        )
    ]


def finance_agent_rows() -> list[dict[str, Any]]:
    repo_root = Path("/tmp/benchrepo-finance-agent-v2")
    rel = "data/public.csv"
    path = repo_root / rel
    rows = []
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i >= ROWS_PER_BENCHMARK:
                break
            rows.append(
                sample(
                    "finance-agent-benchmark",
                    github_url("vals-ai/finance-agent-v2", "main", rel),
                    i,
                    "financial_analyst_agent_question",
                    clean(row.get("Question")),
                    input_text=(
                        f"question_type: {row.get('Question Type')}\n"
                        f"expert_time_minutes: {row.get('Expert time (mins)')}\n"
                        "tools: web_search, edgar_search, parse_html_page, retrieve_information, price_history, calculator"
                    ),
                    answer=compact(row.get("Rubric"), 1400),
                    artifact="Finance Agent v2 public CSV row with question, taxonomy label, expert time estimate, and expert rubric criteria",
                )
            )
    return rows


def frontier_swe_rows() -> list[dict[str, Any]]:
    repo_root = Path("/tmp/benchrepo-frontier-swe")
    task_dirs = sorted(path.parent for path in (repo_root / "tasks").glob("*/instruction.md"))[:ROWS_PER_BENCHMARK]
    out = []
    for i, task_dir in enumerate(task_dirs):
        task_id = task_dir.name
        instruction_rel = f"tasks/{task_id}/instruction.md"
        toml_rel = f"tasks/{task_id}/task.toml"
        instruction = read_optional(repo_root / instruction_rel, 1800)
        metadata: dict[str, Any] = {}
        task_toml = repo_root / toml_rel
        if task_toml.exists():
            metadata = tomllib.loads(task_toml.read_text())
        env = metadata.get("environment", {})
        meta = metadata.get("metadata", {})
        verifier = metadata.get("verifier", {})
        test_files = sorted(path.relative_to(repo_root).as_posix() for path in (task_dir / "tests").glob("*"))[:8]
        out.append(
            sample(
                "frontier-swe",
                github_url("Proximal-Labs/frontier-swe", "main", instruction_rel),
                i,
                "frontier_software_engineering_task",
                instruction,
                input_text=(
                    f"task_id: {task_id}\ndifficulty: {meta.get('difficulty')}\ncategory: {meta.get('category')}\n"
                    f"tags: {meta.get('tags')}\ndocker_image: {env.get('docker_image')}\ncpus: {env.get('cpus')}\n"
                    f"memory_mb: {env.get('memory_mb')}\nstorage_mb: {env.get('storage_mb')}\n"
                    f"agent_timeout_sec: {metadata.get('agent', {}).get('timeout_sec')}\n"
                    f"verifier_timeout_sec: {verifier.get('timeout_sec')}\ntest_files: {compact(test_files, 900)}\n"
                    f"task_toml_url: {github_url('Proximal-Labs/frontier-swe', 'main', toml_rel)}"
                ),
                artifact="FrontierSWE public task directory with instruction.md, task.toml, Docker environment, tests, and verifier configuration",
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
        visualwebarena_rows(),
        intercode_rows(),
        terminal_bench_2_1_rows(),
        terminal_bench_3_rows(),
        agentdojo_rows(),
        re_bench_rows(),
        theagentcompany_rows(),
        windowsagentarena_rows(),
        cybench_rows(),
        aider_polyglot_rows(),
        devbench_like_rows("devbench", "open-compass/DevBench", "/tmp/benchrepo-devbench"),
        devbench_like_rows("deveval", "open-compass/DevEval", "/tmp/benchrepo-deveval"),
        bfcl_rows(),
        dsbench_rows(),
        mlgym_rows(),
        osworld_rows(),
        paperbench_rows(),
        swe_lancer_rows(),
        mlcommons_medperf_rows(),
        robolab_rows(),
        healthadminbench_rows(),
        lab_bench_figqa_rows(),
        automationbench_rows(),
        harvey_lab_rows(),
        blueprint_bench_rows(),
        finance_agent_rows(),
        frontier_swe_rows(),
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
