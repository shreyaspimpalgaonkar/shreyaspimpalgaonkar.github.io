#!/usr/bin/env python3
"""Ingest exact public benchmark rows from Hugging Face datasets.

The registry is intentionally static, so this script materializes a small,
source-linked sample set into src/data/registry.json. Each mapper keeps row text
verbatim from the source dataset fields and records dataset/config/split/row.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any
from urllib.parse import quote

from datasets import load_dataset


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "src" / "data" / "registry.json"
ROWS_PER_BENCHMARK = 5


def clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


def compact(value: Any, limit: int = 260) -> str:
    text = " ".join(clean(value).split())
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "..."


def hf_viewer_url(dataset: str, config: str, split: str, row_index: int) -> str:
    return (
        f"https://huggingface.co/datasets/{dataset}/viewer/"
        f"{quote(config, safe='')}/{quote(split, safe='')}?row={row_index}"
    )


def base_sample(
    benchmark_id: str,
    dataset: str,
    config: str,
    split: str,
    row_index: int,
    task: str,
    text: str,
    *,
    input_text: str = "",
    answer: str = "",
    options: list[str] | None = None,
    artifact: str = "",
    provenance: str = "Hugging Face dataset viewer",
) -> dict[str, Any]:
    sample: dict[str, Any] = {
        "sample_id": f"{benchmark_id}:{config}:{split}:{row_index}",
        "benchmark_id": benchmark_id,
        "task": task,
        "text": text,
        "dataset": dataset,
        "config": config,
        "split": split,
        "row_index": row_index,
        "source_url": hf_viewer_url(dataset, config, split, row_index),
        "provenance": provenance,
    }
    if input_text:
        sample["input"] = input_text
    if answer:
        sample["answer"] = answer
    if options:
        sample["options"] = options
    if artifact:
        sample["artifact"] = artifact
    return sample


def swe_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "issue_resolution",
        clean(row.get("problem_statement")),
        input_text=f"repo: {row.get('repo')}\ninstance_id: {row.get('instance_id')}\nbase_commit: {row.get('base_commit')}",
        answer=compact(row.get("patch"), 600),
        artifact="Git repository issue plus base commit, gold patch, and test patch",
    )


def humaneval_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "python_function_synthesis",
        clean(row.get("prompt")),
        input_text=f"task_id: {row.get('task_id')}\nentry_point: {row.get('entry_point')}",
        answer=clean(row.get("canonical_solution")),
        artifact="Python prompt, canonical solution, and hidden-style unit tests",
    )


def mbppplus_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "python_function_synthesis",
        clean(row.get("prompt")),
        input_text=f"task_id: {row.get('task_id')}\nsource_file: {row.get('source_file')}",
        answer=clean(row.get("code")),
        artifact="MBPP+ prompt, reference code, and EvalPlus tests",
    )


def bigcodebench_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "code_generation",
        clean(row.get("instruct_prompt") or row.get("complete_prompt")),
        input_text=f"task_id: {row.get('task_id')}\nentry_point: {row.get('entry_point')}\nlibs: {row.get('libs')}",
        answer=clean(row.get("canonical_solution")),
        artifact="Code generation prompt with canonical solution and tests",
    )


def quixbugs_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "bug_fixing",
        clean(row.get("docstring")),
        input_text=f"name: {row.get('name')}\n\nbuggy_program:\n{clean(row.get('buggy_program'))}",
        answer=clean(row.get("solution")),
        artifact="Buggy Python program, reference solution, and tests",
    )


def scicode_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "scientific_code_generation",
        clean(row.get("response")),
        input_text=clean(row.get("prompt")),
        artifact=f"SciCode programming-problem row; metadata: {compact(row.get('metadata'), 500)}",
    )


def gpqa_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    options = [
        clean(row.get("Correct Answer")),
        clean(row.get("Incorrect Answer 1")),
        clean(row.get("Incorrect Answer 2")),
        clean(row.get("Incorrect Answer 3")),
    ]
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "graduate_science_qa",
        clean(row.get("Question")),
        input_text=f"domain: {row.get('High-level domain')}\nsubdomain: {row.get('Subdomain')}",
        answer=clean(row.get("Correct Answer")),
        options=options,
        artifact="Multiple-choice question with expert-authored answer",
    )


def gmmlu_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    options = [clean(row.get(k)) for k in ("option_a", "option_b", "option_c", "option_d")]
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "multilingual_multiple_choice",
        clean(row.get("question")),
        input_text=f"sample_id: {row.get('sample_id')}\nsubject: {row.get('subject')}\ncategory: {row.get('subject_category')}",
        answer=clean(row.get("answer")),
        options=options,
        artifact="Multiple-choice text question",
    )


def bbq_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "bias_sensitive_question_answering",
        clean(row.get("question")),
        input_text=clean(row.get("context")),
        answer=clean(row.get("gold_index")),
        options=list(row.get("choices") or []),
        artifact="Context, question, choices, and gold choice index",
    )


def ai2d_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "diagram_question_answering",
        clean(row.get("question")),
        answer=clean(row.get("answer")),
        options=list(row.get("options") or []),
        artifact="Diagram image embedded in the Hugging Face dataset row",
    )


def docvqa_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "document_vqa",
        clean(row.get("question")),
        input_text=f"questionId: {row.get('questionId')}\ndocId: {row.get('docId')}\nquestion_types: {row.get('question_types')}",
        answer=", ".join(clean(answer) for answer in row.get("answers") or []),
        artifact="Document image embedded in the Hugging Face dataset row",
    )


def mmbench_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    options = [clean(row.get(k)) for k in ("A", "B", "C", "D") if clean(row.get(k)) and clean(row.get(k)).lower() != "nan"]
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "multiple_choice_vqa",
        clean(row.get("question")),
        input_text=clean(row.get("hint")),
        answer=clean(row.get("answer") or row.get("label")),
        options=options,
        artifact="Image embedded in the Hugging Face dataset row",
    )


def ds1000_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "data_science_code_completion",
        clean(row.get("prompt")),
        input_text=clean(row.get("code_context")),
        answer=clean(row.get("reference_code")),
        artifact="Python data-science prompt, code context, and reference code",
    )


def spider_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "text_to_sql",
        clean(row.get("question")),
        input_text=f"db_id: {row.get('db_id')}",
        answer=clean(row.get("query")),
        artifact="Natural-language question and gold SQL query",
    )


def livecodebench_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "competitive_programming",
        clean(row.get("question_content")),
        input_text=f"title: {row.get('question_title')}\nplatform: {row.get('platform')}\ndifficulty: {row.get('difficulty')}",
        answer=compact(row.get("public_test_cases"), 600),
        artifact="Programming problem with public/private test cases",
    )


def gaia_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "tool_augmented_qa",
        clean(row.get("Question")),
        input_text=f"task_id: {row.get('task_id')}\nlevel: {row.get('Level')}\nfile_name: {row.get('file_name')}",
        answer=clean(row.get("Final answer")),
        artifact="Question, optional file reference, and final answer field",
    )


def crmarena_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "crm_agent_task",
        clean(row.get("query")),
        input_text=f"task: {row.get('task')}\nreward_metric: {row.get('reward_metric')}\nmetadata: {compact(row.get('metadata'), 800)}",
        answer=clean(row.get("answer")),
        artifact="CRM task query, metadata, reward metric, and answer",
    )


def terminal_bench_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "terminal_task",
        clean(row.get("base_description")),
        input_text=f"task_id: {row.get('task_id')}\ndifficulty: {row.get('difficulty')}\ncategory: {row.get('category')}\ntags: {row.get('tags')}",
        answer=compact(row.get("task_yaml"), 800),
        artifact="Task archive bytes and task.yaml are embedded in the Hugging Face row",
    )


def agentbench_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "agent_environment_task",
        clean(row.get("description")),
        input_text=f"instance_id: {row.get('instance_id')}\ninit:\n{compact(row.get('init'), 900)}",
        answer=clean(row.get("get_ground_truth") or row.get("ground_truth")),
        artifact=f"AgentBench OSBench row with comparison method {row.get('comparison_method')}",
    )


def appworld_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "app_api_agent_task",
        clean(row.get("instruction")),
        input_text=(
            f"task_id: {row.get('task_id')}\nmode: {row.get('mode')}\ndifficulty: {row.get('difficulty')}\n"
            f"num_apps: {row.get('num_apps')}\nnum_apis: {row.get('num_apis')}"
        ),
        answer=compact(row.get("supervisor"), 500),
        artifact="AppWorld task row with database version and application/API counts",
    )


def healthbench_mapper(benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "medical_conversation_evaluation",
        clean(row.get("prompt")),
        input_text=f"prompt_id: {row.get('prompt_id')}\ntags: {row.get('example_tags')}",
        answer=compact(row.get("rubrics"), 900),
        artifact="Medical conversation prompt with rubric criteria",
    )


def healthbench_professional_mapper(
    benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]
) -> dict[str, Any]:
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "professional_medical_conversation_evaluation",
        clean(row.get("conversation")),
        input_text=f"id: {row.get('id')}\nuse_case: {row.get('use_case')}\nspecialty: {row.get('specialty')}\ndifficulty: {row.get('difficulty')}",
        answer=compact(row.get("rubric_items"), 900),
        artifact="Professional medical conversation with rubric items and physician response",
    )


def generic_question_answer_mapper(
    benchmark_id: str, row: dict[str, Any], row_index: int, meta: dict[str, str]
) -> dict[str, Any]:
    question = row.get("question") or row.get("query") or row.get("prompt") or row.get("Question")
    answer = row.get("answer") or row.get("Answer") or row.get("Final answer") or row.get("reference")
    return base_sample(
        benchmark_id,
        meta["dataset"],
        meta["config"],
        meta["split"],
        row_index,
        "question_answering",
        clean(question),
        answer=clean(answer),
        artifact="Public dataset row",
    )


CONFIGS: list[dict[str, Any]] = [
    {
        "benchmark_id": "swe-bench",
        "dataset": "princeton-nlp/SWE-bench",
        "config": "default",
        "split": "test",
        "mapper": swe_mapper,
    },
    {
        "benchmark_id": "swe-bench-lite",
        "dataset": "princeton-nlp/SWE-bench_Lite",
        "config": "default",
        "split": "test",
        "mapper": swe_mapper,
    },
    {
        "benchmark_id": "swe-bench-verified",
        "dataset": "SWE-bench/SWE-bench_Verified",
        "config": "default",
        "split": "test",
        "mapper": swe_mapper,
    },
    {
        "benchmark_id": "swe-smith",
        "dataset": "SWE-bench/SWE-smith",
        "config": "default",
        "split": "train",
        "mapper": swe_mapper,
    },
    {
        "benchmark_id": "swe-bench-pro",
        "dataset": "ScaleAI/SWE-bench_Pro",
        "config": "default",
        "split": "test",
        "mapper": swe_mapper,
    },
    {
        "benchmark_id": "humanevalplus",
        "dataset": "evalplus/humanevalplus",
        "config": "default",
        "split": "test",
        "mapper": humaneval_mapper,
    },
    {
        "benchmark_id": "evalplus",
        "dataset": "evalplus/mbppplus",
        "config": "default",
        "split": "test",
        "mapper": mbppplus_mapper,
    },
    {
        "benchmark_id": "bigcodebench",
        "dataset": "bigcode/bigcodebench",
        "config": "default",
        "split": "v0.1.4",
        "mapper": bigcodebench_mapper,
    },
    {
        "benchmark_id": "gpqa-diamond",
        "dataset": "Idavidrein/gpqa",
        "config": "gpqa_diamond",
        "split": "train",
        "mapper": gpqa_mapper,
    },
    {
        "benchmark_id": "quixbugs",
        "dataset": "Muennighoff/quixbugs",
        "config": "default",
        "split": "train",
        "mapper": quixbugs_mapper,
    },
    {
        "benchmark_id": "scicode",
        "dataset": "SciCode/SciCode-Programming-Problems",
        "config": "default",
        "split": "train",
        "mapper": scicode_mapper,
    },
    {
        "benchmark_id": "gmmlu",
        "dataset": "CohereLabs/Global-MMLU",
        "config": "en",
        "split": "test",
        "mapper": gmmlu_mapper,
    },
    {
        "benchmark_id": "bbq",
        "dataset": "lighteval/bbq_helm",
        "config": "Age",
        "split": "test",
        "mapper": bbq_mapper,
    },
    {
        "benchmark_id": "ai2d",
        "dataset": "lmms-lab/ai2d",
        "config": "default",
        "split": "test",
        "mapper": ai2d_mapper,
    },
    {
        "benchmark_id": "docvqa",
        "dataset": "lmms-lab/DocVQA",
        "config": "DocVQA",
        "split": "validation",
        "mapper": docvqa_mapper,
    },
    {
        "benchmark_id": "mmbench",
        "dataset": "lmms-lab/MMBench_EN",
        "config": "default",
        "split": "dev",
        "mapper": mmbench_mapper,
    },
    {
        "benchmark_id": "ds-1000",
        "dataset": "xlangai/DS-1000",
        "config": "default",
        "split": "test",
        "mapper": ds1000_mapper,
    },
    {
        "benchmark_id": "spider",
        "dataset": "xlangai/spider",
        "config": "spider",
        "split": "validation",
        "mapper": spider_mapper,
    },
    {
        "benchmark_id": "livecodebench",
        "dataset": "livecodebench/code_generation",
        "config": "default",
        "split": "test",
        "mapper": livecodebench_mapper,
    },
    {
        "benchmark_id": "gaia",
        "dataset": "gaia-benchmark/GAIA",
        "config": "2023_level1",
        "split": "validation",
        "mapper": gaia_mapper,
    },
    {
        "benchmark_id": "crmarena",
        "dataset": "Salesforce/CRMArena",
        "config": "CRMArena",
        "split": "test",
        "mapper": crmarena_mapper,
    },
    {
        "benchmark_id": "terminal-bench",
        "dataset": "ia03/terminal-bench",
        "config": "default",
        "split": "test",
        "mapper": terminal_bench_mapper,
    },
    {
        "benchmark_id": "agentbench",
        "dataset": "iFurySt/AgentBench",
        "config": "default",
        "split": "osbench",
        "mapper": agentbench_mapper,
    },
    {
        "benchmark_id": "appworld",
        "dataset": "LukaszTP/AppWorld-Tasks",
        "config": "default",
        "split": "train",
        "mapper": appworld_mapper,
    },
    {
        "benchmark_id": "healthbench",
        "dataset": "openai/healthbench",
        "config": "default",
        "split": "test",
        "mapper": healthbench_mapper,
    },
    {
        "benchmark_id": "healthbench-professional",
        "dataset": "openai/healthbench-professional",
        "config": "default",
        "split": "test",
        "mapper": healthbench_professional_mapper,
    },
]


def load_rows(config: dict[str, Any]) -> list[dict[str, Any]]:
    dataset = load_dataset(
        config["dataset"],
        name=config["config"],
        split=config["split"],
        streaming=True,
    )
    rows = []
    mapper: Callable[[str, dict[str, Any], int, dict[str, str]], dict[str, Any]] = config["mapper"]
    meta = {
        "dataset": config["dataset"],
        "config": config["config"],
        "split": config["split"],
    }
    for row_index, row in enumerate(dataset):
        rows.append(mapper(config["benchmark_id"], row, row_index, meta))
        if len(rows) >= ROWS_PER_BENCHMARK:
            break
    return rows


def main() -> None:
    registry = json.loads(REGISTRY_PATH.read_text())
    target_ids = {config["benchmark_id"] for config in CONFIGS}
    samples = [sample for sample in registry.get("samples", []) if sample["benchmark_id"] not in target_ids]

    added = []
    for config in CONFIGS:
        rows = load_rows(config)
        if len(rows) != ROWS_PER_BENCHMARK:
            raise RuntimeError(f"{config['benchmark_id']} produced {len(rows)} rows")
        samples.extend(rows)
        added.append((config["benchmark_id"], len(rows)))

    samples.sort(key=lambda sample: (sample["benchmark_id"], sample["sample_id"]))
    registry["samples"] = samples
    counts: dict[str, int] = {}
    for sample in samples:
        counts[sample["benchmark_id"]] = counts.get(sample["benchmark_id"], 0) + 1
    for benchmark in registry["benchmarks"]:
        benchmark["sample_count"] = counts.get(benchmark["benchmark_id"], 0)
    registry["generated_at"] = "2026-06-15T00:00:00Z"

    REGISTRY_PATH.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + "\n")
    for benchmark_id, count in added:
        print(f"{benchmark_id}: {count}")
    print(f"total samples: {len(samples)}")


if __name__ == "__main__":
    main()
