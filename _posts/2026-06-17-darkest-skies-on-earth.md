---
layout: post
title: Where are the darkest skies on Earth?
date: 2026-06-17
description: Finding the Bortle-1 point farthest from any artificial light, using the World Atlas of Artificial Night Sky Brightness
tags: [maps, data, astronomy]
---

## The question

The [Bortle scale](https://en.wikipedia.org/wiki/Bortle_scale) rates how dark a
night sky is, from **Class 1** (pristine — the Milky Way casts shadows) to Class
9 (inner-city). I wanted to answer a simple geometric question:

> What is the point with a **Bortle-1** sky that is **farthest from any point
> with a Bortle &gt; 1** sky?

In other words: where on Earth can you stand under a perfect sky and be as far as
possible from the nearest artificial glow? Equivalently, this is the **largest
empty circle** problem — the biggest circle you can draw that contains only
pristine sky, with the nearest light touching its edge. I also pulled out the
**top 5 circles by radius**.

## The data

I used the **World Atlas of Artificial Night Sky Brightness** (Falchi et al.,
2016), the canonical global light-pollution dataset. It models the *artificial*
component of zenith sky brightness (the natural background of ~174 µcd/m² is
excluded) at 30 arc-second resolution (~0.9 km), covering **60°S to 85°N**.

I classified a cell as **Bortle 1** when its artificial brightness is below 1% of
the natural background (the standard "pristine sky" threshold), and treated
everything brighter as an obstacle. To avoid washing away small light sources
(island towns, ships), I **max-pooled** the raster down to a 0.05° working grid —
a cell counts as lit if *any* sub-pixel within it is lit. Distances are true
**great-circle** distances, computed with a KD-tree on 3-D unit-sphere
coordinates (a flat pixel distance would be badly wrong near the poles).

<div style="text-align:center; padding-top: 10px; padding-bottom: 20px;">
    <img src="/assets/img/blogs/bortle/hero_pacific.png" alt="World map of the largest Bortle-1 dark-sky circles" width="100%">
</div>

## The answer

Unsurprisingly, **the open ocean wins** — the darkest, most light-remote places
on Earth are in the middle of the great ocean basins, not on land.

The single **largest fully-measured pristine-sky circle** is centered in the
equatorial **South Pacific**:

> **4.3°S, 115.9°W — radius ≈ 2,619 km.**
> The nearest artificial light is **2,619 km away in the Marquesas Islands**
> (French Polynesia).

You could place a circle 5,200 km across there and not enclose a single
artificial photon. This result is remarkably stable — the radius stays within
2,615–2,620 km whether I set the Bortle-1 threshold at 0.5% or 5% of the natural
background.

### Top 5 circles by radius (global, ocean + land)

| # | Center (lat, lon) | Radius | Nearest light | Notes |
|---|---|---|---|---|
| 1 | 59.97°S, 133.28°W | 3,694 km | Austral Is. | **Edge-limited** — sits on the 60°S data boundary; true radius is even larger (see below) |
| 2 | **4.3°S, 115.9°W** | **2,619 km** | Marquesas Is. | **Largest fully-measured circle** (South Pacific) |
| 3 | 31.3°S, 84.7°E | 2,472 km | Rodrigues Is. | South Indian Ocean |
| 4 | 12.1°N, 132.9°W | 2,462 km | Hawai‘i | NE Pacific |
| 5 | 33.7°S, 18.6°W | 2,355 km | Brazil coast | South Atlantic |

<div style="text-align:center; padding-top: 10px; padding-bottom: 20px;">
    <img src="/assets/img/blogs/bortle/zoom_pacific.png" alt="Zoom of the South and Central Pacific dark-sky circles" width="70%">
</div>

### The Antarctica caveat

The #1 circle lands *exactly* on the dataset's 60°S southern edge. That's an
artifact: the Falchi atlas stops at 60°S, but everything beyond it — the Southern
Ocean and Antarctica — is even darker. So its true radius is larger than measured,
and the **literal** answer to "farthest from any artificial light" is somewhere in
the **Antarctic interior**, trivially Bortle 1 and thousands of km from the nearest
research-station lights. It just isn't in this dataset. Among the fully-measured
circles, the South Pacific is the honest winner.

### Best dark skies on land

If you actually want to *stand* somewhere, the land winners are the world's most
remote islands:

| # | Place | Center (lat, lon) | Radius |
|---|---|---|---|
| 1 | Tristan da Cunha | 37.1°S, 12.3°W | 1,897 km |
| 2 | Île Amsterdam | 37.8°S, 77.6°E | 1,707 km |
| 3 | NW Hawaiian Is. (Kure/Midway) | 25.8°N, 171.7°W | 1,274 km |
| 4 | Line Islands (Kiribati) | 2.9°S, 171.6°W | 1,188 km |
| 5 | Pitcairn / Ducie | 24.4°S, 128.3°W | 1,064 km |

## Method notes

- Working grid: 0.05° (~5.5 km), max-pooled from the native 30″ raster.
- Bortle-1 threshold: artificial zenith brightness &lt; 1% of the 174 µcd/m²
  natural background (≈ 0.00174 mcd/m²). Results are insensitive to this choice.
- Top circles are well-separated local maxima found by greedy great-circle
  non-maximum suppression (each new circle must lie outside the previously
  selected ones).

---

*Data: Falchi, F. et al., "The new world atlas of artificial night sky
brightness," **Science Advances** 2, e1600377 (2016),
[doi:10.1126/sciadv.1600377](https://doi.org/10.1126/sciadv.1600377); dataset via
GFZ Data Services, [doi:10.5880/GFZ.1.4.2016.001](https://doi.org/10.5880/GFZ.1.4.2016.001)
(CC BY-NC 4.0).*
