import type {
  FfaContractRow,
  HedgeResult,
  PhysicalOpportunityRow,
  PhysicalResult,
  RouteDistanceRow,
  SettlementResult,
  SignalResult,
} from "../types";
import { money, rate } from "./format";

export type TradeActionPlan = {
  tradeClass:
    | "true arbitrage"
    | "basis trade"
    | "relative value trade"
    | "directional freight trade"
    | "physical-only trade"
    | "paper-only trade"
    | "no trade"
    | "dangerous false arbitrage";
  shipAction: string;
  derivativeAction: string;
  employmentMode: "fix spot voyage" | "put out on TC" | "cover COA/cargo" | "relet voyage" | "do not employ yet";
  paperSide: "SHORT" | "LONG" | "NONE";
  actionSteps: string[];
  doNotDo: string[];
  stopLoss: string;
  exitTrigger: string;
  rationale: string;
};

export function buildTradeActionPlan(input: {
  opportunity: PhysicalOpportunityRow;
  route: RouteDistanceRow;
  contract: FfaContractRow;
  physical: PhysicalResult;
  settlement: SettlementResult;
  hedge: HedgeResult;
  signal: SignalResult;
  finalPnl: number;
}): TradeActionPlan {
  const { opportunity, route, contract, physical, settlement, hedge, signal, finalPnl } = input;
  const shortPaperIsRich = settlement.paperEdgeShort > Math.max(250, contract.price * 0.01);
  const longPaperIsCheap = settlement.paperEdgeLong > Math.max(250, contract.price * 0.01);
  const physicalEdgeIsGood = physical.physicalEdge > 0 && physical.shipSpecBasis > 0;
  const hasEmployment =
    opportunity.employment_status !== "NONE" &&
    !(opportunity.trade_type === "TC_IN_ONLY" && !opportunity.freight_rate && !opportunity.tc_out_hire);

  if (!hasEmployment) {
    return {
      tradeClass: "dangerous false arbitrage",
      shipAction:
        "Do not keep an open TC-in position as an arbitrage. First secure either a cargo/spot voyage, a voyage relet, or a TC-out at or above the required TC-out level.",
      derivativeAction:
        "Do not put on the FFA hedge yet. Without cargo tonnes, voyage days, or TC-out cover, the paper size is not anchored to a real exposure.",
      employmentMode: "do not employ yet",
      paperSide: "NONE",
      actionSteps: [
        `Quote cargo or TC-out cover immediately; minimum TC-out target is ${rate(physical.requiredTcOut, "$/day")} or freight target is ${rate(physical.requiredFreightPerMt, "$/mt")}.`,
        "Only after employment is fixed, re-run the plan and size the paper hedge against actual days or cargo tonnes.",
        "If no employment is available, redeliver/sublet/avoid extending the TC-in exposure rather than treating the FFA as a hedge.",
      ],
      doNotDo: [
        "Do not short paper just because the FFA looks rich while the ship has no employment.",
        "Do not compare the TC-in daily hire against a $/mt route without converting the physical voyage.",
      ],
      stopLoss: "Stop before trade entry: no physical employment means no basis trade.",
      exitTrigger: "Re-open only when cargo, TC-out, or voyage relet terms are entered.",
      rationale: "A TC-in ship without employment is directional freight exposure plus idle-day risk, not physical-paper arbitrage.",
    };
  }

  if (finalPnl <= 0 || signal.recommendation === "NO TRADE") {
    const packageIssue =
      finalPnl <= 0
        ? `Current risk-adjusted PnL is ${money(finalPnl)}.`
        : `Current risk-adjusted PnL is ${money(finalPnl)}, but the package fails the basis-trade test because ship basis, paper edge, or route fit is not strong enough.`;
    return {
      tradeClass: "no trade",
      shipAction:
        finalPnl <= 0
          ? "Do not add this physical exposure on the current terms. Improve the TC-in hire, freight, bunker price, laycan, or route fit before committing the ship."
          : "Do not call this an arbitrage. If the desk still wants the employment, treat the ship as a directional physical voyage and do not attach an alpha paper hedge.",
      derivativeAction: "Do not trade the derivative as a package hedge. Paper alone may be reviewed separately if the paper edge is strong.",
      employmentMode: "do not employ yet",
      paperSide: "NONE",
      actionSteps: [
        packageIssue,
        `Use ${rate(physical.requiredFreightPerMt, "$/mt")} freight or ${rate(physical.requiredTcOut, "$/day")} TC-out as the minimum economic target.`,
        "Re-run after updating bunker, port DA, canal, and waiting assumptions.",
      ],
      doNotDo: ["Do not force a hedge to rescue a weak physical deal.", "Do not leave the vessel idle while waiting for paper convergence."],
      stopLoss: `${money(-Math.max(50000, Math.abs(finalPnl) * 0.35))} from current mark or any unfixed employment past laycan.`,
      exitTrigger: "Exit/stand down if the physical edge stays negative after updated quotes.",
      rationale: "The combined economics do not clear the risk-adjusted threshold.",
    };
  }

  const employmentMode = employmentModeFor(opportunity);
  const paperSide = shortPaperIsRich ? "SHORT" : longPaperIsCheap ? "LONG" : "NONE";
  const tradeClass = classifyTrade({ signal, paperSide, physicalEdgeIsGood });
  const shipAction = shipActionFor({ opportunity, physical, employmentMode, paperSide });
  const derivativeAction =
    paperSide === "NONE"
      ? "Do not add paper for edge. If risk policy requires cover, use only a defensive hedge ratio and mark it as risk reduction, not alpha."
      : `${paperSide === "SHORT" ? "Sell/short" : "Buy/long"} ${contract.contract_code} after the physical fixture is fixed. Use ${hedge.roundedLots} rounded lots, equal to ${hedge.roundedNotional.toLocaleString()} ${hedge.notionalUnit}.`;

  return {
    tradeClass,
    shipAction,
    derivativeAction,
    employmentMode,
    paperSide,
    actionSteps: [
      shipAction,
      `Confirm route exposure is ${Object.entries(route.exposure).map(([key, value]) => `${Math.round(value * 100)}% ${key}`).join(", ")}.`,
      derivativeAction,
      `Entry reference: market ${rate(contract.price, contract.unit)}, expected settlement ${rate(settlement.expectedSettlement, settlement.rule.unit)}.`,
      `Target risk-adjusted package PnL: ${money(finalPnl)}. Physical PnL ${money(signal.physical_pnl)}, paper PnL ${money(signal.paper_pnl)}.`,
    ],
    doNotDo: [
      "Do not execute the FFA before the cargo/TC-out/voyage relet terms are fixed.",
      "Do not use P5TC as if it were a perfect P6 hedge; residual route basis must stay visible.",
      "Do not size BLPG-style $/mt paper in days; use cargo tonnes if the route is LPG.",
    ],
    stopLoss: `${money(-Math.max(50000, Math.abs(finalPnl) * 0.35))} package loss, route-basis z-score beyond +/-2, or employment slips beyond laycan.`,
    exitTrigger:
      "Exit paper when paper edge compresses below zero, physical fixture is cancelled/relet, bunker spread invalidates scrubber economics, or route mismatch warning escalates.",
    rationale: rationaleFor({ physicalEdgeIsGood, shortPaperIsRich, longPaperIsCheap, signal }),
  };
}

