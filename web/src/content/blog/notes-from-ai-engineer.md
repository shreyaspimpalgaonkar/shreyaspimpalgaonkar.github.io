---
title: Notes from AI Engineer
date: 2026-07-06
description: Six takeaways from the AI Engineer conference.
tags: [ai, agents, conference]
---

I attended AI Engineer last week and I think it's one of the frontier conferences for what's going on in the world right now. Here are my main takeaways:

## 1. Building is cheap, value creation is still expensive

Everyone is building. Building has gone one level up: what used to take months can now be done with a single prompt. Hackathons are single prompts now, startups are weekend hackathons, and what used to be a massive idea can be a startup. The ceiling is now at the level of what we can imagine. So the move is to cast a wide net and build something big. The uncomfortable part is that even if we all build a lot more, the amount of money in the world hasn't increased much, so finding what people will actually pay for is still the hard problem.

## 2. Set up agents so they're rarely blocked on you

People have a lot of confidence in what agents can do now, and where agents fall short, it's easy to help them. The frontier is at a point where large parts of work can just be done by agents. So the work shifts: set up agents to do the job, and get yourself in the loop only when needed. It's worth real effort to arrange things so agents are blocked by you as little as possible, and so they learn and keep improving over time.

## 3. Continual learning without changing the weights

Continual learning and post training are both scaling up massively. Skills, long term memory, dreaming, plus a lot of new frameworks and infra, all aimed at making agents improve without touching the weights. Post training demand is picking up too, since enterprises now have the capability and are looking to cut costs. A lot of environments are getting built for this. I think some of the more advanced agents will eventually build their environments on the fly and we'll see interaction based continual learning. Nobody knows yet how to make continually learning agents work in production though.

## 4. RL environments: long horizon, realistic, and taste based

Environment curation is going in three directions: long horizon, as realistic as possible, and personalized around taste. We already know at Bespoke that frontier agents can do a lot of realistic, deterministic, short horizon verifiable tasks. So people are building longer horizon tasks, and algorithms to train models on the partial rollouts those tasks generate. There are thousands of evals and benchmarks out there and very few capture scenarios agents actually face in the real world. Taste is still underexplored, Anthropic and Claude's design work aside, but it's picking up. People call it ending slop.

## 5. Agentic interfaces are going to change

Managed agents are coming. VS Code, Cursor, and vim are the agentic interfaces of today because that's what humans are comfortable with, not because they're what agents need. The way agents operate will look quite different from how we work, and interfaces will follow them there.

## 6. Garry Tan on agent-native, 400x companies

Humans have a working memory of 7 to 9 digits. Agents hold three full books. The capability is there, the problem is presenting them the right three books to get the best possible answer. Agents already do most of the execution but they need a brain. Tan's advice was to start building that brain now: pass every problem through it first, then use human input to make the brain better, more usable, and more intelligent.
