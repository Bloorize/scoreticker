# Fair Playoff Ranking Formula

## Philosophy
The goal is to rank teams based on **what they've accomplished**, not who they are or what conference they're in. No auto-bids. Every team earns their spot.

## Formula Components (REVISED - SOR is PRIMARY)

### 1. **Strength of Record (SOR)** (50% weight) - PRIMARY FACTOR
- **Formula**: `(100 - SOR) / 100 * 50`
- Lower SOR = better (SOR 2 = 49 points, SOR 35 = 32.5 points, SOR 56 = 22 points)
- This measures quality of wins relative to schedule
- **SOR is now the most important factor** - you can't fake quality wins
- Teams with SOR > 100 get 0 points (they haven't proven themselves)

### 2. **Base Score from Wins** (30% weight)
- **Formula**: `(Wins / Total Games) * 100 * 0.30`
- More wins = better, but normalized by games played
- Example: 11-1 = 91.7% * 30 = 27.5 points, 9-3 = 75% * 30 = 22.5 points
- Still important, but quality matters more than quantity

### 3. **Quality Wins Bonus** (10% weight)
- Based on SOR quality:
  - **SOR ≤ 10**: Bonus = (10 - SOR) * 2 * 0.10 (elite teams get big bonus)
  - **SOR ≤ 30**: Bonus = (30 - SOR) * 0.5 * 0.10 (good teams get moderate bonus)
  - **SOR > 30**: No bonus (you haven't proven quality wins)

### 4. **Loss Penalty** (10% weight)
- Penalty based on SOR quality (teams with good SOR likely lost to good teams):
  - **SOR ≤ 15**: -1.5 points per loss (excellent SOR = good losses)
  - **SOR ≤ 40**: -3 points per loss (good SOR = mixed losses)
  - **SOR > 40**: -6 points per loss (poor SOR = likely bad losses)

### 5. **Conference Strength Multiplier** - STRONGER for G5 with weak SOR
- **Power 5**: 1.0x (no change)
- **Group of 5**:
  - **SOR > 40**: 0.85x (heavy penalty - played nobody)
  - **SOR > 25**: 0.90x (moderate penalty)
  - **SOR ≤ 25**: 0.95x (slight penalty - they earned it)
- **This ensures G5 teams with weak schedules don't get in**

## Final Score Calculation

```
Final Score = (
    (SOR Score * 0.50) +           // PRIMARY FACTOR
    (Base Win Score * 0.30) +      // Secondary
    (Quality Wins Bonus * 0.10) +   // Bonus
    (Loss Penalty * 0.10)           // Penalty
) * Conference Multiplier
```

## Example Calculations

### Example 1: Indiana (11-1, SOR: 2)
- Base Score: (11/12) * 100 = 91.7 * 0.40 = **36.7**
- SOR Score: (100-2)/100 = 98 * 0.35 = **34.3**
- Quality Wins: Assume 3 top-25 wins = 9 * 0.15 = **1.4**
- Loss Penalty: 1 loss to top-10 = -2 * 0.10 = **-0.2**
- **Total: ~72.2 points**

### Example 2: Tulane (11-1, SOR: 56) - G5 with weak SOR
- SOR Score: (100-56)/100 = 44 * 0.50 = **22.0** (weak SOR hurts)
- Base Score: (11/12) * 100 = 91.7 * 0.30 = **27.5**
- Quality Wins: SOR > 30 = **0** (no bonus)
- Loss Penalty: 1 loss, SOR > 40 = -6 * 0.10 = **-0.6**
- Conference Multiplier: 0.85 (G5 with weak SOR = heavy penalty)
- **Total: ~41.6 points** (would rank much lower - G5 with weak schedule)

### Example 2b: BYU (9-3, SOR: 35) - P5 with decent SOR
- SOR Score: (100-35)/100 = 65 * 0.50 = **32.5** (better SOR than Tulane!)
- Base Score: (9/12) * 100 = 75 * 0.30 = **22.5**
- Quality Wins: SOR 35 = (30-35) = 0, but SOR ≤ 40 gets small bonus = **0.5**
- Loss Penalty: 3 losses, SOR ≤ 40 = -3 * 3 * 0.10 = **-0.9**
- Conference Multiplier: 1.0 (P5)
- **Total: ~54.6 points** (RANKS HIGHER than Tulane despite fewer wins!)

### Example 3: Alabama (10-2, SOR: 5)
- Base Score: (10/12) * 100 = 83.3 * 0.40 = **33.3**
- SOR Score: (100-5)/100 = 95 * 0.35 = **33.3**
- Quality Wins: Strong schedule = 15 * 0.15 = **2.3**
- Loss Penalty: 2 losses to top teams = -4 * 0.10 = **-0.4**
- **Total: ~68.5 points**

## Ranking Rules

1. **Sort by Final Score** (highest to lowest)
2. **Top 12 teams** make the playoff
3. **No auto-bids** - every team earns their spot
4. **Head-to-head** can break ties if teams played each other
5. **Common opponents** can break ties if head-to-head doesn't apply

## Why This Works

- **SOR-heavy**: Rewards teams that beat good teams, not just win games
- **Win total matters**: But quality matters more (40% vs 35%)
- **Penalizes weak schedules**: G5 teams need exceptional SOR to compete
- **Rewards tough schedules**: Playing and beating good teams pays off
- **Fair**: No politics, no auto-bids, just results

## Edge Cases

- **Undefeated teams**: Get massive boost from base score + perfect SOR
- **1-loss teams**: Can still rank high if SOR is excellent
- **2-loss teams**: Need excellent SOR and quality wins
- **G5 teams**: Need SOR < 30 AND 11+ wins to realistically compete

