# Baltic Real Ship Basis Lab

Baltic Real Ship Basis Lab is a freight trading dashboard for comparing a real physical ship opportunity against the Baltic paper benchmark it is being hedged with.

The core question is simple:

**Does the real ship outperform the artificial Baltic benchmark ship, and does the paper market create a tradable basis signal?**

## What The App Does

The app analyses the delta between:

- **Physical leg:** the actual economics of a real vessel, cargo, voyage, TC-in, TC-out, bunker exposure, commissions, port costs and scrubber value.
- **Paper leg:** the Baltic benchmark route, index, FFA/futures contract, settlement rule, unit and benchmark vessel assumptions.
- **Signal:** real ship outperformance plus paper mispricing, minus hedge costs, basis risk, route mismatch, idle risk and other deductions.

It is designed for shipbrokers, freight traders and analysts who want to test whether a physical plus paper structure is a genuine basis opportunity or a false arbitrage.

## Markets Covered

The dashboard supports two separated modes:

- **Panamax:** P5TC, P1A_82, P2A_82, P3A_82, P4_82, P6_82 and related Panamax FFA settlement rules.
- **LPG / VLGC:** BLPG, BLPG1, BLPG2, BLPG3 and their $/mt paper contracts alongside BLPG-TCE $/day benchmark views.

A main toggle switches the whole app between Panamax and LPG so the two paper markets are not shown together.

## Key Workflows

### Data Health
Upload and validate Baltic index data, FFA/futures data, bunker prices, vessel specifications, route assumptions and physical opportunities.

### Benchmark Registry
Shows the Baltic paper benchmark assumptions used for the selected market, including benchmark vessel specs, headline formulas, route formulas and settlement rule metadata.

### Physical Opportunity Builder
Calculates the actual real ship voyage or TC economics and compares them with the Baltic benchmark-equivalent economics.

### Settlement Lab
Shows how the paper contract settles: market price, expected settlement, realized Baltic prints, remaining settlement days and implied remaining rate.

### Basis Decomposition
Breaks the delta into fuel efficiency, scrubber value, speed, intake/cbm, position, laycan, hire premium and costs.

### Hedge Simulator
Sizes the hedge correctly by unit:

- $/day paper uses exposure days.
- BLPG $/mt paper uses cargo tonnes, not vessel days.

### Signal Monitor
Produces a trade label such as:

- Strong long physical / short paper
- Long physical only
- Paper only
- No trade
- Dangerous false arbitrage

It also flags risks such as missing employment, unit mismatch, settlement mismatch, route mismatch, scrubber capture error and missing settlement data.

## Paper Rule Source

The paper side is aligned to the latest Baltic rule file supplied for the project:

- Panamax benchmark and FFA settlement rules
- BPI/P5TC formulas
- BPI82 standard vessel assumptions
- BLPG headline formula
- BLPG1/2/3 $/mt paper contracts
- BLPG1/2/3-TCE $/day benchmark views
- VLGC84 standard vessel assumptions

The physical side remains user-specific: it reflects the actual vessel and opportunity economics entered or uploaded by the user.

## MVP Scope

This is a client-side MVP. It includes mock Panamax and LPG data so the dashboard works immediately before uploads, and all calculations are transparent with visible units and formula tooltips.
