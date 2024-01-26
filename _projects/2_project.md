---
layout: page
title: BO-MLE
description: Bayesian Optimization for Discrete Choice Model Likelihood Estimation
importance: 2
category: AI
---

In this study, we examine Bayesian Optimization (BO) as an alternative to Maximum Likelihood Estimation (MLE) for logit choice models. Our findings show that while BO quickly converges to local minima, it can struggle to identify global optima efficiently. However, with extensive iterations, its accuracy approaches that of MLE. We propose a novel hybrid method, combining MLE’s precision with the convergence speed of Parallel Bayesian Optimization, achieving comparable accuracy to MLE but more efficiently. This approach is especially pertinent for complex models,
highlighting the potential of our hybrid method in computationally challenging scenarios.