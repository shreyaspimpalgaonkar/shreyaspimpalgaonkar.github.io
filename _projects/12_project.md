---
layout: page
title: Flush+Reload attack
description: Predicting flush+reload attack on LLC to extract private keys
importance: 1
category: Software
---

- Implemented the Flush+Reload attack on LLC to extract private keys of the victim process running on a different core
- Used timing attacks and an exact copy of the function location to determine the exact bits of the private key
- Proposed modifications in architecture as well as algorithm to mitigate effects of such side channel attacks 
