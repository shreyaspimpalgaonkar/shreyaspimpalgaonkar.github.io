--- 
layout: post
title: Policy Gradient
date: 2024-03-08
description: Short introduction to policy gradient methods
tags: [RL, Policy Gradient]
---

## Introduction

Policy gradient methods are a type of reinforcement learning algorithm that directly learn the policy of an agent. The policy is a mapping from states to actions, and the goal of the agent is to learn a policy that maximizes the expected return. Policy gradient methods are particularly useful in continuous action spaces, where the policy is a probability distribution over actions. 

Policy gradient based algorithms have become quite popular in recent years, and have been successfully applied to a wide range of problems, including robotics, games, and natural language processing (RLHF!).

## Objective

The objective of policy gradient methods is to maximize the expected return by adjusting the policy parameters. The expected return is defined as the expected sum of rewards over a trajectory, and the policy parameters are adjusted using the gradient of the expected return with respect to the policy parameters.

The policy is typically parameterized by a neural network with parameters $$\theta$$, and the gradient of the expected return with respect to the policy parameters is given by the policy gradient:

$$
\nabla_{\theta} J(\theta) = \mathbb{E}_{\tau \sim \pi_{\theta}} \left[ \sum_{t=0}^{T} \nabla_{\theta} \log \pi_{\theta}(a_t|s_t) R(\tau) \right]
$$

where $$\pi_{\theta}$$ is the policy, $$\tau$$ is a trajectory, $$s_t$$ is the state at time $$t$$, $$a_t$$ is the action at time $$t$$, and $$R(\tau)$$ is the return of the trajectory.

