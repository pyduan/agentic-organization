---
type: segment
name: The name we give them internally
slug: same-as-the-filename
status: next                  # the keys of model.statuses, in config.mjs
owner: firstname              # a key of model.owners, or a list
family: core                  # the keys of model.families. Sets the bar's colour.
population: unknown           # integer: how many people in this segment. Sets the height.
revenue: unknown              # "EUR 2.1M/yr (population × estimated ARPU)", or unknown
geography: Where they are
website:                      # the forum, the subreddit, the club where they gather
since: 2026-01                # since when we have tracked this segment, YYYY-MM
updated: 2026-01-01           # last time a human checked this file
image:                        # /images/segments/<slug>.jpg, 16:9, or empty
tags: []
facts:                        # free lines in the chart tooltip. Figures with their source.
  - "Estimated basket: … (source, year)"
key_facts:
  - Three to five lines. Each one a fact, with a subject and a verb.
  - "This is what shows on the card. A bullet containing \": \" goes in quotes, or YAML reads it as a map."
milestones:                            # dated events. They feed the timeline.
  - date: 2026-01-01
    kind: decision
    text: What happened, one line
---

## Summary

Who these people are, what they do with their time or their equipment, and why they would buy. Four
to eight lines, for someone who is not one of them.

The difference between a segment and a list of characteristics: a segment shares a **reason to
buy**. "Cyclists over fifty" is not one; "people who commute by bike in all weather and arrive soaked"
is one.

## Where we stand

How many we have reached, through which channel, and what blocks the next one.

## What we learned

Their vocabulary, what they use today, what they already pay for, and what would make them switch.
Each point with where it came from: an interview, a forum thread, a published figure.

## How many they are

The calculation, not only the result. Starting population, filters applied, and what remains. A
reader must be able to redo the calculation and find the same number, or say where they disagree.

| Step | Number | Source |
|---|---|---|

## Where to find them

The precise places: clubs, forums, events, channels, resellers. This is the part that becomes a
marketing plan.

## Open questions

What we do not know, and how we would find out.
