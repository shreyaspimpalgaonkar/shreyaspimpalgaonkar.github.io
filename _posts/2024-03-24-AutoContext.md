--- 
layout: post
title: AutoContext 
date: 2024-03-24
description: Automatically keep context for your LLM interactions
tags: [LLM, RAG]
---

## Introduction

In this post, we will cover a tool called AutoContext that me and my team developed at IvyHacks 2024. We won the SciPhi sponsor prize for this project.

## Use Cases

- You're a programmer and you are browsing obscure documentation on the internet. You ask ChatGPT questions about the documentation but it has no idea. You copy relevant parts of the documentation and paste it into ChatGPT's window and ask it questions again. Hopefully, ChatGPT will be able to answer your questions this time. But it is tedious to optimize what to copy-paste while still being in the context limit. It is not scalable and manual leading to suboptimal interactions with the LLM.

- You are a researcher and you are browsing papers on the internet. You ask ChatGPT questions about the papers but it has no idea. You copy relevant parts of the papers and paste it into ChatGPT's window and ask it questions again. Hopefully, ChatGPT will be able to answer your questions this time. But it is tedious to optimize what to copy-paste while still being in the context limit. It is not scalable and manual leading to suboptimal interactions with the LLM.

There are many more such use cases where ChatGPT needs context to answer questions. AutoContext is a tool that helps you provide context to ChatGPT in a scalable and automated way. Not only it works with ChatGPT but it can be used with any LLM.

## How it works

Simply just install the chrome extension and browse the internet. The extension will automatically store the content into its memory without you having to do anything. We define context into three parts: short term, long term and personal. 

<div style="text-align:center; padding-top: 20px; padding-bottom: 20px;">
    <img src="/assets/img/blogs/autocontext/memory.png" alt="AutoContext Memory" width="50%">
</div>

Now, when you ask LLM a question, the extension will automatically fetch the relevant context from its memory and paste it into the LLM's window. This way you can ask questions to LLM without worrying about fetching the content. This is what it looks like:

<div style="text-align:center; padding-top: 20px; padding-bottom: 40px;">
    <img src="/assets/img/blogs/autocontext/claude.png" alt="AutoContext Demo" width="100%">
</div>


## Final Thoughts

We're excited to be working on this project and we believe it will help a lot of people. We're still finalizing some parts and will be releasing it soon. Shoot me an email if you have any questions! Stay tuned for more updates 🦾