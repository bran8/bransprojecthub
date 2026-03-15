# Product Requirements Document (PRD): Retirement Maker

## 1. Goal
Retirement Maker is a PowerShell-based financial simulation tool designed to help Canadian residents (specifically in Ontario) plan their retirement. It models the complex interactions between various retirement accounts (RRIF, LIF, TFSA, Savings), government benefits (CPP, OAS), and tax implications to determine the sustainability of a desired retirement lifestyle.

## 2. Background
Retirement planning involves managing multiple "buckets" of money with different tax treatments and withdrawal rules. Users need to understand:
- How long their money will last based on different market conditions (CAGR).
- The impact of Ontario and Federal progressive tax brackets on their net income.
- When to start government benefits (CPP/OAS) for maximum effect.
- How to balance withdrawals across accounts to minimize tax "leakage."

## 3. Target Audience
- Individuals approaching retirement (ages 45-65).
- Residents of Ontario, Canada (due to specific tax modeling).
- Users looking for a customized simulation beyond standard web calculators.

## 4. Key Features

### 4.1 Financial Modeling & Simulation
- **Multi-Account Support**: Tracks and simulates balances for RRIF, LIF, TFSA, general Savings and Bitcoin.
- **CAGR & Market Volatility**: Applies a user-defined Compound Annual Growth Rate (CAGR) for each account type
- **Bear Market Modeling**:  Applies a user-defined reduced return during pre-defined "Bear Years" to simulate sequence-of-returns risk.
- **Spending Phases**:
    - **GOGO (Up to age 72)**: Higher spending for active retirement years.
    - **SLOWGO (Ages 73-84)**: Standard spending.
    - **NOGO (85+)**: Reduced spending as lifestyle slows down.

### 4.2 Tax & Government Benefit Integration
- **Progressive Tax Engine**: Blended calculation using Federal and Ontario tax brackets (2024 rates).
- **CPP (Canada Pension Plan)**:
    - Calculates benefits based on start age (65-70).
    - Includes a bonus for delayed start (8.4% per year).
- **OAS (Old Age Security)**:
    - Models 65+ benefits and 75+ boost (9%).
    - **OAS Clawback**: Calculates reductions based on net income thresholds.
- **Basic Personal Amount**: Automatically applies tax credits to eligible income levels.

### 4.3 Withdrawal Strategies
- **Smart Drawdown**: Blends withdrawals from different accounts to achieve a "Minimum Income" while staying within optimal tax brackets.
- **LIF/RRIF Compliance**: Ingests mandatory minimum and maximum withdrawal rates from external data LIF.csv, RRIF.csv
- **LIRA Unlock**: Unlock 50% the value of of LIF by moving that amount into the RRIF balance at age 55.

### 4.4 Solution Discovery ("The Solver")
- **Iterative Scenario Testing**: The tool automatically tries different retirement years and income levels to find "solutions" where the user doesn't run out of money during GOGO years.

### 5 Goal
- Re-write from HTML

## 6. User Experience
- HTML Classic interface

## 7. Future Enhancements (TODO)
- Inflation modeling for desired income.
- Graphical visualization of asset decay over time.

