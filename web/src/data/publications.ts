export const ME = "Shreyas Pimpalgaonkar";

export type Pub = {
  abbr: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  month: number; // 1-12, for sorting
  links: { arxiv?: string; html?: string; pdf?: string; code?: string };
  abstract?: string;
};

// Migrated from _bibliography/papers.bib, newest first.
export const PUBLICATIONS: Pub[] = [
  {
    abbr: "arXiv",
    title:
      "Terminal-Bench: Benchmarking Agents on Hard, Realistic Tasks in Command Line Interfaces",
    authors:
      "Mike A. Merrill, Alexander G. Shaw, Nicholas Carlini, … Shreyas Pimpalgaonkar, … Andy Konwinski, Ludwig Schmidt",
    venue: "arXiv preprint",
    year: 2026,
    month: 1,
    links: { html: "https://arxiv.org/abs/2601.11868", arxiv: "https://arxiv.org/abs/2601.11868" },
    abstract:
      "AI agents may soon become capable of autonomously completing valuable, long-horizon tasks in diverse domains. Current benchmarks either do not measure real-world tasks, or are not sufficiently difficult to meaningfully measure frontier models. To this end, we present Terminal-Bench 2.0: a carefully curated hard benchmark composed of 89 tasks in computer terminal environments inspired by problems from real workflows. Each task features a unique environment, human-written solution, and comprehensive tests for verification. We show that frontier models and agents score less than 65% on the benchmark and conduct an error analysis to identify areas for model and agent improvement.",
  },
  {
    abbr: "Benchmark",
    title: "OpenThoughts-TBLite: A High-Signal Benchmark for Iterating on Terminal Agents",
    authors: "OpenThoughts Team",
    venue: "OpenThoughts blog (with Snorkel AI and Bespoke Labs)",
    year: 2026,
    month: 2,
    links: { html: "https://www.openthoughts.ai/blog/openthoughts-tblite" },
    abstract:
      "OpenThoughts-TBLite is a difficulty-calibrated collection of 100 Terminal-Bench tasks spanning 9 categories that closely tracks Terminal-Bench 2.0 scores (r = 0.911) while running much faster, giving a higher-signal benchmark for debugging, iteration, and training ablations on terminal agents.",
  },
  {
    abbr: "arXiv",
    title: "OpenThoughts: Data Recipes for Reasoning Models",
    authors:
      "Etash Guha, Ryan Marten, … Shreyas Pimpalgaonkar, … Alexandros G. Dimakis, Ludwig Schmidt",
    venue: "arXiv preprint",
    year: 2025,
    month: 6,
    links: { html: "https://arxiv.org/abs/2506.04178", arxiv: "https://arxiv.org/abs/2506.04178" },
    abstract:
      "Reasoning models have made rapid progress on many benchmarks involving math, code, and science. The OpenThoughts project aims to create open-source datasets for training reasoning models. Our OpenThoughts2-1M dataset led to OpenThinker2-32B, the first model trained on public reasoning data to match DeepSeek-R1-Distill-32B on benchmarks such as AIME and LiveCodeBench. Scaling to 1.2M examples with QwQ-32B as teacher yields OpenThoughts3-7B, achieving state-of-the-art results (e.g., 53% on AIME 2025, 51% on LiveCodeBench, 54% on GPQA Diamond).",
  },
  {
    abbr: "ICLR",
    title: "Transformers Struggle to Learn to Search",
    authors:
      "Abulhair Saparov, Srushti Pawar, Shreyas Pimpalgaonkar, Nitish Joshi, Richard Yuanzhe Pang, Vishakh Padmakumar, Seyed Mehran Kazemi, Najoung Kim, He He",
    venue: "ICLR 2025",
    year: 2025,
    month: 4,
    links: { html: "https://openreview.net/forum?id=9cQB1Hwrtw", arxiv: "https://arxiv.org/abs/2412.04703" },
    abstract:
      "Search is foundational to many important tasks, and recent studies have shown that large language models struggle to perform search robustly. Using the graph connectivity problem as a testbed to generate effectively limitless high-coverage data, we train small transformers and test whether they can learn to search. Given the right training distribution, the transformer learns to search, and a mechanistic interpretability analysis shows that it performs search at every vertex in parallel. However, as the input graph grows, the task becomes harder to learn, and this is not resolved by adding parameters or chain-of-thought, suggesting that scale alone will not yield robust search.",
  },
  {
    abbr: "Software",
    title: "Curator: A Tool for Synthetic Data Creation",
    authors:
      "Ryan Marten, Trung Vu, Charlie Cheng-Jie Ji, Kartik Sharma, Shreyas Pimpalgaonkar, Alexandros G. Dimakis, Maheswaran Sathiamoorthy",
    venue: "Bespoke Labs, open-source software",
    year: 2025,
    month: 1,
    links: { html: "https://github.com/bespokelabsai/curator", code: "https://github.com/bespokelabsai/curator" },
    abstract:
      "Bespoke Curator is an open-source Python library for synthetic data curation for post-training and structured data extraction. It lets users build synthetic data pipelines with structured outputs, caching, fault recovery, and a built-in data viewer.",
  },
  {
    abbr: "Model",
    title: "Bespoke-MiniChart-7B: Pushing the Frontiers of Open VLMs for Chart Understanding",
    authors: "Bespoke Labs",
    venue: "Bespoke Labs blog",
    year: 2025,
    month: 4,
    links: { html: "https://www.bespokelabs.ai/blog/bespoke-minichart-7b" },
    abstract:
      "Bespoke-MiniChart-7B is an open 7B vision-language model for chart understanding and chart question answering that sets a new state of the art among open VLMs of its size.",
  },
  {
    abbr: "Model",
    title: "Bespoke-Stratos: The Unreasonable Effectiveness of Reasoning Distillation",
    authors: "Bespoke Labs",
    venue: "Bespoke Labs blog",
    year: 2025,
    month: 1,
    links: { html: "https://www.bespokelabs.ai/blog/bespoke-stratos-the-unreasonable-effectiveness-of-reasoning-distillation" },
    abstract:
      "Bespoke-Stratos is a pair of reasoning models (7B and 32B) distilled from DeepSeek-R1 using Berkeley NovaSky's Sky-T1 data pipeline on 17k curated examples. The models outperform Sky-T1 and OpenAI's o1-preview on math and code reasoning benchmarks while using far fewer training examples.",
  },
  {
    abbr: "Model",
    title: "Triplex: A SOTA LLM for Knowledge Graph Construction",
    authors: "Shreyas Pimpalgaonkar, Nolan Tremelling, Owen Colegrove",
    venue: "Hugging Face (SciPhi.AI)",
    year: 2024,
    month: 7,
    links: { html: "https://huggingface.co/SciPhi/Triplex" },
    abstract:
      "Triplex is a fine-tuned version of Phi3-3.8B that builds knowledge graphs from unstructured text by extracting triplets (subject, predicate, object), constructing knowledge graphs at a large cost reduction relative to using GPT-4.",
  },
  {
    abbr: "ICON",
    title:
      "Introduction to ProverbNet: An Online Multilingual Database of Proverbs and Comprehensive Metadata",
    authors: "Shreyas Pimpalgaonkar, Dhanashree Lele, Malhar Kulkarni, Pushpak Bhattacharyya",
    venue: "ICON 2021",
    year: 2021,
    month: 12,
    links: { html: "https://aclanthology.org/2021.icon-main.78" },
    abstract:
      "ProverbNet is a novel online multilingual database of proverbs and comprehensive metadata equipped with a multipurpose search engine to store, explore, understand, classify and analyze proverbs and their metadata. It has immense applications including machine translation, cognitive studies and learning tools, with 2320 Sanskrit and 1136 Marathi proverbs and their metadata.",
  },
];
