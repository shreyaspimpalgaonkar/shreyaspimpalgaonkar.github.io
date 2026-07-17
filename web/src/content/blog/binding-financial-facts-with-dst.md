---
title: Teaching a 135M model to keep financial facts attached
date: 2026-07-16
description: A controlled LoRA ablation on synthetic card comparisons, where explicit semantic tags reached 64/64 held-out critical passes.
tags: [llm, post-training, lora, synthetic-data, evals]
---

## The question

Small language models can copy facts. The harder question is whether they can keep
each fact attached to the right entity.

Suppose a prompt contains four fictional cards with long, similar names. Each card
has its own annual fee, purchase APR, and reward multiplier. A response that copies
every number but swaps two fees is fluent and wrong.

I wanted to test a narrow version of this problem:

> Can a 135M-parameter model learn reliable product-to-fact binding from 300
> synthetic training examples?

I compared ordinary supervised fine-tuning with
[Dynamic Semantic Tags Reduce Hallucinations in Small-LLM Post-Training](https://files.bespokelabs.ai/ck-bespoke-tr.pdf),
which introduces Dynamic Semantic Tags (DST).
The tags put an explicit scope around each critical value:

```text
<card1__annual_fee>$0</card1__annual_fee>
<card2__annual_fee>$95</card2__annual_fee>
```

The interesting part is not the markup by itself. It is that the same structure
used during training can become a deterministic interface at release time.

## The experiment

The base model was
[`HuggingFaceTB/SmolLM2-135M-Instruct`](https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct).
I trained three [LoRA](https://arxiv.org/abs/2106.09685) adapters:

| Adapter        | Training distribution                     | Target format |
| -------------- | ----------------------------------------- | ------------- |
| Naive plain    | 98% of product slots have a $0 annual fee | Plain text    |
| Balanced plain | Four fee tiers are equally represented    | Plain text    |
| Balanced DST   | The same balanced scenarios               | Scoped tags   |

Each adapter saw 300 examples: 100 with two products, 100 with three, and 100 with
four. The names were deliberately long and similar, with `™` and `℠` symbols, so
that copying and segmentation were not trivial.

The naive set contained 900 product slots. Exactly 882 had a $0 annual fee. The
balanced sets had 225 slots in each fee tier: $0, $95, $250, and $550. Five prompt
templates were allocated evenly, and product order was permuted across examples.

The held-out set contained 64 examples arranged into 32 counterfactual pairs.
Sixteen pairs changed a fee; sixteen changed product order. Product names, prompt
hashes, and template families were disjoint between training and evaluation.

All 900 canonical training rows passed curation. The longest DST example was 2,047
tokens, one token below the 2,048-token training limit. That exact boundary looked
suspicious, so I audited prompt and completion lengths separately: the full record
was present, the completion was 563 tokens, and no row was truncated.

## Training

The result in this post comes from one Modal/H100 run. Each adapter used 75
optimizer steps, a physical batch size of 1, gradient accumulation of 4, and
therefore exactly 300 example presentations: one effective epoch.

| Adapter        | Train loss | Wall time | Peak GPU memory | Adapter size |
| -------------- | ---------: | --------: | --------------: | -----------: |
| Naive plain    |     0.1152 |    64.4 s |         1.73 GB |     23.12 MB |
| Balanced plain |     0.1155 |    56.4 s |         1.75 GB |     23.12 MB |
| Balanced DST   |     0.0637 |   557.6 s |         2.74 GB |     23.12 MB |

All three adapters had 4,884,480 trainable parameters. Prompt tokens were masked
and only completion tokens contributed to the loss. After each run I generated
one unseen example; all three outputs were nonempty and passed the critical gate.

The DST run took much longer because its prompts and completions were roughly
twice as long. Its median full sequence was 1,574 tokens, compared with 828–835
for the plain conditions.

The workshop notebook has a separate prospective T4 configuration: 70 optimizer
steps with gradient accumulation 8, or 560 example presentations. Those settings
are not the source of the results below. I am keeping the H100 evidence and the T4
reproduction separate rather than treating two training budgets as one run.

## Evaluation

I evaluated five conditions on the same 64 held-out examples:

1. The base model with a plain prompt.
2. The base model asked to produce tagged output.
3. The naive plain adapter.
4. The balanced plain adapter.
5. The balanced DST adapter.

Generation used a persistent vLLM service with all three adapters loaded and a
2,048-token output limit. The complete evaluation produced 320 generations in
409.7 seconds.

The field columns below are entity-bound exact matches. For a plain response, the
evaluator first finds the unique product name, isolates that product's segment,
and checks its fee, APR, and reward inside that segment. **Binding** means all four
critical fields are correct for the same product. **Critical pass** is stricter:
every product must be completely bound, the tag structure must be exact when tags
are expected, and the deterministic release checks must all pass.

For plain conditions, tag validity is 100% by definition because no tag contract
is required. It should not be read as evidence that those outputs contain tags.

| Condition           |       Name |        Fee |        APR |     Reward |    Binding |  Tag valid | Critical pass |
| ------------------- | ---------: | ---------: | ---------: | ---------: | ---------: | ---------: | ------------: |
| Base, plain prompt  |      65.1% |      58.9% |      60.9% |      49.5% |      46.9% |     100.0% |          0.0% |
| Base, tagged prompt |      73.0% |      78.4% |      77.1% |      80.2% |      55.1% |       0.0% |          0.0% |
| Naive plain LoRA    |      99.2% |      98.7% |      98.4% |      99.2% |      97.9% |     100.0% |         93.8% |
| Balanced plain LoRA |      99.2% |      98.4% |      98.4% |      98.4% |      98.4% |     100.0% |         96.9% |
| Balanced DST LoRA   | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** | **100.0%** |    **100.0%** |

The balanced DST adapter passed 64 of 64 examples. The 95% Wilson interval for a
64/64 result is 94.3%–100.0%. The sample count matters: this is a clean result on
this held-out set, not evidence of universal reliability.

## Prompting for tags was not enough

The tagged base prompt improved the field-level numbers, but the result is
confounded. Sixty of its 64 generations hit the 2,048-token output ceiling.
None produced a complete, valid tag set.

The model often copied useful values and then continued generating until it was
cut off. So the 0% tag-validity result does not isolate whether tagged prompting
helps. It shows that requesting a schema and learning a schema are different
things for this model.

The other 256 generations ended without hitting the limit.

## Counterfactuals

Changing the output is easy. Staying correct after the input changes is harder.
For each pair, I required both responses to preserve exact fees and complete
product-field binding.

| Condition           | Counterfactual pair remained correct |
| ------------------- | -----------------------------------: |
| Base, plain prompt  |                                18.8% |
| Base, tagged prompt |                                12.5% |
| Naive plain LoRA    |                                90.6% |
| Balanced plain LoRA |                                96.9% |
| Balanced DST LoRA   |                           **100.0%** |

The DST adapter remained correct on all 32 pairs. It also changed its output for
every changed input.

Here is part of one real held-out generation:

```text
<card1__card_name>Fictional Paper Horizon ℠ Household Purchase Chronicle
Purchase Card</card1__card_name> ... has an annual fee of
<card1__annual_fee>$0</card1__annual_fee> ...

<card2__card_name>Fictional Paper Horizon ℠ Household Purchase Chronicle
Rewards Card</card2__card_name> ... has an annual fee of
<card2__annual_fee>$95</card2__annual_fee> ...
```

The names differ by one word. The evaluator does not give partial credit for
putting the right fee under the wrong product.

## The release gate

The tags are useful because validation can be mechanical.

I took an actual held-out output from the balanced DST adapter and ran it through
the release validator. The validator checked the complete tag set and compared
each scoped value with the source record. The output passed, the internal tags
were removed, and the customer-facing text was released.

Then I replaced one annual fee in the same output. The validator blocked it and
returned a deterministic fallback rendered only from source values. The only
recorded failure was the sabotaged product's annual-fee binding.

The important decision is not made by an LLM judge, model confidence, or the
fluency of the answer. It is made by the validator.

## What surprised me

I expected the 98% fee skew to hurt the naive adapter more. It did not. The naive
plain adapter still reached 98.7% fee accuracy and passed 60 of 64 examples. The
balanced plain adapter passed 62 of 64.

The distribution created a plausible shortcut, but this particular task made
literal fee copying easy enough that the shortcut did not dominate. The two-example
gap between the plain adapters is a small signal, not a dramatic result.

The larger separation came from the control boundary. Plain fine-tuning made the
model very accurate. DST made every critical value explicitly addressable and
gave the release system a schema it could enforce.

## Limitations

- The evaluation has 64 synthetic examples and 32 counterfactual pairs.
- All product names and customer profiles are fictional.
- The held-out set contains six nonzero variable APR ranges and no 0% APR values.
  The experiment tests annual-fee skew, not generalization from a skewed APR
  distribution.
- The base tagged-prompt comparison is dominated by output truncation.
- The reported result is from the 75-step H100 run. The separate T4 workshop run
  should be reported independently when it finishes.
- This experiment demonstrates packaging and deterministic release validation. It
  is not a claim about regulatory compliance or production hosting.

The narrow conclusion is still useful: for this synthetic binding task, 300
examples were enough to teach a 135M model a strict semantic interface. The model
generated the text, but the interface made correctness testable.

---

_Experiment artifacts: run `run-20260716-v1`; seed `20260716`; held-out SHA-256
`c73179bf8d4b6f69d5c10b478014d14095fbbba84b3804c80ec1e166588d917f`.
The evaluation used exact string matching within product scope and a deterministic
release validator._