function employmentModeFor(opportunity: PhysicalOpportunityRow): TradeActionPlan["employmentMode"] {
  if (opportunity.trade_type === "TC_IN_AND_TC_OUT") return "put out on TC";
  if (opportunity.trade_type === "VOYAGE_RELET") return "relet voyage";
  if (opportunity.trade_type === "COA_COVER" || opportunity.trade_type === "CARGO_COVER") return "cover COA/cargo";
  if (opportunity.trade_type === "TC_IN_AND_VOYAGE") return "fix spot voyage";
  return "do not employ yet";
}

function shipActionFor(input: {
  opportunity: PhysicalOpportunityRow;
  physical: PhysicalResult;
  employmentMode: TradeActionPlan["employmentMode"];
  paperSide: TradeActionPlan["paperSide"];
}): string {
  if (input.employmentMode === "put out on TC") {
    return `Put the ship out on TC only if the TC-out rate is at least ${rate(input.physical.requiredTcOut, "$/day")} and the sub-period matches the paper month. Capture scrubber value through observed TC-out premium unless bunker benefit is yours.`;
  }
  if (input.employmentMode === "fix spot voyage") {
    return `Fix the spot voyage/cargo if freight is at least ${rate(input.physical.requiredFreightPerMt, "$/mt")} and laycan/port costs remain inside assumptions. Treat the ship as long physical freight until the voyage is fixed.`;
  }
  if (input.employmentMode === "cover COA/cargo") {
    return `Use the TC-in ship to cover the cargo/COA only if the internal freight value clears ${rate(input.physical.requiredFreightPerMt, "$/mt")}. Do not leave the cargo uncovered against paper.`;
  }
  if (input.employmentMode === "relet voyage") {
    return `Relet the voyage only if the relet economics clear ${rate(input.physical.requiredFreightPerMt, "$/mt")} net of commission and port/canal risk.`;
  }
  return input.paperSide === "NONE" ? "Stand down on physical employment until economics improve." : "Secure physical employment before trading paper.";
}

function classifyTrade(input: {
  signal: SignalResult;
  paperSide: TradeActionPlan["paperSide"];
  physicalEdgeIsGood: boolean;
}): TradeActionPlan["tradeClass"] {
  if (input.signal.risk_flag === "NO_EMPLOYMENT_PLAN") return "dangerous false arbitrage";
  if (input.physicalEdgeIsGood && input.paperSide === "SHORT") return "basis trade";
  if (input.physicalEdgeIsGood && input.paperSide === "NONE") return "physical-only trade";
  if (!input.physicalEdgeIsGood && input.paperSide !== "NONE") return "paper-only trade";
  if (input.signal.risk_flag === "CLEAR") return "relative value trade";
  return "directional freight trade";
}

function rationaleFor(input: {
  physicalEdgeIsGood: boolean;
  shortPaperIsRich: boolean;
  longPaperIsCheap: boolean;
  signal: SignalResult;
}): string {
  if (input.physicalEdgeIsGood && input.shortPaperIsRich) {
    return "The ship outperforms the Baltic benchmark and paper is rich versus expected settlement, so the natural package is long physical freight and short paper.";
  }
  if (input.physicalEdgeIsGood) {
    return "The physical ship works, but paper is not rich enough to justify an alpha hedge. Employment is the main trade.";
  }
  if (input.longPaperIsCheap) {
    return "Paper is cheap versus expected settlement, but physical edge is not strong enough. Treat it as paper-only unless a better ship fixture appears.";
  }
  return `Recommendation constrained by ${input.signal.risk_flag}.`;
}
