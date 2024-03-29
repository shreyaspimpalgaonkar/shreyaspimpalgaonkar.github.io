--- 
layout: post
title: LLM Inference Optimization Techniques 
date: 2024-03-27
description: Inference go brrrrr
tags: [LLM, RAG]
---

## Introduction

We have seen a lot of progress in the field of large language models (LLMs) in the past few years. The models have become larger and more powerful, but the inference time has also increased. This has led to the development of various techniques to optimize the inference time of LLMs. In this blog post, we will discuss some of the techniques that are commonly used to optimize the inference time of LLMs.

## List of LLM Inference Optimization Startups

[This](https://leaderboard.withmartian.com) website lists top companies in the LLM inference hosting space. A screenshot is below:

<!-- image with 100% width -->

<div style="text-align:center; padding-top: 20px; padding-bottom: 40px;">
    <img src="/assets/img/blogs/llm-inference/leaderboard.png" alt="LLM Inference Optimization Leaderboard" width="100%">


There are a lot more companies. More companies below. 

- NVIDIA
- Groq
- Lightning
- d-matrix
- Hugging Face
- SambaNova
- Graphcore
- Cerebras
- Tenstorrent
- Mythic
- Flex Logix
- Wave Computing
- Esperanto
- Syntiant
- DeepInfra
- Kneron
- Blaize
- Flex Logix
- Abacus

## Techniques for LLM Inference Optimization

Algorithmic, SOftware and Hardware optimizations are three main categoeis

### Algorithmic Optimizations

- More Efficient Models like MQA/GQA vs MHA, using less transformer layers

- S4 Models

- 


### Runtime level optimizations

- KV Caching: 

    Durnig the decoding phase, each token output needs to calculate the tensors for KV pairs for all previous tokens. This can be optimized by caching the KV pairs for each token and reusing them while generating the next token. This reduces the number of multiplications required and improve the inference time.

    Size of KV cache = `2 * batch_size * sequence_length * num_layers * hidden_size * size_of_fp16`

    We can see that the size of the cache is linear in sequence length and batch size. It is a challenge for long context models.

- Kernel Fusion:

- Tensor Layout Optimization:

- Pipeline Parallelism:

(GPipe)[https://arxiv.org/pdf/1811.06965.pdf] divides the model into multiple devices. It divides each mini-batch into micro batches and processes them in a pipeline fashion. 

<div style="text-align:center; padding-top: 20px; padding-bottom: 40px;">
    <img src="/assets/img/blogs/llm-inference/gpipe.png" alt="Gpipe Pipeline Parallelism" width="100%">


- Flash Attention

- Paged Attention

- TGI

- 



Citations: 

[1] https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/
[2] https://deci.ai/resources/webinar-llms-at-scale-top-inference-optimization-libraries/
[3] https://arxiv.org/pdf/1811.06965.pdf
[4] https://nyu-mlsys.github.io/schedule.html
