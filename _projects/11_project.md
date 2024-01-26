---
layout: page
title: Spotify Skip Prediction Challenge
description: Predicting whether a user will skip a song or not
importance: 1
category: AI
---

Given a user’s playback history in the first half of a music listening session, we predict whether the user will skip the songs in the second half or not, by using the context and metadata - a task in Web Search and Data Mining Cup '19

- Emperically validated the existing GloVE embeddings, and introduced embeddings for the complete session
- Designed a new architecture using bidirectional stacked LSTMs, and trained the model with a newly designed popularity based iterative training algorithm to reduce noise, on a 0.5TB dataset using remote GPUs
- Performed iterative training based on popularity metric on a 500GB dataset using Google Collab GPUs
- Outperformed the state-of-the-art model in predicting the first outcome by 9\%, and the overall outcome by 2\%

